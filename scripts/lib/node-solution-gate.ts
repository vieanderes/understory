import { transform } from 'sucrase';
import { NodePyodideRunner } from '../../src/adapters/node-runner/pyodide-runner';
import { NodeWorkerRunner } from '../../src/adapters/node-runner/worker-runner';
import { createSucraseTranspiler } from '../../src/adapters/transpile/sucrase';
import { createNodeProgramChecker } from '../../src/adapters/typecheck/node';
import { evaluateTask, type TaskReport } from '../../src/core/assessment';
import type { Issue } from '../../src/core/content/catalog';
import { byLanguage } from '../../src/core/running/by-language';
import type { CodeRunner, RunResult, RunnerLanguage } from '../../src/core/ports/code-runner';
import { describeDiagnostics, normaliseDiagnostics } from '../../src/core/typecheck/diagnostics';
import { typecheckOf } from '../../src/core/typecheck/verdict';
import type { SolutionGate } from './solution-gate';

/*
 * The solution gate, backed by the Node runner. For every code-challenge:
 *
 *   1. the reference solution passes every test,
 *   2. the starter does not (failed, error and timeout all count as "not passing"),
 *   3. the tests register at least two tests.
 *
 * For a type-checked step (src/core/typecheck/verdict.ts) also, with the same compiler
 * program as the editor's checker:
 *
 *   6. the reference solution type-checks,
 *   7. the starter type-checks, so a learner does not meet red underlines before typing,
 *      unless the step sets `expectStarterTypeError`: then the starter must have a type
 *      error, and may pass the tests, because the error is what it gets wrong.
 *
 * For an assessment task (docs/INTERVIEWS.md) also:
 *
 *   4. the solution passes every hidden and performance test, each performance test in
 *      half its time limit, so a slower browser still has room,
 *   5. a brute force, when given, passes every hidden test and times out on at least one
 *      performance test, which proves the performance tests measure the complexity.
 *
 * It runs the same harness string and the same transpiler as the browser sandbox, so a
 * green gate means a learner who types the reference solution sees green too. Python
 * runs through the same Pyodide build the browser loads, with the Python harness.
 *
 * Wire it in scripts/validate-content.ts: `checkContent(root, nodeSolutionGate)`.
 */

export interface ChallengeInput {
  /** Path of the lesson file, used as the issue path. */
  lessonPath: string;
  stepId: string;
  language: RunnerLanguage;
  starter: string;
  solution: string;
  tests: string;
  hidden?: string;
  performance?: string;
  bruteForce?: string;
  timeLimitMs?: number;
  /** The step is type-checked. Default off, so a bare call checks behaviour only. */
  typecheck?: boolean;
  expectStarterTypeError?: boolean;
}

export interface GateOptions {
  runner?: CodeRunner;
  /** Per run. Lessons finish in milliseconds; the slack is for a loaded CI machine. */
  timeoutMs?: number;
  /** Worker threads alive at once, across every challenge checked through this gate. */
  concurrency?: number;
}

const MIN_TESTS = 2;
// Only a guard against endless loops: speed is judged by performance tests and their own
// timeLimitMs. The largest honest challenge takes about half a second alone, and a machine
// under heavy load (a load average near 30 was seen) stretched that past 5 seconds.
const DEFAULT_TIMEOUT_MS = 20_000;
const DEFAULT_CONCURRENCY = 4;

/**
 * The validator starts every challenge at once. Without a limit a large catalogue would
 * spawn hundreds of threads, and honest solutions would time out waiting for a core.
 */
function createLimiter(max: number): <T>(task: () => Promise<T>) => Promise<T> {
  let running = 0;
  const waiting: (() => void)[] = [];
  return async (task) => {
    if (running >= max) await new Promise<void>((resolve) => waiting.push(resolve));
    running += 1;
    try {
      return await task();
    } finally {
      running -= 1;
      waiting.shift()?.();
    }
  };
}

function describeFailure(result: RunResult): string {
  if (result.status === 'timeout') return 'it did not finish in time';
  if (result.error) {
    const line = result.error.line === undefined ? '' : ` (line ${result.error.line})`;
    return `${result.error.name}: ${result.error.message}${line}`;
  }
  const failed = result.tests.find((test) => !test.passed);
  return failed ? `test "${failed.name}" failed: ${failed.message ?? 'no message'}` : 'unknown';
}

export function createChallengeChecker(
  options: GateOptions = {},
): (input: ChallengeInput) => Promise<Issue[]> {
  const runner =
    options.runner ??
    byLanguage({
      script: new NodeWorkerRunner(createSucraseTranspiler(transform)),
      // Started on the first Python challenge, and kept warm for the rest.
      python: () => new NodePyodideRunner(),
    });
  const timeoutMs = options.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  const limit = createLimiter(options.concurrency ?? DEFAULT_CONCURRENCY);

  return async (input) => {
    const issue = (message: string): Issue => ({
      severity: 'error',
      path: input.lessonPath,
      where: input.stepId,
      message,
      rule: 'solution-gate',
    });
    const run = (code: string, label: string): Promise<RunResult> =>
      limit(() =>
        runner.run({
          runId: `gate-${label}-${input.stepId}`.slice(0, 64),
          language: input.language,
          code,
          tests: input.tests,
          timeoutMs,
          harnessVersion: 1,
        }),
      );

    const [solution, starter] = await Promise.all([
      run(input.solution, 'solution'),
      run(input.starter, 'starter'),
    ]);

    const issues: Issue[] = [];
    if (solution.status !== 'passed') {
      issues.push(
        issue(
          `The reference solution does not pass its tests: ${describeFailure(solution)}. Fix the solution or the tests.`,
        ),
      );
    }
    // Counted on the solution run: a starter that throws while loading registers nothing.
    // When the solution itself failed to load there is no count, and one issue is enough.
    const counted = solution.status === 'passed' || solution.status === 'failed';
    if (counted && solution.tests.length < MIN_TESTS) {
      issues.push(
        issue(
          `The tests register ${solution.tests.length} test${solution.tests.length === 1 ? '' : 's'}. A challenge needs at least ${MIN_TESTS}, so that one lucky return value cannot pass it.`,
        ),
      );
    }
    const typeIssues = input.typecheck === true ? checkTypes(input) : null;
    issues.push(...(typeIssues?.issues ?? []).map(issue));
    // A starter whose only fault is the type error it was written to have.
    const excused = input.expectStarterTypeError === true && typeIssues?.starterHasErrors === true;
    if (starter.status === 'passed' && !excused) {
      issues.push(
        issue(
          'The starter already passes every test, so there is nothing to solve. Remove the answer from the starter or add a test that it fails.',
        ),
      );
    }
    if (input.hidden !== undefined)
      issues.push(...(await checkAssessed(input, runner, limit, issue)));
    return issues;
  };
}

let programChecker: ReturnType<typeof createNodeProgramChecker> | null = null;

/** Type errors in the learner's file, as the editor would underline them. */
function typeErrors(code: string, tests: string) {
  programChecker ??= createNodeProgramChecker();
  return normaliseDiagnostics(programChecker({ code, tests }), code);
}

function checkTypes(input: ChallengeInput): { issues: string[]; starterHasErrors: boolean } {
  const issues: string[] = [];
  const solution = typeErrors(input.solution, input.tests);
  if (solution.length > 0) {
    issues.push(
      `The reference solution has type errors, so it could never pass in the editor:\n${describeDiagnostics(solution)}`,
    );
  }
  const starter = typeErrors(input.starter, input.tests);
  if (input.expectStarterTypeError === true && starter.length === 0) {
    issues.push(
      'The step sets "expectStarterTypeError", but the starter type-checks cleanly. Put the type error the learner is to fix into the starter, or remove the setting.',
    );
  }
  if (input.expectStarterTypeError !== true && starter.length > 0) {
    issues.push(
      `The starter has type errors, so a learner meets red underlines before typing anything:\n${describeDiagnostics(starter)}\nFix the starter, or set "expectStarterTypeError: true" if fixing that error is the task.`,
    );
  }
  return { issues, starterHasErrors: starter.length > 0 };
}

const DEFAULT_TIME_LIMIT_MS = 2000;

function firstMiss(report: TaskReport): string {
  const miss = report.tests.find((t) => t.outcome !== 'passed');
  if (!miss) return 'unknown';
  return `"${miss.name}" (${miss.outcome}${miss.message ? `: ${miss.message}` : ''})`;
}

async function checkAssessed(
  input: ChallengeInput,
  runner: CodeRunner,
  limit: <T>(task: () => Promise<T>) => Promise<T>,
  issue: (message: string) => Issue,
): Promise<Issue[]> {
  const timeLimitMs = input.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS;
  const task = {
    stepId: input.stepId,
    language: input.language,
    hiddenCode: input.hidden,
    performanceCode: input.performance,
  };
  const issues: Issue[] = [];
  const halfLimit = { ...task, timeLimitMs: Math.max(100, Math.floor(timeLimitMs / 2)) };
  let solution = await limit(() => evaluateTask(runner, halfLimit, input.solution));
  // A busy machine, such as a full test suite running beside the gate, can push an honest
  // run past half the limit. A wrong answer is never retried; a timeout gets one more run,
  // with the full limit, before it counts.
  const onlyTimeouts = solution.tests.every(
    (t) => t.outcome === 'passed' || t.outcome === 'timeout',
  );
  if (onlyTimeouts && solution.tests.some((t) => t.outcome === 'timeout')) {
    solution = await limit(() => evaluateTask(runner, { ...task, timeLimitMs }, input.solution));
  }
  if (solution.correctness.total < MIN_TESTS) {
    issues.push(
      issue(
        `The hidden tests register ${solution.correctness.total}. An assessment task needs at least ${MIN_TESTS}.`,
      ),
    );
  }
  if (solution.tests.some((t) => t.outcome !== 'passed')) {
    issues.push(
      issue(
        `The reference solution does not pass every hidden and performance test within the time limit, even on a second try: ${firstMiss(solution)}. Speed it up, shrink the input or raise "timeLimitMs".`,
      ),
    );
  }
  if (input.bruteForce !== undefined) {
    const brute = await limit(() =>
      evaluateTask(runner, { ...task, timeLimitMs }, input.bruteForce ?? '', {
        stopAfter: (verdict) => verdict.kind === 'performance' && verdict.outcome === 'timeout',
      }),
    );
    if (brute.correctness.passed < brute.correctness.total) {
      issues.push(
        issue(
          `The brute force fails a hidden test: ${firstMiss(brute)}. It must be correct, only slow.`,
        ),
      );
    }
    if (
      brute.performance.total > 0 &&
      !brute.tests.some((t) => t.kind === 'performance' && t.outcome === 'timeout')
    ) {
      issues.push(
        issue(
          'The brute force passes every performance test in time, so they do not measure the complexity. Make the large inputs larger.',
        ),
      );
    }
  }
  return issues;
}

/** The plain-function form: one challenge in, issues out. */
export const checkChallenge = createChallengeChecker();

export function createNodeSolutionGate(options: GateOptions = {}): SolutionGate {
  const check = createChallengeChecker(options);
  return (lesson, step, files) =>
    check({
      lessonPath: lesson.path,
      stepId: step.id,
      language: step.language,
      starter: files.starter,
      solution: files.solution,
      tests: files.tests,
      ...(files.hidden === undefined ? {} : { hidden: files.hidden }),
      ...(files.performance === undefined ? {} : { performance: files.performance }),
      ...(files.bruteForce === undefined ? {} : { bruteForce: files.bruteForce }),
      ...(step.timeLimitMs === undefined ? {} : { timeLimitMs: step.timeLimitMs }),
      typecheck: typecheckOf(step),
      expectStarterTypeError: step.expectStarterTypeError === true,
    });
}

export const nodeSolutionGate: SolutionGate = createNodeSolutionGate();
