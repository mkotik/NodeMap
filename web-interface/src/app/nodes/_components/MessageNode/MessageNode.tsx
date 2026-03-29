"use client";

import { Handle, Position } from "@xyflow/react";
import type { BranchColor } from "@/types/branch";
import "./MessageNode.scss";

interface ForkBranch {
  id: string;
  label: string;
  color: BranchColor;
}

interface MessageNodeData {
  role: "user" | "assistant";
  label: string;
  content: string;
  isFirst: boolean;
  isLast: boolean;
  branchColor: BranchColor;
  isActiveBranch: boolean;
  hasBranches: boolean;
  onCreateBranch: () => void;
  onSwitchBranch: (branchId: string) => void;
  forkBranches: ForkBranch[];
}

export default function MessageNode({ data }: { data: MessageNodeData }) {
  const isAi = data.role === "assistant";

  return (
    <div
      className={`msg-node msg-node--${isAi ? "ai" : "user"} ${data.isActiveBranch ? "msg-node--active" : ""}`}
    >
      {!data.isFirst && (
        <Handle
          type="target"
          position={Position.Top}
          isConnectable={false}
          className="msg-node__handle"
        />
      )}

      <div className="msg-node__header">
        <div className={`msg-node__dot msg-node__dot--${data.branchColor}`} />
        <span
          className={`msg-node__label msg-node__label--${isAi ? "ai" : "user"}`}
        >
          {data.label}
        </span>
        <button
          className="msg-node__branch-btn"
          type="button"
          onClick={(e) => {
            e.stopPropagation();
            data.onCreateBranch();
          }}
          title="Create branch from here"
        >
          <svg
            width="12"
            height="12"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <line x1="6" y1="3" x2="6" y2="15" />
            <circle cx="18" cy="6" r="3" />
            <circle cx="6" cy="18" r="3" />
            <path d="M18 9a9 9 0 0 1-9 9" />
          </svg>
        </button>
      </div>

      <div className="msg-node__content">
        <p>
          {data.content.length > 180
            ? data.content.slice(0, 180) + "..."
            : data.content}
        </p>
      </div>

      {data.forkBranches.length > 0 && (
        <div className="msg-node__forks">
          {data.forkBranches.map((branch) => (
            <button
              key={branch.id}
              className={`msg-node__fork-chip msg-node__fork-chip--${branch.color}`}
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                data.onSwitchBranch(branch.id);
              }}
            >
              <span
                className={`msg-node__fork-dot msg-node__fork-dot--${branch.color}`}
              />
              {branch.label}
            </button>
          ))}
        </div>
      )}

      <Handle
        type="source"
        position={Position.Bottom}
        isConnectable={false}
        className="msg-node__handle"
      />
    </div>
  );
}
