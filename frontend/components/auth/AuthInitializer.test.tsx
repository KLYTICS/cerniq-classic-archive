import { render } from '@testing-library/react';
import { describe, it, expect, beforeEach, vi } from 'vitest';
import AuthInitializer from './AuthInitializer';

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
    mockUsePathname.mockReturnValue('/login');

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).toHaveBeenCalledTimes(1);
  });

  it('skips hydration on anonymous public routes', () => {
    mockUsePathname.mockReturnValue('/pricing');

    render(<AuthInitializer />);

    expect(mockHydrateFromStorage).not.toHaveBeenCalled();
  });

  it('hydrates once when entering auth scope and does not repeat inside it', () => {
    mockUsePathname.mockReturnValue('/pricing');
    window.localStorage.setItem('cerniq_auth_user', JSON.stringify({ id: 'u_1', email: 'test@cerniq.io' }));

    const { rerender } = render(<AuthInitializer />);

    mockUsePathname.mockReturnValue('/dashboard');
    mockState.initialized = true;
    rerender(<AuthInitializer />);

    mockUsePathname.mockReturnValue('/dashboard/upload');
    rerender(<AuthInitializer />);

    expect(mockHydrateFromStorage).toHaveBeenCalledTimes(1);
  });
});
