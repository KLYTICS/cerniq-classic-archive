import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useAuthStore } from './store';
import { apiClient } from './api';
import {
  ACCESS_TOKEN_KEY,
  AUTH_USER_STORAGE_KEY,
  PORTAL_USER_STORAGE_KEY,
} from './auth-storage';

vi.mock('./api', () => ({
  apiClient: {
    getCurrentUser: vi.fn(),
    logout: vi.fn(),
  },
}));

describe('useAuthStore hydrateFromStorage', () => {
  const originalNodeApiUrl = process.env.NEXT_PUBLIC_NODE_API_URL;

  beforeEach(() => {
    vi.clearAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    history.replaceState({}, '', '/login');

    useAuthStore.setState({
      user: null,
      initialized: false,
      isAuthenticated: false,
      authRevision: 0,
      onboardingComplete: false,
    });
  });

  it('clears stale stored auth when the server session is no longer valid', async () => {
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({ id: 'stale-user', email: 'stale@cerniq.io' }),
    );
    window.localStorage.setItem(PORTAL_USER_STORAGE_KEY, 'true');
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, 'stale-token');
    vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce({
      response: { status: 401 },
    });

    await useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState().isAuthenticated).toBe(false);
    expect(useAuthStore.getState().initialized).toBe(true);
    expect(window.localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PORTAL_USER_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('prefers a live server session over stale stored user data', async () => {
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({ id: 'stale-user', email: 'stale@cerniq.io' }),
    );
    vi.mocked(apiClient.getCurrentUser).mockResolvedValueOnce({
      id: 'fresh-user',
      email: 'fresh@cerniq.io',
      name: 'Fresh User',
    });

    await useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState().user).toEqual({
      id: 'fresh-user',
      email: 'fresh@cerniq.io',
      name: 'Fresh User',
    });
    expect(useAuthStore.getState().isAuthenticated).toBe(true);
  });

  it('still probes the server before trusting stored auth in split-origin local dev', async () => {
    process.env.NEXT_PUBLIC_NODE_API_URL = 'http://127.0.0.1:3000';
    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({ id: 'local-user', email: 'local@cerniq.io' }),
    );
    vi.mocked(apiClient.getCurrentUser).mockRejectedValueOnce({
      response: { status: 401 },
    });

    await useAuthStore.getState().hydrateFromStorage();

    expect(apiClient.getCurrentUser).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState().user).toBeNull();
    expect(useAuthStore.getState().isAuthenticated).toBe(false);
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_NODE_API_URL = originalNodeApiUrl;
  });
});
