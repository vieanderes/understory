/** Every bound on a SQL run, in one place (docs/SANDBOX.md, "SQL"). */
export const SQL_LIMITS = {
  /** What a learner types, and a step's setup. Far above any lesson. */
  maxSourceBytes: 64 * 1024,
  /** Statements in one run. A lesson needs a handful. */
  maxStatements: 50,
  /** Rows kept per result. The count still says how many there were. */
  maxRows: 500,
  /** One value, as text. A longer one is cut, with an ellipsis. */
  maxCellLength: 2_000,
  /**
   * A warm run. PGlite has no working statement_timeout, so the page stops the worker
   * when this passes and starts a new one on the next run.
   */
  runTimeoutMs: 5_000,
  /**
   * Starting Postgres: fetching about 5 MB compressed the first time, compiling it and
   * making a fresh cluster. About 3 s on a laptop, more on a slow phone.
   */
  bootTimeoutMs: 90_000,
} as const;
