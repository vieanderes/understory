import { describe, expect, it } from 'vitest';
import {
  evaluateSubmission,
  hashValue,
  inputSize,
  limitFor,
  PYTHON_TIME_FACTOR,
  RESULT_MARKER,
  RUN_LIMIT_MS,
  runExamples,
  runnerBudget,
  starterCode,
  type CompiledTask,
} from '@/core/online-test';
import type { CodeRunner, RunRequest, RunResult } from '@/core/ports/code-runner';

/** Answers each case from a function of its arguments, as if the code had returned it. */
function fakeRunner(
  answer: (args: unknown, req: RunRequest) => RunResult | { value: unknown; ms?: number },
): CodeRunner & {
  requests: RunRequest[];
} {
  const requests: RunRequest[] = [];
  return {
    requests,
    run(req) {
      requests.push(req);
      const literal = /var __ot_args = (.*);\n/.exec(req.tests)?.[1] ?? 'null';
      const args: unknown = literal.startsWith('__ot_gen') ? 'generated' : JSON.parse(literal);
      const out = answer(args, req);
      if ('status' in out) return Promise.resolve(out);
      const j = JSON.stringify(out.value);
      const envelope = { h: hashValue(out.value), j, n: j.length, ms: out.ms ?? 1, s: 100 };
      return Promise.resolve({
        status: 'failed',
        tests: [
          {
            name: 'case',
            passed: false,
            message: `Error: ${RESULT_MARKER}${JSON.stringify(envelope)}`,
          },
        ],
        logs: [],
      });
    },
  };
}

const signature = { params: [{ name: 'A', type: 'int[]' as const }], returns: 'int' as const };

const task: CompiledTask = {
  id: 'smallest-absent',
  title: 'SmallestAbsent',
  topic: 'counting-elements',
  difficulty: 'easy',
  type: 'algorithmic',
  recommendedMinutes: 20,
  signature,
  statementHtml: '<p>x</p>',
  starters: {
    js: starterCode(signature, 'js'),
    ts: starterCode(signature, 'ts'),
    python: starterCode(signature, 'python'),
  },
  examples: [
    { args: [[1, 3, 6, 4, 1, 2]], expected: 5, expectedHash: hashValue(5) },
    { args: [[-1, -3]], expected: 1, expectedHash: '' },
  ],
  tests: [
    {
      name: 'extreme_single',
      description: 'a single element',
      group: 'correctness',
      cases: [
        { input: { args: [[1]] }, expected: { hash: hashValue(2), preview: '2' } },
        { input: { args: [[2]] }, expected: { hash: hashValue(1), preview: '1' } },
      ],
    },
    {
      name: 'large_random',
      description: 'N = 100,000',
      group: 'performance',
      cases: [
        {
          input: { generate: { seed: 1, args: [{ kind: 'ints', n: 100_000, min: 1, max: 9 }] } },
          expected: { hash: hashValue(10), preview: '10' },
        },
      ],
    },
  ],
  timeLimitMs: 1000,
};

const smallestAbsent = (args: unknown): number => {
  if (args === 'generated') return 10;
  const [values] = args as [number[]];
  const seen = new Set(values);
  let n = 1;
  while (seen.has(n)) n++;
  return n;
};

describe('limits', () => {
  it('scales performance limits for Python and leaves slack for building the input', () => {
    expect(limitFor(task, 'js', 'performance')).toBe(1000);
    expect(limitFor(task, 'python', 'performance')).toBe(1000 * PYTHON_TIME_FACTOR);
    expect(limitFor(task, 'python', 'example')).toBe(RUN_LIMIT_MS);
    expect(runnerBudget(1000, 'js')).toBeGreaterThan(1000);
    expect(runnerBudget(29_000, 'python')).toBe(30_000);
    expect(inputSize({ args: [[1, 2], 'abc', 4] })).toBe(3);
    expect(
      inputSize({
        generate: {
          seed: 1,
          args: [
            { kind: 'permutation', n: 10, drop: 2 },
            { kind: 'repeat', times: 3, unit: 'ab' },
            { kind: 'value', value: 5 },
            { kind: 'value', value: [1] },
            { kind: 'int', min: 0, max: 1 },
            { kind: 'permutation', n: 4 },
          ],
        },
      }),
    ).toBe(8);
  });
});

describe('Run', () => {
  it('runs the examples, then the custom cases, and reports bad lines without running them', async () => {
    const runner = fakeRunner((args) => ({ value: smallestAbsent(args) }));
    const cases = await runExamples(runner, task, 'ts', 'code', '[2, 3]\n[abc]');
    expect(cases.map((c) => [c.source, c.argsText])).toEqual([
      ['example', '[1, 3, 6, 4, 1, 2]'],
      ['example', '[-1, -3]'],
      ['custom', '[2, 3]'],
      ['custom', '[abc]'],
    ]);
    expect(runner.requests).toHaveLength(3);
    expect(runner.requests[0]).toMatchObject({ language: 'ts', code: 'code', harnessVersion: 1 });
  });

  it('runs code that does not load only once', async () => {
    const runner = fakeRunner(() => ({
      status: 'error',
      tests: [],
      logs: [],
      error: { name: 'SyntaxError', message: 'x' },
    }));
    const cases = await runExamples(runner, task, 'js', '(', '[1]');
    expect(runner.requests).toHaveLength(1);
    expect(cases.every((c) => 'outcome' in c && c.outcome.kind === 'load-error')).toBe(true);
  });
});

describe('scoring a submission', () => {
  it('runs every case, reports progress and collects timings from scored cases', async () => {
    const runner = fakeRunner((args) => ({
      value: smallestAbsent(args),
      ms: args === 'generated' ? 50 : 1,
    }));
    const progress: number[] = [];
    const { result, samples } = await evaluateSubmission(runner, task, 'js', 'code', {
      onProgress: (done) => progress.push(done),
    });
    expect(result.tests.map((t) => [t.name, t.group, t.cases.map((c) => c.verdict)])).toEqual([
      ['example1', 'example', ['ok']],
      ['example2', 'example', ['ok']],
      ['extreme_single', 'correctness', ['ok', 'ok']],
      ['large_random', 'performance', ['ok']],
    ]);
    expect(progress).toEqual([1, 2, 3, 4, 5]);
    expect(samples).toHaveLength(3);
  });

  it('records a timeout at its limit and its input size', async () => {
    const runner = fakeRunner((args) =>
      args === 'generated'
        ? { status: 'timeout', tests: [], logs: [] }
        : { value: smallestAbsent(args) },
    );
    const { result, samples } = await evaluateSubmission(runner, task, 'js', 'code');
    expect(result.tests[3]?.cases[0]?.verdict).toBe('timeout');
    expect(samples.at(-1)).toEqual({ size: 100_000, ms: 1000, timedOut: true });
  });

  it('runs nothing when the code does not compile', async () => {
    const runner = fakeRunner(() => ({ value: 0 }));
    const { result } = await evaluateSubmission(runner, task, 'ts', 'x', {
      compileErrors: ['error TS1005'],
    });
    expect(runner.requests).toHaveLength(0);
    expect(result.compileErrors).toEqual(['error TS1005']);
  });

  it('stops after a load failure, and after an abort', async () => {
    const broken = fakeRunner(() => ({
      status: 'error',
      tests: [],
      logs: [],
      error: { name: 'SyntaxError', message: 'x' },
    }));
    const { result } = await evaluateSubmission(broken, task, 'js', '(');
    expect(broken.requests).toHaveLength(1);
    expect(result.tests.flatMap((t) => t.cases).every((c) => c.verdict === 'runtime-error')).toBe(
      true,
    );

    const aborted = fakeRunner(() => ({ value: 0 }));
    const signal = { aborted: true };
    const stopped = await evaluateSubmission(aborted, task, 'js', 'x', { signal });
    expect(aborted.requests).toHaveLength(0);
    expect(stopped.result.tests[0]?.cases[0]?.detail).toBe('stopped');
  });

  it('counts the changed lines of a bug-fix against its starter', async () => {
    const runner = fakeRunner((args) => ({ value: smallestAbsent(args) }));
    const { result } = await evaluateSubmission(
      runner,
      { ...task, type: 'bug-fix', maxChangedLines: 2 },
      'js',
      'a\nX\nc',
      {
        starter: 'a\nb\nc',
      },
    );
    expect(result.changedLines).toEqual({ changed: 1, limit: 2 });
    const noLimit = await evaluateSubmission(runner, { ...task, type: 'bug-fix' }, 'js', 'a', {
      starter: 'a',
    });
    expect(noLimit.result.changedLines).toEqual({ changed: 0, limit: 2 });
  });
});
