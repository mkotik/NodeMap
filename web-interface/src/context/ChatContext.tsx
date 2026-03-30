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
} from "@/lib/tree";
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/context/AuthContext";
import { useAutoName } from "@/context/useAutoName";
import { useAutoSave } from "@/context/useAutoSave";
import { useBranchOps } from "@/context/useBranchOps";

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

  // Persistence
  conversationId: string | null;
  loadConversation: (id: string) => Promise<void>;

  // For legacy compat
  setMessages: (messages: UIMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { messages, sendMessage, status, setMessages } = useChat();
  const [tree, setTree] = useState<ConversationTree>(createEmptyTree);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Untitled");
  const { user } = useAuth();

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

  // --- Auto-naming (branches + conversation title) ---
  const { namingBranches, namedBranchesRef, conversationNamedRef } = useAutoName({
    tree,
    treeRef,
    setTree,
    setConversationTitle,
  });

  // --- Auto-save (debounced persistence to DB) ---
  useAutoSave({
    tree,
    treeRef,
    user,
    conversationTitle,
    conversationId,
    setConversationId,
  });

  // --- Branch operations (create, switch, return, cleanup) ---
  const { createBranch, switchBranch, returnToMain, cleanupEmptyActiveBranch } =
    useBranchOps({
      treeRef,
      statusRef,
      setTree,
      switchChatToBranch,
    });

  // -------------------------------------------------------------------
  // Reset everything (New Chat)
  // -------------------------------------------------------------------
  const handleResetAll = useCallback(() => {
    setConversationId(null);
    setConversationTitle("Untitled");
    conversationNamedRef.current = false;
    namedBranchesRef.current = new Set();
    setTree(createEmptyTree());
    isSwitchingRef.current = true;
    setMessages([]);
    setTimeout(() => {
      isSwitchingRef.current = false;
    }, 0);
  }, [setMessages, conversationNamedRef, namedBranchesRef]);

  // -------------------------------------------------------------------
  // Load a conversation from the DB
  // -------------------------------------------------------------------
  const loadConversation = useCallback(
    async (id: string) => {
      const data = await trpc.conversation.get.query({ id });
      if (!data) return;

      setConversationTitle(data.title || "Untitled");
      conversationNamedRef.current = true;

      const newTree: ConversationTree = {
        nodes: {},
        branches: {},
        mainBranchId: "",
        activeBranchId: "",
      };

      // Rebuild branches
      for (const b of data.branches) {
        newTree.branches[b.id] = {
          id: b.id,
          label: b.label,
          forkPointId: b.forkPointId,
          parentBranchId: b.parentBranchId,
          nodeIds: b.messages.map((m) => m.id),
          color: b.color as "primary" | "secondary" | "tertiary",
        };
        if (b.isMain) {
          newTree.mainBranchId = b.id;
          newTree.activeBranchId = b.id;
        }
      }

      // Rebuild nodes
      for (const b of data.branches) {
        for (const m of b.messages) {
          newTree.nodes[m.id] = {
            message: {
              id: m.id,
              role: m.role as "user" | "assistant",
              parts: [{ type: "text" as const, text: m.content }],
            } as UIMessage,
            parentId: m.parentMessageId,
            branchId: b.id,
            childIds: [],
          };
        }
      }

      // Rebuild childIds
      for (const node of Object.values(newTree.nodes)) {
        if (node.parentId && newTree.nodes[node.parentId]) {
          newTree.nodes[node.parentId].childIds.push(
            node.message.id,
          );
        }
      }

      setConversationId(id);
      setTree(newTree);

      // Set chat messages to main branch
      const chain = getBranchMessageChain(newTree, newTree.mainBranchId);
      isSwitchingRef.current = true;
      setMessages(chain);
      setTimeout(() => {
        isSwitchingRef.current = false;
      }, 0);
    },
    [setMessages, conversationNamedRef],
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        status,
        sendMessage,
        tree,
        activeBranch,
        isMainBranch,
        createBranch,
        switchBranch,
        returnToMain,
        resetAll: handleResetAll,
        cleanupEmptyActiveBranch,
        namingBranches,
        conversationId,
        loadConversation,
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
