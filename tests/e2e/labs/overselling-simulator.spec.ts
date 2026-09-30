import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/overselling-simulator';

const stepButton = (page: Page) => page.getByRole('button', { name: 'Step', exact: true });

async function stepToEnd(page: Page) {
  const step = stepButton(page);
  while (await step.isEnabled()) await step.click();
}

/** The Segmented radios are visually hidden inside their labels: press the label. */
async function driveByHand(page: Page) {
  await page.getByText('By hand', { exact: true }).click();
  await expect(page.getByRole('radio', { name: 'By hand' })).toBeChecked();
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe(PATH, () => {
  test('steps the recorded run, and check-then-act oversells the last ticket', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Overselling simulator');
    await expect(page.getByTestId('invariant')).toHaveAttribute('data-broken', 'false');

    await stepButton(page).click();
    await expect(page.getByRole('status')).toContainText('reads sold = 99');
    await expect(page.getByRole('region', { name: /Timeline grid/ })).toContainText('SELECT → 99');

    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByRole('status')).toContainText('Nothing has run yet');

    await stepToEnd(page);
    await expect(page.getByTestId('invariant')).toHaveAttribute('data-broken', 'true');
    await expect(page.getByTestId('invariant')).toContainText('101 > 100. Broken first at tick 6.');
    await expect(page.getByTestId('enumeration')).toContainText('18 of 20 orderings oversell');
  });

  test('the atomic update sells the last ticket once, whatever the order', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('How reserve is written').selectOption('atomic-update');
    await stepToEnd(page);
    await expect(page.getByTestId('invariant')).toHaveAttribute('data-broken', 'false');
    await expect(page.getByTestId('invariant')).toContainText('100 <= 100. Holds.');
    await expect(page.getByTestId('enumeration')).toContainText('None of the 6 orderings oversell');
  });

  test('gives the turn to one actor at a time by hand', async ({ page }) => {
    await page.goto(PATH);
    await driveByHand(page);
    await page.getByRole('button', { name: /^Advance A/ }).click();
    await page.getByRole('button', { name: /^Advance B/ }).click();
    await expect(page.getByRole('region', { name: /Timeline grid/ })).toContainText('t2');
    await page.getByRole('button', { name: /^Advance A/ }).click();
    await page.getByRole('button', { name: /^Advance A/ }).click();
    await expect(page.getByTestId('invariant')).toContainText('100 <= 100');
    await page.getByRole('button', { name: /^Advance B/ }).click();
    await page.getByRole('button', { name: /^Advance B/ }).click();
    await expect(page.getByTestId('invariant')).toContainText('101 > 100');
  });

  test('does not scroll the page sideways at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('abandoned-checkout');
    await stepToEnd(page);
    await expectNoSidewaysScroll(page);
    // The wide grid keeps its scrolling to itself.
    const grid = page.getByRole('region', { name: /Timeline grid/ });
    const scrolls = await grid.evaluate((node) => node.scrollWidth > node.clientWidth);
    expect(scrolls).toBe(true);
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('What this leaves out').click();

      for (const moment of ['start', 'end', 'by hand'] as const) {
        if (moment === 'end') await stepToEnd(page);
        if (moment === 'by hand') await driveByHand(page);
        // Contrast is measured on the settled page. Mid-fade an element is partly
        // transparent, which axe reports as low contrast though no reader ever sees it so.
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
