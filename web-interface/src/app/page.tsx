"use client";

import { useChat } from "@ai-sdk/react";
import NewChatView from "./_components/NewChatView/NewChatView";
import ThreadView from "./_components/ThreadView/ThreadView";

export default function Home() {
  const { messages, sendMessage, status } = useChat();

  function handleSend(text: string) {
    sendMessage({ text });
  }

  if (messages.length === 0) {
    return <NewChatView onSend={handleSend} />;
  }

  return (
    <ThreadView messages={messages} status={status} onSend={handleSend} />
  );
}
