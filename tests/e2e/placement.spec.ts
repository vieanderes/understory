import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Placement at /start: the opening question, a rating per area, a short search in each
 * area, and the result with a path to start. The items are content and change, so a walk
 * answers whatever it is shown with the first choice.
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

async function begin(page: Page, as: string, url = '/start') {
  await page.goto(url);
  await settle(page);
  if (url === '/start') {
    await pressRadio(page, page.getByRole('radio', { name: new RegExp(`^${as}`) }));
  }
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#step-kind')).toBeFocused();
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

/** Walks to the result, and returns the area named above each question. */
async function walkToResult(page: Page): Promise<string[]> {
  const areas: string[] = [];
  for (let i = 0; i < 40; i += 1) {
    if (await result(page).isVisible()) return areas;
    const where = await question(page).locator('p.t-label').first().textContent();
    areas.push((where ?? '').split(' · ')[0] ?? '');
    await answerShown(page);
  }
  await expect(result(page)).toBeVisible();
  return areas;
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

test('Start waits for the opening answer, then for one area to check', async ({ page }) => {
  await page.goto('/start');
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Find your level/);
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeDisabled();
  await pressRadio(page, page.getByRole('radio', { name: /^New to code/ }));
  await expect(start).toBeEnabled();

  // Rating the one area someone new checks as New leaves nothing to ask.
  const firstCode = page.getByRole('group', { name: 'First code' });
  const isNew = page.getByRole('radio', { name: 'New', exact: true });
  await firstCode.locator('label').filter({ has: isNew }).click();
  await expect(firstCode.getByRole('radio', { name: 'New', exact: true })).toBeChecked();
  await expect(start).toBeDisabled();
});

test('Next waits for an answer and a confidence', async ({ page }) => {
  await begin(page, 'New to code');
  const next = page.getByRole('button', { name: 'Next', exact: true });
  await expect(next).toBeDisabled();
  await pressRadio(page, page.getByRole('radio', { name: 'Certain', exact: true }));
  await expect(next).toBeDisabled();
});

test('an experienced learner is asked about every area, not one language', async ({ page }) => {
  await begin(page, 'Experienced');
  const asked = new Set(await walkToResult(page));
  expect(asked.size).toBe(8);

  await expect
    .poll(async () => (await readEvents(page)).filter((e) => e.type === 'placement_completed'))
    .toHaveLength(1);
  const completed = (await readEvents(page)).find((e) => e.type === 'placement_completed');
  expect(completed?.payload.scope).toBe('all');
  expect(Object.keys(completed?.payload.levelByArea as object)).toHaveLength(8);
  await expect(page.getByRole('heading', { name: 'By area' })).toBeVisible();
  await expect(page.getByText('Overall', { exact: true })).toBeVisible();
});

test('an area rated New asks nothing', async ({ page }) => {
  await begin(page, 'New to code');
  expect(new Set(await walkToResult(page))).toEqual(new Set(['First code']));
  const answered = (await readEvents(page)).filter((e) => e.type === 'placement_answered');
  expect(answered.every((e) => e.payload.areaId === 'firstcode')).toBe(true);

  // A finished placement changes Today: the first-visit invitation is gone.
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Find my level/ })).toHaveCount(0);
});

test('a check of one area asks only that area and keeps the rest', async ({ page }) => {
  await begin(page, '', '/start?area=servers');
  expect(new Set(await walkToResult(page))).toEqual(new Set(['Servers and data']));
  await expect
    .poll(async () => (await readEvents(page)).filter((e) => e.type === 'placement_completed'))
    .toHaveLength(1);
  const completed = (await readEvents(page)).find((e) => e.type === 'placement_completed');
  expect(completed?.payload.scope).toBe('servers');
  expect(completed?.payload.levelByArea).toEqual({ servers: 0 });
});

test('the result starts the recommended lesson on its path', async ({ page }) => {
  await begin(page, 'New to code');
  await walkToResult(page);
  await expect(page.getByRole('link', { name: 'See the path' })).toBeVisible();
  await page.getByRole('button', { name: /^Start / }).click();
  await expect(page).toHaveURL(/\/learn\/[^/]+\/[^/?]+\?path=start-coding$/);
});

test('Refine with Scout opens the builder with the drafted path', async ({ page }) => {
  await begin(page, 'New to code');
  await walkToResult(page);
  await page.getByRole('button', { name: 'Refine with Scout' }).click();
  await expect(page).toHaveURL(/\/learn\/build/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`every stage passes axe in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/start');
    await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
    await settle(page);
    await pressRadio(page, page.getByRole('radio', { name: /^Experienced/ }));
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
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
    await pressRadio(page, page.getByRole('radio', { name: /^I build with AI/ }));
    await expectNoSidewaysScroll(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expectNoSidewaysScroll(page);

    await walkToResult(page);
    await expectNoSidewaysScroll(page);
  });
}
