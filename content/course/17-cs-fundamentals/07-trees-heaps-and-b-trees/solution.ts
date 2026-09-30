export type TreeNode = { key: number; left: TreeNode | null; right: TreeNode | null };

export function insert(root: TreeNode | null, key: number): TreeNode {
  const fresh: TreeNode = { key, left: null, right: null };
  if (root === null) return fresh;
  let current = root;
  while (key !== current.key) {
    if (key < current.key) {
      if (current.left === null) {
        current.left = fresh;
        break;
      }
      current = current.left;
    } else {
      if (current.right === null) {
        current.right = fresh;
        break;
      }
      current = current.right;
    }
  }
  return root;
}
