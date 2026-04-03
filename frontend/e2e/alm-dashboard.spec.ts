import { test, expect } from '@playwright/test';

test.describe('ALM strict-auth routes', () => {
  test('redirects /alm to login with returnUrl', async ({ page }) => {
    await page.goto('/alm');
    await page.waitForURL('**/login?returnUrl=%2Falm');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Falm$/);
  });

  test('redirects /alm/modules to login with returnUrl', async ({ page }) => {
    await page.goto('/alm/modules');
    await page.waitForURL('**/login?returnUrl=%2Falm%2Fmodules');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Falm%2Fmodules$/);
  });

  test('redirects /alm/balance-sheet to login with returnUrl', async ({ page }) => {
    await page.goto('/alm/balance-sheet');
    await page.waitForURL('**/login?returnUrl=%2Falm%2Fbalance-sheet');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Falm%2Fbalance-sheet$/);
  });

  test('redirects /dashboard to login with returnUrl', async ({ page }) => {
    await page.goto('/dashboard');
    await page.waitForURL('**/login?returnUrl=%2Fdashboard');
    await expect(page).toHaveURL(/\/login\?returnUrl=%2Fdashboard$/);
  });
});
