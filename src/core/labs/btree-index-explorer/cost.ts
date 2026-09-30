/*
 * A first-order cost model for choosing between a sequential scan and an index scan.
 *
 * Sources:
 *  - PostgreSQL documentation, chapter 11 "Indexes" (11.2 index types, 11.3
 *    multicolumn, 11.7 expressions, 11.9 index-only scans and covering indexes).
 *  - PostgreSQL documentation, chapter "Server Configuration", section "Query Planning",
 *    "Planner Cost Constants": seq_page_cost = 1.0 is the cost of a page read in order,
 *    random_page_cost = 4.0 the cost of a page read out of order. Both defaults are used
 *    here unchanged. The chapter "Using EXPLAIN" shows how they add up to a plan's cost.
 *  - Comer 1979: the height of a B+ tree is the logarithm of the entry count in base
 *    fanout, which is why a lookup in ten million rows reads three or four pages.
 *
 * The model: a sequential scan reads every heap page in order. An index scan reads one
 * page per tree level, the leaf pages that hold the matching entries, and then one heap
 * page per matching row, because the rows an index points at are scattered over the
 * heap. Every page an index scan touches is charged as a random read.
 *
 * What this leaves out, and which way it errs: real heap fetches often land on a page
 * that is already in memory (several matches per page, correlated columns, the buffer
 * cache), the upper tree levels are nearly always cached, a bitmap scan sorts the heap
 * fetches into page order, and the planner adds CPU costs per tuple and works from
 * statistics, not the true selectivity. So the real crossover sits higher than here,
 * usually at a few per cent of the table. The shape is the same: a line that starts far
 * below the scan, rises with every matching row, and crosses it.
 */

export const SEQ_PAGE_COST = 1.0;
export const RANDOM_PAGE_COST = 4.0;

export interface ScanCostInput {
  readonly rows: number;
  /** Heap rows per 8 kB page. */
  readonly rowsPerPage: number;
  /** Index entries per page, and so the branching factor of the tree. */
  readonly fanout: number;
  /** The fraction of rows the predicate matches, 0 to 1. */
  readonly selectivity: number;
  /** False when the predicate cannot be looked up in the index at all. */
  readonly indexUsable: boolean;
  /** True when the index holds every column the query needs: an index-only scan. */
  readonly covering: boolean;
  /**
   * Set for ORDER BY ... LIMIT n where the index returns rows already in that order, so
   * the index scan stops after n rows. The sequential scan cannot stop early: it must
   * see every row to know which n come first.
   */
  readonly limit?: number;
  /**
   * False when the filtered column is not the leading index column. The scan then walks
   * the index in its own order and skips the entries of every other value, so it passes
   * 1 / selectivity entries for each row it keeps. Defaults to true.
   */
  readonly filterLeads?: boolean;
}

export type Plan = 'seq-scan' | 'index-scan' | 'index-only-scan';

export interface IndexCost {
  readonly height: number;
  readonly entriesWalked: number;
  readonly leafPages: number;
  readonly heapFetches: number;
  readonly pages: number;
  readonly cost: number;
}

export interface ScanCost {
  readonly matchingRows: number;
  readonly seq: { readonly pages: number; readonly cost: number };
  readonly index: IndexCost | null;
  readonly plan: Plan;
}

/** Levels of a tree with `rows` entries: log base fanout, rounded up, never below 1. */
export function indexHeight(rows: number, fanout: number): number {
  // Repeated multiplication, not Math.log: an exact power must not round up a level.
  let levels = 1;
  let capacity = fanout;
  while (capacity < rows) {
    capacity *= fanout;
    levels += 1;
  }
  return levels;
}

export function scanCost(input: ScanCostInput): ScanCost {
  const { rows, rowsPerPage, fanout, indexUsable, covering, limit } = input;
  const selectivity = Math.min(1, Math.max(0, input.selectivity));
  const matchingRows = Math.round(selectivity * rows);
  const seqPages = Math.ceil(rows / rowsPerPage);
  const seq = { pages: seqPages, cost: seqPages * SEQ_PAGE_COST };
  if (!indexUsable) return { matchingRows, seq, index: null, plan: 'seq-scan' };

  const returned = limit === undefined ? matchingRows : Math.min(limit, matchingRows);
  const filterLeads = input.filterLeads ?? true;
  // With the filter column second, fewer matches than the limit means the scan never
  // gets to stop: it reaches the end of the index still looking.
  const exhausted = !filterLeads && limit !== undefined && matchingRows <= limit;
  const entriesWalked =
    filterLeads || selectivity === 0
      ? returned
      : exhausted
        ? rows
        : Math.min(rows, Math.ceil(returned / selectivity));
  const height = indexHeight(rows, fanout);
  const leafPages = Math.max(1, Math.ceil(entriesWalked / fanout));
  const heapFetches = covering ? 0 : returned;
  const pages = height + leafPages + heapFetches;
  const index: IndexCost = {
    height,
    entriesWalked,
    leafPages,
    heapFetches,
    pages,
    cost: pages * RANDOM_PAGE_COST,
  };
  const indexWins = index.cost < seq.cost;
  return {
    matchingRows,
    seq,
    index,
    plan: !indexWins ? 'seq-scan' : covering ? 'index-only-scan' : 'index-scan',
  };
}

export interface CurvePoint {
  readonly selectivity: number;
  readonly seqCost: number;
  readonly indexCost: number | null;
}

/** Both costs from one matching row to every row, evenly spaced on a logarithmic axis. */
export function costCurve(input: ScanCostInput, points = 49): CurvePoint[] {
  const low = Math.log10(1 / input.rows);
  return Array.from({ length: points }, (_, i) => {
    const selectivity = i === points - 1 ? 1 : 10 ** (low * (1 - i / (points - 1)));
    const cost = scanCost({ ...input, selectivity });
    return { selectivity, seqCost: cost.seq.cost, indexCost: cost.index?.cost ?? null };
  });
}

/**
 * The selectivity at which both plans cost the same, or null when one plan wins over the
 * whole range from one row to every row. Found by bisection on the logarithmic axis,
 * which needs only that the difference changes sign once.
 */
export function crossoverSelectivity(input: ScanCostInput): number | null {
  const gap = (selectivity: number): number | null => {
    const cost = scanCost({ ...input, selectivity });
    return cost.index === null ? null : cost.index.cost - cost.seq.cost;
  };
  let lo = Math.log10(1 / input.rows);
  let hi = 0;
  const atLo = gap(10 ** lo);
  const atHi = gap(1);
  if (atLo === null || atHi === null || Math.sign(atLo) === Math.sign(atHi)) return null;
  for (let i = 0; i < 60; i += 1) {
    const mid = (lo + hi) / 2;
    if (Math.sign(gap(10 ** mid)!) === Math.sign(atLo)) lo = mid;
    else hi = mid;
  }
  return 10 ** ((lo + hi) / 2);
}
