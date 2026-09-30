import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/box-model-explorer';
const SCENARIOS = ['Card', 'Banner', 'Stacked', 'Contained'];

interface Row {
  label: string | null;
  predicted: number;
  measured: number | null;
}

/** Every row of the prediction table, as the browser rendered it. */
async function readRows(page: Page): Promise<Row[]> {
  return page.locator('tbody tr').evaluateAll((rows) =>
    rows.map((row) => {
      const measured = row.querySelector('[data-measured]')?.getAttribute('data-measured');
      return {
        label: row.getAttribute('data-row'),
        predicted: Number(row.querySelector('[data-predicted]')?.getAttribute('data-predicted')),
        measured: measured === undefined || measured === null ? null : Number(measured),
      };
    }),
  );
}

async function reveal(page: Page) {
  await page.getByRole('button', { name: 'Reveal' }).click();
  await expect(page.getByText('hidden')).toHaveCount(0);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe(PATH, () => {
  test('steps through the layers of the card', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Box model explorer');
    await expect(page.getByRole('status')).toContainText('The box declares 200 × 96');

    const step = page.getByRole('button', { name: 'Step', exact: true });
    await step.click();
    await expect(page.getByRole('status')).toContainText('Under content-box');
    await step.click();
    await expect(page.getByRole('status')).toContainText('Padding adds 16');
    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByRole('status')).toContainText('Under content-box');
  });

  /*
   * The point of this lab: the engine holds the arithmetic of the specification, the
   * browser lays out a real element, and the two have to agree. Half a pixel of tolerance
   * covers the 1/64 px grid browsers lay out on.
   */
  test('predicts what the browser measures in every scenario', async ({ page }) => {
    await page.goto(PATH);
    for (const scenario of SCENARIOS) {
      await page.getByLabel('Scenario').selectOption(scenario);
      await reveal(page);
      const rows = await readRows(page);
      expect(rows.length).toBeGreaterThan(2);
      for (const row of rows) {
        expect(row.measured, `${scenario}: ${row.label} was not measured`).not.toBeNull();
        expect(
          Math.abs(row.measured! - row.predicted),
          `${scenario}: ${row.label} predicted ${row.predicted}, measured ${row.measured}`,
        ).toBeLessThanOrEqual(0.5);
      }
    }
  });

  test('agrees after the controls change the box and the parent', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('box-sizing').selectOption('border-box');
    await page.getByRole('button', { name: 'Increase Padding' }).click();
    await page.getByLabel('Padding unit').selectOption('% of the container');
    await reveal(page);
    for (const row of await readRows(page))
      expect(Math.abs(row.measured! - row.predicted), `${row.label}`).toBeLessThanOrEqual(0.5);

    await page.getByLabel('Scenario').selectOption('Stacked');
    await reveal(page);
    await expect(page.getByRole('row', { name: /Gap between paragraphs/ })).toContainText('24');
    for (const parent of ['padding on the parent', 'display: flow-root', 'display: grid']) {
      await page.getByLabel('Parent', { exact: true }).selectOption(parent);
      for (const row of await readRows(page))
        expect(
          Math.abs(row.measured! - row.predicted),
          `${parent}: ${row.label}`,
        ).toBeLessThanOrEqual(0.5);
    }
  });

  test('does not scroll sideways at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('Banner');
    await page.getByRole('button', { name: 'Increase Width' }).click();
    await reveal(page);
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('What this leaves out').click();
      for (const moment of ['start', 'revealed', 'stacked'] as const) {
        if (moment === 'revealed') await reveal(page);
        if (moment === 'stacked') await page.getByLabel('Scenario').selectOption('Stacked');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${moment} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      }
    });
  }
});
