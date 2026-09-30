import { compareResultSets } from './compare';
import type { SqlResultSet, SqlRunReport } from './report';

/*
 * Whether a learner's SQL gives the solution's answer. The solution is the only source
 * of truth: the page runs it on the same fresh database and compares the two results,
 * so an author never writes Postgres's text formats by hand, and the gate proves the
 * solution runs.
 */

export interface SqlChecks {
  /** Compare row order too. Off by default: a set of rows has no order without ORDER BY. */
  ordered?: boolean;
  /** Compare what this query returns after the SQL, instead of the SQL's last result. */
  query?: string;
}

export type SqlVerdict =
  | { status: 'match' }
  | { status: 'mismatch'; differences: string[] }
  /** The learner's SQL failed, ran too long, or returned nothing to compare. */
  | { status: 'error'; message: string }
  /** No verdict is possible: the database did not load, or the solution gave no result. */
  | { status: 'unavailable'; reason: string };

export type Subject = { result: SqlResultSet } | { error: string } | { none: true };

/** What gets compared: the check query's result, or the last statement that returned rows. */
export function subjectOf(
  report: Extract<SqlRunReport, { status: 'ran' }>,
  checks: SqlChecks,
): Subject {
  if (checks.query !== undefined) {
    const after = report.query;
    if (after === undefined) return { none: true };
    return 'result' in after ? { result: after.result } : { error: after.error.message };
  }
  for (let i = report.statements.length - 1; i >= 0; i -= 1) {
    const statement = report.statements[i];
    if (statement?.status === 'ok' && statement.result) return { result: statement.result };
  }
  return { none: true };
}

const seconds = (ms: number): string => {
  const s = Math.round(ms / 100) / 10;
  return s === 1 ? '1 second' : `${s} seconds`;
};

export function sqlVerdict(
  learner: SqlRunReport,
  expected: SqlRunReport,
  checks: SqlChecks,
): SqlVerdict {
  if (learner.status === 'unavailable') return { status: 'unavailable', reason: learner.reason };
  if (learner.status === 'setup-error') {
    return { status: 'unavailable', reason: 'The tables for this step could not be made.' };
  }
  if (learner.status === 'timeout') {
    return {
      status: 'error',
      message: `Your SQL ran for more than ${seconds(learner.limitMs)} and was stopped.`,
    };
  }

  const want =
    expected.status === 'ran' && expected.statements.every((s) => s.status === 'ok')
      ? subjectOf(expected, checks)
      : null;
  if (want === null || !('result' in want)) {
    return { status: 'unavailable', reason: 'The expected result could not be worked out.' };
  }

  const failed = learner.statements.find((s) => s.status === 'error');
  if (failed?.status === 'error') {
    return {
      status: 'error',
      message: `Line ${failed.error.line ?? failed.line}: ${failed.error.message}`,
    };
  }

  const got = subjectOf(learner, checks);
  if ('error' in got) {
    return { status: 'error', message: `The check after your SQL failed: ${got.error}` };
  }
  if ('none' in got) {
    return {
      status: 'error',
      message: 'Your SQL returned no rows to compare. End it with a select.',
    };
  }
  const { match, differences } = compareResultSets(want.result, got.result, {
    ordered: checks.ordered ?? false,
  });
  return match ? { status: 'match' } : { status: 'mismatch', differences };
}
