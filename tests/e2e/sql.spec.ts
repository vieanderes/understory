import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

/*
 * The sql step against a real lesson, on the production build, in Chromium (desktop) and
 * WebKit (iPhone 15): the lazy step chunk, the PGlite worker from public/sql with its own
 * CSP, Postgres's real error text, the result tables, the verdict against the solution,
 * the player's Check and the IndexedDB event log. The first databases lesson is the
 * fixture: inserting an order for a customer who does not exist is refused by a foreign key.
 */

const LESSON = '/learn/databases/the-relational-model';
const STEP_ID = 'run-orphan-order';
const FIXED = 'INSERT INTO orders VALUES (12, 2, 500);\nSELECT * FROM orders;';
const FK_ERROR =
  'ERROR: insert or update on table "orders" violates foreign key constraint "orders_customer_id_fkey"';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];
/** Starting Postgres fetches about 5.6 MB and runs initdb: seconds on a laptop, more in CI. */
const BOOT = { timeout: 60_000 };

const editor = (page: Page): Locator => page.getByRole('textbox', { name: 'Your SQL' });
const results = (page: Page): Locator => page.getByTestId('sql-results');

async function axe(page: Page): Promise<string[]> {
  const found = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return found.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

/** The editor's Mod key: CodeMirror binds Cmd on Apple platforms, emulated iPhone included. */
async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function writeSql(page: Page, sql: string): Promise<void> {
  await editor(page).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(sql);
}

async function answered(page: Page): Promise<Record<string, unknown> | undefined> {
  return page.evaluate(
    (stepId) =>
      new Promise<Record<string, unknown> | undefined>((resolve, reject) => {
        const open = indexedDB.open('understory');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const all = open.result.transaction('events').objectStore('events').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => {
            const events = all.result as { type: string; payload: Record<string, unknown> }[];
            resolve(
              events.find((e) => e.type === 'step_answered' && e.payload.stepId === stepId)
                ?.payload,
            );
          };
        };
      }),
    STEP_ID,
  );
}

async function noSidewaysScroll(page: Page): Promise<number> {
  return page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
}

test.describe('sql step', () => {
  for (const scheme of ['light', 'dark'] as const) {
    test(`a wrong statement shows Postgres's error, the fix shows the rows and passes, in ${scheme}`, async ({
      page,
    }) => {
      test.slow();
      await page.emulateMedia({ colorScheme: scheme });
      await page.goto(`${LESSON}#${STEP_ID}`);
      await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
      await expect(editor(page)).toBeVisible();

      // The tables come from the database itself, so Postgres is up once they show.
      const orders = page.getByRole('table', { name: 'orders' });
      await expect(orders).toBeVisible(BOOT);
      await expect(orders.getByRole('rowheader', { name: 'customer_id' })).toBeVisible();
      await expect(orders.getByText('references customers')).toBeVisible();

      // The starter: order 12 names customer 9, who is not there.
      await page.getByRole('button', { name: 'Run' }).click();
      await expect(results(page).getByText(FK_ERROR)).toBeVisible(BOOT);
      await expect(
        results(page).getByText(
          'DETAIL: Key (customer_id)=(9) is not present in table "customers".',
        ),
      ).toBeVisible();
      await expect(results(page).getByText('1 statement after it did not run.')).toBeVisible();

      await writeSql(page, FIXED);
      await page.getByRole('button', { name: 'Run' }).click();
      const rows = results(page).getByRole('table', { name: 'Result: line 2' });
      await expect(rows).toBeVisible();
      await expect(rows.getByRole('columnheader')).toHaveText(['id', 'customer_id', 'total_pence']);
      await expect(rows.getByRole('row')).toHaveCount(3);
      await expect(rows.getByRole('row').last()).toHaveText(/12\s*2\s*500/);
      await expect(results(page).getByText('INSERT · 1 row changed')).toBeVisible();
      await expect(results(page).getByText('Same result as the solution')).toBeVisible();

      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        expect(await axe(page), `${scheme} at ${width}`).toEqual([]);
        expect(await noSidewaysScroll(page), `${scheme} at ${width}`).toBeLessThanOrEqual(0);
      }

      await page.getByRole('button', { name: 'Check' }).click();
      await expect(page.getByText('Right', { exact: true })).toBeVisible();
      await expect(page.getByText('Same result as the solution, with no hints.')).toBeVisible();
      await expect
        .poll(() => answered(page))
        .toMatchObject({ stepType: 'sql', concept: 'db.foreign-keys', correct: true, score: 1 });
    });
  }

  test('a wide result scrolls inside its table on a phone, never the page', async ({ page }) => {
    test.slow();
    await page.setViewportSize({ width: 390, height: 844 });
    await page.goto(`${LESSON}#${STEP_ID}`);
    await expect(page.getByRole('table', { name: 'orders' })).toBeVisible(BOOT);
    const wide = Array.from({ length: 12 }, (_, i) => `'a fairly long value ${i}' AS column_${i}`);
    await writeSql(page, `SELECT ${wide.join(', ')};`);
    await page.getByRole('button', { name: 'Run' }).click();
    const region = results(page).getByRole('region', { name: 'Result: line 1' });
    await expect(region).toBeVisible();
    const scroll = await region.evaluate((el) => ({
      scroll: el.scrollWidth,
      client: el.clientWidth,
    }));
    expect(scroll.scroll).toBeGreaterThan(scroll.client);
    expect(await noSidewaysScroll(page)).toBeLessThanOrEqual(0);
    expect(await axe(page)).toEqual([]);
  });

  test('a failed attempt shows the differences, then the solution and its rows', async ({
    page,
  }) => {
    test.slow();
    await page.goto(`${LESSON}#${STEP_ID}`);
    await expect(page.getByRole('table', { name: 'orders' })).toBeVisible(BOOT);
    await writeSql(page, 'SELECT * FROM orders;');
    await page.getByRole('button', { name: 'Run' }).click();
    await expect(results(page).getByText('Not the result the task asks for yet.')).toBeVisible(
      BOOT,
    );
    await page.getByRole('button', { name: 'Check' }).click();
    await expect(page.getByText('Expected 2 rows, got 1.')).toBeVisible();
    await page.getByRole('button', { name: 'Show answer' }).click();
    const solution = page.getByTestId('sql-solution-results');
    await expect(solution.getByRole('table', { name: 'Its result: line 2' })).toBeVisible();
    await expect(
      solution.getByRole('table', { name: 'Its result: line 2' }).getByRole('row'),
    ).toHaveCount(3);
  });
});

test('Postgres works offline once a sql step ran online', async ({
  page,
  context,
  browserName,
}) => {
  // WebKit's offline emulation fails every request, even those the worker would answer
  // from its cache (docs/SANDBOX.md, "Offline"). The routing is unit-tested for both.
  test.skip(browserName === 'webkit', 'Playwright cannot go offline with a worker in WebKit');
  test.slow();
  await page.goto('/learn');
  await expect(page.locator('html')).toHaveAttribute('data-worker', 'controlled', {
    timeout: 60_000,
  });
  // Online, under the service worker: the manifest, the worker and PGlite's files are kept.
  await page.goto(`${LESSON}#${STEP_ID}`);
  await expect(page.getByRole('table', { name: 'orders' })).toBeVisible(BOOT);

  await context.setOffline(true);
  await page.reload();
  await expect(page.getByRole('table', { name: 'orders' })).toBeVisible(BOOT);
  await writeSql(page, FIXED);
  await page.getByRole('button', { name: 'Run' }).click();
  await expect(results(page).getByText('Same result as the solution')).toBeVisible(BOOT);
});
