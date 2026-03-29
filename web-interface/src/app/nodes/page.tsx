"use client";

import { useRouter } from "next/navigation";
import { useChatContext } from "@/context/ChatContext";
import NodeCanvas from "./_components/NodeCanvas/NodeCanvas";

export default function NodesPage() {
  const { tree, createBranch, switchBranch } = useChatContext();
  const router = useRouter();

  function handleCreateBranch(nodeId: string) {
    createBranch(nodeId);
    router.push("/");
  }

  function handleSwitchBranch(branchId: string) {
    switchBranch(branchId);
    router.push("/");
  }

  return (
    <NodeCanvas
      tree={tree}
      onCreateBranch={handleCreateBranch}
      onSwitchBranch={handleSwitchBranch}
    />
  );
}
