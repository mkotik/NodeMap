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
import { trpc } from "@/lib/trpc";
import { useAuth } from "@/context/AuthContext";

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

function extractText(msg: { parts: Array<{ type: string; text?: string }> }) {
  return msg.parts
    .filter((p): p is { type: "text"; text: string } => p.type === "text")
    .map((p) => p.text)
    .join("");
}

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
  // Auto-name conversation: when the first user message lands on the
  // main branch, call the LLM to generate a short title.
  // -------------------------------------------------------------------
  const conversationNamedRef = useRef(false);

  useEffect(() => {
    const currentTree = treeRef.current;
    const mainBranch = currentTree.branches[currentTree.mainBranchId];
    if (!mainBranch || mainBranch.nodeIds.length === 0 || conversationNamedRef.current) {
      return;
    }

    const firstUserNode = mainBranch.nodeIds
      .map((id) => currentTree.nodes[id])
      .find((n) => n?.message.role === "user");
    if (!firstUserNode) return;

    conversationNamedRef.current = true;

    const userText = extractText(firstUserNode.message);

    fetch("/api/branch-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userText, priorMessages: [] }),
    })
      .then((res) => res.json())
      .then(({ name }: { name: string }) => {
        if (name) setConversationTitle(name);
      })
      .catch(() => {});
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
  }, [setMessages]);

  // -------------------------------------------------------------------
  // Auto-save: debounce saves to the DB when the tree changes
  // -------------------------------------------------------------------
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convIdRef = useRef(conversationId);
  convIdRef.current = conversationId;

  useEffect(() => {
    if (!user) return;
    // Only save if there are actual messages in the tree
    const hasMessages = Object.keys(tree.nodes).length > 0;
    if (!hasMessages) return;

    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(() => {
      const t = treeRef.current;

      const branches = Object.values(t.branches).map((b) => ({
        id: b.id,
        parentBranchId: b.parentBranchId,
        forkPointId: b.forkPointId,
        label: b.label,
        color: b.color,
        isMain: b.id === t.mainBranchId,
      }));

      const msgs: Array<{
        id: string;
        branchId: string;
        parentMessageId: string | null;
        role: string;
        content: string;
        orderIndex: number;
      }> = [];

      for (const branch of Object.values(t.branches)) {
        branch.nodeIds.forEach((nodeId, idx) => {
          const node = t.nodes[nodeId];
          if (!node) return;
          msgs.push({
            id: node.message.id,
            branchId: branch.id,
            parentMessageId: node.parentId,
            role: node.message.role,
            content: extractText(node.message),
            orderIndex: idx,
          });
        });
      }

      trpc.conversation.save
        .mutate({
          id: convIdRef.current ?? undefined,
          title: conversationTitle,
          mainBranchId: t.mainBranchId,
          branches,
          messages: msgs,
        })
        .then(({ id }) => {
          if (!convIdRef.current) setConversationId(id);
        })
        .catch(() => {});
    }, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tree, user, conversationTitle]);

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
    [setMessages],
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
        createBranch: handleCreateBranch,
        switchBranch: handleSwitchBranch,
        returnToMain: handleReturnToMain,
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
