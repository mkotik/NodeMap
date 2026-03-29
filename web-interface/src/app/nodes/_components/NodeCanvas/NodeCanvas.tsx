"use client";

import { useMemo, useCallback } from "react";
import {
  ReactFlow,
  MiniMap,
  Controls,
  Background,
  BackgroundVariant,
  useNodesState,
  useEdgesState,
  type Node,
  type Edge,
  type NodeTypes,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import type { UIMessage } from "ai";
import MessageNode from "../MessageNode/MessageNode";
import "./NodeCanvas.scss";

interface NodeCanvasProps {
  messages: UIMessage[];
}

const nodeTypes: NodeTypes = {
  messageNode: MessageNode,
};

function getMessageText(msg: UIMessage): string {
  return msg.parts
    .filter((part): part is { type: "text"; text: string } => part.type === "text")
    .map((part) => part.text)
    .join("");
}

function getLabel(role: string, index: number): string {
  if (role === "assistant") return "Neural Logic";
  return index === 0 ? "User Request" : "Follow Up";
}

function buildGraph(messages: UIMessage[]): { nodes: Node[]; edges: Edge[] } {
  const nodes: Node[] = messages.map((msg, i) => ({
    id: msg.id,
    type: "messageNode",
    draggable: false,
    position: { x: 0, y: i * 280 },
    data: {
      role: msg.role,
      label: getLabel(msg.role, i),
      content: getMessageText(msg),
      isFirst: i === 0,
      isLast: i === messages.length - 1,
    },
  }));

  const edges: Edge[] = messages.slice(1).map((msg, i) => ({
    id: `e-${messages[i].id}-${msg.id}`,
    source: messages[i].id,
    target: msg.id,
    type: "smoothstep",
    animated: true,
    style: { stroke: "#69f6b8", strokeWidth: 1.5 },
  }));

  return { nodes, edges };
}

export default function NodeCanvas({ messages }: NodeCanvasProps) {
  const graph = useMemo(() => buildGraph(messages), [messages]);
  const [nodes, , onNodesChange] = useNodesState(graph.nodes);
  const [edges, , onEdgesChange] = useEdgesState(graph.edges);

  const onInit = useCallback((instance: { fitView: () => void }) => {
    setTimeout(() => instance.fitView(), 50);
  }, []);

  if (messages.length === 0) {
    return (
      <div className="node-canvas node-canvas--empty">
        <div className="node-canvas__empty-state">
          <p>No nodes yet. Start a conversation to see your thought map.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="node-canvas">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={nodeTypes}
        onInit={onInit}
        fitView
        minZoom={0.1}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background
          variant={BackgroundVariant.Dots}
          gap={24}
          size={1}
          color="#1a2548"
        />
        <Controls
          className="node-canvas__controls"
          showInteractive={false}
        />
        <MiniMap
          className="node-canvas__minimap"
          nodeColor={(node) =>
            node.data?.role === "assistant" ? "#69f6b8" : "#6d758c"
          }
          maskColor="rgba(6, 14, 32, 0.85)"
          bgColor="#091328"
          pannable
          zoomable
        />
      </ReactFlow>
    </div>
  );
}
