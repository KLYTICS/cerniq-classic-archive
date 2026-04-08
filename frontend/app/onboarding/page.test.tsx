import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, waitFor } from '@testing-library/react';
import OnboardingPage from './page';

const replaceMock = vi.fn();

const state = {
  initialized: true,
  isAuthenticated: true,
  onboardingComplete: true,
  user: { id: 'user-1', email: 'portal@cerniq.io' },
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
  setAccess: vi.fn(),
  setOnboardingComplete: vi.fn(),
};

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: replaceMock, push: vi.fn() }),
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: (
    selector?: ((value: typeof state) => unknown) | undefined,
  ) => (selector ? selector(state) : state),
}));

vi.mock('@/lib/api', () => ({
  apiClient: {
    getCurrentUser: vi.fn(),
    createWorkspace: vi.fn(),
    createPortfolio: vi.fn(),
    addPosition: vi.fn(),
  },
}));

vi.mock('@/lib/analytics', () => ({
  analytics: { track: vi.fn() },
  EVENTS: { ONBOARDING_COMPLETED: 'ONBOARDING_COMPLETED' },
}));

vi.mock('@/lib/subscription', () => ({
  isRememberedPortalUser: vi.fn(() => false),
  rememberPortalUser: vi.fn(),
}));

describe('OnboardingPage', () => {
  beforeEach(() => {
    replaceMock.mockReset();
    state.onboardingComplete = true;
  });

  it('acts as a compatibility shim and redirects paid users to the portal', async () => {
    render(<OnboardingPage />);

    await waitFor(() => {
      expect(replaceMock).toHaveBeenCalledWith('/portal');
    });
  });
});
