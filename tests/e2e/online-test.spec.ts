import { readFileSync } from 'node:fs';
import path from 'node:path';
import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * The online-test simulator end to end, through the production build
 * (docs/ONLINE-TEST.md): the intro and its consent box, the tour, the ready dialog, the
 * platform's Test Output wording, test-input.txt, a language switch that keeps the code,
 * submitting, the time running out, quitting and resuming, and the report. Desktop
 * Chromium and phone WebKit, with axe on each screen in light and dark.
 */

const DEMO = '/practise/online-test/demo';
const HUB = '/practise/online-test';
const REFERENCE = readFileSync(
  path.join(process.cwd(), 'content/online-tests/tasks/lowest-free-ticket/solution.ts'),
  'utf8',
);
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

async function axe(page: Page): Promise<string[]> {
  const results = await new AxeBuilder({ page }).withTags(AXE_TAGS).analyze();
  return results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' | ')}`);
}

const isPhone = (page: Page): boolean => (page.viewportSize()?.width ?? 1440) < 768;

async function pane(page: Page, name: 'Task' | 'Code' | 'Output'): Promise<void> {
  if (isPhone(page)) await page.getByText(name, { exact: true }).click();
}

/** From the intro to a running clock: consent, skip the tour, confirm. */
async function begin(page: Page): Promise<void> {
  await page.goto(DEMO);
  const startButton = page.getByRole('button', { name: 'Start the test' });
  await expect(startButton).toBeDisabled();
  await page.getByLabel('I have read the rules above').check();
  await startButton.click();
  await expect(page.getByText('Step 1 of 8')).toBeVisible();
  await page.getByRole('button', { name: 'Skip this tour' }).click();
  await expect(page.getByText('Are you ready to start?')).toBeVisible();
  await page.getByRole('button', { name: "Let's start" }).click();
  await expect(page.getByRole('timer')).toHaveText(/0h 29min|0h 30min/);
}

async function typeSolution(page: Page, code: string): Promise<void> {
  await pane(page, 'Code');
  const editor = page.locator('.cm-content').first();
  await expect(editor).toBeVisible();
  await editor.click();
  // CodeMirror reads the platform from the user agent: the phone project claims to be an
  // iPhone, so select-all is Command there even when the runner is Linux.
  await page.keyboard.press(isPhone(page) ? 'Meta+A' : 'ControlOrMeta+A');
  await page.keyboard.press('Delete');
  await page.keyboard.insertText(code);
}

async function run(page: Page): Promise<void> {
  await pane(page, 'Output');
  await page.getByRole('button', { name: /Run code/ }).click();
  await expect(page.getByText(/Detected some errors|syntactically correct/).first()).toBeVisible({
    timeout: 60_000,
  });
}

async function submit(page: Page): Promise<void> {
  await page
    .getByRole('button', { name: /^Submit/ })
    .first()
    .click();
  await expect(page.getByText('Submit your assessment?')).toBeVisible();
  await page.getByRole('dialog').getByRole('button', { name: 'Submit Assessment' }).click();
  await expect(page.getByRole('heading', { name: 'Your test has ended' })).toBeVisible({
    timeout: 120_000,
  });
}

test('Run prints the platform output, and test-input.txt adds cases', async ({ page }) => {
  await begin(page);
  await typeSolution(
    page,
    "function solution(A) {\n  console.log('debug', A.length);\n  return 1;\n}\n",
  );
  if (!isPhone(page)) {
    await page.getByRole('tab', { name: 'test-input.txt' }).click();
    await page.getByLabel('test-input.txt').fill('[2, 3]\n[abc]');
  }
  await run(page);
  const output = page.getByRole('region', { name: 'Test Output' });
  await expect(output).toContainText('Compilation successful.');
  await expect(output).toContainText('WRONG ANSWER (got 1 expected 4)');
  await expect(output).toContainText('debug 6');
  await expect(output).toContainText(
    'Producing output might cause your solution to fail performance tests.',
  );
  await expect(output).toContainText('Detected some errors.');
  if (!isPhone(page)) {
    await expect(output).toContainText('Your test case:');
    await expect(output).toContainText('Returned value:');
    await expect(output).toContainText(
      "RUNTIME ERROR (invalid input, unexpected 'abc', expecting integer)",
    );
  }
});

test('changing the language asks first and keeps each solution', async ({ page }) => {
  await begin(page);
  await typeSolution(page, 'function solution(A) { return 42; }\n');
  await page.getByLabel('Language').selectOption('python');
  await expect(page.getByText('Change the language?')).toBeVisible();
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.cm-content').first()).toContainText('def solution(A):');
  await page.getByLabel('Language').selectOption('js');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await expect(page.locator('.cm-content').first()).toContainText('return 42;');
});

test('a correct solution scores 100% and the report lists every test', async ({ page }) => {
  await begin(page);
  await pane(page, 'Code');
  await page.getByLabel('Language').selectOption('ts');
  await page.getByRole('button', { name: 'Confirm' }).click();
  await typeSolution(page, REFERENCE);
  await run(page);
  await expect(page.getByRole('region', { name: 'Test Output' })).toContainText(
    'Your code is syntactically correct and works properly on the example test.',
  );
  await submit(page);
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByRole('heading', { name: 'Your test summary' })).toBeVisible();
  await expect(page.getByTestId('total-score')).toContainText('100%');
  await page.getByRole('button', { name: 'See the detailed report' }).click();
  await expect(page.getByText('large_3')).toBeVisible();
  await expect(page.getByText('All tests passed').first()).toBeVisible();

  await page.goto(HUB);
  await expect(page.getByRole('region', { name: 'Your results' })).toContainText('100%');
});

test('at zero the code is submitted as it stands', async ({ page }) => {
  await page.clock.install();
  await begin(page);
  await typeSolution(page, 'function solution(A) { return 1; }\n');
  await page.clock.fastForward('31:00');
  await expect(page.getByRole('heading', { name: 'Your test has ended' })).toBeVisible({
    timeout: 120_000,
  });
  await page.getByRole('button', { name: 'Skip' }).click();
  await expect(page.getByText('when the time ran out')).toBeVisible();
});

test('quitting keeps the clock running, and the hub resumes the test', async ({ page }) => {
  await begin(page);
  await typeSolution(page, 'function solution(A) { return 7; }\n');
  await page.getByRole('button', { name: 'Quit the test' }).click();
  await page.getByRole('button', { name: 'Quit anyway' }).click();
  await expect(page).toHaveURL(HUB);
  await expect(page.getByText('In progress')).toBeVisible();
  await page.getByRole('link', { name: 'Resume' }).click();
  await pane(page, 'Code');
  await expect(page.locator('.cm-content').first()).toContainText('return 7;');
});

for (const scheme of ['light', 'dark'] as const) {
  test(`the hub, intro, IDE and report pass axe in ${scheme}`, async ({ page }) => {
    await page.emulateMedia({ colorScheme: scheme });
    await page.goto(HUB);
    await expect(page.getByRole('heading', { name: 'Coding tests', level: 1 })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await page.goto(DEMO);
    await expect(page.getByRole('button', { name: 'Start the test' })).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await begin(page);
    await pane(page, 'Code');
    await expect(page.locator('.cm-editor').first()).toBeVisible();
    expect(await axe(page)).toEqual([]);

    await submit(page);
    await page.getByRole('button', { name: 'Skip' }).click();
    await page.getByRole('button', { name: 'See the detailed report' }).click();
    expect(await axe(page)).toEqual([]);
  });
}

test('the coding tests are on the shelf in the Library', async ({ page }) => {
  await page.goto('/library');
  await page.getByRole('link', { name: /Coding tests/ }).click();
  await expect(page).toHaveURL(HUB);
  await expect(page.getByRole('heading', { name: 'Coding tests', level: 1 })).toBeVisible();
});

test('a path stage offers practice, labs and tests, optional and with their XP', async ({
  page,
}) => {
  await page.goto('/paths/ai-coding-tests');
  const method = page.getByRole('region', { name: 'Try it: The method' });
  await expect(method.getByText('· optional, recommended')).toBeVisible();
  await expect(method.getByRole('link', { name: /Warm-up: one easy task/ })).toHaveAttribute(
    'href',
    '/practise/online-test/demo',
  );
  await expect(method.getByText('up to 20 XP').first()).toBeVisible();

  const tasks = page.getByRole('region', { name: 'Try it: The tasks' });
  await tasks.getByText(/more tasks/).click();
  await expect(tasks.getByRole('link', { name: /RoomBookings/ })).toHaveAttribute(
    'href',
    '/practise/online-test/train-room-bookings',
  );

  await expect(method.getByRole('link', { name: /Practise this stage/ })).toHaveAttribute(
    'href',
    /^\/practise\/session\/10\?chapters=/,
  );

  const timed = page.getByRole('region', { name: 'Try it: Timed practice' });
  await timed.getByText(/\d+ more$/).click();
  await expect(
    timed.getByRole('link', { name: /Full mock 4: one task in four levels/ }),
  ).toHaveAttribute('href', /^\/learn\/.+/);
});

test('a path stage lists the labs that show its mechanisms', async ({ page }) => {
  await page.goto('/paths/javascript-typescript');
  const traps = page.getByRole('region', { name: 'Try it: JavaScript traps' });
  await expect(traps.getByRole('link', { name: /Event loop stepper/ })).toHaveAttribute(
    'href',
    '/labs/event-loop-stepper',
  );
});

test('guided mode walks a task and fills the assistant with its prompt', async ({ page }) => {
  await page.goto(DEMO);
  await page.getByLabel('Guided mode').check();
  await page.getByLabel('I have read the rules above').check();
  await page.getByRole('button', { name: 'Start the test' }).click();
  await page.getByRole('button', { name: 'Skip this tour' }).click();
  await page.getByRole('button', { name: "Let's start" }).click();
  if (isPhone(page)) await page.getByText('Guide', { exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'Read the assumptions before the story' }),
  ).toBeVisible();
  for (let i = 0; i < 3; i++) await page.getByRole('button', { name: /Next step/ }).click();
  await expect(
    page.getByRole('heading', { name: /Ask the assistant to confirm one rule/ }),
  ).toBeVisible();
  await page.getByRole('button', { name: /Put in the assistant/ }).click();
  await expect(page.getByLabel('Ask the assistant')).toHaveValue(/Without solving it/);
});

test('a plan is made in five questions and leads Home with a step for today', async ({ page }) => {
  await page.goto('/plan?goal=from-zero');
  await expect(page.getByRole('heading', { name: 'What are you interested in?' })).toBeVisible();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(
    page.getByRole('heading', { name: 'How much time do you have a day?' }),
  ).toBeVisible();
  await page.getByRole('radio', { name: '45 min' }).check({ force: true });
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await page.getByRole('button', { name: 'Next', exact: true }).click();
  await expect(page.getByRole('heading', { name: 'Your plan' })).toBeVisible();
  await page.getByRole('button', { name: 'Start', exact: true }).click();
  await expect(page).toHaveURL('/');
  await expect(page.getByRole('heading', { name: 'Your next step' })).toBeVisible();
  await expect(page.getByRole('link', { name: /Start · \d+ min/ })).toBeVisible();
});
