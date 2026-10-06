import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * Building your own path: parts preview what they hold, open to chapters, chapters open to
 * lessons, and the choice saves as "My path" on Learn.
 */

async function open(page: Page) {
  await page.goto('/learn/build');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(page.getByRole('heading', { level: 1, name: 'Build your own path' })).toBeVisible();
}

/** Ticks a row the way a person does: by its label, since the native box is visually hidden. */
async function tick(box: Locator) {
  await box.locator('xpath=..').click();
  await expect(box).toBeChecked();
}

test('choose a chapter and a single lesson, then save them as my path', async ({ page }) => {
  await open(page);
  const parts = page.getByRole('list', { name: 'The course' }).locator(':scope > li');
  const first = parts.first();

  // Closed, a part already says what it holds and that it can be opened.
  await expect(first.getByText(/^Chapters:/)).toBeVisible();
  const openChapters = first.getByRole('button', { name: /^Choose individual chapters in/ });
  await expect(openChapters).toHaveAttribute('aria-expanded', 'false');
  await openChapters.click();
  await expect(openChapters).toHaveAttribute('aria-expanded', 'true');

  const chapters = page.locator(`[id="${await openChapters.getAttribute('aria-controls')}"]`);
  const chapterBoxes = chapters.locator(':scope > li').getByRole('checkbox', {
    name: /^Choose all of/,
  });
  await tick(chapterBoxes.first());

  const second = chapters.locator(':scope > li').nth(1);
  await second.getByRole('button', { name: /^Choose individual lessons in/ }).click();
  const lesson = second.getByRole('checkbox', { name: /^Choose (?!all of)/ }).first();
  await tick(lesson);

  // The part is now partly chosen: the native box says so too.
  const partBox = first.getByRole('checkbox').first();
  expect(await partBox.evaluate((el: HTMLInputElement) => el.indeterminate)).toBe(true);
  await expect(first.getByText(/lessons chosen$/)).toBeVisible();

  const save = page.getByRole('button', { name: 'Save my path' });
  await expect(save).toBeEnabled();
  await save.click();
  await expect(page).toHaveURL(/\/paths$/);
  await expect(page.getByRole('heading', { name: 'My path' }).first()).toBeVisible();
});

test('save waits for a change, and the page passes axe in both themes', async ({ page }) => {
  await open(page);
  await expect(page.getByRole('button', { name: 'Save my path' })).toBeDisabled();
  await page
    .getByRole('button', { name: /^Choose individual chapters in/ })
    .first()
    .click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => v.id)).toEqual([]);
  }
});
