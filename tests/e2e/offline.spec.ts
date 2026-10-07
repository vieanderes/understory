import { readFileSync } from 'node:fs';
import path from 'node:path';
import { expect, test, type Page } from '@playwright/test';

/*
 * The offline promise: once the service worker controls the page, a learner with no
 * network can still move through the app, open a lesson and run code.
 *
 * Code runs offline because the runner frame has no `sandbox` attribute: a frame with one
 * is never handed to the service worker, in Chromium or WebKit, so its navigation failed
 * with the network cut. Its isolation is the `sandbox` directive in the runner's CSP
 * header, which the worker keeps with the cached copy (docs/SANDBOX.md, "Offline").
 */

const BENCH = '/dev/sandbox';
const RUNNER = '/sandbox/runner.v1.html';

/** Waits until the service worker controls the page, so its cache answers fetches. */
async function controlled(page: Page): Promise<void> {
  await page.goto('/learn');
  await expect(page.locator('html')).toHaveAttribute('data-worker', 'controlled', {
    timeout: 60_000,
  });
}

test.describe('offline', () => {
  test('a lesson opens with the network cut', async ({ page, context }) => {
    test.slow();
    // A lesson opens offline from its prefetched payload, so note when that arrives.
    const prefetched = new Set<string>();
    page.on('requestfinished', (request) => {
      const segment = request.headers()['next-router-segment-prefetch'] ?? '';
      if (segment.includes('__PAGE__')) prefetched.add(new URL(request.url()).pathname);
    });
    await controlled(page);

    // A link is prefetched once it scrolls into view. On a phone the first lesson sits
    // below the part and chapter headers, so it is brought into view while online.
    const link = page.locator('main a[href^="/learn/"]').first();
    const href = await link.getAttribute('href');
    expect(href).toBeTruthy();
    await link.scrollIntoViewIfNeeded();
    await expect.poll(() => prefetched.has(href ?? ''), { timeout: 20_000 }).toBe(true);
    await context.setOffline(true);
    await link.click();

    await expect(page).toHaveURL(new RegExp(`${href}$`), { timeout: 20_000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    // The lesson's own content, not the shell it was reached from.
    await expect(page.getByRole('heading', { level: 1 })).not.toHaveText('The library');
  });

  test('a cached route still loads from scratch with the network cut', async ({
    page,
    context,
    browserName,
  }) => {
    // WebKit's offline emulation fails every navigation with an internal error, cached or
    // not, so a document load cannot be measured there. The test above covers both.
    test.skip(browserName === 'webkit', 'Playwright cannot navigate offline in WebKit');
    test.slow();
    await controlled(page);
    await context.setOffline(true);

    await page.goto('/progress');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
  });
});

interface RunInput {
  code: string;
  tests: string;
  language: 'js' | 'ts' | 'tsx' | 'python';
  timeoutMs?: number;
  waitMs?: number;
}

/** Fills the bench, runs, and waits until this run (not an earlier one) has finished. */
async function run(page: Page, input: RunInput): Promise<void> {
  const results = page.getByTestId('results');
  const before = Number(await results.getAttribute('data-run-count'));
  await page.getByTestId('code-input').fill(input.code);
  await page.getByTestId('tests-input').fill(input.tests);
  await page.getByTestId('language-input').selectOption(input.language);
  await page.getByTestId('timeout-input').fill(String(input.timeoutMs ?? 3000));
  await page.getByTestId('run-button').click();
  await expect(results).toHaveAttribute('data-run-count', String(before + 1), {
    timeout: input.waitMs ?? 20_000,
  });
}

const reactFixture = (name: string): string =>
  readFileSync(path.join(process.cwd(), 'tests/fixtures/react-challenge', name), 'utf8');

const JS: RunInput = {
  language: 'js',
  code: 'function add(a, b) { return a + b; }',
  tests: "test('adds', () => { expect(add(1, 2)).toBe(3); });",
};

const TSX = (): RunInput => ({
  language: 'tsx',
  code: reactFixture('solution.tsx'),
  tests: reactFixture('tests.tsx'),
  timeoutMs: 10_000,
});

const PYTHON: RunInput = {
  language: 'python',
  code: 'def add(a, b):\n    return a + b\n',
  tests:
    'from solution import add\n\n\n@test("adds")\ndef _():\n    expect(add(1, 2)).to_equal(3)\n',
  waitMs: 60_000,
};

/** What learner code can reach, run as tests. Every one passes only when it is out of reach. */
const wall = (baseURL: string | undefined): RunInput => ({
  language: 'js',
  code: `
function unreachable(read) { try { read(); return false; } catch (error) { return true; } }
async function fails(start) { try { await start(); return false; } catch (error) { return true; } }`,
  tests: `
test('parent.document', () => { expect(unreachable(() => parent.document)).toBe(true); });
test('localStorage', () => { expect(unreachable(() => localStorage.getItem('secret'))).toBe(true); });
test('indexedDB', () => { expect(unreachable(() => indexedDB.open('x'))).toBe(true); });
test('caches', () => { expect(unreachable(() => caches.open('x'))).toBe(true); });
test('origin is opaque', () => { expect(self.origin).toBe('null'); });
test('fetch, relative', async () => { expect(await fails(() => fetch('/?sandbox-probe=1'))).toBe(true); });
test('fetch, absolute', async () => { expect(await fails(() => fetch('${baseURL}/?sandbox-probe=2'))).toBe(true); });
test('importScripts', async () => { expect(await fails(() => importScripts('${baseURL}/?sandbox-probe=3'))).toBe(true); });`,
});

async function expectPassed(page: Page, count: number): Promise<void> {
  await expect(page.getByTestId('run-status')).toHaveText('passed');
  await expect(page.locator('[data-testid="test-result"][data-passed="true"]')).toHaveCount(count);
}

/** The runner frame as the page sees it, and as it sees itself. */
async function inspectFrame(page: Page) {
  const iframe = page.locator(`iframe[src="${RUNNER}"]`);
  await expect(iframe).toHaveCount(1);
  const frame = page.frames().find((candidate) => candidate.url().endsWith(RUNNER));
  expect(frame).toBeDefined();
  return {
    sandboxAttribute: await iframe.getAttribute('sandbox'),
    inside: await frame?.evaluate(() => {
      const attempt = (read: () => unknown): string => {
        try {
          return `value:${String(read())}`;
        } catch (error) {
          return `throws:${error instanceof Error ? error.name : 'unknown'}`;
        }
      };
      return {
        title: document.title,
        origin: window.origin,
        parentDocument: attempt(() => window.parent.document),
        localStorage: attempt(() => window.localStorage.length),
      };
    }),
  };
}

test.describe('code offline', () => {
  test('js, tsx and Python run with the network cut, behind the same wall', async ({
    page,
    context,
    browserName,
    baseURL,
  }) => {
    // WebKit's offline emulation fails every request, even those the service worker would
    // answer from its cache, and a routed abort there is applied before the worker sees
    // the request. The next test proves on WebKit that the worker answers the frame.
    test.skip(browserName === 'webkit', 'Playwright cannot emulate offline in WebKit');
    test.setTimeout(180_000);
    await controlled(page);
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');

    // One online run of each kind: the React runtime and Pyodide are cached on first use.
    await run(page, JS);
    await expectPassed(page, 1);
    await run(page, TSX());
    await expectPassed(page, 4);
    await run(page, PYTHON);
    await expectPassed(page, 1);

    const seen: string[] = [];
    page.on('request', (request) => seen.push(request.url()));
    await context.setOffline(true);
    // A new document, so a new runner frame, runtime and interpreter: nothing carried over.
    await page.reload();
    await expect(page.getByTestId('run-status')).toHaveText('idle');

    await run(page, JS);
    await expectPassed(page, 1);
    await run(page, TSX());
    await expectPassed(page, 4);
    await run(page, PYTHON);
    await expectPassed(page, 1);

    await run(page, wall(baseURL));
    await expectPassed(page, 8);
    expect(seen.filter((url) => url.includes('sandbox-probe'))).toEqual([]);
    expect(await inspectFrame(page)).toEqual({
      sandboxAttribute: null,
      inside: {
        title: 'Understory code sandbox',
        origin: 'null',
        parentDocument: 'throws:SecurityError',
        localStorage: 'throws:SecurityError',
      },
    });
  });

  test('the service worker answers the runner frame from its cache, header and all', async ({
    page,
    baseURL,
  }) => {
    test.setTimeout(180_000);
    await controlled(page);
    await page.goto(BENCH);
    await expect(page.getByTestId('run-status')).toHaveText('idle');
    // A copy only the cache holds: the frame shows it only if the worker answered.
    const headers = await page.evaluate(async (url) => {
      const cache = await caches.open('understory-static-v1');
      const copy = await cache.match(url);
      if (!copy) throw new Error('the runner is not precached');
      const marked = (await copy.text()).replace(
        /<title>[^<]*<\/title>/,
        '<title>Cached runner</title>',
      );
      await cache.put(url, new Response(marked, { headers: copy.headers }));
      return Object.fromEntries(copy.headers.entries());
    }, RUNNER);
    expect(headers['content-security-policy']).toMatch(/(^|;\s*)sandbox allow-scripts(;|$)/);

    const seen: string[] = [];
    page.on('request', (request) => seen.push(request.url()));
    await run(page, JS);
    await expectPassed(page, 1);
    await run(page, TSX());
    await expectPassed(page, 4);
    await run(page, PYTHON);
    await expectPassed(page, 1);
    await run(page, wall(baseURL));
    await expectPassed(page, 8);
    expect(seen.filter((url) => url.includes('sandbox-probe'))).toEqual([]);

    expect(await inspectFrame(page)).toEqual({
      sandboxAttribute: null,
      inside: {
        title: 'Cached runner',
        origin: 'null',
        parentDocument: 'throws:SecurityError',
        localStorage: 'throws:SecurityError',
      },
    });
    // What the parent hands the frame is cached too, so none of it needs the network again.
    const cached = await page.evaluate(async () => {
      const has = async (cache: string, key: string): Promise<boolean> =>
        Boolean(await (await caches.open(cache)).match(key));
      return {
        runtime: await has('understory-static-v1', '/sandbox/react-runtime.v1.js'),
        pyodide: await has('understory-python-v2', '/pyodide/0.29.5/pyodide.asm.wasm'),
      };
    });
    expect(cached).toEqual({ runtime: true, pyodide: true });
  });
});
