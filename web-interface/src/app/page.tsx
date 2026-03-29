"use client";

import { useChatContext } from "@/context/ChatContext";
import ChatView from "./_components/ChatView/ChatView";

export default function Home() {
  const { messages, sendMessage, status } = useChatContext();

  function handleSend(text: string) {
    sendMessage({ text });
  }

  return (
    <ChatView messages={messages} status={status} onSend={handleSend} />
  );
}
