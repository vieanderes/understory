import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

const PATH = '/labs/btree-index-explorer';

const stepButton = (page: Page) => page.getByRole('button', { name: 'Step', exact: true });

/** A Figure puts its label in a dt and its value in the dd beside it. */
const figure = (page: Page, label: string) =>
  page.getByText(label, { exact: true }).locator('xpath=..');

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
  test('descends to the leaf and counts one page per level', async ({ page }) => {
    await page.goto(PATH);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('B-tree index explorer');
    await expect(figure(page, 'Height')).toContainText('3');
    await expect(figure(page, 'Pages read')).toContainText('0');

    await stepButton(page).click();
    await expect(page.getByRole('status')).toContainText('follow the leftmost pointer to P3');
    await stepToEnd(page);
    await expect(page.getByRole('status')).toContainText('3 pages read');
    await expect(figure(page, 'Pages read')).toContainText('3');
  });

  test('splits a full page, and the tree grows a level at the top', async ({ page }) => {
    await page.goto(PATH);
    await page.getByLabel('Scenario').selectOption('page-splits');
    await expect(figure(page, 'Height')).toContainText('2');
    await expect(figure(page, 'Pages in tree')).toContainText('6');

    await stepToEnd(page);
    await expect(page.getByRole('status')).toContainText('130 inserted. Height 3, 9 pages.');
    await expect(figure(page, 'Height')).toContainText('3');
    await expect(figure(page, 'Pages in tree')).toContainText('9');
    await expect(page.getByRole('region', { name: 'B+ tree pages' })).toContainText('Level 3 of 3');
  });

  test('walks the leaf chain on a range scan instead of descending again', async ({ page }) => {
    await page.goto(PATH);
    await page.getByRole('button', { name: 'Range scan' }).click();
    await expect(page.getByRole('status')).toContainText('Descend once, for 300');
    await stepToEnd(page);
    await expect(page.getByRole('status')).toContainText(
      '6 pages read: 3 for the one descent, then 3 more along the leaf chain',
    );
  });

  test('changes the verdict when the selectivity changes', async ({ page }) => {
    await page.goto(PATH);
    const verdict = page.getByTestId('verdict');
    await expect(verdict).toContainText('Index Scan using orders_pkey on orders');

    await page.getByLabel('Query', { exact: true }).selectOption('paid');
    await expect(verdict).toContainText('900,000 of 1,000,000 rows match, 90%.');
    await expect(verdict).toContainText('The planner rightly ignores the index.');
    await expect(page.getByTestId('plan-chosen')).toHaveText('Seq Scan on orders');

    await page.getByLabel('Query', { exact: true }).selectOption('event-newest');
    await expect(verdict).toContainText(
      'Index Scan Backward using orders_shop_created_idx on orders',
    );
    await page.getByLabel('Index', { exact: true }).selectOption('created-event');
    await expect(verdict).toContainText('It passes 10,000 entries to keep 20.');
  });

  test('does not scroll sideways at 390 px, before or after a batch of inserts', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(PATH);
    await expectNoSidewaysScroll(page);

    await page.getByRole('button', { name: 'Insert 10 random' }).click();
    await stepToEnd(page);
    await expectNoSidewaysScroll(page);

    // The tree is wider than the phone, so it scrolls inside its own focusable region.
    const tree = page.getByRole('region', { name: 'B+ tree pages' });
    await expect(tree).toHaveAttribute('tabindex', '0');
    const scrollable = await tree.evaluate((el) => el.scrollWidth > el.clientWidth);
    expect(scrollable).toBe(true);

    await page.getByLabel('Query', { exact: true }).selectOption('event-newest');
    await page.getByText('What this leaves out').click();
    await expectNoSidewaysScroll(page);
  });

  for (const scheme of ['light', 'dark'] as const) {
    test(`has no axe violations in ${scheme}`, async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(PATH);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await page.getByText('What this leaves out').click();

      for (const moment of ['start', 'middle', 'end'] as const) {
        if (moment === 'middle') {
          await page.getByLabel('Scenario').selectOption('page-splits');
          await stepButton(page).click();
          await stepButton(page).click();
        }
        if (moment === 'end') {
          await stepToEnd(page);
          await page.getByLabel('Query', { exact: true }).selectOption('lower-email');
        }
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${moment} ${v.id}: ${v.nodes.length}`)).toEqual([]);
      }
    });
  }
});
