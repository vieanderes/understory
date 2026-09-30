export type TreeNode = { key: number; left: TreeNode | null; right: TreeNode | null };

export function insert(root: TreeNode | null, key: number): TreeNode {
  // Walk down from the root: left for a smaller key, right for a larger one.
  // Hang the new node on the first empty side you reach, then return the root.
  return { key, left: null, right: null };
}
