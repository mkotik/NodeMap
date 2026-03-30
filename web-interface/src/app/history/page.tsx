"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useChatContext } from "@/context/ChatContext";
import { trpc } from "@/lib/trpc";
import BeatLoader from "react-spinners/BeatLoader";
import ClipLoader from "react-spinners/ClipLoader";
import "./History.scss";

interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  branchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

type MenuState =
  | { type: "closed" }
  | { type: "menu"; chatId: string }
  | { type: "confirmDelete"; chatId: string }
  | { type: "rename"; chatId: string; value: string };

function timeGroup(date: Date): string {
  const now = new Date();
  const d = new Date(date);
  const diff = now.getTime() - d.getTime();
  const days = Math.floor(diff / (1000 * 60 * 60 * 24));

  if (days === 0 && now.getDate() === d.getDate()) return "Today";
  if (days <= 1 && now.getDate() - d.getDate() === 1) return "Yesterday";
  if (days < 7) return "This Week";
  if (days < 30) return "This Month";
  return "Older";
}

const PAGE_SIZE = 10;

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { loadConversation, completingChatIds, recoverChat } = useChatContext();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [menu, setMenu] = useState<MenuState>({ type: "closed" });

  const menuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);

  // Pagination: cursor stack for prev/next
  const [cursorStack, setCursorStack] = useState<string[]>([]);
  const [nextCursor, setNextCursor] = useState<string | null>(null);
  const [total, setTotal] = useState(0);
  const page = cursorStack.length + 1;
  const totalPages = Math.max(1, Math.ceil(total / PAGE_SIZE));
  const hasNext = nextCursor !== null;
  const hasPrev = cursorStack.length > 0;

  const searchRef = useRef(search);
  searchRef.current = search;

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      if (menuRef.current && !menuRef.current.contains(e.target as Node)) {
        setMenu({ type: "closed" });
      }
    }
    if (menu.type !== "closed") {
      document.addEventListener("mousedown", handleClick);
      return () => document.removeEventListener("mousedown", handleClick);
    }
  }, [menu.type]);

  // Focus rename input when it appears
  useEffect(() => {
    if (menu.type === "rename") renameInputRef.current?.focus();
  }, [menu.type]);

  const fetchPage = useCallback(
    async (cursor?: string | null, searchTerm?: string) => {
      const data = await trpc.conversation.list.query({
        limit: PAGE_SIZE,
        cursor: cursor ?? null,
        ...(searchTerm ? { search: searchTerm } : {}),
      });
      const items = data.items.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));
      return { items, nextCursor: data.nextCursor, total: data.total };
    },
    [],
  );

  // Load a page by cursor, with an optional state callback that runs
  // atomically when the data arrives (so cursor stack + data update together).
  const loadPage = useCallback(
    async (cursor?: string | null, onData?: () => void) => {
      setNavigating(true);
      try {
        const term = searchRef.current.trim() || undefined;
        const {
          items,
          nextCursor: nc,
          total: t,
        } = await fetchPage(cursor, term);
        // Update cursor stack and data in the same tick — no flash
        onData?.();
        setConversations(items);
        setNextCursor(nc);
        setTotal(t);
      } catch (err) {
        console.error(err);
      } finally {
        setNavigating(false);
      }
    },
    [fetchPage],
  );

  // Initial load
  useEffect(() => {
    if (authLoading) return;
    if (!user) {
      setInitialLoading(false);
      return;
    }
    loadPage().finally(() => setInitialLoading(false));
  }, [user, authLoading, loadPage]);

  // Reload current page when a background completion finishes
  useEffect(() => {
    const handler = () => {
      const cursor =
        cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1];
      loadPage(cursor);
    };
    window.addEventListener("chat-completed", handler);
    return () => window.removeEventListener("chat-completed", handler);
  }, [cursorStack, loadPage]);

  // Auto-recover any "Untitled" chats visible on this page
  useEffect(() => {
    for (const c of conversations) {
      if (c.title === "Untitled") recoverChat(c.id);
    }
  }, [conversations, recoverChat]);

  // Debounced search: reset to page 1 when search changes
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (initialLoading) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      loadPage(null, () => {
        setCursorStack([]);
        setNextCursor(null);
      });
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (!nextCursor || navigating) return;
    const cursor = nextCursor;
    loadPage(cursor, () => {
      setCursorStack((prev) => [...prev, cursor]);
    });
  }

  function handlePrev() {
    if (cursorStack.length === 0 || navigating) return;
    const newStack = [...cursorStack];
    newStack.pop();
    const prevCursor =
      newStack.length === 0 ? null : newStack[newStack.length - 1];
    loadPage(prevCursor, () => {
      setCursorStack(newStack);
    });
  }

  const grouped = useMemo(() => {
    const groups: Record<string, ConversationItem[]> = {};
    for (const c of conversations) {
      const group = timeGroup(c.updatedAt);
      if (!groups[group]) groups[group] = [];
      groups[group].push(c);
    }
    return groups;
  }, [conversations]);

  const groupOrder = ["Today", "Yesterday", "This Week", "This Month", "Older"];

  async function handleOpen(id: string) {
    await loadConversation(id);
    router.push("/");
  }

  async function handleDelete(id: string) {
    setDeletingId(id);
    setMenu({ type: "closed" });
    try {
      const pageCursor =
        cursorStack.length === 0 ? null : cursorStack[cursorStack.length - 1];
      const result = await trpc.conversation.delete.mutate({
        id,
        pageCursor,
        pageLimit: PAGE_SIZE,
        search: search.trim() || undefined,
      });
      const items = result.items.map((c) => ({
        ...c,
        createdAt: new Date(c.createdAt),
        updatedAt: new Date(c.updatedAt),
      }));

      if (items.length === 0 && cursorStack.length > 0) {
        const newStack = [...cursorStack];
        newStack.pop();
        const prevCursor =
          newStack.length === 0 ? null : newStack[newStack.length - 1];
        setCursorStack(newStack);
        setTotal(result.total);
        loadPage(prevCursor);
      } else {
        setConversations(items);
        setNextCursor(result.nextCursor);
        setTotal(result.total);
      }
    } catch (err) {
      console.error(err);
    } finally {
      setDeletingId(null);
    }
  }

  async function handleRename(id: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    try {
      await trpc.conversation.rename.mutate({ id, title: trimmed });
      setConversations((prev) =>
        prev.map((c) => (c.id === id ? { ...c, title: trimmed } : c)),
      );
      setMenu({ type: "closed" });
    } catch (err) {
      console.error(err);
    }
  }

  function formatTime(date: Date) {
    const d = new Date(date);
    const now = new Date();
    if (d.toDateString() === now.toDateString()) {
      return d.toLocaleTimeString([], { hour: "numeric", minute: "2-digit" });
    }
    return d.toLocaleDateString([], { month: "short", day: "numeric" });
  }

  if (!user && !authLoading) {
    return (
      <div className="history history--empty">
        <p className="history__empty-text">
          Sign in to view your conversation history.
        </p>
      </div>
    );
  }

  return (
    <div className="history">
      <div className="history__header">
        <h1 className="history__title">Logic Threads</h1>
        {total > 0 && <span className="history__count">{total} threads</span>}
      </div>

      <div className="history__search">
        <svg
          className="history__search-icon"
          width="16"
          height="16"
          viewBox="0 0 24 24"
          fill="none"
          stroke="currentColor"
          strokeWidth="2"
          strokeLinecap="round"
          strokeLinejoin="round"
        >
          <circle cx="11" cy="11" r="8" />
          <path d="m21 21-4.3-4.3" />
        </svg>
        <input
          className="history__search-input"
          type="text"
          placeholder="Search your logic tree..."
          value={search}
          maxLength={100}
          onChange={(e) => setSearch(e.target.value)}
        />
        {navigating && search && (
          <div className="history__search-dots">
            <BeatLoader color="#6d758c" size={6} />
          </div>
        )}
      </div>

      {initialLoading ? (
        <div className="history__loading">
          <ClipLoader color="#6d758c" size={24} />
        </div>
      ) : conversations.length === 0 && !hasPrev ? (
        <div className="history--empty">
          <p className="history__empty-text">
            {search
              ? "No threads match your search."
              : "No conversation threads yet."}
          </p>
        </div>
      ) : (
        <>
          <div className="history__groups">
            {groupOrder.map((group) =>
              grouped[group]?.length ? (
                <section key={group} className="history__group">
                  <h2 className="history__group-label">{group}</h2>
                  <div className="history__cards">
                    {grouped[group].map((c) => {
                      const menuOpen =
                        menu.type !== "closed" &&
                        "chatId" in menu &&
                        menu.chatId === c.id;

                      return (
                        <div
                          key={c.id}
                          className="history__card"
                          ref={menuOpen ? menuRef : undefined}
                        >
                          {menu.type === "rename" && menu.chatId === c.id ? (
                            <div className="history__card-rename">
                              <input
                                ref={renameInputRef}
                                className="history__card-rename-input"
                                type="text"
                                value={menu.value}
                                maxLength={20}
                                onClick={(e) => e.stopPropagation()}
                                onChange={(e) =>
                                  setMenu({ ...menu, value: e.target.value })
                                }
                                onKeyDown={(e) => {
                                  if (e.key === "Enter")
                                    handleRename(c.id, menu.value);
                                  if (e.key === "Escape")
                                    setMenu({ type: "closed" });
                                }}
                              />
                              <button
                                type="button"
                                className="history__card-rename-save"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleRename(c.id, menu.value);
                                }}
                                disabled={!menu.value.trim()}
                              >
                                Save
                              </button>
                            </div>
                          ) : (
                            <>
                              <div
                                className="history__card-clickable"
                                role="button"
                                tabIndex={0}
                                onClick={() => handleOpen(c.id)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter" || e.key === " ") {
                                    e.preventDefault();
                                    handleOpen(c.id);
                                  }
                                }}
                              >
                                <div className="history__card-dot" />
                                <div className="history__card-body">
                                  <div className="history__card-header">
                                    <span className="history__card-title">
                                      {completingChatIds.has(c.id) ? (
                                        <BeatLoader color="#69f6b8" size={4} />
                                      ) : (
                                        c.title
                                      )}
                                    </span>
                                    {c.preview && (
                                      <span className="history__card-preview">
                                        {c.preview}
                                      </span>
                                    )}
                                  </div>
                                  <span className="history__card-time">
                                    {formatTime(c.updatedAt)}
                                  </span>
                                </div>
                              </div>

                              <div className="history__card-actions">
                                <button
                                  type="button"
                                  className="history__card-menu-btn"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setMenu(
                                      menuOpen
                                        ? { type: "closed" }
                                        : { type: "menu", chatId: c.id },
                                    );
                                  }}
                                  aria-label="Chat options"
                                >
                                  <svg
                                    width="12"
                                    height="12"
                                    viewBox="0 0 24 24"
                                    fill="currentColor"
                                  >
                                    <circle cx="12" cy="5" r="2" />
                                    <circle cx="12" cy="12" r="2" />
                                    <circle cx="12" cy="19" r="2" />
                                  </svg>
                                </button>

                                {menu.type === "menu" &&
                                  menu.chatId === c.id && (
                                    <div className="history__card-dropdown">
                                      <button
                                        type="button"
                                        className="history__card-dropdown-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenu({
                                            type: "rename",
                                            chatId: c.id,
                                            value: c.title,
                                          });
                                        }}
                                      >
                                        Rename
                                      </button>
                                      <button
                                        type="button"
                                        className="history__card-dropdown-item history__card-dropdown-item--danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenu({
                                            type: "confirmDelete",
                                            chatId: c.id,
                                          });
                                        }}
                                      >
                                        Delete
                                      </button>
                                    </div>
                                  )}

                                {menu.type === "confirmDelete" &&
                                  menu.chatId === c.id && (
                                    <div className="history__card-dropdown">
                                      <span className="history__card-dropdown-label">
                                        Delete this chat?
                                      </span>
                                      <button
                                        type="button"
                                        className="history__card-dropdown-item history__card-dropdown-item--danger"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          handleDelete(c.id);
                                        }}
                                        disabled={deletingId === c.id}
                                      >
                                        {deletingId === c.id ? (
                                          <BeatLoader
                                            color="#ff716c"
                                            size={3}
                                          />
                                        ) : (
                                          "Yes, delete"
                                        )}
                                      </button>
                                      <button
                                        type="button"
                                        className="history__card-dropdown-item"
                                        onClick={(e) => {
                                          e.stopPropagation();
                                          setMenu({ type: "closed" });
                                        }}
                                      >
                                        Cancel
                                      </button>
                                    </div>
                                  )}
                              </div>
                            </>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              ) : null,
            )}
          </div>

          {(hasPrev || hasNext) && (
            <div className="history__pagination-container history__pagination">
              <div className="history__pagination">
                <button
                  type="button"
                  className="history__page-btn"
                  onClick={handlePrev}
                  disabled={!hasPrev || navigating}
                >
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M15 18l-6-6 6-6" />
                  </svg>
                  Prev
                </button>
                <span className="history__page-indicator">
                  {navigating ? (
                    <BeatLoader color="#6d758c" size={6} />
                  ) : (
                    `Page ${page} of ${totalPages}`
                  )}
                </span>
                <button
                  type="button"
                  className="history__page-btn"
                  onClick={handleNext}
                  disabled={!hasNext || navigating}
                >
                  Next
                  <svg
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2.5"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M9 18l6-6-6-6" />
                  </svg>
                </button>
              </div>
            </div>
          )}
        </>
      )}
    </div>
  );
}
