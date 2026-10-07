import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Python code challenges that import a package or await a coroutine, on real lessons of
 * chapter 19, through the production build: Chromium (desktop) and WebKit (iPhone 15).
 * The first run loads Pyodide and then numpy from the app's own origin, names both while
 * it does, and passes; the async challenge's tests await the learner's coroutine on
 * Pyodide's event loop. docs/SANDBOX.md, "Packages" and "Async tests".
 */

const COURSE = 'content/course/19-python-for-ai';
const NUMPY = { url: '/learn/python-for-ai/numpy#write-pass-rate', file: '08-numpy/rate' };
const ASYNC = {
  url: '/learn/python-for-ai/asyncio#write-classify-all',
  file: '04-asyncio/bounded',
};
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
/** Pyodide, 13 MB, then numpy, 3 MB, on a cold page: seconds locally, more in CI. */
const FIRST_RUN = { timeout: 90_000 };

const solution = (file: string): string =>
  readFileSync(path.join(process.cwd(), COURSE, `${file}.solution.py`), 'utf8');

const editor = (page: Page): Locator => page.getByRole('textbox', { name: 'Your code' });
const status = (page: Page): Locator => page.getByTestId('run-status');

async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function openStep(page: Page, url: string): Promise<void> {
  await page.goto(url);
  await expect(page.locator('.cm-editor').first()).toBeVisible();
}

async function writeCode(page: Page, code: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(code);
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

async function noSidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('Python packages and async', () => {
  test.describe.configure({ timeout: 180_000 });

  for (const scheme of ['light', 'dark'] as const) {
    test(`numpy loads on the first run, is named while it loads, and passes, in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      const wheels: string[] = [];
      page.on('request', (request) => {
        const { origin, pathname } = new URL(request.url());
        if (pathname.endsWith('.whl')) wheels.push(`${origin}${pathname}`);
      });
      await openStep(page, NUMPY.url);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);

      // The starter returns 0.0: numpy loads, and the run fails on its own merits.
      await page.getByRole('button', { name: 'Run tests' }).click();
      await expect(status(page)).toContainText(/Loading (Python and )?numpy…/);
      await expect(status(page)).toHaveAttribute('data-status', 'failed', FIRST_RUN);
      expect(wheels).toHaveLength(1);
      expect(wheels[0]).toMatch(/\/pyodide\/0\.29\.5\/numpy-2\.2\.5-.*\.whl$/);
      expect(new URL(wheels[0] ?? '').origin).toBe(new URL(page.url()).origin);

      await writeCode(page, solution(NUMPY.file));
      await page.getByRole('button', { name: 'Run tests' }).click();
      await expect(status(page)).toHaveAttribute('data-status', 'passed', { timeout: 15_000 });
      await expect(status(page)).toHaveText('All tests pass');
      // Warm: nothing is fetched again.
      expect(wheels).toHaveLength(1);

      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await axe(page), `${scheme} at ${width}`).toEqual([]);
        expect(await noSidewaysScroll(page), `${scheme} at ${width}`).toBeLessThanOrEqual(0);
      }
    });
  }

  test('an async challenge runs its coroutine and its async tests', async ({ page }) => {
    await openStep(page, ASYNC.url);
    await page.getByRole('button', { name: 'Run tests' }).click();
    // The starter awaits one call at a time, so the concurrency tests fail.
    await expect(status(page)).toHaveAttribute('data-status', 'failed', FIRST_RUN);
    await expect(
      page.getByTestId('test-row').filter({ hasText: 'runs up to the limit' }),
    ).toHaveAttribute('data-passed', 'false');

    await writeCode(page, solution(ASYNC.file));
    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(status(page)).toHaveAttribute('data-status', 'passed', { timeout: 15_000 });
    await expect(page.locator('[data-testid="test-row"][data-passed="true"]')).toHaveCount(4);
    expect(await axe(page)).toEqual([]);
  });

  test('numpy runs offline after its first use', async ({ page, context, browserName }) => {
    // Playwright cannot emulate offline in WebKit (tests/e2e/offline.spec.ts says why).
    test.skip(browserName === 'webkit', 'Playwright cannot emulate offline in WebKit');
    await page.goto('/learn');
    await expect(page.locator('html')).toHaveAttribute('data-worker', 'controlled', {
      timeout: 60_000,
    });
    await openStep(page, NUMPY.url);
    await writeCode(page, solution(NUMPY.file));
    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(status(page)).toHaveAttribute('data-status', 'passed', FIRST_RUN);

    const cached = await page.evaluate(async () => {
      const cache = await caches.open('understory-python-v2');
      const keys = await cache.keys();
      return keys.map((request) => new URL(request.url).pathname);
    });
    expect(cached.some((name) => /\/numpy-2\.2\.5-.*\.whl$/.test(name))).toBe(true);

    await context.setOffline(true);
    // A new document: a new frame and interpreter, with numpy from the worker's cache.
    await page.reload();
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await writeCode(page, solution(NUMPY.file));
    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(status(page)).toHaveAttribute('data-status', 'passed', FIRST_RUN);
  });
});
