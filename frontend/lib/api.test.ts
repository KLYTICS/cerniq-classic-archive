import { describe, it, expect, vi, beforeEach } from 'vitest';
import axios from 'axios';

const mockAxiosInstance = {
  delete: vi.fn(),
  get: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
};

// Mock axios before importing apiClient
vi.mock('axios', async () => {
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
    vi.unstubAllEnvs();
    mockAxiosInstance.delete.mockReset();
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.interceptors.request.use.mockReset();
    mockAxiosInstance.interceptors.response.use.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.put.mockReset();
    mockAxiosInstance.request.mockReset();
    sessionStorage.clear();
    localStorage.clear();
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
    expect(typeof apiClient.requestPasswordReset).toBe('function');
    expect(typeof apiClient.confirmPasswordReset).toBe('function');

    // Risk analysis
    expect(typeof apiClient.getRiskAnalysis).toBe('function');

    // Admin methods
    expect(typeof apiClient.getDemoRequests).toBe('function');
    expect(typeof apiClient.getAdminStats).toBe('function');
    expect(typeof apiClient.getAdminControlTowerSummary).toBe('function');
    expect(typeof apiClient.runAdminControlTowerAction).toBe('function');
    expect(typeof apiClient.getAdminOps).toBe('function');
    expect(typeof apiClient.getAdminPipeline).toBe('function');
    expect(typeof apiClient.runAdminPipelineAction).toBe('function');
    expect(typeof apiClient.getAdminRevenueMetrics).toBe('function');
    expect(typeof apiClient.getAdminAuditLogs).toBe('function');
    expect(typeof apiClient.getAdminLeads).toBe('function');
    expect(typeof apiClient.getAdminLeadMetrics).toBe('function');
    expect(typeof apiClient.updateAdminLead).toBe('function');
    expect(typeof apiClient.addAdminLeadNote).toBe('function');
    expect(typeof apiClient.markAdminReportSent).toBe('function');
    expect(typeof apiClient.getExitMetrics).toBe('function');
  });

  it('preserves portal return URLs in the magic-link login flow', async () => {
    const { buildLoginRedirectUrl } = await import('./api');

    expect(buildLoginRedirectUrl('/portal')).toBe(
      '/login?returnUrl=%2Fportal&mode=magic-link',
    );
    expect(buildLoginRedirectUrl('/portal/reports/job-1')).toBe(
      '/login?returnUrl=%2Fportal%2Freports%2Fjob-1&mode=magic-link',
    );
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

  it('unwraps enveloped profile responses', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'u_1', email: 'test@cerniq.io' },
      },
    });

    await expect(apiClient.getCurrentUser()).resolves.toEqual({
      id: 'u_1',
      email: 'test@cerniq.io',
    });
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

  it('retries strict-auth requests after a successful silent refresh', async () => {
    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];

    (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      data: { accessToken: 'fresh-token' },
    });
    mockInstance.request.mockResolvedValueOnce({ data: { items: [] } });

    await expect(
      handleRejected({
        response: { status: 401 },
        config: { headers: {}, url: '/api/alm/institutions' },
      })
    ).resolves.toEqual({ data: { items: [] } });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/auth/refresh',
      {},
      expect.objectContaining({ withCredentials: true })
    );
    expect(mockInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        _retry401: true,
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
      })
    );
  });

  it('redirects strict-auth requests to login when refresh fails', async () => {
    const originalLocation = window.location;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/alm',
        search: '?id=inst-1',
      },
    });

    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];

    (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 404,
      data: { message: 'Not found' },
    });

    const error = {
      response: { status: 401 },
      config: { headers: {}, url: '/api/alm/institutions' },
    };

    await expect(handleRejected(error)).rejects.toBe(error);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cerniq:navigate',
        detail: {
          href: '/login?returnUrl=%2Falm%3Fid%3Dinst-1',
          replace: true,
        },
      }),
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('exports apiClient as a singleton', async () => {
    const mod1 = await import('./api');
    const mod2 = await import('./api');

    expect(mod1.apiClient).toBe(mod2.apiClient);
  });

  it('routes email/password login through the backend even when Supabase envs are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { apiClient } = await import('./api');
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'analyst@example.com' } },
    });

    await apiClient.login('analyst@example.com', 'UltraSecret123!');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ email: 'analyst@example.com' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes email/password signup through the backend even when Supabase envs are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { apiClient } = await import('./api');
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { user: { id: 'user-2', email: 'newuser@example.com' } },
    });

    await apiClient.register('newuser@example.com', 'UltraSecret123!', 'New User');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({
        email: 'newuser@example.com',
        name: 'New User',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes password reset requests through the backend', async () => {
    const { apiClient } = await import('./api');
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { message: 'If that email exists, a reset link has been sent' },
    });

    await apiClient.requestPasswordReset('USER@Example.com');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/password-reset'),
      { email: 'user@example.com' },
    );
  });

  it('routes platform access failures through the client navigation event', async () => {
    const originalLocation = window.location;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/alm',
        search: '',
      },
    });

    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];

    const error = {
      response: {
        status: 403,
        data: { code: 'PLATFORM_ACCESS_REQUIRED' },
      },
      config: { headers: {}, url: '/api/alm/institutions' },
    };

    await expect(handleRejected(error)).rejects.toBe(error);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cerniq:navigate',
        detail: {
          href: '/access-required',
          replace: true,
        },
      }),
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });
});
