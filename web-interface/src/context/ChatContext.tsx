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
  createBranch as treeFnCreateBranch,
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

  // For legacy compat
  setMessages: (messages: UIMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { messages, sendMessage, status, setMessages } = useChat();
  const [tree, setTree] = useState<ConversationTree>(createEmptyTree);

  const isSwitchingRef = useRef(false);
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

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
  // Create a branch from a specific node
  // -------------------------------------------------------------------
  const handleCreateBranch = useCallback(
    (forkFromNodeId: NodeId) => {
      if (status === "streaming" || status === "submitted") return;

      const prev = treeRef.current;
      const next = structuredClone(prev);
      const { branchId } = treeFnCreateBranch(next, forkFromNodeId);
      if (!branchId) return;

      next.activeBranchId = branchId;
      setTree(next);
      switchChatToBranch(next, branchId);
    },
    [status, switchChatToBranch],
  );

  // -------------------------------------------------------------------
  // Switch to an existing branch
  // -------------------------------------------------------------------
  const handleSwitchBranch = useCallback(
    (branchId: BranchId) => {
      if (status === "streaming" || status === "submitted") return;

      const prev = treeRef.current;
      if (!prev.branches[branchId]) return;

      const next = structuredClone(prev);
      next.activeBranchId = branchId;
      setTree(next);
      switchChatToBranch(next, branchId);
    },
    [status, switchChatToBranch],
  );

  // -------------------------------------------------------------------
  // Return to main thread
  // -------------------------------------------------------------------
  const handleReturnToMain = useCallback(() => {
    handleSwitchBranch(treeRef.current.mainBranchId);
  }, [handleSwitchBranch]);

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
