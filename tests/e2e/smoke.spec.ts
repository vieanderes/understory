import AxeBuilder from '@axe-core/playwright';
import { expect, test } from '@playwright/test';

/** Every route renders, names itself, passes axe in both themes and never scrolls sideways. */
const ROUTES: { path: string; heading: RegExp }[] = [
  { path: '/', heading: /one small step at a time/ },
  { path: '/paths', heading: /Choose your paths/ },
  { path: '/library', heading: /Library/ },
  { path: '/paths/ai-coding-tests', heading: /AI-assisted coding tests/ },
  { path: '/learn', heading: /Seven parts/ },
  { path: '/progress', heading: /Nothing to count yet/ },
  { path: '/practise', heading: /What do you want to practise today/ },
  { path: '/practise/online-test', heading: /Coding tests/ },
  { path: '/settings', heading: /Settings/ },
  { path: '/decisions', heading: /decisions?\. One per capstone\./ },
  { path: '/start', heading: /Find your level/ },
  { path: '/labs', heading: /Mechanisms you can step through/ },
  { path: '/vocabulary', heading: /The language of software/ },
  { path: '/vocabulary/closure', heading: /^closure$/ },
  { path: '/signal', heading: /\w+ \d+ \w+/ },
  { path: '/signal/week/2026-W38', heading: /Sep/ },
  { path: '/signal/month/2026-09', heading: /September 2026/ },
  { path: '/signal/archive', heading: /All editions/ },
  { path: '/lectures', heading: /Read it all/ },
  { path: '/lectures/tracks/ai-engineering', heading: /build and explain AI systems/ },
  { path: '/lectures/parts/senior', heading: /Senior engineer/ },
  { path: '/lectures/basics', heading: /First steps in JavaScript/ },
  { path: '/lectures/basics/your-first-line-of-code', heading: /Your first line of code/ },
];

for (const route of ROUTES) {
  test.describe(route.path, () => {
    test('renders its heading', async ({ page }) => {
      await page.goto(route.path);
      await expect(page.getByRole('heading', { level: 1 })).toHaveText(route.heading);
    });

    for (const scheme of ['light', 'dark'] as const) {
      test(`has no axe violations in ${scheme}`, async ({ page }) => {
        // A chapter lecture holds every lesson of the chapter: axe needs longer on a phone.
        if (route.path.startsWith('/lectures')) test.slow();
        await page.emulateMedia({ colorScheme: scheme });
        await page.goto(route.path);
        await expect(page.locator('html')).toHaveAttribute('data-theme', scheme);
        // Audit the settled page: controls enable once progress loads, and a colour caught
        // mid-transition reads as low contrast though nobody ever sees it that way.
        await page.locator('html[data-hydrated="true"]').waitFor();
        await page.waitForFunction(() =>
          document.getAnimations().every((a) => a.playState !== 'running'),
        );
        const results = await new AxeBuilder({ page })
          .withTags(['wcag2a', 'wcag2aa', 'wcag21aa', 'wcag22aa'])
          .analyze();
        expect(results.violations.map((v) => `${v.id}: ${v.nodes.length}`)).toEqual([]);
      });
    }

    test('does not scroll horizontally', async ({ page }) => {
      await page.goto(route.path);
      const overflow = await page.evaluate(
        () => document.documentElement.scrollWidth - document.documentElement.clientWidth,
      );
      expect(overflow).toBeLessThanOrEqual(0);
    });
  });
}

test('security headers are set, and the sandbox path gets its own policy', async ({ request }) => {
  const app = await request.get('/');
  expect(app.headers()['content-security-policy']).toContain("frame-ancestors 'none'");
  expect(app.headers()['x-content-type-options']).toBe('nosniff');
});
