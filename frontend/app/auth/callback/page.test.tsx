import { render, waitFor } from '@testing-library/react';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import AuthCallbackPage from './page';

const {
  mockReplace,
  mockSearchParams,
  mockState,
  mockUseAuthStore,
} = vi.hoisted(() => {
  const state = {
    initialized: true,
    isAuthenticated: false,
    user: null as null | { id: string; email: string },
    hydrateFromStorage: vi.fn(async () => undefined),
  };

  const useAuthStore = ((selector: (store: typeof state) => unknown) =>
    selector(state)) as unknown as typeof import('@/lib/store').useAuthStore;
  useAuthStore.getState = (() =>
    state) as unknown as typeof useAuthStore.getState;

  return {
    mockReplace: vi.fn(),
    mockSearchParams: new URLSearchParams(),
    mockState: state,
    mockUseAuthStore: useAuthStore,
  };
});

vi.mock('next/navigation', () => ({
  useRouter: () => ({ replace: mockReplace }),
  useSearchParams: () => mockSearchParams,
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: mockUseAuthStore,
}));

describe('AuthCallbackPage', () => {
  beforeEach(() => {
    mockReplace.mockReset();
    mockSearchParams.forEach((_, key) => {
      mockSearchParams.delete(key);
    });
    mockState.initialized = true;
    mockState.isAuthenticated = false;
    mockState.user = null;
    mockState.hydrateFromStorage = vi.fn(async () => undefined);
  });

  it('routes authenticated portal users to their requested portal destination', async () => {
    mockSearchParams.set('returnUrl', '/portal/reports/job-1');
    mockState.isAuthenticated = true;
    mockState.user = { id: 'user-1', email: 'qa@cerniq.io' };

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/portal/reports/job-1');
    });
  });

  it('hydrates and then routes portal users once the cookie-backed session settles', async () => {
    mockSearchParams.set('returnUrl', '/portal');
    mockState.hydrateFromStorage = vi.fn(async () => {
      mockState.isAuthenticated = true;
      mockState.user = { id: 'user-2', email: 'portal@cerniq.io' };
    });

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/portal');
    });
  });

  it('falls back to a safe login redirect when returnUrl is invalid', async () => {
    mockSearchParams.set('returnUrl', 'https://evil.com/steal');

    render(<AuthCallbackPage />);

    await waitFor(() => {
      expect(mockReplace).toHaveBeenCalledWith('/login?returnUrl=%2Fdashboard');
    });
  });
});
