import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * The playground step against a real lesson, in Chromium (desktop) and WebKit (iPhone 15):
 * the lazy editor, the sandboxed srcdoc preview, the probe's checks, the player's Check
 * and the IndexedDB event log. The first HTML lesson is the fixture, because the HTML
 * chapter is where learners first see a page they wrote.
 */

const LESSON = '/learn/html/your-first-web-page';
const STEP_ID = 'build-recipe-card';
const SOLUTION = [
  '<h1>Pancakes</h1>',
  '<p>Fluffy, quick and ready in 20 minutes.</p>',
  '<h2>Ingredients</h2>',
  '<p>Flour, eggs, milk and a pinch of salt.</p>',
].join('\n');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const preview = (page: Page) => page.frameLocator('iframe[title="Your page"]');

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

/** The editor's Mod key: CodeMirror binds Cmd on Apple platforms, emulated iPhone included. */
async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function writeHtml(page: Page, html: string): Promise<void> {
  await page.getByRole('textbox', { name: 'HTML of your page' }).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(html);
}

async function answered(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(
    (stepId) =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open('understory');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('events').objectStore('events').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            const events = all.result as { type: string; payload: Record<string, unknown> }[];
            resolve(
              events.find((e) => e.type === 'step_answered' && e.payload.stepId === stepId)
                ?.payload,
            );
          };
        };
      }),
    STEP_ID,
  );
}

test.describe('playground', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`typing redraws the page, the checks tick, and Check records it, in ${scheme}`, async ({
      page,
    }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${LESSON}#${STEP_ID}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(page.locator('.cm-editor').first()).toBeVisible();
      await expect(preview(page).getByRole('heading', { name: 'Pancakes' })).toBeVisible();
      await expect(page.getByText('0 of 3 pass')).toBeVisible();

      await writeHtml(page, SOLUTION);
      // The page redraws from what was typed, in the real sandboxed frame.
      await expect(preview(page).getByRole('heading', { name: 'Ingredients' })).toBeVisible();
      await expect(page.getByText('3 of 3 pass')).toBeVisible();
      await expect(
        page.locator('[data-testid="playground-check"][data-passed="true"]'),
      ).toHaveCount(3);

      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await axe(page), `${scheme} at ${width}`).toEqual([]);
        // Nothing scrolls sideways, at either width.
        const overflow = await page.evaluate(
          () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
        );
        expect(overflow, `${scheme} at ${width}`).toBeLessThanOrEqual(0);
      }

      await page.getByRole('button', { name: 'Check' }).click();
      await expect(page.getByText('Right', { exact: true })).toBeVisible();
      await expect(page.getByText('Every check passes, with no hints.')).toBeVisible();
      await expect(page.getByRole('button', { name: 'Continue' })).toBeVisible();
      await expect
        .poll(() => answered(page))
        .toMatchObject({
          stepType: 'playground',
          concept: 'html.elements',
          correct: true,
          score: 1,
        });
    });
  }

  test('on a phone the page sits right under the editor', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${LESSON}#${STEP_ID}`);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    const editor = await page.locator('.cm-editor').first().boundingBox();
    const frame = await page.locator('iframe[title="Your page"]').boundingBox();
    expect(editor && frame).toBeTruthy();
    if (!editor || !frame) return;
    // Stacked, the page next, with only the phone's symbol row (56 px) and the page's label
    // row (40 px, lined up with the editor's) between them, and the gaps around them.
    expect(frame.y).toBeGreaterThan(editor.y + editor.height);
    expect(frame.y - (editor.y + editor.height)).toBeLessThan(144);
    expect(frame.width).toBeGreaterThan(300);
  });
});
