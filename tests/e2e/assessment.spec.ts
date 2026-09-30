import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * A timed assessment end to end, through the production build: the brief, the clock,
 * the task tabs, the sandbox scoring every hidden test alone, the report and the event
 * log. Desktop Chromium and phone WebKit, light and dark, with axe on each screen.
 */

const LESSON = '/learn/interview-challenges/mock-assessment-a';
const DIR = 'content/course/28-interview-challenges/24-mock-assessment-a';
const SOLUTION = readFileSync(path.join(process.cwd(), DIR, 'counters.solution.ts'), 'utf8');
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function start(page: Page): Promise<void> {
  await page.goto(LESSON);
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: 'Start the clock' }).click();
  await expect(page.getByRole('timer', { name: 'Time left' })).toBeVisible();
}

for (const scheme of ['light', 'dark'] as const) {
  test(`the brief, the running test and the report pass axe in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(LESSON);
    await expect(page.getByRole('button', { name: 'Start the clock' })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await start(page);
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await page.getByRole('button', { name: 'Submit' }).click();
    await expect(page.getByTestId('assessment-score')).toBeVisible({ timeout: 60_000 });
    expect(await axe(page)).toEqual([]);
  });
}

test('a correct first task scores full marks, and the starters score nothing', async ({ page }) => {
  await start(page);

  const code = page.getByRole('textbox', { name: 'Your code for task 1' });
  await expect(page.locator('.cm-editor').first()).toBeVisible();
  await code.click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(SOLUTION);

  await page.getByRole('button', { name: 'Run examples' }).first().click();
  await expect(page.getByTestId('run-status').first()).toHaveAttribute('data-status', 'passed', {
    timeout: 15_000,
  });

  await page.getByRole('button', { name: 'Submit' }).click();
  await expect(page.getByTestId('assessment-score')).toBeVisible({ timeout: 60_000 });

  const task1 = page.getByRole('region', { name: 'Task 1' });
  await expect(task1.getByText('100%').first()).toBeVisible();
  const task2 = page.getByRole('region', { name: 'Task 2' });
  await expect(task2.getByText('Wrong answer').first()).toBeVisible();

  // The clock is gone and a retake starts a fresh one.
  await expect(page.getByRole('timer')).toHaveCount(0);
  await expect(page.getByRole('button', { name: 'Retake' })).toBeVisible();
});
