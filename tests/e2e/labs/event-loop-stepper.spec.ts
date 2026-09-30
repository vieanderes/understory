import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

const PATH = '/labs/event-loop-stepper';

test.describe(PATH, () => {
  test('steps through the classic scenario to the real order', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Event loop stepper');
    await expect(page.getByText('Before you step: four lines log. In what order?')).toBeVisible();

    const stepButton = page.getByRole('button', { name: 'Step', exact: true });
    await stepButton.click();
    await stepButton.click();
    await expect(page.getByRole('status')).toHaveText('console.log prints "checkout opened".');
    await expect(page.getByText('Step 3 of 14')).toBeVisible();

    while (await stepButton.isEnabled()) await stepButton.click();
    await expect(page.getByRole('region', { name: 'Console' }).getByRole('listitem')).toHaveText([
      'checkout opened',
      'script finished',
      'microtask: seat confirmed',
      'timeout: hold expired',
    ]);

    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByText('Step 13 of 14')).toBeVisible();
  });

  test('switches scenario and parameter by keyboard', async ({ page }) => {
    await page.goto(PATH);
    await page.getByRole('combobox', { name: 'Scenario' }).selectOption('blocked-click');
    await expect(page.getByText(/when does the button show "Buying"/)).toBeVisible();
    await page.getByRole('radio', { name: '120' }).focus();
    await page.keyboard.press('ArrowLeft');
    await expect(page.getByRole('radio', { name: '40', exact: true })).toBeChecked();
    await expect(page.getByText('priceEverySeat(); // synchronous, 40 ms')).toBeVisible();
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      const stepButton = page.getByRole('button', { name: 'Step', exact: true });
      // Mid-run, so that the accent line, the queues and the console are all on screen.
      for (let i = 0; i < 5; i += 1) await stepButton.click();
      await page.getByText('What this leaves out').click();
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    });
  }

  test('does not scroll horizontally at 390 px, in any scenario', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    const stepButton = page.getByRole('button', { name: 'Step', exact: true });
    for (const id of [
      'classic',
      'microtask-chain',
      'async-await',
      'blocked-click',
      'frame-order',
    ]) {
      await page.getByRole('combobox', { name: 'Scenario' }).selectOption(id);
      for (let i = 0; i < 6; i += 1) await stepButton.click();
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, id).toBeLessThanOrEqual(0);
    }
  });
});
