import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';
import { parse } from 'yaml';

/*
 * A learning path's final exam and its certificate. The exam is opened and started for real;
 * the pass is seeded as a `path_exam_attempted` event through Settings > Import, the door a
 * learner uses, since a scripted run through every kind of step would test the steps, not
 * the exam.
 */

const PATH_ID = 'coding-rounds';
const track = parse(readFileSync(`content/tracks/${PATH_ID}.yaml`, 'utf8')) as {
  name?: string;
  title: string;
  days: { must: string[] }[];
};
const NAME = track.name ?? track.title;
const LESSON_IDS = track.days.flatMap((day) => day.must);

const WIDTHS = [390, 1440] as const;
const SCHEMES = ['light', 'dark'] as const;

function exportOf(sittings: readonly { right: number; day: number }[]) {
  return {
    format: 'understory-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    events: sittings.map(({ right, day }, i) => {
      const at = new Date(Date.UTC(2026, 8, day, 10, 20, 0)).toISOString();
      return {
        id: `01900000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`,
        type: 'path_exam_attempted',
        v: 1,
        at,
        localDate: at.slice(0, 10),
        deviceId: 'seed',
        seq: i + 1,
        contentRev: 'seed',
        payload: {
          pathId: PATH_ID,
          seed: i + 1,
          right,
          total: 28,
          startedAt: new Date(Date.UTC(2026, 8, day, 10, 0, 0)).toISOString(),
          finishedAt: at,
          lessonIds: LESSON_IDS,
        },
      };
    }),
  };
}

async function seed(page: Page, sittings: readonly { right: number; day: number }[]) {
  await page.goto('/settings');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(page.getByRole('button', { name: 'Import' })).toBeEnabled();
  await page.getByLabel('Choose an Understory export file').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(exportOf(sittings))),
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
  for (const scheme of SCHEMES) {
    await page.emulateMedia({ colorScheme: scheme });
    for (const width of WIDTHS) {
      await page.setViewportSize({ width, height: 900 });
      await page.goto(path);
      await ready(page);
      await settle(page);
      const results = await new AxeBuilder({ page })
        .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
        .analyze();
      expect(
        results.violations.map(
          (v) =>
            `${width} ${scheme} ${v.id}: ${v.nodes
              .slice(0, 3)
              .map((n) => `${n.target.join(' ')} ${n.html.slice(0, 80)}`)
              .join(' | ')}`,
        ),
      ).toEqual([]);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow, `${path} at ${width} ${scheme}`).toBeLessThanOrEqual(0);
    }
  }
}

test.describe('the final exam', () => {
  test('says what it covers, starts, and is the last stop on the path', async ({ page }) => {
    await page.goto(`/paths/${PATH_ID}`);
    await settle(page);
    const stop = page.getByRole('region', { name: 'Final exam and certificate' });
    await expect(stop).toContainText('80% passes');
    await stop.getByRole('link', { name: 'Sit the final exam' }).click();

    await expect(page).toHaveURL(`/practise/exam/${PATH_ID}`);
    await settle(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(NAME);
    await expect(
      page.getByText('Nothing is locked. Sit it any time, as often as you like.'),
    ).toBeVisible();
    await expect(page.getByText('Not sat yet')).toBeVisible();
    await page.getByRole('button', { name: 'Start the exam' }).click();
    await expect(page.getByRole('img', { name: /Item 1 of \d+/ })).toBeVisible();
    await expect(page.getByText('Loading')).toBeHidden();
  });

  test('passes axe on its intro at 390 and 1440 in light and dark', async ({ page }) => {
    await axeEverywhere(page, `/practise/exam/${PATH_ID}`, async (p) => {
      await expect(p.getByRole('button', { name: 'Start the exam' })).toBeEnabled();
    });
  });
});

test.describe('the certificate', () => {
  test('before a pass, says what earns it and links to the exam', async ({ page }) => {
    await page.goto(`/paths/${PATH_ID}/certificate`);
    await settle(page);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      'Pass the final exam to earn the certificate.',
    );
    await expect(page.getByRole('link', { name: 'Sit the final exam' })).toHaveAttribute(
      'href',
      `/practise/exam/${PATH_ID}`,
    );
  });

  test('after a pass, carries the name, the facts and a code, and prints alone on one page', async ({
    page,
  }) => {
    await seed(page, [
      { right: 15, day: 20 },
      { right: 24, day: 22 },
    ]);

    await page.goto(`/paths/${PATH_ID}`);
    await settle(page);
    const stop = page.getByRole('region', { name: 'Final exam and certificate' });
    await expect(stop).toContainText('Certified');
    await expect(stop).toContainText('Passed on 22 September 2026 with 86%.');

    await page.goto('/paths');
    await settle(page);
    await expect(
      page
        .getByRole('listitem')
        .filter({ has: page.getByRole('button', { name: NAME, exact: true }) }),
    ).toContainText('Certified');

    await page.goto(`/paths/${PATH_ID}/certificate`);
    await settle(page);
    const sheet = page.getByRole('article', {
      name: `Certificate of completion for ${NAME}`,
    });
    await expect(sheet).toContainText('22 September 2026');
    await expect(sheet).toContainText('86% · 24 of 28');
    await expect(sheet).toContainText(
      'Certificate of completion from Understory. It is not an accredited qualification.',
    );
    const code = await sheet.getByText(/^[0-9A-Z]{4}-[0-9A-Z]{4}-[0-9A-Z]{4}$/).textContent();
    expect(code).toMatch(/^[0-9A-HJKMNP-TV-Z]{4}(-[0-9A-HJKMNP-TV-Z]{4}){2}$/);

    await page.getByRole('textbox', { name: 'Name on the certificate' }).fill('Ada Byron');
    await expect(sheet).toContainText('Ada Byron');
    await page.reload();
    await settle(page);
    await expect(page.getByRole('article')).toContainText('Ada Byron');
    // The same facts give the same code on every visit.
    await expect(page.getByRole('article')).toContainText(code!);

    await page.emulateMedia({ media: 'print', colorScheme: 'dark' });
    await expect(page.getByRole('textbox', { name: 'Name on the certificate' })).toBeHidden();
    await expect(page.getByRole('button', { name: 'Download PDF' })).toBeHidden();
    await expect(page.locator('aside').first()).toBeHidden();
    await expect(page.getByRole('article')).toBeVisible();
    // Paper is white whatever the screen theme.
    const ground = await page
      .getByRole('article')
      .evaluate((el) => getComputedStyle(el).backgroundColor);
    expect(ground).toBe('rgb(255, 255, 255)');

    // One page on A4 and on US Letter: the PDF holds exactly one /Type /Page.
    if (test.info().project.name === 'desktop') {
      for (const format of ['A4', 'Letter'] as const) {
        const pdf = await page.pdf({ format, preferCSSPageSize: false });
        const pages = pdf.toString('latin1').match(/\/Type\s*\/Page[^s]/g) ?? [];
        expect(pages, format).toHaveLength(1);
      }
    }
  });

  test('passes axe at 390 and 1440 in light and dark', async ({ page }) => {
    await seed(page, [{ right: 26, day: 21 }]);
    await axeEverywhere(page, `/paths/${PATH_ID}/certificate`, async (p) => {
      await expect(p.getByRole('article')).toBeVisible();
    });
  });
});
