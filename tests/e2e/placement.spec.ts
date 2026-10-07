import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Placement at /start: pick the parts and how thorough, the same fixed questions for
 * everyone module by module, and the result with a path to start. The items are content
 * and change, so a walk answers whatever it is shown with the first choice.
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

/** Picks the parts and the mode, then starts. The check of one area has only Start. */
async function begin(page: Page, parts: string[], mode = 'Quick', url = '/start') {
  await page.goto(url);
  await settle(page);
  for (const part of parts) {
    await page.getByRole('button', { name: new RegExp(`^${part}`) }).click();
  }
  if (url === '/start') {
    const radio = page.getByRole('radio', { name: new RegExp(`^${mode}`) });
    await page.locator('label').filter({ has: radio }).click();
  }
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page.locator('#step-kind')).toBeFocused();
}

const question = (page: Page) => page.locator('section[aria-labelledby="step-kind"]');
const result = (page: Page) => page.getByRole('heading', { level: 1, name: /Start with/ });

/** Answers the item on screen with its first line and first choice as a guess, then moves on. */
async function answerShown(page: Page) {
  const firstLine = question(page).getByRole('button', { name: /^Line 1:/ });
  if ((await firstLine.count()) > 0) await firstLine.click();
  const firstChoice = question(page)
    .locator('label')
    .filter({ has: page.getByRole('radio') });
  await firstChoice.first().click();
  await expect(question(page).getByRole('radio', { checked: true })).toHaveCount(1);
  // Saying how sure checks the answer; then Next moves on.
  await page.getByRole('button', { name: 'Guess', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
}

/** Walks to the result, and returns how many questions it took. */
async function walkToResult(page: Page): Promise<number> {
  for (let i = 0; i < 40; i += 1) {
    if (await result(page).isVisible()) return i;
    await answerShown(page);
  }
  await expect(result(page)).toBeVisible();
  return 40;
}

/** The areas the stored answers came from, in the order they were asked. */
async function answeredAreas(page: Page): Promise<string[]> {
  const events = await readEvents(page);
  return events.filter((e) => e.type === 'placement_answered').map((e) => String(e.payload.areaId));
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

test('Start waits for a part, and each mode says how long it takes', async ({ page }) => {
  await page.goto('/start');
  await settle(page);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Find your level/);
  const start = page.getByRole('button', { name: 'Start', exact: true });
  await expect(start).toBeDisabled();
  await page.getByRole('button', { name: /^Servers and data/ }).click();
  await expect(page.getByRole('button', { name: /^Servers and data/ })).toHaveAttribute(
    'aria-pressed',
    'true',
  );
  await expect(start).toBeEnabled();
  await expect(page.getByRole('radio', { name: /^Thorough.*questions/ })).toBeAttached();
});

test('how sure checks the answer, and shows right or wrong before Next', async ({ page }) => {
  await begin(page, ['First code']);
  const certain = page.getByRole('button', { name: 'Certain', exact: true });
  await expect(certain).toBeDisabled();
  const firstLine = question(page).getByRole('button', { name: /^Line 1:/ });
  if ((await firstLine.count()) > 0) await firstLine.click();
  await question(page)
    .locator('label')
    .filter({ has: page.getByRole('radio') })
    .first()
    .click();
  await certain.click();
  await expect(
    question(page)
      .getByText(/^(Right|Partly right|Not quite)$/)
      .first(),
  ).toBeVisible();
  await expect(page.getByRole('button', { name: 'Next', exact: true })).toBeFocused();
});

test('Don’t know moves on without an answer', async ({ page }) => {
  await begin(page, ['First code']);
  await page.getByRole('button', { name: 'Don’t know' }).click();
  await expect(page.locator('#step-kind')).toBeFocused();
  const answered = (await readEvents(page)).filter((e) => e.type === 'placement_answered');
  expect(answered[0]?.payload).toMatchObject({ correct: false, confidence: 'guess' });
});

test('everyone who picks the same meets the same questions', async ({ browser }) => {
  const firstIds: string[][] = [];
  for (let run = 0; run < 2; run += 1) {
    const context = await browser.newContext();
    const page = await context.newPage();
    await begin(page, ['Interfaces', 'Production'], 'Balanced');
    for (let i = 0; i < 3; i += 1) await answerShown(page);
    firstIds.push(
      (await readEvents(page))
        .filter((e) => e.type === 'placement_answered')
        .map((e) => String(e.payload.itemId)),
    );
    await context.close();
  }
  expect(firstIds[0]).toHaveLength(3);
  expect(firstIds[1]).toEqual(firstIds[0]);
});

test('a quick check of every part mixes them and places each one', async ({ page }) => {
  await page.goto('/start');
  await settle(page);
  await page.getByRole('button', { name: 'Pick all' }).click();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await walkToResult(page);
  const areas = await answeredAreas(page);
  expect(new Set(areas).size).toBe(8);
  // Mixed: the first eight questions each come from a different part.
  expect(new Set(areas.slice(0, 8)).size).toBe(8);

  await expect
    .poll(async () => (await readEvents(page)).filter((e) => e.type === 'placement_completed'))
    .toHaveLength(1);
  const completed = (await readEvents(page)).find((e) => e.type === 'placement_completed');
  expect(completed?.payload.scope).toBe('all');
  expect(Object.keys(completed?.payload.levelByArea as object)).toHaveLength(8);
  await expect(page.getByRole('heading', { name: 'By part' })).toBeVisible();
  // Guesses never count as right, so every part is one to go deeper in.
  await expect(page.getByRole('heading', { level: 3, name: 'Go deeper' })).toBeVisible();
});

test('only the parts picked are asked, and only they are placed', async ({ page }) => {
  await begin(page, ['First code', 'Servers and data']);
  await walkToResult(page);
  expect(new Set(await answeredAreas(page))).toEqual(new Set(['firstcode', 'servers']));
  await expect
    .poll(async () => (await readEvents(page)).filter((e) => e.type === 'placement_completed'))
    .toHaveLength(1);
  const completed = (await readEvents(page)).find((e) => e.type === 'placement_completed');
  expect(Object.keys(completed?.payload.levelByArea as object).sort()).toEqual([
    'firstcode',
    'servers',
  ]);

  // A finished placement changes Today: the first-visit invitation is gone.
  await page.goto('/');
  await expect(page.getByRole('link', { name: /Find my level/ })).toHaveCount(0);
});

test('a check of one part asks only that part and keeps the rest', async ({ page }) => {
  await begin(page, [], 'Thorough', '/start?area=servers');
  await expect(question(page).locator('p.t-label')).toHaveText('Servers and data');
  await walkToResult(page);
  expect(new Set(await answeredAreas(page))).toEqual(new Set(['servers']));
  await expect
    .poll(async () => (await readEvents(page)).filter((e) => e.type === 'placement_completed'))
    .toHaveLength(1);
  const completed = (await readEvents(page)).find((e) => e.type === 'placement_completed');
  expect(completed?.payload.scope).toBe('servers');
  expect(completed?.payload.levelByArea).toEqual({ servers: 0 });
});

test('the result starts the recommended lesson on its path', async ({ page }) => {
  await begin(page, ['First code']);
  await walkToResult(page);
  await expect(page.getByRole('link', { name: 'See the path' })).toBeVisible();
  await page.getByRole('button', { name: /^Start / }).click();
  await expect(page).toHaveURL(/\/learn\/[^/]+\/[^/?]+\?path=start-coding$/);
});

test('Refine with Scout opens the builder with the drafted path', async ({ page }) => {
  await begin(page, ['First code']);
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
    await page.getByRole('button', { name: /^Interfaces/ }).click();
    await expectAccessible(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('#step-kind')).toBeFocused();
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
    await page.getByRole('button', { name: 'Pick all' }).click();
    await expectNoSidewaysScroll(page);

    await page.getByRole('button', { name: 'Start', exact: true }).click();
    await expect(page.locator('#step-kind')).toBeFocused();
    await expectNoSidewaysScroll(page);

    await walkToResult(page);
    await expectNoSidewaysScroll(page);
  });
}
