"use client";

import { useState, useRef, useEffect } from "react";
import { useRouter, usePathname } from "next/navigation";
import Link from "next/link";
import { useChatContext } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import { trpc } from "@/lib/trpc";
import BeatLoader from "react-spinners/BeatLoader";
import "./Sidebar.scss";

type MenuState =
  | { type: "closed" }
  | { type: "menu"; chatId: string }
  | { type: "confirmDelete"; chatId: string }
  | { type: "rename"; chatId: string; value: string }
  | { type: "branchMenu"; branchId: string }
  | { type: "branchConfirmDelete"; branchId: string }
  | { type: "branchRename"; branchId: string; value: string };

export default function Sidebar() {
  const {
    resetAll,
    tree,
    conversationId,
    conversationTitle,
    setConversationTitle,
    namingConversation,
    completingChatIds,
    loadConversation,
    recentChats,
    recentsLoaded,
    refreshRecents,
    switchBranch,
    deleteBranchById,
    renameBranchById,
  } = useChatContext();
  const { user, logout } = useAuth();
  const router = useRouter();
  const pathname = usePathname();
  const onChatPage = pathname === "/" || pathname === "/nodes";

  useEffect(() => {
    if (onChatPage) refreshRecents();
  }, [pathname]); // eslint-disable-line react-hooks/exhaustive-deps

  const [loadingId, setLoadingId] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState(false);
  const [menu, setMenu] = useState<MenuState>({ type: "closed" });
  const menuRef = useRef<HTMLDivElement>(null);
  const branchMenuRef = useRef<HTMLDivElement>(null);
  const renameInputRef = useRef<HTMLInputElement>(null);
  const branchRenameInputRef = useRef<HTMLInputElement>(null);

  // Branches for the active conversation (exclude main)
  const branches = Object.values(tree.branches).filter(
    (b) => b.id !== tree.mainBranchId && b.nodeIds.length > 0,
  );

  // Collect all descendant sub-branches of a given branch
  function getDescendantBranches(branchId: string) {
    const descendants: typeof branches = [];
    function collect(parentId: string) {
      for (const b of Object.values(tree.branches)) {
        if (b.parentBranchId === parentId && b.id !== tree.mainBranchId) {
          descendants.push(b);
          collect(b.id);
        }
      }
    }
    collect(branchId);
    return descendants;
  }

  // Show a pending entry when the user has sent a message but the chat
  // hasn't appeared in recents yet (save still in-flight).
  const hasMessages = Object.keys(tree.nodes).length > 0;
  const activeInRecents = recentChats.some((c) => c.id === conversationId);
  const showPendingEntry = hasMessages && !activeInRecents && onChatPage;

  // Close menu on outside click
  useEffect(() => {
    function handleClick(e: MouseEvent) {
      const target = e.target as Node;
      if (
        menuRef.current &&
        !menuRef.current.contains(target) &&
        (!branchMenuRef.current || !branchMenuRef.current.contains(target))
      ) {
        setMenu({ type: "closed" });
      }
      if (
        branchMenuRef.current &&
        !branchMenuRef.current.contains(target) &&
        (!menuRef.current || !menuRef.current.contains(target))
      ) {
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
    if (menu.type === "branchRename") branchRenameInputRef.current?.focus();
  }, [menu.type]);

  function handleLoadChat(id: string) {
    setLoadingId(id);
    setMenu({ type: "closed" });
    loadConversation(id)
      .then(() => router.push("/"))
      .finally(() => setLoadingId(null));
  }

  function handleSwitchBranch(branchId: string) {
    setLoadingId(branchId);
    switchBranch(branchId);
    router.push("/");
    setTimeout(() => setLoadingId(null), 300);
  }

  async function handleBranchRename(branchId: string, label: string) {
    const trimmed = label.trim();
    if (!trimmed) return;
    setActionLoading(true);
    try {
      renameBranchById(branchId, trimmed);
      if (conversationId) {
        await trpc.conversation.renameBranch.mutate({
          conversationId,
          branchId,
          label: trimmed,
        });
      }
      setMenu({ type: "closed" });
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleBranchDelete(branchId: string) {
    setActionLoading(true);
    try {
      // Check if active branch is the target or a descendant of it
      let wasActive = false;
      let checkId: string | null = tree.activeBranchId;
      while (checkId) {
        if (checkId === branchId) {
          wasActive = true;
          break;
        }
        checkId = tree.branches[checkId]?.parentBranchId ?? null;
      }
      deleteBranchById(branchId);
      if (conversationId) {
        await trpc.conversation.deleteBranch.mutate({
          conversationId,
          branchId,
        });
      }
      if (wasActive && pathname !== "/nodes") {
        router.push("/");
      }
      setMenu({ type: "closed" });
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleDelete(chatId: string) {
    setActionLoading(true);
    try {
      await trpc.conversation.delete.mutate({
        id: chatId,
        pageLimit: 5,
      });
      if (conversationId === chatId) {
        resetAll();
        router.push("/");
      }
      setMenu({ type: "closed" });
      refreshRecents();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  async function handleRename(chatId: string, title: string) {
    const trimmed = title.trim();
    if (!trimmed) return;
    setActionLoading(true);
    try {
      await trpc.conversation.rename.mutate({ id: chatId, title: trimmed });
      if (conversationId === chatId) setConversationTitle(trimmed);
      setMenu({ type: "closed" });
      refreshRecents();
    } catch {
      /* ignore */
    } finally {
      setActionLoading(false);
    }
  }

  return (
    <aside className="sidebar">
      <div className="sidebar__top">
        <button
          type="button"
          className="sidebar__brand"
          onClick={() => {
            resetAll();
            router.push("/");
          }}
        >
          <span className="sidebar__logo">NodeMap.io</span>
          <span className="sidebar__tagline">AI Chat</span>
        </button>

        <button
          className="sidebar__new-chat"
          type="button"
          onClick={() => {
            resetAll();
            router.push("/");
          }}
        >
          <svg
            width="14"
            height="14"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="3"
            strokeLinecap="round"
          >
            <path d="M12 5v14M5 12h14" />
          </svg>
          New Chat
        </button>

        <nav className="sidebar__nav">
          <Link
            href="/history"
            className={`sidebar__nav-item${pathname === "/history" ? " sidebar__nav-item--active" : ""}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <circle cx="12" cy="12" r="10" />
              <path d="M12 6v6l4 2" />
            </svg>
            History
          </Link>
          <Link
            href="/settings"
            className={`sidebar__nav-item${pathname === "/settings" ? " sidebar__nav-item--active" : ""}`}
          >
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z" />
              <circle cx="12" cy="12" r="3" />
            </svg>
            Settings
          </Link>
        </nav>

        {/* Recents divider + section */}
        {user && onChatPage && (
          <>
            <div className="sidebar__divider" />
            <div className="sidebar__recents">
              <span className="sidebar__recents-label">Recent</span>
              {!recentsLoaded && !showPendingEntry ? (
                <div className="sidebar__recents-loading">
                  <BeatLoader color="#6d758c" size={4} />
                </div>
              ) : (
                <div className="sidebar__recents-list">
                  {showPendingEntry && (
                    <div className="sidebar__recent-wrapper">
                      <div className="sidebar__recent-row">
                        <button
                          type="button"
                          className="sidebar__recent sidebar__recent--active"
                          disabled
                        >
                          <span className="sidebar__recent-indicator">
                            <span className="sidebar__recent-dot" />
                          </span>
                          <span className="sidebar__recent-title">
                            {namingConversation ? (
                              <BeatLoader color="#69f6b8" size={3} />
                            ) : (
                              conversationTitle
                            )}
                          </span>
                        </button>
                      </div>
                    </div>
                  )}
                  {recentChats.map((c) => {
                    const isActive = c.id === conversationId && onChatPage;
                    const menuOpen =
                      menu.type !== "closed" &&
                      "chatId" in menu &&
                      menu.chatId === c.id;
                    const displayTitle =
                      c.id === conversationId ? conversationTitle : c.title;

                    return (
                      <div
                        key={c.id}
                        className="sidebar__recent-wrapper"
                        ref={menuOpen ? menuRef : undefined}
                      >
                        {/* Rename mode */}
                        {menu.type === "rename" && menu.chatId === c.id ? (
                          <div className="sidebar__rename">
                            <input
                              ref={renameInputRef}
                              className="sidebar__rename-input"
                              type="text"
                              value={menu.value}
                              maxLength={80}
                              onChange={(e) =>
                                setMenu({ ...menu, value: e.target.value })
                              }
                              onKeyDown={(e) => {
                                if (e.key === "Enter")
                                  handleRename(c.id, menu.value);
                                if (e.key === "Escape")
                                  setMenu({ type: "closed" });
                              }}
                              disabled={actionLoading}
                            />
                            <button
                              type="button"
                              className="sidebar__rename-save"
                              onClick={() => handleRename(c.id, menu.value)}
                              disabled={actionLoading}
                            >
                              {actionLoading ? (
                                <BeatLoader color="#69f6b8" size={3} />
                              ) : (
                                "Save"
                              )}
                            </button>
                          </div>
                        ) : (
                          <div className="sidebar__recent-row">
                            <button
                              type="button"
                              className={`sidebar__recent ${isActive ? "sidebar__recent--active" : ""}`}
                              onClick={() => handleLoadChat(c.id)}
                              disabled={loadingId === c.id}
                            >
                              <span className="sidebar__recent-indicator">
                                {loadingId === c.id ? (
                                  <BeatLoader color="#69f6b8" size={3} />
                                ) : (
                                  <span className="sidebar__recent-dot" />
                                )}
                              </span>
                              <span className="sidebar__recent-title">
                                {(isActive && namingConversation) ||
                                completingChatIds.has(c.id) ? (
                                  <BeatLoader color="#69f6b8" size={3} />
                                ) : (
                                  displayTitle
                                )}
                              </span>
                            </button>

                            {/* 3-dot menu trigger */}
                            <button
                              type="button"
                              className="sidebar__recent-menu-btn"
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

                            {/* Dropdown menu */}
                            {menu.type === "menu" && menu.chatId === c.id && (
                              <div className="sidebar__recent-dropdown">
                                <button
                                  type="button"
                                  className="sidebar__recent-dropdown-item"
                                  onClick={() =>
                                    setMenu({
                                      type: "rename",
                                      chatId: c.id,
                                      value: displayTitle,
                                    })
                                  }
                                >
                                  Rename
                                </button>
                                <button
                                  type="button"
                                  className="sidebar__recent-dropdown-item sidebar__recent-dropdown-item--danger"
                                  onClick={() =>
                                    setMenu({
                                      type: "confirmDelete",
                                      chatId: c.id,
                                    })
                                  }
                                >
                                  Delete
                                </button>
                              </div>
                            )}

                            {/* Delete confirmation */}
                            {menu.type === "confirmDelete" &&
                              menu.chatId === c.id && (
                                <div className="sidebar__recent-dropdown">
                                  <span className="sidebar__recent-dropdown-label">
                                    Delete this chat?
                                  </span>
                                  <button
                                    type="button"
                                    className="sidebar__recent-dropdown-item sidebar__recent-dropdown-item--danger"
                                    onClick={() => handleDelete(c.id)}
                                    disabled={actionLoading}
                                  >
                                    {actionLoading ? (
                                      <BeatLoader color="#ff716c" size={3} />
                                    ) : (
                                      "Yes, delete"
                                    )}
                                  </button>
                                  <button
                                    type="button"
                                    className="sidebar__recent-dropdown-item"
                                    onClick={() => setMenu({ type: "closed" })}
                                  >
                                    Cancel
                                  </button>
                                </div>
                              )}
                          </div>
                        )}

                        {/* Branches for active conversation */}
                        {isActive &&
                          branches.length > 0 &&
                          menu.type !== "rename" && (
                            <div className="sidebar__branches">
                              {branches.map((b) => {
                                const branchColor =
                                  b.color === "primary"
                                    ? "#69f6b8"
                                    : b.color === "secondary"
                                      ? "#699cff"
                                      : "#ac8aff";
                                const branchMenuOpen =
                                  menu.type !== "closed" &&
                                  "branchId" in menu &&
                                  menu.branchId === b.id;

                                return (
                                  <div
                                    key={b.id}
                                    className="sidebar__branch-wrapper"
                                    ref={
                                      branchMenuOpen ? branchMenuRef : undefined
                                    }
                                  >
                                    {/* Branch rename mode */}
                                    {menu.type === "branchRename" &&
                                    menu.branchId === b.id ? (
                                      <div className="sidebar__rename">
                                        <input
                                          ref={branchRenameInputRef}
                                          className="sidebar__rename-input"
                                          type="text"
                                          value={menu.value}
                                          maxLength={20}
                                          onChange={(e) =>
                                            setMenu({
                                              ...menu,
                                              value: e.target.value,
                                            })
                                          }
                                          onKeyDown={(e) => {
                                            if (e.key === "Enter")
                                              handleBranchRename(
                                                b.id,
                                                menu.value,
                                              );
                                            if (e.key === "Escape")
                                              setMenu({ type: "closed" });
                                          }}
                                        />
                                        <button
                                          type="button"
                                          className="sidebar__rename-save"
                                          onClick={() =>
                                            handleBranchRename(b.id, menu.value)
                                          }
                                          disabled={!menu.value.trim()}
                                        >
                                          Save
                                        </button>
                                      </div>
                                    ) : (
                                      <div className="sidebar__branch-row">
                                        <button
                                          type="button"
                                          className={`sidebar__branch sidebar__branch--${b.color}`}
                                          onClick={() =>
                                            handleSwitchBranch(b.id)
                                          }
                                          disabled={loadingId === b.id}
                                        >
                                          <span className="sidebar__branch-indicator">
                                            {loadingId === b.id ? (
                                              <BeatLoader
                                                color={branchColor}
                                                size={2}
                                              />
                                            ) : (
                                              <span
                                                className={`sidebar__branch-dot sidebar__branch-dot--${b.color}`}
                                              />
                                            )}
                                          </span>
                                          <span className="sidebar__branch-title">
                                            {b.label}
                                          </span>
                                        </button>

                                        {/* Branch 3-dot menu trigger */}
                                        <button
                                          type="button"
                                          className="sidebar__branch-menu-btn"
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setMenu(
                                              branchMenuOpen
                                                ? { type: "closed" }
                                                : {
                                                    type: "branchMenu",
                                                    branchId: b.id,
                                                  },
                                            );
                                          }}
                                          aria-label="Branch options"
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

                                        {/* Branch dropdown menu */}
                                        {menu.type === "branchMenu" &&
                                          menu.branchId === b.id && (
                                            <div className="sidebar__recent-dropdown">
                                              <button
                                                type="button"
                                                className="sidebar__recent-dropdown-item"
                                                onClick={() =>
                                                  setMenu({
                                                    type: "branchRename",
                                                    branchId: b.id,
                                                    value: b.label,
                                                  })
                                                }
                                              >
                                                Rename
                                              </button>
                                              <button
                                                type="button"
                                                className="sidebar__recent-dropdown-item sidebar__recent-dropdown-item--danger"
                                                onClick={() =>
                                                  setMenu({
                                                    type: "branchConfirmDelete",
                                                    branchId: b.id,
                                                  })
                                                }
                                              >
                                                Delete
                                              </button>
                                            </div>
                                          )}

                                        {/* Branch delete confirmation */}
                                        {menu.type === "branchConfirmDelete" &&
                                          menu.branchId === b.id &&
                                          (() => {
                                            const descendants =
                                              getDescendantBranches(b.id);
                                            return (
                                              <div className="sidebar__recent-dropdown">
                                                <span className="sidebar__recent-dropdown-label">
                                                  Delete this branch?
                                                </span>
                                                {descendants.length > 0 && (
                                                  <div className="sidebar__recent-dropdown-label sidebar__recent-dropdown-label--warning">
                                                    This will also delete{" "}
                                                    {descendants.length}{" "}
                                                    sub-branch
                                                    {descendants.length > 1
                                                      ? "es"
                                                      : ""}
                                                    :
                                                    <ul className="sidebar__recent-dropdown-list">
                                                      {descendants.map((d) => (
                                                        <li key={d.id}>
                                                          {d.label}
                                                        </li>
                                                      ))}
                                                    </ul>
                                                  </div>
                                                )}
                                                <button
                                                  type="button"
                                                  className="sidebar__recent-dropdown-item sidebar__recent-dropdown-item--danger"
                                                  onClick={() =>
                                                    handleBranchDelete(b.id)
                                                  }
                                                  disabled={actionLoading}
                                                >
                                                  {actionLoading ? (
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
                                                  className="sidebar__recent-dropdown-item"
                                                  onClick={() =>
                                                    setMenu({ type: "closed" })
                                                  }
                                                >
                                                  Cancel
                                                </button>
                                              </div>
                                            );
                                          })()}
                                      </div>
                                    )}
                                  </div>
                                );
                              })}
                            </div>
                          )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </>
        )}
      </div>

      <div className="sidebar__bottom">
        {user ? (
          <div className="sidebar__user">
            <div className="sidebar__avatar">
              {user.firstName.charAt(0).toUpperCase()}
            </div>
            <div className="sidebar__user-info">
              <span className="sidebar__user-name">
                {user.firstName} {user.lastName}
              </span>
              <span className="sidebar__user-role">{user.role}</span>
            </div>
            <button
              className="sidebar__logout"
              type="button"
              onClick={() => logout()}
              aria-label="Sign out"
            >
              <svg
                width="16"
                height="16"
                viewBox="0 0 24 24"
                fill="none"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4" />
                <polyline points="16 17 21 12 16 7" />
                <line x1="21" y1="12" x2="9" y2="12" />
              </svg>
            </button>
          </div>
        ) : (
          <a href="/auth/login" className="sidebar__sign-in">
            <svg
              width="18"
              height="18"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2" />
              <circle cx="12" cy="7" r="4" />
            </svg>
            Sign In
            <svg
              width="14"
              height="14"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              className="sidebar__sign-in-arrow"
            >
              <path d="M9 18l6-6-6-6" />
            </svg>
          </a>
        )}
      </div>
    </aside>
  );
}
