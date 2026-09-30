import type { CodeRunner, RunSignal } from '../ports/code-runner';
import { changedLines } from './bugfix';
import type { TimingSample } from './complexity';
import type { ArgSpec, Generated } from './generate';
import { parseInput } from './input';
import type { RunCase } from './output';
import { caseProgram, type CaseInput } from './program';
import type { CompiledTask } from './schema';
import type { TaskResult, TestGroup, TestResult } from './score';
import type { TaskLanguage } from './signature';
import { formatArgs, formatValue, hashValue } from './values';
import { judge, readCaseRun, type CaseOutcome, type CaseVerdict } from './verdict';

/*
 * Runs a task's cases through the code-runner port: Run (the examples plus the candidate's
 * own cases) and the scoring after submit. Every case gets its own sandbox run, as in the
 * assessment evaluator (src/core/assessment/evaluate.ts), so a hang costs one verdict and
 * each case gets its own time budget.
 */

/** Run's hard limit per case, the platform's "Hard limit reached: 5.000 sec.". */
export const RUN_LIMIT_MS = 5000;
/** Correctness tests use small inputs; the limit only catches endless loops. */
export const CORRECTNESS_LIMIT_MS = 4000;
export const DEFAULT_PERFORMANCE_LIMIT_MS = 1500;
/** Pyodide runs a loop several times slower than a JavaScript engine; limits scale with it. */
export const PYTHON_TIME_FACTOR = 5;

export function limitFor(
  task: Pick<CompiledTask, 'timeLimitMs'>,
  language: TaskLanguage,
  group: TestGroup,
): number {
  const base =
    group === 'performance'
      ? task.timeLimitMs
      : group === 'example'
        ? RUN_LIMIT_MS
        : CORRECTNESS_LIMIT_MS;
  return language === 'python' && group === 'performance' ? base * PYTHON_TIME_FACTOR : base;
}

/**
 * The runner's budget covers building the input as well as the call, and only the call is
 * judged against the limit (program.ts times it). The slack pays for the building.
 */
export function runnerBudget(limitMs: number, language: TaskLanguage): number {
  return Math.min(30_000, limitMs + (language === 'python' ? 8000 : 2500));
}

function specSize(spec: ArgSpec): number {
  switch (spec.kind) {
    case 'value':
      return typeof spec.value === 'string' || Array.isArray(spec.value) ? spec.value.length : 0;
    case 'int':
      return 0;
    case 'permutation':
      return Math.max(0, spec.n - (spec.drop ?? 0));
    case 'repeat':
      return spec.times * spec.unit.length;
    default:
      return spec.n;
  }
}

/** The input size without building the input, for a case that timed out before reporting. */
export function inputSize(input: CaseInput): number {
  if ('args' in input) {
    return input.args.reduce<number>(
      (max, a) => (typeof a === 'string' || Array.isArray(a) ? Math.max(max, a.length) : max),
      0,
    );
  }
  return (input.generate as Generated).args.reduce((max, spec) => Math.max(max, specSize(spec)), 0);
}

let serial = 0;
function runId(label: string): string {
  serial += 1;
  return `ot-${label}-${serial.toString(36)}`.slice(-64);
}

export interface CaseRunOptions {
  signal?: RunSignal;
}

export async function runCase(
  runner: CodeRunner,
  language: TaskLanguage,
  code: string,
  input: CaseInput,
  limitMs: number,
  options: CaseRunOptions = {},
): Promise<CaseOutcome> {
  const result = await runner.run(
    {
      runId: runId('case'),
      language,
      code,
      tests: caseProgram(language, input),
      timeoutMs: runnerBudget(limitMs, language),
      harnessVersion: 1,
    },
    options.signal,
  );
  return readCaseRun(result);
}

/** Run: every example, then each line of test-input.txt. */
export async function runExamples(
  runner: CodeRunner,
  task: CompiledTask,
  language: TaskLanguage,
  code: string,
  inputText: string,
  options: CaseRunOptions = {},
): Promise<RunCase[]> {
  const out: RunCase[] = [];
  let loadError: CaseOutcome | undefined;
  const exec = async (args: CaseInput): Promise<CaseOutcome> => {
    // A file that does not load fails every case the same way: run it once.
    if (loadError) return loadError;
    const outcome = await runCase(runner, language, code, args, RUN_LIMIT_MS, options);
    if (outcome.kind === 'load-error') loadError = outcome;
    return outcome;
  };
  for (const example of task.examples) {
    const outcome = await exec({ args: example.args });
    out.push({
      source: 'example',
      argsText: formatArgs(example.args),
      expected: { hash: example.expectedHash, preview: formatValue(example.expected) },
      outcome,
    });
  }
  for (const line of parseInput(inputText, task.signature.params).cases) {
    if (!line.ok) {
      out.push({ source: 'custom', argsText: line.source, invalid: line.message });
      continue;
    }
    out.push({ source: 'custom', argsText: line.source, outcome: await exec({ args: line.args }) });
  }
  return out;
}

export interface SubmissionOptions extends CaseRunOptions {
  /** TypeScript compiler errors. When present nothing runs and the task scores 0. */
  compileErrors?: string[];
  /** The starter in the submitted language: bug-fix tasks count changed lines against it. */
  starter?: string;
  onProgress?: (done: number, total: number) => void;
}

export interface Submission {
  result: TaskResult;
  samples: TimingSample[];
}

interface PlannedTest {
  name: string;
  description: string;
  group: TestGroup;
  cases: { input: CaseInput; hash: string; preview: string }[];
}

function plan(task: CompiledTask): PlannedTest[] {
  const examples: PlannedTest[] = task.examples.map((example, i) => ({
    name: `example${task.examples.length > 1 ? i + 1 : ''}`,
    description: i === 0 ? 'First example test.' : `Example test ${i + 1}.`,
    group: 'example',
    cases: [
      {
        input: { args: example.args },
        hash: example.expectedHash || hashValue(example.expected),
        preview: formatValue(example.expected),
      },
    ],
  }));
  const hidden: PlannedTest[] = task.tests.map((test) => ({
    name: test.name,
    description: test.description,
    group: test.group,
    cases: test.cases.map((c) => ({
      input: c.input as CaseInput,
      hash: c.expected.hash,
      preview: c.expected.preview,
    })),
  }));
  return [...examples, ...hidden];
}

export async function evaluateSubmission(
  runner: CodeRunner,
  task: CompiledTask,
  language: TaskLanguage,
  code: string,
  options: SubmissionOptions = {},
): Promise<Submission> {
  const planned = plan(task);
  const total = planned.reduce((sum, t) => sum + t.cases.length, 0);
  const tests: TestResult[] = [];
  const samples: TimingSample[] = [];
  const compileErrors =
    options.compileErrors && options.compileErrors.length > 0 ? options.compileErrors : undefined;
  let loadError: CaseOutcome | undefined;
  let done = 0;

  for (const test of planned) {
    const limit = limitFor(task, language, test.group);
    const cases: CaseVerdict[] = [];
    for (const item of test.cases) {
      let verdict: CaseVerdict;
      if (compileErrors) verdict = { verdict: 'runtime-error', detail: 'compilation failed' };
      else if (loadError || options.signal?.aborted === true) {
        verdict = loadError
          ? judge(loadError, { hash: item.hash, preview: item.preview }, limit)
          : { verdict: 'runtime-error', detail: 'stopped' };
      } else {
        const outcome = await runCase(runner, language, code, item.input, limit, options);
        if (outcome.kind === 'load-error') loadError = outcome;
        verdict = judge(outcome, { hash: item.hash, preview: item.preview }, limit);
        if (test.group !== 'example') {
          if (outcome.kind === 'returned')
            samples.push({ size: outcome.size, ms: outcome.ms, timedOut: outcome.ms > limit });
          else if (outcome.kind === 'timeout')
            samples.push({ size: inputSize(item.input), ms: limit, timedOut: true });
        }
      }
      cases.push(verdict);
      done += 1;
      options.onProgress?.(done, total);
    }
    tests.push({ name: test.name, description: test.description, group: test.group, cases });
  }

  const result: TaskResult = {
    taskId: task.id,
    type: task.type,
    tests,
    ...(compileErrors ? { compileErrors } : {}),
    ...(task.type === 'bug-fix' && options.starter !== undefined
      ? {
          changedLines: {
            changed: changedLines(options.starter, code),
            limit: task.maxChangedLines ?? 2,
          },
        }
      : {}),
  };
  return { result, samples };
}
