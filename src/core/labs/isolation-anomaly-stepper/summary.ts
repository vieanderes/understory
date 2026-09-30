import { committedTables } from './mvcc';
import type { Built, ScriptLine } from './scenarios';
import type { EngineState, Level, Outcome, Row, TableSchema, TxId, Value } from './types';
import { observations, type Anomaly, type SerialComparison, type Verdict } from './verdict';

/*
 * The lab in words. A learner who cannot see the diagram, or who is reading the status
 * line with a screen reader, gets the same account of what happened.
 *
 * The level notes paraphrase PostgreSQL's documentation 13.2.1, 13.2.2 and 13.2.3.
 */

export const LEVEL_LABEL: Record<Level, string> = {
  'read-committed': 'READ COMMITTED',
  'repeatable-read': 'REPEATABLE READ',
  serializable: 'SERIALIZABLE',
};

export const LEVEL_NOTE: Record<Level, string> = {
  'read-committed':
    'Every statement takes a new snapshot. A write that waits on a row lock re-evaluates its WHERE clause against the newest committed version after the wait.',
  'repeatable-read':
    'One snapshot for the whole transaction, taken by its first query. A write to a row that a concurrent transaction changed and committed fails with SQLSTATE 40001.',
  serializable:
    'The repeatable read snapshot, plus detection of the dangerous read-write dependency structure. One of the two transactions fails with SQLSTATE 40001.',
};

export const ANOMALY_LABEL: Record<Anomaly, string> = {
  'non-repeatable-read': 'non-repeatable read',
  'phantom-read': 'phantom read',
  'lost-update': 'lost update',
  'write-skew': 'write skew',
  'not-serialisable': 'no serial order',
};

/** `id 1, balance 60`: the columns of a row, in the order the row carries them. */
export function rowText(row: Row): string {
  return Object.entries(row)
    .map(([col, value]) => `${col} ${String(value)}`)
    .join(', ');
}

/** What one statement returned: `balance 100`, `count 2`, `changed 1 row`. */
export function resultText(line: ScriptLine, outcome: Outcome): string {
  const stmt = line.stmt;
  if (stmt.kind === 'select') {
    if (stmt.columns === 'count') return `count ${outcome.count ?? 0}`;
    const rows = outcome.rows ?? [];
    if (rows.length === 0) return 'no rows';
    if (rows.length === 1) return rowText(rows[0] as Row);
    return `${rows.length} rows`;
  }
  const count = outcome.count ?? 0;
  const noun = count === 1 ? '1 row' : `${count} rows`;
  if (stmt.kind === 'insert') return `inserted ${noun}`;
  return count === 0 ? 'changed no rows' : `changed ${noun}`;
}

function oneLine(sql: string): string {
  return sql.replace(/\s+/g, ' ').trim();
}

/** One sentence for one statement: what it saw, what it waits for, how it failed. */
export function sawText(line: ScriptLine, outcome: Outcome | undefined): string {
  if (!outcome) return 'Not run yet.';
  if (outcome.status === 'skipped') return 'The application did not send it.';
  if (outcome.status === 'ignored') {
    return 'It was ignored: the transaction is aborted until it ends.';
  }
  if (outcome.status === 'blocked') {
    const on = outcome.waitingOn;
    if (!on) return 'It waits for a row lock.';
    return `It waits for T${on.holder} to release the lock on ${on.table} ${on.column} ${String(on.key)}.`;
  }
  if (outcome.status === 'failed') {
    const error = outcome.error;
    return error ? `It failed with SQLSTATE ${error.sqlstate}: ${error.message}.` : 'It failed.';
  }
  const kind = line.stmt.kind;
  if (kind === 'begin') return 'The transaction is open. Its snapshot is taken by the first query.';
  if (kind === 'rollback') return 'The transaction rolled back.';
  if (kind === 'commit') {
    return outcome.rolledBack
      ? 'The transaction was already aborted, so COMMIT rolled it back.'
      : 'The transaction committed.';
  }
  const result = resultText(line, outcome);
  if (outcome.waitedFor === undefined) {
    return kind === 'select' ? `It saw ${result}.` : `It ${result}.`;
  }
  // 13.2.1: after the wait, READ COMMITTED re-evaluates the WHERE clause against the
  // newest committed version of the row.
  const waited = `It waited for T${outcome.waitedFor}`;
  if ((outcome.rechecks ?? []).some((r) => !r.kept)) {
    return `${waited}, then found that the newest version no longer matched the WHERE clause, so it ${result}.`;
  }
  return kind === 'select'
    ? `${waited}, then read the newest version and saw ${result}.`
    : `${waited}, then re-read the row and ${result}.`;
}

/** The status line: what the last step did, and what it set off. */
export function stepStatus(built: Built, state: EngineState): string {
  const last = state.last;
  const line = last ? built.lines[last.tx][last.statement] : undefined;
  if (!last || !line) return 'Nothing has run yet. Choose which transaction runs next.';
  const outcome = state.txs[last.tx].outcomes[last.statement];
  const parts = [`T${last.tx} ran ${oneLine(line.sql)}`, sawText(line, outcome)];
  const woke = last.woke;
  if (woke) {
    const woken = built.lines[woke.tx][woke.statement];
    parts.push(`T${woke.tx} stopped waiting and ran its statement.`);
    if (woken) parts.push(sawText(woken, state.txs[woke.tx].outcomes[woke.statement]));
  }
  if (last.doomed) {
    parts.push(
      `T${last.doomed} is now marked to fail: the other transaction committed first and the read-write dependencies form the dangerous structure.`,
    );
  }
  return parts.join(' ');
}

function orderLabel(order: readonly TxId[]): string {
  if (order.length === 0) return 'Neither transaction';
  if (order.length === 1) return `T${order[0]} alone`;
  return `T${order[0]} then T${order[1]}`;
}

/** `Same as running T1 then T2.`, or the name of the anomaly. */
export function verdictHeadline(v: Verdict): string {
  if (!v.serialisable) {
    const anomaly = v.anomaly ?? 'not-serialisable';
    return `Neither serial order gives this. Anomaly: ${ANOMALY_LABEL[anomaly]}.`;
  }
  const matches = v.serial.filter((s) => s.same);
  const first = matches[0];
  if (!first) return 'Serialisable.';
  if (matches.length > 1) return 'Same as either serial order. Serialisable.';
  return `Same as running ${orderLabel(first.order)}. Serialisable.`;
}

/** The rows of `serial` that differ from `actual`, named by their key. */
function differences(
  tables: readonly TableSchema[],
  serial: Readonly<Record<string, readonly Row[]>>,
  actual: Readonly<Record<string, readonly Row[]>>,
): string {
  const parts: string[] = [];
  for (const table of tables) {
    const mine = serial[table.name] ?? [];
    const theirs = actual[table.name] ?? [];
    const lines: string[] = [];
    for (const row of mine) {
      const match = theirs.find((r) => r[table.key] === row[table.key]);
      if (!match) {
        lines.push(rowText(row));
        continue;
      }
      const changed = Object.keys(row).filter((col) => row[col] !== match[col]);
      if (changed.length === 0) continue;
      const key = `${table.key} ${String(row[table.key])}`;
      lines.push([key, ...changed.map((c) => `${c} ${String(row[c])}`)].join(', '));
    }
    for (const row of theirs) {
      if (!mine.some((r) => r[table.key] === row[table.key])) {
        lines.push(`no ${table.key} ${String(row[table.key])}`);
      }
    }
    if (lines.length > 0) parts.push(`${table.name}: ${lines.join('; ')}`);
  }
  return parts.join('; ');
}

/** How one serial order compares with the run the learner just watched. */
export function serialText(built: Built, state: EngineState, s: SerialComparison): string {
  const label = orderLabel(s.order);
  if (s.same) return `${label} gives exactly this run.`;
  if (s.sameTables) {
    const differing = s.order.filter(
      (tx) => JSON.stringify(s.observed[tx]) !== JSON.stringify(observations(state, tx)),
    );
    const who = differing.length > 0 ? differing.map((tx) => `T${tx}`).join(' and ') : 'it';
    return `${label} leaves the same rows, but ${who} would have read different results.`;
  }
  const actual = committedTables(built.scenario.tables, state.versions, state.clog);
  return `${label} leaves ${differences(built.scenario.tables, s.tables, actual)}.`;
}

/** What the application saw, and what it has to do about a serialisation failure. */
export function applicationLine(built: Built, state: EngineState, tx: TxId): string {
  const t = state.txs[tx];
  const lines = built.lines[tx];
  const failure = t.outcomes.find((o) => o.status === 'failed' && o.error);
  if (failure?.error) {
    const retry =
      failure.error.sqlstate === '40001'
        ? ' The application has to retry the whole transaction.'
        : '';
    return `T${tx} was rolled back with SQLSTATE ${failure.error.sqlstate}.${retry}`;
  }
  const readings = t.outcomes
    .map((outcome, i) => ({ outcome, line: lines[i] }))
    .filter((p) => p.line?.stmt.kind === 'select' && p.outcome.status === 'done')
    .map((p) => resultText(p.line as ScriptLine, p.outcome));
  const head = t.status === 'committed' ? `T${tx} committed.` : `T${tx} rolled back.`;
  return readings.length === 0 ? head : `${head} It saw ${readings.join(', then ')}.`;
}

/** The scenario's rule over the committed state, once the run is over. */
export function invariantText(v: Verdict): string | null {
  if (!v.invariant) return null;
  const { label, holds, actual } = v.invariant;
  return `${holds ? 'Holds' : 'Broken'}: ${label}. The count is ${actual}.`;
}

/** Every value of a row, as the database column order, for the committed state table. */
export function tableValues(schema: TableSchema, row: Row): readonly Value[] {
  return schema.columns.map((col) => row[col] as Value);
}
