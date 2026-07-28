import { beforeEach, describe, expect, it, vi } from 'vitest';

const { mockGetCurrentUser } = vi.hoisted(() => ({
  mockGetCurrentUser: vi.fn(),
}));

vi.mock('./api', () => ({
  apiClient: {
    getCurrentUser: mockGetCurrentUser,
    logout: vi.fn(),
  },
}));

import { useAuthStore } from './store';

describe('useAuthStore', () => {
  beforeEach(() => {
    mockGetCurrentUser.mockReset();
    window.localStorage.clear();
    window.sessionStorage.clear();
    useAuthStore.setState({
      user: null,
      access: null,
      initialized: false,
      isAuthenticated: false,
      authRevision: 0,
      onboardingComplete: false,
    });
  });

  it('keeps the cached user authenticated when the profile probe fails transiently', async () => {
    window.localStorage.setItem(
      'cerniq_auth_user',
      JSON.stringify({ id: 'user-1', email: 'owner@cerniq.io' }),
    );
    mockGetCurrentUser.mockRejectedValue(new Error('temporary outage'));

    await useAuthStore.getState().hydrateFromStorage();

    const state = useAuthStore.getState();
    expect(state.initialized).toBe(true);
    expect(state.isAuthenticated).toBe(true);
    expect(state.user).toMatchObject({
      id: 'user-1',
      email: 'owner@cerniq.io',
    });
    expect(state.access).toBeNull();
  });

  it('does not un-initialize the app when re-probing an already-initialized session', async () => {
    // Regression guard for the /auth/callback infinite re-hydration loop:
    // hydrateFromStorage used to `set({ initialized: false })` at its start.
    // Any component subscribed to `initialized` (the callback page, the
    // AuthInitializer) then tore down and re-ran its effect on every re-probe,
    // which re-triggered hydrate — an unbounded loop that hammered
    // /api/auth/session and never redirected. Once the app has booted,
    // re-probing must stay transparent: `initialized` must never dip to false.
    useAuthStore.setState({ initialized: true, isAuthenticated: false });

    const observed: boolean[] = [];
    const unsubscribe = useAuthStore.subscribe((state) => {
      observed.push(state.initialized);
    });

    const fetchMock = vi.fn().mockResolvedValue({
      ok: true,
      status: 200,
      json: async () => ({ authenticated: false }),
    });
    vi.stubGlobal('fetch', fetchMock);

    try {
      await useAuthStore.getState().hydrateFromStorage();
    } finally {
      unsubscribe();
      vi.unstubAllGlobals();
    }

    expect(observed).not.toContain(false);
    expect(useAuthStore.getState().initialized).toBe(true);
  });
});
