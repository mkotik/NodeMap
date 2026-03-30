"use client";

import { useEffect, useRef, useState, type MutableRefObject } from "react";
import type { ConversationTree, BranchId } from "@/types/branch";
import { getAncestorChain, renameBranch } from "@/lib/tree";
import { getMessageText } from "@/lib/messages";

interface UseAutoNameArgs {
  tree: ConversationTree;
  treeRef: MutableRefObject<ConversationTree>;
  setTree: React.Dispatch<React.SetStateAction<ConversationTree>>;
  setConversationTitle: (title: string) => void;
}

interface UseAutoNameReturn {
  namingBranches: Set<BranchId>;
  namedBranchesRef: MutableRefObject<Set<BranchId>>;
  conversationNamedRef: MutableRefObject<boolean>;
}

export function useAutoName({
  tree,
  treeRef,
  setTree,
  setConversationTitle,
}: UseAutoNameArgs): UseAutoNameReturn {
  const namedBranchesRef = useRef(new Set<BranchId>());
  const [namingBranches, setNamingBranches] = useState<Set<BranchId>>(
    () => new Set(),
  );
  const conversationNamedRef = useRef(false);

  // Auto-name non-main branches when first user message lands
  useEffect(() => {
    const currentTree = treeRef.current;
    const branch = currentTree.branches[currentTree.activeBranchId];
    if (
      !branch ||
      currentTree.activeBranchId === currentTree.mainBranchId ||
      branch.nodeIds.length === 0 ||
      namedBranchesRef.current.has(branch.id)
    ) {
      return;
    }

    const firstUserNode = branch.nodeIds
      .map((id) => currentTree.nodes[id])
      .find((n) => n?.message.role === "user");
    if (!firstUserNode) return;

    const branchId = branch.id;
    namedBranchesRef.current.add(branchId);

    setNamingBranches((prev) => new Set(prev).add(branchId));

    const userText = getMessageText(firstUserNode.message);

    const priorMessages: Array<{ role: string; text: string }> = [];
    if (branch.forkPointId) {
      const ancestors = getAncestorChain(currentTree, branch.forkPointId);
      for (const msg of ancestors.slice(-4)) {
        const text = getMessageText(msg);
        if (text)
          priorMessages.push({ role: msg.role, text: text.slice(0, 200) });
      }
    }

    fetch("/api/branch-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userText, priorMessages }),
    })
      .then((res) => res.json())
      .then(({ name }: { name: string }) => {
        if (!name) return;
        setTree((prev) => {
          if (!prev.branches[branchId]) return prev;
          const next = structuredClone(prev);
          renameBranch(next, branchId, name);
          return next;
        });
      })
      .catch(console.error)
      .finally(() => {
        setNamingBranches((prev) => {
          const next = new Set(prev);
          next.delete(branchId);
          return next;
        });
      });
  }, [tree, treeRef, setTree]);

  // Auto-name conversation when first user message lands on main branch
  useEffect(() => {
    const currentTree = treeRef.current;
    const mainBranch = currentTree.branches[currentTree.mainBranchId];
    if (
      !mainBranch ||
      mainBranch.nodeIds.length === 0 ||
      conversationNamedRef.current
    ) {
      return;
    }

    const firstUserNode = mainBranch.nodeIds
      .map((id) => currentTree.nodes[id])
      .find((n) => n?.message.role === "user");
    if (!firstUserNode) return;

    conversationNamedRef.current = true;

    const userText = getMessageText(firstUserNode.message);

    fetch("/api/branch-name", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ userMessage: userText, priorMessages: [] }),
    })
      .then((res) => res.json())
      .then(({ name }: { name: string }) => {
        if (name) setConversationTitle(name);
      })
      .catch(console.error);
  }, [tree, treeRef, setConversationTitle]);

  return { namingBranches, namedBranchesRef, conversationNamedRef };
}
