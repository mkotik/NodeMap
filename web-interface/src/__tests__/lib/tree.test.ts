import type { UIMessage } from "ai";
import {
  createEmptyTree,
  treeFromMessages,
  addNodeToBranch,
  getBranchMessageChain,
  createBranch,
  deleteBranch,
  getAncestorChain,
  getBranchesFromNode,
  isForkPoint,
  resetTree,
} from "@/lib/tree";

function makeMessage(
  id: string,
  role: "user" | "assistant",
  text: string,
): UIMessage {
  return {
    id,
    role,
    parts: [{ type: "text" as const, text }],
  } as UIMessage;
}

describe("tree utilities", () => {
  describe("createEmptyTree", () => {
    it("creates a tree with a single main branch and no nodes", () => {
      const tree = createEmptyTree();
      expect(Object.keys(tree.nodes)).toHaveLength(0);
      expect(Object.keys(tree.branches)).toHaveLength(1);
      expect(tree.mainBranchId).toBe(tree.activeBranchId);
      const main = tree.branches[tree.mainBranchId];
      expect(main.label).toBe("Main Thread");
      expect(main.forkPointId).toBeNull();
      expect(main.parentBranchId).toBeNull();
      expect(main.nodeIds).toHaveLength(0);
    });
  });

  describe("addNodeToBranch", () => {
    it("adds a node to the main branch", () => {
      const tree = createEmptyTree();
      const msg = makeMessage("m1", "user", "hello");
      addNodeToBranch(tree, msg, tree.mainBranchId);

      expect(tree.nodes["m1"]).toBeDefined();
      expect(tree.nodes["m1"].branchId).toBe(tree.mainBranchId);
      expect(tree.nodes["m1"].parentId).toBeNull();
      expect(tree.branches[tree.mainBranchId].nodeIds).toEqual(["m1"]);
    });

    it("links parent to child correctly", () => {
      const tree = createEmptyTree();
      const m1 = makeMessage("m1", "user", "hello");
      const m2 = makeMessage("m2", "assistant", "hi there");
      addNodeToBranch(tree, m1, tree.mainBranchId);
      addNodeToBranch(tree, m2, tree.mainBranchId);

      expect(tree.nodes["m2"].parentId).toBe("m1");
      expect(tree.nodes["m1"].childIds).toContain("m2");
    });

    it("does nothing for an invalid branch ID", () => {
      const tree = createEmptyTree();
      const msg = makeMessage("m1", "user", "hello");
      addNodeToBranch(tree, msg, "nonexistent");
      expect(Object.keys(tree.nodes)).toHaveLength(0);
    });
  });

  describe("treeFromMessages", () => {
    it("creates a tree with all messages on the main branch", () => {
      const messages = [
        makeMessage("m1", "user", "hello"),
        makeMessage("m2", "assistant", "hi"),
        makeMessage("m3", "user", "how are you"),
      ];
      const tree = treeFromMessages(messages);

      expect(Object.keys(tree.nodes)).toHaveLength(3);
      expect(tree.branches[tree.mainBranchId].nodeIds).toEqual([
        "m1",
        "m2",
        "m3",
      ]);
      expect(tree.nodes["m1"].parentId).toBeNull();
      expect(tree.nodes["m2"].parentId).toBe("m1");
      expect(tree.nodes["m3"].parentId).toBe("m2");
    });

    it("handles empty messages array", () => {
      const tree = treeFromMessages([]);
      expect(Object.keys(tree.nodes)).toHaveLength(0);
    });
  });

  describe("getAncestorChain", () => {
    it("returns the full chain from root to the given node", () => {
      const messages = [
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
        makeMessage("m3", "user", "c"),
      ];
      const tree = treeFromMessages(messages);
      const chain = getAncestorChain(tree, "m3");

      expect(chain.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    });

    it("returns single node for root", () => {
      const tree = treeFromMessages([makeMessage("m1", "user", "a")]);
      const chain = getAncestorChain(tree, "m1");
      expect(chain).toHaveLength(1);
      expect(chain[0].id).toBe("m1");
    });

    it("returns empty array for nonexistent node", () => {
      const tree = createEmptyTree();
      expect(getAncestorChain(tree, "nope")).toEqual([]);
    });
  });

  describe("createBranch", () => {
    it("creates a new branch forking from a given node", () => {
      const messages = [
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
      ];
      const tree = treeFromMessages(messages);
      const { branchId } = createBranch(tree, "m2");

      expect(branchId).toBeTruthy();
      expect(tree.branches[branchId]).toBeDefined();
      expect(tree.branches[branchId].forkPointId).toBe("m2");
      expect(tree.branches[branchId].parentBranchId).toBe(tree.mainBranchId);
      expect(tree.branches[branchId].nodeIds).toHaveLength(0);
    });

    it("returns empty branchId for nonexistent fork point", () => {
      const tree = createEmptyTree();
      const { branchId } = createBranch(tree, "nope");
      expect(branchId).toBe("");
    });

    it("assigns different colors to successive branches", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
        makeMessage("m3", "user", "c"),
        makeMessage("m4", "assistant", "d"),
      ]);

      const { branchId: b1 } = createBranch(tree, "m2");
      const { branchId: b2 } = createBranch(tree, "m4");

      // Main is "primary", b1 and b2 should cycle through remaining colors
      expect(tree.branches[b1].color).not.toBe(tree.branches[b2].color);
    });
  });

  describe("getBranchMessageChain", () => {
    it("returns ancestors + branch messages for a sub-branch", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
        makeMessage("m3", "user", "c"),
      ]);

      const { branchId } = createBranch(tree, "m2");
      const branchMsg = makeMessage("b1", "user", "branch msg");
      addNodeToBranch(tree, branchMsg, branchId);

      const chain = getBranchMessageChain(tree, branchId);
      expect(chain.map((m) => m.id)).toEqual(["m1", "m2", "b1"]);
    });

    it("returns just the main branch messages for main branch", () => {
      const messages = [
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
      ];
      const tree = treeFromMessages(messages);
      const chain = getBranchMessageChain(tree, tree.mainBranchId);
      expect(chain.map((m) => m.id)).toEqual(["m1", "m2"]);
    });

    it("returns empty for nonexistent branch", () => {
      const tree = createEmptyTree();
      expect(getBranchMessageChain(tree, "nope")).toEqual([]);
    });
  });

  describe("getBranchesFromNode / isForkPoint", () => {
    it("returns branches that fork from a node", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
      ]);
      createBranch(tree, "m2");

      const forks = getBranchesFromNode(tree, "m2");
      expect(forks).toHaveLength(1);
      expect(forks[0].forkPointId).toBe("m2");
      expect(isForkPoint(tree, "m2")).toBe(true);
    });

    it("returns empty for non-fork nodes", () => {
      const tree = treeFromMessages([makeMessage("m1", "user", "a")]);
      expect(getBranchesFromNode(tree, "m1")).toHaveLength(0);
      expect(isForkPoint(tree, "m1")).toBe(false);
    });

    it("supports multiple branches from the same node", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
      ]);
      createBranch(tree, "m2");
      createBranch(tree, "m2");

      expect(getBranchesFromNode(tree, "m2")).toHaveLength(2);
    });
  });

  describe("deleteBranch", () => {
    it("removes an empty branch from the tree", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
      ]);
      const { branchId } = createBranch(tree, "m2");
      expect(tree.branches[branchId]).toBeDefined();

      deleteBranch(tree, branchId);
      expect(tree.branches[branchId]).toBeUndefined();
      expect(Object.keys(tree.branches)).toHaveLength(1);
    });

    it("removes branch nodes and cleans up parent childIds", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
      ]);
      const { branchId } = createBranch(tree, "m2");
      addNodeToBranch(tree, makeMessage("b1", "user", "branch"), branchId);

      expect(tree.nodes["m2"].childIds).toContain("b1");

      deleteBranch(tree, branchId);
      expect(tree.nodes["b1"]).toBeUndefined();
      expect(tree.nodes["m2"].childIds).not.toContain("b1");
    });

    it("does not delete the main branch", () => {
      const tree = createEmptyTree();
      deleteBranch(tree, tree.mainBranchId);
      expect(tree.branches[tree.mainBranchId]).toBeDefined();
    });

    it("does nothing for nonexistent branch", () => {
      const tree = createEmptyTree();
      deleteBranch(tree, "nonexistent");
      expect(Object.keys(tree.branches)).toHaveLength(1);
    });
  });

  describe("resetTree", () => {
    it("returns a fresh empty tree", () => {
      const tree = resetTree();
      expect(Object.keys(tree.nodes)).toHaveLength(0);
      expect(Object.keys(tree.branches)).toHaveLength(1);
    });
  });

  describe("branch isolation", () => {
    it("branch messages do not appear in main thread chain", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
        makeMessage("m3", "user", "c"),
        makeMessage("m4", "assistant", "d"),
      ]);

      const { branchId } = createBranch(tree, "m2");
      addNodeToBranch(tree, makeMessage("b1", "user", "branch"), branchId);
      addNodeToBranch(
        tree,
        makeMessage("b2", "assistant", "branch reply"),
        branchId,
      );

      const mainChain = getBranchMessageChain(tree, tree.mainBranchId);
      const mainIds = mainChain.map((m) => m.id);

      expect(mainIds).toEqual(["m1", "m2", "m3", "m4"]);
      expect(mainIds).not.toContain("b1");
      expect(mainIds).not.toContain("b2");
    });

    it("main thread messages after fork do not appear in branch chain", () => {
      const tree = treeFromMessages([
        makeMessage("m1", "user", "a"),
        makeMessage("m2", "assistant", "b"),
        makeMessage("m3", "user", "c"),
        makeMessage("m4", "assistant", "d"),
      ]);

      const { branchId } = createBranch(tree, "m2");
      addNodeToBranch(tree, makeMessage("b1", "user", "branch"), branchId);

      const branchChain = getBranchMessageChain(tree, branchId);
      const branchIds = branchChain.map((m) => m.id);

      // Should have ancestors up to fork point + branch's own messages
      expect(branchIds).toEqual(["m1", "m2", "b1"]);
      expect(branchIds).not.toContain("m3");
      expect(branchIds).not.toContain("m4");
    });
  });
});
