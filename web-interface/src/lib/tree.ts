import type { UIMessage } from "ai";
import type {
  ConversationTree,
  TreeNode,
  Branch,
  BranchId,
  NodeId,
  BranchColor,
} from "@/types/branch";

const BRANCH_COLORS: BranchColor[] = ["primary", "secondary", "tertiary"];

function genId(): string {
  return crypto.randomUUID();
}

// ---------------------------------------------------------------------------
// Create an empty tree with a main branch
// ---------------------------------------------------------------------------
export function createEmptyTree(): ConversationTree {
  const mainBranchId = genId();
  return {
    nodes: {},
    branches: {
      [mainBranchId]: {
        id: mainBranchId,
        label: "Main Thread",
        forkPointId: null,
        parentBranchId: null,
        nodeIds: [],
        color: "primary",
      },
    },
    mainBranchId,
    activeBranchId: mainBranchId,
  };
}

// ---------------------------------------------------------------------------
// Migrate a flat UIMessage[] into a tree (all on main branch)
// ---------------------------------------------------------------------------
export function treeFromMessages(messages: UIMessage[]): ConversationTree {
  const tree = createEmptyTree();

  for (const msg of messages) {
    addNodeToBranch(tree, msg, tree.mainBranchId);
  }

  return tree;
}

// ---------------------------------------------------------------------------
// Add a message node to a branch (mutates tree for perf, caller should
// spread into new state if needed for React)
// ---------------------------------------------------------------------------
export function addNodeToBranch(
  tree: ConversationTree,
  message: UIMessage,
  branchId: BranchId,
): void {
  const branch = tree.branches[branchId];
  if (!branch) return;

  // Determine parent: last node in this branch, or the fork point
  let parentId: NodeId | null = null;
  if (branch.nodeIds.length > 0) {
    parentId = branch.nodeIds[branch.nodeIds.length - 1];
  } else if (branch.forkPointId) {
    parentId = branch.forkPointId;
  }

  const node: TreeNode = {
    message,
    parentId,
    branchId,
    childIds: [],
  };

  tree.nodes[message.id] = node;
  branch.nodeIds.push(message.id);

  // Link parent → child
  if (parentId && tree.nodes[parentId]) {
    tree.nodes[parentId].childIds.push(message.id);
  }
}

// ---------------------------------------------------------------------------
// Get the ancestor chain from root down to (and including) a given node
// ---------------------------------------------------------------------------
export function getAncestorChain(
  tree: ConversationTree,
  nodeId: NodeId,
): UIMessage[] {
  const chain: UIMessage[] = [];
  let current: NodeId | null = nodeId;

  while (current) {
    const node: TreeNode | undefined = tree.nodes[current];
    if (!node) break;
    chain.unshift(node.message);
    current = node.parentId;
  }

  return chain;
}

// ---------------------------------------------------------------------------
// Get the full message chain for a branch (ancestors + branch's own nodes)
// ---------------------------------------------------------------------------
export function getBranchMessageChain(
  tree: ConversationTree,
  branchId: BranchId,
): UIMessage[] {
  const branch = tree.branches[branchId];
  if (!branch) return [];

  // Get ancestor chain up to and including the fork point
  let ancestors: UIMessage[] = [];
  if (branch.forkPointId) {
    ancestors = getAncestorChain(tree, branch.forkPointId);
  }

  // Append this branch's own messages
  const branchMessages = branch.nodeIds
    .map((id) => tree.nodes[id]?.message)
    .filter(Boolean) as UIMessage[];

  return [...ancestors, ...branchMessages];
}

// ---------------------------------------------------------------------------
// Create a new branch forking from a given node
// ---------------------------------------------------------------------------
export function createBranch(
  tree: ConversationTree,
  forkPointId: NodeId,
): { tree: ConversationTree; branchId: BranchId } {
  const forkNode = tree.nodes[forkPointId];
  if (!forkNode) return { tree, branchId: "" };

  const branchId = genId();
  const branchCount = Object.keys(tree.branches).length;
  const color = BRANCH_COLORS[branchCount % BRANCH_COLORS.length];

  const newBranch: Branch = {
    id: branchId,
    label: `Branch ${branchCount}`,
    forkPointId,
    parentBranchId: forkNode.branchId,
    nodeIds: [],
    color,
  };

  tree.branches[branchId] = newBranch;

  return { tree, branchId };
}

// ---------------------------------------------------------------------------
// Get all branches that fork from a specific node
// ---------------------------------------------------------------------------
export function getBranchesFromNode(
  tree: ConversationTree,
  nodeId: NodeId,
): Branch[] {
  return Object.values(tree.branches).filter((b) => b.forkPointId === nodeId);
}

// ---------------------------------------------------------------------------
// Check if a node is a fork point (has branches coming off it)
// ---------------------------------------------------------------------------
export function isForkPoint(tree: ConversationTree, nodeId: NodeId): boolean {
  return getBranchesFromNode(tree, nodeId).length > 0;
}

// ---------------------------------------------------------------------------
// Rename a branch (mutates)
// ---------------------------------------------------------------------------
export function renameBranch(
  tree: ConversationTree,
  branchId: BranchId,
  label: string,
): void {
  const branch = tree.branches[branchId];
  if (branch) branch.label = label;
}

// ---------------------------------------------------------------------------
// Delete a branch and its nodes from the tree (mutates)
// ---------------------------------------------------------------------------
export function deleteBranch(
  tree: ConversationTree,
  branchId: BranchId,
): void {
  const branch = tree.branches[branchId];
  if (!branch || branchId === tree.mainBranchId) return;

  for (const nodeId of branch.nodeIds) {
    const node = tree.nodes[nodeId];
    if (node?.parentId && tree.nodes[node.parentId]) {
      tree.nodes[node.parentId].childIds = tree.nodes[
        node.parentId
      ].childIds.filter((id) => id !== nodeId);
    }
    delete tree.nodes[nodeId];
  }

  delete tree.branches[branchId];
}

// ---------------------------------------------------------------------------
// Reset the tree completely
// ---------------------------------------------------------------------------
export function resetTree(): ConversationTree {
  return createEmptyTree();
}
