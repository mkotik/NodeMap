"use client";

import { Handle, Position } from "@xyflow/react";
import "./MessageNode.scss";

interface MessageNodeData {
  role: "user" | "assistant";
  label: string;
  content: string;
  isFirst: boolean;
  isLast: boolean;
}

export default function MessageNode({ data }: { data: MessageNodeData }) {
  const isAi = data.role === "assistant";

  return (
    <div className={`msg-node msg-node--${isAi ? "ai" : "user"}`}>
      {!data.isFirst && (
        <Handle type="target" position={Position.Top} className="msg-node__handle" />
      )}

      <div className="msg-node__header">
        <div className={`msg-node__dot msg-node__dot--${isAi ? "primary" : "muted"}`} />
        <span className={`msg-node__label msg-node__label--${isAi ? "ai" : "user"}`}>
          {data.label}
        </span>
      </div>

      <div className="msg-node__content">
        <p>{data.content.length > 180 ? data.content.slice(0, 180) + "..." : data.content}</p>
      </div>

      {!data.isLast && (
        <Handle type="source" position={Position.Bottom} className="msg-node__handle" />
      )}
    </div>
  );
}
