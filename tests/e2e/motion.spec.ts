import { expect, test } from '@playwright/test';

/*
 * The rest of the suite runs with reduced motion so it audits settled pages. These tests
 * turn motion back on and check what the motion layer promises (docs/MOTION.md).
 */
test.use({ reducedMotion: 'no-preference' });

test.describe('smooth scroll', () => {
  test.skip(
    ({ isMobile }) => isMobile,
    'Touch keeps native scrolling; Lenis only smooths a wheel.',
  );

  test('glides on an app page and leaves a lesson to scroll natively', async ({ page }) => {
    await page.goto('/learn');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await expect(page.locator('html')).toHaveClass(/\blenis\b/);

    await page.mouse.move(400, 400);
    await page.mouse.wheel(0, 800);
    await expect.poll(() => page.evaluate(() => window.scrollY)).toBeGreaterThan(400);

    await page.goto('/learn/basics/your-first-line-of-code');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await expect(page.locator('html')).not.toHaveClass(/\blenis\b/);
  });
});

test.describe('arrival', () => {
  for (const path of ['/', '/learn', '/map', '/learn/basics/your-first-line-of-code']) {
    test(`${path} ends settled: title whole, nothing held back`, async ({ page }) => {
      const errors: string[] = [];
      page.on('pageerror', (error) => errors.push(String(error)));
      await page.goto(path);
      const title = page.getByRole('heading', { level: 1 });
      await expect(title).toHaveAttribute('data-arrived', '');
      // The line split is reverted once the title has landed.
      await expect(title.locator('div')).toHaveCount(0);
      await expect(title).toHaveCSS('opacity', '1');
      await expect(
        page.locator('[data-arrive]:not([data-arrived]):not([data-arrive-wait])'),
      ).toHaveCount(0);
      expect(errors).toEqual([]);
    });
  }

  test('reduced motion holds nothing back', async ({ browser }) => {
    const context = await browser.newContext({ reducedMotion: 'reduce' });
    const page = await context.newPage();
    await page.goto('/map');
    await expect(page.locator('html')).not.toHaveAttribute('data-motion', 'on');
    await expect(page.getByRole('heading', { level: 1 })).toHaveCSS('opacity', '1');
    await context.close();
  });
});

test('the theme toggle still switches the theme with the reveal', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'light' });
  await page.goto('/map');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Switch to dark theme' }).click();
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'dark');
  await expect(page.locator('html')).not.toHaveAttribute('data-theme-switch');
});

test('content in a part opened later arrives and ends fully visible', async ({ page }) => {
  await page.goto('/learn');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Open all parts' }).click();
  // Held-back content is out of the accessibility tree until it arrives, so find the list
  // by its label rather than its role, then scroll it into view to let it arrive.
  const chapters = page.locator('ol[aria-label^="Chapters of "]').last().locator('> li');
  await chapters.first().scrollIntoViewIfNeeded();
  await expect(chapters.first()).toHaveCSS('opacity', '1');
  await expect(chapters.first()).toBeVisible();
});

test('the map filter glides and still filters', async ({ page }) => {
  await page.goto('/map');
  await page.locator('html[data-hydrated="true"]').waitFor();
  const parts = page.getByTestId('map-part');
  // The atlas sits above the index, so the first part may start below the fold.
  await parts.first().scrollIntoViewIfNeeded();
  await expect(parts.first()).toBeVisible();
  await page.getByText('Gaps and due', { exact: true }).click();
  await expect(page.getByText('No gaps and nothing due.')).toBeVisible();
  await page.getByText('All', { exact: true }).click();
  await expect(parts.first()).toHaveCSS('opacity', '1');
});
