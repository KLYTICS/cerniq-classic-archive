import { test, expect, type Page } from '@playwright/test';

async function expectPublicAppRoute(page: Page, path: string) {
  const response = await page.goto(path);
  expect(response?.ok()).toBeTruthy();
  await expect(page).toHaveURL(new RegExp(`${path.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}$`));
  await expect(page.locator('body')).toContainText(
    /Demo Environment|ALM|Dashboard|Cerniq/i,
  );
}

test.describe('ALM strict-auth routes', () => {
  test('loads /alm without a broken redirect loop', async ({ page }) => {
    await expectPublicAppRoute(page, '/alm');
  });

  test('loads /alm/modules without a broken redirect loop', async ({ page }) => {
    await expectPublicAppRoute(page, '/alm/modules');
  });

  test('loads /alm/balance-sheet without a broken redirect loop', async ({ page }) => {
    await expectPublicAppRoute(page, '/alm/balance-sheet');
  });

  test('loads /dashboard without a broken redirect loop', async ({ page }) => {
    await expectPublicAppRoute(page, '/dashboard');
  });

  test('renders the dashboard cream theme shell', async ({ page }) => {
    await page.goto('/dashboard');
    const shell = page.locator('.cerniq-dashboard-theme').first();
    await expect(shell).toBeVisible();
    const backgroundColor = await shell.evaluate((node) => getComputedStyle(node).backgroundColor);
    expect(backgroundColor).toBe('rgb(254, 241, 215)');
  });
});
