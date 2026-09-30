import { describe, expect, it } from 'vitest';
import {
  allPassNote,
  detectComplexity,
  hashValue,
  judge,
  percent,
  scoreFromTallies,
  scoreTallies,
  readCaseRun,
  renderRun,
  reportLine,
  RESULT_MARKER,
  scoreTask,
  scoreTest,
  tally,
  testPassed,
  testVerdict,
  verdictLine,
  type CaseOutcome,
  type RunCase,
  type TaskResult,
} from '@/core/online-test';
import type { RunResult } from '@/core/ports/code-runner';

function reported(
  value: unknown,
  extra: Partial<{ ms: number; s: number; n: number; j: string }> = {},
): RunResult {
  const j = JSON.stringify(value);
  const envelope = { h: hashValue(value), j, n: j.length, ms: 1.5, s: 3, ...extra };
  return {
    status: 'failed',
    tests: [
      {
        name: 'case',
        passed: false,
        message: `Error: ${RESULT_MARKER}${JSON.stringify(envelope)}`,
      },
    ],
    logs: ['debug'],
  };
}

describe('reading a case run', () => {
  it('reads the envelope out of the failure message', () => {
    expect(readCaseRun(reported([1, 2]))).toEqual({
      kind: 'returned',
      hash: hashValue([1, 2]),
      json: '[1,2]',
      complete: true,
      ms: 1.5,
      size: 3,
      logs: ['debug'],
    });
    expect(readCaseRun(reported(5, { n: 9000 }))).toMatchObject({ complete: false });
  });

  it('tells a timeout, an exception and a load failure apart', () => {
    expect(readCaseRun({ status: 'timeout', tests: [], logs: [] })).toEqual({
      kind: 'timeout',
      logs: [],
    });
    expect(
      readCaseRun({
        status: 'failed',
        tests: [{ name: 'case', passed: false, message: 'TypeError: x' }],
        logs: [],
      }),
    ).toEqual({ kind: 'runtime-error', message: 'TypeError: x', logs: [] });
    expect(
      readCaseRun({ status: 'failed', tests: [{ name: 'case', passed: false }], logs: [] }),
    ).toMatchObject({ kind: 'runtime-error', message: 'Error' });
    expect(
      readCaseRun({ status: 'passed', tests: [{ name: 'case', passed: true }], logs: [] }),
    ).toMatchObject({
      kind: 'runtime-error',
      message: 'The program did not report a result.',
    });
    expect(
      readCaseRun({
        status: 'error',
        tests: [],
        logs: [],
        error: { name: 'SyntaxError', message: 'bad', line: 3 },
      }),
    ).toEqual({ kind: 'load-error', message: 'SyntaxError: bad', line: 3, logs: [] });
    expect(readCaseRun({ status: 'error', tests: [], logs: [] })).toMatchObject({
      kind: 'load-error',
      message: 'The program did not start.',
    });
  });

  it('ignores a marker without a valid report after it', () => {
    const bad = (message: string): RunResult => ({
      status: 'failed',
      tests: [{ name: 'c', passed: false, message }],
      logs: [],
    });
    expect(readCaseRun(bad(`${RESULT_MARKER}{oops`)).kind).toBe('runtime-error');
    expect(readCaseRun(bad(`${RESULT_MARKER}{"h":1}`)).kind).toBe('runtime-error');
    expect(readCaseRun(bad(`${RESULT_MARKER}null`)).kind).toBe('runtime-error');
  });
});

describe('judging', () => {
  const returned = (value: unknown, ms = 1): CaseOutcome => ({
    kind: 'returned',
    hash: hashValue(value),
    json: JSON.stringify(value),
    complete: true,
    ms,
    size: 1,
    logs: [],
  });
  const expected = { hash: hashValue(5), preview: '5' };

  it('gives the four verdicts in the platform wording', () => {
    expect(judge(returned(5), expected, 100)).toEqual({ verdict: 'ok', ms: 1, size: 1 });
    const wrong = judge(returned(1), expected, 100);
    expect(verdictLine(wrong)).toBe('WRONG ANSWER (got 1 expected 5)');
    expect(reportLine(wrong)).toBe('WRONG ANSWER, got 1 expected 5');
    expect(verdictLine(judge({ kind: 'timeout', logs: [] }, expected, 5000))).toBe(
      'TIMEOUT ERROR (Killed. Hard limit reached: 5.000 sec.)',
    );
    expect(reportLine(judge(returned(5, 2500), expected, 1000))).toBe(
      'TIMEOUT ERROR, running time: 2.50 sec., time limit: 1.00 sec.',
    );
    const crash = judge(
      { kind: 'runtime-error', message: 'TypeError: x', logs: [] },
      expected,
      100,
    );
    expect(verdictLine(crash)).toBe('RUNTIME ERROR (tested program terminated with exit code 1)');
    expect(reportLine(crash)).toBe('RUNTIME ERROR, TypeError: x');
    expect(reportLine({ verdict: 'ok' })).toBe('OK');
  });
});

describe('the Test Output transcript', () => {
  const ok: CaseOutcome = {
    kind: 'returned',
    hash: hashValue(5),
    json: '5',
    complete: true,
    ms: 1,
    size: 6,
    logs: [],
  };
  const example = (outcome: CaseOutcome): RunCase => ({
    source: 'example',
    argsText: '[1, 3, 6, 4, 1, 2]',
    expected: { hash: hashValue(5), preview: '5' },
    outcome,
  });
  const options = { limitMs: 5000, hiddenTests: 8 };

  it('passes with the closing note when every example is right', () => {
    const run = renderRun([example(ok)], options);
    expect(run.status).toBe('passed');
    expect(run.header[0]?.text).toBe('Compilation successful.');
    expect(run.blocks[0]?.lines.map((l) => [l.label, l.text])).toEqual([
      ['Example test:', '[1, 3, 6, 4, 1, 2]'],
      [undefined, 'OK'],
    ]);
    expect(run.footer).toEqual(allPassNote(8));
  });

  it('warns about printed output, and fails on a wrong example', () => {
    const wrong: CaseOutcome = { ...ok, hash: hashValue(1), json: '1', logs: ['debug 6'] };
    const run = renderRun([example(wrong)], options);
    expect(run.status).toBe('failed');
    expect(run.blocks[0]?.lines.map((l) => l.text)).toEqual([
      '[1, 3, 6, 4, 1, 2]',
      'Output:',
      'debug 6',
      'WRONG ANSWER (got 1 expected 5)',
    ]);
    expect(run.footer.map((l) => l.text)).toEqual([
      'Producing output might cause your solution to fail performance tests.',
      'You should remove code that produces output before you submit your solution.',
      'Detected some errors.',
    ]);
  });

  it('prints stderr for a crash and the line of a load failure', () => {
    const run = renderRun(
      [
        example({ kind: 'runtime-error', message: 'Error: boom\n    at solution', logs: [] }),
        example({ kind: 'load-error', message: 'SyntaxError: bad', line: 2, logs: [] }),
      ],
      options,
    );
    expect(run.blocks[0]?.lines.map((l) => l.text)).toContain('Output (stderr):');
    expect(run.blocks[1]?.lines.map((l) => l.text)).toContain('line 2');
  });

  it('shows the returned value of a custom case, and its errors', () => {
    const run = renderRun(
      [
        example(ok),
        { source: 'custom', argsText: '[2, 3]', outcome: { ...ok, json: '1' } },
        {
          source: 'custom',
          argsText: '[abc]',
          invalid: "invalid input, unexpected 'abc', expecting integer",
        },
        { source: 'custom', argsText: '[1]', outcome: { kind: 'timeout', logs: [] } },
        {
          source: 'custom',
          argsText: '[1]',
          outcome: { kind: 'runtime-error', message: 'x', logs: [] },
        },
        { source: 'custom', argsText: '[1]', outcome: { ...ok, ms: 9000 } },
      ],
      options,
    );
    expect(run.status).toBe('warning');
    expect(run.blocks[1]?.lines[1]).toEqual({ label: 'Returned value:', text: '1', tone: 'plain' });
    expect(run.blocks[2]?.lines[1]?.text).toBe(
      "RUNTIME ERROR (invalid input, unexpected 'abc', expecting integer)",
    );
    expect(run.blocks[3]?.lines[1]?.text).toContain('TIMEOUT ERROR');
    expect(run.blocks[4]?.status).toBe('error');
    expect(run.blocks[5]?.lines.at(-1)?.text).toContain('TIMEOUT ERROR (running time');
    expect(run.footer.at(-1)?.text).toBe('Detected some errors.');
  });

  it('stops at the compiler output', () => {
    const run = renderRun([example(ok)], {
      ...options,
      compileErrors: [
        "solution.ts(1,42): error TS2322: Type 'string' is not assignable to type 'number'.",
      ],
    });
    expect(run).toMatchObject({ status: 'failed', blocks: [] });
    expect(run.header.map((l) => l.text)).toEqual([
      'Compiler output:',
      "solution.ts(1,42): error TS2322: Type 'string' is not assignable to type 'number'.",
    ]);
  });
});

describe('scoring', () => {
  const pass = { verdict: 'ok' as const };
  const fail = { verdict: 'wrong-answer' as const };
  const result = (type: TaskResult['type'], extra: Partial<TaskResult> = {}): TaskResult => ({
    taskId: 't',
    type,
    tests: [
      { name: 'example', description: '', group: 'example', cases: [fail] },
      { name: 'a', description: '', group: 'correctness', cases: [pass, pass] },
      { name: 'b', description: '', group: 'correctness', cases: [pass, fail] },
      { name: 'large', description: '', group: 'performance', cases: [pass] },
      { name: 'max', description: '', group: 'performance', cases: [{ verdict: 'timeout' }] },
    ],
    ...extra,
  });

  it('scores the mean of correctness and performance, examples aside', () => {
    expect(scoreTask(result('algorithmic'))).toEqual({
      correctness: 0.5,
      performance: 0.5,
      total: 0.5,
    });
    expect(tally(result('algorithmic'), 'example')).toEqual({ passed: 0, total: 1 });
    expect(scoreTask(result('coding'))).toEqual({ correctness: 0.5, total: 0.5 });
  });

  it('zeroes code that does not compile and bug-fixes outside the limit', () => {
    expect(scoreTask(result('algorithmic', { compileErrors: ['x'] }))).toMatchObject({
      total: 0,
      zeroedBy: 'compile',
    });
    expect(scoreTask(result('bug-fix', { changedLines: { changed: 0, limit: 2 } }))).toMatchObject({
      zeroedBy: 'no-change',
    });
    expect(scoreTask(result('bug-fix', { changedLines: { changed: 3, limit: 2 } }))).toMatchObject({
      zeroedBy: 'too-many-changes',
    });
    expect(scoreTask(result('bug-fix', { changedLines: { changed: 1, limit: 2 } })).total).toBe(
      0.5,
    );
  });

  it('averages tasks and rounds down like the platform', () => {
    expect(scoreTest([])).toBe(0);
    expect(scoreTest([result('coding'), result('algorithmic', { compileErrors: ['x'] })])).toBe(
      0.25,
    );
    expect(percent(0.625)).toBe(62);
    expect(percent(0.29)).toBe(29);
    expect(testPassed({ name: '', description: '', group: 'correctness', cases: [] })).toBe(false);
    expect(
      testVerdict({
        name: '',
        description: '',
        group: 'correctness',
        cases: [pass, { verdict: 'timeout' }],
      }),
    ).toBe('timeout');
    expect(testVerdict({ name: '', description: '', group: 'correctness', cases: [] })).toBe(
      'runtime-error',
    );
    expect(scoreTask({ taskId: 't', type: 'coding', tests: [] }).total).toBe(0);
  });
});

describe('detected complexity', () => {
  const grow = (power: number) =>
    [1000, 10_000, 100_000].map((size) => ({ size, ms: 2 * (size / 1000) ** power }));

  it('names the growth from the slope', () => {
    expect(detectComplexity(grow(1))).toBe('O(N) or O(N*log(N))');
    expect(detectComplexity(grow(2))).toBe('O(N**2)');
    expect(detectComplexity(grow(0.1))).toBe('O(1) or O(log(N))');
    expect(detectComplexity(grow(0.5))).toBe('O(sqrt(N))');
    expect(detectComplexity(grow(1.5))).toBe('O(N*sqrt(N))');
    expect(detectComplexity(grow(3))).toBe('O(N**3)');
  });

  it('says nothing without enough signal', () => {
    expect(detectComplexity([])).toBeUndefined();
    expect(
      detectComplexity([
        { size: 1000, ms: 5 },
        { size: 2000, ms: 10 },
      ]),
    ).toBeUndefined();
    expect(
      detectComplexity([
        { size: 1000, ms: 0.1 },
        { size: 100_000, ms: 0.2 },
      ]),
    ).toBe('O(1) or O(log(N))');
    expect(
      detectComplexity([
        { size: 1000, ms: 0.1 },
        { size: 100_000, ms: 0.6 },
      ]),
    ).toBe('O(1) or O(log(N))');
  });

  it('counts a timeout at its limit, a lower bound', () => {
    expect(
      detectComplexity([
        { size: 1000, ms: 1 },
        { size: 100_000, ms: 10_000, timedOut: true },
      ]),
    ).toBe('O(N**2)');
  });
});

describe('scores from event tallies', () => {
  it('matches scoreTask on the same facts', () => {
    expect(
      scoreFromTallies({
        type: 'algorithmic',
        correctness: { passed: 1, total: 2 },
        performance: { passed: 1, total: 2 },
      }),
    ).toBe(0.5);
    expect(
      scoreFromTallies({
        type: 'coding',
        correctness: { passed: 3, total: 4 },
        performance: { passed: 0, total: 0 },
      }),
    ).toBe(0.75);
    expect(
      scoreFromTallies({
        type: 'algorithmic',
        correctness: { passed: 2, total: 2 },
        performance: { passed: 0, total: 0 },
      }),
    ).toBe(1);
    expect(
      scoreFromTallies({
        type: 'bug-fix',
        correctness: { passed: 2, total: 2 },
        performance: { passed: 0, total: 0 },
        zeroedBy: 'no-change',
      }),
    ).toBe(0);
    expect(scoreTallies([])).toBe(0);
    expect(
      scoreTallies([
        {
          type: 'coding',
          correctness: { passed: 1, total: 1 },
          performance: { passed: 0, total: 0 },
        },
        {
          type: 'coding',
          correctness: { passed: 0, total: 1 },
          performance: { passed: 0, total: 0 },
        },
      ]),
    ).toBe(0.5);
  });
});
