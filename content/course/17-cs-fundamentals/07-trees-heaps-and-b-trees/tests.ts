import { insert, type TreeNode } from './solution';

function build(keys: number[]): TreeNode | null {
  let root: TreeNode | null = null;
  for (const key of keys) root = insert(root, key);
  return root;
}

test('the first key becomes the root', () => {
  expect(insert(null, 50)).toEqual({ key: 50, left: null, right: null });
});

test('a smaller key hangs on the left, a larger one on the right', () => {
  const root = build([50, 30, 70]);
  expect(root?.key).toBe(50);
  expect(root?.left?.key).toBe(30);
  expect(root?.right?.key).toBe(70);
});

test('a key walks down more than one level', () => {
  const root = build([50, 30, 70, 60, 20]);
  expect(root?.right?.left?.key).toBe(60);
  expect(root?.left?.left?.key).toBe(20);
});

test('it returns the same root it was given', () => {
  const root = build([50, 30]);
  expect(insert(root, 40)).toBe(root);
  expect(root?.left?.right?.key).toBe(40);
});

test('a key already in the tree is not added twice', () => {
  const root = build([50, 30, 30]);
  expect(root?.left).toEqual({ key: 30, left: null, right: null });
});

test('sorted keys make a line that leans right', () => {
  const root = build([20, 30, 40]);
  expect(root?.left).toBe(null);
  expect(root?.right?.right?.key).toBe(40);
});
