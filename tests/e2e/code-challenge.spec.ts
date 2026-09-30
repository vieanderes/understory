import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * The code-challenge step against a real lesson, in Chromium (desktop) and WebKit
 * (iPhone 15). Everything here goes through the production build: the lazy editor
 * chunk, the sandboxed runner, the player's Check and the IndexedDB event log.
 */

const LESSON = '/learn/javascript/values-types-coercion';
const STEP = `${LESSON}#write-cart-total`;
const SOLUTION = readFileSync(
  path.join(process.cwd(), 'content/course/03-javascript/02-values-types-coercion/solution.js'),
  'utf8',
);
const LOOP = 'function cartTotal() {\n  while (true) {}\n}\n';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
const SHOTS = process.env.CODE_STEP_SHOTS;

const editor = (page: Page): Locator => page.getByRole('textbox', { name: 'Your code' });
const status = (page: Page): Locator => page.getByTestId('run-status');

async function openStep(page: Page): Promise<void> {
  await page.goto(STEP);
  await expect(page.locator('.cm-editor').first()).toBeVisible();
}

/**
 * The editor's Mod key. CodeMirror binds Mod to Cmd on Apple platforms, and an emulated
 * iPhone counts as one even when WebKit runs on Linux, where Playwright's ControlOrMeta
 * sends Control. Ctrl+A then moves the cursor instead of selecting, and CI fails.
 */
/** Waits until no animation is in flight, so a box is measured where it comes to rest. */
async function settled(page: Page): Promise<void> {
  await page.waitForFunction(() =>
    document.getAnimations().every((animation) => animation.playState !== 'running'),
  );
}

async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

/** Replaces the whole document the way a paste would: through the editor's content DOM. */
async function writeCode(page: Page, code: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(code);
}

async function runTests(page: Page, expected: 'passed' | 'failed' | 'timeout' | 'error') {
  await page.getByRole('button', { name: 'Run tests' }).click();
  await expect(status(page)).toHaveAttribute('data-status', expected, { timeout: 15_000 });
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

async function shot(page: Page, project: string, name: string): Promise<void> {
  if (!SHOTS) return;
  const size = project === 'mobile' ? { width: 390, height: 844 } : { width: 1440, height: 900 };
  await page.setViewportSize(size);
  await page.screenshot({ path: path.join(SHOTS, `${name}-${size.width}x${size.height}.png`) });
}

interface StoredEvent {
  type: string;
  payload: Record<string, unknown>;
}

function storedEvents(page: Page): Promise<StoredEvent[]> {
  return page.evaluate(
    () =>
      new Promise<StoredEvent[]>((resolve, reject) => {
        const open = indexedDB.open('understory');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('events').objectStore('events').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => resolve(all.result as StoredEvent[]);
        };
      }),
  );
}

async function answeredEvent(page: Page): Promise<StoredEvent> {
  let found: StoredEvent | undefined;
  await expect
    .poll(async () => {
      found = (await storedEvents(page)).find(
        (e) => e.type === 'step_answered' && e.payload.stepId === 'write-cart-total',
      );
      return found !== undefined;
    })
    .toBe(true);
  if (!found) throw new Error('No step_answered event was stored.');
  return found;
}

test.describe('code challenge', () => {
  test('the editor takes the place of the highlighted starter without moving anything', async ({
    page,
  }) => {
    // Hold the editor chunk back, so the placeholder can be measured while it stands in.
    let release: () => void = () => undefined;
    const held = new Promise<void>((resolve) => (release = resolve));
    await page.route('**/_next/static/chunks/**/*.js', async (route) => {
      const response = await route.fetch();
      const body = await response.text();
      // The player names `.cm-editor` too. Only CodeMirror itself names its scroller.
      if (body.includes('cm-scroller')) await held;
      await route.fulfill({ response, body });
    });

    // The held chunk also holds the load event, so do not wait for it.
    await page.goto(STEP, { waitUntil: 'commit' });
    const placeholder = page.locator('.editor-placeholder');
    await expect(placeholder).toBeVisible();
    await expect(placeholder).toContainText('cartTotal');
    // Measure once the page has settled: React has taken over (the symbol bar appears on
    // a phone only after that) and the mono face is in place. Both move the placeholder
    // and the editor together, which is a separate concern from the swap measured here.
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.evaluate(() => document.fonts.ready);
    // A step arrives on a 240 ms slide of 24 px (`.step-advance`). A box measured while
    // that runs sits somewhere on the way, so the two measurements below would differ by
    // whatever part of it was left, and the swap would look like a shift it is not.
    await settled(page);
    const run = page.getByRole('button', { name: 'Run tests' });
    const before = { box: await placeholder.boundingBox(), run: await run.boundingBox() };

    release();
    const live = page.locator('.cm-editor').first();
    await expect(live).toBeVisible();
    await expect(placeholder).toHaveCount(0);
    await settled(page);
    const after = { box: await live.boundingBox(), run: await run.boundingBox() };

    // The editor repeats the placeholder's geometry exactly, so a pixel of give is plenty.
    for (const key of ['x', 'y', 'width', 'height'] as const) {
      expect(Math.abs((after.box?.[key] ?? 0) - (before.box?.[key] ?? 0))).toBeLessThanOrEqual(1);
      expect(Math.abs((after.run?.[key] ?? 0) - (before.run?.[key] ?? 0))).toBeLessThanOrEqual(1);
    }
    // Chunks still in flight when the test ends would fail the route and the next test.
    await page.unrouteAll({ behavior: 'ignoreErrors' });
  });

  test('the untouched starter fails, and a failing run is not an answer', async ({
    page,
  }, info) => {
    await openStep(page);
    await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled();
    expect(await axe(page)).toEqual([]);
    await shot(page, info.project.name, 'idle');

    await runTests(page, 'failed');
    await expect(status(page)).toContainText(/\d of 5 pass/);
    await expect(
      page.locator('[data-testid="test-row"][data-passed="false"]').first(),
    ).toBeVisible();
    // A code challenge has no second try, so a failing run must not be submittable: it
    // would score zero for ever on one stray click. The learner keeps working, takes a
    // hint, reveals the solution, or leaves the step for now.
    await expect(page.getByRole('button', { name: 'Check' })).toBeDisabled();
    await expect(page.getByRole('button', { name: 'Skip for now' })).toBeEnabled();
    expect(await axe(page)).toEqual([]);
    await shot(page, info.project.name, 'failed');
  });

  test('the solution passes, Check gives the verdict and the fact is stored', async ({
    page,
  }, info) => {
    await openStep(page);
    await writeCode(page, SOLUTION);
    await runTests(page, 'passed');
    await expect(status(page)).toHaveText('All tests pass');
    await expect(page.locator('[data-testid="test-row"][data-passed="true"]')).toHaveCount(5);
    // Passing does not move the learner on. They decide when to check.
    await expect(page.getByRole('button', { name: 'Continue' })).toHaveCount(0);
    expect(await axe(page)).toEqual([]);
    await shot(page, info.project.name, 'passed');

    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Right', { exact: true })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();

    const event = await answeredEvent(page);
    expect(event.payload).toMatchObject({
      stepType: 'code-challenge',
      correct: true,
      hintsUsed: 0,
      revealed: false,
      score: 1,
    });
  });

  test('hints lower the score that is recorded', async ({ page }, info) => {
    await openStep(page);
    await page.getByRole('button', { name: 'Hint 1 of 3' }).click();
    await page.getByRole('button', { name: 'Hint 2 of 3' }).click();
    await expect(page.getByTestId('hint')).toHaveCount(2);
    await shot(page, info.project.name, 'hint');

    await writeCode(page, SOLUTION);
    await runTests(page, 'passed');
    await page.getByRole('button', { name: 'Check' }).click();

    const event = await answeredEvent(page);
    expect(event.payload).toMatchObject({ correct: true, hintsUsed: 2 });
    expect(event.payload.score).toBeCloseTo(0.6);
  });

  test('the solution is fetched only on request, and then the step scores 0', async ({ page }) => {
    const solutionRequests: string[] = [];
    page.on('request', (r) => {
      if (r.url().includes('/content/v1/solutions/')) solutionRequests.push(r.url());
    });
    await openStep(page);
    for (const n of [1, 2, 3]) await page.getByRole('button', { name: `Hint ${n} of 3` }).click();
    expect(solutionRequests).toEqual([]);

    await page.getByRole('button', { name: 'Show solution' }).click();
    await expect(page.getByText('Show the solution? This step then scores 0.')).toBeVisible();
    await page.getByRole('button', { name: 'Show', exact: true }).click();
    await expect(page.getByRole('textbox', { name: 'Reference solution' })).toContainText(
      'quantity >= 1',
    );
    expect(solutionRequests).toHaveLength(1);
    // The learner's own code is still the starter.
    await expect(editor(page)).toContainText('Replace this body');

    await writeCode(page, SOLUTION);
    await runTests(page, 'passed');
    await page.getByRole('button', { name: 'Check' }).click();
    const event = await answeredEvent(page);
    expect(event.payload).toMatchObject({ revealed: true, score: 0 });
  });

  test('an endless loop times out and the page stays responsive', async ({ page }) => {
    await openStep(page);
    await writeCode(page, LOOP);
    await page.getByRole('button', { name: 'Run tests' }).click();
    // While the worker spins, the main thread still answers.
    await page.getByRole('button', { name: 'Hint 1 of 3' }).click();
    await expect(page.getByTestId('hint')).toHaveCount(1);
    await expect(status(page)).toHaveAttribute('data-status', 'timeout', { timeout: 15_000 });
    await expect(status(page)).toHaveText('Timed out after 3 s: look for a loop that never ends');
    await page.locator('summary', { hasText: 'Show the tests' }).click();
    await expect(page.getByRole('textbox', { name: 'Tests for this step' })).toContainText(
      'multiplies price by quantity and adds the fee',
    );
  });

  test('a syntax error names its line', async ({ page }) => {
    await openStep(page);
    await writeCode(page, 'function cartTotal() {\n  return 1 +;\n}\n');
    await runTests(page, 'error');
    await expect(status(page)).toContainText('Syntax error on line 2');
  });

  test('a draft survives a reload, and Reset restores the starter', async ({ page }) => {
    await openStep(page);
    await writeCode(page, '// my draft\n');
    await page.reload();
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await expect(editor(page)).toContainText('// my draft');

    await page.getByRole('button', { name: 'Reset' }).click();
    await page.getByRole('button', { name: 'Restore' }).click();
    await expect(editor(page)).toContainText('Replace this body');
    await expect(editor(page)).not.toContainText('// my draft');
  });

  test('the page never scrolls sideways', async ({ page }) => {
    await openStep(page);
    await runTests(page, 'failed');
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

test.describe('code challenge on a keyboard', () => {
  test.skip(({ isMobile }) => isMobile, 'A phone has no Tab key. The symbol bar is its test.');

  test('Tab indents, and Escape then Tab leaves the editor', async ({ page }) => {
    await openStep(page);
    await writeCode(page, 'x');
    await page.keyboard.press('Tab');
    await expect(editor(page)).toBeFocused();
    await expect(editor(page)).toHaveText(/^\s+x$/);

    await page.keyboard.press('Escape');
    await page.keyboard.press('Tab');
    await expect(editor(page)).not.toBeFocused();
    await expect(page.getByRole('button', { name: 'Run tests' })).toBeFocused();
  });

  test('Ctrl or Cmd with Enter runs the tests from inside the editor', async ({ page }) => {
    await openStep(page);
    await writeCode(page, SOLUTION);
    await page.keyboard.press(`${await modKey(page)}+Enter`);
    await expect(status(page)).toHaveAttribute('data-status', 'passed', { timeout: 15_000 });
    // The shortcut ran the tests. It did not also type a line break.
    await expect(editor(page)).toContainText('return total;');
    await expect(page.locator('.cm-line')).toHaveCount(SOLUTION.split('\n').length);
  });

  test('no symbol bar where there is a keyboard', async ({ page }) => {
    await openStep(page);
    await expect(page.getByRole('toolbar', { name: 'Symbols' })).toHaveCount(0);
  });
});

test.describe('code challenge on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'The symbol bar is for coarse pointers.');

  test('the symbol bar inserts a pair with the cursor between, and keeps focus', async ({
    page,
  }) => {
    await openStep(page);
    const bar = page.getByRole('toolbar', { name: 'Symbols' });
    await expect(bar).toBeVisible();
    const key = bar.getByRole('button', { name: 'Braces' });
    const box = await key.boundingBox();
    expect(box?.width).toBeGreaterThanOrEqual(40);
    expect(box?.height).toBeGreaterThanOrEqual(48);

    await writeCode(page, '');
    await key.tap();
    await expect(editor(page)).toHaveText('{}');
    await expect(editor(page)).toBeFocused();
    // Typing lands between the two braces.
    await page.keyboard.insertText('x');
    await expect(editor(page)).toHaveText('{x}');

    // How much one undo takes back depends on how fast the test typed. Redo is exact.
    await bar.getByRole('button', { name: 'Undo' }).tap();
    await expect(editor(page)).not.toHaveText('{x}');
    await bar.getByRole('button', { name: 'Redo' }).tap();
    await expect(editor(page)).toHaveText('{x}');
  });

  test('the editor text is 16 px, so a tap into it does not zoom the page', async ({ page }) => {
    await openStep(page);
    const size = await editor(page).evaluate((el) => getComputedStyle(el).fontSize);
    expect(parseFloat(size)).toBeGreaterThanOrEqual(16);
  });

  test('long lines wrap inside the editor at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await openStep(page);
    const scroller = page.locator('.cm-scroller').first();
    const overflow = await scroller.evaluate((el) => el.scrollWidth - el.clientWidth);
    expect(overflow).toBeLessThanOrEqual(0);
  });
});

/*
 * A challenge with a twin (docs/CONTENT-GUIDE.md, "Twins"): the learner switches to Python
 * once, runs, and the next twin step opens in Python too.
 */
test.describe('code challenge with a twin', () => {
  const TWIN_LESSON = '/learn/interview-challenges/ai-build-rag';
  const TWIN_DIR = 'content/course/28-interview-challenges/19-ai-build-rag';
  /** Pyodide, 13 MB, on a cold page. */
  const FIRST_PYTHON_RUN = { timeout: 90_000 };
  const python = (page: Page) => page.getByRole('radio', { name: 'Python' });

  test('switching to Python runs Python, and the next twin step opens in it', async ({
    page,
  }, info) => {
    test.setTimeout(150_000);
    await page.goto(`${TWIN_LESSON}#write-chunk`);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await expect(page.getByRole('radio', { name: 'TypeScript' })).toBeChecked();

    await page
      .locator('label')
      .filter({ has: python(page) })
      .click();
    await expect(python(page)).toBeChecked();
    await expect(editor(page)).toContainText('class Chunk');

    await writeCode(
      page,
      readFileSync(path.join(process.cwd(), TWIN_DIR, 'chunk.solution.py'), 'utf8'),
    );
    await page.getByRole('button', { name: 'Run tests' }).click();
    await expect(status(page)).toHaveAttribute('data-status', 'passed', FIRST_PYTHON_RUN);
    expect(await axe(page)).toEqual([]);
    await shot(page, info.project.name, 'twin-python');

    await page.goto(`${TWIN_LESSON}#write-sentence-chunk`);
    await page.reload();
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await expect(python(page)).toBeChecked();
    await expect(editor(page)).toContainText('def sentences');
  });
});
