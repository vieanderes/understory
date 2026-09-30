import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/*
 * The code sandbox in real browsers: Chromium on the desktop project, WebKit on the
 * phone project. The isolation tests matter most on WebKit, where Blob-URL workers in
 * an opaque-origin frame were the open question of milestone M4 (docs/SANDBOX.md).
 */

const BENCH = '/dev/sandbox';
const RUNNER = '/sandbox/runner.v1.html';

interface RunInput {
  code: string;
  tests: string;
  language?: 'js' | 'ts' | 'tsx' | 'python';
  timeoutMs?: number;
  /** How long to wait for the result. A first Python run starts Pyodide. */
  waitMs?: number;
}

/** Fills the bench, runs, and waits until this run (not an earlier one) has finished. */
async function run(page: Page, input: RunInput): Promise<void> {
  const results = page.getByTestId('results');
  const before = Number(await results.getAttribute('data-run-count'));
  await page.getByTestId('code-input').fill(input.code);
  await page.getByTestId('tests-input').fill(input.tests);
  await page.getByTestId('language-input').selectOption(input.language ?? 'js');
  await page.getByTestId('timeout-input').fill(String(input.timeoutMs ?? 3000));
  await page.getByTestId('run-button').click();
  await expect(results).toHaveAttribute('data-run-count', String(before + 1), {
    timeout: input.waitMs ?? 15_000,
  });
}

const ADD = 'function add(a, b) { return a + b; }';
const ADD_TESTS = `
test('adds', () => { expect(add(1, 2)).toBe(3); });
test('adds negatives', () => { expect(add(-1, -2)).toBe(-3); });
`;

test.describe('code sandbox', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto(BENCH);
    // The bench hydrates before it can run anything.
    await expect(page.getByTestId('run-status')).toHaveText('idle');
  });

  test('a passing run reports every test as passed', async ({ page }) => {
    await run(page, { code: ADD, tests: ADD_TESTS });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect(page.getByTestId('test-result')).toHaveCount(2);
    await expect(page.locator('[data-testid="test-result"][data-passed="true"]')).toHaveCount(2);
  });

  test('TypeScript with exports runs, and the tests can import from it', async ({ page }) => {
    await run(page, {
      language: 'ts',
      code: 'export function double(n: number): number { return n * 2; }\nexport default double;',
      tests: `import { double } from './solution';
test('named export', () => { expect(double(4)).toBe(8); });
test('top-level name', () => { const n: number = double(1); expect(n).toBe(2); });`,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
  });

  test('a failing run shows the assertion message', async ({ page }) => {
    await run(page, { code: 'function add(a, b) { return String(a) + b; }', tests: ADD_TESTS });
    await expect(page.getByTestId('run-status')).toHaveText('failed');
    await expect(page.getByTestId('test-message').first()).toHaveText('Expected 3, received "12"');
  });

  test('a syntax error is a result with a line, not a crash', async ({ page }) => {
    await run(page, {
      language: 'ts',
      code: 'const a: number = 1;\nfunction ( {',
      tests: ADD_TESTS,
    });
    await expect(page.getByTestId('run-status')).toHaveText('error');
    await expect(page.getByTestId('run-error-name')).toHaveText('SyntaxError');
    await expect(page.getByTestId('run-error-line')).toContainText('line 2');
  });

  test('a runtime error while loading names the line', async ({ page }) => {
    await run(page, { code: 'const a = 1;\nconst b = null;\nb.length;', tests: ADD_TESTS });
    await expect(page.getByTestId('run-status')).toHaveText('error');
    await expect(page.getByTestId('run-error-name')).toHaveText('TypeError');
    await expect(page.getByTestId('run-error-line')).toContainText('line 3');
  });

  test('an unhandled rejection is an error, as in the CI gate', async ({ page }) => {
    await run(page, {
      code: 'Promise.reject(new Error("nobody caught this"));',
      tests: "test('slow', () => new Promise((resolve) => setTimeout(resolve, 300)));",
    });
    await expect(page.getByTestId('run-status')).toHaveText('error');
    await expect(page.getByTestId('run-error-message')).toContainText('nobody caught this');
  });

  test('an infinite loop times out, the page stays responsive, and the next run works', async ({
    page,
  }) => {
    const results = page.getByTestId('results');
    await page.getByTestId('code-input').fill('console.log("before the loop");\nwhile (true) {}');
    await page.getByTestId('tests-input').fill(ADD_TESTS);
    await page.getByTestId('language-input').selectOption('js');
    await page.getByTestId('timeout-input').fill('1500');
    await page.getByTestId('run-button').click();

    // While the worker spins, the app's main thread still takes clicks and renders.
    await expect(results).toHaveAttribute('data-running', 'true');
    await page.getByTestId('tick-button').click();
    await page.getByTestId('tick-button').click();
    await expect(page.getByTestId('tick-count')).toHaveText('2');
    await expect(results).toHaveAttribute('data-running', 'true');

    await expect(page.getByTestId('run-status')).toHaveText('timeout', { timeout: 10_000 });
    // Output printed before the loop survives the kill.
    await expect(page.getByTestId('run-logs')).toContainText('before the loop');

    await run(page, { code: ADD, tests: ADD_TESTS });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
  });

  test('a log flood is capped at 200 lines plus a notice', async ({ page }) => {
    await run(page, {
      code: `${ADD}\nfor (let i = 0; i < 5000; i++) console.log('line ' + i);`,
      tests: ADD_TESTS,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    const logs = page.getByTestId('run-logs');
    await expect(logs).toHaveAttribute('data-line-count', '201');
    await expect(logs).toContainText('line 199');
    await expect(logs).not.toContainText('line 200');
    await expect(logs).toContainText('Output truncated');
  });

  test('learner code cannot reach the parent page or any storage', async ({ page }) => {
    await page.evaluate(() => {
      localStorage.setItem('secret', 'app-data');
      document.cookie = 'secret=app-cookie';
    });
    await run(page, {
      code: `
function unreachable(read) {
  try { return read() === undefined; } catch (error) { return true; }
}`,
      tests: `
test('control: a reachable value is reported as reachable', () => {
  expect(unreachable(() => self.location)).toBe(false);
});
test('parent.document', () => { expect(unreachable(() => parent.document)).toBe(true); });
test('top.location', () => { expect(unreachable(() => top.location.href)).toBe(true); });
test('localStorage', () => { expect(unreachable(() => localStorage.getItem('secret'))).toBe(true); });
test('indexedDB', () => { expect(unreachable(() => indexedDB)).toBe(true); });
test('document.cookie', () => { expect(unreachable(() => document.cookie)).toBe(true); });
test('origin is opaque', () => { expect(self.origin).toBe('null'); });
test('the channel to the frame is out of reach', () => {
  expect(unreachable(() => postMessage({ type: 'done' }))).toBe(true);
  expect(typeof __hostLog).toBe('undefined');
});`,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect(page.locator('[data-testid="test-result"][data-passed="true"]')).toHaveCount(8);
  });

  test('the frame itself is sandboxed, hidden and cut off from the app', async ({ page }) => {
    await run(page, { code: ADD, tests: ADD_TESTS });
    const iframe = page.locator(`iframe[src="${RUNNER}"]`);
    await expect(iframe).toHaveCount(1);
    // No `sandbox` attribute, so the service worker may answer the frame offline. The
    // header's `sandbox` directive isolates it, as the probe below shows.
    await expect(iframe).not.toHaveAttribute('sandbox');
    await expect(iframe).toBeHidden();

    const frame = page.frames().find((candidate) => candidate.url().endsWith(RUNNER));
    expect(frame).toBeDefined();
    const probe = await frame?.evaluate(() => {
      const attempt = (read: () => unknown): string => {
        try {
          return `value:${String(read())}`;
        } catch (error) {
          return `throws:${error instanceof Error ? error.name : 'unknown'}`;
        }
      };
      return {
        origin: window.origin,
        parentDocument: attempt(() => window.parent.document),
        topLocation: attempt(() => window.top?.location.href),
        localStorage: attempt(() => window.localStorage.getItem('secret')),
        cookie: attempt(() => document.cookie),
      };
    });
    expect(probe).toEqual({
      origin: 'null',
      parentDocument: 'throws:SecurityError',
      topLocation: 'throws:SecurityError',
      localStorage: 'throws:SecurityError',
      cookie: 'throws:SecurityError',
    });
  });

  test('learner code has no network', async ({ page, baseURL }) => {
    const seen: string[] = [];
    page.on('request', (request) => seen.push(request.url()));
    await run(page, {
      code: `
async function fails(start) {
  try { await start(); return false; } catch (error) { return true; }
}`,
      tests: `
test('fetch, relative', async () => { expect(await fails(() => fetch('/?sandbox-probe=1'))).toBe(true); });
test('fetch, absolute', async () => { expect(await fails(() => fetch('${baseURL}/?sandbox-probe=2'))).toBe(true); });
test('XMLHttpRequest', async () => { expect(await fails(() => new XMLHttpRequest())).toBe(true); });
test('WebSocket', async () => { expect(await fails(() => new WebSocket('ws://localhost:3210/?sandbox-probe=3'))).toBe(true); });
test('importScripts', async () => { expect(await fails(() => importScripts('${baseURL}/?sandbox-probe=4'))).toBe(true); });
test('nested worker', async () => { expect(await fails(() => new Worker('${baseURL}/?sandbox-probe=5'))).toBe(true); });
test('dynamic import', async () => { expect(await fails(() => import('${baseURL}/?sandbox-probe=6'))).toBe(true); });`,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect(page.locator('[data-testid="test-result"][data-passed="true"]')).toHaveCount(7);
    expect(seen.filter((url) => url.includes('sandbox-probe'))).toEqual([]);
  });
});

const TWO_SUM = `def two_sum(values, target):
    seen = {}
    for i, value in enumerate(values):
        if target - value in seen:
            return [seen[target - value], i]
        seen[value] = i
    return None
`;

const TWO_SUM_TESTS = `from solution import two_sum


@test("finds the pair")
def _():
    expect(two_sum([2, 7, 11, 15], 9)).to_equal([0, 1])


@test("no pair")
def _():
    assert two_sum([1, 2], 10) is None
`;

test.describe('Python in the code sandbox', () => {
  // Every test starts Pyodide once in a fresh page.
  test.describe.configure({ timeout: 90_000 });

  test.beforeEach(async ({ page }) => {
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');
  });

  test('passes, fails with both values, and shows printed lines', async ({ page }) => {
    const requests: string[] = [];
    page.on('request', (request) => requests.push(new URL(request.url()).pathname));
    await run(page, {
      language: 'python',
      code: `${TWO_SUM}print("loaded")\n`,
      tests: TWO_SUM_TESTS,
      waitMs: 60_000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect(page.getByTestId('run-logs')).toHaveText('loaded');
    // Pyodide comes from the app's own origin, never a CDN.
    expect(requests.filter((path) => path.startsWith('/pyodide/'))).toHaveLength(5);

    // The second run finds the interpreter warm.
    await run(page, {
      language: 'python',
      code: 'def two_sum(values, target):\n    return None\n',
      tests: TWO_SUM_TESTS,
    });
    await expect(page.getByTestId('run-status')).toHaveText('failed');
    await expect(page.getByTestId('test-message').first()).toHaveText(
      'Expected [0, 1], received None',
    );
    const warm = Number((await page.getByTestId('run-duration').textContent())?.replace(/\D/g, ''));
    expect(warm).toBeLessThan(1000);
    expect(requests.filter((path) => path.startsWith('/pyodide/'))).toHaveLength(5);
  });

  test('a syntax error names its line', async ({ page }) => {
    await run(page, {
      language: 'python',
      code: 'def two_sum(values, target):\n    return (\n',
      tests: TWO_SUM_TESTS,
      waitMs: 60_000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('error');
    await expect(page.getByTestId('run-error-name')).toHaveText('SyntaxError');
    await expect(page.getByTestId('run-error-line')).toContainText('line 2');
  });

  test('an infinite loop times out, and the next run gets a fresh interpreter', async ({
    page,
  }) => {
    await run(page, { language: 'python', code: TWO_SUM, tests: TWO_SUM_TESTS, waitMs: 60_000 });
    await expect(page.getByTestId('run-status')).toHaveText('passed');

    await run(page, {
      language: 'python',
      code: 'print("before the loop")\nwhile True:\n    pass\n',
      tests: TWO_SUM_TESTS,
      timeoutMs: 1000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('timeout');
    await expect(page.getByTestId('run-logs')).toContainText('before the loop');

    await run(page, { language: 'python', code: TWO_SUM, tests: TWO_SUM_TESTS, waitMs: 60_000 });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
  });

  test('numpy survives a timeout: the next interpreter loads it from the frame', async ({
    page,
  }) => {
    const wheels: string[] = [];
    page.on('request', (request) => {
      if (request.url().endsWith('.whl')) wheels.push(request.url());
    });
    const NUMPY = 'import numpy as np\n\ndef total(xs):\n    return int(np.array(xs).sum())\n';
    const NUMPY_TESTS =
      'test("sums", lambda: expect(total([1, 2, 3])).to_equal(6))\ntest("empty", lambda: expect(total([])).to_equal(0))\n';
    await run(page, { language: 'python', code: NUMPY, tests: NUMPY_TESTS, waitMs: 90_000 });
    await expect(page.getByTestId('run-status')).toHaveText('passed');

    await run(page, {
      language: 'python',
      code: 'import numpy as np\nwhile True:\n    pass\n',
      tests: NUMPY_TESTS,
      timeoutMs: 1000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('timeout');

    await run(page, { language: 'python', code: NUMPY, tests: NUMPY_TESTS, waitMs: 60_000 });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    expect(wheels).toHaveLength(1);
  });

  test('Python code has no network and an opaque origin', async ({ page, baseURL }) => {
    const seen: string[] = [];
    page.on('request', (request) => seen.push(request.url()));
    await run(page, {
      language: 'python',
      code: `import js


def fails(action):
    try:
        action()
        return False
    except Exception:
        return True
`,
      tests: `@test("fetch")
def _():
    assert fails(lambda: js.fetch("${baseURL}/?sandbox-probe=py1"))


@test("XMLHttpRequest")
def _():
    assert fails(lambda: js.XMLHttpRequest.new())


@test("importScripts")
def _():
    assert fails(lambda: js.importScripts("${baseURL}/?sandbox-probe=py2"))


@test("origin is opaque")
def _():
    expect(js.self.origin).to_equal("null")


@test("no storage")
def _():
    assert fails(lambda: js.indexedDB.open("x"))
`,
      waitMs: 60_000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect(page.locator('[data-testid="test-result"][data-passed="true"]')).toHaveCount(5);
    expect(seen.filter((url) => url.includes('sandbox-probe'))).toEqual([]);
  });
});

test.describe('a runner the network tampered with', () => {
  // These stand-ins replace the runner on the network. Were the page controlled, the
  // service worker would answer the frame from its cache and the stand-in would never load.
  test.use({ serviceWorkers: 'block' });

  test('a frame that never answers is removed by the watchdog, and the next run gets a new one', async ({
    page,
  }) => {
    // A stand-in runner that completes the handshake, then misbehaves: it answers `run`
    // with a message that fails validation and a `done` for a run nobody asked for.
    const rogue = `<!doctype html><script>
    addEventListener('message', (event) => {
      const port = event.ports[0];
      port.postMessage({ v: 1, type: 'ready', runId: event.data.runId, harnessVersion: 1 });
      port.onmessage = (run) => {
        port.postMessage({ v: 1, type: 'done', runId: run.data.runId, status: 'passed', tests: 'all of them', logs: [] });
        port.postMessage({ v: 1, type: 'done', runId: 'someone-else', status: 'passed', tests: [], logs: [] });
      };
    });
  </script>`;
    await page.route(`**${RUNNER}`, (route) =>
      route.fulfill({
        contentType: 'text/html',
        headers: {
          'content-security-policy':
            "sandbox allow-scripts; default-src 'none'; script-src 'unsafe-inline'",
        },
        body: rogue,
      }),
    );
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');

    const started = Date.now();
    await run(page, { code: ADD, tests: ADD_TESTS, timeoutMs: 500 });
    await expect(page.getByTestId('run-status')).toHaveText('timeout');
    // timeoutMs plus the 1500 ms grace, and not much more.
    expect(Date.now() - started).toBeGreaterThanOrEqual(2000);
    expect(Date.now() - started).toBeLessThan(6000);
    await expect(page.locator('iframe')).toHaveCount(0);

    await page.unroute(`**${RUNNER}`);
    await run(page, { code: ADD, tests: ADD_TESTS });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect(page.locator('iframe')).toHaveCount(1);
  });

  test('a runner that lost its sandbox header is never started', async ({ page }) => {
    let body = '';
    await page.route(`**${RUNNER}`, async (route) => {
      const response = await route.fetch();
      body = await response.text();
      const headers = { ...response.headers() };
      delete headers['content-security-policy'];
      await route.fulfill({ response, headers, body });
    });
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');

    await run(page, { code: ADD, tests: ADD_TESTS });
    expect(body).toContain('Understory code sandbox');
    await expect(page.getByTestId('run-status')).toHaveText('error');
    await expect(page.getByTestId('run-error-message')).toContainText('not isolated');
    await expect(page.locator('iframe')).toHaveCount(0);
  });
});

test('the runner opened as a top-level page still has an opaque origin', async ({ page }) => {
  const response = await page.goto(RUNNER);
  const csp = response?.headers()['content-security-policy'] ?? '';
  expect(csp).toMatch(/(^|;\s*)sandbox allow-scripts(;|$)/);
  expect(csp).toContain("default-src 'none'");
  expect(await page.evaluate(() => window.origin)).toBe('null');
  const storage = await page.evaluate(() => {
    try {
      return String(window.localStorage.length);
    } catch (error) {
      return error instanceof Error ? error.name : 'unknown';
    }
  });
  expect(storage).toBe('SecurityError');
});

test('the app pages still refuse to be framed', async ({ request }) => {
  const response = await request.get(BENCH);
  const csp = response.headers()['content-security-policy'] ?? '';
  expect(csp).toContain("frame-ancestors 'none'");
  expect(csp).not.toContain('sandbox allow-scripts');
  expect(response.headers()['x-robots-tag'] ?? '').not.toContain('index,');
  expect(await response.text()).toContain('noindex');
});

/*
 * React challenges (language: tsx). The runtime is about 1 MB of JavaScript that the page
 * fetches on the first tsx run and hands to the frame; these tests prove it works in a
 * real worker on both engines and record the numbers docs/SANDBOX.md quotes.
 */
test.describe('React challenges', () => {
  const fixture = (name: string): string =>
    readFileSync(path.join(process.cwd(), 'tests/fixtures/react-challenge', name), 'utf8');

  test.beforeEach(async ({ page }) => {
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');
  });

  test('a component passes its Testing Library tests, fast once warm', async ({
    page,
  }, testInfo) => {
    const runtimeBytes: number[] = [];
    page.on('requestfinished', (request) => {
      if (!request.url().endsWith('/sandbox/react-runtime.v1.js')) return;
      void request.sizes().then((sizes) => runtimeBytes.push(sizes.responseBodySize));
    });
    const input = {
      language: 'tsx' as const,
      code: fixture('solution.tsx'),
      tests: fixture('tests.tsx'),
      timeoutMs: 10_000,
    };
    const durations: number[] = [];
    for (let i = 0; i < 3; i += 1) {
      await run(page, input);
      await expect(page.getByTestId('run-status')).toHaveText('passed');
      await expect(page.locator('[data-testid="test-result"][data-passed="true"]')).toHaveCount(4);
      const text = (await page.getByTestId('run-duration').textContent()) ?? '';
      durations.push(Number(/(\d+) ms/.exec(text)?.[1]));
    }
    // Fetched once per page, however many runs follow.
    expect(runtimeBytes).toHaveLength(1);
    testInfo.annotations.push({
      type: 'react-runtime',
      description: `transfer ${runtimeBytes[0]} bytes; runs ${durations.join(', ')} ms`,
    });
    console.log(
      `[${testInfo.project.name}] react runtime transfer ${runtimeBytes[0]} B, runs ${durations.join(' / ')} ms`,
    );
    expect(Math.max(...durations.slice(1))).toBeLessThan(1000);
  });

  test('the starter fails with a Testing Library message', async ({ page }) => {
    await run(page, {
      language: 'tsx',
      code: fixture('starter.tsx'),
      tests: fixture('tests.tsx'),
      timeoutMs: 10_000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('failed');
    await expect(page.getByTestId('test-message').first()).toContainText(
      'Unable to find an accessible element with the role "combobox"',
    );
  });

  test('an endless render loop times out like any other code', async ({ page }) => {
    await run(page, {
      language: 'tsx',
      code: 'export function Spin() { while (true) {} return null; }',
      tests: `import { render } from '@testing-library/react';
import { Spin } from './solution';
test('spins', () => { render(<Spin />); });`,
      timeoutMs: 1500,
    });
    await expect(page.getByTestId('run-status')).toHaveText('timeout');
  });

  test('the runtime comes from the service worker cache with the network cut', async ({
    page,
    context,
    browserName,
  }) => {
    test.slow();
    await page.goto('/learn');
    await expect(page.locator('html')).toHaveAttribute('data-worker', 'controlled', {
      timeout: 60_000,
    });
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');
    await run(page, {
      language: 'tsx',
      code: fixture('solution.tsx'),
      tests: fixture('tests.tsx'),
      timeoutMs: 10_000,
    });
    await expect(page.getByTestId('run-status')).toHaveText('passed');
    await expect
      .poll(() =>
        page.evaluate(async () => {
          const cache = await caches.open('understory-static-v1');
          return Boolean(await cache.match('/sandbox/react-runtime.v1.js'));
        }),
      )
      .toBe(true);
    // WebKit's offline emulation also fails fetches the service worker would answer from
    // its cache, precached files included, so only Chromium can show the offline answer.
    if (browserName === 'webkit') return;
    await context.setOffline(true);
    const status = await page.evaluate(async () => {
      const response = await fetch('/sandbox/react-runtime.v1.js');
      return { status: response.status, length: (await response.text()).length };
    });
    expect(status.status).toBe(200);
    expect(status.length).toBeGreaterThan(500_000);
  });
});
