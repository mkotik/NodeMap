"use client";

import { useEffect, useRef, useCallback, type MutableRefObject } from "react";
import type { ConversationTree } from "@/types/branch";
import type { ChatStatus } from "ai";
import { getMessageText, getMessageAttachments, type Attachment } from "@/lib/messages";
import { trpc } from "@/lib/trpc";
import type { User } from "@/context/AuthContext";

interface UseAutoSaveArgs {
  tree: ConversationTree;
  treeRef: MutableRefObject<ConversationTree>;
  user: User | null;
  conversationTitle: string;
  conversationId: string | null;
  setConversationId: (id: string) => void;
  onSaveComplete?: () => void;
  skipNextSaveRef: MutableRefObject<boolean>;
  sessionRef: MutableRefObject<number>;
  disabled?: boolean;
  status: ChatStatus;
}

export interface UseAutoSaveReturn {
  pendingSaveRef: MutableRefObject<Promise<string | null> | null>;
  saveNow: () => void;
}

export function useAutoSave({
  tree,
  treeRef,
  user,
  conversationTitle,
  conversationId,
  setConversationId,
  onSaveComplete,
  skipNextSaveRef,
  sessionRef,
  disabled,
  status,
}: UseAutoSaveArgs): UseAutoSaveReturn {
  const onSaveCompleteRef = useRef(onSaveComplete);
  useEffect(() => {
    onSaveCompleteRef.current = onSaveComplete;
  });
  const saveTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const convIdRef = useRef(conversationId);
  useEffect(() => {
    convIdRef.current = conversationId;
  }, [conversationId]);
  const savingRef = useRef(false);
  const pendingSaveRef = useRef<Promise<string | null> | null>(null);

  const saveNow = useCallback(() => {
    if (savingRef.current) return;
    const t = treeRef.current;
    const session = sessionRef.current;

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
      attachments?: Attachment[];
      orderIndex: number;
    }> = [];

    for (const branch of Object.values(t.branches)) {
      branch.nodeIds.forEach((nodeId, idx) => {
        const node = t.nodes[nodeId];
        if (!node) return;
        const attachments = getMessageAttachments(node.message);
        msgs.push({
          id: node.message.id,
          branchId: branch.id,
          parentMessageId: node.parentId,
          role: node.message.role,
          content: getMessageText(node.message),
          ...(attachments.length > 0 ? { attachments } : {}),
          orderIndex: idx,
        });
      });
    }

    savingRef.current = true;
    const savePromise = trpc.conversation.save
      .mutate({
        id: convIdRef.current ?? undefined,
        title: conversationTitle,
        mainBranchId: t.mainBranchId,
        branches,
        messages: msgs,
      })
      .then(({ id }) => {
        // Only update state if still in the same session
        if (sessionRef.current === session) {
          if (!convIdRef.current) setConversationId(id);
          onSaveCompleteRef.current?.();
        }
        return id;
      })
      .catch((err) => {
        console.error(err);
        return null;
      })
      .finally(() => {
        savingRef.current = false;
      });

    pendingSaveRef.current = savePromise;
  }, [treeRef, conversationTitle, setConversationId, sessionRef]);

  // Fingerprint: only save when actual content changes (not just activeBranchId)
  function treeFingerprint(t: ConversationTree): string {
    const nodeCount = Object.keys(t.nodes).length;
    // Only include branches with messages — creating an empty branch
    // (before the user sends a message) should not trigger a save.
    const branchSig = Object.values(t.branches)
      .filter((b) => b.nodeIds.length > 0)
      .map((b) => `${b.id}:${b.nodeIds.length}:${b.label}`)
      .sort()
      .join("|");
    return `${nodeCount}::${branchSig}`;
  }

  const lastFingerprintRef = useRef("");
  const prevStatusRef = useRef(status);

  // Save on tree changes (user messages, branch label changes, etc.)
  // but NOT mid-stream — the assistant message content is incomplete.
  useEffect(() => {
    if (!user || disabled) return;
    const hasMessages = Object.keys(tree.nodes).length > 0;
    if (!hasMessages) return;

    // Skip save when tree was just loaded from DB (not user-modified)
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      lastFingerprintRef.current = treeFingerprint(tree);
      return;
    }

    const isStreaming = status === "streaming" || status === "submitted";

    // Skip mid-stream — content is still changing
    if (isStreaming) return;

    // Skip if nothing meaningful changed (e.g. only activeBranchId switched)
    const fp = treeFingerprint(tree);
    if (fp === lastFingerprintRef.current && convIdRef.current) return;
    lastFingerprintRef.current = fp;

    // Debounce saves (2s) to allow error states like apiKeyMissing to settle
    if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    saveTimerRef.current = setTimeout(saveNow, 2000);

    return () => {
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
    };
  }, [tree, user, conversationTitle, saveNow, skipNextSaveRef, disabled, status]);

  // Save immediately when streaming finishes — the assistant response is
  // now complete and the tree nodes have been updated with final content.
  useEffect(() => {
    const wasStreaming =
      prevStatusRef.current === "streaming" ||
      prevStatusRef.current === "submitted";
    prevStatusRef.current = status;

    if (wasStreaming && status === "ready" && user && !disabled) {
      const hasMessages = Object.keys(tree.nodes).length > 0;
      if (!hasMessages) return;
      // Short delay to let the tree sync effect update node content first
      if (saveTimerRef.current) clearTimeout(saveTimerRef.current);
      saveTimerRef.current = setTimeout(() => {
        lastFingerprintRef.current = treeFingerprint(treeRef.current);
        saveNow();
      }, 500);
    }
  }, [status, user, disabled, tree, treeRef, saveNow]);

  return { pendingSaveRef, saveNow };
}
