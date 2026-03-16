import { test, expect } from '@playwright/test';

test.describe('Navigation & Layout', () => {
  test('should load the landing page with CERNIQ title', async ({ page }) => {
    await page.goto('/');
    await expect(page).toHaveTitle(/CERNIQ/i);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render landing page content with value proposition', async ({ page }) => {
    await page.goto('/');
    const body = page.locator('body');
    // Landing page describes ALM reporting for cooperativas and credit unions
    await expect(body).toContainText(/ALM/i);
    await expect(body).toContainText(/cerniq/i);
  });

  test('should have navigation links on the landing page', async ({ page }) => {
    await page.goto('/');
    // The landing page contains links to login, pricing, or dashboard
    const links = await page.getByRole('link').all();
    expect(links.length).toBeGreaterThan(0);
  });

  test('should navigate to the pricing page', async ({ page }) => {
    const response = await page.goto('/pricing');
    expect(response?.status()).toBeLessThan(500);
    // Pricing page shows tier information
    await expect(page.locator('body')).toContainText(/Pilot Report|Recurring|Enterprise/i);
  });

  test('should navigate to the status page', async ({ page }) => {
    const response = await page.goto('/status');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });

  test('should render 404 page for non-existent routes', async ({ page }) => {
    await page.goto('/this-route-does-not-exist-xyz');
    // The custom not-found page shows "404" and bilingual Spanish text
    await expect(page.locator('body')).toContainText('404');
  });

  test('should be responsive on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 812 });
    await page.goto('/');
    await expect(page.locator('body')).toBeVisible();
    // Page should not have significant horizontal overflow
    const bodyWidth = await page.evaluate(() => document.body.scrollWidth);
    const viewportWidth = await page.evaluate(() => window.innerWidth);
    expect(bodyWidth).toBeLessThanOrEqual(viewportWidth + 10);
  });

  test('should load the demo page', async ({ page }) => {
    const response = await page.goto('/demo');
    expect(response?.status()).toBeLessThan(500);
    await expect(page.locator('body')).toBeVisible();
  });
});
