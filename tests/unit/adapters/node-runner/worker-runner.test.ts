import { describe, expect, it } from 'vitest';
import { NodeWorkerRunner } from '@/adapters/node-runner/worker-runner';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import type { RunRequest, RunResult } from '@/core/ports/code-runner';
import { LIMITS, LOG_TRUNCATION_NOTICE } from '@/core/running/limits';

const TESTS = `
test('adds', () => { expect(add(1, 2)).toBe(3); });
test('adds negatives', () => { expect(add(-1, -2)).toBe(-3); });
`;

async function run(overrides: Partial<RunRequest>, signal?: AbortSignal): Promise<RunResult> {
  const runner = new NodeWorkerRunner(await loadTranspiler());
  return runner.run(
    {
      runId: 'unit',
      language: 'js',
      code: 'function add(a, b) { return a + b; }',
      tests: TESTS,
      timeoutMs: 5000,
      harnessVersion: 1,
      ...overrides,
    },
    signal,
  );
}

describe('NodeWorkerRunner', () => {
  it('passes a correct solution', async () => {
    const result = await run({});
    expect(result.status).toBe('passed');
    expect(result.tests).toEqual([
      { name: 'adds', passed: true },
      { name: 'adds negatives', passed: true },
    ]);
    expect(result.error).toBeUndefined();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  it('fails a wrong solution with the assertion message', async () => {
    const result = await run({ code: 'function add(a, b) { return String(a) + b; }' });
    expect(result.status).toBe('failed');
    expect(result.tests[0]).toEqual({
      name: 'adds',
      passed: false,
      message: 'Expected 3, received "12"',
    });
  });

  it('runs TypeScript, with exports, imported by TypeScript tests', async () => {
    const result = await run({
      language: 'ts',
      code: 'export function add(a: number, b: number): number { return a + b; }',
      tests: `import { add as imported } from './solution';
test('import', () => { const n: number = imported(2, 2); expect(n).toBe(4); });
test('top-level name', () => { expect(add(1, 1)).toBe(2); });`,
    });
    expect(result.status).toBe('passed');
  });

  it('stops an infinite loop within the budget and keeps earlier output', async () => {
    const started = performance.now();
    const result = await run({ code: 'console.log("before");\nwhile (true) {}', timeoutMs: 500 });
    const took = performance.now() - started;
    expect(result.status).toBe('timeout');
    expect(result.error?.name).toBe('Timeout');
    expect(result.logs).toEqual(['before']);
    expect(took).toBeGreaterThanOrEqual(450);
    expect(took).toBeLessThan(3000);
  });

  it('stops an async test that never settles', async () => {
    const result = await run({
      tests: "test('hangs', () => new Promise(() => {}));",
      timeoutMs: 300,
    });
    expect(result.status).toBe('timeout');
  });

  it('reports an error thrown while loading, with the line', async () => {
    const result = await run({ code: 'const a = 1;\nthrow new RangeError("out of range");' });
    expect(result.status).toBe('error');
    expect(result.tests).toEqual([]);
    expect(result.error).toEqual({ name: 'RangeError', message: 'out of range', line: 2 });
  });

  it('reports a syntax error sucrase lets through, with the line', async () => {
    const result = await run({ code: 'let a = 1;\n\nlet a = 2;' });
    expect(result.status).toBe('error');
    expect(result.error).toMatchObject({ name: 'SyntaxError', line: 3 });
  });

  it('reports a syntax error found by the transpiler without starting a worker', async () => {
    const result = await run({ language: 'ts', code: 'function ( {' });
    expect(result.error).toMatchObject({
      name: 'SyntaxError',
      message: 'Unexpected token',
      line: 1,
    });
  });

  it('points at the tests when the tests are broken', async () => {
    const result = await run({ tests: "test('t', () => {});\nlet t = 1; let t = 2;" });
    expect(result.status).toBe('error');
    expect(result.error?.line).toBeUndefined();
    expect(result.error?.message).toContain('(tests, line 2)');
  });

  it('caps a log flood', async () => {
    const result = await run({
      code: 'function add(a, b) { return a + b; }\nfor (let i = 0; i < 100000; i++) console.log("line " + i);',
    });
    expect(result.status).toBe('passed');
    expect(result.logs).toHaveLength(LIMITS.maxLogLines + 1);
    expect(result.logs.at(-1)).toBe(LOG_TRUNCATION_NOTICE);
  });

  it('survives code that exhausts memory', async () => {
    const result = await run({
      code: 'const hog = []; while (true) hog.push(new Array(1e6).fill(1));',
      timeoutMs: 20_000,
    });
    expect(['error', 'timeout']).toContain(result.status);
  }, 30_000);

  it('gives lesson code no Node globals and an empty environment', async () => {
    const result = await run({
      code: '',
      tests: `test('no process', () => { expect(typeof process).toBe('undefined'); });
test('no require of packages', () => { expect(() => require('node:fs')).toThrow('Imports are not available'); });
test('timers exist', async () => { await new Promise((resolve) => setTimeout(resolve, 1)); });`,
    });
    expect(result.status).toBe('passed');
  });

  it('treats an uncaught error outside a test as an error', async () => {
    const result = await run({
      code: 'setTimeout(() => { throw new Error("from a timer"); }, 0);',
      tests: "test('slow', () => new Promise((resolve) => setTimeout(resolve, 200)));",
    });
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('from a timer');
  });

  it('treats an unhandled rejection as an error, as the browser worker does', async () => {
    const result = await run({
      code: 'Promise.reject(new Error("nobody caught this"));',
      tests: "test('slow', () => new Promise((resolve) => setTimeout(resolve, 200)));",
    });
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('nobody caught this');
  });

  it('rejects an invalid request as a result, not an exception', async () => {
    const result = await run({ timeoutMs: 0 });
    expect(result.status).toBe('error');
    expect(result.error?.name).toBe('InvalidRequest');
  });

  it('rejects when aborted, before and during a run', async () => {
    await expect(run({}, AbortSignal.abort(new Error('early')))).rejects.toThrow('early');

    const controller = new AbortController();
    const pending = run({ code: 'while (true) {}', timeoutMs: 10_000 }, controller.signal);
    setTimeout(() => controller.abort(), 100);
    await expect(pending).rejects.toMatchObject({ name: 'AbortError' });
  });

  it('runs several requests at once without mixing them up', async () => {
    const results = await Promise.all(
      [1, 2, 3, 4].map((n) =>
        run({
          code: `function add() { return ${n}; }`,
          tests: `test('n', () => { expect(add()).toBe(${n}); });`,
        }),
      ),
    );
    expect(results.map((r) => r.status)).toEqual(['passed', 'passed', 'passed', 'passed']);
  });
});
