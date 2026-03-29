"use client";

import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useChatContext } from "@/context/ChatContext";
import "./TopNav.scss";

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeBranch, isMainBranch, returnToMain, messages } =
    useChatContext();
  const isNodes = pathname === "/nodes";
  const isThread = pathname === "/";
  const onBranch = !isMainBranch && isThread;
  const hasMessages = messages.length > 0;
  const isEmpty = isThread && isMainBranch && !hasMessages;

  return (
    <header className="topnav">
      <div className="topnav__left">
        {!isEmpty && (
          <Link
            href="/nodes"
            className="topnav__node-link"
            aria-label="Node View"
          >
            <svg
              width="16"
              height="16"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
            >
              <rect x="3" y="3" width="7" height="7" rx="1" />
              <rect x="14" y="3" width="7" height="7" rx="1" />
              <rect x="3" y="14" width="7" height="7" rx="1" />
              <rect x="14" y="14" width="7" height="7" rx="1" />
            </svg>
          </Link>
        )}
        {onBranch ? (
          <nav className="topnav__breadcrumbs">
            <button
              className="topnav__breadcrumb"
              type="button"
              onClick={returnToMain}
            >
              Main Thread
            </button>
            <span className="topnav__breadcrumb-sep">/</span>
            <span
              className={`topnav__breadcrumb topnav__breadcrumb--active topnav__breadcrumb--${activeBranch.color}`}
            >
              {activeBranch.label}
            </span>
          </nav>
        ) : !isEmpty ? (
          isNodes ? (
            <button
              type="button"
              className="topnav__breadcrumb topnav__breadcrumb--primary"
              onClick={() => { returnToMain(); router.push("/"); }}
            >
              Main Thread
              <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M9 18l6-6-6-6" />
              </svg>
            </button>
          ) : (
            <span className="topnav__breadcrumb topnav__breadcrumb--active topnav__breadcrumb--primary">
              Main Thread
            </span>
          )
        ) : null}
      </div>
      <div className="topnav__right">
        <button className="topnav__icon-btn" type="button" aria-label="Share">
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
            <path d="M4 12v8a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2v-8" />
            <polyline points="16 6 12 2 8 6" />
            <line x1="12" y1="2" x2="12" y2="15" />
          </svg>
        </button>
        <button
          className="topnav__icon-btn"
          type="button"
          aria-label="More options"
        >
          <svg width="18" height="18" viewBox="0 0 24 24" fill="currentColor">
            <circle cx="12" cy="5" r="1.5" />
            <circle cx="12" cy="12" r="1.5" />
            <circle cx="12" cy="19" r="1.5" />
          </svg>
        </button>
      </div>
    </header>
  );
}
