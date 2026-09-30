import { afterAll, describe, expect, it } from 'vitest';
import { NodePyodideRunner } from '@/adapters/node-runner/pyodide-runner';
import { NodeWorkerRunner } from '@/adapters/node-runner/worker-runner';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import {
  generateArgs,
  hashValue,
  runCase,
  type ArgSpec,
  type TaskLanguage,
} from '@/core/online-test';
import type { CodeRunner } from '@/core/ports/code-runner';

/*
 * The case program (src/core/online-test/program.ts) against the real harnesses: the
 * JavaScript one in a Node worker and the Python one in the Pyodide build the browser
 * loads. The generator test is the one that matters most: one expected hash judges every
 * language, so every copy of the generator must build the very same input.
 */

const python = new NodePyodideRunner();
afterAll(() => python.dispose());

let js: CodeRunner | undefined;
async function runnerFor(language: TaskLanguage): Promise<CodeRunner> {
  if (language === 'python') return python;
  js ??= new NodeWorkerRunner(await loadTranspiler());
  return js;
}

const SMALLEST_ABSENT: Record<TaskLanguage, string> = {
  js: `function solution(A) {
  const seen = new Set(A);
  let n = 1;
  while (seen.has(n)) n++;
  console.log('debug', A.length);
  return n;
}`,
  ts: `function solution(A: number[]): number {
  const seen = new Set<number>(A);
  let n = 1;
  while (seen.has(n)) n++;
  console.log('debug', A.length);
  return n;
}`,
  python: `def solution(A):
    seen = set(A)
    n = 1
    while n in seen:
        n += 1
    print("debug", len(A))
    return n
`,
};

const IDENTITY: Record<TaskLanguage, string> = {
  js: 'function solution() { return Array.prototype.slice.call(arguments); }',
  ts: 'function solution(...args: unknown[]): unknown[] { return args; }',
  python: 'def solution(*args):\n    return list(args)\n',
};

const LANGUAGES: TaskLanguage[] = ['js', 'ts', 'python'];

describe.each(LANGUAGES)('case program in %s', (language) => {
  it('reports the returned value, its hash, the size and the printed lines', async () => {
    const outcome = await runCase(
      await runnerFor(language),
      language,
      SMALLEST_ABSENT[language],
      { args: [[1, 3, 6, 4, 1, 2]] },
      5000,
    );
    expect(outcome).toMatchObject({
      kind: 'returned',
      hash: hashValue(5),
      json: '5',
      complete: true,
      size: 6,
      logs: ['debug 6'],
    });
  }, 60_000);

  it('builds the same generated input as the TypeScript reference', async () => {
    const specs: ArgSpec[] = [
      { kind: 'ints', n: 500, min: -1_000_000_000, max: 1_000_000_000 },
      { kind: 'permutation', n: 50, drop: 3 },
      { kind: 'sorted', n: 20, min: -5, max: 5 },
      { kind: 'string', n: 40, alphabet: '()[]{}' },
      { kind: 'repeat', times: 3, unit: [1, 2] },
      { kind: 'pairs', n: 5, min: 0, max: 9 },
      { kind: 'int', min: 1, max: 100 },
      { kind: 'range', n: 4, start: 10, step: -3 },
      { kind: 'constant', n: 3, value: 7 },
      { kind: 'value', value: 'x' },
    ];
    const generate = { seed: 20260929, args: specs };
    const outcome = await runCase(
      await runnerFor(language),
      language,
      IDENTITY[language],
      { generate },
      5000,
    );
    expect(outcome.kind).toBe('returned');
    if (outcome.kind !== 'returned') return;
    expect(outcome.hash).toBe(hashValue(generateArgs(generate)));
  }, 60_000);

  it('turns an exception into a runtime error with its message', async () => {
    const code =
      language === 'python'
        ? 'def solution(A):\n    raise ValueError("boom")\n'
        : "function solution(A) { throw new Error('boom'); }";
    const outcome = await runCase(await runnerFor(language), language, code, { args: [[1]] }, 5000);
    expect(outcome.kind).toBe('runtime-error');
    if (outcome.kind === 'runtime-error') expect(outcome.message).toContain('boom');
  }, 60_000);

  it('turns code that does not parse into a load error', async () => {
    const code = language === 'python' ? 'def solution(A:\n    pass\n' : 'function solution(A { }';
    const outcome = await runCase(await runnerFor(language), language, code, { args: [[1]] }, 5000);
    expect(outcome.kind).toBe('load-error');
  }, 60_000);

  it('reports an endless loop as a timeout', async () => {
    const code =
      language === 'python'
        ? 'def solution(A):\n    while True:\n        pass\n'
        : 'function solution(A) { for (;;) {} }';
    const outcome = await runCase(await runnerFor(language), language, code, { args: [[1]] }, 200);
    expect(outcome.kind).toBe('timeout');
  }, 60_000);
});
