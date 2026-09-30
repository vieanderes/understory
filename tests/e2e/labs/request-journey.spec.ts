import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/request-journey';

async function stepToEnd(page: Page) {
  const step = page.getByRole('button', { name: 'Step', exact: true });
  while (await step.isEnabled()) await step.click();
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe(PATH, () => {
  test('steps through the journey and totals the first visit', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Request journey');
    await expect(page.getByText('No messages yet.')).toBeVisible();

    const step = page.getByRole('button', { name: 'Step', exact: true });
    await step.click();
    await expect(page.getByRole('status')).toContainText('split the URL');
    await step.click();
    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByRole('status')).toContainText('split the URL');

    await stepToEnd(page);
    await expect(page.getByTestId('verdict')).toContainText(
      'DNS lookup cost the most: 140 ms of 691 ms.',
    );
    await expect(page.getByRole('region', { name: 'Message log' })).toContainText('SYN-ACK');
  });

  test('switches scenario and reacts to the round trip stepper and the caches', async ({
    page,
  }) => {
    await page.goto(PATH);
    await page.getByLabel('Scenario').selectOption('on-sale');
    await stepToEnd(page);
    await expect(page.getByTestId('verdict')).toContainText('Server time cost the most: 1800 ms');

    const timeline = page.getByRole('region', { name: 'Timeline' });
    await expect(timeline).toContainText('of 2371 ms');
    await page.getByRole('button', { name: 'Increase round trip time' }).click();
    await expect(timeline).toContainText('of 2421 ms');

    await page.getByText('Caches and protocol').click();
    await page.getByRole('checkbox', { name: 'Connection reused' }).check();
    await expect(timeline.getByRole('row', { name: /TCP handshake/ })).toContainText(
      'Connection reused',
    );
    await expectNoSidewaysScroll(page);
  });

  test('does not scroll sideways at 390 px, at the start or at the end', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('cdn-edge');
    await stepToEnd(page);
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('Caches and protocol').click();
      await page.getByText('What this leaves out').click();
      for (const moment of ['start', 'middle', 'end'] as const) {
        if (moment === 'middle') {
          const step = page.getByRole('button', { name: 'Step', exact: true });
          for (let i = 0; i < 12; i += 1) await step.click();
        }
        if (moment === 'end') await stepToEnd(page);
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${moment} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      }
    });
  }
});
