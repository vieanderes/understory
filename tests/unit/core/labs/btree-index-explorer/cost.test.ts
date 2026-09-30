import { describe, expect, it } from 'vitest';
import {
  costCurve,
  crossoverSelectivity,
  indexHeight,
  RANDOM_PAGE_COST,
  scanCost,
  SEQ_PAGE_COST,
  type ScanCostInput,
} from '@/core/labs/btree-index-explorer';

const base: ScanCostInput = {
  rows: 1_000_000,
  rowsPerPage: 100,
  fanout: 300,
  selectivity: 1 / 1_000_000,
  indexUsable: true,
  covering: false,
};

describe('indexHeight', () => {
  it('is the logarithm of the row count in base fanout, rounded up, and at least 1', () => {
    expect(indexHeight(1, 300)).toBe(1);
    expect(indexHeight(300, 300)).toBe(1);
    expect(indexHeight(301, 300)).toBe(2);
    expect(indexHeight(90_000, 300)).toBe(2);
    expect(indexHeight(1_000_000, 300)).toBe(3);
    // Exact powers must not tip over through floating point.
    expect(indexHeight(200 ** 3, 200)).toBe(3);
  });
});

describe('scanCost', () => {
  it('uses the PostgreSQL planner defaults', () => {
    expect(SEQ_PAGE_COST).toBe(1);
    expect(RANDOM_PAGE_COST).toBe(4);
  });

  it('charges a sequential scan every heap page, in order', () => {
    const cost = scanCost(base);
    expect(cost.seq).toEqual({ pages: 10_000, cost: 10_000 });
    expect(scanCost({ ...base, rows: 1_050 }).seq.pages).toBe(11);
  });

  it('charges a point lookup the height, one leaf and one heap fetch, all random', () => {
    const cost = scanCost(base);
    expect(cost.matchingRows).toBe(1);
    expect(cost.index).toEqual({
      height: 3,
      entriesWalked: 1,
      leafPages: 1,
      heapFetches: 1,
      pages: 5,
      cost: 20,
    });
    expect(cost.plan).toBe('index-scan');
  });

  it('charges one random heap fetch per matching row, so a wide match loses to the scan', () => {
    const cost = scanCost({ ...base, selectivity: 0.9 });
    expect(cost.matchingRows).toBe(900_000);
    expect(cost.index).toMatchObject({ leafPages: 3_000, heapFetches: 900_000 });
    expect(cost.index!.cost).toBe((3 + 3_000 + 900_000) * 4);
    expect(cost.plan).toBe('seq-scan');
  });

  it('has a crossover: below it the index wins, above it the scan wins', () => {
    const at = crossoverSelectivity(base);
    expect(at).not.toBeNull();
    // 4 x s x N x (1 + 1/fanout) = N / rowsPerPage, so s is a little under 1 in 400.
    expect(at!).toBeGreaterThan(0.0024);
    expect(at!).toBeLessThan(0.0025);
    expect(scanCost({ ...base, selectivity: at! * 0.9 }).plan).toBe('index-scan');
    expect(scanCost({ ...base, selectivity: at! * 1.1 }).plan).toBe('seq-scan');
  });

  it('skips the heap for a covering index: an index-only scan', () => {
    const cost = scanCost({ ...base, selectivity: 0.1, covering: true });
    expect(cost.index).toMatchObject({ heapFetches: 0, leafPages: 334, pages: 337 });
    expect(cost.plan).toBe('index-only-scan');
    // The same match without covering is far past the crossover.
    expect(scanCost({ ...base, selectivity: 0.1 }).plan).toBe('seq-scan');
    // Covering moves the crossover, it does not remove it.
    const at = crossoverSelectivity({ ...base, covering: true });
    expect(at!).toBeGreaterThan(0.5);
    expect(at!).toBeLessThan(1);
    expect(scanCost({ ...base, selectivity: 1, covering: true }).plan).toBe('seq-scan');
  });

  it('never picks an index that cannot serve the predicate', () => {
    const cost = scanCost({ ...base, indexUsable: false });
    expect(cost.index).toBeNull();
    expect(cost.plan).toBe('seq-scan');
    expect(crossoverSelectivity({ ...base, indexUsable: false })).toBeNull();
  });

  it('prefers the scan on a table of a few pages', () => {
    const cost = scanCost({ ...base, rows: 1_000, selectivity: 1 / 1_000 });
    expect(cost.seq.cost).toBe(10);
    expect(cost.index!.cost).toBe(16);
    expect(cost.plan).toBe('seq-scan');
    expect(crossoverSelectivity({ ...base, rows: 1_000 })).toBeNull();
  });

  it('still reads one leaf when nothing matches', () => {
    const cost = scanCost({ ...base, selectivity: 0 });
    expect(cost.matchingRows).toBe(0);
    expect(cost.index).toMatchObject({ leafPages: 1, heapFetches: 0 });
  });

  it('clamps a selectivity outside 0 to 1', () => {
    expect(scanCost({ ...base, selectivity: 7 }).matchingRows).toBe(1_000_000);
    expect(scanCost({ ...base, selectivity: -1 }).matchingRows).toBe(0);
  });

  describe('ORDER BY with LIMIT', () => {
    const newest: ScanCostInput = { ...base, selectivity: 1 / 500, limit: 20 };

    it('stops after the limit when the index leads with the filtered column', () => {
      const cost = scanCost(newest);
      expect(cost.matchingRows).toBe(2_000);
      expect(cost.index).toMatchObject({ entriesWalked: 20, leafPages: 1, heapFetches: 20 });
      expect(cost.plan).toBe('index-scan');
    });

    it('walks past the entries of every other value when the filter column comes second', () => {
      const cost = scanCost({ ...newest, filterLeads: false });
      // One match in 500 entries, 20 matches wanted.
      expect(cost.index).toMatchObject({ entriesWalked: 10_000, leafPages: 34, heapFetches: 20 });
      expect(cost.index!.cost).toBeGreaterThan(scanCost(newest).index!.cost);
    });

    it('walks the whole index when fewer rows match than the limit asks for', () => {
      const rare = scanCost({ ...newest, selectivity: 5 / 1_000_000, filterLeads: false });
      expect(rare.index).toMatchObject({ entriesWalked: 1_000_000, heapFetches: 5 });
      expect(rare.plan).toBe('seq-scan');
      expect(crossoverSelectivity({ ...newest, filterLeads: false })).not.toBeNull();
    });
  });
});

describe('costCurve', () => {
  it('samples both plans from one row to every row on a logarithmic axis', () => {
    const curve = costCurve(base, 25);
    expect(curve).toHaveLength(25);
    expect(curve[0]!.selectivity).toBeCloseTo(1 / base.rows, 12);
    expect(curve[24]!.selectivity).toBe(1);
    expect(curve.every((p) => p.seqCost === 10_000)).toBe(true);
    const index = curve.map((p) => p.indexCost!);
    expect(index.every((c, i) => i === 0 || c >= index[i - 1]!)).toBe(true);
  });

  it('has no index line when the index is unusable', () => {
    expect(costCurve({ ...base, indexUsable: false }, 5).every((p) => p.indexCost === null)).toBe(
      true,
    );
  });
});
