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
