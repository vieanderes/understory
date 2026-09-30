import { SQL_LIMITS } from '@/core/sql/limits';
import type {
  SqlCell,
  SqlError,
  SqlResultSet,
  SqlRunReport,
  SqlRunRequest,
  SqlStatementResult,
  SqlTableInfo,
} from '@/core/sql/report';
import { locate, splitStatements } from '@/core/sql/split';

/*
 * One PGlite database, reset before every run, shared by the browser worker and the
 * content gate so both give the same report for the same SQL.
 *
 * Why reset instead of a new database per run: starting PGlite runs initdb, about 3 s,
 * and cloning one about 0.6 s; wiping the user schemas takes a few milliseconds. The
 * reset undoes what a lesson can do (tables, types, functions, schemas, roles, session
 * settings, an open or failed transaction). Something it misses, such as a change to a
 * catalog table, lasts until the worker is replaced, and harms only that learner's runs.
 */

/** The part of PGlite a session uses, so tests can see what it calls. */
export interface PgliteLike {
  exec(
    sql: string,
    options?: {
      rowMode?: 'array' | 'object';
      parsers?: Record<number, (value: string) => unknown>;
    },
  ): Promise<
    { rows: unknown[]; fields: { name: string }[]; command?: string; affectedRows?: number }[]
  >;
}

/** Postgres's text output for every type, the way psql prints it, rather than JS values. */
type Parsers = Record<number, (value: string) => unknown>;

const RESET = `
DO $reset$
DECLARE name text;
BEGIN
  FOR name IN SELECT evtname FROM pg_event_trigger LOOP
    EXECUTE format('DROP EVENT TRIGGER %I', name);
  END LOOP;
  FOR name IN SELECT nspname FROM pg_namespace
      WHERE nspname NOT LIKE 'pg\\_%' AND nspname <> 'information_schema' LOOP
    EXECUTE format('DROP SCHEMA %I CASCADE', name);
  END LOOP;
  FOR name IN SELECT rolname FROM pg_roles
      WHERE rolname NOT LIKE 'pg\\_%' AND rolname <> session_user LOOP
    EXECUTE format('DROP OWNED BY %I CASCADE', name);
    EXECUTE format('DROP ROLE %I', name);
  END LOOP;
END
$reset$;
CREATE SCHEMA public;
`;

/** The same settings for every run, whatever the host's clock and locale. */
const SETTINGS = `SET TimeZone = 'UTC'; SET DateStyle = 'ISO, MDY'; SET IntervalStyle = 'postgres';`;

const DESCRIBE = `
SELECT c.relname, a.attname, format_type(a.atttypid, a.atttypmod), a.attnotnull::text,
  EXISTS (
    SELECT 1 FROM pg_index i
    WHERE i.indrelid = c.oid AND i.indisprimary AND a.attnum = ANY (i.indkey)
  )::text,
  (SELECT k.confrelid::regclass::text FROM pg_constraint k
    WHERE k.conrelid = c.oid AND k.contype = 'f' AND a.attnum = ANY (k.conkey) LIMIT 1)
FROM pg_class c
JOIN pg_namespace n ON n.oid = c.relnamespace
JOIN pg_attribute a ON a.attrelid = c.oid
WHERE n.nspname = 'public' AND c.relkind IN ('r', 'p', 'v') AND a.attnum > 0 AND NOT a.attisdropped
ORDER BY c.relname, a.attnum`;

interface PgError {
  message?: unknown;
  code?: unknown;
  detail?: unknown;
  hint?: unknown;
  position?: unknown;
}

const text = (value: unknown): string | undefined =>
  typeof value === 'string' && value !== '' ? value : undefined;

function toError(error: unknown, source?: { sql: string; start: number }): SqlError {
  const e = (typeof error === 'object' && error !== null ? error : {}) as PgError;
  const message = text(e.message) ?? (error instanceof Error ? error.message : String(error));
  const position = Number(e.position);
  const where =
    source === undefined
      ? {}
      : locate(
          source.sql,
          source.start,
          Number.isInteger(position) && position > 0 ? position : undefined,
        );
  return {
    message,
    ...(text(e.code) ? { code: text(e.code) } : {}),
    ...(text(e.detail) ? { detail: text(e.detail) } : {}),
    ...(text(e.hint) ? { hint: text(e.hint) } : {}),
    ...where,
  };
}

function cellOf(value: unknown): SqlCell {
  if (value === null || value === undefined) return null;
  const s = typeof value === 'string' ? value : String(value);
  return s.length > SQL_LIMITS.maxCellLength ? `${s.slice(0, SQL_LIMITS.maxCellLength - 1)}…` : s;
}

function resultSetOf(fields: { name: string }[], rows: unknown[]): SqlResultSet {
  const kept = rows.slice(0, SQL_LIMITS.maxRows);
  return {
    columns: fields.map((field) => field.name),
    rows: kept.map((row) => (Array.isArray(row) ? row.map(cellOf) : [])),
    rowCount: rows.length,
    ...(rows.length > kept.length ? { truncated: true } : {}),
  };
}

export interface SqlSession {
  run(request: SqlRunRequest): Promise<SqlRunReport>;
}

/**
 * Wraps a started PGlite. `parsers` must map every type the database knows to text;
 * `textParsers` builds it once, after start.
 */
export function createSqlSession(db: PgliteLike, parsers: Parsers): SqlSession {
  const options = { rowMode: 'array' as const, parsers };

  async function reset(): Promise<void> {
    // An open or failed transaction from the last run would swallow everything below.
    await db.exec('ROLLBACK').catch(() => undefined);
    // DISCARD ALL refuses to run beside other statements, which share a transaction.
    await db.exec('DISCARD ALL');
    await db.exec(`${RESET} ${SETTINGS}`);
  }

  async function describe(): Promise<SqlTableInfo[]> {
    const [result] = await db.exec(DESCRIBE, options);
    const tables: SqlTableInfo[] = [];
    for (const row of (result?.rows ?? []) as string[][]) {
      const [table, name, type, notNull, primaryKey, references] = row;
      if (table === undefined || name === undefined || type === undefined) continue;
      let entry = tables.at(-1);
      if (entry?.name !== table) {
        entry = { name: table, columns: [] };
        tables.push(entry);
      }
      entry.columns.push({
        name,
        type,
        notNull: notNull === 'true',
        primaryKey: primaryKey === 'true',
        ...(references ? { references } : {}),
      });
    }
    return tables;
  }

  async function runStatements(
    sql: string,
  ): Promise<{ statements: SqlStatementResult[]; skipped: number }> {
    const all = splitStatements(sql);
    const list = all.slice(0, SQL_LIMITS.maxStatements);
    const statements: SqlStatementResult[] = [];
    for (const [i, statement] of list.entries()) {
      const started = performance.now();
      try {
        const results = await db.exec(statement.text, options);
        const last = results.at(-1);
        const fields = last?.fields ?? [];
        const command = last?.command ?? '';
        statements.push({
          status: 'ok',
          line: statement.line,
          text: statement.text,
          command,
          ...(fields.length > 0 ? { result: resultSetOf(fields, last?.rows ?? []) } : {}),
          ...(fields.length === 0 && ['INSERT', 'UPDATE', 'DELETE', 'MERGE'].includes(command)
            ? { affected: last?.affectedRows ?? 0 }
            : {}),
          ms: Math.round((performance.now() - started) * 10) / 10,
        });
      } catch (error) {
        statements.push({
          status: 'error',
          line: statement.line,
          text: statement.text,
          error: toError(error, { sql, start: statement.start }),
        });
        return { statements, skipped: all.length - i - 1 };
      }
    }
    return { statements, skipped: all.length - list.length };
  }

  return {
    async run(request) {
      await reset();
      try {
        await db.exec(request.setup);
      } catch (error) {
        return { status: 'setup-error', error: toError(error) };
      }
      const schema = request.describe ? await describe() : undefined;
      const { statements, skipped } = await runStatements(request.sql);
      const failed = statements.some((s) => s.status === 'error');
      let query: Extract<SqlRunReport, { status: 'ran' }>['query'];
      if (request.query !== undefined && !failed) {
        // A transaction the learner left open is still theirs: the query sees inside it.
        try {
          const [result] = (await db.exec(request.query, options)).slice(-1);
          query = { result: resultSetOf(result?.fields ?? [], result?.rows ?? []) };
        } catch (error) {
          query = { error: toError(error) };
        }
      }
      return {
        status: 'ran',
        statements,
        skipped,
        ...(query ? { query } : {}),
        ...(schema ? { schema } : {}),
      };
    },
  };
}

/**
 * A parser per type the database knows that returns Postgres's text unchanged. PGlite
 * merges these over its own, so every known type comes back as text; a type made later
 * (an enum in a setup) has no parser of PGlite's either, and comes back as text anyway.
 */
export async function textParsers(db: PgliteLike): Promise<Parsers> {
  const [result] = await db.exec('SELECT oid::text FROM pg_type', { rowMode: 'array' });
  const identity = (value: string) => value;
  const parsers: Parsers = {};
  for (const row of (result?.rows ?? []) as string[][]) parsers[Number(row[0])] = identity;
  return parsers;
}

/** Settings PGlite reads at start, so even the first statement sees UTC and ISO dates. */
export const PGLITE_CONF = ["timezone = 'UTC'", "datestyle = 'iso, mdy'", "lc_messages = 'C'"];
