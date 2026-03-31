import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';
import {
  ACCESS_TOKEN_KEY,
  AUTH_USER_STORAGE_KEY,
  PORTAL_USER_STORAGE_KEY,
} from './auth-storage';

// Mock axios before importing apiClient
vi.mock('axios', async () => {
  const mockAxiosInstance = {
    get: vi.fn(),
    post: vi.fn(),
    put: vi.fn(),
    delete: vi.fn(),
    interceptors: {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    },
  };

  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      post: vi.fn(),
    },
  };
});

// Mock the marketTransport dependency
vi.mock('./marketTransport', () => ({
  getMarketApiBase: vi.fn(() => 'https://market-api.test'),
}));

describe('APIClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    window.localStorage.clear();
    window.sessionStorage.clear();
    history.replaceState({}, '', '/login');
  });

  it('creates an axios instance with correct baseURL config', async () => {
    // Re-import to trigger constructor
    await import('./api');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
    );
  });

  it('sets up request and response interceptors', async () => {
    await import('./api');

    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
    expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
  });

  it('exports apiClient with expected methods', async () => {
    const { apiClient } = await import('./api');

    // Core authentication methods
    expect(typeof apiClient.register).toBe('function');
    expect(typeof apiClient.login).toBe('function');
    expect(typeof apiClient.logout).toBe('function');
    expect(typeof apiClient.getCurrentUser).toBe('function');

    // Risk analysis
    expect(typeof apiClient.getRiskAnalysis).toBe('function');

    // Admin methods
    expect(typeof apiClient.getDemoRequests).toBe('function');
    expect(typeof apiClient.getAdminStats).toBe('function');
  });

  it('marks passive profile checks to skip auth redirects', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({ data: { id: 'u_1', email: 'test@cerniq.io' } });

    await apiClient.getCurrentUser();

    expect(mockInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/profile'),
      expect.objectContaining({ skipAuthRedirect: true })
    );
  });

  it('does not attempt token refresh for skipAuthRedirect requests', async () => {
    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];
    const error = {
      response: { status: 401 },
      config: { skipAuthRedirect: true },
    };

    await expect(handleRejected(error)).rejects.toBe(error);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('clears persisted auth hints when refresh fails on a 401', async () => {
    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];
    const error = {
      response: { status: 401 },
      config: { headers: {} },
    };

    window.localStorage.setItem(
      AUTH_USER_STORAGE_KEY,
      JSON.stringify({ id: 'stale-user', email: 'stale@cerniq.io' }),
    );
    window.localStorage.setItem(PORTAL_USER_STORAGE_KEY, 'true');
    window.sessionStorage.setItem(ACCESS_TOKEN_KEY, 'stale-token');
    (axios.post as ReturnType<typeof vi.fn>).mockRejectedValueOnce(new Error('refresh failed'));

    await expect(handleRejected(error)).rejects.toBe(error);

    expect(window.localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(window.localStorage.getItem(PORTAL_USER_STORAGE_KEY)).toBeNull();
    expect(window.sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('exports apiClient as a singleton', async () => {
    const mod1 = await import('./api');
    const mod2 = await import('./api');

    expect(mod1.apiClient).toBe(mod2.apiClient);
  });
});
