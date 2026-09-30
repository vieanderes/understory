import { describe, expect, it } from 'vitest';
import { NodeWorkerRunner } from '@/adapters/node-runner/worker-runner';
import { loadTranspiler } from '@/adapters/transpile/sucrase';
import { evaluateTask } from '@/core/assessment';

/** The preamble against the real harness: TS imports, describe blocks, a slow test. */
const HIDDEN = `import { firstMissing } from './solution';

test('small', () => {
  expect(firstMissing([1, 3, 6, 4, 1, 2])).toBe(5);
});
describe('edges', () => {
  test('all negative', () => {
    expect(firstMissing([-1, -3])).toBe(1);
  });
  it('one item', () => {
    expect(firstMissing([1])).toBe(2);
  });
});
`;

const PERFORMANCE = `import { firstMissing } from './solution';

test('large: 20,000 in order', () => {
  const values = [];
  for (let i = 1; i <= 20000; i++) values.push(i);
  expect(firstMissing(values)).toBe(20001);
});
`;

const FAST = `export function firstMissing(values: number[]): number {
  const seen = new Set(values);
  let n = 1;
  while (seen.has(n)) n++;
  return n;
}`;

// Quadratic on purpose, and slowed further so the verdict never depends on the machine.
const SLOW = `export function firstMissing(values: number[]): number {
  let n = 1;
  while (values.includes(n)) {
    for (let k = 0; k < 2000; k++) values.indexOf(-1);
    n++;
  }
  return n;
}`;

const task = {
  stepId: 'write-first-missing',
  language: 'ts' as const,
  hiddenCode: HIDDEN,
  performanceCode: PERFORMANCE,
  timeLimitMs: 1000,
};

async function runner() {
  return new NodeWorkerRunner(await loadTranspiler());
}

describe('evaluateTask on the Node runner', () => {
  it('passes a fast, correct solution on every test', async () => {
    const report = await evaluateTask(await runner(), task, FAST);
    expect(report.tests.map((t) => [t.name, t.outcome])).toEqual([
      ['small', 'passed'],
      ['edges > all negative', 'passed'],
      ['edges > one item', 'passed'],
      ['large: 20,000 in order', 'passed'],
    ]);
  });

  it('times out a correct but quadratic solution on performance only', async () => {
    const report = await evaluateTask(await runner(), task, SLOW);
    expect(report.correctness).toEqual({ passed: 3, total: 3 });
    expect(report.performance).toEqual({ passed: 0, total: 1 });
    expect(report.tests[3]?.outcome).toBe('timeout');
  }, 20_000);

  it('gives a wrong answer its own verdict and message', async () => {
    const wrong = FAST.replace('let n = 1', 'let n = 0');
    const report = await evaluateTask(await runner(), task, wrong);
    expect(report.tests[0]).toMatchObject({
      outcome: 'wrong-answer',
      message: 'Expected 5, received 0',
    });
  });

  it('scores code that does not parse as zero', async () => {
    const report = await evaluateTask(await runner(), task, 'export function firstMissing( {');
    expect(report.loadError?.name).toBe('SyntaxError');
    expect(report.tests.every((t) => t.outcome === 'error')).toBe(true);
  });
});
