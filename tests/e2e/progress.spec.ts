import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * The Progress page: an empty state with one action, figures that follow the scope in the
 * URL, and the old map address landing on its Mastery section. Progress is seeded through
 * Settings > Import, the same door a learner uses.
 */

interface Catalog {
  parts: { id: string; title: string; lessons: string[] }[];
}

function exportOf(lessonIds: readonly string[]) {
  const events = lessonIds.map((lessonId, i) => {
    const at = new Date(Date.now() - (lessonIds.length - i) * 3_600_000).toISOString();
    return {
      id: `01900000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`,
      type: 'lesson_completed',
      v: 1,
      at,
      localDate: at.slice(0, 10),
      deviceId: 'seed',
      seq: i + 1,
      contentRev: 'seed',
      payload: { lessonId },
    };
  });
  return { format: 'understory-export', version: 1, exportedAt: new Date().toISOString(), events };
}

async function seed(page: Page): Promise<Catalog> {
  const catalog = (await (await page.request.get('/content/v1/catalog.json')).json()) as Catalog;
  await page.goto('/settings');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByLabel('Choose an Understory export file').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exportOf(catalog.parts[0]!.lessons.slice(0, 3)))),
  });
  await expect(page.getByText(/events merged/)).toBeVisible();
  return catalog;
}

test('a new learner gets one action, not a page of zeros', async ({ page }) => {
  await page.goto('/progress');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Nothing to count yet/);
  await expect(page.getByRole('main').getByRole('link', { name: /Start/ })).toHaveCount(1);
  await expect(page.getByRole('heading', { name: 'Activity' })).toHaveCount(0);
});

test('the scope rides in the URL and every figure follows it', async ({ page }) => {
  const catalog = await seed(page);
  await page.goto('/progress?scope=all');
  const title = page.getByRole('heading', { level: 1 });
  await expect(title).toHaveText(/^3 of \d+ lessons/);

  const second = catalog.parts[1]!;
  await page.getByRole('combobox', { name: 'Show' }).selectOption(`part-${second.id}`);
  await expect(page).toHaveURL(new RegExp(`scope=part-${second.id}`));
  await expect(title).toHaveText(new RegExp(`^0 of ${second.lessons.length} lessons`));

  await page.reload();
  await expect(page.getByRole('combobox', { name: 'Show' })).toHaveValue(`part-${second.id}`);
  for (const id of ['activity', 'mastery', 'not-started']) {
    await expect(page.locator(`section#${id}`)).toBeVisible();
  }
});

test('the old map address opens the Mastery section', async ({ page }) => {
  await page.goto('/map');
  await expect(page).toHaveURL(/\/progress#mastery$/);
});

for (const scheme of ['light', 'dark'] as const) {
  test(`a page with progress has no axe violations in ${scheme}`, async ({ page }) => {
    await seed(page);
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto('/progress');
    await expect(page.locator('section#mastery')).toBeVisible();
    await page.waitForFunction(() =>
      document.getAnimations().every((a) => a.playState !== 'running'),
    );
    const results = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
    const overflow = await page.evaluate(
      () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
    );
    expect(overflow).toBeLessThanOrEqual(0);
  });
}
