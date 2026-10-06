import { expect, test } from '@playwright/test';

test.describe('practice by topic', () => {
  test('a new learner picks a topic and gets first looks at lessons not taken yet', async ({
    page,
  }) => {
    await page.goto('/practise');
    await page.locator('html[data-hydrated="true"]').waitFor();
    await expect(page.getByRole('button', { name: 'Everything' })).toHaveAttribute(
      'aria-pressed',
      'true',
    );
    await page.getByRole('button', { name: 'Python' }).click();
    await expect(page.getByRole('button', { name: 'Everything' })).toHaveAttribute(
      'aria-pressed',
      'false',
    );
    await page.getByText('5 min', { exact: true }).click();
    const start = page.getByRole('link', { name: 'Start', exact: true });
    await expect(start).toHaveAttribute('href', '/practise/session/5?topics=python');
    await start.click();
    await expect(page).toHaveURL(/\/practise\/session\/5\?topics=python$/);
    await expect(page.getByRole('img', { name: /Item 1 of \d+/ })).toBeVisible();
    await expect(
      page
        .locator('main')
        .getByText(/First look/)
        .first(),
    ).toBeVisible();
  });

  test('keeps the coding tests and part checks one tap away', async ({ page }) => {
    await page.goto('/practise');
    await page.getByRole('link', { name: 'Open coding tests' }).click();
    await expect(page).toHaveURL('/practise/online-test');
    await expect(
      page.getByRole('link', { name: /Practice test 4: one task in four levels/ }),
    ).toBeVisible();
    await page.goBack();
    await page.getByText('Choose a part').click();
    await expect(page.getByTestId('practise-part')).toHaveCount(7);
  });
});
