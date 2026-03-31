"use client";

import { useChatContext } from "@/context/ChatContext";
import ChatView from "./_components/ChatView/ChatView";

export default function Home() {
  const {
    messages,
    sendMessage,
    status,
    activeBranch,
    createBranch,
    selectedModel,
    setSelectedModel,
  } = useChatContext();

  function handleSend(text: string) {
    sendMessage({ text });
  }

  return (
    <ChatView
      messages={messages}
      status={status}
      onSend={handleSend}
      activeBranch={activeBranch}
      onCreateBranch={createBranch}
      selectedModel={selectedModel}
      onModelChange={setSelectedModel}
    />
  );
}
