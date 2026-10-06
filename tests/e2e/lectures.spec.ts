import { expect, test } from '@playwright/test';

/*
 * Lectures: every lesson, chapter and part as reading, with a PDF of each. The PDFs are
 * printed after the build only where a browser is installed, so the download is tested
 * both ways: a PDF that exists downloads, a missing one opens the print page instead.
 */

test('the Learn page leads to the lectures, and a chapter reads as one page', async ({ page }) => {
  await page.goto('/learn');
  await page.getByRole('link', { name: 'Read as lectures' }).click();
  await expect(page).toHaveURL(/\/lectures$/);
  await page.getByRole('link', { name: 'First steps in JavaScript', exact: true }).first().click();
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('First steps in JavaScript');
  await expect(page.locator('article.lecture-lesson').first()).toBeVisible();
  await expect(page.getByRole('heading', { name: /Everything to remember from/ })).toBeVisible();
  await expect(page.getByRole('link', { name: /Next chapter/ })).toBeVisible();
});

test('a lesson lecture shows each answer with its reason and the solution to each exercise', async ({
  page,
}) => {
  await page.goto('/lectures/basics/your-first-line-of-code');
  await expect(page.getByRole('heading', { name: 'The lesson, step by step' })).toBeVisible();
  await expect(page.getByText('Answer', { exact: true }).first()).toBeVisible();
  await expect(page.getByRole('link', { name: /Practise this lesson/ })).toHaveAttribute(
    'href',
    '/learn/basics/your-first-line-of-code',
  );
});

test('a PDF that was built downloads', async ({ page }) => {
  await page.route('**/pdf/chapter-basics.pdf?*', (route) =>
    route.fulfill({ status: 200, contentType: 'application/pdf', body: '%PDF-1.7\n%%EOF\n' }),
  );
  await page.goto('/lectures/basics');
  const download = page.waitForEvent('download');
  await page.getByRole('link', { name: 'Download chapter PDF' }).click();
  expect((await download).suggestedFilename()).toBe(
    'Understory lecture, First steps in JavaScript.pdf',
  );
});

test('without a built PDF, the button opens the print page and its print dialog', async ({
  page,
}) => {
  await page.addInitScript(() => {
    window.print = () => {
      document.documentElement.dataset.printed = 'true';
    };
  });
  await page.route('**/pdf/lesson-basics.first-program.pdf?*', (route) =>
    route.fulfill({ status: 404, contentType: 'text/html', body: 'Not found' }),
  );
  await page.goto('/lectures/basics/your-first-line-of-code');
  await page.getByRole('link', { name: 'Download PDF' }).click();
  await expect(page).toHaveURL(/\/print\/lecture\/lesson-basics\.first-program\?print=1$/);
  await expect(page.locator('html')).toHaveAttribute('data-printed', 'true');
  await expect(page.getByRole('heading', { level: 1 })).toHaveText('Your first line of code');
  await expect(page.getByRole('navigation', { name: 'Primary' })).toHaveCount(0);
});

test('the print page is light, whatever the reader chose', async ({ page }) => {
  await page.emulateMedia({ colorScheme: 'dark' });
  await page.goto('/print/lecture/chapter-basics');
  await expect(page.locator('html')).toHaveAttribute('data-theme', 'light');
  await expect(page.getByRole('navigation', { name: 'Contents' })).toBeVisible();
});

test('an unknown scope is a 404, not an error', async ({ request }) => {
  expect((await request.get('/print/lecture/module-js')).status()).toBe(404);
  expect((await request.get('/lectures/parts/nowhere')).status()).toBe(404);
});

test('a path reads as one lecture with its own PDF', async ({ page }) => {
  // Every path is listed in the Library; Learn opens on the learner's own.
  await page.goto('/library');
  await page
    .getByRole('link', { name: /^AI engineering/ })
    .first()
    .click();
  await expect(page).toHaveURL(/\/paths\/ai-engineering$/);
  await expect(
    page.getByRole('link', { name: 'Read as a lecture: The three builds' }),
  ).toHaveAttribute('href', '/lectures/tracks/ai-engineering#day-1');
  await page.getByRole('link', { name: 'Read as a lecture', exact: true }).click();
  await expect(page).toHaveURL(/\/lectures\/tracks\/ai-engineering$/);
  await expect(page.getByRole('heading', { level: 2, name: /The three builds/ })).toBeVisible();
  await expect(page.getByText('Interview questions, strong answers').first()).toBeVisible();
  await expect(page.getByRole('link', { name: 'Download PDF' })).toHaveAttribute(
    'href',
    /\/pdf\/track-ai-engineering\.pdf/,
  );
});

test('a lesson links to its lecture from every step', async ({ page }) => {
  await page.goto('/learn/javascript/values-types-coercion');
  const lecture = page.getByRole('link', { name: 'Read as a lecture' });
  await expect(lecture).toHaveAttribute('href', '/lectures/javascript/values-types-coercion');
  await page.getByRole('button', { name: 'Begin' }).click();
  await expect(lecture).toBeVisible();
});

test('the old fast track address leads to the paths', async ({ page }) => {
  await page.goto('/lectures/fast-track');
  await expect(page).toHaveURL(/\/paths$/);
});

test('a lecture with audio plays it and offers the whole audiobook to download', async ({
  page,
}) => {
  await page.route('**/audio/chapter-basics.json', (route) =>
    route.fulfill({
      contentType: 'application/json',
      body: JSON.stringify({
        title: 'First steps in JavaScript',
        items: [
          {
            title: 'Your first line of code',
            src: '/audio/lesson/basics.first-program.m4a',
            seconds: 600,
          },
          { title: 'Variables', src: '/audio/lesson/basics.variables.m4a', seconds: 540 },
        ],
        book: { src: '/audio/book/chapter-basics.m4b', bytes: 20_000_000 },
      }),
    }),
  );
  await page.goto('/lectures/basics');
  const player = page.getByRole('region', { name: /Listen: First steps in JavaScript/ });
  await expect(player.getByText('1 of 2', { exact: false })).toBeVisible();
  await expect(player.getByRole('button', { name: 'Play' })).toBeVisible();
  const download = player.getByRole('link', { name: /Audiobook · 20 MB/ });
  await expect(download).toHaveAttribute('href', '/audio/book/chapter-basics.m4b');
  await expect(download).toHaveAttribute(
    'download',
    'Understory audiobook, First steps in JavaScript.m4b',
  );
});

test('a lecture without audio yet says so', async ({ page }) => {
  await page.route('**/audio/lesson-basics.variables.json', (route) =>
    route.fulfill({ status: 404, body: 'Not found' }),
  );
  await page.goto('/lectures/basics/variables');
  await expect(page.getByText('The audio for this is still being made.')).toBeVisible();
});
