"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  useRef,
  useCallback,
  type ReactNode,
} from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, ChatStatus } from "ai";
import type {
  ConversationTree,
  Branch,
  BranchId,
  NodeId,
} from "@/types/branch";
import {
  createEmptyTree,
  addNodeToBranch,
  getBranchMessageChain,
  getAncestorChain,
  createBranch as treeFnCreateBranch,
  deleteBranch,
  renameBranch,
} from "@/lib/tree";

interface ChatContextValue {
  // Active branch chat
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: (opts: { text: string }) => void;

  // Tree state
  tree: ConversationTree;
  activeBranch: Branch;
  isMainBranch: boolean;

  // Branch operations
  createBranch: (forkFromNodeId: NodeId) => void;
  switchBranch: (branchId: BranchId) => void;
  returnToMain: () => void;
  resetAll: () => void;
  cleanupEmptyActiveBranch: () => void;
  namingBranches: Set<BranchId>;

  // For legacy compat
  setMessages: (messages: UIMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { messages, sendMessage, status, setMessages } = useChat();
  const [tree, setTree] = useState<ConversationTree>(createEmptyTree);

  const isSwitchingRef = useRef(false);

  // Update refs synchronously during render so callbacks always read
  // the latest values — no lag from a deferred useEffect.
  const treeRef = useRef(tree);
  treeRef.current = tree;

  const statusRef = useRef(status);
  statusRef.current = status;

  const activeBranch = tree.branches[tree.activeBranchId];
  const isMainBranch = tree.activeBranchId === tree.mainBranchId;

  // Helper: switch useChat messages to a branch and guard the sync effect
  const switchChatToBranch = useCallback(
    (nextTree: ConversationTree, branchId: BranchId) => {
      const chain = getBranchMessageChain(nextTree, branchId);
      isSwitchingRef.current = true;
      setMessages(chain);
      setTimeout(() => {
        isSwitchingRef.current = false;
      }, 0);
    },
    [setMessages],
  );

  // -------------------------------------------------------------------
  // Sync: any time useChat messages change, add missing ones to the tree.
  // This is a valid sync from an external system (useChat), so we suppress
  // the set-state-in-effect lint rule here.
  // -------------------------------------------------------------------
  useEffect(() => {
    if (isSwitchingRef.current) return;

    let hasNew = false;
    // eslint-disable-next-line react-hooks/set-state-in-effect -- valid sync from useChat (external system)
    setTree((prev) => {
      const next = structuredClone(prev);
      for (const msg of messages) {
        if (!next.nodes[msg.id]) {
          addNodeToBranch(next, msg, next.activeBranchId);
          hasNew = true;
        }
      }
      return hasNew ? next : prev;
    });
  }, [messages]);

  // -------------------------------------------------------------------
  // Auto-name: when the first user message lands on a non-main branch,
  // call the LLM to generate a short label.
  // -------------------------------------------------------------------
  const namedBranchesRef = useRef(new Set<BranchId>());
  const [namingBranches, setNamingBranches] = useState<Set<BranchId>>(
    () => new Set(),
  );

  useEffect(() => {
    const currentTree = treeRef.current;
    const branch = currentTree.branches[currentTree.activeBranchId];
    if (
      !branch ||
      currentTree.activeBranchId === currentTree.mainBranchId ||
      branch.nodeIds.length === 0 ||
      namedBranchesRef.current.has(branch.id)
    ) {
      return;
    }

    // Find the first user message in this branch
    const firstUserNode = branch.nodeIds
      .map((id) => currentTree.nodes[id])
      .find((n) => n?.message.role === "user");
    if (!firstUserNode) return;

    const branchId = branch.id;
    namedBranchesRef.current.add(branchId);

    // Mark as loading
    setNamingBranches((prev) => new Set(prev).add(branchId));

    const extractText = (msg: { parts: Array<{ type: string; text?: string }> }) =>
      msg.parts
        .filter((p): p is { type: "text"; text: string } => p.type === "text")
        .map((p) => p.text)
        .join("");

    const userText = extractText(firstUserNode.message);

    // Grab the last few ancestor messages for context
    const priorMessages: Array<{ role: string; text: string }> = [];
    if (branch.forkPointId) {
      const ancestors = getAncestorChain(currentTree, branch.forkPointId);
      for (const msg of ancestors.slice(-4)) {
        const text = extractText(msg);
        if (text) priorMessages.push({ role: msg.role, text: text.slice(0, 200) });
      }
    }

    fetch("/api/branch-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userText, priorMessages }),
    })
      .then((res) => res.json())
      .then(({ name }: { name: string }) => {
        if (!name) return;
        // eslint-disable-next-line react-hooks/set-state-in-effect -- async callback from fetch
        setTree((prev) => {
          if (!prev.branches[branchId]) return prev;
          const next = structuredClone(prev);
          renameBranch(next, branchId, name);
          return next;
        });
      })
      .catch(() => {
        /* keep default label on failure */
      })
      .finally(() => {
        setNamingBranches((prev) => {
          const next = new Set(prev);
          next.delete(branchId);
          return next;
        });
      });
  }, [tree]);

  // -------------------------------------------------------------------
  // Auto-delete the active branch if it has no messages and isn't main.
  // Used when navigating away from the chat view of an empty branch.
  // -------------------------------------------------------------------
  const cleanupEmptyActiveBranch = useCallback(() => {
    const current = treeRef.current;
    const branch = current.branches[current.activeBranchId];
    if (
      !branch ||
      current.activeBranchId === current.mainBranchId ||
      branch.nodeIds.length > 0
    ) {
      return;
    }

    const next = structuredClone(current);
    deleteBranch(next, next.activeBranchId);
    next.activeBranchId = next.mainBranchId;
    setTree(next);
    switchChatToBranch(next, next.mainBranchId);
  }, [switchChatToBranch]);

  // -------------------------------------------------------------------
  // Create a branch from a specific node
  // -------------------------------------------------------------------
  const handleCreateBranch = useCallback(
    (forkFromNodeId: NodeId) => {
      if (statusRef.current === "streaming" || statusRef.current === "submitted") return;

      const prev = treeRef.current;
      const next = structuredClone(prev);

      // Auto-delete the branch we're leaving if it's empty
      const leaving = next.branches[next.activeBranchId];
      if (leaving && next.activeBranchId !== next.mainBranchId && leaving.nodeIds.length === 0) {
        deleteBranch(next, next.activeBranchId);
      }

      const { branchId } = treeFnCreateBranch(next, forkFromNodeId);
      if (!branchId) return;

      next.activeBranchId = branchId;
      setTree(next);
      switchChatToBranch(next, branchId);
    },
    [switchChatToBranch],
  );

  // -------------------------------------------------------------------
  // Switch to an existing branch
  // -------------------------------------------------------------------
  const handleSwitchBranch = useCallback(
    (branchId: BranchId) => {
      if (statusRef.current === "streaming" || statusRef.current === "submitted") return;

      const prev = treeRef.current;
      if (!prev.branches[branchId]) return;

      const next = structuredClone(prev);

      // Auto-delete the branch we're leaving if it's empty
      const leaving = next.branches[next.activeBranchId];
      if (leaving && next.activeBranchId !== next.mainBranchId && leaving.nodeIds.length === 0) {
        deleteBranch(next, next.activeBranchId);
      }

      next.activeBranchId = branchId;
      setTree(next);
      switchChatToBranch(next, branchId);
    },
    [switchChatToBranch],
  );

  // -------------------------------------------------------------------
  // Return to main thread (self-contained — no indirection)
  // -------------------------------------------------------------------
  const handleReturnToMain = useCallback(() => {
    if (statusRef.current === "streaming" || statusRef.current === "submitted") return;

    const current = treeRef.current;
    if (current.activeBranchId === current.mainBranchId) return;

    const next = structuredClone(current);

    // Auto-delete the branch we're leaving if it's empty
    const leaving = next.branches[next.activeBranchId];
    if (leaving && leaving.nodeIds.length === 0) {
      deleteBranch(next, next.activeBranchId);
    }

    next.activeBranchId = next.mainBranchId;
    setTree(next);
    switchChatToBranch(next, next.mainBranchId);
  }, [switchChatToBranch]);

  // -------------------------------------------------------------------
  // Reset everything (New Chat)
  // -------------------------------------------------------------------
  const handleResetAll = useCallback(() => {
    setTree(createEmptyTree());
    isSwitchingRef.current = true;
    setMessages([]);
    setTimeout(() => {
      isSwitchingRef.current = false;
    }, 0);
  }, [setMessages]);

  return (
    <ChatContext.Provider
      value={{
        messages,
        status,
        sendMessage,
        tree,
        activeBranch,
        isMainBranch,
        createBranch: handleCreateBranch,
        switchBranch: handleSwitchBranch,
        returnToMain: handleReturnToMain,
        resetAll: handleResetAll,
        cleanupEmptyActiveBranch,
        namingBranches,
        setMessages,
      }}
    >
      {children}
    </ChatContext.Provider>
  );
}

export function useChatContext() {
  const ctx = useContext(ChatContext);
  if (!ctx)
    throw new Error("useChatContext must be used within a ChatProvider");
  return ctx;
}
