/*
 * Types for the isolation anomaly stepper: a two-transaction model of PostgreSQL's MVCC.
 *
 * Sources the engine follows, cited again above each rule:
 *  - PostgreSQL documentation, chapter 13 "Concurrency Control", section 13.2
 *    "Transaction Isolation" (13.2.1 Read Committed, 13.2.2 Repeatable Read,
 *    13.2.3 Serializable).
 *  - Berenson, Bernstein, Gray, Melton, O'Neil, O'Neil: "A Critique of ANSI SQL Isolation
 *    Levels", SIGMOD 1995 (names for lost update, write skew and snapshot isolation).
 *  - Ports and Grittner: "Serializable Snapshot Isolation in PostgreSQL", VLDB 2012.
 */

export type Level = 'read-committed' | 'repeatable-read' | 'serializable';

export const LEVELS: readonly Level[] = ['read-committed', 'repeatable-read', 'serializable'];

export type TxId = 1 | 2;

export const TX_IDS: readonly TxId[] = [1, 2];

/** The transaction id of the rows that exist before either transaction starts. */
export const BOOTSTRAP_XID = 0;

export type Value = number | string | boolean;
export type Row = Readonly<Record<string, Value>>;

export type CompareOp = '=' | '<>' | '<' | '<=' | '>' | '>=';
/** The right-hand side of a comparison: a constant, or another column of the same row. */
export type Operand = Value | { readonly col: string };

export interface Comparison {
  readonly col: string;
  readonly op: CompareOp;
  readonly value: Operand;
}

/** A conjunction. The empty predicate matches every row. */
export type Predicate = readonly Comparison[];

export interface CheckConstraint {
  readonly name: string;
  readonly where: Predicate;
}

export interface TableSchema {
  readonly name: string;
  readonly columns: readonly string[];
  /** The primary key column. It names the logical row across its versions. */
  readonly key: string;
  readonly checks?: readonly CheckConstraint[];
}

/**
 * Application logic between statements: the statement is sent only when the guard holds.
 * An unset variable fails every guard.
 */
export interface Guard {
  readonly var: string;
  readonly op: CompareOp;
  readonly value: number;
}

/**
 * What the application keeps from a statement's result. `count` is count(*) for an
 * aggregate, the number of rows returned for a row SELECT, and the number of rows
 * affected for UPDATE and DELETE. `{ col }` is that column of the first row returned.
 */
export interface Bind {
  readonly name: string;
  readonly take: 'count' | { readonly col: string };
}

export type SetExpr =
  | { readonly kind: 'const'; readonly value: Value }
  /** `col = col + n`, computed by the database from the row version it updates. */
  | { readonly kind: 'add'; readonly n: number }
  /** A value the application computed from something it read earlier: `:var + plus`. */
  | { readonly kind: 'var'; readonly name: string; readonly plus: number };

export type Statement =
  | { readonly kind: 'begin' }
  | {
      readonly kind: 'select';
      readonly table: string;
      readonly where: Predicate;
      readonly columns: readonly string[] | 'count';
      readonly forUpdate?: boolean;
      readonly bind?: Bind;
      readonly guard?: Guard;
    }
  | {
      readonly kind: 'update';
      readonly table: string;
      readonly where: Predicate;
      readonly set: Readonly<Record<string, SetExpr>>;
      readonly bind?: Bind;
      readonly guard?: Guard;
    }
  | {
      readonly kind: 'insert';
      readonly table: string;
      readonly values: Row;
      readonly guard?: Guard;
    }
  | {
      readonly kind: 'delete';
      readonly table: string;
      readonly where: Predicate;
      readonly bind?: Bind;
      readonly guard?: Guard;
    }
  | { readonly kind: 'commit' }
  | { readonly kind: 'rollback' };

/** A rule over the committed state: `count(rows of table matching where) op value`. */
export interface Invariant {
  readonly label: string;
  readonly table: string;
  readonly where: Predicate;
  readonly op: CompareOp;
  readonly value: number;
}

export interface Scenario {
  readonly tables: readonly TableSchema[];
  readonly rows: Readonly<Record<string, readonly Row[]>>;
  readonly scripts: Readonly<Record<TxId, readonly Statement[]>>;
  readonly invariant?: Invariant;
}

/** One version of one row. `xmin` created it; `xmax`, when set, deleted or replaced it. */
export interface Version {
  readonly table: string;
  readonly key: Value;
  readonly values: Row;
  readonly xmin: number;
  readonly xmax: number | null;
}

export type CommitStatus = 'in-progress' | 'committed' | 'aborted';

export type TxStatus =
  | 'idle'
  | 'active'
  /** Waiting for the other transaction's row lock. */
  | 'blocked'
  /** A statement failed. PostgreSQL ignores every command until ROLLBACK or COMMIT. */
  | 'failed'
  | 'committed'
  | 'rolled-back';

export interface SqlError {
  readonly sqlstate: string;
  readonly message: string;
}

export interface Recheck {
  readonly key: Value;
  /** False when the newest committed version no longer matches WHERE, or is gone. */
  readonly kept: boolean;
}

export interface Outcome {
  readonly status: 'done' | 'blocked' | 'failed' | 'skipped' | 'ignored';
  /** The step (frame index) at which this outcome was produced. */
  readonly step: number;
  /** Transaction ids whose commits the statement could see. Null when it read nothing. */
  readonly snapshot: readonly number[] | null;
  /** The step at which that snapshot was taken. */
  readonly snapshotStep: number | null;
  /** Rows returned by a SELECT, already projected. */
  readonly rows?: readonly Row[];
  /** Keys of the rows a SELECT matched, also for count(*). */
  readonly keys?: readonly Value[];
  /** count(*), rows returned, or rows affected. */
  readonly count?: number;
  /** Application values sent with the statement, such as `:new_sold`. */
  readonly params?: Readonly<Record<string, Value>>;
  readonly error?: SqlError;
  /** Set when the statement waited for this transaction's row lock before it ran. */
  readonly waitedFor?: TxId;
  /** The row the statement is waiting on, and who holds its lock, while blocked. */
  readonly waitingOn?: {
    readonly holder: TxId;
    readonly table: string;
    readonly column: string;
    readonly key: Value;
  };
  /** READ COMMITTED re-evaluation of WHERE against the newest committed version. */
  readonly rechecks?: readonly Recheck[];
  /** A COMMIT sent in a failed transaction answers ROLLBACK. */
  readonly rolledBack?: boolean;
}

export interface Waiting {
  readonly holder: TxId;
  readonly table: string;
  readonly key: Value;
  /** The statement keeps the snapshot it started with while it waits. */
  readonly snapshot: readonly number[];
  readonly snapshotStep: number;
}

export interface TxState {
  readonly id: TxId;
  readonly status: TxStatus;
  /** Index of the next statement to run. A blocked statement is still the next one. */
  readonly pc: number;
  /** The transaction snapshot under REPEATABLE READ and SERIALIZABLE. */
  readonly snapshot: readonly number[] | null;
  readonly snapshotStep: number | null;
  readonly vars: Readonly<Record<string, Value>>;
  readonly waiting: Waiting | null;
  /** SSI: the other transaction committed first and this one must fail. */
  readonly doomed: boolean;
  readonly outcomes: readonly Outcome[];
}

export interface PredicateRead {
  readonly tx: TxId;
  readonly table: string;
  readonly where: Predicate;
}

export interface WriteRecord {
  readonly tx: TxId;
  readonly table: string;
  readonly key: Value;
  readonly before: Row | null;
  readonly after: Row | null;
}

/** An rw-antidependency: `reader` read something that `writer` changed concurrently. */
export interface RwEdge {
  readonly reader: TxId;
  readonly writer: TxId;
}

export interface StepReport {
  readonly tx: TxId;
  readonly statement: number;
  /** The other transaction's blocked statement resumed as part of this step. */
  readonly woke: { readonly tx: TxId; readonly statement: number } | null;
  /** SSI marked this transaction to fail at its next statement. */
  readonly doomed: TxId | null;
}

export interface EngineState {
  readonly level: Level;
  readonly step: number;
  readonly versions: readonly Version[];
  readonly clog: Readonly<Record<number, CommitStatus>>;
  /** Row locks by row id (`table/key`). Held until the owner commits, rolls back or fails. */
  readonly locks: Readonly<Record<string, TxId>>;
  readonly txs: Readonly<Record<TxId, TxState>>;
  readonly reads: readonly PredicateRead[];
  readonly writes: readonly WriteRecord[];
  readonly edges: readonly RwEdge[];
  readonly last: StepReport | null;
}
