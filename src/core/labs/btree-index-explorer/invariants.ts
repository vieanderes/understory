/*
 * The structural invariants of a B+ tree (Bayer and McCreight 1972, section 2, in the B+
 * form of Comer 1979). The property tests run these after every insert; they are the
 * definition of "the tree is still a B+ tree".
 */
import { getPage, leftmostLeaf, pageLabel, type Page, type Tree } from './btree';

/** Returns one sentence per broken invariant. An empty list means the tree is sound. */
export function checkInvariants(tree: Tree): string[] {
  const problems: string[] = [];
  const minKeys = Math.floor(tree.maxKeys / 2);
  const leafDepths = new Set<number>();
  const leavesInOrder: number[] = [];

  const visit = (page: Page, depth: number, lower: number, upper: number): void => {
    const label = pageLabel(page.id);
    if (page.keys.some((key, i) => i > 0 && key <= page.keys[i - 1]!)) {
      problems.push(`${label}: keys are not sorted.`);
    }
    if (page.keys.length > tree.maxKeys) {
      problems.push(`${label}: holds more than ${tree.maxKeys} keys.`);
    }
    // The root is exempt: it may hold a single key, or none in an empty tree.
    if (page.id !== tree.rootId && page.keys.length < minKeys) {
      problems.push(`${label}: is less than half full.`);
    }
    if (page.keys.some((key) => key < lower || key >= upper)) {
      problems.push(`${label}: holds a key outside the range its parent promises.`);
    }
    if (page.kind === 'leaf') {
      leafDepths.add(depth);
      leavesInOrder.push(page.id);
      return;
    }
    if (page.children.length !== page.keys.length + 1) {
      problems.push(`${label}: its pointers must number one more than its keys.`);
      return;
    }
    page.children.forEach((childId, i) => {
      visit(
        getPage(tree, childId),
        depth + 1,
        i === 0 ? lower : page.keys[i - 1]!,
        i === page.keys.length ? upper : page.keys[i]!,
      );
    });
  };
  visit(getPage(tree, tree.rootId), 1, -Infinity, Infinity);

  if (leafDepths.size > 1) problems.push('Leaves are not all at the same depth.');

  const chain: number[] = [];
  let leaf: Page | null = leftmostLeaf(tree);
  while (leaf && chain.length <= leavesInOrder.length) {
    chain.push(leaf.id);
    leaf = leaf.next === null ? null : getPage(tree, leaf.next);
  }
  if (chain.join(',') !== leavesInOrder.join(',')) {
    problems.push('The leaf chain does not link every leaf in key order.');
  }
  return problems;
}
