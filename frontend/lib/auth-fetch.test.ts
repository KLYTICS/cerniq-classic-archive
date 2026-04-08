import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  fetchWithAppAuth,
  getStoredAccessToken,
} from './auth-fetch';

const fetchMock = vi.fn();

describe('fetchWithAppAuth', () => {
  beforeEach(() => {
    fetchMock.mockReset();
    vi.stubGlobal('fetch', fetchMock);
    sessionStorage.clear();
    localStorage.clear();
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it('adds the bearer token to protected API requests', async () => {
    sessionStorage.setItem('cerniq_access_token', 'token-123');
    fetchMock.mockResolvedValue({ ok: true, status: 200 });

    await fetchWithAppAuth('/api/alm/inst-1/exports');

    const [, init] = fetchMock.mock.calls[0] as [string, RequestInit];
    expect(init.credentials).toBe('include');
    expect(new Headers(init.headers).get('Authorization')).toBe(
      'Bearer token-123',
    );
  });

  it('refreshes and retries once after a 401', async () => {
    sessionStorage.setItem('cerniq_access_token', 'token-123');
    fetchMock
      .mockResolvedValueOnce({ ok: false, status: 401 })
      .mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ success: true, data: { accessToken: 'token-456' } }),
      })
      .mockResolvedValueOnce({ ok: true, status: 200 });

    const response = await fetchWithAppAuth('/api/alm/inst-1/exports');

    expect(response.status).toBe(200);
    expect(fetchMock).toHaveBeenCalledTimes(3);

    const [firstUrl, firstInit] = fetchMock.mock.calls[0] as [string, RequestInit];
    const [refreshUrl] = fetchMock.mock.calls[1] as [string, RequestInit];
    const [retryUrl, retryInit] = fetchMock.mock.calls[2] as [string, RequestInit];

    expect(firstUrl).toBe('/api/alm/inst-1/exports');
    expect(new Headers(firstInit.headers).get('Authorization')).toBe(
      'Bearer token-123',
    );
    expect(refreshUrl).toBe('/api/auth/refresh');
    expect(retryUrl).toBe('/api/alm/inst-1/exports');
    expect(new Headers(retryInit.headers).get('Authorization')).toBe(
      'Bearer token-456',
    );
    expect(getStoredAccessToken()).toBe('token-456');
  });
});
