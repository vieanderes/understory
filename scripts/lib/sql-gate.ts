import { createNodeSqlEngine } from '../../src/adapters/sql/node';
import type { Issue, RawLesson } from '../../src/core/content/catalog';
import type { SqlStep } from '../../src/core/content/schema';
import type { SqlEngine } from '../../src/core/ports/sql-engine';
import { sqlVerdict } from '../../src/core/sql/verdict';

/*
 * The sql gate. For every sql step:
 *
 *   1. the setup runs on a fresh database without an error,
 *   2. with checks, the solution runs without an error and returns rows to compare
 *      (or the check query does),
 *   3. with checks, the starter does not already give the solution's result, so the
 *      learner has something to do.
 *
 * It runs the same PGlite build and the same session as the browser worker
 * (src/adapters/sql), so a verdict here is the verdict a learner gets.
 */

export interface SqlGateItem {
  lesson: RawLesson;
  step: SqlStep;
}

export type SqlGate = (items: readonly SqlGateItem[]) => Promise<Issue[]>;

export const noSqlGate: SqlGate = () => Promise.resolve([]);

export async function checkSqlStep(
  engine: SqlEngine,
  { lesson, step }: SqlGateItem,
): Promise<Issue[]> {
  const issue = (message: string): Issue => ({
    severity: 'error',
    path: lesson.path,
    where: step.id,
    message,
    rule: 'sql-gate',
  });
  const setup = step.setup ?? '';
  const checks = step.checks ?? {};
  const query = checks.query === undefined ? {} : { query: checks.query };

  const solution = step.solution ?? '';
  const solved = await engine.run({ setup, sql: solution, ...query });
  if (solved.status === 'setup-error') {
    return [issue(`The setup fails: ${solved.error.message}. Fix the setup.`)];
  }
  if (solved.status !== 'ran') {
    const why = solved.status === 'timeout' ? 'it timed out' : solved.reason;
    return [issue(`The database could not run this step: ${why}.`)];
  }
  if (step.checks === undefined || step.solution === undefined) return [];

  const failed = solved.statements.find((s) => s.status === 'error');
  if (failed?.status === 'error') {
    return [
      issue(
        `The solution fails on line ${failed.error.line ?? failed.line}: ${failed.error.message}. Fix the solution.`,
      ),
    ];
  }
  const verdict = sqlVerdict(solved, solved, checks);
  if (verdict.status !== 'match') {
    const why = verdict.status === 'error' ? verdict.message : 'it gives no result to compare';
    return [
      issue(`The solution cannot be compared: ${why}. End it with a select, or add checks.query.`),
    ];
  }

  const begun = await engine.run({ setup, sql: step.starter ?? '', ...query });
  if (sqlVerdict(begun, solved, checks).status === 'match') {
    return [
      issue(
        "The starter already gives the solution's result, so there is nothing to do. Change the starter.",
      ),
    ];
  }
  return [];
}

/** One database for every step, started only when there is a step, and closed after. */
export const pgliteSqlGate: SqlGate = async (items) => {
  if (items.length === 0) return [];
  const engine = createNodeSqlEngine();
  try {
    const issues: Issue[] = [];
    for (const item of items) issues.push(...(await checkSqlStep(engine, item)));
    return issues;
  } finally {
    await engine.close();
  }
};
