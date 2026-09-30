import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Live type checking in a TypeScript challenge, on the production build: the checker's
 * chunk, the compiler worker from public/typescript, the underline and its message, the
 * list under the editor, and a run that the type errors fail although its tests pass.
 */

const STEP = '/learn/typescript/what-typescript-is#fix-checkout-total';
const DIR = path.join(process.cwd(), 'content/course/04-typescript/01-what-typescript-is');
const SOLUTION = readFileSync(path.join(DIR, 'solution.ts'), 'utf8');
/** The tests pass, since `Number` runs, but the declared `string` is wrong twice. */
const WRONG_TYPES = SOLUTION.replace(
  '  return addDelivery(Number(fieldValue));',
  '  const pounds: string = Number(fieldValue);\n  return addDelivery(pounds);',
);
const ARGUMENT_ERROR = "Argument of type 'string' is not assignable to parameter of type 'number'.";
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const editor = (page: Page): Locator => page.getByRole('textbox', { name: 'Your code' });
const typeCheck = (page: Page): Locator => page.getByTestId('type-check');

async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function writeCode(page: Page, code: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(code);
}

async function expectErrors(page: Page, count: number): Promise<void> {
  // The first check downloads and starts the compiler, which the checker allows a minute
  // for; later ones take milliseconds.
  await expect(typeCheck(page)).toHaveAttribute('data-status', 'ready', { timeout: 60_000 });
  await expect(typeCheck(page)).toHaveAttribute('data-count', String(count), { timeout: 10_000 });
}

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

test('a type error is underlined with its message, fails the run, and clears when fixed', async ({
  page,
  isMobile,
}) => {
  // The compiler's first download and start can take a while beside a full parallel run.
  test.slow();
  await page.goto(STEP);
  await expect(page.locator('.cm-editor').first()).toBeVisible();

  // The starter arrives with its one error showing: the challenge is to make it go away.
  await expectErrors(page, 1);
  await expect(typeCheck(page).getByRole('status')).toHaveText('1 type error');

  await writeCode(page, WRONG_TYPES);
  await expectErrors(page, 2);
  await expect(typeCheck(page).getByRole('status')).toHaveText('2 type errors');
  const list = page.getByTestId('type-errors');
  await expect(list.getByRole('button', { name: 'Line 7' })).toBeVisible();
  await expect(list.getByRole('button', { name: 'Line 8' })).toBeVisible();
  await expect(list.getByText(ARGUMENT_ERROR)).toBeVisible();
  await expect(list.getByText("Type 'number' is not assignable to type 'string'.")).toBeVisible();

  const underline = page.locator('.cm-lintRange-error').filter({ hasText: 'pounds' }).last();
  await expect(underline).toBeVisible();
  if (isMobile) {
    // A tap puts the caret in the error, and the caret's tooltip opens.
    await underline.tap();
    await expect(page.locator('.cm-typecheck-tip')).toContainText(ARGUMENT_ERROR);
  } else {
    // Hover, as in any editor. The caret is elsewhere, at the end of the pasted code.
    await underline.hover();
    await expect(page.locator('.cm-tooltip-lint')).toContainText(ARGUMENT_ERROR);
  }

  // Choosing a line in the list puts the caret on that error, for keyboard and screen reader.
  await list.getByRole('button', { name: 'Line 8' }).click();
  await expect(editor(page)).toBeFocused();
  await expect(page.locator('.cm-typecheck-tip')).toBeVisible();

  // The tests pass, since Number() runs, but the types do not.
  await page.getByRole('button', { name: 'Run tests' }).click();
  const status = page.getByTestId('run-status');
  await expect(status).toHaveAttribute('data-status', 'failed', { timeout: 30_000 });
  await expect(status).toHaveText('4 of 5 pass');
  const firstRow = page.getByTestId('test-row').first();
  await expect(firstRow).toHaveAttribute('data-passed', 'false');
  await expect(firstRow).toContainText('Type errors');
  await expect(firstRow).toContainText(`Line 8: ${ARGUMENT_ERROR}`);

  await writeCode(page, SOLUTION);
  await expectErrors(page, 0);
  await expect(page.locator('.cm-lintRange-error')).toHaveCount(0);
  await page.getByRole('button', { name: 'Run tests' }).click();
  await expect(status).toHaveAttribute('data-status', 'passed', { timeout: 30_000 });
  await expect(page.getByTestId('test-row').first()).toContainText('No type errors');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the errors and their list pass axe, ${scheme}, at 390 and 1440`, async ({ page }) => {
    test.slow();
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(STEP);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    await expectErrors(page, 1);
    await writeCode(page, WRONG_TYPES);
    await expectErrors(page, 2);
    // The caret tooltip is open too: the list's first line puts the caret in the error.
    await page.getByTestId('type-errors').getByRole('button', { name: 'Line 8' }).click();
    await expect(page.locator('.cm-typecheck-tip')).toBeVisible();
    for (const width of [390, 1440]) {
      await page.setViewportSize({ width, height: 900 });
      await typeCheck(page).scrollIntoViewIfNeeded();
      expect(await axe(page), `${scheme} at ${width}`).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `no sideways scroll at ${width}`).toBeLessThanOrEqual(0);
    }
  });
}

test('the checker works offline once a type-checked step was shown online', async ({
  page,
  context,
  browserName,
}) => {
  // WebKit's offline emulation fails every request, even those the worker would answer
  // from its cache (docs/SANDBOX.md, "Offline"). The routing is unit-tested for both.
  test.skip(browserName === 'webkit', 'Playwright cannot go offline with a worker in WebKit');
  test.slow();
  await page.goto('/learn');
  await expect(page.locator('html')).toHaveAttribute('data-worker', 'controlled', {
    timeout: 60_000,
  });
  // Online, under the service worker: the checker's manifest and worker are kept.
  await page.goto(STEP);
  await expectErrors(page, 1);

  await context.setOffline(true);
  await page.reload();
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await expectErrors(page, 1);
  await writeCode(page, WRONG_TYPES);
  await expectErrors(page, 2);
});
