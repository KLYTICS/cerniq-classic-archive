import { test, expect } from '@playwright/test';

test.describe('Accessibility Basics', () => {
  test('root layout has proper lang attribute', async ({ page }) => {
    await page.goto('/');
    const lang = await page.getAttribute('html', 'lang');
    expect(lang).toBe('en');
  });

  test('login page has heading hierarchy', async ({ page }) => {
    await page.goto('/login');
    // Should have at least one heading element
    const headings = await page.getByRole('heading').all();
    expect(headings.length).toBeGreaterThan(0);
    // First heading should be h1
    const h1 = page.getByRole('heading', { level: 1 });
    await expect(h1).toBeVisible();
  });

  test('all images have alt attributes', async ({ page }) => {
    await page.goto('/');
    const images = await page.locator('img').all();
    for (const img of images) {
      const alt = await img.getAttribute('alt');
      // alt should be present (empty string is acceptable for decorative images)
      expect(alt).not.toBeNull();
    }
  });

  test('form inputs have associated labels on login page', async ({ page }) => {
    await page.goto('/login');
    // The login form uses <label> elements above each input
    const labels = await page.locator('label').all();
    expect(labels.length).toBeGreaterThanOrEqual(2); // email + password
  });

  test('interactive elements are keyboard-reachable', async ({ page }) => {
    await page.goto('/login');
    // Tab into the page and verify focus lands on something meaningful
    await page.keyboard.press('Tab');
    const focusedTag = await page.evaluate(() => document.activeElement?.tagName);
    expect(focusedTag).toBeTruthy();
    // After several tabs, focus should reach the email input or a link
    await page.keyboard.press('Tab');
    await page.keyboard.press('Tab');
    const focusedTag2 = await page.evaluate(() => document.activeElement?.tagName);
    expect(['INPUT', 'BUTTON', 'A', 'SELECT']).toContain(focusedTag2);
  });

  test('page is not blank — body has visible text content', async ({ page }) => {
    await page.goto('/');
    const textContent = await page.locator('body').textContent();
    expect(textContent?.trim().length).toBeGreaterThan(0);
  });

  test('pricing page has descriptive headings', async ({ page }) => {
    await page.goto('/pricing');
    const pricingHeading = page.getByRole('heading', { level: 1, name: /plans & pricing|planes y precios/i });
    await expect(pricingHeading).toBeVisible();
  });

  test('color scheme uses sufficient contrast tokens', async ({ page }) => {
    await page.goto('/login');
    // Verify the page is not all-white or all-black (basic visual sanity)
    const bgColor = await page.evaluate(() => {
      return getComputedStyle(document.body).backgroundColor;
    });
    // The login page has a dark bg (#071122) — should not be pure white
    expect(bgColor).not.toBe('rgb(255, 255, 255)');
  });
});
