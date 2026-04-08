import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import AuthCallbackPage from './page';

const replaceMock = vi.fn();
const searchParams = new URLSearchParams();
const state = {
  initialized: true,
  isAuthenticated: true,
  user: { id: 'user-1' },
  access: {
    platformAccessAllowed: true,
    isMasterCeo: false,
    isPaid: true,
    isDemo: false,
    effectiveTier: 'monthly',
    effectiveStatus: 'active',
    effectivePeriodEnd: null,
    daysRemaining: null,
    reason: 'paid' as const,
  },
  onboardingComplete: false,
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock }),
  useSearchParams: () => searchParams,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: (value: typeof state) => unknown) => selector(state),
}));

vi.mock('@/lib/subscription', () => ({
  isRememberedPortalUser: vi.fn(() => false),
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    searchParams.delete('returnUrl');
    state.initialized = true;
    state.isAuthenticated = true;
    state.user = { id: 'user-1' };
    state.onboardingComplete = false;
  });

  it('routes paid users into the portal by default', async () => {
    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/portal');
    });
  });

  it('preserves explicit non-default return urls', async () => {
    searchParams.set('returnUrl', '/portal/submit?jobId=job-1');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/portal/submit?jobId=job-1');
    });
  });
});
