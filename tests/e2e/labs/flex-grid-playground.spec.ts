import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/flex-grid-playground';
const SCENARIOS = ['Three tabs', 'Price plans', 'Cart line', 'Photo grid', 'Few photos'];

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

async function expectAgreement(page: Page, where: string) {
  const rows = await readRows(page);
  expect(rows.length).toBeGreaterThan(1);
  for (const row of rows) {
    expect(row.measured, `${where}: ${row.label} was not measured`).not.toBeNull();
    expect(
      Math.abs(row.measured! - row.predicted),
      `${where}: ${row.label} predicted ${row.predicted}, measured ${row.measured}`,
    ).toBeLessThanOrEqual(0.5);
  }
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

test.describe(PATH, () => {
  test('steps through the free space arithmetic', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('Flex and grid playground');

    const step = page.getByRole('button', { name: 'Step', exact: true });
    await step.click();
    await expect(page.getByRole('status')).toContainText('Each item starts at its flex-basis');
    await step.click();
    await expect(page.getByRole('status')).toContainText('64 px are free');
    await page.getByRole('button', { name: 'Step back' }).click();
    await expect(page.getByRole('status')).toContainText('Each item starts at its flex-basis');
  });

  /*
   * The point of this lab: the engine holds the two layout algorithms, the browser lays
   * out a real flex and a real grid container, and the two have to agree. Half a pixel of
   * tolerance covers the 1/64 px grid browsers lay out on.
   */
  test('predicts what the browser measures in every scenario', async ({ page }) => {
    await page.goto(PATH);
    for (const scenario of SCENARIOS) {
      await page.getByLabel('Scenario').selectOption(scenario);
      await reveal(page);
      await expectAgreement(page, scenario);
    }
  });

  test('long text refuses to shrink until min-width is a length', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('Scenario').selectOption('Cart line');
    await reveal(page);
    await expect(page.getByRole('status')).toContainText('overflow the row');
    const before = await readRows(page);
    expect(before[0]!.predicted).toBeGreaterThan(200);
    await expectAgreement(page, 'checkout with min-width auto');

    const productName = page.getByRole('group', { name: 'Product name' });
    await productName.getByLabel('min-width', { exact: true }).selectOption('px');
    const after = await readRows(page);
    expect(after[0]!.predicted).toBeLessThan(before[0]!.predicted);
    await expectAgreement(page, 'checkout with min-width 0');
  });

  test('auto-fit collapses the empty column and auto-fill keeps it', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('Scenario').selectOption('Few photos');
    await reveal(page);
    await expectAgreement(page, 'auto-fill');
    const filled = await readRows(page);
    expect(filled).toHaveLength(3);

    await page.getByLabel('Mode').selectOption('auto-fit');
    await expectAgreement(page, 'auto-fit');
    const fitted = await readRows(page);
    expect(fitted[2]!.predicted).toBe(0);
    expect(fitted[0]!.predicted).toBeGreaterThan(filled[0]!.predicted);
  });

  test('does not scroll sideways at 390 px', async ({ page }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('Cart line');
    await reveal(page);
    await expectNoSidewaysScroll(page);
    await page.getByLabel('Scenario').selectOption('Photo grid');
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('What this leaves out').click();
      for (const moment of ['start', 'revealed', 'grid'] as const) {
        if (moment === 'revealed') await reveal(page);
        if (moment === 'grid') await page.getByLabel('Scenario').selectOption('Photo grid');
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${moment} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      }
    });
  }
});
