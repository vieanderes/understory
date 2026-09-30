import { rowId, takeSnapshot, visibleVersions } from './mvcc';
import { compare, matches } from './predicate';
import {
  BOOTSTRAP_XID,
  type CommitStatus,
  type EngineState,
  type Guard,
  type Level,
  type Outcome,
  type Predicate,
  type PredicateRead,
  type Recheck,
  type Row,
  type RwEdge,
  type Scenario,
  type SqlError,
  type Statement,
  type StepReport,
  type TableSchema,
  type TxId,
  type TxState,
  type Value,
  type Version,
  type WriteRecord,
} from './types';

/*
 * The engine. One call to `step` runs the next statement of one transaction, the way one
 * psql session sends one command. Statements are atomic here: the other session never
 * runs in the middle of one. What this leaves out is listed in `run.ts` and in the view.
 */

/** 13.2.2: "ERROR: could not serialize access due to concurrent update", SQLSTATE 40001. */
export const CONCURRENT_UPDATE: SqlError = {
  sqlstate: '40001',
  message: 'could not serialize access due to concurrent update',
};
/** The same failure when the concurrent transaction deleted the row (PostgreSQL 12 and later). */
export const CONCURRENT_DELETE: SqlError = {
  sqlstate: '40001',
  message: 'could not serialize access due to concurrent delete',
};
/** 13.2.3: the SSI failure, also SQLSTATE 40001. */
export const RW_DEPENDENCIES: SqlError = {
  sqlstate: '40001',
  message: 'could not serialize access due to read/write dependencies among transactions',
};
export const DEADLOCK: SqlError = { sqlstate: '40P01', message: 'deadlock detected' };
export const IN_FAILED_TX: SqlError = {
  sqlstate: '25P02',
  message: 'current transaction is aborted, commands ignored until end of transaction block',
};

export function checkViolation(table: string, constraint: string): SqlError {
  return {
    sqlstate: '23514',
    message: `new row for relation "${table}" violates check constraint "${constraint}"`,
  };
}

type SelectStatement = Extract<Statement, { kind: 'select' }>;

/** Mutable while one step is computed, frozen by type once `step` returns it. */
interface DraftTx {
  id: TxId;
  status: TxState['status'];
  pc: number;
  snapshot: readonly number[] | null;
  snapshotStep: number | null;
  vars: Record<string, Value>;
  waiting: TxState['waiting'];
  doomed: boolean;
  outcomes: Outcome[];
}

interface Draft {
  level: Level;
  step: number;
  versions: Version[];
  clog: Record<number, CommitStatus>;
  locks: Record<string, TxId>;
  txs: Record<TxId, DraftTx>;
  reads: PredicateRead[];
  writes: WriteRecord[];
  edges: RwEdge[];
  last: StepReport | null;
}

function other(tx: TxId): TxId {
  return tx === 1 ? 2 : 1;
}

function newTx(id: TxId): TxState {
  return {
    id,
    status: 'idle',
    pc: 0,
    snapshot: null,
    snapshotStep: null,
    vars: {},
    waiting: null,
    doomed: false,
    outcomes: [],
  };
}

function schemaOf(scenario: Scenario, table: string): TableSchema {
  const schema = scenario.tables.find((t) => t.name === table);
  if (!schema) throw new Error(`Unknown table "${table}"`);
  return schema;
}

/**
 * Rejects scenarios the model cannot run faithfully, so a typo fails a test instead of
 * teaching something false.
 */
export function validateScenario(scenario: Scenario): void {
  const keys = new Set<string>();
  const claim = (table: string, row: Row) => {
    const schema = schemaOf(scenario, table);
    const key = row[schema.key];
    if (key === undefined) throw new Error(`Row in "${table}" has no "${schema.key}"`);
    // Unique violations and the waits they cause on INSERT are outside the model.
    if (keys.has(rowId(table, key))) throw new Error(`Duplicate key ${rowId(table, key)}`);
    keys.add(rowId(table, key));
  };
  for (const [table, rows] of Object.entries(scenario.rows)) rows.forEach((r) => claim(table, r));
  for (const tx of [1, 2] as const) {
    const script = scenario.scripts[tx];
    const lastIndex = script.length - 1;
    script.forEach((stmt, i) => {
      const terminal = stmt.kind === 'commit' || stmt.kind === 'rollback';
      if ((i === 0) !== (stmt.kind === 'begin')) throw new Error(`T${tx} must start with BEGIN`);
      if ((i === lastIndex) !== terminal) {
        throw new Error(`T${tx} must end with COMMIT or ROLLBACK, once`);
      }
      if (stmt.kind === 'begin' || terminal) return;
      schemaOf(scenario, stmt.table);
      if (stmt.kind === 'insert') claim(stmt.table, stmt.values);
      // PostgreSQL: "FOR UPDATE is not allowed with aggregate functions" (0A000).
      if (stmt.kind === 'select' && stmt.forUpdate && stmt.columns === 'count') {
        throw new Error('FOR UPDATE is not allowed with aggregate functions');
      }
    });
    if (script.length < 2) throw new Error(`T${tx} needs BEGIN and an end`);
  }
}

export function initialState(scenario: Scenario, level: Level): EngineState {
  validateScenario(scenario);
  const versions: Version[] = [];
  for (const table of scenario.tables) {
    for (const values of scenario.rows[table.name] ?? []) {
      versions.push({
        table: table.name,
        // validateScenario proved the key exists.
        key: values[table.key] as Value,
        values,
        xmin: BOOTSTRAP_XID,
        xmax: null,
      });
    }
  }
  return {
    level,
    step: 0,
    versions,
    clog: { [BOOTSTRAP_XID]: 'committed', 1: 'in-progress', 2: 'in-progress' },
    locks: {},
    txs: { 1: newTx(1), 2: newTx(2) },
    reads: [],
    writes: [],
    edges: [],
    last: null,
  };
}

function draftOf(state: EngineState): Draft {
  const tx = (t: TxState): DraftTx => ({ ...t, vars: { ...t.vars }, outcomes: [...t.outcomes] });
  return {
    level: state.level,
    step: state.step,
    versions: [...state.versions],
    clog: { ...state.clog },
    locks: { ...state.locks },
    txs: { 1: tx(state.txs[1]), 2: tx(state.txs[2]) },
    reads: [...state.reads],
    writes: [...state.writes],
    edges: [...state.edges],
    last: null,
  };
}

export function isFinished(tx: TxState): boolean {
  return tx.status === 'committed' || tx.status === 'rolled-back';
}

/** A transaction can take a step unless it is finished or waiting for a row lock. */
export function canRun(state: EngineState, tx: TxId): boolean {
  const t = state.txs[tx];
  return !isFinished(t) && t.status !== 'blocked';
}

export function allFinished(state: EngineState): boolean {
  return isFinished(state.txs[1]) && isFinished(state.txs[2]);
}

function guardHolds(guard: Guard | undefined, vars: Readonly<Record<string, Value>>): boolean {
  return guard === undefined || compare(vars[guard.var], guard.op, guard.value);
}

/** The application cannot send `SET col = :value` when it never read the value. */
function missingVar(stmt: Statement, vars: Readonly<Record<string, Value>>): boolean {
  if (stmt.kind !== 'update') return false;
  return Object.values(stmt.set).some((e) => e.kind === 'var' && vars[e.name] === undefined);
}

function releaseLocks(d: Draft, tx: TxId): void {
  for (const id of Object.keys(d.locks)) if (d.locks[id] === tx) delete d.locks[id];
}

/**
 * Ports and Grittner, section 3: with snapshot isolation, every non-serialisable
 * execution has a cycle with two adjacent rw-antidependencies. With two transactions the
 * only such cycle is T1 -rw-> T2 -rw-> T1, so the dangerous structure is "both directions
 * exist". Edges that touch an aborted transaction do not count.
 */
function dangerous(d: Draft): boolean {
  const live = d.edges.filter(
    (e) => d.clog[e.reader] !== 'aborted' && d.clog[e.writer] !== 'aborted',
  );
  return live.some((e) => e.reader === 1) && live.some((e) => e.reader === 2);
}

function addEdge(d: Draft, reader: TxId, writer: TxId): void {
  if (!d.edges.some((e) => e.reader === reader && e.writer === writer)) {
    d.edges.push({ reader, writer });
  }
}

function touches(where: Predicate, table: string, w: WriteRecord): boolean {
  if (w.table !== table) return false;
  return (
    (w.before !== null && matches(where, w.before)) || (w.after !== null && matches(where, w.after))
  );
}

/**
 * SSI bookkeeping for a read (Ports and Grittner, section 5.2). PostgreSQL takes SIREAD
 * locks on tuples, pages or whole relations; the lab records the exact predicate instead,
 * so it has none of the false positives of coarse locks. An edge needs two concurrent
 * transactions: a writer whose commit is in the reader's snapshot is simply visible.
 */
function recordRead(
  d: Draft,
  tx: DraftTx,
  snapshot: readonly number[],
  table: string,
  where: Predicate,
): void {
  if (d.level !== 'serializable') return;
  d.reads.push({ tx: tx.id, table, where });
  for (const w of d.writes) {
    if (w.tx === tx.id || d.clog[w.tx] === 'aborted' || snapshot.includes(w.tx)) continue;
    if (touches(where, table, w)) addEdge(d, tx.id, w.tx);
  }
}

/** The mirror image: this write lands in something the other transaction has read. */
function recordWrite(
  d: Draft,
  tx: DraftTx,
  snapshot: readonly number[],
  write: Omit<WriteRecord, 'tx'>,
): void {
  const record = { tx: tx.id, ...write };
  d.writes.push(record);
  if (d.level !== 'serializable') return;
  for (const r of d.reads) {
    // A reader that committed before this snapshot was taken is not concurrent.
    if (r.tx === tx.id || d.clog[r.tx] === 'aborted' || snapshot.includes(r.tx)) continue;
    if (touches(r.where, r.table, record)) addEdge(d, r.tx, tx.id);
  }
}

type WritePlan =
  | { kind: 'blocked'; holder: TxId; table: string; key: Value }
  | { kind: 'error'; error: SqlError }
  | { kind: 'ok'; targets: Version[]; rechecks: Recheck[] };

/**
 * Finds and locks the target rows of UPDATE, DELETE and SELECT FOR UPDATE.
 *
 * 13.2.1 (Read Committed): such a command "will only find target rows that were committed
 * as of the command start time. However, such a target row might have already been
 * updated (or deleted or locked) by another concurrent transaction by the time it is
 * found. In this case, the would-be updater will wait for the first updating transaction
 * to commit or roll back [...]. If the first updater commits, the second updater will
 * ignore the row if the first updater deleted it, otherwise it will attempt to apply its
 * operation to the updated version of the row. The search condition of the command (the
 * WHERE clause) is re-evaluated to see if the updated version of the row still matches."
 *
 * 13.2.2 (Repeatable Read, and Serializable on top of it): "if the first updater commits
 * (and actually updated or deleted the row, not just locked it) then the repeatable read
 * transaction will be rolled back with the message: could not serialize access due to
 * concurrent update". Berenson et al. call this rule First-Committer-Wins; PostgreSQL
 * applies it when the second writer reaches the row, so the first updater wins.
 */
function planWrite(
  d: Draft,
  tx: DraftTx,
  table: string,
  where: Predicate,
  snapshot: readonly number[],
): WritePlan {
  const candidates = visibleVersions(d.versions, table, snapshot, tx.id).filter((v) =>
    matches(where, v.values),
  );
  const targets: Version[] = [];
  const rechecks: Recheck[] = [];
  for (const found of candidates) {
    const id = rowId(table, found.key);
    const holder = d.locks[id];
    if (holder !== undefined && holder !== tx.id) {
      // Both waiting on each other. PostgreSQL finds this after deadlock_timeout and
      // aborts one of them; the lab aborts the one that closes the cycle.
      if (d.txs[holder].status === 'blocked') return { kind: 'error', error: DEADLOCK };
      return { kind: 'blocked', holder, table, key: found.key };
    }
    // Locks taken before a wait stay held, as they do in PostgreSQL.
    d.locks[id] = tx.id;
    let current: Version | null = found;
    let moved = false;
    // A set xmax that is not ours and not aborted is committed: its owner held the row
    // lock until it finished, and nobody else holds it now.
    while (current && current.xmax !== null && d.clog[current.xmax] === 'committed') {
      const replacedBy: number = current.xmax;
      // New versions are appended, so the successor sits after the version it replaced.
      const from: number = d.versions.indexOf(current);
      const next: Version | undefined = d.versions.find(
        (v, i) => i > from && v.table === table && v.key === found.key && v.xmin === replacedBy,
      );
      if (d.level !== 'read-committed') {
        return { kind: 'error', error: next ? CONCURRENT_UPDATE : CONCURRENT_DELETE };
      }
      current = next ?? null;
      moved = true;
    }
    if (moved) {
      const kept = current !== null && matches(where, current.values);
      rechecks.push({ key: found.key, kept });
      if (!kept) continue;
    }
    // `current` is only null after a move, and then the row was skipped above.
    targets.push(current as Version);
  }
  return { kind: 'ok', targets, rechecks };
}

function project(row: Row, columns: readonly string[]): Row {
  const out: Record<string, Value> = {};
  for (const col of columns) {
    const value = row[col];
    if (value !== undefined) out[col] = value;
  }
  return out;
}

function violatedCheck(schema: TableSchema, row: Row): SqlError | null {
  const broken = (schema.checks ?? []).find((c) => !matches(c.where, row));
  return broken ? checkViolation(schema.name, broken.name) : null;
}

function replaceVersion(d: Draft, old: Version, next: Version): void {
  const index = d.versions.indexOf(old);
  d.versions[index] = next;
}

/** Runs the statement at `tx.pc`. `waitedFor` is set when a blocked statement resumes. */
function execute(scenario: Scenario, d: Draft, id: TxId, waitedFor: TxId | null): void {
  const tx = d.txs[id];
  // validateScenario guarantees a statement at every pc a live transaction can reach.
  const stmt = scenario.scripts[id][tx.pc] as Statement;
  const base = { step: d.step, snapshot: null, snapshotStep: null } as const;
  const finish = (outcome: Outcome) => {
    tx.outcomes[tx.pc] = outcome;
    tx.pc += 1;
  };
  const end = (status: 'committed' | 'rolled-back') => {
    tx.status = status;
    d.clog[id] = status === 'committed' ? 'committed' : 'aborted';
    releaseLocks(d, id);
    wake(scenario, d, id);
  };
  const fail = (error: SqlError, snapshot: Pick<Outcome, 'snapshot' | 'snapshotStep'>) => {
    // An error aborts the transaction at once: its row locks go and its writes are dead.
    // The session then answers 25P02 to everything until it sends ROLLBACK or COMMIT.
    finish({ ...base, ...snapshot, status: 'failed', error, ...(waitedFor ? { waitedFor } : {}) });
    tx.waiting = null;
    if (stmt.kind === 'commit') {
      end('rolled-back');
      return;
    }
    tx.status = 'failed';
    d.clog[id] = 'aborted';
    releaseLocks(d, id);
    wake(scenario, d, id);
  };

  if (stmt.kind === 'begin') {
    // 13.2.2: the snapshot is taken by the first query, not by BEGIN.
    tx.status = 'active';
    finish({ ...base, status: 'done' });
    return;
  }
  if (stmt.kind === 'rollback') {
    finish({ ...base, status: 'done', rolledBack: true });
    end('rolled-back');
    return;
  }
  if (stmt.kind === 'commit') {
    if (tx.status === 'failed') {
      finish({ ...base, status: 'done', rolledBack: true });
      end('rolled-back');
      return;
    }
    if (tx.doomed) {
      fail(RW_DEPENDENCIES, base);
      return;
    }
    finish({ ...base, status: 'done' });
    // Ports and Grittner, section 5.4: the first of the two to commit is safe. The other
    // is the pivot of a dangerous structure whose out-neighbour committed first, so it
    // fails at its next statement or at its own commit. It is marked before it can wake.
    const rival = d.txs[other(id)];
    if (dangerous(d) && d.clog[rival.id] === 'in-progress') {
      rival.doomed = true;
      if (d.last) d.last = { ...d.last, doomed: rival.id };
    }
    end('committed');
    return;
  }
  if (tx.status === 'failed') {
    finish({ ...base, status: 'ignored', error: IN_FAILED_TX });
    return;
  }
  if (!guardHolds(stmt.guard, tx.vars) || missingVar(stmt, tx.vars)) {
    finish({ ...base, status: 'skipped' });
    return;
  }

  // 13.2.1: READ COMMITTED takes a new snapshot for every statement. 13.2.2: the other
  // two levels keep the one taken by the transaction's first query. A statement that
  // waited keeps the snapshot it started with.
  let snapshot: readonly number[];
  let snapshotStep: number;
  if (tx.waiting) {
    ({ snapshot, snapshotStep } = tx.waiting);
  } else if (d.level === 'read-committed') {
    snapshot = takeSnapshot(d.clog);
    snapshotStep = d.step;
  } else {
    if (tx.snapshot === null) {
      tx.snapshot = takeSnapshot(d.clog);
      tx.snapshotStep = d.step;
    }
    snapshot = tx.snapshot;
    // Set together with `snapshot` above.
    snapshotStep = tx.snapshotStep as number;
  }
  const seen = { snapshot, snapshotStep };
  const waited = waitedFor ? { waitedFor } : {};
  const finishSelect = (
    select: SelectStatement,
    found: readonly Version[],
    extra: Partial<Outcome> = {},
  ) => {
    const count = found.length;
    const columns = select.columns;
    const rows = columns === 'count' ? [] : found.map((v) => project(v.values, columns));
    if (select.bind) {
      const take = select.bind.take;
      const value = take === 'count' ? count : found[0]?.values[take.col];
      if (value === undefined) delete tx.vars[select.bind.name];
      else tx.vars[select.bind.name] = value;
    }
    finish({
      ...base,
      ...seen,
      ...waited,
      ...extra,
      status: 'done',
      rows,
      keys: found.map((v) => v.key),
      count,
    });
  };
  const schema = schemaOf(scenario, stmt.table);

  if (stmt.kind === 'insert') {
    if (tx.doomed) return fail(RW_DEPENDENCIES, seen);
    const broken = violatedCheck(schema, stmt.values);
    if (broken) return fail(broken, seen);
    const key = stmt.values[schema.key] as Value;
    d.versions.push({ table: stmt.table, key, values: stmt.values, xmin: id, xmax: null });
    d.locks[rowId(stmt.table, key)] = id;
    recordWrite(d, tx, snapshot, { table: stmt.table, key, before: null, after: stmt.values });
    if (dangerous(d) && d.clog[other(id)] === 'committed') return fail(RW_DEPENDENCIES, seen);
    finish({ ...base, ...seen, status: 'done', count: 1 });
    return;
  }

  if (stmt.kind === 'select' && !stmt.forUpdate) {
    if (tx.doomed) return fail(RW_DEPENDENCIES, seen);
    const found = visibleVersions(d.versions, stmt.table, snapshot, id).filter((v) =>
      matches(stmt.where, v.values),
    );
    recordRead(d, tx, snapshot, stmt.table, stmt.where);
    if (dangerous(d) && d.clog[other(id)] === 'committed') return fail(RW_DEPENDENCIES, seen);
    finishSelect(stmt, found);
    return;
  }

  const plan = planWrite(d, tx, stmt.table, stmt.where, snapshot);
  if (plan.kind === 'blocked') {
    tx.status = 'blocked';
    tx.waiting = { holder: plan.holder, table: plan.table, key: plan.key, snapshot, snapshotStep };
    tx.outcomes[tx.pc] = {
      ...base,
      ...seen,
      status: 'blocked',
      waitingOn: { holder: plan.holder, table: plan.table, column: schema.key, key: plan.key },
    };
    return;
  }
  tx.waiting = null;
  if (plan.kind === 'error') return fail(plan.error, seen);
  // Snapshot isolation's own failure comes first; then the SSI verdict, if any.
  if (tx.doomed) return fail(RW_DEPENDENCIES, seen);
  const rechecks = plan.rechecks.length > 0 ? { rechecks: plan.rechecks } : {};

  if (stmt.kind === 'select') {
    recordRead(d, tx, snapshot, stmt.table, stmt.where);
    if (dangerous(d) && d.clog[other(id)] === 'committed') return fail(RW_DEPENDENCIES, seen);
    // Under READ COMMITTED a locking read returns the newest committed version of a row
    // it had to wait for, not the version in its snapshot.
    finishSelect(stmt, plan.targets, rechecks);
    return;
  }

  const params: Record<string, Value> = {};
  const replacements: { old: Version; values: Row | null }[] = [];
  for (const old of plan.targets) {
    if (stmt.kind === 'delete') {
      replacements.push({ old, values: null });
      continue;
    }
    const values: Record<string, Value> = { ...old.values };
    for (const [col, expr] of Object.entries(stmt.set)) {
      if (expr.kind === 'const') values[col] = expr.value;
      else if (expr.kind === 'add') values[col] = (old.values[col] as number) + expr.n;
      else {
        const value = (tx.vars[expr.name] as number) + expr.plus;
        values[col] = value;
        params[paramName(col)] = value;
      }
    }
    const broken = violatedCheck(schema, values);
    if (broken) return fail(broken, seen);
    replacements.push({ old, values });
  }
  for (const { old, values } of replacements) {
    replaceVersion(d, old, { ...old, xmax: id });
    if (values) d.versions.push({ table: old.table, key: old.key, values, xmin: id, xmax: null });
    recordWrite(d, tx, snapshot, {
      table: old.table,
      key: old.key,
      before: old.values,
      after: values,
    });
  }
  // The WHERE scan of a write is a read too, and takes SIREAD locks in PostgreSQL.
  recordRead(d, tx, snapshot, stmt.table, stmt.where);
  if (dangerous(d) && d.clog[other(id)] === 'committed') return fail(RW_DEPENDENCIES, seen);
  const count = replacements.length;
  if (stmt.bind) tx.vars[stmt.bind.name] = count;
  finish({
    ...base,
    ...seen,
    ...waited,
    ...rechecks,
    status: 'done',
    count,
    ...(Object.keys(params).length > 0 ? { params } : {}),
  });
}

/** The name the view shows for an application-computed value: `:new_stock`. */
export function paramName(col: string): string {
  return `new_${col}`;
}

/** When a transaction ends or fails, a statement waiting on its row lock resumes at once. */
function wake(scenario: Scenario, d: Draft, finished: TxId): void {
  const waiter = d.txs[other(finished)];
  if (waiter.status !== 'blocked') return;
  waiter.status = 'active';
  if (d.last) d.last = { ...d.last, woke: { tx: waiter.id, statement: waiter.pc } };
  execute(scenario, d, waiter.id, finished);
}

/** Runs the next statement of `tx` and returns the new state. The input is not changed. */
export function step(scenario: Scenario, state: EngineState, tx: TxId): EngineState {
  if (!canRun(state, tx)) throw new Error(`T${tx} cannot run: ${state.txs[tx].status}`);
  const d = draftOf(state);
  d.step += 1;
  d.last = { tx, statement: d.txs[tx].pc, woke: null, doomed: null };
  execute(scenario, d, tx, null);
  return d;
}
