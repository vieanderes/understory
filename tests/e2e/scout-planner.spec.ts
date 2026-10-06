import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Planning a path with Scout: the opening question is the app's own, Scout's replies carry
 * a question to tap and then a draft, the draft opens to be changed, and Save puts it on
 * Learn as one of the learner's paths. The model is stubbed at /api/assistant with the
 * learner's-API-key provider, so the run needs no key and no network.
 */

const ndjson = (text: string) =>
  [JSON.stringify({ type: 'text', text }), JSON.stringify({ type: 'done' })].join('\n') + '\n';

const ASK = [
  'Good, a mix of reasons. One thing changes the plan most:',
  '```scout-ask',
  JSON.stringify({
    question: 'How much time do you have a week?',
    options: ['About 2 hours', 'About 5 hours', 'Draft it now'],
  }),
  '```',
].join('\n');

const PATH = [
  'Here is a first draft: operators first, then decisions.',
  '```scout-path',
  JSON.stringify({
    name: 'First programs in two weeks!',
    alternatives: ['Code from zero, gently'],
    summary: 'Small programs that calculate and decide.',
    minutesPerWeek: 120,
    stages: [
      {
        title: 'Calculating',
        why: 'Numbers and text first.',
        lessons: ['basics.operators', 'made.up-lesson'],
      },
      { title: 'Deciding', why: 'Then choices.', lessons: ['basics.conditions'] },
    ],
  }),
  '```',
  '```scout-ask',
  JSON.stringify({
    question: 'Anything to change?',
    options: ['Shorter', 'More practice', 'Rename'],
  }),
  '```',
].join('\n');

async function stubScout(page: Page) {
  const asked: { mode?: string; planner?: string }[] = [];
  await page.route('**/api/assistant', async (route) => {
    const body = route.request().postDataJSON() as {
      turns: { role: string }[];
      context: { mode?: string; planner?: string };
    };
    asked.push(body.context);
    const questions = body.turns.filter((t) => t.role === 'user').length;
    await route.fulfill({
      status: 200,
      headers: { 'content-type': 'application/x-ndjson; charset=utf-8' },
      body: ndjson(questions === 1 ? ASK : PATH),
    });
  });
  await page.addInitScript(() => {
    window.localStorage.setItem('understory:assistant:provider', 'api-key');
    window.localStorage.setItem('understory:assistant:key', 'sk-test');
  });
  return asked;
}

async function openPlanner(page: Page) {
  await page.goto('/paths');
  await page.locator('html[data-hydrated="true"]').waitFor();
  await page.getByRole('button', { name: /Plan a path with Scout/ }).click();
  const scout = page.getByRole('complementary', { name: 'Scout AI' });
  await expect(scout.getByRole('radio', { name: 'Plan' })).toBeChecked();
  await expect(scout.getByText('What brings you here?')).toBeVisible();
  return scout;
}

test('plan a path with Scout, change the draft and save it to Learn', async ({ page }) => {
  const asked = await stubScout(page);
  const scout = await openPlanner(page);

  // The opening question takes several reasons, sent together.
  await scout.getByRole('button', { name: 'Curiosity' }).click();
  await scout.getByRole('button', { name: 'A coding test' }).click();
  await scout.getByRole('button', { name: 'Send 2 answers' }).click();
  await expect(scout.getByText('What brings me here: A coding test, Curiosity')).toBeVisible();
  expect(asked[0]?.mode).toBe('planner');
  expect(asked[0]?.planner).toContain('Today is');

  // Scout's question is a single choice: a tap sends it.
  await scout.getByRole('button', { name: 'About 2 hours' }).click();
  const card = scout.getByRole('article', { name: /^Draft path:/ });
  // The name keeps the house style, and a lesson the course lacks is left out.
  await expect(card.getByRole('heading', { name: 'First programs in two weeks' })).toBeVisible();
  await expect(card).toContainText('Left out 1 lesson the course does not have.');
  await expect(card).toContainText('builds on');
  // The earlier question shows what was picked and takes no more taps.
  await expect(scout.getByRole('button', { name: 'About 5 hours' })).toBeDisabled();

  await card.getByRole('button', { name: 'Open draft' }).click();
  const draft = scout.getByRole('region', { name: 'Draft path' });
  await draft.getByRole('button', { name: /^Add/ }).click();
  await expect(draft.getByText(/builds on/)).toBeHidden();
  await draft.getByRole('button', { name: 'Code from zero, gently' }).click();
  await expect(draft.getByLabel('Name')).toHaveValue('Code from zero, gently');
  await draft.getByRole('button', { name: 'Save path' }).click();
  await draft.getByRole('link', { name: 'Saved. Open on Learn' }).click();

  await expect(page).toHaveURL(/\/paths\?path=own-[a-z0-9]{8}$/);
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Code from zero, gently');
  const learn = page.getByRole('main');
  await expect(learn.getByText('Small programs that calculate and decide.')).toBeVisible();
  await expect(learn.getByRole('region', { name: 'Calculating', exact: true })).toBeVisible();
  await expect(learn.getByText(/About \d+ weeks? at 2 h a week/)).toBeVisible();

  // The next question shows Scout the saved draft, edits included. On a phone the sheet
  // closed to show the path, so it opens again.
  if (!(await scout.isVisible())) await page.getByRole('button', { name: 'Ask Scout AI' }).click();
  await scout.getByRole('button', { name: 'Shorter' }).click();
  await expect
    .poll(() => asked.at(-1)?.planner ?? '')
    .toContain('It is saved as one of their paths');
  expect(asked.at(-1)?.planner).toContain('basics.variables');
});

test('the planner passes axe in both themes, with no sideways scroll', async ({ page }) => {
  await stubScout(page);
  const scout = await openPlanner(page);
  await scout.getByRole('button', { name: 'Curiosity' }).click();
  await scout
    .getByRole('group', { name: /What brings you here/ })
    .getByRole('button', { name: 'Send' })
    .click();
  await scout.getByRole('button', { name: 'Draft it now' }).click();
  await scout.getByRole('button', { name: 'Open draft' }).click();
  expect(await page.evaluate(() => document.documentElement.scrollWidth - innerWidth)).toBe(0);
  for (const theme of ['light', 'dark']) {
    await page.evaluate((t) => document.documentElement.setAttribute('data-theme', t), theme);
    const { violations } = await new AxeBuilder({ page })
      .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
      .analyze();
    expect(violations.map((v) => `${v.id}: ${v.nodes[0]?.target}`)).toEqual([]);
  }
});
