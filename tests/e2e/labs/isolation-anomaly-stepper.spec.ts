import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/isolation-anomaly-stepper';

const stepButton = (page: Page) => page.getByRole('button', { name: 'Step', exact: true });

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

test.describe(PATH, () => {
  test('steps both transactions and shows the balance change between two reads', async ({
    page,
  }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Isolation anomaly stepper');
    await expect(page.getByText(/Before you step: T1 reads the balance twice/)).toBeVisible();

    await stepButton(page).click();
    await expect(page.getByRole('status')).toContainText('T1 ran BEGIN;');
    await page.getByRole('button', { name: 'Run T2 next' }).click();
    await expect(page.getByRole('status')).toContainText('T2 ran BEGIN;');

    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByRole('status')).toContainText('T1 ran BEGIN;');

    await stepToEnd(page);
    await expect(page.getByTestId('verdict')).toContainText('Anomaly: non-repeatable read.');
  });

  test('a stricter level changes the write skew verdict', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('Scenario').selectOption('write-skew');
    await page.getByLabel('Isolation level').selectOption('repeatable-read');
    await stepToEnd(page);
    await expect(page.getByTestId('invariant')).toHaveAttribute('data-holds', 'false');
    await expect(page.getByTestId('verdict')).toContainText('Anomaly: write skew.');

    await page.getByLabel('Isolation level').selectOption('serializable');
    await expect(page.getByTestId('invariant')).toHaveAttribute('data-holds', 'true');
    await expect(page.getByTestId('verdict')).toHaveAttribute('data-serialisable', 'true');
    await expect(page.getByText(/T2 was rolled back with SQLSTATE 40001/)).toBeVisible();
  });

  test('does not scroll the page sideways at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('check-then-insert');
    await stepToEnd(page);
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('What this leaves out').click();

      for (const moment of ['start', 'waiting', 'end'] as const) {
        if (moment === 'waiting') {
          await page.getByLabel('Scenario').selectOption('lost-update');
          await page.getByLabel('How the write is made').selectOption('atomic');
          for (let i = 0; i < 4; i += 1) await stepButton(page).click();
          await expect(page.getByTestId('t2-status')).toHaveText('waiting');
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
