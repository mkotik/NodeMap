import type { UIMessage } from "ai";

export type NodeId = string;
export type BranchId = string;
export type BranchColor = "primary" | "secondary" | "tertiary";

export interface TreeNode {
  message: UIMessage;
  parentId: NodeId | null;
  branchId: BranchId;
  childIds: NodeId[];
}

export interface Branch {
  id: BranchId;
  label: string;
  forkPointId: NodeId | null;
  parentBranchId: BranchId | null;
  nodeIds: NodeId[];
  color: BranchColor;
}

export interface ConversationTree {
  nodes: Record<NodeId, TreeNode>;
  branches: Record<BranchId, Branch>;
  mainBranchId: BranchId;
  activeBranchId: BranchId;
}
