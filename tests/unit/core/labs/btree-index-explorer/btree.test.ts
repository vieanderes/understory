import { describe, expect, it } from 'vitest';
import {
  allKeys,
  ascendingKeys,
  createTree,
  getPage,
  height,
  insert,
  insertAll,
  pageCount,
  pageLabel,
  randomKeys,
  rangeScan,
  run,
  search,
  type Tree,
} from '@/core/labs/btree-index-explorer';
import { mulberry32 } from '@/core/util';

const last = <T>(items: readonly T[]): T => items[items.length - 1]!;
const steps = (frames: readonly { step: string }[]) => frames.map((f) => f.step);

describe('createTree', () => {
  it('starts as one empty leaf that is also the root', () => {
    const tree = createTree();
    expect(tree.maxKeys).toBe(4);
    expect(height(tree)).toBe(1);
    expect(pageCount(tree)).toBe(1);
    expect(getPage(tree, tree.rootId)).toMatchObject({ kind: 'leaf', keys: [], next: null });
  });

  it('refuses a page too small to split into two valid halves', () => {
    expect(() => createTree(2)).toThrow(RangeError);
    expect(() => createTree(3.5)).toThrow(RangeError);
  });

  it('fails loudly on a tree that points at a missing page', () => {
    const broken: Tree = { ...createTree(), rootId: 99 };
    expect(() => search(broken, 1)).toThrow(/Page 99/);
  });
});

describe('insert', () => {
  it('places keys in sorted order inside a leaf with room', () => {
    const tree = insertAll(createTree(), [30, 10, 20]);
    expect(getPage(tree, tree.rootId).keys).toEqual([10, 20, 30]);
    expect(height(tree)).toBe(1);
  });

  it('steps through start, leaf, place and done when nothing splits', () => {
    const { frames, tree } = insert(insertAll(createTree(), [10, 30]), 20);
    expect(steps(frames)).toEqual(['start', 'leaf', 'place', 'done']);
    expect(frames[0]!.active).toEqual([]);
    expect(frames[1]!.active).toEqual([tree.rootId]);
    expect(frames[1]!.pagesRead).toBe(1);
    // The leaf frame still shows the page before the key lands, so a learner can predict.
    expect(getPage(frames[1]!.tree, tree.rootId).keys).toEqual([10, 30]);
    expect(getPage(frames[2]!.tree, tree.rootId).keys).toEqual([10, 20, 30]);
    expect(last(frames).message).toContain('20 inserted');
  });

  it('does not change its input', () => {
    const before = insertAll(createTree(), [10, 20, 30, 40]);
    const snapshot = JSON.stringify(before);
    insert(before, 25);
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('splits an overflowing leaf, copies the median up and grows a new root', () => {
    const full = insertAll(createTree(), [10, 20, 30, 40]);
    const { frames, tree } = insert(full, 25);
    expect(steps(frames)).toEqual(['start', 'leaf', 'place', 'split-leaf', 'new-root', 'done']);

    // The overflow is shown before it is repaired.
    expect(getPage(frames[2]!.tree, full.rootId).keys).toEqual([10, 20, 25, 30, 40]);

    const root = getPage(tree, tree.rootId);
    expect(root.kind).toBe('internal');
    expect(root.keys).toEqual([25]);
    const [left, right] = root.children.map((id) => getPage(tree, id));
    expect(left!.keys).toEqual([10, 20]);
    // Copied, not moved: the separator is still in the leaf, because leaves hold every entry.
    expect(right!.keys).toEqual([25, 30, 40]);
    expect(left!.next).toBe(right!.id);
    expect(right!.next).toBeNull();
    expect(height(tree)).toBe(2);
    expect(pageCount(tree)).toBe(3);
    expect(frames[3]!.message).toContain('copied up');
    expect(frames[4]!.message).toContain('height 2');
  });

  it('keeps the leaf chain intact when a middle leaf splits', () => {
    let tree = insertAll(createTree(), [10, 20, 30, 40, 50]);
    // Leaves: [10 20] -> [30 40 50]. Fill the left one and split it.
    tree = insertAll(tree, [12, 14, 16]);
    expect(allKeys(tree)).toEqual([10, 12, 14, 16, 20, 30, 40, 50]);
    const root = getPage(tree, tree.rootId);
    expect(root.keys).toEqual([14, 30]);
    const chain = root.children.map((id) => getPage(tree, id));
    expect(chain[0]!.next).toBe(chain[1]!.id);
    expect(chain[1]!.next).toBe(chain[2]!.id);
    expect(chain[2]!.next).toBeNull();
  });

  it('splits an internal page by moving the median up, out of both halves', () => {
    // Ascending keys leave every leaf but the last half full: 12 keys fill the root.
    const keys = Array.from({ length: 12 }, (_, i) => (i + 1) * 10);
    const full = insertAll(createTree(), keys);
    expect(getPage(full, full.rootId).keys).toEqual([30, 50, 70, 90]);
    expect(height(full)).toBe(2);

    const { frames, tree } = insert(full, 130);
    expect(steps(frames)).toEqual([
      'start',
      'descend',
      'leaf',
      'place',
      'split-leaf',
      'split-internal',
      'new-root',
      'done',
    ]);
    // The parent is shown overflowing before it splits.
    expect(getPage(frames[4]!.tree, full.rootId).keys).toEqual([30, 50, 70, 90, 110]);
    expect(frames[4]!.message).toContain('must split too');

    const root = getPage(tree, tree.rootId);
    expect(root.keys).toEqual([70]);
    const [left, right] = root.children.map((id) => getPage(tree, id));
    expect(left!.keys).toEqual([30, 50]);
    expect(right!.keys).toEqual([90, 110]);
    expect(left!.children).toHaveLength(3);
    expect(right!.children).toHaveLength(3);
    expect(height(tree)).toBe(3);
    expect(frames[5]!.message).toContain('moves up');
    expect(allKeys(tree)).toEqual([...keys, 130]);
  });

  it('passes a split up into a parent that has room without touching the root', () => {
    const tree = insertAll(createTree(), [10, 20, 30, 40, 50]);
    const { frames, tree: after } = insert(insertAll(tree, [60]), 70);
    expect(steps(frames)).toEqual(['start', 'descend', 'leaf', 'place', 'split-leaf', 'done']);
    expect(after.rootId).toBe(tree.rootId);
    expect(getPage(after, after.rootId).keys).toEqual([30, 50]);
    expect(frames[4]!.message).toContain(pageLabel(after.rootId));
  });

  it('says which pointer the descent follows: leftmost, between two keys, rightmost', () => {
    const tree = insertAll(createTree(), [10, 20, 30, 40, 50, 60, 70]);
    expect(getPage(tree, tree.rootId).keys).toEqual([30, 50]);
    expect(insert(tree, 5).frames[1]!.message).toContain('below 30');
    expect(insert(tree, 35).frames[1]!.message).toContain('at least 30 and below 50');
    expect(insert(tree, 99).frames[1]!.message).toContain('at least 50');
  });

  it('keeps keys unique: a duplicate changes nothing', () => {
    const tree = insertAll(createTree(), [10, 20]);
    const { frames, tree: after } = insert(tree, 20);
    expect(steps(frames)).toEqual(['start', 'leaf', 'duplicate']);
    expect(after).toBe(tree);
  });
});

describe('search', () => {
  const tree = insertAll(
    createTree(),
    Array.from({ length: 13 }, (_, i) => (i + 1) * 10),
  );

  it('reads one page per level', () => {
    expect(height(tree)).toBe(3);
    const { found, frames } = search(tree, 90);
    expect(found).toBe(true);
    expect(steps(frames)).toEqual(['start', 'descend', 'descend', 'found']);
    expect(last(frames).pagesRead).toBe(3);
    expect(last(frames).matched).toEqual([90]);
    expect(last(frames).visited).toHaveLength(2);
  });

  it('reports a missing key after the same descent', () => {
    const { found, frames } = search(tree, 95);
    expect(found).toBe(false);
    expect(last(frames).step).toBe('not-found');
    expect(last(frames).pagesRead).toBe(3);
    expect(last(frames).matched).toEqual([]);
  });

  it('follows an equal separator to the right, where the copied key lives', () => {
    const root = getPage(tree, tree.rootId);
    expect(search(tree, root.keys[0]!).found).toBe(true);
  });
});

describe('rangeScan', () => {
  const tree = insertAll(
    createTree(),
    Array.from({ length: 13 }, (_, i) => (i + 1) * 10),
  );

  it('descends once and then walks the leaf chain', () => {
    const { keys, frames } = rangeScan(tree, 35, 85);
    expect(keys).toEqual([40, 50, 60, 70, 80]);
    const kinds = steps(frames);
    expect(kinds.filter((k) => k === 'descend')).toHaveLength(2);
    expect(kinds.filter((k) => k === 'scan-leaf')).toHaveLength(4);
    expect(last(frames).step).toBe('done');
    // 2 internal pages + 4 leaves.
    expect(last(frames).pagesRead).toBe(6);
    expect(last(frames).matched).toEqual(keys);
  });

  it('stops on the first key above the upper bound', () => {
    const { frames } = rangeScan(tree, 10, 15);
    const scans = frames.filter((f) => f.step === 'scan-leaf');
    expect(scans).toHaveLength(1);
    expect(scans[0]!.message).toContain('20 is above 15');
  });

  it('reads one leaf too many when a page ends below the bound', () => {
    // Without a high key the scan cannot know the next page starts above the bound.
    const { keys, frames } = rangeScan(tree, 10, 25);
    expect(keys).toEqual([10, 20]);
    const scans = frames.filter((f) => f.step === 'scan-leaf');
    expect(scans).toHaveLength(2);
    expect(scans[1]!.message).toContain('no keys in range');
  });

  it('stops at the end of the chain', () => {
    const { keys, frames } = rangeScan(tree, 125, 999);
    expect(keys).toEqual([130]);
    expect(frames.find((f) => f.message.includes('last leaf'))).toBeDefined();
  });

  it('accepts the bounds in either order and works on an empty tree', () => {
    expect(rangeScan(tree, 85, 35).keys).toEqual([40, 50, 60, 70, 80]);
    const empty = rangeScan(createTree(), 1, 9);
    expect(empty.keys).toEqual([]);
    expect(last(empty.frames).message).toContain('no keys');
  });
});

describe('run', () => {
  it('shows a resting frame when there is nothing to do', () => {
    const { frames } = run(createTree(), []);
    expect(steps(frames)).toEqual(['idle']);
    expect(frames[0]!.message).toContain('Empty tree');
    const grown = run(insertAll(createTree(), [1, 2, 3, 4, 5]), []);
    expect(grown.frames[0]!.message).toContain('Height 2');
  });

  it('concatenates operations, each on the tree the last one left', () => {
    const { frames, tree } = run(createTree(), [
      { type: 'insert', key: 5 },
      { type: 'search', key: 5 },
      { type: 'range', from: 1, to: 9 },
    ]);
    expect(allKeys(tree)).toEqual([5]);
    expect(frames.map((f) => f.op?.type)).toContain('range');
    expect(frames.find((f) => f.step === 'found')).toBeDefined();
  });

  it('collapses a summarised insert into one frame that names what split', () => {
    const keys = [10, 20, 30, 40, 50];
    const { frames, tree } = run(
      createTree(),
      keys.map((key) => ({ type: 'insert' as const, key, summary: true })),
    );
    expect(frames).toHaveLength(keys.length + 1);
    expect(frames[0]!.step).toBe('idle');
    expect(frames[0]!.message).toContain('5 inserts queued');
    expect(frames[1]!.message).toBe('10 inserted into P1. Height 1, 1 page.');
    expect(last(frames).message).toContain('split');
    expect(last(frames).message).toContain('new root');
    expect(last(frames).active.length).toBeGreaterThan(1);
    expect(allKeys(tree)).toEqual(keys);
  });

  it('summarises a duplicate without touching the tree', () => {
    const { frames } = run(insertAll(createTree(), [7]), [
      { type: 'insert', key: 7, summary: true },
    ]);
    expect(last(frames).message).toContain('already');
  });
});

describe('key helpers', () => {
  it('draws distinct random keys that are not in the tree, reproducibly', () => {
    const tree = insertAll(createTree(), [1, 2, 3]);
    const a = randomKeys(tree, 10, mulberry32(7), 50);
    const b = randomKeys(tree, 10, mulberry32(7), 50);
    expect(a).toEqual(b);
    expect(new Set(a).size).toBe(10);
    expect(a.every((k) => k >= 4 && k <= 50)).toBe(true);
  });

  it('returns fewer keys when the key space runs out', () => {
    const tree = insertAll(createTree(), [1, 2, 3]);
    expect(randomKeys(tree, 10, mulberry32(1), 5).sort()).toEqual([4, 5]);
  });

  it('continues an ascending run above the largest key', () => {
    expect(ascendingKeys(createTree(), 3, 999)).toEqual([1, 2, 3]);
    expect(ascendingKeys(insertAll(createTree(), [40, 7]), 3, 999)).toEqual([41, 42, 43]);
    expect(ascendingKeys(insertAll(createTree(), [998]), 3, 999)).toEqual([999]);
  });
});
