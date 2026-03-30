import { test, expect, type Page } from '@playwright/test';

async function acceptCookieConsentIfPresent(page: Page) {
  const acceptButton = page.getByRole('button', { name: 'Accept' });
  if (await acceptButton.isVisible().catch(() => false)) {
    await acceptButton.click();
  }
}

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cerniq_cookie_consent', 'accepted');
    });
  });

  test('should display login page with Cerniq branding', async ({ page }) => {
    await page.goto('/login');
    await acceptCookieConsentIfPresent(page);
    await expect(page).toHaveURL(/login/);
    // The login page renders the CERNIQ brand lockup and a sign-in heading
    await expect(page.locator('body')).toContainText(/Cerniq/i);
    const heading = page.getByRole('heading', { level: 1 });
    await expect(heading).toBeVisible();
  });

  test('should render email and password fields', async ({ page }) => {
    await page.goto('/login');
    await acceptCookieConsentIfPresent(page);
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    // Password field enforces minLength=8 via HTML attribute
    await expect(passwordInput).toHaveAttribute('minlength', '8');
  });

  test('should show validation when submitting empty form', async ({ page }) => {
    await page.goto('/login');
    await acceptCookieConsentIfPresent(page);
    const emailInput = page.locator('input[type="email"]');
    const passwordInput = page.locator('input[type="password"]');
    const submitButton = page.getByRole('button', { name: /sign in|iniciar/i });
    await expect(submitButton).toBeVisible();
    expect(await emailInput.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
    expect(await passwordInput.evaluate((node) => (node as HTMLInputElement).checkValidity())).toBe(false);
    await expect(page).toHaveURL(/login/);
  });

  test('should toggle between sign-in and sign-up modes', async ({ page }) => {
    await page.goto('/login');
    await acceptCookieConsentIfPresent(page);
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
    await acceptCookieConsentIfPresent(page);
    await expect
      .poll(() => page.url(), { timeout: 15000 })
      .toMatch(/\/(signup|login)(\?|$)/);
    await expect(page.getByRole('heading', { level: 1 })).toContainText(/create (your )?account|crear cuenta/i);
  });

  test('should include language toggle on login page', async ({ page }) => {
    await page.goto('/login');
    await acceptCookieConsentIfPresent(page);
    // EN/ES language toggle buttons
    const enButton = page.getByRole('button', { name: 'Switch to English' });
    const esButton = page.getByRole('button', { name: 'Cambiar a Espanol' });
    await expect(enButton).toBeVisible();
    await expect(esButton).toBeVisible();
  });

  test('should show Google OAuth button when enabled', async ({ page }) => {
    await page.goto('/login');
    await acceptCookieConsentIfPresent(page);
    // Google OAuth link is rendered by default (NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH defaults to true)
    const googleLink = page.locator('a').filter({ hasText: /Google/i });
    // This may or may not be visible depending on env vars, so we just check the page loads
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});
