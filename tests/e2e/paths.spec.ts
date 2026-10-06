import { expect, test } from '@playwright/test';

/*
 * Learn holds several paths at once: chosen in order on the picker, then one tab each, with
 * the tab kept in `?path=` so a reload lands on the same path.
 */

test('a learner chooses two paths and switches between them with tabs', async ({ page }) => {
  await page.goto('/paths');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(
    page.getByRole('heading', { level: 1, name: 'Choose one or more paths' }),
  ).toBeVisible();

  await page.getByRole('button', { name: /^Start coding/ }).click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Start coding from zero');
  // One path: no tabs.
  await expect(page.getByRole('navigation', { name: 'Your paths' })).toBeHidden();

  await page.getByRole('button', { name: 'Switch path' }).click();
  const python = page.getByRole('button', { name: /^Python/ });
  await python.click();
  await expect(python).toHaveAttribute('aria-pressed', 'true');

  const tabs = page.getByRole('navigation', { name: 'Your paths' });
  await expect(tabs.getByRole('link')).toHaveCount(2);
  await expect(tabs.getByRole('link', { name: /Start coding/ })).toHaveAttribute(
    'aria-current',
    'page',
  );

  await tabs.getByRole('link', { name: /Python/ }).click();
  await expect(page).toHaveURL(/\/paths\?path=python$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Python/);
  await expect(tabs.getByRole('link', { name: /Python/ })).toHaveAttribute('aria-current', 'page');

  await page.reload();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Python/);
});
