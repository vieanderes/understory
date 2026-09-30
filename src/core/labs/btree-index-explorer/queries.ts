/*
 * The queries of part two, against the `orders` table of a marketplace with 500 shops, and
 * the indexes a learner can try on each.
 *
 * Sources: PostgreSQL documentation, chapter 11 "Indexes": 11.3 "Multicolumn Indexes"
 * (a B-tree is most efficient with constraints on its leading columns), 11.4 "Indexes
 * and ORDER BY" (an index can return rows in order, forwards or backwards, which with
 * LIMIT avoids the sort and the full read), 11.7 "Indexes on Expressions", 11.9
 * "Index-Only Scans and Covering Indexes", and 11.2 on LIKE: a B-tree serves a pattern
 * only when it is anchored to the start of the string.
 *
 * The verdict line imitates the first line of EXPLAIN output. It is what this model
 * picks, not what a real planner with statistics would print.
 */
import { crossoverSelectivity, scanCost, type ScanCost, type ScanCostInput } from './cost';

/** About 80 bytes a row on an 8 kB heap page. */
export const ROWS_PER_PAGE = 100;
/** About 20 bytes an entry on an 8 kB index page at the default 90% leaf fill. */
export const FANOUT = 300;
/** The marketplace has 500 shops, with orders spread evenly between them. */
const SHOPS = 500;
/** Nine orders in ten are paid; the rest are pending or refunded. */
const PAID = 0.9;

export interface IndexOption {
  readonly id: string;
  /** The indexed columns as they appear in CREATE INDEX. */
  readonly columns: string;
  /** The index name EXPLAIN would print. */
  readonly name: string;
  readonly usable: boolean;
  /** The fraction of rows the index condition narrows the scan to. */
  readonly selectivity: (rows: number) => number;
  readonly filterLeads?: boolean;
  /** Said when the index cannot serve the query, or when it serves it badly. */
  readonly note?: string;
}

export interface QueryDef {
  readonly id: string;
  readonly sql: string;
  /** What the predicate matches, in words. */
  readonly matches: string;
  readonly limit?: number;
  /** The index returns the newest rows first by walking backwards. */
  readonly backward?: boolean;
  readonly indexes: readonly IndexOption[];
}

const none: IndexOption = {
  id: 'none',
  columns: 'No index',
  name: '',
  usable: false,
  selectivity: () => 1,
  note: 'No index covers this predicate, so every heap page is read.',
};

const oneRow = (rows: number): number => 1 / rows;

export const QUERIES: readonly QueryDef[] = [
  {
    id: 'by-id',
    sql: 'WHERE id = ?',
    matches: 'one order',
    indexes: [
      none,
      { id: 'pkey', columns: '(id)', name: 'orders_pkey', usable: true, selectivity: oneRow },
    ],
  },
  {
    id: 'event-paid',
    sql: "WHERE shop_id = ? AND status = 'paid'",
    matches: 'the paid orders of one shop in 500',
    indexes: [
      none,
      {
        id: 'status',
        columns: '(status)',
        name: 'orders_status_idx',
        usable: true,
        selectivity: () => PAID,
        note: 'status alone narrows the table to nine rows in ten, which is no narrowing at all.',
      },
      {
        id: 'event-status',
        columns: '(shop_id, status)',
        name: 'orders_shop_status_idx',
        usable: true,
        selectivity: () => PAID / SHOPS,
      },
      {
        id: 'status-event',
        columns: '(status, shop_id)',
        name: 'orders_status_shop_idx',
        usable: true,
        selectivity: () => PAID / SHOPS,
        note: 'Both columns are compared with =, so either column order descends to the same entries.',
      },
    ],
  },
  {
    id: 'paid',
    sql: "WHERE status = 'paid'",
    matches: 'nine orders in ten',
    indexes: [
      none,
      {
        id: 'status',
        columns: '(status)',
        name: 'orders_status_idx',
        usable: true,
        selectivity: () => PAID,
      },
    ],
  },
  {
    id: 'lower-email',
    sql: 'WHERE lower(email) = ?',
    matches: 'one order',
    indexes: [
      none,
      {
        id: 'email',
        columns: '(email)',
        name: 'orders_email_idx',
        usable: false,
        selectivity: oneRow,
        note: 'The index is sorted by email; the query asks for lower(email). The planner cannot look up the result of a function in an index on the bare column.',
      },
      {
        id: 'lower-email',
        columns: '(lower(email))',
        name: 'orders_lower_email_idx',
        usable: true,
        selectivity: oneRow,
        note: 'An expression index stores lower(email) itself, so the predicate matches the key.',
      },
    ],
  },
  {
    id: 'event-newest',
    sql: 'WHERE shop_id = ? ORDER BY created_at DESC LIMIT 20',
    matches: 'the orders of one shop in 500, newest 20 wanted',
    limit: 20,
    backward: true,
    indexes: [
      none,
      {
        id: 'event-created',
        columns: '(shop_id, created_at)',
        name: 'orders_shop_created_idx',
        usable: true,
        selectivity: () => 1 / SHOPS,
        note: 'The entries of one shop sit together, already sorted by created_at: descend to the last of them and walk back 20 entries. No sort.',
      },
      {
        id: 'created-event',
        columns: '(created_at, shop_id)',
        name: 'orders_created_shop_idx',
        usable: true,
        selectivity: () => 1 / SHOPS,
        filterLeads: false,
        note: 'Sorted by time first, the entries of one shop are scattered over the whole index. The scan walks back from the newest entry and discards all but one in 500.',
      },
    ],
  },
  {
    id: 'like-suffix',
    sql: "WHERE email LIKE '%@example.com'",
    matches: 'about one order in 20',
    indexes: [
      none,
      {
        id: 'email',
        columns: '(email)',
        name: 'orders_email_idx',
        usable: false,
        selectivity: () => 0.05,
        note: 'A B-tree is sorted from the first character. A pattern that starts with a wildcard gives the descent nothing to compare, so the index is no help. A trigram index, or an indexed domain column, would be.',
      },
    ],
  },
];

export function queryById(id: string): QueryDef {
  return QUERIES.find((q) => q.id === id) ?? QUERIES[0]!;
}

export interface Verdict {
  /** The plan this model picks, as the first line of EXPLAIN would name it. */
  readonly chosen: string;
  /** The plan it was weighed against, or null when there was no choice. */
  readonly rejected: string | null;
  readonly reason: string;
}

export interface QueryPlan {
  readonly query: QueryDef;
  readonly index: IndexOption;
  readonly input: ScanCostInput;
  readonly cost: ScanCost;
  readonly crossover: number | null;
  readonly verdict: Verdict;
}

export interface PlanRequest {
  readonly queryId: string;
  readonly indexId: string;
  readonly rows: number;
  /** The query selects only indexed columns. */
  readonly covering: boolean;
}

const figure = (n: number): string => n.toLocaleString('en-GB');
const count = (n: number, one: string, many = `${one}s`): string =>
  `${figure(n)} ${n === 1 ? one : many}`;

export function planQuery(request: PlanRequest): QueryPlan {
  const query = queryById(request.queryId);
  const index = query.indexes.find((i) => i.id === request.indexId) ?? none;
  const input: ScanCostInput = {
    rows: request.rows,
    rowsPerPage: ROWS_PER_PAGE,
    fanout: FANOUT,
    selectivity: index.selectivity(request.rows),
    indexUsable: index.usable,
    covering: request.covering,
    ...(query.limit === undefined ? {} : { limit: query.limit }),
    ...(index.filterLeads === undefined ? {} : { filterLeads: index.filterLeads }),
  };
  const cost = scanCost(input);
  const note = index.note ? ` ${index.note}` : '';
  const seqLine = 'Seq Scan on orders';
  if (cost.index === null) {
    const verdict: Verdict = { chosen: seqLine, rejected: null, reason: note.trim() };
    return { query, index, input, cost, crossover: null, verdict };
  }

  const scanName = `${request.covering ? 'Index Only Scan' : 'Index Scan'}${query.backward ? ' Backward' : ''}`;
  const indexLine = `${scanName} using ${index.name} on orders`;
  const { height, leafPages, heapFetches, entriesWalked } = cost.index;
  const parts = [
    `${count(height, 'page')} to descend`,
    count(leafPages, 'leaf page'),
    heapFetches === 0 ? 'no heap fetches' : count(heapFetches, 'heap fetch', 'heap fetches'),
  ].join(', ');
  const kept = Math.min(query.limit ?? cost.matchingRows, cost.matchingRows);
  const walked =
    index.filterLeads === false
      ? ` It passes ${count(entriesWalked, 'entry', 'entries')} to keep ${figure(kept)}.`
      : '';
  const sums = `${figure(cost.index.cost)} against ${figure(cost.seq.cost)} for reading all ${count(cost.seq.pages, 'heap page')} in order`;
  const verdict: Verdict =
    cost.plan === 'seq-scan'
      ? {
          chosen: seqLine,
          rejected: indexLine,
          reason: `${count(cost.matchingRows, 'matching row')} would cost the index ${parts}, each a random read: ${sums}. The planner rightly ignores the index.${walked}${note}`,
        }
      : {
          chosen: indexLine,
          rejected: seqLine,
          reason: `The index reads ${parts}, each a random read: ${sums}.${walked}${note}`,
        };
  return { query, index, input, cost, crossover: crossoverSelectivity(input), verdict };
}
