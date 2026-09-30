import AxeBuilder from '@axe-core/playwright';
import { readFileSync } from 'node:fs';
import { expect, test, type Page } from '@playwright/test';

/*
 * The decision record per capstone: written and edited under the capstone, kept in the ADR
 * log, and exported as Markdown and in the JSON progress file. Progress is seeded through
 * Settings > Import, the door a learner uses.
 */

const WIDTHS = [390, 768, 1024, 1440] as const;
const SCHEMES = ['light', 'dark'] as const;

interface SeedEvent {
  type: string;
  payload: Record<string, unknown>;
}

function exportOf(events: readonly SeedEvent[]) {
  return {
    format: 'understory-export',
    version: 1,
    exportedAt: new Date().toISOString(),
    events: events.map((event, i) => {
      const at = new Date(Date.UTC(2026, 8, 20, 10, 0, i)).toISOString();
      return {
        id: `01900000-0000-7000-8000-${String(i + 1).padStart(12, '0')}`,
        type: event.type,
        v: 1,
        at,
        localDate: at.slice(0, 10),
        deviceId: 'seed',
        seq: i + 1,
        contentRev: 'seed',
        payload: event.payload,
      };
    }),
  };
}

async function importFile(page: Page, file: unknown): Promise<void> {
  await page.goto('/settings');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await expect(page.getByRole('button', { name: 'Import' })).toBeEnabled();
  await page.getByLabel('Choose an Understory export file').setInputFiles({
    name: 'seed.json',
    mimeType: 'application/json',
    buffer: Buffer.from(JSON.stringify(file)),
  });
  await expect(page.getByText(/events merged/)).toBeVisible();
}

const BUILT: SeedEvent = { type: 'capstone_completed', payload: { moduleId: 'firstcode' } };
const RECORD: SeedEvent = {
  type: 'capstone_adr_written',
  payload: {
    partId: 'firstcode',
    title: 'Plain HTML before any framework',
    context: 'The page lists a few books and must load fast on a phone.',
    decision: 'I will write plain HTML and CSS, with no framework and no build step.',
    alternatives: 'A static site generator. A component framework.',
    consequences:
      'Nothing to install and nothing to update. Repeating the header by hand on every page is tedious.',
  },
};

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

async function downloaded(page: Page, click: () => Promise<void>) {
  const download = page.waitForEvent('download');
  await click();
  const file = await download;
  return {
    name: file.suggestedFilename(),
    text: readFileSync((await file.path()) as string, 'utf8'),
  };
}

test.describe('a decision record per capstone', () => {
  test('is offered once the capstone is built, then written, edited and exported', async ({
    page,
  }) => {
    await page.goto('/milestone/firstcode');
    await page.locator('html[data-hydrated="true"]').waitFor();
    const capstone = page.getByTestId('capstone-entry');
    // Optional, and only offered after the learner says the capstone is built.
    await expect(capstone.getByRole('button', { name: 'Write a decision record' })).toHaveCount(0);
    await capstone.getByRole('button', { name: 'Mark as built' }).click();
    await expect(capstone).toContainText('Built');

    // The form opens on the title, and nothing is kept until Save.
    await capstone.getByRole('button', { name: 'Write a decision record' }).click();
    const form = page.getByRole('form', { name: 'Write a decision record' });
    await expect(form.getByRole('textbox', { name: 'Title' })).toBeFocused();
    await form.getByRole('button', { name: 'Save decision record' }).click();
    await expect(form.getByText('Give the record a title.')).toBeVisible();
    await expect(form.getByText('Write the decision.')).toBeVisible();

    await page.keyboard.type('Plain HTML first');
    await form.getByRole('textbox', { name: /Context/ }).fill('One page, loaded on a phone.');
    await form.getByRole('textbox', { name: /^Decision$/ }).fill('I will write plain HTML.');
    await form
      .getByRole('textbox', { name: /Alternatives considered/ })
      .fill('A component framework.');
    await form.getByRole('button', { name: 'Save decision record' }).click();

    const record = capstone.getByTestId('adr');
    await expect(record.getByRole('heading', { name: 'Plain HTML first' })).toBeVisible();
    await expect(record).toContainText('ADR 0001');
    await expect(record).toContainText('A component framework.');
    await expect(record).not.toContainText('Consequences');
    await expect(capstone.getByRole('status')).toHaveText('Decision record saved.');
    await expect(capstone.getByRole('button', { name: 'Edit decision record' })).toBeFocused();

    // Edit: the form holds the saved text; Cancel keeps it, Save replaces it.
    await capstone.getByRole('button', { name: 'Edit decision record' }).click();
    const edit = page.getByRole('form', { name: 'Edit the decision record' });
    await expect(edit.getByRole('textbox', { name: /Context/ })).toHaveValue(
      'One page, loaded on a phone.',
    );
    await edit.getByRole('textbox', { name: 'Title' }).fill('Discarded title');
    await edit.getByRole('button', { name: 'Cancel' }).click();
    await expect(record.getByRole('heading', { name: 'Plain HTML first' })).toBeVisible();

    await capstone.getByRole('button', { name: 'Edit decision record' }).click();
    await edit.getByRole('textbox', { name: 'Title' }).fill('Plain HTML before any framework');
    await edit
      .getByRole('textbox', { name: /Consequences/ })
      .fill('No build step. The header repeats on every page.');
    // Enter in the title saves, as in any form.
    await edit.getByRole('textbox', { name: 'Title' }).press('Enter');
    await expect(
      record.getByRole('heading', { name: 'Plain HTML before any framework' }),
    ).toBeVisible();
    await expect(record).toContainText(/edited/);

    // The milestone file carries the current record.
    const milestone = await downloaded(page, () =>
      page.getByRole('button', { name: 'Download as Markdown' }).click(),
    );
    expect(milestone.name).toBe('understory-firstcode.md');
    expect(milestone.text).toContain('### ADR 0001: Plain HTML before any framework');
    expect(milestone.text).toContain('#### Consequences\n\nNo build step.');
    expect(milestone.text).not.toContain('Discarded title');

    // The log lists it and exports it whole and on its own.
    await capstone.getByRole('link', { name: 'All decision records' }).click();
    await expect(page).toHaveURL(/\/decisions$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '1 decision. One per capstone.',
    );
    const all = await downloaded(page, () =>
      page.getByRole('button', { name: 'Download all as Markdown' }).click(),
    );
    expect(all.name).toBe('understory-decisions.md');
    expect(all.text).toContain('# Architecture decision records');
    expect(all.text).toContain('## ADR 0001: Plain HTML before any framework');
    expect(all.text).toContain('### Alternatives considered\n\nA component framework.');
    const one = await downloaded(page, () =>
      page.getByRole('button', { name: 'Download ADR 0001' }).click(),
    );
    expect(one.name).toBe('adr-0001-firstcode.md');
    expect(one.text.startsWith('# ADR 0001: Plain HTML before any framework\n')).toBe(true);
  });

  test('travels in the JSON progress file, both versions kept', async ({ page, browser }) => {
    await importFile(page, exportOf([BUILT, RECORD]));
    await page.goto('/milestone/firstcode');
    const capstone = page.getByTestId('capstone-entry');
    await capstone.getByRole('button', { name: 'Edit decision record' }).click();
    await page.getByRole('textbox', { name: 'Title' }).fill('Plain HTML, no build step');
    await page.getByRole('button', { name: 'Save decision record' }).click();
    await expect(capstone.getByRole('status')).toHaveText('Decision record saved.');

    await page.goto('/settings');
    await page.locator('html[data-hydrated="true"]').waitFor();
    const exported = await downloaded(page, () =>
      page.getByRole('button', { name: 'Export', exact: true }).click(),
    );
    const file = JSON.parse(exported.text) as { events: { type: string }[] };
    expect(file.events.filter((e) => e.type === 'capstone_adr_written')).toHaveLength(2);

    // A fresh browser, as another device would be.
    const other = await browser.newContext();
    const fresh = await other.newPage();
    await importFile(fresh, file);
    await fresh.goto('/decisions');
    await expect(
      fresh.getByTestId('adr').getByRole('heading', { name: 'Plain HTML, no build step' }),
    ).toBeVisible();
    await expect(fresh.getByTestId('adr')).toContainText(/edited/);
    await other.close();
  });

  test('is reachable from Settings, and the empty log says where records come from', async ({
    page,
  }) => {
    await page.goto('/settings');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await page.getByRole('link', { name: 'Open the ADR log' }).click();
    await expect(page).toHaveURL(/\/decisions$/);
    await expect(page.getByRole('heading', { level: 1 })).toHaveText(
      '0 decisions. One per capstone.',
    );
    await expect(page.getByRole('heading', { name: 'No decision records yet' })).toBeVisible();
    await expect(page.getByRole('button', { name: 'Download all as Markdown' })).toHaveCount(0);
  });
});

test.describe('the decision record screens', () => {
  test('the ADR log passes axe at four widths in light and dark', async ({ page }) => {
    test.setTimeout(240_000);
    await importFile(page, exportOf([BUILT, RECORD]));
    await axeEverywhere(page, '/decisions', async (p) => {
      await expect(p.getByTestId('adr')).toBeVisible();
    });
  });

  test('the form and the record at the milestone pass axe at four widths in light and dark', async ({
    page,
  }) => {
    test.setTimeout(480_000);
    await importFile(page, exportOf([BUILT, RECORD]));
    await axeEverywhere(page, '/milestone/firstcode', async (p) => {
      await expect(p.getByTestId('adr')).toBeVisible();
    });
    // Once more with the form open and an error showing, where most can go wrong.
    await axeEverywhere(page, '/milestone/firstcode', async (p) => {
      await p.getByRole('button', { name: 'Edit decision record' }).click();
      await p.getByRole('textbox', { name: /^Decision$/ }).fill('');
      await p.getByRole('button', { name: 'Save decision record' }).click();
      await expect(p.getByText('Write the decision.')).toBeVisible();
    });
  });
});
