import AxeBuilder from '@axe-core/playwright';
import { expect, test, type Page } from '@playwright/test';

/*
 * Stepped figures under prose steps: they load only when a step shows one, step by
 * button and by key, say every state in words, and keep still for reduced motion.
 */

const RAG = '/learn/ai-engineering/rag#what-rag-is';
const EVENT_LOOP = '/learn/javascript/the-event-loop#stack-and-queues';
const NO_FIGURE = '/learn/javascript/values-types-coercion';

/** Text that exists only in the illustration kit's chunk. */
const KIT_MARKER = 'Step through the figure';

const figureOf = (page: Page, id: string) => page.locator(`[data-figure="${id}"]`);
const stepText = (page: Page, id: string) => figureOf(page, id).locator('[aria-live="polite"]');

test.describe('lesson figures', () => {
  test('the RAG pipeline steps by button and by key, each step in words', async ({ page }) => {
    await page.goto(RAG);
    const figure = figureOf(page, 'rag-pipeline');
    await expect(figure.getByRole('img', { name: /The RAG pipeline/ })).toBeVisible();
    await expect(stepText(page, 'rag-pipeline')).toHaveText(/^Step 1 of 6\. A question comes in/);

    const next = figure.getByRole('button', { name: 'Next' });
    await next.click();
    await expect(stepText(page, 'rag-pipeline')).toHaveText(/^Step 2 of 6\. The embedding model/);
    await expect(figure.locator('li[aria-current="step"]')).toContainText('Embed');

    // The keyboard: focus stays in the controls while the arrows step.
    await next.focus();
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('ArrowRight');
    await expect(stepText(page, 'rag-pipeline')).toHaveText(/^Step 4 of 6\. The top 3 chunks/);
    await page.keyboard.press('End');
    await expect(stepText(page, 'rag-pipeline')).toHaveText(/^Step 6 of 6\./);
    await expect(next).toHaveAttribute('aria-disabled', 'true');
    await expect(next).toBeFocused();

    // Enter on a figure button steps the figure, not the lesson.
    await page.keyboard.press('Home');
    await next.press('Enter');
    await expect(stepText(page, 'rag-pipeline')).toHaveText(/^Step 2 of 6\./);
    await expect(page).toHaveURL(/#what-rag-is$/);
  });

  test('the event loop figure plays once to the lab engine’s real order', async ({ page }) => {
    await page.goto(EVENT_LOOP);
    const figure = figureOf(page, 'event-loop');
    await figure.getByRole('button', { name: 'Play' }).click();
    await expect(figure.getByRole('button', { name: 'Replay' })).toBeVisible({ timeout: 30_000 });
    const drawing = figure.getByRole('img');
    const texts = await drawing.locator('text').allTextContents();
    expect(texts.indexOf('microtask: seat confirmed')).toBeLessThan(
      texts.indexOf('timeout: hold expired'),
    );
    expect(texts.indexOf('microtask: seat confirmed')).toBeGreaterThan(-1);
  });

  test('keeps still for reduced motion and still steps', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' });
    await page.goto(RAG);
    const figure = figureOf(page, 'rag-pipeline');
    await figure.getByRole('button', { name: 'Next' }).click();
    await expect(stepText(page, 'rag-pipeline')).toHaveText(/^Step 2 of 6\./);
    const durations = await figure
      .locator('svg [class*="transition"]')
      .evaluateAll((els) => els.map((el) => parseFloat(getComputedStyle(el).transitionDuration)));
    expect(durations.length).toBeGreaterThan(0);
    // globals.css shortens every transition to 0.01 ms.
    expect(Math.max(...durations)).toBeLessThan(0.001);
  });

  test('loads the kit only on a lesson that shows a figure', async ({ page, isMobile }) => {
    test.skip(isMobile, 'Script bodies come from Chromium. One engine is enough.');
    const bodies: Promise<string>[] = [];
    page.on('response', (response) => {
      if (new URL(response.url()).pathname.endsWith('.js') && response.status() === 200) {
        bodies.push(response.text().catch(() => ''));
      }
    });
    await page.goto(NO_FIGURE, { waitUntil: 'networkidle' });
    await expect(page.getByRole('button', { name: 'Begin' })).toBeVisible();
    expect((await Promise.all(bodies)).some((b) => b.includes(KIT_MARKER))).toBe(false);

    bodies.length = 0;
    await page.goto(RAG, { waitUntil: 'networkidle' });
    await expect(figureOf(page, 'rag-pipeline').getByRole('img')).toBeVisible();
    expect((await Promise.all(bodies)).some((b) => b.includes(KIT_MARKER))).toBe(true);
  });

  for (const width of [390, 1440]) {
    for (const scheme of ['light', 'dark'] as const) {
      test(`has no axe violations and no sideways scroll at ${width} in ${scheme}`, async ({
        page,
        isMobile,
      }) => {
        test.skip(isMobile && width > 390, 'The phone project checks the phone width.');
        await page.setViewportSize({ width, height: 900 });
        await page.emulateMedia({ colorScheme: scheme });
        for (const [path, id] of [
          [RAG, 'rag-pipeline'],
          [EVENT_LOOP, 'event-loop'],
        ] as const) {
          await page.goto(path);
          await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
          const figure = figureOf(page, id);
          // Mid-story, so that every phase of a part is on screen at once.
          await figure.getByRole('button', { name: 'Next' }).click();
          await figure.getByRole('button', { name: 'Next' }).click();
          const results = await new AxeBuilder({ page })
            .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
            .analyze();
          expect(results.violations.map((v) => `${path} ${v.id}: ${v.nodes.length}`)).toEqual([]);
          const overflow = await page.evaluate(
            () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
          );
          expect(overflow, path).toBeLessThanOrEqual(0);
        }
      });
    }
  }
});
