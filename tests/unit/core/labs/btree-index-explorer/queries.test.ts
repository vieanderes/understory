import { describe, expect, it } from 'vitest';
import {
  checkInvariants,
  DEFAULT_SCENARIO_ID,
  KEY_LIMIT,
  allKeys,
  height,
  pageCount,
  planQuery,
  QUERIES,
  queryById,
  run,
  scenarioById,
  SCENARIOS,
  scenarioTree,
} from '@/core/labs/btree-index-explorer';

const plan = (queryId: string, indexId: string, rows = 1_000_000, covering = false) =>
  planQuery({ queryId, indexId, rows, covering });

describe('query catalogue', () => {
  it('offers the six queries, each with "no index" first and unique option ids', () => {
    expect(QUERIES.map((q) => q.id)).toEqual([
      'by-id',
      'event-paid',
      'paid',
      'lower-email',
      'event-newest',
      'like-suffix',
    ]);
    for (const query of QUERIES) {
      expect(query.indexes[0]!.id).toBe('none');
      expect(new Set(query.indexes.map((i) => i.id)).size).toBe(query.indexes.length);
    }
  });

  it('falls back to the first query and to "no index" for unknown ids', () => {
    expect(queryById('nope').id).toBe('by-id');
    expect(plan('by-id', 'nope').verdict.chosen).toBe('Seq Scan on orders');
  });
});

describe('planQuery', () => {
  it('uses the primary key for a lookup by id', () => {
    const result = plan('by-id', 'pkey');
    expect(result.verdict.chosen).toBe('Index Scan using orders_pkey on orders');
    expect(result.verdict.rejected).toBe('Seq Scan on orders');
    expect(result.cost.index!.pages).toBe(5);
    expect(result.verdict.reason).toMatch(/3 pages.*1 leaf page.*1 heap fetch/);
  });

  it('scans when there is no index at all', () => {
    const result = plan('by-id', 'none');
    expect(result.verdict.chosen).toBe('Seq Scan on orders');
    expect(result.verdict.rejected).toBeNull();
    expect(result.verdict.reason).toMatch(/No index/);
  });

  it('ignores an index on status when nine rows in ten are paid', () => {
    const result = plan('paid', 'status');
    expect(result.verdict.chosen).toBe('Seq Scan on orders');
    expect(result.verdict.rejected).toBe('Index Scan using orders_status_idx on orders');
    expect(result.verdict.reason).toMatch(/900,000 matching rows/);
    expect(result.verdict.reason).toMatch(/rightly ignores/);
  });

  it('serves two equalities with either column order, but not with the unselective column alone', () => {
    expect(plan('event-paid', 'event-status').cost.plan).toBe('index-scan');
    expect(plan('event-paid', 'status-event').cost).toEqual(
      plan('event-paid', 'event-status').cost,
    );
    expect(plan('event-paid', 'status').cost.plan).toBe('seq-scan');
  });

  it('cannot use a plain index for lower(email), and can use an expression index', () => {
    const plain = plan('lower-email', 'email');
    expect(plain.cost.index).toBeNull();
    expect(plain.verdict.chosen).toBe('Seq Scan on orders');
    expect(plain.verdict.reason).toMatch(/lower\(email\)/);
    const expression = plan('lower-email', 'lower-email');
    expect(expression.verdict.chosen).toBe('Index Scan using orders_lower_email_idx on orders');
  });

  it('cannot descend with a pattern that starts with a wildcard', () => {
    const result = plan('like-suffix', 'email');
    expect(result.cost.index).toBeNull();
    expect(result.verdict.reason).toMatch(/wildcard/);
  });

  it('reads the newest 20 straight off (shop_id, created_at), backwards', () => {
    const result = plan('event-newest', 'event-created');
    expect(result.verdict.chosen).toBe(
      'Index Scan Backward using orders_shop_created_idx on orders',
    );
    expect(result.cost.index).toMatchObject({ entriesWalked: 20, leafPages: 1, heapFetches: 20 });
  });

  it('pays for the wrong column order: (created_at, shop_id) walks past every other shop', () => {
    const right = plan('event-newest', 'event-created');
    const wrong = plan('event-newest', 'created-event');
    expect(wrong.cost.index!.entriesWalked).toBe(10_000);
    expect(wrong.cost.index!.cost).toBeGreaterThan(right.cost.index!.cost);
    expect(wrong.verdict.reason).toMatch(/10,000 entries/);
  });

  it('switches to an index-only scan when the query needs only indexed columns', () => {
    const result = plan('event-paid', 'event-status', 1_000_000, true);
    expect(result.verdict.chosen).toBe('Index Only Scan using orders_shop_status_idx on orders');
    expect(result.cost.index!.heapFetches).toBe(0);
    expect(result.verdict.reason).toMatch(/no heap fetches/);
  });

  it('prefers the scan on a small table even for one row', () => {
    const result = plan('by-id', 'pkey', 1_000);
    expect(result.verdict.chosen).toBe('Seq Scan on orders');
    expect(result.verdict.reason).toMatch(/1 matching row\b/);
  });

  it('reports the crossover for the chosen index', () => {
    expect(plan('paid', 'status').crossover).toBeGreaterThan(0.002);
    expect(plan('paid', 'none').crossover).toBeNull();
  });
});

describe('scenarios', () => {
  it('ships five, from the plain lookup to the ones that surprise', () => {
    expect(SCENARIOS.map((s) => s.name)).toEqual([
      'Lookup by order id',
      'A full page splits',
      'Orders for one shop, newest first',
      'Everything that is paid',
      'Email search with lower()',
    ]);
    expect(scenarioById('nope').id).toBe(DEFAULT_SCENARIO_ID);
  });

  it('gives each a prediction prompt, a sound tree, a program and a valid query', () => {
    for (const scenario of SCENARIOS) {
      expect(scenario.prompt).toMatch(/^Before you step: .+\?$/);
      const tree = scenarioTree(scenario);
      expect(checkInvariants(tree)).toEqual([]);
      expect(allKeys(tree).length).toBeLessThanOrEqual(KEY_LIMIT);
      expect(run(tree, scenario.ops).frames.length).toBeGreaterThan(3);
      expect(run(tree, scenario.ops).frames[0]!.step).toBe('start');
      const query = queryById(scenario.queryId);
      expect(query.id).toBe(scenario.queryId);
      expect(query.indexes.map((i) => i.id)).toContain(scenario.indexId);
    }
  });

  it('the lookup prompt states the tree as it is', () => {
    const tree = scenarioTree(scenarioById('lookup-by-id'));
    expect([allKeys(tree).length, pageCount(tree), height(tree)]).toEqual([24, 11, 3]);
    expect(scenarioById('lookup-by-id').prompt).toContain('24 order ids sit on 11 pages, three');
  });

  it('the split scenario grows the tree from two levels to three', () => {
    const scenario = scenarioById('page-splits');
    const { frames } = run(scenarioTree(scenario), scenario.ops);
    expect(frames.map((f) => f.step)).toContain('split-internal');
    expect(frames.map((f) => f.step)).toContain('new-root');
  });

  it('the paid scenario walks the whole leaf chain and the planner ignores the index', () => {
    const scenario = scenarioById('all-paid');
    const tree = scenarioTree(scenario);
    const { frames } = run(tree, scenario.ops);
    const leaves = Object.values(tree.pages).filter((p) => p.kind === 'leaf').length;
    expect(frames.filter((f) => f.step === 'scan-leaf')).toHaveLength(leaves);
    expect(
      planQuery({
        queryId: scenario.queryId,
        indexId: scenario.indexId,
        rows: scenario.rows,
        covering: false,
      }).cost.plan,
    ).toBe('seq-scan');
  });
});
