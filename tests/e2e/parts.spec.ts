import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

const PLAYGROUND_PREVIEW = 'iframe[title="Your page"]';

/*
 * The course in parts: the grouped Learn page with its time totals, the checkpoint entry,
 * and the milestone screen. Progress is seeded through Settings > Import, the same door a
 * learner uses, so the tests never reach into the store's internals.
 */

const WIDTHS = [390, 768, 1024, 1440] as const;
const SCHEMES = ['light', 'dark'] as const;

interface CatalogPart {
  id: string;
  title: string;
  lessons: string[];
}
interface Catalog {
  parts: CatalogPart[];
  lessons: Record<string, { level: 'essential' | 'advanced'; minutes: number; title: string }>;
}

async function catalog(page: Page): Promise<Catalog> {
  const response = await page.request.get('/content/v1/catalog.json');
  return (await response.json()) as Catalog;
}

/** An export file that says these lessons were completed. */
function exportOf(lessonIds: readonly string[]) {
  const events = lessonIds.map((lessonId, i) => {
    const n = String(i + 1).padStart(12, '0');
    const at = new Date(Date.UTC(2026, 8, 20, 10, 0, i)).toISOString();
    return {
      id: `01900000-0000-7000-8000-${n}`,
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

async function seed(page: Page, lessonIds: readonly string[]): Promise<void> {
  await page.goto('/settings');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(page.getByRole('button', { name: 'Import' })).toBeEnabled();
  await page.getByLabel('Choose an Understory export file').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exportOf(lessonIds))),
  });
  await expect(page.getByText(/events merged/)).toBeVisible();
}

async function settle(page: Page): Promise<void> {
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );
}

async function axeEverywhere(page: Page, path: string, ready: (page: Page) => Promise<void>) {
  // Eight full audits of a long page.
  test.setTimeout(240_000);
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await ready(page);
      await settle(page);
      const results = await new AxeBuilder({ page })
        // The playground preview is the learner's page, and some starters are broken on
        // purpose (a field without a label) so the learner can fix them.
        .exclude(PLAYGROUND_PREVIEW)
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) =>
            `${width} ${scheme} ${v.id}: ${v.nodes.length} ${v.nodes
              .slice(0, 3)
              .map((n) => `${n.target.join(' ')} ${n.any[0]?.message ?? ''} ${n.html.slice(0, 80)}`)
              .join(' | ')}`,
        ),
      ).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      const widest =
        overflow > 0
          ? await page.evaluate(() => {
              const w = document.documentElement.clientWidth;
              return [...document.querySelectorAll('main *')]
                .filter((el) => el.getBoundingClientRect().right > w + 0.5)
                .slice(0, 3)
                .map((el) => `${el.tagName}.${el.className} ${el.textContent?.slice(0, 60)}`)
                .join(' | ');
            })
          : '';
      expect(overflow, `${path} at ${width}: ${widest}`).toBeLessThanOrEqual(0);
    }
  }
}

test.describe('the Learn page in parts', () => {
  test('groups the journey into seven parts, with totals for the journey, parts and chapters', async ({
    page,
  }) => {
    await page.goto('/learn');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(/Seven parts/);
    await expect(page.getByTestId('journey-part')).toHaveCount(7);
    await expect(page.getByTestId('journey-total')).toHaveText(
      /Whole journey · \d+ lessons · about \d+ h · \d+ h left/i,
    );
    // One next step before anything else, so the size of the course is not the first thing.
    await expect(page.getByTestId('next-step')).toContainText('Start here');
    await expect(
      page.getByTestId('next-step').getByRole('link', { name: /Start · \d+ min/ }),
    ).toBeVisible();
    const first = page.getByTestId('journey-part').first();
    await expect(first.getByRole('heading', { level: 3 })).toHaveText('First code');
    await expect(first.getByRole('progressbar')).toBeVisible();
    await expect(first.getByTestId('part-time')).toHaveText(
      /0\/\d+ done · \d+ chapters · about .+ left/i,
    );
    await expect(first.getByTestId('chapter-time').first()).toHaveText(
      /0\/\d+ done · about .+ · .+ left/i,
    );
    // The chapter with the next lesson is open, and every lesson row carries its time.
    const times = first.getByTestId('lesson-time');
    expect(await times.count()).toBeGreaterThanOrEqual(5);
    for (const text of await times.allTextContents()) expect(text).toMatch(/^\d+ min$/);
  });

  test('a row shows its time, Next and Advanced together', async ({ page }) => {
    test.setTimeout(180_000);
    const { parts, lessons } = await catalog(page);
    const firstPart = parts[0] as CatalogPart;
    const advanced = firstPart.lessons.findIndex((id) => lessons[id]?.level === 'advanced');
    expect(advanced).toBeGreaterThan(0);
    const advancedId = firstPart.lessons[advanced] as string;
    await seed(page, firstPart.lessons.slice(0, advanced));

    for (const scheme of SCHEMES) {
      await page.emulateMedia({ colorScheme: scheme });
      for (const width of [390, 1440]) {
        await page.setViewportSize({ width, height: 900 });
        await page.goto('/learn');
        await page.locator('html[data-hydrated="true"]').waitFor();
        await page.getByRole('button', { name: 'Open all parts' }).click();
        const row = page.getByRole('link', { name: new RegExp(lessons[advancedId]?.title ?? '') });
        await expect(row).toContainText('Next');
        await expect(row).toContainText('Advanced');
        await expect(row).toContainText(`${lessons[advancedId]?.minutes} min`);
        const done = page.getByRole('link', {
          name: new RegExp(lessons[firstPart.lessons[0] as string]?.title ?? ''),
        });
        await expect(done.first()).toContainText('Done');
        await expect(done.first()).toContainText(/\d+ min/);
        // The totals move once something is done: time left is less than the total.
        await expect(page.getByTestId('journey-total')).toHaveText(
          /about \d+ h · \d+ h( \d+ min)? left/i,
        );
        await expect(page.getByTestId('part-time').first()).toHaveText(new RegExp(`^${advanced}/`));
        await expect(page.getByTestId('chapter-time').first()).toHaveText(/(left|all done)$/i);
        await settle(page);
        const results = await new AxeBuilder({ page })
          // The playground preview is the learner's page, and some starters are broken on
          // purpose (a field without a label) so the learner can fix them.
          .exclude(PLAYGROUND_PREVIEW)
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${width} ${scheme} ${v.id}`)).toEqual([]);
      }
    }
  });

  test('only the current part is open, at every width, and everything opens on request', async ({
    page,
  }) => {
    await page.setViewportSize({ width: 390, height: 900 });
    await page.goto('/learn');
    await page.locator('html[data-hydrated="true"]').waitFor();
    const parts = page.getByTestId('journey-part');
    await expect(parts.nth(0).getByTestId('journey-chapter').first()).toBeVisible();
    await expect(parts.nth(1).getByTestId('journey-chapter').first()).toBeHidden();
    await parts.nth(1).getByRole('button', { name: 'JavaScript and TypeScript' }).click();
    await expect(parts.nth(1).getByTestId('journey-chapter').first()).toBeVisible();

    await page.setViewportSize({ width: 1440, height: 900 });
    await expect(parts.nth(2).getByTestId('journey-chapter').first()).toBeHidden();
    await page.getByRole('button', { name: 'Open all parts' }).click();
    await expect(parts.nth(6).getByTestId('lesson-time').first()).toBeVisible();
    await page.getByRole('button', { name: 'Close all parts' }).click();
    await expect(parts.nth(6).getByTestId('journey-chapter').first()).toBeHidden();
  });

  test('a search lists matching lessons with their part and chapter', async ({ page }) => {
    await page.goto('/learn');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.getByLabel('Find a lesson').fill('sliding window');
    await expect(page.getByRole('status')).toHaveText(/1 lesson matches|\d+ lessons match/);
    await expect(page.getByRole('link', { name: /Sliding window/ })).toBeVisible();
    await expect(page.getByTestId('journey-part')).toHaveCount(0);
  });

  test('a link to a chapter opens its part and chapter', async ({ page }) => {
    await page.goto('/learn#algo');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await expect(page.locator('#algo').getByTestId('lesson-time').first()).toBeVisible();
  });

  test('passes axe at four widths in light and dark', async ({ page }) => {
    await axeEverywhere(page, '/learn', async (p) => {
      await expect(p.getByTestId('journey-part').first()).toBeVisible();
    });
  });
});

test.describe('the part checkpoint', () => {
  test('opens from the part and runs a mixed session of that part', async ({ page }) => {
    await page.goto('/learn');
    await page.locator('html[data-hydrated="true"]').waitFor();
    const entry = page.getByTestId('journey-part').first().getByTestId('checkpoint-entry');
    await expect(entry).toContainText(/about 10 min/);
    await entry.click();
    await expect(page).toHaveURL(/\/practise\/checkpoint\/firstcode$/);
    await expect(page.getByRole('img', { name: /Item 1 of \d+/ })).toBeVisible();
  });

  test('passes axe at four widths in light and dark', async ({ page }) => {
    await axeEverywhere(page, '/practise/checkpoint/firstcode', async (p) => {
      await expect(p.getByRole('img', { name: /Item 1 of \d+/ })).toBeVisible();
      // The first item's lesson arrives after the queue: audit the step, not its fade-in.
      await expect(p.locator('main').getByText('Loading', { exact: true })).toHaveCount(0);
      await expect(p.locator('main :is(h2, button)').first()).toBeVisible();
    });
  });
});

test.describe('the milestone', () => {
  test('marks a finished part and offers its checkpoint on Today', async ({ page }) => {
    const { parts } = await catalog(page);
    await seed(page, (parts[0] as CatalogPart).lessons);

    await page.goto('/');
    // Home leads with where the learner is now: the next lesson, one click away.
    await expect(page.getByRole('heading', { name: 'Your next step' })).toBeVisible();
    await expect(page.getByRole('link', { name: /Continue · \d+ min/ })).toBeVisible();

    await page.goto('/learn');
    await page.locator('html[data-hydrated="true"]').waitFor();
    const first = page.getByTestId('journey-part').first();
    // Wait for the log: until it is read, the first part is the current one and stays open.
    await expect(first).toContainText('Complete');
    // A finished part is no longer the current one, so it folds away behind its title.
    await first.getByRole('button', { name: 'First code' }).click();
    await first.getByRole('link', { name: /See what you can now do/ }).click();
    await expect(page).toHaveURL(/\/milestone\/firstcode$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('First code. Complete.');
  });

  test('says what you can now do, exports the portfolio and stops at Done', async ({ page }) => {
    const { parts } = await catalog(page);
    await seed(page, (parts[0] as CatalogPart).lessons);
    await page.goto('/milestone/firstcode');
    await expect(page.getByRole('heading', { level: 1 })).toHaveText('First code. Complete.');
    await expect(page.getByText('A small to-do list program', { exact: false })).toBeVisible();
    await expect(page.getByTestId('capstone-entry')).toContainText('A reading list page');

    const download = page.waitForEvent('download');
    await page.getByRole('button', { name: 'Download as Markdown' }).click();
    const file = await download;
    expect(file.suggestedFilename()).toBe('understory-firstcode.md');
    const markdown = readFileSync((await file.path()) as string, 'utf8');
    expect(markdown).toContain('# First code');
    expect(markdown).toContain('## Capstone: A reading list page');
    expect(markdown).toContain('## My notes');

    const done = page.getByRole('link', { name: 'Done' });
    await expect(done).toHaveAttribute('href', '/');
    await done.click();
    await expect(page).toHaveURL(/\/$/);
  });

  test('passes axe at four widths in light and dark', async ({ page }) => {
    const { parts } = await catalog(page);
    await seed(page, (parts[0] as CatalogPart).lessons);
    await axeEverywhere(page, '/milestone/firstcode', async (p) => {
      await expect(p.getByRole('heading', { level: 1 })).toHaveText('First code. Complete.');
    });
  });
});
