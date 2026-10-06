import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Locator, type Page } from '@playwright/test';

const PLAYGROUND_PREVIEW = 'iframe[title="Your page"]';

/*
 * The lesson player with real content, on desktop Chromium and phone WebKit. Each step
 * type gets a focused test opened by its `#<step-id>` deep link, in three states:
 * answering, checked with a second try on offer (nothing given away), and revealed.
 * One walk then plays the lesson from Begin to the step before the code challenge and
 * reads the facts back out of IndexedDB.
 */

const LESSON = '/learn/javascript/values-types-coercion';
// The other step types live in other lessons of the chapter, so no single lesson has to
// carry every type.
const TOOLBOX_LESSON = '/learn/javascript/the-built-in-toolbox';
const ERRORS_LESSON = '/learn/javascript/control-flow-and-errors';
const MODULES_LESSON = '/learn/javascript/modules';
const AXE_TAGS = ['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'];

const kind = (page: Page) => page.locator('#step-kind');
const button = (page: Page, name: string) => page.getByRole('button', { name, exact: true });

async function openStep(page: Page, id: string, heading: string, lesson = LESSON) {
  await page.goto(`${lesson}#${id}`);
  await expect(kind(page)).toHaveText(heading);
}

async function expectNoSidewaysScroll(page: Page) {
  const overflow = await page.evaluate(
    () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
  );
  expect(overflow).toBeLessThanOrEqual(0);
}

async function expectAccessible(page: Page) {
  // The step rises in over 240 ms; axe reads half-faded text as low contrast.
  await page.waitForFunction(() =>
    document.getAnimations().every((a) => a.playState !== 'running'),
  );
  const results = await new AxeBuilder({ page })
    // The playground preview is the learner's page, and some starters are broken on
    // purpose (a field without a label) so the learner can fix them.
    .exclude(PLAYGROUND_PREVIEW)
    .withTags(AXE_TAGS)
    .analyze();
  expect(
    results.violations.map((v) => `${v.id}: ${v.nodes.map((n) => n.target).join(' ')}`),
  ).toEqual([]);
}

/** Every state of every step: fits the screen, passes axe. */
async function expectSound(page: Page) {
  await expectNoSidewaysScroll(page);
  await expectAccessible(page);
}

/** The radio itself is visually hidden, so the press goes to the row that holds it. */
async function choose(page: Page, name: string | RegExp) {
  const radio = page.getByRole('radio', {
    name,
    ...(typeof name === 'string' ? { exact: true } : {}),
  });
  await page.locator('label').filter({ has: radio }).click();
  await expect(radio).toBeChecked();
}

async function check(page: Page) {
  await button(page, 'Check').click();
  await expect(page.getByRole('status').first()).toBeVisible();
}

async function next(page: Page) {
  await button(page, 'Continue').click();
}

// --- trace-table -----------------------------------------------------------------------

const TRACE_RIGHT = {
  'total after line 3': '"601"',
  'typeof total after line 3': '"string"',
  'total after line 4': '600',
  'typeof total after line 4': '"number"',
};

async function fillTrace(page: Page, cells: Record<string, string>) {
  for (const [name, value] of Object.entries(cells))
    await page.getByRole('textbox', { name, exact: true }).fill(value);
}

// --- fill-blank ------------------------------------------------------------------------

const tokens = (page: Page) => page.getByRole('group', { name: 'Tokens' });
const token = (page: Page, name: string) => tokens(page).getByRole('button', { name, exact: true });

async function fillBlanks(page: Page, names: readonly string[]) {
  for (const name of names) await token(page, name).click();
}

// --- parsons ---------------------------------------------------------------------------

const BLOCK = {
  signature: /function readingTime/,
  words: /const words/,
  minutes: /const minutes/,
  result: /return minutes/,
  close: /: \}$/,
  distractor: /import \{ readingTime \}/,
} as const;
type BlockName = keyof typeof BLOCK;

const bank = (page: Page) => page.getByRole('region', { name: 'Blocks' });
const program = (page: Page) => page.getByRole('region', { name: 'Your program' });
const placed = (page: Page, name: BlockName) =>
  program(page).getByRole('group', { name: BLOCK[name] });

async function place(page: Page, names: readonly BlockName[]) {
  for (const name of names) {
    const pattern = name === 'close' ? /^\}$/ : BLOCK[name];
    await bank(page).getByRole('button', { name: pattern }).click();
    await expect(placed(page, name)).toBeVisible();
  }
}

async function indent(page: Page, names: readonly BlockName[]) {
  for (const name of names)
    await placed(page, name).getByRole('button', { name: 'Indent' }).click();
}

async function programOrder(page: Page): Promise<(string | null)[]> {
  return program(page)
    .getByRole('group')
    .evaluateAll((blocks) => blocks.map((b) => b.getAttribute('data-block')));
}

/** A real drag: press the grip, travel in steps so pointermove fires, release above the target. */
async function dragAbove(page: Page, grip: Locator, target: Locator) {
  await grip.scrollIntoViewIfNeeded();
  const from = await grip.boundingBox();
  const to = await target.boundingBox();
  if (!from || !to) throw new Error('nothing to drag');
  await page.mouse.move(from.x + from.width / 2, from.y + from.height / 2);
  await page.mouse.down();
  await page.mouse.move(from.x + from.width / 2, to.y + 4, { steps: 8 });
  await expect(program(page).locator('.border-accent')).toHaveCount(1);
  await page.mouse.up();
}

// --- bug-hunt and ai-review ------------------------------------------------------------

const line = (page: Page, n: number) =>
  page.getByRole('button', { name: new RegExp(`^Line ${n}:`) });

// --- playground ----------------------------------------------------------------------

const FORM_TOTAL_FIX = [
  'const tickets = document.querySelector("#tickets");',
  'const total = document.querySelector("#total");',
  'const bookingFee = 1;',
  '',
  'total.textContent = Number(tickets.value) + bookingFee;',
].join('\n');

const SEATS_HELD_FIX = [
  'const held = document.querySelector("#held");',
  'const status = document.querySelector("#status");',
  '',
  'if (Number(held.value) > 0) {',
  '  status.textContent = "Some seats held";',
  '} else {',
  '  status.textContent = "No seats held";',
  '}',
].join('\n');

/** The editor's Mod key: CodeMirror binds Cmd on Apple platforms, emulated iPhone included. */
async function modKey(page: Page): Promise<'Meta' | 'Control'> {
  const apple = await page.evaluate(
    () => /Mac|iPhone|iPad/.test(navigator.platform) || /iPhone|iPad/.test(navigator.userAgent),
  );
  return apple ? 'Meta' : 'Control';
}

async function writePageScript(page: Page, js: string): Promise<void> {
  await page.getByRole('textbox', { name: 'JavaScript of your page' }).click();
  await page.keyboard.press(`${await modKey(page)}+A`);
  await page.keyboard.insertText(js);
}

// --- IndexedDB -------------------------------------------------------------------------

interface StoredEvent {
  type: string;
  payload: { stepId?: string; stepType?: string; correct?: boolean; tryNumber?: number };
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

// ---------------------------------------------------------------------------------------

for (const scheme of ['light', 'dark'] as const) {
  test.describe(`step types, ${scheme}`, () => {
    test.beforeEach(async ({ page }) => {
      await page.emulateMedia({ colorScheme: scheme });
    });

    test('trace-table: fill, see the wrong cell marked, then the expected value', async ({
      page,
    }) => {
      await openStep(page, 'trace-operators', 'Trace');
      await expect(button(page, 'Check')).toBeDisabled();
      await expectSound(page);

      // The row in focus marks its line in the code.
      await page.getByRole('textbox', { name: 'total after line 3', exact: true }).focus();
      await expect(page.locator('.code-view .line[data-line="3"]')).toHaveAttribute(
        'data-picked',
        'true',
      );

      await fillTrace(page, { ...TRACE_RIGHT, 'total after line 3': '61' });
      await check(page);
      await expect(page.getByRole('status')).toContainText('3 of 4 cells right.');
      await expect(page.getByText('Expected')).toHaveCount(0);
      await expectSound(page);

      await button(page, 'Show answer').click();
      await expect(page.getByText('Expected')).toHaveCount(1);
      await expect(page.getByRole('cell').filter({ hasText: 'Expected' })).toContainText('"601"');
      await expectSound(page);
    });

    test('fill-blank: tokens by touch, slots by keyboard, the right token at the end', async ({
      page,
    }) => {
      await openStep(page, 'fill-named-import', 'Complete', MODULES_LESSON);
      await expectSound(page);

      await fillBlanks(page, ['require', 'import']);
      await expect(token(page, 'require')).toHaveAttribute('aria-disabled', 'true');
      // Keyboard: Enter on a token fills the next empty slot.
      await token(page, 'from').focus();
      await page.keyboard.press('Enter');
      await expect(button(page, 'Check')).toBeEnabled();
      await expectSound(page);

      await check(page);
      await expect(page.getByRole('status')).toContainText('2 of 3 blanks right.');
      await expect(page.locator('[data-blank="1"]')).not.toContainText('export');
      await expectSound(page);

      await button(page, 'Show answer').click();
      await expect(page.locator('[data-blank="1"]')).toContainText('export');
      await expectSound(page);
    });

    test('parsons: a distractor is explained, the second try has one block fewer', async ({
      page,
    }) => {
      await openStep(page, 'arrange-reading-time', 'Arrange', MODULES_LESSON);
      await expect(bank(page).getByRole('button')).toHaveCount(6);
      await expectSound(page);

      await place(page, ['signature', 'distractor', 'minutes', 'result', 'close']);
      await indent(page, ['distractor', 'minutes', 'result']);
      await expectSound(page);

      await check(page);
      await expect(placed(page, 'distractor')).toContainText('Does not belong');
      await expect(page.getByRole('status')).toContainText("doesn't import its own function");
      await expect(page.getByText('Correct program')).toHaveCount(0);
      await expectSound(page);

      await button(page, 'Try again').click();
      await expect(kind(page)).toContainText('Second try');
      await expect(bank(page).getByRole('button')).toHaveCount(5);
      await expect(bank(page).getByRole('button', { name: BLOCK.distractor })).toHaveCount(0);

      // Wrong again, on purpose, to reach the revealed state.
      await place(page, ['close', 'signature', 'words', 'minutes', 'result']);
      await check(page);
      await expect(page.getByRole('heading', { name: 'Correct program' })).toBeVisible();
      await expectSound(page);
    });

    test('bug-hunt: line first, then the reason; the fix comes with the answer', async ({
      page,
    }) => {
      await openStep(page, 'hunt-empty-catch', 'Find the bug', ERRORS_LESSON);
      await expect(page.getByRole('group', { name: 'Why is it at fault' })).toHaveCount(0);
      await expectSound(page);

      await line(page, 6).click();
      await choose(page, /never runs/);
      await expectSound(page);

      await check(page);
      await expect(page.getByRole('status')).toContainText('Line 6: not at fault.');
      await expect(page.getByText('A fix')).toHaveCount(0);
      await expectSound(page);

      await button(page, 'Show answer').click();
      await expect(page.locator('.code-view .line[data-line="4"]').first()).toHaveAttribute(
        'data-verdict',
        'right',
      );
      await expect(page.getByRole('group', { name: 'A fix' })).toBeVisible();
      await expectSound(page);
    });

    test('ai-review: the request is shown, the flaw class only with the answer', async ({
      page,
    }) => {
      await openStep(page, 'review-sum-prices', 'Review the assistant', TOOLBOX_LESSON);
      await expect(page.getByText('Asked of the assistant')).toBeVisible();
      await expect(page.getByText(/Flaw class/)).toHaveCount(0);
      await expectSound(page);

      // By keyboard: Enter on a focused line picks it.
      await line(page, 4).focus();
      await page.keyboard.press('Enter');
      await expect(line(page, 4)).toHaveAttribute('aria-pressed', 'true');
      await choose(page, /joins text/);
      await check(page);
      await expect(page.getByRole('status')).toContainText('Line 4: right. The reason is not.');
      await expect(page.getByText(/Flaw class/)).toHaveCount(0);
      await expectSound(page);

      await button(page, 'Show answer').click();
      await expect(page.getByText('Flaw class · Edge case')).toBeVisible();
      await expectSound(page);
    });

    test('explain-back: write, compare, mark the points made', async ({ page }) => {
      await openStep(page, 'explain-twenty-one', 'Explain');
      await expect(button(page, 'Compare')).toBeDisabled();
      await expectSound(page);

      await page
        .getByRole('textbox', { name: 'Your explanation' })
        .fill('The field hands over a string, so plus joins the two values as text.');
      await expect(page.getByText('14 words')).toBeVisible();
      await button(page, 'Compare').click();
      await expect(page.getByText('Model answer')).toBeVisible();
      await page.getByRole('checkbox').nth(0).check();
      await page.getByRole('checkbox').nth(1).check();
      await expectSound(page);

      await button(page, 'Check').click();
      await expect(page.getByRole('status')).toContainText('2 of 3 points made');
      await expectSound(page);

      await page.goto('/learn');
      await expect
        .poll(async () => (await readEvents(page)).map((e) => e.type))
        .toContain('explain_back_graded');
      const events = await readEvents(page);
      // The explanation itself stays on the page it was written on.
      expect(JSON.stringify(events)).not.toContain('hands over a string');
    });
  });
}

test('explain-back: no microphone without speech recognition; Scout pushes back after Compare', async ({
  page,
}) => {
  await page.addInitScript(() => {
    const scope = window as unknown as Record<string, unknown>;
    delete scope.SpeechRecognition;
    delete scope.webkitSpeechRecognition;
  });
  await openStep(page, 'explain-twenty-one', 'Explain');
  await expect(page.getByRole('textbox', { name: 'Your explanation' })).toBeVisible();
  await expect(button(page, 'Say it out loud')).toHaveCount(0);
  await expect(button(page, 'Ask Scout to push back')).toHaveCount(0);

  await page
    .getByRole('textbox', { name: 'Your explanation' })
    .fill('The field hands over a string, so plus joins the two values as text.');
  await button(page, 'Compare').click();
  await button(page, 'Ask Scout to push back').click();
  const panel = page.getByRole('complementary', { name: 'Scout AI' });
  await expect(panel).toBeVisible();
  // The question goes out at once, or waits in the box while a provider is set up.
  await expect
    .poll(async () => {
      const box = panel.getByRole('textbox', { name: 'Ask the assistant' });
      const waiting = (await box.count()) > 0 ? await box.inputValue() : '';
      return (
        waiting.includes('hands over a string') ||
        (await panel.textContent())?.includes('hands over a string')
      );
    })
    .toBe(true);
});

test('parsons: a pointer drag on a desktop, Move up on a phone, reorders the program', async ({
  page,
}, testInfo) => {
  await openStep(page, 'arrange-reading-time', 'Arrange', MODULES_LESSON);
  await place(page, ['signature', 'words', 'close', 'minutes', 'result']);
  if (testInfo.project.name === 'desktop') {
    await dragAbove(page, placed(page, 'minutes').locator('[data-grip]'), placed(page, 'close'));
  } else {
    await placed(page, 'minutes').getByRole('button', { name: 'Move up' }).click();
  }
  expect(await programOrder(page)).toEqual(['signature', 'words', 'minutes', 'close', 'result']);
});

test('a walk from Begin to the code challenge, recorded in IndexedDB', async ({ page }) => {
  test.slow();
  await page.goto(LESSON);
  // Begin answers only once the page has hydrated.
  await expect(async () => {
    await button(page, 'Begin').click({ timeout: 1000 });
    await expect(kind(page)).toHaveText('Predict', { timeout: 1000 });
  }).toPass();

  // Predict, wrong: the feedback names the misconception and keeps the answer back.
  await choose(page, '3');
  await check(page);
  await expect(page.getByRole('status')).toContainText("That's the hope.");
  await expect(page.getByText('Right', { exact: true })).toHaveCount(0);
  await expectNoSidewaysScroll(page);
  await button(page, 'Try again').click();
  await expect(kind(page)).toContainText('Second try');
  await choose(page, '21');
  await check(page);
  await expect(page.getByRole('status')).toContainText('Right');
  await next(page);

  await expect(kind(page)).toHaveText('Read');
  await next(page);

  // The live page: 21 until the value is converted, then 3.
  await expect(kind(page)).toHaveText('Build · Live');
  await expect(page.getByText('0 of 1 pass')).toBeVisible();
  await writePageScript(page, FORM_TOTAL_FIX);
  await expect(page.getByText('1 of 1 pass')).toBeVisible();
  await expectNoSidewaysScroll(page);
  await check(page);
  // The checklist has a status of its own, so pick the verdict by its words.
  await expect(page.getByRole('status').filter({ hasText: 'Right' })).toBeVisible();
  await next(page);

  await expect(kind(page)).toHaveText('Trace');
  await fillTrace(page, TRACE_RIGHT);
  await expectNoSidewaysScroll(page);
  await check(page);
  await expect(page.getByRole('status')).toContainText('4 of 4 cells right.');
  await next(page);

  await expect(kind(page)).toHaveText('Read');
  await next(page);

  await expect(kind(page)).toHaveText('Find the bug');
  await line(page, 2).click();
  await choose(page, /is true$/);
  await check(page);
  await next(page);

  await expect(kind(page)).toHaveText('Read');
  await next(page);

  // The live page: "Some seats held" for a 0 until the value is converted.
  await expect(kind(page)).toHaveText('Build · Live');
  await expect(page.getByText('0 of 1 pass')).toBeVisible();
  await writePageScript(page, SEATS_HELD_FIX);
  await expect(page.getByText('1 of 1 pass')).toBeVisible();
  await check(page);
  await expect(page.getByRole('status').filter({ hasText: 'Right' })).toBeVisible();
  await next(page);

  await expect(kind(page)).toContainText('Write');

  await page.goto('/learn');
  const answered = async () =>
    (await readEvents(page)).filter((e) => e.type === 'step_answered').map((e) => e.payload);
  await expect.poll(async () => (await answered()).length).toBe(5);
  const facts = await answered();
  expect(facts.map((p) => p.stepType).sort()).toEqual(
    ['bug-hunt', 'playground', 'playground', 'predict-output', 'trace-table'].sort(),
  );
  // One fact per step: the retried predict is a single event on its second try.
  expect(facts.find((p) => p.stepId === 'predict-total')).toMatchObject({
    tryNumber: 2,
    correct: true,
  });
  expect(facts.filter((p) => p.stepId !== 'predict-total').every((p) => p.correct)).toBe(true);
});
