import { describe, it, expect, vi } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('PortalLoginPage', () => {
  it('redirects the legacy portal login route to the dashboard-first login screen', async () => {
    const { default: PortalLoginPage } = await import('./page');

    await PortalLoginPage({});

    expect(redirectMock).toHaveBeenCalledWith(
      '/login?mode=magic-link&returnUrl=%2Fdashboard',
    );
  });

  it('preserves the billing success flag while redirecting', async () => {
    const { default: PortalLoginPage } = await import('./page');

    await PortalLoginPage({
      searchParams: Promise.resolve({ billing: 'success' }),
    });

    expect(redirectMock).toHaveBeenCalledWith(
      '/login?mode=magic-link&returnUrl=%2Fdashboard&billing=success',
    );
  });
});
