"use client";

import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import type { ConversationTree } from "@/types/branch";
import { getMessageText } from "@/lib/messages";
import { trpc } from "@/lib/trpc";
import type { User } from "@/context/AuthContext";

interface UseAutoSaveArgs {
  tree: ConversationTree;
  treeRef: MutableRefObject<ConversationTree>;
  user: User | null;
  conversationTitle: string;
  conversationId: string | null;
  setConversationId: (id: string) => void;
}

export function useAutoSave({
  tree,
  treeRef,
  user,
  conversationTitle,
  conversationId,
  setConversationId,
}: UseAutoSaveArgs): void {
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convIdRef = useRef(conversationId);
  useEffect(() => {
    convIdRef.current = conversationId;
  }, [conversationId]);
  const savingRef = useRef(false);

  const saveNow = useCallback(() => {
    if (savingRef.current) return;
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
          content: getMessageText(node.message),
          orderIndex: idx,
        });
      });
    }

    savingRef.current = true;
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
      .catch(console.error)
      .finally(() => {
        savingRef.current = false;
      });
  }, [treeRef, conversationTitle, setConversationId]);

  useEffect(() => {
    if (!user) return;
    const hasMessages = Object.keys(tree.nodes).length > 0;
    if (!hasMessages) return;

    // First save (no conversation yet): save immediately
    if (!convIdRef.current) {
      saveNow();
      return;
    }

    // Subsequent saves: debounce 2s
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveNow, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tree, user, conversationTitle, saveNow]);
}
