"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useChatContext } from "@/context/ChatContext";
import NodeCanvas from "./_components/NodeCanvas/NodeCanvas";

export default function NodesPage() {
  const { tree, createBranch, switchBranch } = useChatContext();
  const router = useRouter();
  const hasNodes = Object.keys(tree.nodes).length > 0;
  const everHadNodes = useRef(hasNodes);
  if (hasNodes) everHadNodes.current = true;

  useEffect(() => {
    // Only redirect if we never had nodes (direct navigation to /nodes
    // without a loaded conversation). Skip if nodes existed but tree was
    // temporarily empty during a page transition.
    if (!hasNodes && !everHadNodes.current) router.replace("/");
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
