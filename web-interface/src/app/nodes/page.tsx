"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { useChatContext } from "@/context/ChatContext";
import { useAuth } from "@/context/AuthContext";
import NodeCanvas from "./_components/NodeCanvas/NodeCanvas";

export default function NodesPage() {
  return (
    <Suspense>
      <NodesContent />
    </Suspense>
  );
}

function NodesContent() {
  const { tree, createBranch, switchBranch, loadConversation } =
    useChatContext();
  const { isLoading: authLoading } = useAuth();
  const router = useRouter();
  const searchParams = useSearchParams();
  const convId = searchParams.get("c");
  const hasNodes = Object.keys(tree.nodes).length > 0;
  const [recovering, setRecovering] = useState(false);
  // Track whether nodes existed when the component mounted. If they did
  // and later become empty (resetAll), we should NOT re-recover — the
  // user intentionally started a new chat.
  const everHadNodes = useRef(hasNodes);
  if (hasNodes) everHadNodes.current = true;

  useEffect(() => {
    if (hasNodes || authLoading) return;
    if (everHadNodes.current) {
      // Nodes were cleared intentionally (e.g. New Chat) — just navigate home
      router.replace("/");
      return;
    }
    // If we have a conversation ID in the URL, reload it (handles full
    // page reloads in production where React state is lost).
    if (convId) {
      setRecovering(true);
      loadConversation(convId)
        .catch(() => router.replace("/"))
        .finally(() => setRecovering(false));
    } else {
      router.replace("/");
    }
  }, [hasNodes, authLoading, convId, loadConversation, router]);

  function handleCreateBranch(nodeId: string) {
    createBranch(nodeId);
    router.back();
  }

  function handleSwitchBranch(branchId: string) {
    switchBranch(branchId);
    router.back();
  }

  if (!hasNodes) return null;

  return (
    <NodeCanvas
      tree={tree}
      onCreateBranch={handleCreateBranch}
      onSwitchBranch={handleSwitchBranch}
    />
  );
}
