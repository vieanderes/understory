/*
 * Named starting points, from the plain lookup to the cases that surprise. Each pairs a
 * program for the tree of part one with a query for the cost model of part two.
 */
import { createTree, insertAll, type ProgramOp, type Tree } from './btree';

/** Keys are 1 to 999 so a key fits one cell of the diagram. */
export const MAX_KEY = 999;
/** The most keys the lab tree holds: beyond this the diagram stops explaining. */
export const KEY_LIMIT = 40;

export interface Scenario {
  readonly id: string;
  readonly name: string;
  /** Asked before the first step: predicting first is what makes the lab teach. */
  readonly prompt: string;
  /** Inserted in this order, without frames, to build the starting tree. */
  readonly seedKeys: readonly number[];
  readonly ops: readonly ProgramOp[];
  readonly queryId: string;
  readonly indexId: string;
  readonly rows: number;
}

// Order ids as they reached the index: not sorted, so the leaves
// fill unevenly, as they do in a real table.
const ORDERS = [
  412, 87, 655, 230, 901, 344, 518, 129, 776, 263, 590, 48, 837, 471, 702, 195, 333, 624, 958, 156,
  389, 731, 67, 546,
];

export const SCENARIOS: readonly Scenario[] = [
  {
    id: 'lookup-by-id',
    name: 'Lookup by order id',
    prompt:
      'Before you step: 24 order ids sit on 11 pages, three levels deep. How many pages does finding 471 read?',
    seedKeys: ORDERS,
    ops: [{ type: 'search', key: 471 }],
    queryId: 'by-id',
    indexId: 'pkey',
    rows: 1_000_000,
  },
  {
    id: 'page-splits',
    name: 'A full page splits',
    prompt:
      'Before you step: the last leaf and the root are both full. What happens to the height when 130 arrives?',
    seedKeys: [10, 20, 30, 40, 50, 60, 70, 80, 90, 100, 110, 120],
    ops: [{ type: 'insert', key: 130 }],
    queryId: 'by-id',
    indexId: 'pkey',
    rows: 1_000_000,
  },
  {
    id: 'event-newest',
    name: 'Orders for one shop, newest first',
    prompt:
      'Before you step: the entries of one shop sit side by side in the leaves. How often does the scan start again from the root?',
    seedKeys: ORDERS,
    ops: [{ type: 'range', from: 300, to: 520 }],
    queryId: 'event-newest',
    indexId: 'event-created',
    rows: 1_000_000,
  },
  {
    id: 'all-paid',
    name: 'Everything that is paid',
    prompt:
      'Before you step: nine orders in ten are paid, and status has an index. Will the planner use it?',
    seedKeys: ORDERS,
    ops: [{ type: 'range', from: 1, to: MAX_KEY }],
    queryId: 'paid',
    indexId: 'status',
    rows: 1_000_000,
  },
  {
    id: 'lower-email',
    name: 'Email search with lower()',
    prompt:
      'Before you step: email has an index. Does WHERE lower(email) = ? descend it, as this lookup descends the tree?',
    seedKeys: ORDERS,
    ops: [{ type: 'search', key: 500 }],
    queryId: 'lower-email',
    indexId: 'email',
    rows: 1_000_000,
  },
];

export const DEFAULT_SCENARIO_ID = 'lookup-by-id';

export function scenarioById(id: string): Scenario {
  return SCENARIOS.find((s) => s.id === id) ?? SCENARIOS[0]!;
}

export function scenarioTree(scenario: Scenario): Tree {
  return insertAll(createTree(), scenario.seedKeys);
}
