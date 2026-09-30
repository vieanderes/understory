import { allFinished } from './engine';
import { committedTables } from './mvcc';
import { compare, matches } from './predicate';
import { run } from './run';
import type { EngineState, Outcome, Row, Scenario, Statement, TxId, Value } from './types';
import { TX_IDS } from './types';

export type Anomaly =
  'non-repeatable-read' | 'phantom-read' | 'lost-update' | 'write-skew' | 'not-serialisable';

/** What the application saw of one statement. Waiting is not part of it. */
export interface Observation {
  readonly status: Outcome['status'];
  readonly rows?: readonly Row[];
  readonly count?: number;
  readonly sqlstate?: string;
}

export interface SerialOutcome {
  readonly order: readonly TxId[];
  readonly tables: Readonly<Record<string, readonly Row[]>>;
  readonly observed: Readonly<Record<TxId, readonly Observation[]>>;
}

export interface SerialComparison extends SerialOutcome {
  /** Same final state, and every committed transaction saw the same results. */
  readonly same: boolean;
  readonly sameTables: boolean;
}

export interface InvariantResult {
  readonly label: string;
  readonly holds: boolean;
  readonly actual: number;
}

export interface Verdict {
  readonly tables: Readonly<Record<string, readonly Row[]>>;
  readonly committed: readonly TxId[];
  readonly serial: readonly SerialComparison[];
  readonly serialisable: boolean;
  readonly anomaly: Anomaly | null;
  readonly invariant: InvariantResult | null;
}

export function observations(state: EngineState, tx: TxId): Observation[] {
  return state.txs[tx].outcomes.map((o) => ({
    status: o.status,
    ...(o.rows ? { rows: o.rows } : {}),
    ...(o.count !== undefined ? { count: o.count } : {}),
    ...(o.error ? { sqlstate: o.error.sqlstate } : {}),
  }));
}

function serialOrders(txs: readonly TxId[]): TxId[][] {
  if (txs.length < 2) return [[...txs]];
  return [
    [1, 2],
    [2, 1],
  ];
}

/**
 * Runs the transactions one after the other, with no overlap: the executions that define
 * "serialisable". Called with no second argument it computes both orders of T1 and T2;
 * the verdict passes the transactions that committed, because a transaction that rolled
 * back took part in no serial order. The isolation level cannot matter here.
 */
export function serialOutcomes(scenario: Scenario, txs: readonly TxId[] = TX_IDS): SerialOutcome[] {
  const only: Scenario = {
    ...scenario,
    scripts: {
      1: txs.includes(1) ? scenario.scripts[1] : [{ kind: 'begin' }, { kind: 'rollback' }],
      2: txs.includes(2) ? scenario.scripts[2] : [{ kind: 'begin' }, { kind: 'rollback' }],
    },
  };
  return serialOrders(txs).map((order) => {
    const first = order[0] ?? 1;
    const second: TxId = first === 1 ? 2 : 1;
    const schedule = [
      ...only.scripts[first].map(() => first),
      ...only.scripts[second].map(() => second),
    ];
    const frames = run(only, 'read-committed', schedule).frames;
    const end = frames[frames.length - 1] as EngineState;
    return {
      order,
      tables: committedTables(scenario.tables, end.versions, end.clog),
      observed: { 1: observations(end, 1), 2: observations(end, 2) },
    };
  });
}

function same(a: unknown, b: unknown): boolean {
  return JSON.stringify(a) === JSON.stringify(b);
}

function sameKeys(a: readonly Value[], b: readonly Value[]): boolean {
  return same([...a].sort(), [...b].sort());
}

/**
 * Names the anomaly, in the vocabulary of Berenson et al. 1995: P2 non-repeatable (fuzzy)
 * read and P3 phantom when one transaction repeats a read and gets another answer; P4
 * lost update when both committed a write to the same row; A5B write skew when they
 * wrote different rows after reading what the other wrote.
 */
function classify(scenario: Scenario, state: EngineState, committed: readonly TxId[]): Anomaly {
  for (const tx of committed) {
    const script = scenario.scripts[tx];
    const outcomes = state.txs[tx].outcomes;
    for (let i = 0; i < script.length; i += 1) {
      for (let j = i + 1; j < script.length; j += 1) {
        const a = outcomes[i];
        const b = outcomes[j];
        if (!same(script[i], script[j]) || !a?.keys || !b?.keys) continue;
        if (!sameKeys(a.keys, b.keys)) return 'phantom-read';
        if (!same(a.rows, b.rows)) return 'non-repeatable-read';
      }
    }
  }
  const wrote = (tx: TxId) =>
    state.writes.filter((w) => w.tx === tx).map((w) => `${w.table}/${String(w.key)}`);
  if (committed.length === 2) {
    const second = wrote(2);
    if (wrote(1).some((id) => second.includes(id))) return 'lost-update';
    if (wrote(1).length > 0 && second.length > 0) return 'write-skew';
  }
  return 'not-serialisable';
}

/** The verdict on a finished run. Null while a transaction is still open. */
export function verdict(scenario: Scenario, state: EngineState): Verdict | null {
  if (!allFinished(state)) return null;
  const committed = TX_IDS.filter((tx) => state.txs[tx].status === 'committed');
  const tables = committedTables(scenario.tables, state.versions, state.clog);
  const serial = serialOutcomes(scenario, committed).map((outcome) => {
    const sameTables = same(outcome.tables, tables);
    const sameReads = committed.every((tx) => same(outcome.observed[tx], observations(state, tx)));
    return { ...outcome, sameTables, same: sameTables && sameReads };
  });
  const serialisable = serial.some((s) => s.same);
  const rule = scenario.invariant;
  const actual = rule ? (tables[rule.table] ?? []).filter((r) => matches(rule.where, r)).length : 0;
  return {
    tables,
    committed,
    serial,
    serialisable,
    anomaly: serialisable ? null : classify(scenario, state, committed),
    invariant: rule
      ? { label: rule.label, holds: compare(actual, rule.op, rule.value), actual }
      : null,
  };
}

/** True when two statements are the same SQL, which is what "reads it again" means. */
export function sameStatement(a: Statement, b: Statement): boolean {
  return same(a, b);
}
