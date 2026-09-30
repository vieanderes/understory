import type { SqlError, SqlRunReport, SqlStatementResult } from '@/core/sql';
import { ResultTable } from './ResultTable';

interface StatementResultsProps {
  /** The heading's id, unique on the page: the learner's result and the solution's can both show. */
  id: string;
  title: string;
  report: SqlRunReport | null;
  running: boolean;
  /** Postgres is up in this page. The first run also starts it, which takes a moment. */
  warm: boolean;
  /** A short line under the status, such as whether the result matches. */
  verdict?: React.ReactNode;
}

const rows = (n: number): string => (n === 1 ? '1 row' : `${n} rows`);

function summary(statement: Extract<SqlStatementResult, { status: 'ok' }>): string {
  if (statement.result) return `${statement.command} · ${rows(statement.result.rowCount)}`;
  if (statement.affected !== undefined) {
    return `${statement.command} · ${statement.affected === 1 ? '1 row changed' : `${statement.affected} rows changed`}`;
  }
  return statement.command || 'Done';
}

/** Postgres's own words, in the shape psql prints them, and where it points. */
export function SqlErrorText({ error }: { error: SqlError }) {
  return (
    <div className="text-danger flex flex-col gap-0.5 font-mono text-sm break-words whitespace-pre-wrap">
      <p>ERROR: {error.message}</p>
      {error.detail ? <p className="text-fg">DETAIL: {error.detail}</p> : null}
      {error.hint ? <p className="text-fg">HINT: {error.hint}</p> : null}
      {error.line ? (
        <p className="text-muted">
          Line {error.line}
          {error.column ? `, column ${error.column}` : ''}
        </p>
      ) : null}
    </div>
  );
}

function statusLine(report: SqlRunReport | null, running: boolean, warm: boolean): string {
  if (running) {
    return warm
      ? 'Running'
      : 'Starting Postgres in your browser. The first time takes a few seconds.';
  }
  if (report === null) return 'Not run yet';
  switch (report.status) {
    case 'ran': {
      if (report.statements.length === 0) return 'Nothing to run. Type a statement first.';
      const failed = report.statements.find((s) => s.status === 'error');
      if (failed) return `Stopped at line ${failed.error.line ?? failed.line}`;
      const n = report.statements.length;
      return n === 1 ? '1 statement ran' : `${n} statements ran`;
    }
    case 'timeout':
      return `Stopped after ${Math.round(report.limitMs / 1000)} seconds. A query that never ends, such as an endless recursive one, is the usual cause.`;
    case 'setup-error':
      return "This step's tables could not be made.";
    case 'unavailable':
      return `The database is not available. ${report.reason}`;
  }
}

/**
 * Every statement of the last run, in order: its command and row count, then its rows or
 * Postgres's error. A run stops at the first error, as with psql's ON_ERROR_STOP, so the
 * list says how many statements after it did not run.
 */
export function StatementResults({
  id,
  title,
  report,
  running,
  warm,
  verdict,
}: StatementResultsProps) {
  const ran = report?.status === 'ran' ? report : null;
  return (
    <section aria-labelledby={id} data-testid={id} className="flex flex-col gap-1">
      <h3 id={id} className="t-label">
        {title}
      </h3>
      <div role="status" data-status={running ? 'running' : (report?.status ?? 'idle')}>
        <p className="text-muted font-mono text-sm">{statusLine(report, running, warm)}</p>
        {!running && report?.status === 'setup-error' ? (
          <SqlErrorText error={report.error} />
        ) : null}
        {!running && verdict ? verdict : null}
      </div>
      {ran && !running ? (
        <ol className="flex flex-col" aria-label={`${title}, statement by statement`}>
          {ran.statements.map((statement, i) => (
            <li
              key={`${i}-${statement.line}`}
              data-testid="sql-statement"
              data-status={statement.status}
              className="rule-t flex min-w-0 flex-col gap-1 py-1"
            >
              <p className="flex min-w-0 flex-wrap gap-x-1 text-sm">
                <span className="text-muted font-mono">Line {statement.line}</span>
                <span className="font-medium">
                  {statement.status === 'ok' ? summary(statement) : 'Error'}
                </span>
              </p>
              {statement.status === 'error' ? (
                <SqlErrorText error={statement.error} />
              ) : statement.result ? (
                <ResultTable result={statement.result} label={`${title}: line ${statement.line}`} />
              ) : null}
            </li>
          ))}
          {ran.skipped > 0 ? (
            <li className="rule-t text-muted py-1 text-sm">
              {ran.skipped === 1
                ? '1 statement after it did not run.'
                : `${ran.skipped} statements after it did not run.`}
            </li>
          ) : null}
        </ol>
      ) : null}
    </section>
  );
}
