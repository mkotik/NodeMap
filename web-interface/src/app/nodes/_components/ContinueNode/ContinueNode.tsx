"use client";

import { Handle, Position } from "@xyflow/react";
import type { BranchColor } from "@/types/branch";
import "./ContinueNode.scss";

interface ContinueNodeData {
  label: string;
  color: BranchColor;
  onContinue: () => void;
}

export default function ContinueNode({ data }: { data: ContinueNodeData }) {
  return (
    <div
      className={`continue-node continue-node--${data.color}`}
      onClick={data.onContinue}
    >
      <Handle
        type="target"
        position={Position.Top}
        isConnectable={false}
        className="continue-node__handle"
      />
      <div className={`continue-node__dot continue-node__dot--${data.color}`} />
      <span className="continue-node__label">{data.label}</span>
      <svg
        width="14"
        height="14"
        viewBox="0 0 24 24"
        fill="none"
        stroke="currentColor"
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      >
        <path d="M5 12h14M13 5l7 7-7 7" />
      </svg>
    </div>
  );
}
