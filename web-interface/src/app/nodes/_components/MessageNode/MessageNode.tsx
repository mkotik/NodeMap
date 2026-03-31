"use client";

import { Handle, Position } from "@xyflow/react";
import type { BranchColor } from "@/types/branch";
import Markdown from "react-markdown";
import { Tooltip } from "@/components";
import { GitBranch } from "lucide-react";
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
        <Tooltip text="Create branch from here" position="top">
          <button
            className="msg-node__branch-btn"
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              data.onCreateBranch();
            }}
          >
            <GitBranch size={12} />
          </button>
        </Tooltip>
      </div>

      <div className="msg-node__content">
        <Markdown>
          {data.content.length > 180
            ? data.content.slice(0, 180) + "..."
            : data.content}
        </Markdown>
      </div>

      {data.forkBranches.length > 0 && (
        <div className="msg-node__forks">
          {data.forkBranches.map((branch) => (
            <Tooltip key={branch.id} text={`Switch to ${branch.label}`} position="bottom">
              <button
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
            </Tooltip>
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
