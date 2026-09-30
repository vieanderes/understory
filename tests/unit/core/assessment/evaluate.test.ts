import { describe, expect, it } from 'vitest';
import {
  evaluateTask,
  isolateTest,
  listTests,
  scoreAssessment,
  scoreTask,
  secondsLeft,
  toRunResult,
  type TaskReport,
} from '@/core/assessment';
import type { CodeRunner, RunRequest, RunResult } from '@/core/ports/code-runner';

/**
 * A runner that reads which test a request isolates from the preamble and answers from
 * a script. The real preamble is exercised against the Node runner in
 * tests/unit/adapters/node-runner/assessment.test.ts.
 */
function scriptedRunner(
  answer: (req: RunRequest, only: number | 'list') => RunResult,
): CodeRunner & { requests: RunRequest[] } {
  const requests: RunRequest[] = [];
  return {
    requests,
    run(req) {
      requests.push(req);
      const match = /__only = (\d+|-1)/.exec(req.tests);
      const only = match && match[1] !== '-1' ? Number(match[1]) : 'list';
      return Promise.resolve(answer(req, only));
    },
  };
}

const names = ['small', 'one item', 'all negative'];
const perfNames = ['large: 100k'];

function listing(list: string[]): RunResult {
  return { status: 'passed', tests: list.map((name) => ({ name, passed: true })), logs: [] };
}

describe('the test preambles', () => {
  it('listing keeps the source and replaces every body', () => {
    const source = "test('a', () => {});";
    const listed = listTests(source);
    expect(listed.endsWith(source)).toBe(true);
    expect(listed).toContain('__only = -1');
  });

  it('isolating names the index to keep', () => {
    expect(isolateTest("test('a', () => {});", 3)).toContain('__only = 3');
  });

  it('gives Python one directive line that the Python harness reads', () => {
    const source = '@test("a")\ndef _():\n    pass\n';
    expect(isolateTest(source, 2, 'python')).toBe(`__only = 2\n${source}`);
    expect(listTests(source, 'python')).toBe(`__only = -1\n${source}`);
  });

  it('keeps the JavaScript preamble for js and ts', () => {
    expect(isolateTest('x', 0, 'ts')).toContain('globalThis.test = wrapped');
    expect(listTests('x', 'js')).toContain('var __only = -1');
  });
});

describe('evaluateTask in Python', () => {
  it('sends the Python directive, not the JavaScript preamble', async () => {
    const runner = scriptedRunner((_req, only) =>
      only === 'list' ? listing(['a', 'b']) : listing(['x']),
    );
    await evaluateTask(
      runner,
      { stepId: 'py', language: 'python', hiddenCode: 'tests', performanceCode: undefined },
      'def f(): pass',
    );
    expect(runner.requests.every((r) => r.language === 'python')).toBe(true);
    expect(runner.requests.map((r) => r.tests.split('\n')[0])).toEqual([
      '__only = -1',
      '__only = 0',
      '__only = 1',
    ]);
  });
});

describe('evaluateTask', () => {
  const task = {
    stepId: 'write-missing',
    language: 'ts' as const,
    hiddenCode: 'hidden',
    performanceCode: 'performance',
    timeLimitMs: 1500,
  };

  it('runs each hidden and performance test alone and scores them', async () => {
    const runner = scriptedRunner((req, only) => {
      if (only === 'list') return listing(req.tests.endsWith('hidden') ? names : perfNames);
      if (req.tests.endsWith('performance')) {
        return { status: 'timeout', tests: [], logs: [] };
      }
      const passed = only !== 2;
      return {
        status: passed ? 'passed' : 'failed',
        tests: [{ name: names[only] ?? '', passed, ...(passed ? {} : { message: 'Expected -1' }) }],
        logs: [],
      };
    });

    const report = await evaluateTask(runner, task, 'code');

    expect(report.correctness).toEqual({ passed: 2, total: 3 });
    expect(report.performance).toEqual({ passed: 0, total: 1 });
    expect(report.tests.map((t) => [t.name, t.kind, t.outcome])).toEqual([
      ['small', 'correctness', 'passed'],
      ['one item', 'correctness', 'passed'],
      ['all negative', 'correctness', 'wrong-answer'],
      ['large: 100k', 'performance', 'timeout'],
    ]);
    expect(report.tests[2]?.message).toBe('Expected -1');
    // Listing runs use no learner code, so a broken submission cannot hide the test count.
    const lists = runner.requests.filter((r) => r.tests.includes('__only = -1'));
    expect(lists.every((r) => r.code === '')).toBe(true);
    const perf = runner.requests.find(
      (r) => r.tests.includes('__only = 0') && r.tests.endsWith('performance'),
    );
    expect(perf?.timeoutMs).toBe(1500);
  });

  it('scores a submission that does not load as zero, without running every test', async () => {
    const runner = scriptedRunner((req, only) => {
      if (only === 'list') return listing(req.tests.endsWith('hidden') ? names : perfNames);
      return {
        status: 'error',
        tests: [],
        logs: [],
        error: { name: 'SyntaxError', message: 'Unexpected token', line: 2 },
      };
    });

    const report = await evaluateTask(runner, task, 'broken(');

    expect(report.loadError).toEqual({ name: 'SyntaxError', message: 'Unexpected token', line: 2 });
    expect(report.correctness).toEqual({ passed: 0, total: 3 });
    expect(report.performance).toEqual({ passed: 0, total: 1 });
    expect(report.tests.every((t) => t.outcome === 'error')).toBe(true);
    // Two listings and the one run that found the error.
    expect(runner.requests).toHaveLength(3);
  });

  it('marks a thrown error in one test as a runtime error for that test only', async () => {
    const runner = scriptedRunner((req, only) => {
      if (only === 'list') return listing(names);
      if (only === 1) {
        return {
          status: 'failed',
          tests: [{ name: 'one item', passed: false, message: 'TypeError: x is undefined' }],
          logs: [],
        };
      }
      return { status: 'passed', tests: [{ name: names[only] ?? '', passed: true }], logs: [] };
    });

    const report = await evaluateTask(runner, { ...task, performanceCode: undefined }, 'code');

    expect(report.tests.map((t) => t.outcome)).toEqual(['passed', 'error', 'passed']);
    expect(report.performance).toEqual({ passed: 0, total: 0 });
  });

  it('treats a task without hidden tests as having none', async () => {
    const runner = scriptedRunner(() => listing([]));
    const report = await evaluateTask(
      runner,
      { stepId: 's', language: 'js', hiddenCode: undefined, performanceCode: undefined },
      'code',
    );
    expect(report.tests).toEqual([]);
    expect(runner.requests).toEqual([]);
  });

  it('stops after the first verdict that settles the question', async () => {
    const runner = scriptedRunner((req, only) => {
      if (only === 'list') return listing(req.tests.endsWith('hidden') ? names : ['a', 'b', 'c']);
      if (req.tests.endsWith('performance')) return { status: 'timeout', tests: [], logs: [] };
      return { status: 'passed', tests: [{ name: 'x', passed: true }], logs: [] };
    });
    const report = await evaluateTask(runner, task, 'code', {
      stopAfter: (verdict) => verdict.outcome === 'timeout',
    });
    // Three hidden tests, then one performance test that times out, and nothing after.
    expect(report.tests.map((t) => t.outcome)).toEqual(['passed', 'passed', 'passed', 'timeout']);
    expect(report.performance).toEqual({ passed: 0, total: 1 });
  });

  it('stops early when asked to', async () => {
    const runner = scriptedRunner((req, only) =>
      only === 'list'
        ? listing(names)
        : { status: 'passed', tests: [{ name: 'x', passed: true }], logs: [] },
    );
    const controller = { aborted: false };
    const seen: number[] = [];
    const report = await evaluateTask(runner, { ...task, performanceCode: undefined }, 'code', {
      signal: controller,
      onProgress: (done) => {
        seen.push(done);
        if (done === 1) controller.aborted = true;
      },
    });
    expect(seen).toEqual([1]);
    expect(report.tests.map((t) => t.outcome)).toEqual(['passed', 'error', 'error']);
  });
});

function report(correct: [number, number], perf: [number, number]): TaskReport {
  return {
    stepId: 'x',
    correctness: { passed: correct[0], total: correct[1] },
    performance: { passed: perf[0], total: perf[1] },
    tests: [],
  };
}

describe('scoring', () => {
  it('scores a task as the share of every test passed, as the platforms do', () => {
    expect(scoreTask(report([4, 4], [1, 4]))).toMatchObject({
      correctness: 1,
      performance: 0.25,
      total: 5 / 8,
    });
  });

  it('leaves performance out when a task has no performance tests', () => {
    expect(scoreTask(report([3, 4], [0, 0]))).toEqual({ correctness: 0.75, total: 0.75 });
  });

  it('scores a task with no tests at all as zero', () => {
    expect(scoreTask(report([0, 0], [0, 0])).total).toBe(0);
  });

  it('averages tasks with equal weight', () => {
    expect(scoreAssessment([report([4, 4], [4, 4]), report([0, 4], [0, 4])])).toBe(0.5);
    expect(scoreAssessment([])).toBe(0);
  });

  it('turns a report into a run result the grader understands', () => {
    const result = toRunResult({
      stepId: 'x',
      correctness: { passed: 1, total: 1 },
      performance: { passed: 0, total: 1 },
      tests: [
        { name: 'a', kind: 'correctness', outcome: 'passed' },
        { name: 'b', kind: 'performance', outcome: 'timeout' },
      ],
    });
    expect(result.status).toBe('failed');
    expect(result.tests).toEqual([
      { name: 'a', passed: true },
      { name: 'b', passed: false, message: 'Timed out' },
    ]);
  });

  it('a full pass is a passed run', () => {
    const result = toRunResult({
      stepId: 'x',
      correctness: { passed: 1, total: 1 },
      performance: { passed: 0, total: 0 },
      tests: [{ name: 'a', kind: 'correctness', outcome: 'passed' }],
    });
    expect(result.status).toBe('passed');
  });

  it('an empty report is an error run, never a pass', () => {
    expect(toRunResult(report([0, 0], [0, 0])).status).toBe('error');
  });
});

describe('secondsLeft', () => {
  const start = Date.parse('2026-09-23T10:00:00Z');
  it('counts down from the minutes allowed', () => {
    expect(secondsLeft(start, 90, start)).toBe(5400);
    expect(secondsLeft(start, 90, start + 61_500)).toBe(5339);
  });
  it('never goes below zero', () => {
    expect(secondsLeft(start, 1, start + 3_600_000)).toBe(0);
  });
});
