import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuthInitializer, { isAnonymousEntryRoute, isAuthRelevantPath } from './AuthInitializer';

const mockHydrateFromStorage = vi.fn();
const mockUsePathname = vi.fn();
const mockState = {
  initialized: false,
};

vi.mock('next/navigation', () => ({
  usePathname: () => mockUsePathname(),
}));

vi.mock('@/lib/store', () => ({
  useAuthStore: (selector: (state: {
    initialized: boolean;
    hydrateFromStorage: typeof mockHydrateFromStorage;
  }) => unknown) =>
    selector({
      initialized: mockState.initialized,
      hydrateFromStorage: mockHydrateFromStorage,
    }),
}));

describe('AuthInitializer', () => {
  beforeEach(() => {
    mockState.initialized = false;
    mockUsePathname.mockReturnValue('/');
    mockHydrateFromStorage.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
  });

  it('hydrates on auth-relevant routes', () => {
    mockUsePathname.mockReturnValue('/dashboard');

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).toHaveBeenCalledTimes(1);
  });

  it('hydrates on anonymous portal login so cookie-backed sessions can recover', () => {
    mockUsePathname.mockReturnValue('/portal/login');

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).toHaveBeenCalledTimes(1);
  });

  it('does not treat durable local auth metadata as a public-route hydration hint', () => {
    mockUsePathname.mockReturnValue('/pricing');
    window.localStorage.setItem('cerniq_auth_user', JSON.stringify({ id: 'u_1', email: 'test@cerniq.io' }));

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).not.toHaveBeenCalled();
  });

  it('skips hydration on anonymous public routes', () => {
    mockUsePathname.mockReturnValue('/pricing');

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).not.toHaveBeenCalled();
  });

  it('hydrates once when entering auth scope and does not repeat inside it', () => {
    mockUsePathname.mockReturnValue('/pricing');
    window.sessionStorage.setItem('cerniq_access_token', 'desk-token');

    const { rerender } = render(<AuthInitializer />);

    mockUsePathname.mockReturnValue('/dashboard');
    mockState.initialized = true;
    rerender(<AuthInitializer />);

    mockUsePathname.mockReturnValue('/dashboard/upload');
    rerender(<AuthInitializer />);

    expect(mockHydrateFromStorage).toHaveBeenCalledTimes(1);
  });

  it('treats null pathnames as non-auth routes in helper checks', () => {
    expect(isAuthRelevantPath(null)).toBe(false);
    expect(isAnonymousEntryRoute(null)).toBe(false);
  });

  it('does not hydrate on null pathnames without a session hint', () => {
    mockUsePathname.mockReturnValue(null);

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).not.toHaveBeenCalled();
  });
});
