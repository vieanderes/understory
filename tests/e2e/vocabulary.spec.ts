import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

test.describe('vocabulary', () => {
  test('finds a word misspelt, and links it to where the course teaches it', async ({ page }) => {
    await page.goto('/vocabulary');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.getByRole('searchbox', { name: 'Search words' }).fill('idempotant');
    await expect(page).toHaveURL(/\?q=idempotant$/);
    await page.getByRole('link', { name: /^idempotent/ }).click();

    await expect(page.getByRole('heading', { level: 1 })).toHaveText('idempotent');
    const lesson = page.getByRole('region', { name: 'Where you learn it' }).getByRole('link');
    await expect(lesson.first()).toHaveAttribute('href', /^\/lectures\/.+#.+/);
  });

  test('filters by area, and the filter survives a reload', async ({ page }) => {
    await page.goto('/vocabulary');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.getByRole('group', { name: 'Area' }).getByRole('button', { name: 'CSS' }).click();
    await expect(page).toHaveURL(/\?area=css$/);
    await page.reload();
    await expect(
      page.getByRole('group', { name: 'Area' }).getByRole('button', { name: 'CSS' }),
    ).toHaveAttribute('aria-pressed', 'true');
    await expect(page.getByRole('link', { name: /^specificity/ })).toBeVisible();
    await expect(page.getByRole('link', { name: /^closure/ })).toHaveCount(0);
  });

  test('a new learner adds ten words and reviews them on the schedule', async ({ page }) => {
    await page.goto('/vocabulary');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.getByRole('button', { name: 'Add 10 words' }).click();
    await expect(page.getByRole('heading', { name: '0 due, 10 new' })).toBeVisible();

    await page.getByRole('link', { name: 'Review words' }).click();
    await expect(page.getByText('New word')).toBeVisible();
    await page.getByRole('button', { name: 'Got it' }).click();
    await expect(page.getByRole('heading', { name: 'What does it mean?' })).toBeVisible();
    await page.getByRole('list', { name: 'Choices' }).getByRole('button').first().click();
    await expect(page.getByText(/^(Right|Not quite)\.$/)).toBeVisible();
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    await page.getByRole('button', { name: 'Continue' }).click();

    // The answer was recorded: the word now has a card and is no longer new.
    await page.getByRole('link', { name: 'Leave review' }).click();
    await expect(page.getByRole('heading', { name: '0 due, 9 new' })).toBeVisible();
  });

  test('a speed round runs against the clock without a deck', async ({ page }) => {
    await page.goto('/vocabulary/review?mode=speed');
    await expect(page.getByRole('progressbar', { name: /seconds left/ })).toBeVisible();
    await page.keyboard.press('1');
    await expect(page.getByText(/^\d+ right · \d+s$/)).toBeVisible();
  });

  test('adding a word from its page puts it in the deck', async ({ page }) => {
    await page.goto('/vocabulary/closure');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.getByRole('button', { name: 'Add closure to your deck' }).click();
    await expect(page.getByText('New in your deck')).toBeVisible();
    await page.getByRole('button', { name: 'Remove from deck' }).click();
    await expect(page.getByRole('button', { name: 'Add closure to your deck' })).toBeVisible();
  });
});
