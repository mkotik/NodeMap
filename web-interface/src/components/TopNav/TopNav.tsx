"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useChatContext } from "@/context/ChatContext";
import BeatLoader from "react-spinners/BeatLoader";
import "./TopNav.scss";

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeBranch, isMainBranch, returnToMain, messages, namingBranches } =
    useChatContext();
  const isNamingBranch = namingBranches.has(activeBranch.id);
  const [mounted, setMounted] = useState(false);
  // eslint-disable-next-line react-hooks/set-state-in-effect -- standard hydration guard
  useEffect(() => setMounted(true), []);

  const isAuth = pathname.startsWith("/auth");
  const isHistory = pathname === "/history";
  const isNodes = pathname === "/nodes";
  const isThread = pathname === "/";
  const onBranch = !isMainBranch && isThread;
  const hasMessages = messages.length > 0;
  const isEmpty = isThread && isMainBranch && !hasMessages;
  const isSettings = pathname === "/settings";
  const isTerms = pathname === "/terms";
  const isPrivacy = pathname === "/privacy";
  const hideNav = isAuth || isHistory || isSettings || isTerms || isPrivacy;

  return (
    <header className="topnav">
      <div className="topnav__left">
        {mounted && !hideNav && (
          <>
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
                  {isNamingBranch ? (
                    <BeatLoader
                      color={
                        activeBranch.color === "primary"
                          ? "#69f6b8"
                          : activeBranch.color === "secondary"
                            ? "#699cff"
                            : "#ac8aff"
                      }
                      size={6}
                    />
                  ) : (
                    activeBranch.label
                  )}
                </span>
              </nav>
            ) : !isEmpty ? (
              isNodes ? (
                <button
                  type="button"
                  className="topnav__breadcrumb topnav__breadcrumb--primary"
                  onClick={() => {
                    returnToMain();
                    router.push("/");
                  }}
                >
                  Main Thread
                  <svg
                    width="14"
                    height="14"
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
              ) : (
                <span className="topnav__breadcrumb topnav__breadcrumb--active topnav__breadcrumb--primary">
                  Main Thread
                </span>
              )
            ) : null}
          </>
        )}
      </div>
    </header>
  );
}
