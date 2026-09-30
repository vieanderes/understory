import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Placement at /start: the opening question, the ladder and the result. The items are
 * content and change, so the walk answers whatever it is shown with the first choice.
 */

async function settle(page: Page) {
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );
}

async function expectAccessible(page: Page) {
  await settle(page);
  const results = await new AxeBuilder({ page })
    .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
    .analyze();
  expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

/** The radio itself is visually hidden, so the press goes to the row that holds it. */
async function pressRadio(page: Page, radio: ReturnType<Page['getByRole']>) {
  await page.locator('label').filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

async function begin(page: Page, as: string) {
  await page.goto('/start');
  await settle(page);
  await pressRadio(page, page.getByRole('radio', { name: new RegExp(`^${as}`) }));
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.getByRole('heading', { level: 2 }).first()).toBeFocused();
}

const question = (page: Page) => page.locator('section[aria-labelledby="step-kind"]');
const result = (page: Page) => page.getByRole('heading', { level: 1, name: /Start with/ });

/** Answers the item on screen with its first line and first choice, and a guess. */
async function answerShown(page: Page) {
  const firstLine = question(page).getByRole('button', { name: /^Line 1:/ });
  if ((await firstLine.count()) > 0) await firstLine.click();
  const firstChoice = question(page)
    .locator('label')
    .filter({ has: page.getByRole('radio') });
  await firstChoice.first().click();
  await expect(question(page).getByRole('radio', { checked: true })).toHaveCount(1);
  await pressRadio(page, page.getByRole('radio', { name: 'Guess', exact: true }));
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

async function walkToResult(page: Page) {
  for (let i = 0; i < 10; i += 1) {
    if (await result(page).isVisible()) return;
    await answerShown(page);
  }
  await expect(result(page)).toBeVisible();
}

interface StoredEvent {
  type: string;
  payload: Record<string, unknown>;
}

function readEvents(page: Page): Promise<StoredEvent[]> {
  return page.evaluate(
    () =>
      new Promise<StoredEvent[]>((resolve, reject) => {
        const open = indexedDB.open('understory');
        open.onerror = () => reject(open.error);
        open.onsuccess = () => {
          const db = open.result;
          if (!db.objectStoreNames.contains('events')) return resolve([]);
          const all = db.transaction('events').objectStore('events').getAll();
          all.onerror = () => reject(all.error);
          all.onsuccess = () => resolve(all.result as StoredEvent[]);
        };
      }),
  );
}

test('Start waits for an answer to the opening question', async ({ page }) => {
  await page.goto('/start');
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Find your level/);
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeDisabled();
  await pressRadio(page, page.getByRole('radio', { name: /^Experienced/ }));
  await expect(start).toBeEnabled();
});

test('Next waits for an answer and a confidence', async ({ page }) => {
  await begin(page, 'New to code');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(next).toBeDisabled();
  await pressRadio(page, page.getByRole('radio', { name: 'Certain', exact: true }));
  await expect(next).toBeDisabled();
});

test('a walk records each answer and one result, and the result links onward', async ({ page }) => {
  await begin(page, 'New to code');
  await walkToResult(page);

  await expect(page.getByRole('link', { name: 'See the map' })).toBeVisible();
  const events = await readEvents(page);
  const answered = events.filter((e) => e.type === 'placement_answered');
  expect(answered.length).toBeGreaterThanOrEqual(1);
  expect(answered.length).toBeLessThanOrEqual(10);
  await expect
    .poll(async () => (await readEvents(page)).filter((e) => e.type === 'placement_completed'))
    .toHaveLength(1);
  const completed = (await readEvents(page)).find((e) => e.type === 'placement_completed');
  expect(completed?.payload.startedAs).toBe('new');

  // A finished placement changes Today: the first-visit invitation is gone.
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Find my level/ })).toHaveCount(0);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`every stage passes axe in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/start');
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await expectAccessible(page);

    await begin(page, 'Experienced');
    await expectAccessible(page);

    await walkToResult(page);
    await expectAccessible(page);
  });
}

for (const width of [390, 768, 1024, 1440]) {
  test(`fits ${width} px at every stage`, async ({ page }) => {
    await page.setViewportSize({ width, height: 900 });
    await page.goto('/start');
    await settle(page);
    await expectNoSidewaysScroll(page);

    await begin(page, 'I build with AI');
    await expectNoSidewaysScroll(page);

    await walkToResult(page);
    await expectNoSidewaysScroll(page);
  });
}
