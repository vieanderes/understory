/*
 * What a run of SQL produced, as the page and the content gate both see it. Values are
 * Postgres's own text output (`t` for true, `12.50` for a numeric(8,2), timestamps in
 * UTC with ISO dates), so what a learner reads is what psql would print, and comparing
 * two results is comparing strings. `null` is SQL NULL.
 */

export type SqlCell = string | null;

export interface SqlResultSet {
  columns: string[];
  rows: SqlCell[][];
  /** Every row the statement returned. `rows` stops at the row cap. */
  rowCount: number;
  /** Set when `rows` holds fewer than `rowCount`. */
  truncated?: boolean;
}

export interface SqlError {
  /** Postgres's own message, for example `syntax error at or near "selct"`. */
  message: string;
  /** The SQLSTATE, for example `42601`. */
  code?: string;
  detail?: string;
  hint?: string;
  /** Where Postgres points, in the whole input the learner typed. */
  line?: number;
  column?: number;
}

export type SqlStatementResult =
  | {
      status: 'ok';
      /** 1-based line of the input where the statement starts. */
      line: number;
      /** The statement as typed, without its semicolon. */
      text: string;
      /** The command tag's verb: SELECT, INSERT, CREATE and so on. */
      command: string;
      /** Rows and columns, for a statement that returns them (a SELECT, or RETURNING). */
      result?: SqlResultSet;
      /** Rows an INSERT, UPDATE or DELETE touched. */
      affected?: number;
      ms: number;
    }
  | { status: 'error'; line: number; text: string; error: SqlError };

/** A column of a table the setup made, for the schema panel. */
export interface SqlColumnInfo {
  name: string;
  /** As Postgres formats it: `integer`, `numeric(8,2)`, `timestamp with time zone`. */
  type: string;
  notNull: boolean;
  primaryKey: boolean;
  /** The table a foreign key on this column points at. */
  references?: string;
}

export interface SqlTableInfo {
  name: string;
  columns: SqlColumnInfo[];
}

export interface SqlRunRequest {
  /** Schema and seed rows, run on a fresh database before `sql`. */
  setup: string;
  /** What the learner (or the solution) typed. Split into statements and run in order. */
  sql: string;
  /** Run after `sql` to read what it changed. Its result is `query`. */
  query?: string;
  /** Describe the tables the setup made. */
  describe?: boolean;
}

export type SqlRunReport =
  | {
      status: 'ran';
      /** In order, up to and including the first that failed. */
      statements: SqlStatementResult[];
      /** Statements after a failure, not run. */
      skipped: number;
      query?: { result: SqlResultSet } | { error: SqlError };
      schema?: SqlTableInfo[];
    }
  /** The step's own setup failed: an authoring error the gate exists to catch. */
  | { status: 'setup-error'; error: SqlError }
  /** The run took longer than its budget and the database was stopped. */
  | { status: 'timeout'; limitMs: number }
  /** The database could not be loaded or stopped answering. */
  | { status: 'unavailable'; reason: string };
