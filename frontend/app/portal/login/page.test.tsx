import { describe, it, expect, vi } from 'vitest';

const redirectMock = vi.fn();

vi.mock('next/navigation', () => ({
  redirect: redirectMock,
}));

describe('PortalLoginPage', () => {
  it('redirects the legacy portal login route to the dashboard-intent login screen', async () => {
    const { default: PortalLoginPage } = await import('./page');

    await PortalLoginPage({});

    expect(redirectMock).toHaveBeenCalledWith(
      '/login?returnUrl=%2Fdashboard&mode=magic-link',
    );
  });

  it('preserves the billing success flag while redirecting', async () => {
    const { default: PortalLoginPage } = await import('./page');

    await PortalLoginPage({
      searchParams: Promise.resolve({ billing: 'success' }),
    });

    expect(redirectMock).toHaveBeenCalledWith(
      '/login?returnUrl=%2Fdashboard&mode=magic-link&billing=success',
    );
  });
});
