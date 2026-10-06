import { expect, test, type Page, type Response } from '@playwright/test';

/*
 * What a learner downloads, and when. Reading a lesson must not pay for the editor, and
 * opening the editor must not pay for the transpiler. Sizes are bytes on the wire as
 * `next start` serves them (gzip), which is what a phone on a train actually waits for.
 *
 * Budgets are ceilings, not targets. Measured on 2026-09-17: see the numbers beside each
 * budget. A failure here means something heavy moved into an earlier stage: look at what
 * the new chunk imports before raising a number.
 */

const LESSON = '/learn/javascript/values-types-coercion';
const STEP = `${LESSON}#write-cart-total`;
const KB = 1024;

const BUDGET = {
  /*
   * The lesson route before any code step. Measured 284 KB; the ceiling is that plus 10%.
   * It had crept to 310.7 KB by 2026-09-25; the code challenge step then left the route
   * for a chunk of its own (registry.tsx), and it measured 306.0 KB.
   * The target was 170 KB. React and Next are 114 KB of it. Most of the rest is zod: its
   * core (39 KB) and a 71 KB chunk in which zod's bundled locales travel with the event
   * and content schemas. Nothing of the editor is in it. Lower this when zod shrinks.
   *
   * 25 September 2026: plus 36 KB for motion (docs/MOTION.md). GSAP core and Lenis are
   * 33 KB, prefetched with the app pages a lesson links to. Measured 343 KB.
   *
   * 29 September 2026: Scout AI is on every lesson. Its trigger, store and page guide load
   * with the route; the panel and its providers stay lazy. Measured 358 KB. The next saving
   * is loading the page guide with the panel.
   *
   * 7 October 2026: it had crept to 399 KB. Most of the excess was zod's locales: zod's `z`
   * namespace re-exports every language's messages, and Turbopack keeps a namespace whole.
   * zod now comes through src/core/zod.ts, named re-exports Turbopack can shake, and an
   * ESLint rule keeps it that way. Measured 338.5 KB; the ceiling is that plus 5%.
   */
  lesson: 356 * KB,
  /** CodeMirror, the editor and the code step around it. Measured 144 KB, 185 KB on 2026-09-25. */
  editor: 220 * KB,
  /** The sandbox runner and sucrase, on the first run. Measured 54 KB. */
  run: 120 * KB,
};

/*
 * Names that must only ever appear in the late chunks. Minified sucrase does not contain
 * its own name, so it is recognised by an option name that survives minification.
 */
const HEAVY = /codemirror|sucrase|disableESTransforms/i;

interface Script {
  url: string;
  bytes: number;
  heavy: boolean;
}

/** Records every JavaScript response of the page, frames included. */
function recordScripts(page: Page): Script[] {
  const scripts: Script[] = [];
  const pending: Promise<void>[] = [];
  const onResponse = (response: Response): void => {
    const url = new URL(response.url());
    if (!url.pathname.endsWith('.js') || response.status() !== 200) return;
    pending.push(
      (async () => {
        const body = await response.body();
        const sizes = await response.request().sizes();
        const header = Number(response.headers()['content-length']);
        // Chunked gzip has no content-length. The encoded body size is the same figure.
        const bytes = header > 0 ? header : sizes.responseBodySize;
        scripts.push({ url: url.pathname, bytes, heavy: HEAVY.test(body.toString('utf8')) });
      })().catch(() => undefined),
    );
  };
  page.on('response', onResponse);
  Object.defineProperty(scripts, 'settled', { value: () => Promise.all(pending) });
  return scripts;
}

const settled = (scripts: Script[]): Promise<unknown> =>
  (scripts as Script[] & { settled(): Promise<unknown> }).settled();

const total = (scripts: Script[]): number => scripts.reduce((sum, s) => sum + s.bytes, 0);

function report(label: string, scripts: Script[], budget: number): void {
  const lines = [...scripts]
    .sort((a, b) => b.bytes - a.bytes)
    .slice(0, 5)
    .map((s) => `    ${(s.bytes / KB).toFixed(1)} KB  ${s.url}`);
  console.log(
    `${label}: ${(total(scripts) / KB).toFixed(1)} KB of ${budget / KB} KB in ${scripts.length} files\n${lines.join('\n')}`,
  );
}

test.describe('bundle budget', () => {
  test.skip(({ isMobile }) => isMobile, 'Byte counts come from Chromium. One engine is enough.');

  test('a lesson loads without the editor, the editor without the transpiler', async ({
    browser,
  }) => {
    // Stage 1: the lesson, from a cold cache, before any code step.
    const reading = await browser.newContext();
    const lessonPage = await reading.newPage();
    const lessonScripts = recordScripts(lessonPage);
    await lessonPage.goto(LESSON, { waitUntil: 'networkidle' });
    await expect(lessonPage.getByRole('button', { name: 'Begin' })).toBeVisible();
    await settled(lessonScripts);
    report('lesson route', lessonScripts, BUDGET.lesson);
    expect(lessonScripts.filter((s) => s.heavy).map((s) => s.url)).toEqual([]);
    expect(total(lessonScripts)).toBeLessThanOrEqual(BUDGET.lesson);
    await reading.close();

    // Stage 2: the code step, from a cold cache again. What the lesson did not load is
    // what the editor costs.
    const writing = await browser.newContext();
    const stepPage = await writing.newPage();
    const stepScripts = recordScripts(stepPage);
    await stepPage.goto(STEP, { waitUntil: 'networkidle' });
    await expect(stepPage.locator('.cm-editor').first()).toBeVisible();
    await settled(stepScripts);
    const known = new Set(lessonScripts.map((s) => s.url));
    const editorScripts = stepScripts.filter((s) => !known.has(s.url));
    report('editor chunks', editorScripts, BUDGET.editor);
    // Proves the detector: CodeMirror is found where it is expected.
    expect(editorScripts.some((s) => s.heavy)).toBe(true);
    expect(total(editorScripts)).toBeLessThanOrEqual(BUDGET.editor);

    // Stage 3: the first run brings the runner and the transpiler.
    const beforeRun = new Set(stepScripts.map((s) => s.url));
    await stepPage.getByRole('button', { name: 'Run tests' }).click();
    await expect(stepPage.getByTestId('run-status')).toHaveAttribute('data-status', 'failed', {
      timeout: 15_000,
    });
    await settled(stepScripts);
    const runScripts = stepScripts.filter((s) => !beforeRun.has(s.url));
    report('first run', runScripts, BUDGET.run);
    expect(runScripts.some((s) => s.heavy)).toBe(true);
    expect(total(runScripts)).toBeLessThanOrEqual(BUDGET.run);
    await writing.close();
  });
});
