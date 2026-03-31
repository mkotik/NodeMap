"use client";

import { useState, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import Link from "next/link";
import { useChatContext } from "@/context/ChatContext";
import BeatLoader from "react-spinners/BeatLoader";
import { Tooltip } from "@/components";
import { Waypoints, ChevronRight, Menu } from "lucide-react";
import "./TopNav.scss";

export default function TopNav() {
  const pathname = usePathname();
  const router = useRouter();
  const { activeBranch, isMainBranch, returnToMain, messages, namingBranches, conversationId } =
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

  if (!mounted || hideNav || isEmpty) {
    return (
      <div className="topnav topnav--empty">
        <button
          type="button"
          className="topnav__hamburger"
          onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}
          aria-label="Open menu"
        >
          <Menu size={20} />
        </button>
      </div>
    );
  }

  return (
    <header className="topnav">
      <button
        type="button"
        className="topnav__hamburger"
        onClick={() => window.dispatchEvent(new Event("toggle-sidebar"))}
        aria-label="Open menu"
      >
        <Menu size={20} />
      </button>
      <div className="topnav__left">
        <Tooltip text="Node View" position="bottom">
          <Link
            href={conversationId ? `/nodes?c=${conversationId}` : "/nodes"}
            className="topnav__node-link"
            aria-label="Node View"
          >
            <Waypoints size={16} />
          </Link>
        </Tooltip>
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
        ) : isNodes ? (
          <button
            type="button"
            className="topnav__breadcrumb topnav__breadcrumb--primary"
            onClick={() => {
              returnToMain();
              router.back();
            }}
          >
            Main Thread
            <ChevronRight size={14} strokeWidth={2.5} />
          </button>
        ) : (
          <span className="topnav__breadcrumb topnav__breadcrumb--active topnav__breadcrumb--primary">
            Main Thread
          </span>
        )}
      </div>
      <div className="topnav__right">
        <Tooltip text="Node View" position="bottom">
          <Link
            href={conversationId ? `/nodes?c=${conversationId}` : "/nodes"}
            className="topnav__node-link"
            aria-label="Node View"
          >
            <Waypoints size={16} />
          </Link>
        </Tooltip>
      </div>
    </header>
  );
}
