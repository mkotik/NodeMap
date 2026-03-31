"use client";

import { Suspense, useEffect } from "react";
import { useSearchParams, useRouter } from "next/navigation";
import { useChatContext } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import ChatView from "./_components/ChatView/ChatView";

export default function Home() {
  return (
    <Suspense>
      <HomeContent />
    </Suspense>
  );
}

function HomeContent() {
  const {
    messages,
    sendMessage,
    status,
    activeBranch,
    createBranch,
    selectedModel,
    setSelectedModel,
    loadConversation,
  } = useChatContext();
  const { isLoading: authLoading } = useAuth();
  const searchParams = useSearchParams();
  const router = useRouter();
  const convId = searchParams.get("c");
  const hasMessages = messages.length > 0;

  // Recover conversation if state was lost during production navigation
  useEffect(() => {
    if (!convId) return;
    if (hasMessages) {
      // Conversation already loaded (e.g. navigated from history); just clean the URL
      window.history.replaceState(null, "", "/");
      return;
    }
    if (authLoading) return;
    loadConversation(convId)
      .then(() => {
        window.history.replaceState(null, "", "/");
      })
      .catch(() => {
        window.history.replaceState(null, "", "/");
      });
  }, [hasMessages, authLoading, convId, loadConversation]);

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
