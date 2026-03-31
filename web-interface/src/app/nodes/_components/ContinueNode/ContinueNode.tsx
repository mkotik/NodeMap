"use client";

import { Handle, Position } from "@xyflow/react";
import type { BranchColor } from "@/types/branch";
import { ArrowRight } from "lucide-react";
import { Tooltip } from "@/components";
import "./ContinueNode.scss";

interface ContinueNodeData {
  label: string;
  color: BranchColor;
  onContinue: () => void;
}

export default function ContinueNode({ data }: { data: ContinueNodeData }) {
  return (
    <Tooltip text={data.label} position="bottom">
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
        <ArrowRight size={14} />
      </div>
    </Tooltip>
  );
}
