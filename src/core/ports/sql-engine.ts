import type { SqlRunReport, SqlRunRequest } from '../sql/report';

/**
 * The SQL engine contract (docs/SANDBOX.md, "SQL"). The browser implements it with
 * PGlite in a Web Worker, the content gate with the same PGlite in Node. Every run starts
 * from a fresh database: the setup, then the SQL, then the optional query.
 */
export interface SqlEngine {
  /** Never rejects. An engine that cannot answer resolves `unavailable` or `timeout`. */
  run(request: SqlRunRequest): Promise<SqlRunReport>;
}
