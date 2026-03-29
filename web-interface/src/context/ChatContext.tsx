"use client";

import { createContext, useContext, type ReactNode } from "react";
import { useChat } from "@ai-sdk/react";
import type { UIMessage, ChatStatus } from "ai";

interface ChatContextValue {
  messages: UIMessage[];
  status: ChatStatus;
  sendMessage: (opts: { text: string }) => void;
  setMessages: (messages: UIMessage[]) => void;
}

const ChatContext = createContext<ChatContextValue | null>(null);

export function ChatProvider({ children }: { children: ReactNode }) {
  const { messages, sendMessage, status, setMessages } = useChat();

  return (
    <ChatContext.Provider
      value={{ messages, status, sendMessage, setMessages }}
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
