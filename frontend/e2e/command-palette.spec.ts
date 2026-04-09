import { expect, test } from '@playwright/test';

test.describe('ALM command palette', () => {
  test('opens above the ALM shell with populated results via keyboard shortcut', async ({
    page,
  }) => {
    await page.addInitScript(() => {
      window.localStorage.setItem('cerniq_cookie_consent', 'accepted');
      window.localStorage.setItem(
        'cerniq_auth_user',
        JSON.stringify({
          id: 'qa-user',
          email: 'qa@cerniq.io',
          name: 'CERNIQ QA',
        }),
      );
      window.localStorage.setItem('cerniq_access_token', 'test-token');
      window.localStorage.setItem('cerniq_portal_user', 'true');
    });

    await page.route('**/api/auth/profile', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: {
            id: 'qa-user',
            email: 'qa@cerniq.io',
            name: 'CERNIQ QA',
            access: {
              platformAccessAllowed: true,
              isMasterCeo: false,
              isPaid: true,
              isDemo: false,
              effectiveTier: 'monthly',
              effectiveStatus: 'active',
              effectivePeriodEnd: null,
              daysRemaining: null,
              reason: 'paid',
            },
          },
        }),
      });
    });

    await page.route('**/api/alm/institutions*', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify({
          success: true,
          data: [
            {
              id: 'inst-1',
              name: 'Cooperativa San Juan Demo',
              type: 'credit_union',
              totalAssets: 445,
              currency: 'USD',
              reportingDate: '2026-04-01',
            },
          ],
        }),
      });
    });

    await page.route('**/api/alm/inst-1/exports', async (route) => {
      await route.fulfill({
        status: 200,
        contentType: 'application/json',
        body: JSON.stringify([]),
      });
    });

    const response = await page.goto('/alm');
    expect(response?.ok()).toBeTruthy();
    await page.waitForTimeout(800);

    await page.keyboard.press(process.platform === 'darwin' ? 'Meta+K' : 'Control+K');

    const dialog = page.getByRole('dialog');
    await expect(dialog).toBeVisible();
    await expect(page.getByRole('combobox')).toBeFocused();
    const options = page.locator('[role="option"]');
    await expect(options.first()).toContainText(/ALM Overview/i);
    await expect(options).toHaveCount(20);
  });
});
