"use client";

import { useCallback, type MutableRefObject } from "react";
import type { ConversationTree, BranchId, NodeId } from "@/types/branch";
import {
  createBranch as treeFnCreateBranch,
  deleteBranch,
  renameBranch,
} from "@/lib/tree";

interface UseBranchOpsArgs {
  treeRef: MutableRefObject<ConversationTree>;
  statusRef: MutableRefObject<string>;
  setTree: React.Dispatch<React.SetStateAction<ConversationTree>>;
  switchChatToBranch: (tree: ConversationTree, branchId: BranchId) => void;
}

interface UseBranchOpsReturn {
  createBranch: (forkFromNodeId: NodeId) => void;
  switchBranch: (branchId: BranchId) => void;
  returnToMain: () => void;
  cleanupEmptyActiveBranch: () => void;
  deleteBranchById: (branchId: BranchId) => void;
  renameBranchById: (branchId: BranchId, label: string) => void;
}

export function useBranchOps({
  treeRef,
  statusRef,
  setTree,
  switchChatToBranch,
}: UseBranchOpsArgs): UseBranchOpsReturn {
  const cleanupEmptyActiveBranch = useCallback(() => {
    const current = treeRef.current;
    const branch = current.branches[current.activeBranchId];
    if (
      !branch ||
      current.activeBranchId === current.mainBranchId ||
      branch.nodeIds.length > 0
    ) {
      return;
    }

    const next = structuredClone(current);
    deleteBranch(next, next.activeBranchId);
    next.activeBranchId = next.mainBranchId;
    setTree(next);
    switchChatToBranch(next, next.mainBranchId);
  }, [treeRef, setTree, switchChatToBranch]);

  const createBranch = useCallback(
    (forkFromNodeId: NodeId) => {
      if (
        statusRef.current === "streaming" ||
        statusRef.current === "submitted"
      )
        return;

      const prev = treeRef.current;
      const next = structuredClone(prev);

      // Auto-delete the branch we're leaving if it's empty
      const leaving = next.branches[next.activeBranchId];
      if (
        leaving &&
        next.activeBranchId !== next.mainBranchId &&
        leaving.nodeIds.length === 0
      ) {
        deleteBranch(next, next.activeBranchId);
      }

      const { branchId } = treeFnCreateBranch(next, forkFromNodeId);
      if (!branchId) return;

      next.activeBranchId = branchId;
      setTree(next);
      switchChatToBranch(next, branchId);
    },
    [treeRef, statusRef, setTree, switchChatToBranch],
  );

  const switchBranch = useCallback(
    (branchId: BranchId) => {
      if (
        statusRef.current === "streaming" ||
        statusRef.current === "submitted"
      )
        return;

      const prev = treeRef.current;
      if (!prev.branches[branchId]) return;

      const next = structuredClone(prev);

      // Auto-delete the branch we're leaving if it's empty
      const leaving = next.branches[next.activeBranchId];
      if (
        leaving &&
        next.activeBranchId !== next.mainBranchId &&
        leaving.nodeIds.length === 0
      ) {
        deleteBranch(next, next.activeBranchId);
      }

      next.activeBranchId = branchId;
      setTree(next);
      switchChatToBranch(next, branchId);
    },
    [treeRef, statusRef, setTree, switchChatToBranch],
  );

  const returnToMain = useCallback(() => {
    if (statusRef.current === "streaming" || statusRef.current === "submitted")
      return;

    const current = treeRef.current;
    if (current.activeBranchId === current.mainBranchId) return;

    const next = structuredClone(current);

    // Auto-delete the branch we're leaving if it's empty
    const leaving = next.branches[next.activeBranchId];
    if (leaving && leaving.nodeIds.length === 0) {
      deleteBranch(next, next.activeBranchId);
    }

    next.activeBranchId = next.mainBranchId;
    setTree(next);
    switchChatToBranch(next, next.mainBranchId);
  }, [treeRef, statusRef, setTree, switchChatToBranch]);

  const deleteBranchById = useCallback(
    (branchId: BranchId) => {
      const current = treeRef.current;
      if (!current.branches[branchId] || branchId === current.mainBranchId)
        return;

      const next = structuredClone(current);
      const wasActive = next.activeBranchId === branchId;
      deleteBranch(next, branchId);

      if (wasActive) {
        next.activeBranchId = next.mainBranchId;
        setTree(next);
        switchChatToBranch(next, next.mainBranchId);
      } else {
        setTree(next);
      }
    },
    [treeRef, setTree, switchChatToBranch],
  );

  const renameBranchById = useCallback(
    (branchId: BranchId, label: string) => {
      const current = treeRef.current;
      if (!current.branches[branchId]) return;

      const next = structuredClone(current);
      renameBranch(next, branchId, label);
      setTree(next);
    },
    [treeRef, setTree],
  );

  return {
    createBranch,
    switchBranch,
    returnToMain,
    cleanupEmptyActiveBranch,
    deleteBranchById,
    renameBranchById,
  };
}
