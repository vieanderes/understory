import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/cache-layer-explorer';

const stepButton = (page: Page) => page.getByRole('button', { name: 'Step', exact: true });

async function stepTimes(page: Page, times: number) {
  for (let i = 0; i < times; i += 1) await stepButton(page).click();
}

async function stepToEnd(page: Page) {
  const step = stepButton(page);
  while (await step.isEnabled()) await step.click();
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

const storeRow = (page: Page, store: string) => page.locator(`[data-store="${store}"]`).first();

test.describe(PATH, () => {
  test('steps the plain case and marks the store that answered', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Cache-layer explorer');
    await expect(page.getByText(/Before you step: two people open the same page/)).toBeVisible();

    await stepButton(page).click();
    await expect(page.getByRole('status')).toContainText('prerendered from it');
    await stepButton(page).click();
    await expect(storeRow(page, 'prerendered-page')).toHaveAttribute('data-answered', 'true');
    await expect(page.getByTestId('answer')).toContainText('Answered by the prerendered page');

    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByRole('status')).toContainText('prerendered from it');
  });

  test('a tag update cannot reach a page already in a tab', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('Scenario').selectOption('what-a-tag-update-misses');
    await stepTimes(page, 5);
    await expect(page.getByTestId('answer')).toContainText('Answered by the router cache');
    await expect(page.getByTestId('answer')).toContainText('v1');

    await stepButton(page).click();
    await expect(page.getByTestId('answer')).toContainText('the request waited');
    await expect(page.getByTestId('answer')).toContainText('v2');
  });

  test('a shorter lifetime takes the page out of the prerender', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('Lifetime').selectOption('seconds');
    await expect(page.getByText(/too short to prerender/)).toBeVisible();
    await stepTimes(page, 2);
    await expect(storeRow(page, 'prerendered-page')).toContainText('not prerendered');
    await expect(storeRow(page, 'use-cache-entry')).toHaveAttribute('data-answered', 'true');
  });

  test('does not scroll the page sideways at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('what-a-tag-update-misses');
    await stepToEnd(page);
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('What this leaves out').click();

      for (const moment of ['start', 'answered', 'end'] as const) {
        if (moment === 'answered') {
          await page.getByLabel('Scenario').selectOption('what-a-tag-update-misses');
          await stepTimes(page, 5);
          await expect(page.getByTestId('answer')).toContainText('router cache');
        }
        if (moment === 'end') await stepToEnd(page);
        // Contrast is measured on the settled page, not mid-transition.
        await page.waitForFunction(() =>
          document.getAnimations().every((a) => a.playState !== 'running'),
        );
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${moment} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      }
    });
  }
});
