"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useChatContext } from "@/context/ChatContext";
import NodeCanvas from "./_components/NodeCanvas/NodeCanvas";

export default function NodesPage() {
  const { tree, createBranch, switchBranch } = useChatContext();
  const router = useRouter();
  const hasNodes = Object.keys(tree.nodes).length > 0;

  useEffect(() => {
    if (!hasNodes) router.replace("/");
  }, [hasNodes, router]);

  function handleCreateBranch(nodeId: string) {
    createBranch(nodeId);
    router.push("/");
  }

  function handleSwitchBranch(branchId: string) {
    switchBranch(branchId);
    router.push("/");
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
