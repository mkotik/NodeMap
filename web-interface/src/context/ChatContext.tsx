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
import { DefaultChatTransport, type UIMessage, type ChatStatus } from "ai";
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
import { getMessageText } from "@/lib/messages";
import { getAccessToken } from "@/lib/auth-token";
import { DEFAULT_MODEL_ID } from "@/lib/models";
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
  deleteBranchById: (branchId: BranchId) => void;
  renameBranchById: (branchId: BranchId, label: string) => void;
  namingBranches: Set<BranchId>;

  // Model selection
  selectedModel: string;
  setSelectedModel: (model: string) => void;

  // Persistence
  conversationId: string | null;
  conversationTitle: string;
  setConversationTitle: (title: string) => void;
  namingConversation: boolean;
  completingChatIds: Set<string>;
  recoverChat: (id: string) => void;
  loadConversation: (id: string) => Promise<void>;
  recentChats: Array<{ id: string; title: string }>;
  recentsLoaded: boolean;
  refreshRecents: () => void;

  // For legacy compat
  setMessages: (messages: UIMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { user } = useAuth();
  const userRef = useRef(user);
  useEffect(() => {
    userRef.current = user;
  }, [user]);

  const [selectedModel, setSelectedModel] = useState(DEFAULT_MODEL_ID);
  const selectedModelRef = useRef(selectedModel);
  useEffect(() => {
    selectedModelRef.current = selectedModel;
  }, [selectedModel]);

  const [apiKeyMissing, setApiKeyMissing] = useState(false);
  const { messages, sendMessage, status, setMessages, stop } = useChat({
    transport: new DefaultChatTransport({
      api: "/api/chat",
      headers: (): Record<string, string> => {
        const token = getAccessToken();
        return token ? { Authorization: `Bearer ${token}` } : {};
      },
      body: () => ({ model: selectedModelRef.current }),
    }),
    onError: (err) => {
      if (err.message?.includes("EMAIL_NOT_VERIFIED")) {
        setApiKeyMissing(true);
        setMessages((prev) => [
          ...prev,
          {
            id: `verify-error-${Date.now()}`,
            role: "assistant",
            parts: [
              {
                type: "text",
                text: "Please verify your email address before chatting. Check your inbox for a verification link, or use the banner at the top of the page to resend it.",
              },
            ],
            createdAt: new Date(),
          } as UIMessage,
        ]);
      } else if (err.message?.includes("NO_API_KEY")) {
        setApiKeyMissing(true);
        const text = userRef.current
          ? "You haven't added an API key yet. Go to [Settings](/settings) to add your OpenRouter API key, then try again."
          : "You need to sign in before you can chat. Go to [Sign In](/auth/login) to get started.";
        setMessages((prev) => [
          ...prev,
          {
            id: `api-key-error-${Date.now()}`,
            role: "assistant",
            parts: [{ type: "text", text }],
            createdAt: new Date(),
          } as UIMessage,
        ]);
      } else {
        // Surface any other provider error (credit limits, rate limits, etc.)
        let text = "Something went wrong. Please try again.";
        try {
          const parsed = JSON.parse(err.message || "");
          if (parsed.errorText) text = parsed.errorText;
          else if (parsed.error?.message) text = parsed.error.message;
        } catch {
          if (err.message) text = err.message;
        }
        setMessages((prev) => [
          ...prev,
          {
            id: `error-${Date.now()}`,
            role: "assistant",
            parts: [{ type: "text", text }],
            createdAt: new Date(),
          } as UIMessage,
        ]);
      }
    },
  });
  const [tree, setTree] = useState<ConversationTree>(createEmptyTree);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [conversationTitle, setConversationTitle] = useState("Untitled");

  const isSwitchingRef = useRef(false);
  const sessionRef = useRef(0);
  const [completingChatIds, setCompletingChatIds] = useState<Set<string>>(
    () => new Set(),
  );

  // Keep refs in sync so callbacks always read the latest values.
  const treeRef = useRef(tree);
  useEffect(() => {
    treeRef.current = tree;
  }, [tree]);

  const statusRef = useRef(status);
  useEffect(() => {
    statusRef.current = status;
  }, [status]);

  const conversationIdRef = useRef(conversationId);
  useEffect(() => {
    conversationIdRef.current = conversationId;
  }, [conversationId]);

  const conversationTitleRef = useRef(conversationTitle);
  useEffect(() => {
    conversationTitleRef.current = conversationTitle;
  }, [conversationTitle]);

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
  const {
    namingBranches,
    namedBranchesRef,
    conversationNamedRef,
    namingConversation,
  } = useAutoName({
    tree,
    treeRef,
    setTree,
    setConversationTitle,
  });

  // --- Recent chats: lightweight list for the sidebar ---
  const [recentChats, setRecentChats] = useState<
    Array<{ id: string; title: string }>
  >([]);
  const [recentsLoaded, setRecentsLoaded] = useState(false);

  const refreshRecents = useCallback(() => {
    if (!user) return;
    trpc.conversation.list
      .query({ limit: 5 })
      .then((data) => {
        setRecentChats(data.items.map((c) => ({ id: c.id, title: c.title })));
        setRecentsLoaded(true);
      })
      .catch(() => {
        setRecentsLoaded(true);
      });
  }, [user]);

  useEffect(() => {
    refreshRecents();
  }, [refreshRecents]);

  // Refresh recents when a background completion finishes
  useEffect(() => {
    const handler = () => {
      setCompletingChatIds(new Set());
      refreshRecents();
    };
    window.addEventListener("chat-completed", handler);
    return () => window.removeEventListener("chat-completed", handler);
  }, [refreshRecents]);

  // --- Recover incomplete chats (missing LLM response / untitled) ---
  const recoveringRef = useRef(new Set<string>());
  const recoverFailedRef = useRef(new Set<string>());

  const recoverChat = useCallback((id: string) => {
    if (recoveringRef.current.has(id) || recoverFailedRef.current.has(id))
      return;
    recoveringRef.current.add(id);
    setCompletingChatIds((prev) => new Set(prev).add(id));

    const token = getAccessToken();
    fetch("/api/chat/recover", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ conversationId: id }),
    })
      .then(async (res) => {
        if (!res.ok) {
          recoverFailedRef.current.add(id);
          return;
        }
        const data = await res.json();
        if (data.recovered) {
          window.dispatchEvent(new Event("chat-completed"));
        } else {
          recoverFailedRef.current.add(id);
        }
      })
      .catch(() => {
        recoverFailedRef.current.add(id);
      })
      .finally(() => {
        recoveringRef.current.delete(id);
        setCompletingChatIds((prev) => {
          const next = new Set(prev);
          next.delete(id);
          return next;
        });
      });
  }, []);

  // Auto-recover any "Untitled" chats that appear in recents
  useEffect(() => {
    const toRecover = recentChats.filter((c) => c.title === "Untitled");
    if (toRecover.length === 0) return;
    queueMicrotask(() => {
      for (const c of toRecover) recoverChat(c.id);
    });
  }, [recentChats, recoverChat]);

  // --- Auto-save (debounced persistence to DB) ---
  const skipNextSaveRef = useRef(false);
  const { pendingSaveRef } = useAutoSave({
    tree,
    treeRef,
    user,
    conversationTitle,
    conversationId,
    setConversationId,
    onSaveComplete: refreshRecents,
    skipNextSaveRef,
    sessionRef,
    disabled: apiKeyMissing,
  });

  // --- Branch operations (create, switch, return, cleanup) ---
  const {
    createBranch,
    switchBranch,
    returnToMain,
    cleanupEmptyActiveBranch,
    deleteBranchById,
    renameBranchById,
  } = useBranchOps({
    treeRef,
    statusRef,
    setTree,
    switchChatToBranch,
  });

  // -------------------------------------------------------------------
  // Background completion: finish LLM response + naming server-side
  // when the user navigates away during streaming.
  // -------------------------------------------------------------------
  const completeInBackground = useCallback(() => {
    const t = treeRef.current;
    const capturedConvId = conversationIdRef.current;
    const capturedTitle = conversationTitleRef.current;
    const capturedPendingSave = pendingSaveRef.current;
    const capturedModel = selectedModelRef.current;

    // Build branches payload
    const branches = Object.values(t.branches).map((b) => ({
      id: b.id,
      parentBranchId: b.parentBranchId,
      forkPointId: b.forkPointId,
      label: b.label,
      color: b.color,
      isMain: b.id === t.mainBranchId,
    }));

    // Build messages payload, excluding any partial streaming assistant message
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
          content: getMessageText(node.message),
          orderIndex: idx,
        });
      });
    }

    // Remove partial streaming assistant message from active branch
    const activeBranchObj = t.branches[t.activeBranchId];
    if (activeBranchObj) {
      const lastNodeId =
        activeBranchObj.nodeIds[activeBranchObj.nodeIds.length - 1];
      const lastNode = lastNodeId ? t.nodes[lastNodeId] : null;
      if (lastNode?.message.role === "assistant") {
        const idx = msgs.findIndex((m) => m.id === lastNode.message.id);
        if (idx !== -1) msgs.splice(idx, 1);
      }
    }

    // Build simplified chat messages for the LLM
    const chain = getBranchMessageChain(t, t.activeBranchId);
    const chatMessages = chain
      .map((m) => ({
        role: m.role as "user" | "assistant",
        content: getMessageText(m),
      }))
      .filter((m) => m.content);

    // Remove trailing partial assistant message from chatMessages
    if (
      chatMessages.length > 0 &&
      chatMessages[chatMessages.length - 1].role === "assistant"
    ) {
      chatMessages.pop();
    }

    // If no user messages, nothing to complete
    if (!chatMessages.some((m) => m.role === "user")) return;

    const fireRequest = (convId: string | null) => {
      if (convId) {
        setCompletingChatIds((prev) => new Set(prev).add(convId));
      }
      const token = getAccessToken();
      fetch("/api/chat/complete", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({
          conversationId: convId,
          title: capturedTitle,
          mainBranchId: t.mainBranchId,
          activeBranchId: t.activeBranchId,
          branches,
          messages: msgs,
          chatMessages,
          model: capturedModel,
        }),
      })
        .then((res) => {
          if (res.ok) window.dispatchEvent(new Event("chat-completed"));
        })
        .catch(console.error);
    };

    // If conversationId is already set, fire immediately
    if (capturedConvId) {
      fireRequest(capturedConvId);
      return;
    }

    // Otherwise, wait for any in-flight save to get the ID
    if (capturedPendingSave) {
      capturedPendingSave
        .then((id) => fireRequest(id))
        .catch(() => fireRequest(null));
    } else {
      fireRequest(null);
    }
  }, [pendingSaveRef]);

  // -------------------------------------------------------------------
  // Reset everything (New Chat)
  // -------------------------------------------------------------------
  const handleResetAll = useCallback(() => {
    // If streaming/submitted OR the chat has unsaved content, finish server-side.
    // The unsaved check handles the case where the AI finished but the debounced
    // auto-save hasn't fired yet — without this the chat would be lost on reset.
    const hasUnsavedContent =
      Object.keys(treeRef.current.nodes).length > 0 &&
      !conversationIdRef.current;
    if (
      statusRef.current === "streaming" ||
      statusRef.current === "submitted" ||
      hasUnsavedContent
    ) {
      completeInBackground();
    }
    stop();
    sessionRef.current++;
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
  }, [
    stop,
    setMessages,
    conversationNamedRef,
    namedBranchesRef,
    completeInBackground,
  ]);

  // -------------------------------------------------------------------
  // Load a conversation from the DB
  // -------------------------------------------------------------------
  const loadConversation = useCallback(
    async (id: string) => {
      // If streaming/submitted, finish the conversation server-side
      if (
        statusRef.current === "streaming" ||
        statusRef.current === "submitted"
      ) {
        completeInBackground();
      }
      stop();
      sessionRef.current++;

      const data = await trpc.conversation.get.query({ id });
      if (!data) return;

      setConversationTitle(data.title || "Untitled");
      conversationNamedRef.current = true;
      namedBranchesRef.current = new Set(data.branches.map((b) => b.id));

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
          newTree.nodes[node.parentId].childIds.push(node.message.id);
        }
      }

      skipNextSaveRef.current = true;
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
    [
      stop,
      setMessages,
      conversationNamedRef,
      namedBranchesRef,
      completeInBackground,
    ],
  );

  return (
    <ChatContext.Provider
      value={{
        messages,
        status,
        sendMessage,
        selectedModel,
        setSelectedModel,
        tree,
        activeBranch,
        isMainBranch,
        createBranch,
        switchBranch,
        returnToMain,
        resetAll: handleResetAll,
        cleanupEmptyActiveBranch,
        deleteBranchById,
        renameBranchById,
        namingBranches,
        conversationId,
        conversationTitle,
        setConversationTitle,
        namingConversation,
        completingChatIds,
        recoverChat,
        loadConversation,
        recentChats,
        recentsLoaded,
        refreshRecents,
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
