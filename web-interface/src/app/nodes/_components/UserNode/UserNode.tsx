"use client";

import { Handle, Position } from "@xyflow/react";
import "./UserNode.scss";

interface UserNodeData {
  content: string;
  isFirst: boolean;
}

export default function UserNode({ data }: { data: UserNodeData }) {
  return (
    <div className="user-node">
      {!data.isFirst && (
        <Handle type="target" position={Position.Top} isConnectable={false} className="user-node__handle" />
      )}
      <p className="user-node__text">
        {data.content.length > 120
          ? data.content.slice(0, 120) + "..."
          : data.content}
      </p>
      <Handle type="source" position={Position.Bottom} isConnectable={false} className="user-node__handle" />
    </div>
  );
}
