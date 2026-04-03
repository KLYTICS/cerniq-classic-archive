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
});
