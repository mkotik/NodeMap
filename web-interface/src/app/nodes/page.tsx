"use client";

import { useChatContext } from "@/context/ChatContext";
import NodeCanvas from "./_components/NodeCanvas/NodeCanvas";

export default function NodesPage() {
  const { messages } = useChatContext();

  return <NodeCanvas messages={messages} />;
}
