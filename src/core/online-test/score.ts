import type { CaseVerdict, Verdict } from './verdict';

/*
 * The platform's scoring (docs/ONLINE-TEST.md, "Scoring"):
 *
 *  - a test is a group of cases, and passes only if every case does;
 *  - example tests are shown but never scored;
 *  - correctness and performance are the share of their tests passed;
 *  - an algorithmic task scores the mean of the two, a coding or bug-fix task its
 *    correctness alone;
 *  - code that does not compile scores 0, and so does a bug-fix that changes nothing or
 *    more lines than allowed;
 *  - the test's total is the mean of its tasks.
 *
 * Percentages are rounded down, as the platform's are: 62.5% shows as 62%.
 */

export type TestGroup = 'example' | 'correctness' | 'performance';
export type TaskType = 'algorithmic' | 'coding' | 'bug-fix';

export interface TestResult {
  name: string;
  description: string;
  group: TestGroup;
  cases: CaseVerdict[];
}

export interface TaskResult {
  taskId: string;
  type: TaskType;
  tests: TestResult[];
  /** Set when the code did not compile: every test counts as failed. */
  compileErrors?: string[];
  /** Bug-fix tasks: how many lines the submission changed, and how many it may. */
  changedLines?: { changed: number; limit: number };
}

export const testPassed = (test: TestResult): boolean =>
  test.cases.length > 0 && test.cases.every((c) => c.verdict === 'ok');

/** The worst verdict of a test, which its row shows. */
export function testVerdict(test: TestResult): Verdict {
  const order: Verdict[] = ['runtime-error', 'timeout', 'wrong-answer', 'ok'];
  for (const verdict of order) if (test.cases.some((c) => c.verdict === verdict)) return verdict;
  return 'runtime-error';
}

export interface GroupTally {
  passed: number;
  total: number;
}

export function tally(result: TaskResult, group: TestGroup): GroupTally {
  const tests = result.tests.filter((t) => t.group === group);
  const passed = result.compileErrors ? 0 : tests.filter(testPassed).length;
  return { passed, total: tests.length };
}

const share = ({ passed, total }: GroupTally): number => (total === 0 ? 0 : passed / total);

export interface TaskScore {
  /** Shares in [0, 1]. Performance is absent when the task has no performance tests. */
  correctness: number;
  performance?: number;
  total: number;
  /** Why the score was forced to 0, when it was. */
  zeroedBy?: 'compile' | 'no-change' | 'too-many-changes';
}

export function scoreTask(result: TaskResult): TaskScore {
  const correctness = share(tally(result, 'correctness'));
  const perf = tally(result, 'performance');
  const performance = result.type === 'algorithmic' && perf.total > 0 ? share(perf) : undefined;

  let zeroedBy: TaskScore['zeroedBy'];
  if (result.compileErrors) zeroedBy = 'compile';
  else if (result.changedLines && result.changedLines.changed === 0) zeroedBy = 'no-change';
  else if (result.changedLines && result.changedLines.changed > result.changedLines.limit) {
    zeroedBy = 'too-many-changes';
  }

  const total = zeroedBy
    ? 0
    : performance === undefined
      ? correctness
      : (correctness + performance) / 2;
  return {
    correctness: zeroedBy ? 0 : correctness,
    ...(performance === undefined ? {} : { performance: zeroedBy ? 0 : performance }),
    total,
    ...(zeroedBy ? { zeroedBy } : {}),
  };
}

export function scoreTest(results: readonly TaskResult[]): number {
  if (results.length === 0) return 0;
  return results.reduce((sum, r) => sum + scoreTask(r).total, 0) / results.length;
}

/** 0.625 → 62. A tiny epsilon keeps 0.29 * 100 = 28.999... from showing as 28. */
export const percent = (value: number): number => Math.floor(value * 100 + 1e-9);

export interface TallyFacts {
  type: TaskType;
  correctness: GroupTally;
  performance: GroupTally;
  zeroedBy?: TaskScore['zeroedBy'];
}

/** A task's score from the tallies an online_test_submitted event keeps. */
export function scoreFromTallies(facts: TallyFacts): number {
  if (facts.zeroedBy) return 0;
  const correctness = share(facts.correctness);
  if (facts.type !== 'algorithmic' || facts.performance.total === 0) return correctness;
  return (correctness + share(facts.performance)) / 2;
}

export function scoreTallies(tasks: readonly TallyFacts[]): number {
  if (tasks.length === 0) return 0;
  return tasks.reduce((sum, t) => sum + scoreFromTallies(t), 0) / tasks.length;
}
