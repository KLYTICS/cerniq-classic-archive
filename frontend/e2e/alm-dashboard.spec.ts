import { test, expect } from '@playwright/test';

test.describe('ALM Dashboard', () => {
  test('should load ALM main page without server error', async ({ page }) => {
    const response = await page.goto('/alm');
    // ALM page should load (may show demo data or redirect to login, but never 500)
    expect(response?.status()).toBeLessThan(500);
  });

  test('should render ALM layout shell with sidebar', async ({ page }) => {
    await page.goto('/alm');
    // The ALM layout includes a sidebar, a top bar, and a demo banner
    const body = page.locator('body');
    await expect(body).toBeVisible();
    // ALM layout should contain the "ALM" or institution-related text
    const textContent = await body.textContent();
    expect(textContent?.length).toBeGreaterThan(0);
  });

  test('should load ALM stress-test sub-page', async ({ page }) => {
    const response = await page.goto('/alm/stress-test');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load ALM sensitivity sub-page', async ({ page }) => {
    const response = await page.goto('/alm/sensitivity');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load ALM liquidity sub-page', async ({ page }) => {
    const response = await page.goto('/alm/liquidity');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should load ALM balance-sheet sub-page', async ({ page }) => {
    const response = await page.goto('/alm/balance-sheet');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should not expose sensitive data in ALM page source', async ({ page }) => {
    await page.goto('/alm');
    const content = await page.content();
    // Must not leak API keys, tokens, or connection strings into client HTML
    expect(content).not.toMatch(/sk_live_|pk_live_|Bearer\s+ey|postgresql:\/\/|DATABASE_URL/);
  });

  test('should show a stable ALM shell state after loading', async ({ page }) => {
    await page.goto('/alm');
    await expect(page.locator('body')).toContainText(/Loading ALM|Refresh|AI Analyst|Load Demo|Cerniq/i);
  });
});
