"use client";

import { useState, useEffect, useMemo, useCallback, useRef } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import { useChatContext } from "@/context/ChatContext";
import { trpc } from "@/lib/trpc";
import BeatLoader from "react-spinners/BeatLoader";
import "./History.scss";

interface ConversationItem {
  id: string;
  title: string;
  preview: string;
  branchCount: number;
  createdAt: Date;
  updatedAt: Date;
}

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

const PAGE_SIZE = 4;

export default function HistoryPage() {
  const { user, isLoading: authLoading } = useAuth();
  const { loadConversation } = useChatContext();
  const router = useRouter();
  const [conversations, setConversations] = useState<ConversationItem[]>([]);
  const [initialLoading, setInitialLoading] = useState(true);
  const [navigating, setNavigating] = useState(false);
  const [search, setSearch] = useState("");
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [confirmDeleteId, setConfirmDeleteId] = useState<string | null>(null);

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

  // Load a page by cursor (uses current search term from ref)
  const loadPage = useCallback(
    async (cursor?: string | null) => {
      setNavigating(true);
      try {
        const term = searchRef.current.trim() || undefined;
        const {
          items,
          nextCursor: nc,
          total: t,
        } = await fetchPage(cursor, term);
        setConversations(items);
        setNextCursor(nc);
        setTotal(t);
      } catch {
        /* ignore */
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

  // Debounced search: reset to page 1 when search changes
  const searchTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  useEffect(() => {
    if (initialLoading) return;
    if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    searchTimerRef.current = setTimeout(() => {
      setCursorStack([]);
      setNextCursor(null);
      loadPage(null);
    }, 300);
    return () => {
      if (searchTimerRef.current) clearTimeout(searchTimerRef.current);
    };
  }, [search]); // eslint-disable-line react-hooks/exhaustive-deps

  function handleNext() {
    if (!nextCursor || navigating) return;
    setCursorStack((prev) => [...prev, nextCursor]);
    loadPage(nextCursor);
  }

  function handlePrev() {
    if (cursorStack.length === 0 || navigating) return;
    const newStack = [...cursorStack];
    newStack.pop();
    const prevCursor =
      newStack.length === 0 ? null : newStack[newStack.length - 1];
    setCursorStack(newStack);
    loadPage(prevCursor);
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
    if (confirmDeleteId !== id) {
      setConfirmDeleteId(id);
      return;
    }
    setDeletingId(id);
    setConfirmDeleteId(null);
    try {
      await trpc.conversation.delete.mutate({ id });
      setConversations((prev) => prev.filter((c) => c.id !== id));
    } catch {
      /* ignore */
    } finally {
      setDeletingId(null);
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
          <span className="history__spinner" />
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
                    {grouped[group].map((c) => (
                      <div
                        key={c.id}
                        role="button"
                        tabIndex={0}
                        className="history__card"
                        onClick={() => handleOpen(c.id)}
                        onKeyDown={(e) => {
                          if (e.key === "Enter") handleOpen(c.id);
                        }}
                      >
                        <div className="history__card-dot" />
                        <div className="history__card-body">
                          <div className="history__card-header">
                            <span className="history__card-title">
                              {c.title}
                            </span>
                            <span className="history__card-time">
                              {formatTime(c.updatedAt)}
                            </span>
                          </div>
                          {c.preview && (
                            <p className="history__card-preview">{c.preview}</p>
                          )}
                          <div className="history__card-meta">
                            {c.branchCount > 1 && (
                              <span className="history__card-branches">
                                <svg
                                  width="10"
                                  height="10"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2.5"
                                >
                                  <line x1="6" y1="3" x2="6" y2="15" />
                                  <circle cx="18" cy="6" r="3" />
                                  <circle cx="6" cy="18" r="3" />
                                  <path d="M18 9a9 9 0 0 1-9 9" />
                                </svg>
                                {c.branchCount} branches
                              </span>
                            )}
                            {confirmDeleteId === c.id ? (
                              <>
                                <button
                                  type="button"
                                  className="history__card-confirm"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    handleDelete(c.id);
                                  }}
                                  disabled={deletingId === c.id}
                                >
                                  Delete
                                </button>
                                <button
                                  type="button"
                                  className="history__card-cancel"
                                  onClick={(e) => {
                                    e.stopPropagation();
                                    setConfirmDeleteId(null);
                                  }}
                                >
                                  Cancel
                                </button>
                              </>
                            ) : (
                              <button
                                type="button"
                                className="history__card-delete"
                                onClick={(e) => {
                                  e.stopPropagation();
                                  handleDelete(c.id);
                                }}
                                disabled={deletingId === c.id}
                                aria-label="Delete conversation"
                              >
                                <svg
                                  width="14"
                                  height="14"
                                  viewBox="0 0 24 24"
                                  fill="none"
                                  stroke="currentColor"
                                  strokeWidth="2"
                                  strokeLinecap="round"
                                  strokeLinejoin="round"
                                >
                                  <path d="M3 6h18" />
                                  <path d="M19 6v14c0 1-1 2-2 2H7c-1 0-2-1-2-2V6" />
                                  <path d="M8 6V4c0-1 1-2 2-2h4c1 0 2 1 2 2v2" />
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                      </div>
                    ))}
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
                    <span className="history__spinner" />
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
