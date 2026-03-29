"use client";

import { useMemo } from "react";
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
import type { ConversationTree, BranchColor } from "@/types/branch";
import { getBranchesFromNode } from "@/lib/tree";
import MessageNode from "../MessageNode/MessageNode";
import UserNode from "../UserNode/UserNode";
import ContinueNode from "../ContinueNode/ContinueNode";
import "./NodeCanvas.scss";

interface NodeCanvasProps {
  tree: ConversationTree;
  onCreateBranch: (nodeId: string) => void;
  onSwitchBranch: (branchId: string) => void;
}

const nodeTypes: NodeTypes = {
  messageNode: MessageNode,
  userNode: UserNode,
  continueNode: ContinueNode,
};

const BRANCH_COLOR_MAP: Record<BranchColor, string> = {
  primary: "#69f6b8",
  secondary: "#699cff",
  tertiary: "#ac8aff",
};

const BRANCH_COLOR_DIM_MAP: Record<BranchColor, string> = {
  primary: "#3a8a62",
  secondary: "#3a5e99",
  tertiary: "#6b5299",
};

function getMessageText(msg: {
  parts: Array<{ type: string; text?: string }>;
}): string {
  return msg.parts
    .filter(
      (part): part is { type: "text"; text: string } => part.type === "text",
    )
    .map((part) => part.text)
    .join("");
}

function getLabel(role: string, index: number): string {
  if (role === "assistant") return "Neural Logic";
  return index === 0 ? "User Request" : "Follow Up";
}

function buildGraph(
  tree: ConversationTree,
  onCreateBranch: (nodeId: string) => void,
  onSwitchBranch: (branchId: string) => void,
): { nodes: Node[]; edges: Edge[] } {
  const rfNodes: Node[] = [];
  const rfEdges: Edge[] = [];

  if (Object.keys(tree.nodes).length === 0)
    return { nodes: rfNodes, edges: rfEdges };

  // Layout: walk each branch, position nodes
  // Main branch goes straight down. Sub-branches offset to the right.
  const positioned = new Set<string>();
  const nodePositions: Record<string, { x: number; y: number }> = {};
  let globalNodeIndex = 0;

  const NODE_GAP = 60;
  const USER_NODE_HEIGHT = 50;
  const AI_NODE_BASE_HEIGHT = 120;
  const AI_CHARS_PER_LINE = 40;
  const AI_LINE_HEIGHT = 18;

  function estimateNodeHeight(nodeId: string): number {
    const treeNode = tree.nodes[nodeId];
    if (!treeNode) return AI_NODE_BASE_HEIGHT;
    if (treeNode.message.role === "user") return USER_NODE_HEIGHT;
    const text = getMessageText(treeNode.message);
    const displayText = text.length > 180 ? text.slice(0, 180) : text;
    const lines = Math.ceil(displayText.length / AI_CHARS_PER_LINE);
    let height = AI_NODE_BASE_HEIGHT + lines * AI_LINE_HEIGHT;
    // Account for fork chips row
    const forks = getBranchesFromNode(tree, nodeId);
    if (forks.length > 0) height += 40;
    return height;
  }

  function layoutBranch(branchId: string, startX: number, startY: number) {
    const branch = tree.branches[branchId];
    if (!branch) return;

    let y = startY;
    for (const nodeId of branch.nodeIds) {
      if (positioned.has(nodeId)) continue;
      positioned.add(nodeId);
      nodePositions[nodeId] = { x: startX, y };
      y += estimateNodeHeight(nodeId) + NODE_GAP;
    }

    // Layout child branches that fork from nodes in this branch
    for (const nodeId of branch.nodeIds) {
      const childBranches = getBranchesFromNode(tree, nodeId);
      let branchOffset = 1;
      for (const childBranch of childBranches) {
        if (childBranch.id === branchId) continue;
        const forkY = (nodePositions[nodeId]?.y ?? 0) + 280;
        const forkX = startX + branchOffset * 400;
        layoutBranch(childBranch.id, forkX, forkY);
        branchOffset++;
      }
    }

    // Also check the fork point for child branches (for main branch nodes that are fork points)
    if (branch.forkPointId && tree.nodes[branch.forkPointId]) {
      // Already handled above since fork points are nodes in the parent branch
    }
  }

  // Start with main branch at origin
  layoutBranch(tree.mainBranchId, 0, 0);

  // Build React Flow nodes
  for (const [nodeId, treeNode] of Object.entries(tree.nodes)) {
    const pos = nodePositions[nodeId] ?? { x: 0, y: globalNodeIndex * 280 };
    const branch = tree.branches[treeNode.branchId];
    const isActive = treeNode.branchId === tree.activeBranchId;
    const isUser = treeNode.message.role === "user";

    if (isUser) {
      rfNodes.push({
        id: nodeId,
        type: "userNode",
        draggable: false,
        position: pos,
        data: {
          content: getMessageText(treeNode.message),
          isFirst: treeNode.parentId === null,
        },
      });
    } else {
      const forkBranches = getBranchesFromNode(tree, nodeId);
      rfNodes.push({
        id: nodeId,
        type: "messageNode",
        draggable: false,
        position: pos,
        data: {
          role: treeNode.message.role,
          label: getLabel(treeNode.message.role, globalNodeIndex),
          content: getMessageText(treeNode.message),
          isFirst: treeNode.parentId === null,
          isLast: treeNode.childIds.length === 0,
          branchColor: branch?.color ?? "primary",
          isActiveBranch: isActive,
          hasBranches: forkBranches.length > 0,
          onCreateBranch: () => onCreateBranch(nodeId),
          onSwitchBranch,
          forkBranches: forkBranches.map((b) => ({
            id: b.id,
            label: b.label,
            color: b.color,
          })),
        },
      });
    }
    globalNodeIndex++;
  }

  // Build edges from parent→child relationships
  for (const [nodeId, treeNode] of Object.entries(tree.nodes)) {
    for (const childId of treeNode.childIds) {
      const childNode = tree.nodes[childId];
      if (!childNode) continue;
      const childBranch = tree.branches[childNode.branchId];
      const color = childBranch?.color ?? "primary";

      rfEdges.push({
        id: `e-${nodeId}-${childId}`,
        source: nodeId,
        target: childId,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: BRANCH_COLOR_MAP[color],
          strokeWidth: 1.5,
        },
      });
    }
  }

  // Add "Continue" placeholder nodes at the end of each branch
  {
    for (const branch of Object.values(tree.branches)) {
      if (branch.nodeIds.length === 0) continue;
      const lastNodeId = branch.nodeIds[branch.nodeIds.length - 1];
      const lastNode = tree.nodes[lastNodeId];
      if (!lastNode) continue;

      const lastPos = nodePositions[lastNodeId];
      if (!lastPos) continue;

      const lastHeight = estimateNodeHeight(lastNodeId);
      const continueId = `continue-${branch.id}`;
      const label =
        branch.id === tree.mainBranchId
          ? "Continue main thread"
          : `Continue ${branch.label}`;

      rfNodes.push({
        id: continueId,
        type: "continueNode",
        draggable: false,
        position: {
          x: lastPos.x,
          y: lastPos.y + lastHeight + NODE_GAP,
        },
        data: {
          label,
          color: branch.color,
          onContinue: () => onSwitchBranch(branch.id),
        },
      });

      rfEdges.push({
        id: `e-${lastNodeId}-${continueId}`,
        source: lastNodeId,
        target: continueId,
        type: "smoothstep",
        animated: true,
        style: {
          stroke: BRANCH_COLOR_MAP[branch.color],
          strokeWidth: 1.5,
        },
      });
    }
  }

  return { nodes: rfNodes, edges: rfEdges };
}

export default function NodeCanvas({
  tree,
  onCreateBranch,
  onSwitchBranch,
}: NodeCanvasProps) {
  const graph = useMemo(
    () => buildGraph(tree, onCreateBranch, onSwitchBranch),
    [tree, onCreateBranch, onSwitchBranch],
  );
  const [nodes, , onNodesChange] = useNodesState(graph.nodes);
  const [edges, , onEdgesChange] = useEdgesState(graph.edges);

  const nodeCount = Object.keys(tree.nodes).length;

  const fitViewOptions = useMemo(() => {
    const activeBranch = tree.branches[tree.activeBranchId];
    if (!activeBranch || activeBranch.nodeIds.length === 0) {
      return { padding: 0.3, maxZoom: 1 };
    }
    // Focus on the last few nodes of the active branch + the continue node
    const recentIds = activeBranch.nodeIds.slice(-4);
    const focusNodes = [
      ...recentIds.map((id) => ({ id })),
      { id: `continue-${activeBranch.id}` },
    ];
    return { padding: 0.3, maxZoom: 1, nodes: focusNodes };
  }, [tree.activeBranchId, tree.branches]);

  if (nodeCount === 0) {
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
        fitView
        fitViewOptions={fitViewOptions}
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
        <Controls className="node-canvas__controls" showInteractive={false} />
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
