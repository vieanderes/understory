import { describe, expect, it } from 'vitest';
import {
  allKeys,
  checkInvariants,
  createTree,
  getPage,
  height,
  insert,
  insertAll,
  rangeScan,
  search,
  type Page,
  type Tree,
} from '@/core/labs/btree-index-explorer';
import { intBelow, mulberry32 } from '@/core/util';

const patch = (tree: Tree, id: number, change: Partial<Page>): Tree => ({
  ...tree,
  pages: { ...tree.pages, [id]: { ...getPage(tree, id), ...change } },
});

describe('checkInvariants', () => {
  // Height 3: root [70], internals [30 50] and [90 110], six leaves.
  const tree = insertAll(
    createTree(),
    Array.from({ length: 13 }, (_, i) => (i + 1) * 10),
  );
  const root = getPage(tree, tree.rootId);
  const leftInternal = getPage(tree, root.children[0]!);
  const firstLeaf = getPage(tree, leftInternal.children[0]!);

  it('accepts a tree built by inserts, and an empty one', () => {
    expect(checkInvariants(tree)).toEqual([]);
    expect(checkInvariants(createTree())).toEqual([]);
  });

  it('catches keys out of order inside a page', () => {
    const broken = patch(tree, firstLeaf.id, { keys: [20, 10] });
    expect(checkInvariants(broken).join(' ')).toMatch(/not sorted/);
  });

  it('catches an overfull page and an underfull one', () => {
    const over = patch(tree, firstLeaf.id, { keys: [10, 11, 12, 13, 14] });
    expect(checkInvariants(over).join(' ')).toMatch(/more than 4 keys/);
    const under = patch(tree, firstLeaf.id, { keys: [10] });
    expect(checkInvariants(under).join(' ')).toMatch(/less than half full/);
  });

  it('catches an internal page whose pointers do not match its keys', () => {
    const broken = patch(tree, leftInternal.id, { children: leftInternal.children.slice(0, 2) });
    expect(checkInvariants(broken).join(' ')).toMatch(/pointers/);
  });

  it('catches a key on the wrong side of its separator', () => {
    const broken = patch(tree, firstLeaf.id, { keys: [10, 35] });
    expect(checkInvariants(broken).join(' ')).toMatch(/outside the range/);
  });

  it('catches leaves at different depths', () => {
    const broken = patch(tree, tree.rootId, {
      children: [root.children[0]!, getPage(tree, root.children[1]!).children[0]!],
    });
    expect(checkInvariants(broken).join(' ')).toMatch(/same depth/);
  });

  it('catches a leaf chain that skips a page', () => {
    const secondLeaf = getPage(tree, firstLeaf.next!);
    const broken = patch(tree, firstLeaf.id, { next: secondLeaf.next });
    expect(checkInvariants(broken).join(' ')).toMatch(/leaf chain/);
  });
});

describe('B+ tree properties under seeded random inserts', () => {
  for (const maxKeys of [3, 4, 5, 8]) {
    it(`holds every invariant with ${maxKeys} keys per page`, () => {
      for (let seed = 1; seed <= 25; seed += 1) {
        const rng = mulberry32(seed * 7919 + maxKeys);
        let tree = createTree(maxKeys);
        const inserted = new Set<number>();
        const count = 20 + intBelow(rng, 140);
        for (let i = 0; i < count; i += 1) {
          // A narrow key space, so duplicates arrive too.
          const key = 1 + intBelow(rng, 400);
          tree = insert(tree, key).tree;
          inserted.add(key);
          expect(checkInvariants(tree)).toEqual([]);
        }

        const sorted = [...inserted].sort((a, b) => a - b);
        expect(allKeys(tree)).toEqual(sorted);

        const levels = height(tree);
        for (const key of sorted) {
          const result = search(tree, key);
          expect(result.found).toBe(true);
          expect(result.frames[result.frames.length - 1]!.pagesRead).toBe(levels);
        }
        for (let key = 0; key <= 401; key += 1) {
          if (!inserted.has(key)) expect(search(tree, key).found).toBe(false);
        }

        for (let i = 0; i < 20; i += 1) {
          const a = intBelow(rng, 420);
          const b = intBelow(rng, 420);
          const lo = Math.min(a, b);
          const hi = Math.max(a, b);
          const { keys, frames } = rangeScan(tree, a, b);
          expect(keys).toEqual(sorted.filter((k) => k >= lo && k <= hi));
          // One descent, then only the chain: never a second visit to an internal page.
          const leavesRead = frames.filter((f) => f.step === 'scan-leaf').length;
          expect(frames[frames.length - 1]!.pagesRead).toBe(levels - 1 + leavesRead);
        }
      }
    });
  }

  it('ascending inserts grow the tree to the right and leave half-full leaves behind', () => {
    const tree = insertAll(
      createTree(),
      Array.from({ length: 40 }, (_, i) => i + 1),
    );
    expect(checkInvariants(tree)).toEqual([]);
    const leaves = Object.values(tree.pages).filter((p) => p.kind === 'leaf');
    const halfFull = leaves.filter((p) => p.keys.length === 2);
    expect(halfFull.length).toBe(leaves.length - 1);
  });
});
