import { afterAll, describe, expect, it } from 'vitest';
import { NodePyodideRunner } from '@/adapters/node-runner/pyodide-runner';
import { evaluateTask, isolateTest, listTests } from '@/core/assessment';
import type { RunRequest, RunResult } from '@/core/ports/code-runner';
import { LOG_TRUNCATION_NOTICE } from '@/core/running/limits';

/*
 * The Python harness under the Pyodide build the browser loads. One warm runner serves
 * every test here, as it serves the whole gate: the first run pays the start.
 */

const runner = new NodePyodideRunner();
afterAll(() => runner.dispose());

const SOLUTION = `def two_sum(values, target):
    seen = {}
    for i, value in enumerate(values):
        if target - value in seen:
            return [seen[target - value], i]
        seen[value] = i
    return None
`;

const STARTER = `def two_sum(values, target):
    return None
`;

const TESTS = `from solution import two_sum


@test("finds the pair")
def _():
    expect(two_sum([2, 7, 11, 15], 9)).to_equal([0, 1])


@test("no pair gives None")
def _():
    assert two_sum([1, 2], 10) is None


with describe("edges"):

    @test("empty list")
    def _():
        expect(two_sum([], 1)).to_be_none()
`;

let serial = 0;
function run(overrides: Partial<RunRequest>): Promise<RunResult> {
  serial += 1;
  return runner.run({
    runId: `py-${serial}`,
    language: 'python',
    code: SOLUTION,
    tests: TESTS,
    timeoutMs: 5000,
    harnessVersion: 1,
    ...overrides,
  });
}

describe('NodePyodideRunner', () => {
  it('passes the reference solution', async () => {
    const result = await run({});
    expect(result.status).toBe('passed');
    expect(result.tests).toEqual([
      { name: 'finds the pair', passed: true },
      { name: 'no pair gives None', passed: true },
      { name: 'edges > empty list', passed: true },
    ]);
  }, 60_000);

  it('fails the starter, with both values in the message', async () => {
    const result = await run({ code: STARTER });
    expect(result.status).toBe('failed');
    expect(result.tests[0]).toEqual({
      name: 'finds the pair',
      passed: false,
      message: 'Expected [0, 1], received None',
    });
  });

  it('explains a failing plain assert with both sides', async () => {
    const result = await run({
      code: 'def total(xs):\n    return sum(xs) + 1\n',
      tests:
        'test("sums", lambda: None)\n\n@test("total")\ndef _():\n    assert total([1, 2, 3]) == 6\n',
    });
    expect(result.tests[1]).toEqual({
      name: 'total',
      passed: false,
      message: 'Expected 6, received 7',
    });
  });

  it('captures print output, in order, and lets a test read it', async () => {
    const result = await run({
      code: 'def greet(name):\n    print("Hello,", name)\n',
      tests:
        '@test("greets")\ndef _():\n    greet("Ada")\n    expect(printed()).to_equal(["Hello, Ada"])\n\n@test("twice")\ndef _():\n    greet("Bo")\n',
    });
    expect(result.status).toBe('passed');
    expect(result.logs).toEqual(['Hello, Ada', 'Hello, Bo']);
  });

  it('reports a syntax error in the code with its line', async () => {
    const result = await run({ code: 'def two_sum(values, target):\n    return (\n' });
    expect(result.status).toBe('error');
    expect(result.error?.name).toBe('SyntaxError');
    expect(result.error?.line).toBe(2);
  });

  it('puts a line of the tests into the message, not into `line`', async () => {
    const result = await run({ tests: 'x = 1\ny = undefined_name\n' });
    expect(result.error).toEqual({
      name: 'NameError',
      message: "name 'undefined_name' is not defined (tests, line 2)",
    });
  });

  it('names the line of a runtime error in the learner code', async () => {
    const result = await run({ code: 'def two_sum(values, target):\n    return values[99]\n' });
    expect(result.tests[0]?.message).toBe('IndexError: list index out of range (line 2)');
  });

  it('stops an infinite loop, keeps earlier output, and the next run still works', async () => {
    const started = performance.now();
    const result = await run({
      code: 'print("before")\nwhile True:\n    pass\n',
      timeoutMs: 500,
    });
    expect(result.status).toBe('timeout');
    expect(result.error?.name).toBe('Timeout');
    expect(result.logs).toEqual(['before']);
    expect(performance.now() - started).toBeLessThan(3000);

    const after = await run({});
    expect(after.status).toBe('passed');
  }, 60_000);

  it('does not let one run change the builtins or modules of the next', async () => {
    await run({
      code: 'import builtins, sys\nbuiltins.len = lambda x: 0\nsys.setrecursionlimit(20)\n',
      tests: 'test("a", lambda: None)\n',
    });
    const result = await run({
      code: 'import sys\ndef depth(n):\n    return 0 if n == 0 else 1 + depth(n - 1)\n',
      tests:
        'test("len", lambda: expect(len([1, 2])).to_equal(2))\ntest("deep", lambda: expect(depth(200)).to_equal(200))\n',
    });
    expect(result.status).toBe('passed');
  });

  it('caps the output like the JavaScript harness', async () => {
    const result = await run({
      code: 'for i in range(500):\n    print(i)\n',
      tests: 'test("a", lambda: None)\n',
    });
    expect(result.logs).toHaveLength(201);
    expect(result.logs.at(-1)).toBe(LOG_TRUNCATION_NOTICE);
  });

  it('reports no tests as an error', async () => {
    const result = await run({ tests: 'x = 1\n' });
    expect(result.error?.name).toBe('NoTests');
  });

  it('survives recursion with the limit lifted, and the next run still works', async () => {
    const result = await run({
      code: 'import sys\nsys.setrecursionlimit(10 ** 6)\ndef down(n):\n    return down(n + 1)\n',
      tests: 'test("deep", lambda: down(0))\n',
      timeoutMs: 1000,
    });
    // A RecursionError after a few seconds in a worker thread, or the budget first.
    expect(['failed', 'timeout']).toContain(result.status);
    const after = await run({});
    expect(after.status).toBe('passed');
  }, 60_000);

  it('turns exit() inside a test into a failed test, not a dead interpreter', async () => {
    const result = await run({
      tests: 'test("exits", lambda: exit(1))\ntest("b", lambda: None)\n',
    });
    expect(result.tests.map((t) => t.passed)).toEqual([false, true]);
  });
});

describe('isolation for assessments, in Python', () => {
  const HIDDEN = `@test("a")
def _():
    expect(two_sum([1, 2], 3)).to_equal([0, 1])


@test("b")
def _():
    assert two_sum([5, 5], 10) == [0, 1]


@test("c")
def _():
    assert False
`;

  it('lists every test with an empty body', async () => {
    const result = await run({ code: '', tests: listTests(HIDDEN, 'python') });
    expect(result.status).toBe('passed');
    expect(result.tests.map((t) => t.name)).toEqual(['a', 'b', 'c']);
  });

  it('lists tests that import from solution, with no learner code at all', async () => {
    const importing = `from solution import two_sum, Missing\n\n${HIDDEN}`;
    const result = await run({ code: '', tests: listTests(importing, 'python') });
    expect(result.status).toBe('passed');
    expect(result.tests.map((t) => t.name)).toEqual(['a', 'b', 'c']);
  });

  it('still reports a missing name when the tests really run', async () => {
    const result = await run({
      tests: isolateTest(`from solution import missing\n${HIDDEN}`, 0, 'python'),
    });
    expect(result.status).toBe('error');
    expect(result.error?.message).toContain('missing');
  });

  it('runs only the test it isolates', async () => {
    const result = await run({ tests: isolateTest(HIDDEN, 2, 'python') });
    expect(result.tests).toEqual([
      { name: 'c', passed: false, message: 'Assertion failed: assert False' },
    ]);
  });

  it('keeps the author line numbers after the directive', async () => {
    const result = await run({ tests: isolateTest('x = 1\nundefined_name\n', 0, 'python') });
    expect(result.error?.message).toContain('(tests, line 2)');
  });

  it('scores a task one test at a time, with a performance test that times out', async () => {
    const slow = `def two_sum(values, target):
    for i in range(len(values)):
        for j in range(i + 1, len(values)):
            if values[i] + values[j] == target:
                return [i, j]
    return None
`;
    const performance = `@test("large")
def _():
    values = list(range(20000))
    assert two_sum(values, -1) is None
`;
    const task = {
      stepId: 'two-sum',
      language: 'python' as const,
      hiddenCode: HIDDEN.replace(/@test\("c"\)[\s\S]*$/, ''),
      performanceCode: performance,
      timeLimitMs: 1000,
    };
    const fast = await evaluateTask(runner, task, SOLUTION);
    expect(fast.correctness).toEqual({ passed: 2, total: 2 });
    expect(fast.performance).toEqual({ passed: 1, total: 1 });

    const brute = await evaluateTask(runner, task, slow);
    expect(brute.correctness).toEqual({ passed: 2, total: 2 });
    expect(brute.tests.at(-1)?.outcome).toBe('timeout');
  }, 60_000);
});

describe('async tests, on the webloop', () => {
  const FETCH_ALL = `import asyncio

async def fetch_all(ids, limit):
    sem = asyncio.Semaphore(limit)
    busy = 0
    peak = 0

    async def one(i):
        nonlocal busy, peak
        async with sem:
            busy += 1
            peak = max(peak, busy)
            await asyncio.sleep(0.01)
            busy -= 1
            return i * 10

    results = await asyncio.gather(*(one(i) for i in ids))
    return results, peak
`;
  const TESTS = `import asyncio
from solution import fetch_all


@test("keeps the order of the inputs")
async def _():
    results, _peak = await fetch_all([3, 1, 2], 2)
    expect(results).to_equal([30, 10, 20])


@test("never runs more than the limit at once")
async def _():
    _results, peak = await fetch_all(list(range(8)), 3)
    expect(peak).to_equal(3)


test("a plain test still runs", lambda: None)
`;

  it('awaits an async test and passes a gather with a semaphore', async () => {
    const result = await run({ code: FETCH_ALL, tests: TESTS });
    expect(result.status).toBe('passed');
    expect(result.tests.map((t) => t.passed)).toEqual([true, true, true]);
  });

  it('fails an async test with the same message a plain one gets', async () => {
    const result = await run({
      code: FETCH_ALL.replace('Semaphore(limit)', 'Semaphore(limit + 1)'),
      tests: TESTS,
    });
    expect(result.status).toBe('failed');
    expect(result.tests[1]).toEqual({
      name: 'never runs more than the limit at once',
      passed: false,
      message: 'Expected 3, received 4',
    });
  });

  it('explains that asyncio.run cannot start a loop inside the tests', async () => {
    const result = await run({
      code: 'import asyncio\n\nasync def main():\n    return 1\n\ndef go():\n    return asyncio.run(main())\n',
      tests: 'test("go", lambda: go())\n',
    });
    expect(result.tests[0]?.message).toMatch(/^RuntimeError: asyncio\.run\(\) is not available/);
  });

  it('times out an await that never ends, and the next run still works', async () => {
    const result = await run({
      code: 'import asyncio\n\nasync def wait():\n    await asyncio.sleep(60)\n',
      tests: '@test("waits")\nasync def _():\n    await wait()\n',
      timeoutMs: 500,
    });
    expect(result.status).toBe('timeout');
    const after = await run({});
    expect(after.status).toBe('passed');
  }, 60_000);
});

describe('packages', () => {
  const COSINE = `import numpy as np

def top_k(query, docs, k):
    q = query / np.linalg.norm(query)
    d = docs / np.linalg.norm(docs, axis=1, keepdims=True)
    scores = d @ q
    return [int(i) for i in np.argsort(-scores)[:k]]
`;
  const TESTS = `import numpy as np
from solution import top_k


@test("ranks by angle, not length")
def _():
    docs = np.array([[1.0, 0.0], [10.0, 1.0], [0.0, 1.0]])
    expect(top_k(np.array([1.0, 0.0]), docs, 2)).to_equal([0, 1])


test("k of one", lambda: expect(top_k(np.array([0.0, 2.0]), np.eye(2), 1)).to_equal([1]))
`;

  it('loads numpy on the first run that imports it, and passes', async () => {
    const result = await run({ code: COSINE, tests: TESTS });
    expect(result.status).toBe('passed');
  }, 120_000);

  it('fails a starter that uses numpy wrongly, with the harness message', async () => {
    const result = await run({
      code: COSINE.replace('np.argsort(-scores)', 'np.argsort(scores)'),
      tests: TESTS,
    });
    expect(result.status).toBe('failed');
  }, 120_000);

  it('validates a reply with pydantic and reads a table with pandas', async () => {
    const result = await run({
      code: `import pandas as pd
from pydantic import BaseModel, ValidationError

class Verdict(BaseModel):
    label: str
    score: float

def parse(raw):
    try:
        return Verdict.model_validate_json(raw)
    except ValidationError:
        return None

def mean_by(rows, key):
    return pd.DataFrame(rows).groupby(key)["score"].mean().to_dict()
`,
      tests: `test("valid", lambda: expect(parse('{"label": "ok", "score": 0.5}').score).to_equal(0.5))
test("invalid", lambda: expect(parse('{"label": "ok"}')).to_be_none())
test("groups", lambda: expect(mean_by([{"k": "a", "score": 1.0}, {"k": "a", "score": 0.0}], "k")).to_equal({"a": 0.5}))
`,
    });
    expect(result.status).toBe('passed');
  }, 120_000);
});
