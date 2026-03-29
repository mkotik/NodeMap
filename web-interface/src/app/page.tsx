"use client";

import { useState } from "react";
import NewChatView from "./_components/NewChatView/NewChatView";
import ThreadView from "./_components/ThreadView/ThreadView";

export interface Message {
  id: string;
  role: "user" | "ai";
  label: string;
  content: string;
}

export default function Home() {
  const [messages, setMessages] = useState<Message[]>([]);

  function handleSubmit(text: string) {
    const label = messages.length === 0 ? "User Request" : "Follow Up";
    const userMsg: Message = {
      id: crypto.randomUUID(),
      role: "user",
      label,
      content: text,
    };
    setMessages((prev) => [...prev, userMsg]);
  }

  if (messages.length === 0) {
    return <NewChatView onSubmit={handleSubmit} />;
  }

  return <ThreadView messages={messages} onSubmit={handleSubmit} />;
}
