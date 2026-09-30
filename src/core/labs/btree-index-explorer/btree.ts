/*
 * A B+ tree, the structure behind a database index.
 *
 * Sources:
 *  - Bayer and McCreight, "Organization and Maintenance of Large Ordered Indexes" (1972):
 *    the B-tree, its split on overflow, and the rule that every page but the root stays
 *    at least half full, which is what keeps the height logarithmic.
 *  - Comer, "The Ubiquitous B-Tree" (1979): the B+ variant. Internal pages hold only
 *    separator keys that guide the search; every entry lives in a leaf; the leaves are
 *    linked so a range is read by walking the chain instead of descending again.
 *  - Lehman and Yao, "Efficient Locking for Concurrent Operations on B-Trees" (1981),
 *    which PostgreSQL's nbtree follows (src/backend/access/nbtree/README).
 *
 * What this leaves out: deletion and page merging; concurrency (latches, and the
 * right-links and high keys Lehman and Yao add to every level so a reader survives a
 * concurrent split; only the leaf chain is kept here); duplicate keys (nbtree stores
 * them, this lab keeps keys unique so a lookup has one answer); and the rightmost-page
 * split that PostgreSQL biases to leave the left page 90% full under ascending inserts.
 * Here every split is in the middle.
 */
import { shuffle, type Rng } from '@/core/util';

export const DEFAULT_MAX_KEYS = 4;

export type PageKind = 'leaf' | 'internal';

export interface Page {
  readonly id: number;
  readonly kind: PageKind;
  readonly keys: readonly number[];
  /** Internal pages only: one more pointer than keys. */
  readonly children: readonly number[];
  /** Leaves only: the next leaf in key order. */
  readonly next: number | null;
}

export interface Tree {
  readonly maxKeys: number;
  readonly rootId: number;
  readonly nextId: number;
  readonly pages: Readonly<Record<number, Page>>;
}

export type Op =
  | { readonly type: 'insert'; readonly key: number }
  | { readonly type: 'search'; readonly key: number }
  | { readonly type: 'range'; readonly from: number; readonly to: number };

/** An operation in a program. A summarised insert yields one frame instead of every step. */
export type ProgramOp = Op & { readonly summary?: boolean };

export type StepKind =
  | 'idle'
  | 'start'
  | 'descend'
  | 'leaf'
  | 'place'
  | 'duplicate'
  | 'split-leaf'
  | 'split-internal'
  | 'new-root'
  | 'found'
  | 'not-found'
  | 'scan-leaf'
  | 'done';

export interface Frame {
  readonly tree: Tree;
  readonly op: Op | null;
  readonly step: StepKind;
  /** The pages being read or written in this step. */
  readonly active: readonly number[];
  /** Pages read earlier in the same operation. */
  readonly visited: readonly number[];
  readonly pagesRead: number;
  /** Keys this step found: the looked-up key, or the range result so far. */
  readonly matched: readonly number[];
  readonly message: string;
}

export function createTree(maxKeys: number = DEFAULT_MAX_KEYS): Tree {
  if (!Number.isInteger(maxKeys) || maxKeys < 3) {
    throw new RangeError('A page must hold at least 3 keys to split into two valid halves.');
  }
  const root: Page = { id: 1, kind: 'leaf', keys: [], children: [], next: null };
  return { maxKeys, rootId: 1, nextId: 2, pages: { 1: root } };
}

export function getPage(tree: Tree, id: number): Page {
  const page = tree.pages[id];
  if (!page) throw new Error(`Page ${id} is missing from the tree.`);
  return page;
}

export const pageLabel = (id: number): string => `P${id}`;

/** Levels from the root to a leaf. All leaves share one depth, so the leftmost path will do. */
export function height(tree: Tree): number {
  let levels = 1;
  let page = getPage(tree, tree.rootId);
  while (page.kind === 'internal') {
    page = getPage(tree, page.children[0]!);
    levels += 1;
  }
  return levels;
}

export function pageCount(tree: Tree): number {
  return Object.keys(tree.pages).length;
}

export function leftmostLeaf(tree: Tree): Page {
  let page = getPage(tree, tree.rootId);
  while (page.kind === 'internal') page = getPage(tree, page.children[0]!);
  return page;
}

/** Every key, read the way a full index scan reads them: along the leaf chain. */
export function allKeys(tree: Tree): number[] {
  const keys: number[] = [];
  let leaf: Page | null = leftmostLeaf(tree);
  while (leaf) {
    keys.push(...leaf.keys);
    leaf = leaf.next === null ? null : getPage(tree, leaf.next);
  }
  return keys;
}

const list = (keys: readonly number[]): string => (keys.length > 0 ? keys.join(' ') : 'no keys');
const plural = (n: number, word: string): string => `${n} ${word}${n === 1 ? '' : 's'}`;
const shape = (tree: Tree): string => `Height ${height(tree)}, ${plural(pageCount(tree), 'page')}.`;

/*
 * Comer 1979, section 2: in an internal page with keys k1..kn and pointers p0..pn, pointer
 * pi leads to the keys k with ki <= k < k(i+1). An equal key goes right, because a leaf
 * split copies the first key of the right page up as the separator.
 */
function childIndexFor(keys: readonly number[], key: number): number {
  let index = 0;
  while (index < keys.length && key >= keys[index]!) index += 1;
  return index;
}

function pointerReason(page: Page, key: number, index: number): string {
  const lower = page.keys[index - 1];
  const upper = page.keys[index];
  if (lower === undefined) return `${key} is below ${upper}: follow the leftmost pointer`;
  if (upper === undefined) return `${key} is at least ${lower}: follow the rightmost pointer`;
  return `${key} is at least ${lower} and below ${upper}: follow the pointer between them`;
}

interface PathStep {
  readonly pageId: number;
  readonly childIndex: number;
}

interface Descent {
  readonly path: readonly PathStep[];
  readonly leaf: Page;
  readonly frames: Frame[];
}

function descend(tree: Tree, op: Op, key: number, opening: string): Descent {
  const frames: Frame[] = [
    {
      tree,
      op,
      step: 'start',
      active: [],
      visited: [],
      pagesRead: 0,
      matched: [],
      message: `${opening} Start at the root, ${pageLabel(tree.rootId)}.`,
    },
  ];
  const path: PathStep[] = [];
  let page = getPage(tree, tree.rootId);
  while (page.kind === 'internal') {
    const childIndex = childIndexFor(page.keys, key);
    const childId = page.children[childIndex]!;
    frames.push({
      tree,
      op,
      step: 'descend',
      active: [page.id],
      visited: path.map((p) => p.pageId),
      pagesRead: path.length + 1,
      matched: [],
      message: `${pageLabel(page.id)}: ${pointerReason(page, key, childIndex)} to ${pageLabel(childId)}.`,
    });
    path.push({ pageId: page.id, childIndex });
    page = getPage(tree, childId);
  }
  return { path, leaf: page, frames };
}

function withPages(tree: Tree, pages: readonly Page[], nextId = tree.nextId): Tree {
  const merged: Record<number, Page> = { ...tree.pages };
  for (const page of pages) merged[page.id] = page;
  return { ...tree, nextId, pages: merged };
}

function insertSorted(keys: readonly number[], key: number): number[] {
  const at = keys.findIndex((k) => k > key);
  const index = at === -1 ? keys.length : at;
  return [...keys.slice(0, index), key, ...keys.slice(index)];
}

export interface InsertResult {
  readonly tree: Tree;
  readonly frames: Frame[];
  /** One sentence for the whole insert, used when a batch shows one frame per key. */
  readonly summary: string;
  /** Every page the insert wrote. */
  readonly touched: readonly number[];
}

export function insert(tree: Tree, key: number): InsertResult {
  const op: Op = { type: 'insert', key };
  const { path, leaf, frames } = descend(tree, op, key, `Insert ${key}.`);
  const visited = path.map((p) => p.pageId);
  const pagesRead = path.length + 1;
  const frame = (
    current: Tree,
    step: StepKind,
    active: readonly number[],
    message: string,
  ): Frame => ({
    tree: current,
    op,
    step,
    active,
    visited,
    pagesRead,
    matched: step === 'leaf' || step === 'duplicate' ? [] : [key],
    message,
  });

  frames.push(
    frame(tree, 'leaf', [leaf.id], `Reached leaf ${pageLabel(leaf.id)}: ${list(leaf.keys)}.`),
  );

  if (leaf.keys.includes(key)) {
    const message = `${key} is already in ${pageLabel(leaf.id)}. This lab keeps keys unique, so nothing changes.`;
    frames.push(frame(tree, 'duplicate', [leaf.id], message));
    return { tree, frames, summary: message, touched: [leaf.id] };
  }

  let current = withPages(tree, [{ ...leaf, keys: insertSorted(leaf.keys, key) }]);
  let page = getPage(current, leaf.id);
  const overflows = (p: Page) => p.keys.length > current.maxKeys;
  frames.push(
    frame(
      current,
      'place',
      [leaf.id],
      `${key} goes into ${pageLabel(leaf.id)} in sorted order: ${list(page.keys)}. ` +
        (overflows(page)
          ? `That is ${page.keys.length} keys on a page that fits ${current.maxKeys}: it must split.`
          : 'The page has room, so nothing else moves.'),
    ),
  );

  const touched = [leaf.id];
  const events: string[] = [];
  const remaining = [...path];

  /*
   * Bayer and McCreight 1972, section 3 (overflow), in the B+ form of Comer 1979: the page
   * is cut in the middle into two pages that are each at least half full. A leaf split
   * copies the first key of the right page up, because leaves hold every entry. An
   * internal split moves the median up, because an internal key only guides the search.
   */
  while (overflows(page)) {
    const mid = Math.floor(page.keys.length / 2);
    const rightId = current.nextId;
    const isLeaf = page.kind === 'leaf';
    const separator = page.keys[mid]!;
    const left: Page = isLeaf
      ? { ...page, keys: page.keys.slice(0, mid), next: rightId }
      : { ...page, keys: page.keys.slice(0, mid), children: page.children.slice(0, mid + 1) };
    const right: Page = isLeaf
      ? { id: rightId, kind: 'leaf', keys: page.keys.slice(mid), children: [], next: page.next }
      : {
          id: rightId,
          kind: 'internal',
          keys: page.keys.slice(mid + 1),
          children: page.children.slice(mid + 1),
          next: null,
        };
    touched.push(rightId);
    events.push(
      `${pageLabel(left.id)} split into ${pageLabel(left.id)} and ${pageLabel(rightId)}.`,
    );

    const halves = isLeaf
      ? `${pageLabel(left.id)} splits: ${list(left.keys)} stay, ${list(right.keys)} move to the new page ${pageLabel(rightId)}. ${separator}, the first key on ${pageLabel(rightId)}, is copied up`
      : `${pageLabel(left.id)} splits: ${list(left.keys)} stay, ${list(right.keys)} move to the new page ${pageLabel(rightId)}. ${separator}, the median, moves up`;
    const why = isLeaf
      ? 'It stays in the leaf too, because leaves hold every entry.'
      : 'It leaves both halves, because an internal key only guides the search.';
    const step: StepKind = isLeaf ? 'split-leaf' : 'split-internal';

    const parentStep = remaining.pop();
    if (!parentStep) {
      const rootId = rightId + 1;
      const root: Page = {
        id: rootId,
        kind: 'internal',
        keys: [separator],
        children: [left.id, rightId],
        next: null,
      };
      current = { ...withPages(current, [left, right, root], rootId + 1), rootId };
      touched.push(rootId);
      events.push(`The tree grew a new root, ${pageLabel(rootId)}.`);
      frames.push(frame(current, step, [left.id, rightId], `${halves}. ${why}`));
      frames.push(
        frame(
          current,
          'new-root',
          [rootId],
          `${pageLabel(left.id)} was the root, so a new root ${pageLabel(rootId)} takes ${separator}. The tree grows at the top: height ${height(current)}, and every leaf is still at the same depth.`,
        ),
      );
      break;
    }

    const parent = getPage(current, parentStep.pageId);
    const grown: Page = {
      ...parent,
      keys: [
        ...parent.keys.slice(0, parentStep.childIndex),
        separator,
        ...parent.keys.slice(parentStep.childIndex),
      ],
      children: [
        ...parent.children.slice(0, parentStep.childIndex + 1),
        rightId,
        ...parent.children.slice(parentStep.childIndex + 1),
      ],
    };
    current = withPages(current, [left, right, grown], rightId + 1);
    touched.push(parent.id);
    page = grown;
    frames.push(
      frame(
        current,
        step,
        [left.id, rightId],
        `${halves} into ${pageLabel(parent.id)}. ${why}` +
          (overflows(grown)
            ? ` ${pageLabel(parent.id)} now holds ${grown.keys.length} keys: it must split too.`
            : ''),
      ),
    );
  }

  frames.push(frame(current, 'done', [], `${key} inserted. ${shape(current)}`));
  const summary = [`${key} inserted into ${pageLabel(leaf.id)}.`, ...events, shape(current)].join(
    ' ',
  );
  return { tree: current, frames, summary, touched };
}

/** Inserts without frames: builds the tree a scenario starts from. */
export function insertAll(tree: Tree, keys: readonly number[]): Tree {
  return keys.reduce((current, key) => insert(current, key).tree, tree);
}

export interface SearchResult {
  readonly found: boolean;
  readonly frames: Frame[];
}

/** Equality lookup: one page per level, so the cost is the height of the tree. */
export function search(tree: Tree, key: number): SearchResult {
  const op: Op = { type: 'search', key };
  const { path, leaf, frames } = descend(tree, op, key, `Look up ${key}.`);
  const found = leaf.keys.includes(key);
  const pagesRead = path.length + 1;
  frames.push({
    tree,
    op,
    step: found ? 'found' : 'not-found',
    active: [leaf.id],
    visited: path.map((p) => p.pageId),
    pagesRead,
    matched: found ? [key] : [],
    message: found
      ? `${key} is in leaf ${pageLabel(leaf.id)}. ${plural(pagesRead, 'page')} read: one per level, the height of the tree.`
      : `${key} is not in leaf ${pageLabel(leaf.id)}, and the descent leads nowhere else: it is not in the index. ${plural(pagesRead, 'page')} read.`,
  });
  return { found, frames };
}

export interface RangeResult {
  readonly keys: number[];
  readonly frames: Frame[];
}

/*
 * Comer 1979, section 3 (B+ trees): a range is read by one descent to the lower bound,
 * then sequentially along the linked leaves until a key passes the upper bound. Without
 * the high key that nbtree keeps on each page, a page that ends below the bound forces a
 * read of the next one to learn that the range is over.
 */
export function rangeScan(tree: Tree, from: number, to: number): RangeResult {
  const lo = Math.min(from, to);
  const hi = Math.max(from, to);
  const op: Op = { type: 'range', from: lo, to: hi };
  const { path, leaf, frames } = descend(
    tree,
    op,
    lo,
    `Scan keys ${lo} to ${hi}. Descend once, for ${lo}.`,
  );
  const descent = path.map((p) => p.pageId);
  const keys: number[] = [];
  const leaves: number[] = [];
  let current: Page | null = leaf;
  while (current) {
    const here = current.keys.filter((k) => k >= lo && k <= hi);
    keys.push(...here);
    const above: number | undefined = current.keys.find((k) => k > hi);
    const nextId: number | null = above === undefined ? current.next : null;
    const lastKey = current.keys[current.keys.length - 1];
    let ending: string;
    if (above !== undefined) ending = `${above} is above ${hi}: the scan stops.`;
    else if (nextId === null) ending = 'It is the last leaf: the scan stops.';
    else
      ending = `Its last key ${lastKey} is not above ${hi}, so follow the link to ${pageLabel(nextId)}.`;
    frames.push({
      tree,
      op,
      step: 'scan-leaf',
      active: [current.id],
      visited: [...descent, ...leaves],
      pagesRead: descent.length + leaves.length + 1,
      matched: [...keys],
      message: `Leaf ${pageLabel(current.id)}: ${here.length > 0 ? `${list(here)} in range` : 'no keys in range'}. ${ending}`,
    });
    leaves.push(current.id);
    current = nextId === null ? null : getPage(tree, nextId);
  }
  const pagesRead = descent.length + leaves.length;
  frames.push({
    tree,
    op,
    step: 'done',
    active: [],
    visited: [...descent, ...leaves],
    pagesRead,
    matched: [...keys],
    message: `Keys ${lo} to ${hi}: ${list(keys)}. ${plural(pagesRead, 'page')} read: ${height(tree)} for the one descent, then ${leaves.length - 1} more along the leaf chain.`,
  });
  return { keys, frames };
}

export interface RunResult {
  readonly frames: Frame[];
  readonly tree: Tree;
}

/** Every frame of a program, computed up front, so the view is a function of one index. */
export function run(tree: Tree, ops: readonly ProgramOp[]): RunResult {
  const idle = (message: string): Frame => ({
    tree,
    op: null,
    step: 'idle',
    active: [],
    visited: [],
    pagesRead: 0,
    matched: [],
    message,
  });
  if (ops.length === 0) {
    const empty = pageCount(tree) === 1 && getPage(tree, tree.rootId).keys.length === 0;
    return {
      tree,
      frames: [
        idle(
          empty
            ? 'Empty tree: one leaf page, which is also the root.'
            : `${shape(tree)} Choose an operation.`,
        ),
      ],
    };
  }

  const frames: Frame[] = [];
  const queued = ops.filter((op) => op.type === 'insert' && op.summary);
  if (queued.length > 0) {
    const keys = queued.map((op) => (op.type === 'insert' ? op.key : 0));
    frames.push(idle(`${plural(keys.length, 'insert')} queued: ${list(keys)}. One step each.`));
  }

  let current = tree;
  for (const op of ops) {
    if (op.type === 'insert') {
      const result = insert(current, op.key);
      if (op.summary) {
        frames.push({
          ...result.frames[result.frames.length - 1]!,
          tree: result.tree,
          step: 'done',
          active: result.touched,
          message: result.summary,
        });
      } else frames.push(...result.frames);
      current = result.tree;
    } else if (op.type === 'search') {
      frames.push(...search(current, op.key).frames);
    } else {
      frames.push(...rangeScan(current, op.from, op.to).frames);
    }
  }
  return { frames, tree: current };
}

/** Distinct keys in [1, maxKey] that the tree does not hold yet, in a seeded order. */
export function randomKeys(tree: Tree, count: number, rng: Rng, maxKey: number): number[] {
  const taken = new Set(allKeys(tree));
  const free: number[] = [];
  for (let key = 1; key <= maxKey; key += 1) if (!taken.has(key)) free.push(key);
  return shuffle(free, rng).slice(0, count);
}

/** The next keys above the largest one: what a serial id or a timestamp produces. */
export function ascendingKeys(tree: Tree, count: number, maxKey: number): number[] {
  const keys = allKeys(tree);
  const start = keys.length > 0 ? Math.max(...keys) + 1 : 1;
  const out: number[] = [];
  for (let key = start; key <= maxKey && out.length < count; key += 1) out.push(key);
  return out;
}
