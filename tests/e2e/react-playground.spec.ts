import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * A React playground against real lessons, in Chromium (desktop) and WebKit (iPhone 15):
 * React loaded on first use, the component transpiled by sucrase, rendered by a real
 * React 19 in the sandboxed srcdoc frame, checks that click on a fresh render, and the
 * player's Check. Offline after first use is Chromium only, as in offline.spec.ts.
 */

const COUNTER_LESSON = '/learn/react/state-and-events';
const COUNTER_STEP = 'fix-rep-counter';
const BADGE_LESSON = '/learn/react/what-react-is';
const BADGE_STEP = 'fix-lowercase-component';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const FIXED_COUNTER = [
  'import { useState } from "react";',
  '',
  'export default function RepCounter() {',
  '  const [reps, setReps] = useState(0);',
  '  return <button onClick={() => setReps(reps + 1)}>{reps} reps</button>;',
  '}',
].join('\n');

const preview = (page: Page) => page.frameLocator('iframe[title="Your page"]');

/*
 * Brings the preview on screen, as a learner's scroll would. In mobile WebKit, Playwright
 * scrolls the frame's own document for an element inside a srcdoc frame, not the page
 * around it, so a click on a preview below the fold lands outside the viewport.
 */
async function showPreview(page: Page): Promise<void> {
  await page.locator('iframe[title="Your page"]').scrollIntoViewIfNeeded();
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function writeComponent(page: Page, code: string): Promise<void> {
  await page.getByRole('textbox', { name: 'Component of your page' }).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(code);
}

test.describe('React playground', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`fixing a counter makes the real button count, and the checks pass, in ${scheme}`, async ({
      page,
    }) => {
      test.slow();
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${COUNTER_LESSON}#${COUNTER_STEP}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);

      // The starter renders, and a click in the preview shows the bug: nothing changes.
      const button = preview(page).getByRole('button');
      await expect(button).toHaveText('0 reps', { timeout: 20_000 });
      await showPreview(page);
      await button.click();
      await expect(button).toHaveText('0 reps');
      await expect(page.getByText('1 of 2 pass')).toBeVisible();

      await writeComponent(page, FIXED_COUNTER);
      await expect(page.getByText('2 of 2 pass')).toBeVisible({ timeout: 20_000 });
      // The learner's own clicks on the fixed component count up.
      await showPreview(page);
      await preview(page).getByRole('button').click();
      await preview(page).getByRole('button').click();
      await expect(preview(page).getByRole('button')).toHaveText('2 reps');

      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await axe(page), `${scheme} at ${width}`).toEqual([]);
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${scheme} at ${width}`).toBeLessThanOrEqual(0);
      }

      await page.getByRole('button', { name: 'Check' }).click();
      await expect(page.getByText('Right', { exact: true })).toBeVisible();
      await expect(page.getByText('Every check passes, with no hints.')).toBeVisible();
    });
  }

  test('an error names the learner’s line, and React’s warnings show', async ({ page }) => {
    test.slow();
    await page.goto(`${BADGE_LESSON}#${BADGE_STEP}`);
    // The starter's lowercase tag: React renders a `badge` element and warns about it.
    await expect(preview(page).getByRole('heading', { name: 'Blue mug' })).toBeVisible({
      timeout: 20_000,
    });
    await expect(page.getByText(/React warns: .*<badge>/)).toBeVisible();
    await expect(page.getByTestId('dom-tree')).toContainText('badge');

    await writeComponent(
      page,
      [
        'export default function Card() {',
        '  const tags = undefined;',
        '  return <p>{tags.length}</p>;',
        '}',
      ].join('\n'),
    );
    await expect(page.getByText(/Your component stopped: TypeError: .*\(line 3\)/)).toBeVisible({
      timeout: 20_000,
    });

    await writeComponent(page, 'export default function Card() {\n  return <p>Hi</p\n}');
    await expect(page.getByText(/Your component stopped: SyntaxError: .*\(line \d\)/)).toBeVisible({
      timeout: 20_000,
    });
  });

  test('renders with the network cut after first use', async ({ page, context, browserName }) => {
    test.skip(browserName === 'webkit', 'Playwright cannot emulate offline in WebKit');
    test.setTimeout(120_000);
    await page.goto('/learn');
    await expect(page.locator('html')).toHaveAttribute('data-worker', 'controlled', {
      timeout: 60_000,
    });
    await page.goto(`${COUNTER_LESSON}#${COUNTER_STEP}`);
    await expect(preview(page).getByRole('button')).toHaveText('0 reps', { timeout: 20_000 });

    await context.setOffline(true);
    await page.reload();
    await expect(preview(page).getByRole('button')).toHaveText('0 reps', { timeout: 20_000 });
    await expect(page.getByText('1 of 2 pass')).toBeVisible();
    await writeComponent(page, FIXED_COUNTER);
    await expect(page.getByText('2 of 2 pass')).toBeVisible({ timeout: 20_000 });
  });
});
