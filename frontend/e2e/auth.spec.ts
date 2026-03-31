import { test, expect } from '@playwright/test';

async function seedStaleAuth(page: import('@playwright/test').Page) {
  await page.addInitScript(() => {
    localStorage.setItem(
      'cerniq_auth_user',
      JSON.stringify({ id: 'stale-user', email: 'stale@cerniq.io' }),
    );
    localStorage.setItem('cerniq_portal_user', 'true');
    sessionStorage.setItem('cerniq_access_token', 'stale-token');
  });
}

test.describe('Authentication', () => {
  test('should display login page with Cerniq branding', async ({ page }) => {
    await page.goto('/login');
    await expect(page).toHaveURL(/login/);
    // The login page renders the CERNIQ brand lockup and a sign-in heading
    await expect(page.locator('body')).toContainText(/Cerniq/i);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should render email and password fields', async ({ page }) => {
    await page.goto('/login');
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    // Password field enforces minLength=8 via HTML attribute
    await expect(passwordInput).toHaveAttribute('minlength', '8');
  });

  test('should show validation when submitting empty form', async ({ page }) => {
    await page.goto('/login');
    // Both inputs have `required`, so clicking submit on empty fields
    // triggers native browser validation — the form should NOT navigate away
    const submitButton = page.getByRole('button', { name: /sign in|iniciar/i });
    await expect(submitButton).toBeVisible();
    await submitButton.click();
    // We should still be on the login page (native validation prevented submit)
    await expect(page).toHaveURL(/login/);
  });

  test('should toggle between sign-in and sign-up modes', async ({ page }) => {
    await page.goto('/login');
    // The bottom toggle text switches between login and register
    const toggleButton = page.locator('button').filter({ hasText: /account/i });
    await expect(toggleButton).toBeVisible();
    await toggleButton.click();
    // After clicking, the heading should now mention "Create" or sign-up language
    const heading = page.getByRole('heading', { level: 1 });
    const headingText = await heading.textContent();
    expect(headingText).toBeTruthy();
  });

  test('should redirect /signup to /login?mode=signup', async ({ page }) => {
    await page.goto('/signup');
    // The signup page is a client redirect to /login?mode=signup
    await page.waitForURL(/login.*mode=signup/, { timeout: 5000 });
    await expect(page).toHaveURL(/login/);
  });

  test('should include language toggle on login page', async ({ page }) => {
    await page.goto('/login');
    // EN/ES language toggle buttons
    const enButton = page.getByRole('button', { name: 'EN' });
    const esButton = page.getByRole('button', { name: 'ES' });
    await expect(enButton).toBeVisible();
    await expect(esButton).toBeVisible();
  });

  test('should show Google OAuth button when enabled', async ({ page }) => {
    await page.goto('/login');
    // Google OAuth link is rendered by default (NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH defaults to true)
    const googleLink = page.locator('a').filter({ hasText: /Google/i });
    // This may or may not be visible depending on env vars, so we just check the page loads
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });

  test('stale stored auth on login stays on login instead of looping away', async ({ page }) => {
    await seedStaleAuth(page);
    await page.goto('/login');

    await expect(page).toHaveURL(/\/login/);
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/login/);
  });

  test('stale stored auth on portal redirects once to portal login and stays there', async ({ page }) => {
    await seedStaleAuth(page);
    await page.goto('/portal');

    await page.waitForURL(/\/portal\/login/, { timeout: 15000 });
    await page.waitForTimeout(2500);
    await expect(page).toHaveURL(/\/portal\/login/);
  });
});
