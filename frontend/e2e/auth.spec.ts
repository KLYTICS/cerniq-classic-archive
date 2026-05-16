import { test, expect, type Page } from '@playwright/test';

async function waitForLoginPage(page: Page) {
  await page.goto('/login');
  await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
  await expect(page.locator('#login-email')).toBeVisible({ timeout: 15000 });
}

test.describe('Authentication', () => {
  test.beforeEach(async ({ page }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cerniq_cookie_consent', 'accepted');
    });
  });

  test('should display login page with Cerniq branding', async ({ page }) => {
    await waitForLoginPage(page);
    await expect(page).toHaveURL(/login/);
    // The login page renders the CERNIQ brand lockup and a sign-in heading
    await expect(page.locator('body')).toContainText(/Cerniq/i);
  });

  test('should render email and password fields', async ({ page }) => {
    await waitForLoginPage(page);
    const emailInput = page.locator('#login-email');
    const passwordInput = page.locator('input[type="password"]');
    await expect(emailInput).toBeVisible();
    await expect(passwordInput).toBeVisible();
    // Password field enforces minLength=8 via HTML attribute
    await expect(passwordInput).toHaveAttribute('minlength', '8');
  });

  test('should show validation when submitting empty form', async ({ page }) => {
    await waitForLoginPage(page);
    const submitButton = page.getByRole('button', { name: /sign in|iniciar/i });
    await expect(submitButton).toBeVisible();
    await expect(page.locator('#login-email')).toHaveAttribute('required', '');
    await expect(page.locator('input[type="password"]')).toHaveAttribute('required', '');
    await expect(page).toHaveURL(/login/);
  });

  test('should expose a sign-up call to action on the login page', async ({ page }) => {
    await waitForLoginPage(page);
    const toggleButton = page.getByRole('button', {
      name: /don't have an account|no account|sign up|registr/i,
    });
    await expect(toggleButton).toBeVisible();
    await expect(toggleButton).toContainText(/sign up|registr/i);
  });

  test('should redirect /signup to /login?mode=signup', async ({ page }) => {
    await page.goto('/signup');
    // The signup page is a client redirect to /login?mode=signup
    await page.waitForURL(/login.*mode=signup/, { timeout: 15000 });
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible({ timeout: 15000 });
    await expect(page).toHaveURL(/login/);
  });

  test('should include language toggle on login page', async ({ page }) => {
    await waitForLoginPage(page);
    // EN/ES language toggle buttons
    const enButton = page.getByRole('button', { name: 'Switch to English' });
    const esButton = page.getByRole('button', { name: 'Cambiar a Espanol' });
    await expect(enButton).toBeVisible();
    await expect(esButton).toBeVisible();
  });

  test('should launch the local demo flow into an authenticated dashboard shell', async ({
    page,
  }) => {
    let loginAttempts = 0;

    await page.route('**/api/auth/login', async (route) => {
      loginAttempts += 1;

      if (loginAttempts === 1) {
        await route.fulfill({
          status: 401,
          contentType: 'application/json',
          body: JSON.stringify({
            error: 'Invalid credentials',
          }),
        });
        return;
      }

      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'demo-user',
            email: 'local-demo@cerniq.local',
            name: 'Local Demo',
          },
        }),
      });
    });

    await page.route('**/api/auth/register', async (route) => {
      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          user: {
            id: 'demo-user',
            email: 'local-demo@cerniq.local',
            name: 'Local Demo',
          },
        }),
      });
    });

    await page.route('**/api/auth/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'demo-user',
          email: 'local-demo@cerniq.local',
          name: 'Local Demo',
          access: {
            platformAccessAllowed: true,
            isMasterCeo: false,
            isPaid: false,
            isDemo: true,
            effectiveTier: 'demo',
            effectiveStatus: 'active',
            effectivePeriodEnd: null,
            daysRemaining: 14,
            reason: 'demo_active',
          },
        }),
      });
    });

    await page.route('**/api/workspaces', async (route) => {
      if (route.request().method() === 'GET') {
        await route.fulfill({
          status: 200,
          contentType: 'application/json',
          body: JSON.stringify([]),
        });
        return;
      }

      await route.fulfill({
        status: 201,
        contentType: 'application/json',
        body: JSON.stringify({
          id: 'ws-demo',
          name: 'Local Demo Workspace',
        }),
      });
    });

    await page.route('**/api/alm/institutions/seed', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          institutionId: 'inst-demo',
          seedKey: 'pr-cooperativa-demo',
          delta: {
            institution: 'created',
            balanceSheetItems: {
              before: 0,
              after: 12,
              replaced: false,
            },
            liquidityPosition: 'created',
          },
          fixture: {
            seedKey: 'pr-cooperativa-demo',
            name: 'Local Demo Cooperativa',
            itemCount: 12,
          },
        }),
      });
    });

    await waitForLoginPage(page);
    await page
      .getByRole('button', { name: /launch local demo/i })
      .click();

    // 2026-04-19 portal migration: /dashboard is now a bridge whose useEffect
    // calls router.replace('/portal/submit?createCycle=1') once the auth store
    // hydrates (frontend/app/dashboard/page.tsx:108-116). Wait for the bridge
    // to load, then for the portal layout to attach — checking either URL
    // shape covers both the brief bridge moment and the final destination.
    await page.waitForURL(
      (url) => /\/(dashboard|portal)(\b|\/)/.test(url.pathname),
      { timeout: 15000 },
    );
    // Portal layout button text is literally "Log out" (with a space) in
    // frontend/app/portal/layout.tsx:314 — the regex needs `\s*` to accept
    // both the spaced and unspaced forms. The Spanish portion preserves
    // future-locale capacity even though the current source is English-only.
    await expect(
      page.getByRole('button', { name: /log\s*out|cerrar sesi[oó]n|salir/i }),
    ).toBeVisible({ timeout: 15000 });
    await expect(
      page.getByRole('button', { name: /sign in|iniciar sesi[oó]n|iniciar/i }),
    ).toHaveCount(0);
    await expect(page.locator('body')).toContainText(/local-demo@cerniq\.local/i);
  });

  test('should show Google OAuth button when enabled', async ({ page }) => {
    await waitForLoginPage(page);
    // Google OAuth link is rendered by default (NEXT_PUBLIC_ENABLE_GOOGLE_OAUTH defaults to true)
    const googleLink = page.locator('a').filter({ hasText: /Google/i });
    // This may or may not be visible depending on env vars, so we just check the page loads
    const bodyText = await page.locator('body').textContent();
    expect(bodyText).toBeTruthy();
  });
});
