import type {
  CodeRunner,
  RunError,
  RunResult,
  RunSignal,
  RunnerLanguage,
} from '../ports/code-runner';

/*
 * Scores a submission the way online assessment platforms do (docs/INTERVIEWS.md,
 * section 2): against tests the learner never sees, one verdict per test, with
 * performance tests that fail on time alone.
 *
 * Each test runs in its own sandbox run. A slow or looping test then costs only its own
 * verdict, and a performance test gets its own time budget, without a change to the
 * runner protocol: a preamble in front of the test source keeps one `test()` call and
 * drops the rest. `test` is a writable global of the harness, so the preamble can wrap it.
 * Python has no such global to wrap from outside, so its harness honours a directive line.
 */

/** The prefix is a marker as much as code: the scripted runner in the unit tests reads it. */
function preamble(only: number): string {
  const keep = only < 0 ? 'keep(name, function () {});' : 'if (seen === __only) keep(name, fn);';
  return (
    `var __only = ${only};\n` +
    '(function () {\n' +
    '  var keep = globalThis.test;\n' +
    '  var seen = -1;\n' +
    '  var wrapped = function (name, fn) {\n' +
    '    seen += 1;\n' +
    `    ${keep}\n` +
    '  };\n' +
    '  globalThis.test = wrapped;\n' +
    '  globalThis.it = wrapped;\n' +
    '})();\n'
  );
}

/**
 * The Python harness reads this one line itself (src/core/running/python-harness.ts) and
 * strips it before it compiles the tests, so line numbers in a failure stay the author's.
 */
function pythonDirective(only: number): string {
  return `__only = ${only}\n`;
}

function withPreamble(tests: string, only: number, language: RunnerLanguage): string {
  return (language === 'python' ? pythonDirective(only) : preamble(only)) + tests;
}

/** Registers every test with an empty body, so a run lists the names and nothing else. */
export function listTests(tests: string, language: RunnerLanguage = 'js'): string {
  return withPreamble(tests, -1, language);
}

/** Keeps only the test at `index`, counted in the order the file calls `test()`. */
export function isolateTest(tests: string, index: number, language: RunnerLanguage = 'js'): string {
  return withPreamble(tests, index, language);
}

export type TestKind = 'correctness' | 'performance';

/** OK, WRONG ANSWER, TIMEOUT ERROR and RUNTIME ERROR in the platforms' reports. */
export type TestOutcome = 'passed' | 'wrong-answer' | 'timeout' | 'error';

export interface TestVerdict {
  name: string;
  kind: TestKind;
  outcome: TestOutcome;
  message?: string;
}

export interface Tally {
  passed: number;
  total: number;
}

export interface TaskReport {
  stepId: string;
  correctness: Tally;
  performance: Tally;
  tests: TestVerdict[];
  /** Set when the submission does not parse or throws while loading: every test fails. */
  loadError?: RunError;
}

export interface AssessedTask {
  stepId: string;
  language: RunnerLanguage;
  hiddenCode: string | undefined;
  performanceCode: string | undefined;
  /** Per performance test. */
  timeLimitMs?: number;
}

export interface EvaluateOptions {
  /** Per correctness test. Generous: correctness tests use small inputs. */
  correctnessTimeoutMs?: number;
  signal?: RunSignal;
  /** Called after each test with how many are done and how many there are. */
  onProgress?: (done: number, total: number) => void;
  /**
   * Ends the run after the first verdict it returns true for, leaving later tests out of
   * the report. The build gate uses it: one timeout is all a brute force has to show.
   */
  stopAfter?: (verdict: TestVerdict) => boolean;
}

const DEFAULT_CORRECTNESS_MS = 3000;
const DEFAULT_TIME_LIMIT_MS = 2000;

/** The harness reports an assertion as its message and a thrown error as "Name: message". */
const THROWN = /^[A-Za-z]*(Error|Exception|Thrown)\b/;

function verdictOf(result: RunResult): { outcome: TestOutcome; message?: string } {
  if (result.status === 'timeout') return { outcome: 'timeout' };
  if (result.status === 'passed') return { outcome: 'passed' };
  const failed = result.tests.find((t) => !t.passed);
  if (failed) {
    const message = failed.message;
    const outcome = message !== undefined && THROWN.test(message) ? 'error' : 'wrong-answer';
    return message === undefined ? { outcome } : { outcome, message };
  }
  const error = result.error;
  return error
    ? { outcome: 'error', message: `${error.name}: ${error.message}` }
    : { outcome: 'error' };
}

/** A load failure registers no tests at all, which a failing assertion never does. */
function isLoadError(result: RunResult): boolean {
  return result.status === 'error' && result.tests.length === 0 && result.error !== undefined;
}

let serial = 0;
function runId(stepId: string, label: string): string {
  serial += 1;
  return `${stepId}-${label}-${serial.toString(36)}`.slice(-64);
}

export async function evaluateTask(
  runner: CodeRunner,
  task: AssessedTask,
  code: string,
  options: EvaluateOptions = {},
): Promise<TaskReport> {
  const suites: { kind: TestKind; source: string; timeoutMs: number }[] = [];
  if (task.hiddenCode !== undefined) {
    suites.push({
      kind: 'correctness',
      source: task.hiddenCode,
      timeoutMs: options.correctnessTimeoutMs ?? DEFAULT_CORRECTNESS_MS,
    });
  }
  if (task.performanceCode !== undefined) {
    suites.push({
      kind: 'performance',
      source: task.performanceCode,
      timeoutMs: task.timeLimitMs ?? DEFAULT_TIME_LIMIT_MS,
    });
  }

  // Listed with no learner code, so a submission that does not load still shows how
  // many tests it lost.
  const planned: {
    kind: TestKind;
    source: string;
    timeoutMs: number;
    index: number;
    name: string;
  }[] = [];
  for (const suite of suites) {
    const listed = await runner.run(
      {
        runId: runId(task.stepId, 'list'),
        language: task.language,
        code: '',
        tests: listTests(suite.source, task.language),
        timeoutMs: DEFAULT_CORRECTNESS_MS,
        harnessVersion: 1,
      },
      options.signal,
    );
    listed.tests.forEach((test, index) => {
      planned.push({ ...suite, index, name: test.name });
    });
  }

  const tests: TestVerdict[] = [];
  let loadError: RunError | undefined;
  for (const test of planned) {
    if (loadError !== undefined || options.signal?.aborted === true) {
      tests.push({
        name: test.name,
        kind: test.kind,
        outcome: 'error',
        ...(loadError ? { message: `${loadError.name}: ${loadError.message}` } : {}),
      });
      continue;
    }
    const result = await runner.run(
      {
        runId: runId(task.stepId, test.kind === 'performance' ? 'perf' : 'test'),
        language: task.language,
        code,
        tests: isolateTest(test.source, test.index, task.language),
        timeoutMs: test.timeoutMs,
        harnessVersion: 1,
      },
      options.signal,
    );
    if (isLoadError(result)) loadError = result.error;
    const verdict: TestVerdict = { name: test.name, kind: test.kind, ...verdictOf(result) };
    tests.push(verdict);
    options.onProgress?.(tests.length, planned.length);
    if (options.stopAfter?.(verdict) === true) break;
  }

  const tally = (kind: TestKind): Tally => {
    const ofKind = tests.filter((t) => t.kind === kind);
    return { passed: ofKind.filter((t) => t.outcome === 'passed').length, total: ofKind.length };
  };
  return {
    stepId: task.stepId,
    correctness: tally('correctness'),
    performance: tally('performance'),
    tests,
    ...(loadError ? { loadError } : {}),
  };
}

export interface TaskScore {
  correctness: number;
  /** Absent when the task has no performance tests. */
  performance?: number;
  /** Every test counts once, so a task's score is the share of all its tests passed. */
  total: number;
}

const share = ({ passed, total }: Tally): number => (total === 0 ? 0 : passed / total);

export function scoreTask(report: TaskReport): TaskScore {
  const all = {
    passed: report.correctness.passed + report.performance.passed,
    total: report.correctness.total + report.performance.total,
  };
  return {
    correctness: share(report.correctness),
    ...(report.performance.total > 0 ? { performance: share(report.performance) } : {}),
    total: share(all),
  };
}

/** Tasks weigh the same, as in a default platform test. */
export function scoreAssessment(reports: readonly TaskReport[]): number {
  if (reports.length === 0) return 0;
  return reports.reduce((sum, r) => sum + scoreTask(r).total, 0) / reports.length;
}

const OUTCOME_MESSAGE: Record<Exclude<TestOutcome, 'passed'>, string> = {
  'wrong-answer': 'Wrong answer',
  timeout: 'Timed out',
  error: 'Runtime error',
};

/** The shape `gradeRun` scores, so an assessed task is graded like any code challenge. */
export function toRunResult(report: TaskReport): RunResult {
  const tests = report.tests.map((t) =>
    t.outcome === 'passed'
      ? { name: t.name, passed: true }
      : { name: t.name, passed: false, message: t.message ?? OUTCOME_MESSAGE[t.outcome] },
  );
  const status = tests.length === 0 ? 'error' : tests.every((t) => t.passed) ? 'passed' : 'failed';
  return { status, tests, logs: [] };
}

/** Whole seconds, rounded up, so the clock shows 0 only when time is really up. */
export function secondsLeft(startedAt: number, minutes: number, now: number): number {
  return Math.max(0, Math.ceil((startedAt + minutes * 60_000 - now) / 1000));
}
