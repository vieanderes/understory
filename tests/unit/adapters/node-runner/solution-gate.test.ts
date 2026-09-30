import { describe, expect, it } from 'vitest';
import { checkChallenge, createChallengeChecker } from '../../../../scripts/lib/node-solution-gate';

const lesson = {
  lessonPath: 'content/course/03-javascript/01-functions/lesson.yaml',
  stepId: 'write-add',
  language: 'ts' as const,
  starter:
    'export function add(a: number, b: number): number {\n  // Your code here\n  return 0;\n}',
  solution: 'export function add(a: number, b: number): number {\n  return a + b;\n}',
  tests: `test('adds', () => { expect(add(1, 2)).toBe(3); });
test('adds negatives', () => { expect(add(-1, -2)).toBe(-3); });`,
};

describe('solution gate', () => {
  it('passes a lesson whose solution passes and whose starter fails', async () => {
    expect(await checkChallenge(lesson)).toEqual([]);
  });

  it('rejects a starter that already passes', async () => {
    const issues = await checkChallenge({ ...lesson, starter: lesson.solution });
    expect(issues).toEqual([
      {
        severity: 'error',
        path: lesson.lessonPath,
        where: 'write-add',
        rule: 'solution-gate',
        message: expect.stringContaining('The starter already passes every test') as string,
      },
    ]);
  });

  it('rejects a solution that fails, and names the failing test', async () => {
    const issues = await checkChallenge({ ...lesson, solution: lesson.starter });
    expect(issues).toHaveLength(1);
    expect(issues[0]).toMatchObject({
      severity: 'error',
      rule: 'solution-gate',
      where: 'write-add',
    });
    expect(issues[0]?.message).toContain('The reference solution does not pass its tests');
    expect(issues[0]?.message).toContain('test "adds" failed: Expected 3, received 0');
  });

  it('rejects a solution that does not parse, with the line', async () => {
    const issues = await checkChallenge({
      ...lesson,
      solution: 'export function add(a, b) {\n  return a +;\n}',
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toMatch(/SyntaxError: .*\(line 2\)/);
  });

  it('rejects a solution that never finishes', async () => {
    const check = createChallengeChecker({ timeoutMs: 400 });
    const issues = await check({ ...lesson, solution: 'function add() { while (true) {} }' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('it did not finish in time');
  });

  it('counts a starter that throws, loops or does not parse as not passing', async () => {
    const check = createChallengeChecker({ timeoutMs: 400 });
    for (const starter of [
      'throw new Error("todo");',
      'function add() { while (true) {} }',
      'function add( {',
    ]) {
      expect(await check({ ...lesson, starter })).toEqual([]);
    }
  });

  describe('with the type checker', () => {
    const typed = { ...lesson, typecheck: true };

    it('passes a solution and a starter that both type-check', async () => {
      expect(await checkChallenge(typed)).toEqual([]);
    });

    it('rejects a solution with a type error, even though its tests pass', async () => {
      const issues = await checkChallenge({
        ...typed,
        solution:
          'export function add(a: number, b: number): number {\n  const sum: string = a + b;\n  return Number(sum);\n}',
      });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('The reference solution has type errors');
      expect(issues[0]?.message).toContain(
        "Line 2: Type 'number' is not assignable to type 'string'.",
      );
    });

    it('rejects a starter with a type error nobody asked for', async () => {
      const issues = await checkChallenge({
        ...typed,
        starter: 'export function add(a: number, b: number): number {\n  return "0";\n}',
      });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('The starter has type errors');
      expect(issues[0]?.message).toContain('expectStarterTypeError');
    });

    it('requires the type error a step promises, and lets that starter pass the tests', async () => {
      const broken = 'export function add(a: number, b: number): string {\n  return a + b;\n}';
      expect(
        await checkChallenge({ ...typed, expectStarterTypeError: true, starter: broken }),
      ).toEqual([]);
      const issues = await checkChallenge({ ...typed, expectStarterTypeError: true });
      expect(issues).toHaveLength(1);
      expect(issues[0]?.message).toContain('the starter type-checks cleanly');
    });

    it('still rejects a starter that passes the tests and type-checks', async () => {
      const issues = await checkChallenge({ ...typed, starter: lesson.solution });
      expect(issues.map((i) => i.message)).toEqual([
        expect.stringContaining('The starter already passes every test'),
      ]);
    });

    it('ignores the types when the step does not check them', async () => {
      const issues = await checkChallenge({
        ...lesson,
        starter:
          'export function add(a: number, b: number): number {\n  return "0" as any as number;\n}',
        solution: 'export function add(a, b) {\n  return a + b;\n}',
      });
      expect(issues).toEqual([]);
    });
  });

  it('requires at least two tests', async () => {
    const issues = await checkChallenge({
      ...lesson,
      tests: "test('adds', () => { expect(add(1, 2)).toBe(3); });",
    });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('The tests register 1 test. A challenge needs at least 2');
  });

  it('reports tests that register nothing once, through the solution', async () => {
    const issues = await checkChallenge({ ...lesson, tests: '// todo' });
    expect(issues).toHaveLength(1);
    expect(issues[0]?.message).toContain('No tests were registered');
  });

  it('limits how many workers run at once', async () => {
    let live = 0;
    let peak = 0;
    const check = createChallengeChecker({
      concurrency: 2,
      runner: {
        async run(req) {
          live += 1;
          peak = Math.max(peak, live);
          await new Promise((resolve) => setTimeout(resolve, 5));
          live -= 1;
          const passed = req.runId.startsWith('gate-solution');
          return {
            status: passed ? 'passed' : 'failed',
            tests: [
              { name: 'a', passed },
              { name: 'b', passed },
            ],
            logs: [],
            durationMs: 5,
          };
        },
      },
    });
    const all = await Promise.all(Array.from({ length: 6 }, () => check(lesson)));
    expect(all.flat()).toEqual([]);
    expect(peak).toBe(2);
  });

  describe('assessment tasks', () => {
    const task = {
      lessonPath: 'content/course/28-interview-challenges/24-mock-assessment-a/lesson.yaml',
      stepId: 'task-pairs',
      language: 'js' as const,
      starter: 'function countPairs(values) {\n  return 0;\n}',
      solution: `function countPairs(values) {
  const seen = new Map();
  let pairs = 0;
  for (const v of values) {
    pairs += seen.get(v) ?? 0;
    seen.set(v, (seen.get(v) ?? 0) + 1);
  }
  return pairs;
}`,
      tests:
        "test('example', () => { expect(countPairs([1, 1, 2])).toBe(1); });\ntest('none', () => { expect(countPairs([1, 2])).toBe(0); });",
      hidden:
        "test('three equal', () => { expect(countPairs([5, 5, 5])).toBe(3); });\ntest('empty', () => { expect(countPairs([])).toBe(0); });",
      performance: `test('large: 20,000 equal', () => {
  const values = new Array(20000).fill(7);
  expect(countPairs(values)).toBe(199990000);
});`,
      timeLimitMs: 1000,
    };
    const brute = `function countPairs(values) {
  let pairs = 0;
  for (let i = 0; i < values.length; i++)
    for (let j = i + 1; j < values.length; j++)
      for (let k = 0; k < 20; k++) if (k === 0 && values[i] === values[j]) pairs++;
  return pairs;
}`;

    it('passes a fast solution and a brute force that only times out', async () => {
      expect(await checkChallenge({ ...task, bruteForce: brute })).toEqual([]);
    }, 30_000);

    it('rejects performance tests that a brute force passes in time', async () => {
      const issues = await checkChallenge({ ...task, bruteForce: task.solution });
      expect(issues.map((i) => i.message)).toEqual([
        expect.stringContaining('do not measure the complexity') as string,
      ]);
    }, 30_000);

    it('rejects a brute force that is wrong, not only slow', async () => {
      const wrong = brute.replace('pairs++', 'pairs += 2');
      const issues = await checkChallenge({ ...task, bruteForce: wrong });
      expect(issues[0]?.message).toContain('The brute force fails a hidden test');
    }, 30_000);

    it('rejects a solution that fails a hidden test', async () => {
      const issues = await checkChallenge({
        ...task,
        hidden:
          "test('off', () => { expect(countPairs([5, 5, 5])).toBe(4); });\ntest('empty', () => { expect(countPairs([])).toBe(0); });",
      });
      expect(issues[0]?.message).toContain('"off" (wrong-answer');
    }, 30_000);
  });

  describe('in Python', () => {
    const python = {
      lessonPath: 'content/course/18-python/01-basics/lesson.yaml',
      stepId: 'write-add',
      language: 'python' as const,
      starter: 'def add(a, b):\n    return 0\n',
      solution: 'def add(a, b):\n    return a + b\n',
      tests:
        'from solution import add\n\n\n@test("adds")\ndef _():\n    expect(add(1, 2)).to_equal(3)\n\n\n@test("adds negatives")\ndef _():\n    assert add(-1, -2) == -3\n',
    };

    it('passes a solution that passes and a starter that fails', async () => {
      expect(await checkChallenge(python)).toEqual([]);
    }, 60_000);

    it('names the failing test of a wrong solution', async () => {
      const issues = await checkChallenge({ ...python, solution: python.starter });
      expect(issues[0]?.message).toContain('test "adds" failed: Expected 3, received 0');
    }, 60_000);

    it('rejects a starter that already passes', async () => {
      const issues = await checkChallenge({ ...python, starter: python.solution });
      expect(issues[0]?.message).toContain('The starter already passes every test');
    }, 60_000);
  });
});
