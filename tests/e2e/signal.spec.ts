import { expect, test } from '@playwright/test';

test('the info button explains News and Escape hands focus back', async ({ page }) => {
  await page.goto('/signal');
  await page.locator('html[data-hydrated="true"]').waitFor();
  const info = page.getByRole('button', { name: 'How News works' });
  await expect(info).toHaveAttribute('aria-expanded', 'false');

  await info.click();
  const panel = page.getByRole('region', { name: 'How News works' });
  await expect(panel).toBeVisible();
  await expect(panel.getByText('Simon Willison')).toBeVisible();

  await page.keyboard.press('Escape');
  await expect(panel).toBeHidden();
  await expect(info).toBeFocused();
});

test('an edition once opened steps back in the archive', async ({ page }) => {
  await page.goto('/signal/2026-10-01');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Thursday 1 October');

  await page.goto('/signal/archive');
  await page.locator('html[data-hydrated="true"]').waitFor();
  const row = (date: RegExp) => page.getByRole('link', { name: date });
  await expect(row(/^Thu 1 Oct/)).toContainText(', read');
  await expect(row(/^Fri 2 Oct/)).not.toContainText(', read');
});

test('a story folds its concepts and lessons away until asked', async ({ page }) => {
  await page.goto('/signal/2026-10-01');
  await page.locator('html[data-hydrated="true"]').waitFor();
  const more = page.getByRole('button', { name: 'Learn more' }).first();
  await expect(more).toHaveAttribute('aria-expanded', 'false');
  await more.click();
  await expect(more).toHaveAttribute('aria-expanded', 'true');
});

test('the earlier arrow under the title opens the edition before', async ({ page }) => {
  await page.goto('/signal/2026-10-05');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByRole('link', { name: 'Earlier edition, Sunday 4 October' }).click();
  await expect(page).toHaveURL(/\/signal\/2026-10-04$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Sunday 4 October');
});

test('the latest edition has no later arrow to follow', async ({ page }) => {
  await page.goto('/signal');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(page.getByRole('button', { name: 'No later edition' })).toBeDisabled();
});

test('the calendar opens on the shown day, moves by keyboard and Escape closes it', async ({
  page,
}) => {
  await page.goto('/signal/2026-10-05');
  await page.locator('html[data-hydrated="true"]').waitFor();
  const trigger = page.getByRole('button', { name: 'Choose a day' });
  await trigger.click();
  const dialog = page.getByRole('dialog', { name: 'Choose a day' });
  await expect(dialog).toBeVisible();
  await expect(dialog.getByRole('heading', { name: 'October 2026' })).toBeVisible();
  const shown = dialog.getByRole('link', { name: 'Monday 5 October' });
  await expect(shown).toBeFocused();
  await expect(shown).toHaveAttribute('aria-current', 'date');

  await page.keyboard.press('ArrowLeft');
  await expect(dialog.getByRole('link', { name: 'Sunday 4 October' })).toBeFocused();

  await page.keyboard.press('Escape');
  await expect(dialog).toBeHidden();
  await expect(trigger).toBeFocused();
});

test('picking a day in the calendar opens that edition', async ({ page }) => {
  await page.goto('/signal/2026-10-05');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Choose a day' }).click();
  const dialog = page.getByRole('dialog', { name: 'Choose a day' });
  await dialog.getByRole('button', { name: 'Earlier month' }).click();
  await expect(dialog.getByRole('heading', { name: 'September 2026' })).toBeVisible();
  await dialog.getByRole('link', { name: 'Wednesday 30 September' }).click();
  await expect(page).toHaveURL(/\/signal\/2026-09-30$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Wednesday 30 September');
  await expect(dialog).toBeHidden();
});

test('every story in an edition has a line to read under its headline', async ({ page }) => {
  for (const date of ['2026-10-05', '2026-10-06']) {
    await page.goto(`/signal/${date}`);
    const stories = page.locator('article[id^="story-"]');
    const count = await stories.count();
    expect(count).toBeGreaterThan(0);
    for (let at = 0; at < count; at += 1) {
      await expect(stories.nth(at).locator('h2 + p')).not.toBeEmpty();
    }
  }
});
