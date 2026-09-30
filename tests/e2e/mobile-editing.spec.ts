import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Writing code on a phone (docs/MOBILE-EDITING.md), in WebKit as an iPhone 15. Playwright
 * cannot raise an on-screen keyboard, so the visual viewport is replaced before the page
 * loads with one that `keyboard(px)` shrinks, as iOS shrinks it: the layout viewport stays
 * full height and only the visual viewport loses the keyboard's height.
 */

const CHALLENGE = '/learn/javascript/values-types-coercion#write-cart-total';
const PLAYGROUND = '/learn/html/your-first-web-page#build-recipe-card';
/** A challenge whose class is locked: the learner writes lines 12 and 13 only. */
const REGION = '/learn/javascript/functions-and-this#write-add-handler';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
/** An iPhone keyboard with its predictive bar and Safari's form bar, in CSS pixels. */
const KEYBOARD = 336;
const SHOTS = process.env.MOBILE_EDITING_SHOTS;

async function fakeKeyboard(page: Page): Promise<void> {
  await page.addInitScript(() => {
    const viewport = new EventTarget();
    let keyboard = 0;
    Object.defineProperties(viewport, {
      offsetTop: { get: () => 0 },
      offsetLeft: { get: () => 0 },
      pageTop: { get: () => window.scrollY },
      pageLeft: { get: () => window.scrollX },
      width: { get: () => window.innerWidth },
      height: { get: () => window.innerHeight - keyboard },
      scale: { get: () => 1 },
    });
    Object.defineProperty(window, 'visualViewport', { configurable: true, get: () => viewport });
    Object.assign(window, {
      keyboard: (px: number) => {
        keyboard = px;
        viewport.dispatchEvent(new Event('resize'));
      },
    });
  });
}

async function keyboard(page: Page, px: number): Promise<void> {
  await page.evaluate((value) => {
    (window as unknown as { keyboard(px: number): void }).keyboard(value);
  }, px);
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

async function shot(page: Page, name: string): Promise<void> {
  if (!SHOTS) return;
  await page.screenshot({ path: path.join(SHOTS, `${name}.png`) });
}

const suggestions = (page: Page): Locator => page.getByRole('toolbar', { name: 'Suggestions' });
const chip = (page: Page, name: string): Locator =>
  suggestions(page).getByRole('button', { name, exact: true });

/** Empties the editor and puts the caret in it, with the keyboard up. */
async function startTyping(page: Page, name: string): Promise<Locator> {
  const editor = page.getByRole('textbox', { name });
  await editor.tap();
  await page.keyboard.press('Meta+A');
  await page.keyboard.press('Backspace');
  await keyboard(page, KEYBOARD);
  await expect(suggestions(page)).toBeVisible();
  return editor;
}

/** Where the keyboard begins: the fake visual viewport's bottom edge. */
function keyboardTop(page: Page): Promise<number> {
  return page.evaluate((px) => window.innerHeight - px, KEYBOARD);
}

/**
 * The caret's line is on screen, above the rows that ride on the keyboard. On a touch
 * screen the caret is the native one, so its line is measured: the band CodeMirror draws
 * behind the line being typed on.
 */
async function expectCaretClear(page: Page): Promise<void> {
  const caret = await page.locator('.cm-focused .cm-activeLine').first().boundingBox();
  const bar = await page.locator('.symbol-bar[data-docked="true"]').boundingBox();
  expect(caret && bar).toBeTruthy();
  if (!caret || !bar) return;
  // The rows end where the keyboard begins.
  expect(Math.round(bar.y + bar.height)).toBe(await keyboardTop(page));
  expect(caret.y).toBeGreaterThanOrEqual(0);
  expect(caret.y + caret.height).toBeLessThanOrEqual(bar.y);
}

test.describe('writing code on a phone', () => {
  test.skip(({ isMobile }) => !isMobile, 'The rows are for a touch screen.');

  test.beforeEach(async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await fakeKeyboard(page);
  });

  test('a code challenge written with blocks, gaps, the cursor keys and the Run key', async ({
    page,
  }) => {
    await page.goto(CHALLENGE);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    const editor = await startTyping(page, 'Your code');

    // Before a letter is typed, the row offers selection, not code.
    await expect(chip(page, 'Select word')).toBeVisible();

    await page.keyboard.insertText('fu');
    await chip(page, 'function () {}').tap();
    await page.keyboard.insertText('cartTotal');
    await chip(page, 'Next gap').tap();
    await page.keyboard.insertText('lines, bookingFee');
    await chip(page, 'Next gap').tap();
    await page.keyboard.insertText('let total = booking');
    // A name from the file, finished from the row.
    await chip(page, 'bookingFee').tap();
    await page.keyboard.insertText(';');
    await page.keyboard.press('Enter');

    await page.keyboard.insertText('fo');
    await chip(page, 'for () {}').tap();
    await page.keyboard.insertText('const line of lines');
    await chip(page, 'Next gap').tap();
    await page.keyboard.insertText('const price = Number(line.price);');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('const quantity = Number(line.quantity);');
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('i');
    await chip(page, 'if () {}').tap();
    await page.keyboard.insertText('quantity >= 1');
    await chip(page, 'Next gap').tap();
    await page.keyboard.insertText('total = total + price * quantity;');
    await expectCaretClear(page);
    // Out of the if block, then past the brace of the loop with the cursor keys.
    await chip(page, 'Next gap').tap();
    const right = page.getByRole('button', { name: 'Move right' });
    for (let i = 0; i < 4; i += 1) await right.tap();
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('return total;');
    await expect(editor).toContainText('return total;');
    await expectCaretClear(page);

    // No horizontal scroll with the rows docked.
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);

    await shot(page, 'challenge-docked-390');
    // Run without closing the keyboard.
    await suggestions(page).getByRole('button', { name: 'Run tests' }).tap();
    await expect(page.getByTestId('run-status')).toHaveAttribute('data-status', 'passed', {
      timeout: 15_000,
    });
  });

  test('the full-screen editor covers the page, keeps the task a tap away, and Done brings it back', async ({
    page,
  }) => {
    await page.goto(CHALLENGE);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await page.getByRole('button', { name: 'Full screen' }).tap();
    const dialog = page.getByRole('dialog', { name: 'Your code, full screen' });
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('textbox', { name: 'Your code' })).toBeFocused();

    await keyboard(page, KEYBOARD);
    await expect
      .poll(async () => {
        const box = await dialog.boundingBox();
        return box ? Math.round(box.y + box.height) : 0;
      })
      .toBe(await keyboardTop(page));
    // Nothing of the lesson shows, not even where the keyboard would be.
    for (const y of [100, 700, 830]) {
      const covered = await page.evaluate(
        (at) => document.elementFromPoint(195, at)?.closest('.editor-expanded') !== null,
        y,
      );
      expect(covered, `y ${y}`).toBe(true);
    }
    await expect(suggestions(page)).toBeVisible();
    await page.keyboard.press('Meta+ArrowDown');
    await page.keyboard.insertText('\n// the end');
    const caret = await page.locator('.cm-focused .cm-activeLine').first().boundingBox();
    const rows = await dialog.getByTestId('symbol-bar').boundingBox();
    expect(caret && rows && caret.y + caret.height <= rows.y).toBe(true);
    await shot(page, 'challenge-full-screen-390');

    const task = dialog.getByRole('button', { name: 'Task' });
    await task.tap();
    await expect(task).toHaveAttribute('aria-expanded', 'true');
    await expect(dialog).toContainText('cartTotal');
    await shot(page, 'challenge-full-screen-task-390');
    await task.tap();

    await dialog.getByRole('button', { name: 'Run tests' }).tap();
    await expect(dialog).toContainText(/pass|error|Syntax/);
    await dialog.getByRole('button', { name: 'Done' }).tap();
    await expect(dialog).toHaveCount(0);
  });

  test('a tap on a locked line puts the caret where the learner can type', async ({ page }) => {
    await page.goto(REGION);
    const editor = page.getByRole('textbox', { name: 'Your code' });
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    // Lines 12 and 13 are the task; the class above and the brace below are locked.
    await expect(page.locator('.cm-editableLine')).toHaveCount(2);
    await expect(page.locator('.cm-lockedLine')).toHaveCount(13);
    await page.locator('.cm-lockedLine').first().tap();
    await page.keyboard.insertText('Q');
    await expect(page.locator('.cm-lockedLine').first()).toHaveText('class Watchlist {');
    // At the start of the first open line's code, the nearest place to type from above.
    await expect(page.locator('.cm-editableLine').first()).toHaveText(/^ {2}Q\/\//);
    await page.locator('.cm-lockedLine', { hasText: /^}$/ }).last().tap();
    await page.keyboard.insertText('Z');
    await expect(page.locator('.cm-editableLine').last()).toHaveText(/watchlist\.add;Z$/);
    await expect(editor).toBeFocused();
    await shot(page, 'region-390');
  });

  test('a playground written with tags from the row', async ({ page }) => {
    await page.goto(PLAYGROUND);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await startTyping(page, 'HTML of your page');
    await page.keyboard.insertText('<h');
    await chip(page, '<h1></h1>').tap();
    await page.keyboard.insertText('Pancakes');
    await chip(page, 'Next gap').tap();
    await page.keyboard.press('Enter');
    await page.keyboard.insertText('<');
    await chip(page, '<p></p>').tap();
    await page.keyboard.insertText('Fluffy and quick.');
    await expectCaretClear(page);
    const frame = page.frameLocator('iframe[title="Your page"]');
    await expect(frame.getByRole('heading', { name: 'Pancakes' })).toBeVisible();
    await expect(frame.getByText('Fluffy and quick.')).toBeVisible();
    await shot(page, 'playground-docked-390');
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`the rows and the full-screen editor pass axe in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(CHALLENGE);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(page.locator('.cm-editor').first()).toBeVisible();
      await page.getByRole('textbox', { name: 'Your code' }).scrollIntoViewIfNeeded();
      expect(await axe(page), `${scheme}, at rest`).toEqual([]);
      await shot(page, `challenge-rest-${scheme}-390`);

      await page.getByRole('textbox', { name: 'Your code' }).tap();
      await keyboard(page, KEYBOARD);
      await page.keyboard.press('Meta+ArrowDown');
      await page.keyboard.insertText('\nre');
      await expect(chip(page, 'return')).toBeVisible();
      expect(await axe(page), `${scheme}, docked`).toEqual([]);
      await shot(page, `challenge-suggestions-${scheme}-390`);

      await page.getByRole('button', { name: 'Full screen' }).tap();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await axe(page), `${scheme}, full screen`).toEqual([]);
      await shot(page, `challenge-full-screen-${scheme}-390`);
      await keyboard(page, 0);
      await shot(page, `challenge-full-screen-no-keyboard-${scheme}-390`);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });

    test(`a playground at rest and in full screen passes axe in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PLAYGROUND);
      await expect(page.locator('.cm-editor').first()).toBeVisible();
      await page.getByRole('textbox', { name: 'HTML of your page' }).scrollIntoViewIfNeeded();
      expect(await axe(page), `${scheme}, playground`).toEqual([]);
      await shot(page, `playground-rest-${scheme}-390`);
      await page.getByRole('button', { name: 'Full screen' }).tap();
      await expect(page.getByRole('dialog')).toBeVisible();
      expect(await axe(page), `${scheme}, playground full screen`).toEqual([]);
      await shot(page, `playground-full-screen-${scheme}-390`);
    });
  }
});

test.describe('writing code at a desk', () => {
  test.skip(({ isMobile }) => isMobile, 'A hardware keyboard needs no rows.');

  for (const scheme of ['light', 'dark'] as const) {
    test(`no rows and no full screen, and axe passes at 1440 in ${scheme}`, async ({ page }) => {
      await page.setViewportSize({ width: 1440, height: 900 });
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(CHALLENGE);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByRole('textbox', { name: 'Your code' }).click();
      await expect(page.getByTestId('symbol-bar')).toHaveCount(0);
      await expect(page.getByRole('button', { name: 'Full screen' })).toHaveCount(0);
      expect(await axe(page), scheme).toEqual([]);
    });
  }
});
