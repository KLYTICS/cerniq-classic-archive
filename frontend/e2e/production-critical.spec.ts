import { expect, test, type Page } from '@playwright/test';
import { request as httpRequest } from 'node:http';
import { request as httpsRequest } from 'node:https';

const backendBaseUrl = (
  process.env.PLAYWRIGHT_BACKEND_URL ||
  (process.env.PLAYWRIGHT_SKIP_WEBSERVER === '1'
    ? process.env.NEXT_PUBLIC_NODE_API_URL
    : '') ||
  'http://localhost:43100'
)
  .trim()
  .replace(/\/+$/, '');

const runCheckoutSmoke = process.env.PLAYWRIGHT_ENABLE_CHECKOUT_SMOKE === '1';
const useMockCheckout = process.env.PLAYWRIGHT_MOCK_CHECKOUT !== '0';
const mockStripeCheckoutUrl =
  process.env.PLAYWRIGHT_MOCK_STRIPE_CHECKOUT_URL ||
  'https://checkout.stripe.com/c/pay/test_preview_session';
const vercelBypassCookie = process.env.PLAYWRIGHT_VERCEL_BYPASS_COOKIE?.trim();
const frontendHostname = process.env.PLAYWRIGHT_BASE_URL
  ? new URL(process.env.PLAYWRIGHT_BASE_URL).hostname
  : undefined;

async function fetchJsonDirect(url: string): Promise<{
  statusCode: number;
  contentType: string;
  body: unknown;
}> {
  const target = new URL(url);
  const requestImpl = target.protocol === 'https:' ? httpsRequest : httpRequest;

  return await new Promise((resolve, reject) => {
    const req = requestImpl(
      target,
      {
        method: 'GET',
        headers: {
          Accept: 'application/json',
          ...(vercelBypassCookie
            ? {
                Cookie: `_vercel_jwt=${vercelBypassCookie}`,
              }
            : {}),
        },
      },
      (res) => {
        const chunks: Buffer[] = [];
        res.on('data', (chunk) => {
          chunks.push(Buffer.isBuffer(chunk) ? chunk : Buffer.from(chunk));
        });
        res.on('end', () => {
          const text = Buffer.concat(chunks).toString('utf8');
          try {
            resolve({
              statusCode: res.statusCode ?? 0,
              contentType: String(res.headers['content-type'] || ''),
              body: JSON.parse(text),
            });
          } catch (error) {
            reject(
              new Error(
                `Expected JSON from ${url}, received ${String(res.headers['content-type'] || 'unknown')}: ${text.slice(0, 200)}`,
                { cause: error instanceof Error ? error : undefined },
              ),
            );
          }
        });
      },
    );

    req.on('error', reject);
    req.end();
  });
}

function attachErrorTracker(page: Page) {
  const errors: string[] = [];

  page.on('console', (message) => {
    if (message.type() !== 'error') {
      return;
    }

    if (page.url().includes('checkout.stripe.com')) {
      return;
    }

    const text = message.text();
    if (/favicon\.ico|ERR_NETWORK_IO_SUSPENDED/i.test(text)) {
      return;
    }

    errors.push(`console: ${text}`);
  });

  page.on('pageerror', (error) => {
    if (page.url().includes('checkout.stripe.com')) {
      return;
    }

    errors.push(`pageerror: ${error.message}`);
  });

  return async () => {
    expect(errors).toEqual([]);
  };
}

async function seedStableBrowserState(page: Page) {
  if (vercelBypassCookie && frontendHostname) {
    await page.context().addCookies([
      {
        name: '_vercel_jwt',
        value: vercelBypassCookie,
        domain: frontendHostname,
        path: '/',
        httpOnly: true,
        secure: true,
        sameSite: 'Lax',
      },
    ]);
  }

  await page.addInitScript(() => {
    window.localStorage.setItem('cerniq_cookie_consent', 'accepted');
  });
}

async function expectSettledPath(page: Page, expectedPath: string) {
  await expect
    .poll(() => new URL(page.url()).pathname, { timeout: 15000 })
    .toBe(expectedPath);
  await page.waitForTimeout(400);
  expect(new URL(page.url()).pathname).toBe(expectedPath);
}

async function expectNoFatalUi(page: Page) {
  await expect(page.locator('body')).not.toContainText(
    /Unable to load the login page|Something went wrong|Application error/i,
  );
}

async function enablePortalPaywallState(page: Page) {
  await page.route('**/api/auth/profile', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          id: 'portal-test-user',
          email: 'qa@cerniq.io',
          name: 'CERNIQ QA',
        },
      }),
    });
  });

  await page.route('**/api/billing/subscription', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        success: true,
        data: {
          tier: 'free',
          status: 'inactive',
        },
      }),
    });
  });
}

async function mockCheckoutSession(page: Page) {
  await page.route('**/api/billing/checkout', async (route) => {
    await route.fulfill({
      status: 200,
      contentType: 'application/json',
      body: JSON.stringify({
        checkoutUrl: mockStripeCheckoutUrl,
      }),
    });
  });
}

test.describe('Production-critical paths', () => {
  test.beforeEach(async ({ page }) => {
    await seedStableBrowserState(page);
  });

  test('homepage loads and stays stable', async ({ page }) => {
    const assertNoErrors = attachErrorTracker(page);

    const response = await page.goto('/');
    expect(response?.ok()).toBeTruthy();
    await expectSettledPath(page, '/');
    await expect(page).toHaveTitle(/CERNIQ/i);
    await expect(page.locator('body')).toContainText(/Cerniq/i);
    await expectNoFatalUi(page);

    await assertNoErrors();
  });

  test('login page loads without redirect loops', async ({ page }) => {
    const assertNoErrors = attachErrorTracker(page);

    const response = await page.goto('/login');
    expect(response?.ok()).toBeTruthy();
    await expectSettledPath(page, '/login');
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible();
    await expect(page.locator('input[type="email"]')).toBeVisible();
    await expectNoFatalUi(page);

    await assertNoErrors();
  });

  test('pricing page loads and exposes primary checkout calls to action', async ({ page }) => {
    const assertNoErrors = attachErrorTracker(page);

    const response = await page.goto('/pricing');
    expect(response?.ok()).toBeTruthy();
    await expectSettledPath(page, '/pricing');
    await expect(page.locator('body')).toContainText(/Plans & Pricing|Planes y precios/i);
    await expect(
      page.getByRole('button', {
        name: /Start|Subscribe|Buy Annual|Comenzar|Suscribirse|Comprar anual/i,
      }).first(),
    ).toBeVisible();
    await expectNoFatalUi(page);

    await assertNoErrors();
  });

  test('portal login page loads and stays on the intended route', async ({ page }) => {
    const assertNoErrors = attachErrorTracker(page);

    const response = await page.goto('/portal/login');
    expect(response?.ok()).toBeTruthy();
    await expectSettledPath(page, '/portal/login');
    await expect(page.getByRole('heading', { level: 1, name: /CERNIQ Portal/i })).toBeVisible();
    await expect(page.getByRole('button', { name: /Send Login Link/i })).toBeVisible();
    await expectNoFatalUi(page);

    await assertNoErrors();
  });

  test('API health responds with a healthy payload', async () => {
    const response = await fetchJsonDirect(`${backendBaseUrl}/health`);
    expect(response.statusCode).toBe(200);
    expect(response.contentType).toContain('application/json');
    const body = response.body;

    if (
      typeof body === 'object' &&
      body !== null &&
      'success' in body &&
      'data' in body
    ) {
      expect(body).toHaveProperty('success', true);
      expect(body).toHaveProperty('data.status');
      expect(body).toHaveProperty('data.services.api', 'up');
      return;
    }

    expect(body).toHaveProperty('status', 'healthy');
    expect(body).toHaveProperty('service', 'frontend');
  });

  test('pricing checkout handoff reaches Stripe @preview-only', async ({ page }) => {
    test.skip(!runCheckoutSmoke, 'Checkout smoke is only enabled in preview gating runs.');

    const assertNoErrors = attachErrorTracker(page);
    if (useMockCheckout) {
      await mockCheckoutSession(page);
    }

    await page.goto('/pricing');
    await expectSettledPath(page, '/pricing');

    await page.getByRole('button', { name: /Start|Comenzar/i }).first().click();
    await page.waitForURL((url) => url.hostname === 'checkout.stripe.com', {
      timeout: 30000,
    });

    expect(new URL(page.url()).hostname).toBe('checkout.stripe.com');
    await assertNoErrors();
  });

  test('portal paywall checkout handoff reaches Stripe @preview-only', async ({ page }) => {
    test.skip(!runCheckoutSmoke, 'Portal paywall smoke is only enabled in preview gating runs.');

    const assertNoErrors = attachErrorTracker(page);
    await enablePortalPaywallState(page);
    if (useMockCheckout) {
      await mockCheckoutSession(page);
    }

    await page.goto('/portal');
    await expectSettledPath(page, '/portal');
    await expect(page.locator('body')).toContainText(/Paid portal access/i);

    await page.getByRole('button', { name: /Unlock with/i }).first().click();
    await page.waitForURL((url) => url.hostname === 'checkout.stripe.com', {
      timeout: 30000,
    });

    expect(new URL(page.url()).hostname).toBe('checkout.stripe.com');
    await assertNoErrors();
  });
});
