import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import axios from 'axios';

vi.mock('axios', () => {
  const buildInstance = () => {
    const instance = vi.fn() as unknown as {
      (...args: unknown[]): Promise<unknown>;
      get: ReturnType<typeof vi.fn>;
      post: ReturnType<typeof vi.fn>;
      put: ReturnType<typeof vi.fn>;
      patch: ReturnType<typeof vi.fn>;
      delete: ReturnType<typeof vi.fn>;
      interceptors: {
        request: { use: ReturnType<typeof vi.fn> };
        response: { use: ReturnType<typeof vi.fn> };
      };
    };

    instance.get = vi.fn();
    instance.post = vi.fn();
    instance.put = vi.fn();
    instance.patch = vi.fn();
    instance.delete = vi.fn();
    instance.interceptors = {
      request: { use: vi.fn() },
      response: { use: vi.fn() },
    };

    return instance;
  };

  return {
    default: {
      create: vi.fn(() => buildInstance()),
      post: vi.fn(),
    },
  };
});

vi.mock('./marketTransport', () => ({
  getMarketApiBase: vi.fn(() => 'https://market-api.test'),
}));

type MockAxiosInstance = ReturnType<(typeof axios)['create']>;

const originalSupabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
const originalSupabaseAnonKey = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

async function loadApiModule(env?: Record<string, string | undefined>) {
  vi.resetModules();

  if (env?.NEXT_PUBLIC_SUPABASE_URL === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_URL;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_URL = env.NEXT_PUBLIC_SUPABASE_URL;
  }

  if (env?.NEXT_PUBLIC_SUPABASE_ANON_KEY === undefined) {
    delete process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  } else {
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  }

  const mod = await import('./api');
  const mockAxios = (await import('axios')).default as unknown as {
    create: ReturnType<typeof vi.fn>;
    post: ReturnType<typeof vi.fn>;
  };
  const instance = mockAxios.create.mock.results.at(-1)?.value as MockAxiosInstance;

  return {
    ...mod,
    mockAxios,
    instance,
  };
}

function getInterceptors(instance: MockAxiosInstance) {
  const responseFulfilled = instance.interceptors.response.use.mock.calls[0]?.[0] as (response: unknown) => unknown;
  const requestHandler = instance.interceptors.request.use.mock.calls[0]?.[0] as (config: Record<string, unknown>) => Record<string, unknown>;
  const responseRejected = instance.interceptors.response.use.mock.calls[0]?.[1] as (error: unknown) => Promise<unknown>;

  return { requestHandler, responseFulfilled, responseRejected };
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.clearAllMocks();
    vi.useRealTimers();
    localStorage.clear();
    sessionStorage.clear();
    vi.stubGlobal('fetch', vi.fn());
    window.history.pushState({}, '', '/');
  });

  afterEach(() => {
    process.env.NEXT_PUBLIC_SUPABASE_URL = originalSupabaseUrl;
    process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY = originalSupabaseAnonKey;
  });

  it('creates a singleton axios client with request and response interceptors', async () => {
    const first = await loadApiModule();
    const second = await import('./api');

    expect(first.mockAxios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      }),
    );
    expect(first.instance.interceptors.request.use).toHaveBeenCalledTimes(1);
    expect(first.instance.interceptors.response.use).toHaveBeenCalledTimes(1);
    expect(first.apiClient).toBe(second.apiClient);
  });

  it('migrates a legacy session token into the current session key and attaches it to requests', async () => {
    sessionStorage.setItem('capex_access_token', 'legacy-token');

    const { instance } = await loadApiModule();
    const { requestHandler } = getInterceptors(instance);

    const config = requestHandler({ headers: {} });

    expect(config).toMatchObject({
      headers: { Authorization: 'Bearer legacy-token' },
    });
    expect(sessionStorage.getItem('cerniq_access_token')).toBe('legacy-token');
    expect(sessionStorage.getItem('capex_access_token')).toBeNull();
  });

  it('creates request headers when auth is attached to a config without headers', async () => {
    sessionStorage.setItem('cerniq_access_token', 'fresh-token');

    const { instance } = await loadApiModule();
    const { requestHandler } = getInterceptors(instance);

    const config = requestHandler({});

    expect(config).toMatchObject({
      headers: { Authorization: 'Bearer fresh-token' },
    });
  });

  it('clears stale durable auth artifacts instead of reviving them into the active session', async () => {
    localStorage.setItem('capex_access_token', 'durable-legacy-token');
    localStorage.setItem('cerniq_access_token', 'durable-token');
    localStorage.setItem('cerniq_auth_user', '{"id":"user-1"}');
    localStorage.setItem('capex_auth_user', '{"id":"legacy-user"}');
    localStorage.setItem('admin_key', 'legacy-admin');

    const { instance } = await loadApiModule();
    const { requestHandler } = getInterceptors(instance);

    const config = requestHandler({ headers: {} });

    expect(config).toEqual({ headers: {} });
    expect(sessionStorage.getItem('cerniq_access_token')).toBeNull();
    expect(localStorage.getItem('capex_access_token')).toBeNull();
    expect(localStorage.getItem('cerniq_access_token')).toBeNull();
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
    expect(localStorage.getItem('capex_auth_user')).toBeNull();
    expect(localStorage.getItem('admin_key')).toBeNull();
  });

  it('refreshes expired sessions once and replays the original request', async () => {
    const { instance, mockAxios } = await loadApiModule();
    const { responseRejected } = getInterceptors(instance);

    mockAxios.post.mockResolvedValueOnce({ data: { accessToken: 'fresh-token' } });
    instance.mockResolvedValueOnce({ data: { ok: true } });

    const result = await responseRejected({
      response: { status: 401 },
      config: { headers: {} },
    });

    expect(mockAxios.post).toHaveBeenCalledWith('/api/auth/refresh', {}, { withCredentials: true });
    expect(instance).toHaveBeenCalledWith(
      expect.objectContaining({
        _retry401: true,
        headers: expect.objectContaining({
          Authorization: 'Bearer fresh-token',
        }),
      }),
    );
    expect(sessionStorage.getItem('cerniq_access_token')).toBe('fresh-token');
    expect(result).toEqual({ data: { ok: true } });
  });

  it('returns fulfilled responses untouched and rejects non-401 failures', async () => {
    const { instance } = await loadApiModule();
    const { responseFulfilled, responseRejected } = getInterceptors(instance);
    const response = { data: { ok: true } };
    const error = { response: { status: 500 }, config: { headers: {} } };

    expect(responseFulfilled(response)).toBe(response);
    await expect(responseRejected(error)).rejects.toBe(error);
  });

  it('clears session state immediately for passive 401 checks', async () => {
    sessionStorage.setItem('cerniq_access_token', 'stale-token');
    sessionStorage.setItem('cerniq_admin_key', 'admin-token');
    localStorage.setItem('cerniq_auth_user', '{"id":"u_401"}');

    const { instance, mockAxios } = await loadApiModule();
    const { responseRejected } = getInterceptors(instance);
    const error = {
      response: { status: 401 },
      config: { skipAuthRedirect: true },
    };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockAxios.post).not.toHaveBeenCalled();
    expect(sessionStorage.getItem('cerniq_access_token')).toBeNull();
    expect(sessionStorage.getItem('cerniq_admin_key')).toBeNull();
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
  });

  it('clears auth and rejects without redirect when refresh fails on login routes', async () => {
    sessionStorage.setItem('cerniq_access_token', 'stale-token');
    window.history.pushState({}, '', '/login');

    const { instance, mockAxios } = await loadApiModule();
    const { responseRejected } = getInterceptors(instance);
    mockAxios.post.mockRejectedValueOnce(new Error('refresh unavailable'));

    const error = {
      response: { status: 401 },
      config: { headers: {} },
    };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(sessionStorage.getItem('cerniq_access_token')).toBeNull();
  });

  it('treats portal login as a non-redirecting auth route when refresh fails', async () => {
    sessionStorage.setItem('cerniq_access_token', 'stale-token');
    window.history.pushState({}, '', '/portal/login');

    const { instance, mockAxios } = await loadApiModule();
    const { responseRejected } = getInterceptors(instance);
    mockAxios.post.mockRejectedValueOnce(new Error('refresh unavailable'));

    const error = {
      response: { status: 401 },
      config: { headers: {} },
    };

    await expect(responseRejected(error)).rejects.toBe(error);
    expect(mockAxios.post).toHaveBeenCalledTimes(1);
    expect(window.location.pathname).toBe('/portal/login');
  });

  it('uses the node auth endpoints when Supabase is not configured', async () => {
    const { apiClient, instance } = await loadApiModule();
    sessionStorage.setItem('cerniq_access_token', 'stale-token');
    sessionStorage.setItem('cerniq_admin_key', 'admin-token');
    localStorage.setItem('cerniq_auth_user', '{"id":"u_1"}');

    instance.post
      .mockResolvedValueOnce({ data: { access_token: 'register-token', user: { id: '1', email: 'ana@cerniq.io' } } })
      .mockResolvedValueOnce({ data: { access_token: 'login-token', user: { id: '1', email: 'ana@cerniq.io' } } })
      .mockResolvedValueOnce({ data: { access_token: 'refreshed' } })
      .mockRejectedValueOnce(new Error('server unavailable'));
    instance.put.mockResolvedValueOnce({ data: { updated: true } });
    instance.get.mockResolvedValueOnce({ data: { id: 'u_1', email: 'ana@cerniq.io' } });

    const registered = await apiClient.register('ana@cerniq.io', 'StrongP@ss1', 'Ana');
    const loggedIn = await apiClient.login('ana@cerniq.io', 'StrongP@ss1');
    const profile = await apiClient.getCurrentUser();
    const changed = await apiClient.changePassword('StrongP@ss1', 'EvenStrongerP@ss2');
    const refreshed = await apiClient.refreshTokens();
    await apiClient.logout();

    expect(registered.access_token).toBe('register-token');
    expect(loggedIn.access_token).toBe('login-token');
    expect(profile).toEqual({ id: 'u_1', email: 'ana@cerniq.io' });
    expect(changed).toEqual({ updated: true });
    expect(refreshed).toEqual({ access_token: 'refreshed' });
    expect(instance.post).toHaveBeenNthCalledWith(1, '/api/auth/register', {
      email: 'ana@cerniq.io',
      password: 'StrongP@ss1',
      name: 'Ana',
    });
    expect(instance.post).toHaveBeenNthCalledWith(2, '/api/auth/login', {
      email: 'ana@cerniq.io',
      password: 'StrongP@ss1',
    });
    expect(instance.get).toHaveBeenCalledWith('/api/auth/profile', { skipAuthRedirect: true });
    expect(instance.put).toHaveBeenCalledWith('/api/auth/password', {
      currentPassword: 'StrongP@ss1',
      newPassword: 'EvenStrongerP@ss2',
    });
    expect(instance.post).toHaveBeenLastCalledWith('/api/auth/logout');
    expect(sessionStorage.getItem('cerniq_access_token')).toBeNull();
    expect(sessionStorage.getItem('cerniq_admin_key')).toBeNull();
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
  });

  it('supports Supabase signup and login flows when configured', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          session: { access_token: 'supabase-register-token' },
          user: {
            id: 'sup-1',
            email: 'quant@cerniq.io',
            user_metadata: { name: 'Quant User' },
          },
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          access_token: 'supabase-login-token',
          user: {
            id: 'sup-1',
            email: 'quant@cerniq.io',
            user_metadata: { name: 'Quant User' },
          },
        }),
      } as Response);

    const { apiClient } = await loadApiModule({
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });

    const registered = await apiClient.register('quant@cerniq.io', 'QStrongP@ss1', 'Quant User');
    const loggedIn = await apiClient.login('quant@cerniq.io', 'QStrongP@ss1');

    expect(fetchMock).toHaveBeenNthCalledWith(
      1,
      'https://supabase.test/auth/v1/signup',
      expect.objectContaining({
        method: 'POST',
        headers: expect.objectContaining({
          apikey: 'anon-key',
          Authorization: 'Bearer anon-key',
        }),
      }),
    );
    expect(fetchMock).toHaveBeenNthCalledWith(
      2,
      'https://supabase.test/auth/v1/token?grant_type=password',
      expect.objectContaining({
        method: 'POST',
      }),
    );
    expect(registered.user).toEqual({
      id: 'sup-1',
      email: 'quant@cerniq.io',
      name: 'Quant User',
    });
    expect(loggedIn.access_token).toBe('supabase-login-token');
    expect(sessionStorage.getItem('cerniq_access_token')).toBe('supabase-login-token');
  });

  it('falls back to default Supabase error text and user identity fields when responses are sparse', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {},
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: true,
        json: async () => ({
          user: {},
        }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({}),
      } as Response);

    const { apiClient } = await loadApiModule({
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });

    await expect(
      apiClient.register('sparse@cerniq.io', 'QStrongP@ss1', 'Sparse User'),
    ).resolves.toEqual({
      access_token: '',
      user: {
        id: 'sparse@cerniq.io',
        email: 'sparse@cerniq.io',
        name: 'Sparse User',
      },
    });

    await expect(
      apiClient.login('sparse@cerniq.io', 'QStrongP@ss1'),
    ).resolves.toEqual({
      access_token: undefined,
      user: {
        id: 'sparse@cerniq.io',
        email: 'sparse@cerniq.io',
        name: undefined,
      },
    });

    await expect(
      apiClient.register('blocked@cerniq.io', 'QStrongP@ss1', 'Blocked User'),
    ).rejects.toThrow('Registration failed');
    await expect(
      apiClient.login('blocked@cerniq.io', 'QStrongP@ss1'),
    ).rejects.toThrow('Login failed');
  });

  it('surfaces Supabase auth errors during register and login', async () => {
    const fetchMock = vi.mocked(fetch);
    fetchMock
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ error_description: 'Signup blocked' }),
      } as Response)
      .mockResolvedValueOnce({
        ok: false,
        json: async () => ({ msg: 'Login blocked' }),
      } as Response);

    const { apiClient } = await loadApiModule({
      NEXT_PUBLIC_SUPABASE_URL: 'https://supabase.test',
      NEXT_PUBLIC_SUPABASE_ANON_KEY: 'anon-key',
    });

    await expect(
      apiClient.register('quant@cerniq.io', 'QStrongP@ss1', 'Quant User'),
    ).rejects.toThrow('Signup blocked');
    await expect(
      apiClient.login('quant@cerniq.io', 'QStrongP@ss1'),
    ).rejects.toThrow('Login blocked');
  });

  it('normalizes demo requests and falls back cleanly on lead-pipeline failures', async () => {
    const { apiClient, instance } = await loadApiModule();

    instance.post
      .mockRejectedValueOnce(new Error('lead service down'))
      .mockResolvedValueOnce({ data: { queued: true } });

    const result = await apiClient.submitDemoRequest({
      email: 'cfo@coop.pr',
      name: 'CFO',
      institutionName: 'Coop Capital',
      institutionType: 'bank',
      company: 'Backup Name',
      message: 'Need a down-day stress pack',
    });

    expect(instance.post).toHaveBeenNthCalledWith(1, '/api/v1/leads/submit', {
      name: 'CFO',
      email: 'cfo@coop.pr',
      institutionName: 'Coop Capital',
      institutionType: 'community_bank',
      message: 'Need a down-day stress pack',
      source: 'landing_page',
    });
    expect(instance.post).toHaveBeenNthCalledWith(2, '/api/demo-request', expect.objectContaining({
      institutionName: 'Coop Capital',
      institutionType: 'community_bank',
    }));
    expect(result).toEqual({ queued: true });
  });

  it('normalizes family-office demo requests into supported legacy payloads', async () => {
    const { apiClient, instance } = await loadApiModule();

    instance.post
      .mockResolvedValueOnce({ data: { accepted: true } })
      .mockResolvedValueOnce({ data: { queued: true } });

    await apiClient.submitDemoRequest({
      email: 'desk@cerniq.io',
      company: 'Desk Family Office',
      institutionType: 'family_office',
      message: 'Need operator reporting',
    });

    expect(instance.post).toHaveBeenNthCalledWith(1, '/api/v1/leads/submit', {
      name: '',
      email: 'desk@cerniq.io',
      institutionName: 'Desk Family Office',
      institutionType: 'other',
      message: 'Need operator reporting',
      source: 'landing_page',
    });
    expect(instance.post).toHaveBeenNthCalledWith(
      2,
      '/api/demo-request',
      expect.objectContaining({
        institutionName: 'Desk Family Office',
        institutionType: 'other',
      }),
    );
  });

  it('handles waitlist and portfolio fallbacks without surfacing transport noise', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { apiClient, instance } = await loadApiModule();

    instance.post
      .mockRejectedValueOnce(new Error('new waitlist route offline'))
      .mockResolvedValueOnce({ data: { joined: true } })
      .mockRejectedValueOnce(new Error('node portfolios offline'))
      .mockResolvedValueOnce({ data: { id: 'portfolio-1' } })
      .mockRejectedValueOnce(new Error('node positions offline'))
      .mockRejectedValueOnce(new Error('legacy positions offline'));

    const waitlist = await apiClient.joinWaitlist({ email: 'wait@cerniq.io' });
    const portfolio = await apiClient.createPortfolio('u_1', { name: 'Down Day Book' });
    const position = await apiClient.addPosition('portfolio-1', 'u_1', { ticker: 'TLT', quantity: 10 });

    expect(waitlist).toEqual({ joined: true });
    expect(portfolio).toEqual({ id: 'portfolio-1' });
    expect(position).toBeNull();
    expect(instance.post).toHaveBeenNthCalledWith(1, '/api/waitlist', { email: 'wait@cerniq.io' });
    expect(instance.post).toHaveBeenNthCalledWith(2, '/waitlist', { email: 'wait@cerniq.io' });
    expect(instance.post).toHaveBeenNthCalledWith(3, '/api/portfolios', { name: 'Down Day Book' });
    expect(instance.post).toHaveBeenNthCalledWith(4, '/portfolios', { name: 'Down Day Book' });
    expect(errorSpy).toHaveBeenCalledTimes(1);
  });

  it('covers direct upload, risk, market wrapper, and analysis routes', async () => {
    const errorSpy = vi.spyOn(console, 'error').mockImplementation(() => {});
    const { apiClient, instance } = await loadApiModule();
    const file = new File(['alpha'], 'alpha.csv', { type: 'text/csv' });

    instance.get
      .mockResolvedValueOnce({ data: { id: 'risk-1' } })
      .mockResolvedValueOnce({ data: { price: 420.15 } })
      .mockResolvedValueOnce({ data: { profile: 'quality' } });
    instance.post
      .mockResolvedValueOnce({ data: { uploaded: true } })
      .mockResolvedValueOnce({ data: { analyzed: true } })
      .mockResolvedValueOnce({ data: { report: 'queued' } });
    instance.get.mockRejectedValueOnce(new Error('chart unavailable'));

    expect(await apiClient.getRiskAnalysis('portfolio-1')).toEqual({ id: 'risk-1' });
    expect(await apiClient.getQuote('msft')).toMatchObject({
      ticker: 'MSFT',
      price: 420.15,
      name: 'MSFT',
    });
    expect(await apiClient.getFundamentals('nvda')).toEqual({ profile: 'quality' });
    expect(await apiClient.uploadFile(file)).toEqual({ uploaded: true });
    expect(await apiClient.runAnalysis({ scope: 'desk' })).toEqual({ analyzed: true });
    expect(await apiClient.generateReport({ desk: 'stress' })).toEqual({ report: 'queued' });
    expect(await apiClient.getTechnicalChart('AAPL', '6M', 'rsi')).toBeNull();
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to fetch technical chart',
      expect.any(Error),
    );
  });

  it('covers success and fallback branches for workspace, portfolio, and ALM helpers', async () => {
    const { apiClient, instance } = await loadApiModule();

    instance.post
      .mockResolvedValueOnce({ data: { joined: true } })
      .mockResolvedValueOnce({ data: { id: 'institution-1' } })
      .mockResolvedValueOnce({ data: { id: 'portfolio-primary' } })
      .mockRejectedValueOnce(new Error('primary portfolio offline'))
      .mockResolvedValueOnce({ data: { id: 'portfolio-fallback' } })
      .mockResolvedValueOnce({ data: { id: 'position-primary' } })
      .mockRejectedValueOnce(new Error('primary position offline'))
      .mockResolvedValueOnce({ data: { id: 'position-fallback' } })
      .mockResolvedValueOnce({ data: { institutionId: 'inst-1', severe: false } })
      .mockResolvedValueOnce({ data: { success: true, institutionId: 'inst-seeded' } });
    instance.get
      .mockResolvedValueOnce({ data: { institutionId: 'inst-1', lcr: 160 } })
      .mockResolvedValueOnce({ data: { institutionId: 'inst-1', durationGap: 0.8 } })
      .mockResolvedValueOnce({ data: { analytics: true } });

    expect(await apiClient.joinWaitlist({ email: 'wait@cerniq.io' })).toEqual({ joined: true });
    expect(
      await apiClient.createInstitution({
        name: 'Desk CU',
        type: 'credit_union',
        totalAssets: 1000,
        reportingDate: '2026-03-29',
        workspaceId: 'ws-1',
      }),
    ).toEqual({ id: 'institution-1' });
    expect(await apiClient.createPortfolio('u_1', { name: 'Primary Book' })).toEqual({
      id: 'portfolio-primary',
    });
    expect(await apiClient.createPortfolio('u_1', { name: 'Fallback Book' })).toEqual({
      id: 'portfolio-fallback',
    });
    expect(await apiClient.addPosition('p-1', 'u_1', { ticker: 'TLT', quantity: 10 })).toEqual({
      id: 'position-primary',
    });
    expect(await apiClient.addPosition('p-2', 'u_1', { ticker: 'IEF', quantity: 5 })).toEqual({
      id: 'position-fallback',
    });
    expect(await apiClient.getLiquidityPosition('inst-1')).toEqual({
      institutionId: 'inst-1',
      lcr: 160,
    });
    expect(await apiClient.getDurationGap('inst-1')).toEqual({
      institutionId: 'inst-1',
      durationGap: 0.8,
    });
    expect(await apiClient.runStressTest('inst-1', { paths: 50 })).toEqual({
      institutionId: 'inst-1',
      severe: false,
    });
    expect(await apiClient.seedDemoInstitution('ws-1', 'cooperativa')).toEqual({
      success: true,
      institutionId: 'inst-seeded',
    });
    expect(await apiClient.getNodePortfolioAnalytics('portfolio-1')).toEqual({
      analytics: true,
    });
  });

  it('covers valuation and node wrapper helpers for unknown tickers and mock portfolios', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T10:00:00Z'));

    const { apiClient } = await loadApiModule();
    const valuation = await apiClient.getNodeValuation('ZZZX');
    const correlation = await apiClient.getNodeCorrelation(['AAPL', 'MSFT']);
    const componentVaR = await apiClient.getNodeComponentVaR([
      { ticker: 'CASH', quantity: 0, price: 100 },
    ]);
    const volatility = await apiClient.getNodeVolatilityForecast('NVDA', 5);
    const portfolios = await apiClient.getNodePortfolios();

    expect(valuation.ticker).toBe('ZZZX');
    expect(valuation.current_price).toBeGreaterThan(0);
    expect(correlation.matrix).toHaveLength(2);
    expect(componentVaR.components).toHaveLength(1);
    expect(volatility.forecast).toHaveLength(5);
    expect(portfolios[0].positions).toBeDefined();
  });

  it('keeps quant helper outputs stable under non-ideal inputs', async () => {
    vi.spyOn(Math, 'random').mockReturnValue(0.5);
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T10:00:00Z'));

    const { apiClient } = await loadApiModule();

    const volatility = await apiClient.getVolatilityForecast('NVDA', 0);
    const correlation = await apiClient.calculateCorrelation(['AAPL', 'MSFT', 'TLT']);
    const zeroExposureVaR = await apiClient.calculateComponentVaR([
      { ticker: 'CASH', quantity: 0, price: 100 },
      { ticker: 'HEDGE', quantity: 0, currentPrice: 50 },
    ]);
    const hedgedVaR = await apiClient.calculateComponentVaR([
      { ticker: 'SPY', quantity: 100, price: 500 },
      { ticker: 'SH', quantity: -100, price: 500 },
    ]);

    expect(volatility.forecast).toHaveLength(30);
    expect(correlation.matrix[0][0]).toBe(1);
    expect(correlation.matrix[0][1]).toBe(correlation.matrix[1][0]);
    expect(zeroExposureVaR.portfolioVaR).toBe(0);
    expect(zeroExposureVaR.components.every((component) => component.riskContribution === 0)).toBe(true);
    expect(hedgedVaR.portfolioValue).toBe(0);
    expect(hedgedVaR.portfolioVaR).toBeGreaterThan(0);
    expect(hedgedVaR.components.every((component) => Number.isFinite(component.marginalVaR))).toBe(true);
    expect(
      hedgedVaR.components.reduce((sum, component) => sum + component.riskContribution, 0),
    ).toBeCloseTo(100, 6);
  });

  it('returns resilient ALM demo fallbacks when enterprise services are unavailable', async () => {
    const { apiClient, instance } = await loadApiModule();

    instance.get
      .mockRejectedValueOnce(new Error('institutions down'))
      .mockRejectedValueOnce(new Error('institution down'))
      .mockRejectedValueOnce(new Error('summary down'))
      .mockRejectedValueOnce(new Error('nii down'))
      .mockRejectedValueOnce(new Error('liquidity down'))
      .mockRejectedValueOnce(new Error('duration down'));
    instance.post
      .mockRejectedValueOnce(new Error('stress down'))
      .mockRejectedValueOnce(new Error('seed down'));

    const institutions = await apiClient.getInstitutions('ws-1');
    const institution = await apiClient.getInstitution('inst-1');
    const summary = await apiClient.getALMSummary('inst-1');
    const sensitivity = await apiClient.getNIISensitivity('inst-1');
    const liquidity = await apiClient.getLiquidityPosition('inst-1');
    const durationGap = await apiClient.getDurationGap('inst-1');
    const stress = await apiClient.runStressTest('inst-1', { paths: 250, horizon: 6 });
    const seeded = await apiClient.seedDemoInstitution('ws-1', 'cooperativa');

    expect(institutions[0]).toMatchObject({ id: 'demo-bank-id' });
    expect(institution.balanceSheetItems).toHaveLength(14);
    expect(summary.durationGap.durationGap).toBe(1.8);
    expect(sensitivity.scenarios).toHaveLength(5);
    expect(liquidity.status).toBe('compliant');
    expect(durationGap.riskProfile).toBe('asset-sensitive');
    expect(stress.regulatory.scenarios).toHaveLength(4);
    expect(seeded).toEqual({
      success: true,
      institutionId: 'demo-bank-id',
      institution: {
        id: 'demo-bank-id',
        name: 'FirstBank Puerto Rico',
        type: 'cooperativa',
        totalAssets: 18900,
        currency: 'USD',
      },
    });
  });

  it('covers market-insight, institution, scenario, alert, forward-simulation, and report fallback branches', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T15:45:00Z'));

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const createElementSpy = vi.spyOn(document, 'createElement');

    const { apiClient, instance } = await loadApiModule();

    instance.get
      .mockResolvedValueOnce({ data: [{ id: 'inst-raw' }] })
      .mockResolvedValueOnce({ data: null })
      .mockResolvedValueOnce({
        data: new Uint8Array([1, 2, 3]),
        headers: {},
      })
      .mockResolvedValueOnce({ data: { items: ['scenario-1'] } })
      .mockResolvedValueOnce({ data: { alerts: [] } });
    instance.post
      .mockResolvedValueOnce({ data: { ok: true } });

    const marketInsights = await apiClient.getInsights();
    const tickerInsights = await apiClient.getInsights('aapl');
    const rawInstitutions = await apiClient.getInstitutions();
    const emptyInstitutions = await apiClient.getInstitutions('ws-1');
    await apiClient.downloadALMReport('inst-1');
    const scenarios = await apiClient.listScenarios('inst-1');
    const forward = await apiClient.runForwardSimulation('inst-1');
    const alerts = await apiClient.getAlerts('inst-1');

    const anchors = createElementSpy.mock.results
      .map((result) => result.value)
      .filter((value): value is HTMLAnchorElement => value instanceof HTMLAnchorElement);

    expect(marketInsights.insights[0].title).toContain('MARKET');
    expect(tickerInsights.insights[0].title).toContain('AAPL');
    expect(rawInstitutions).toEqual([{ id: 'inst-raw' }]);
    expect(emptyInstitutions).toEqual([]);
    expect(anchors.at(-1)?.download).toBe('alm-report-inst-1.pdf');
    expect(scenarios).toEqual({ items: ['scenario-1'] });
    expect(forward).toEqual({ ok: true });
    expect(alerts).toEqual({ alerts: [] });
    expect(instance.get).toHaveBeenCalledWith('/api/alm/institutions');
    expect(instance.get).toHaveBeenCalledWith('/api/alm/inst-1/scenarios');
    expect(instance.get).toHaveBeenCalledWith('/api/alm/inst-1/alerts');
    expect(instance.post).toHaveBeenCalledWith('/api/alm/inst-1/forward-simulation', {});
    expect(createObjectUrlSpy).toHaveBeenCalled();
    expect(revokeObjectUrlSpy).toHaveBeenCalled();
  });

  it('forwards enterprise routes to the expected API endpoints', async () => {
    const { apiClient, instance } = await loadApiModule();
    const file = new File(['ticker,amount'], 'balances.csv', { type: 'text/csv' });

    const cases = [
      ['listApiKeys', () => apiClient.listApiKeys(), 'get', '/api/auth/api-keys'],
      ['createApiKey', () => apiClient.createApiKey('Desk Key', 30), 'post', '/api/auth/api-keys'],
      ['revokeApiKey', () => apiClient.revokeApiKey('key-1'), 'post', '/api/auth/api-keys/key-1/revoke'],
      ['getPortalSettings', () => apiClient.getPortalSettings(), 'get', '/api/portal/settings'],
      ['invitePortalUser', () => apiClient.invitePortalUser({ email: 'ops@cerniq.io', role: 'ANALYST', name: 'Ops' }), 'post', '/api/portal/invite'],
      ['getDemoRequests', () => apiClient.getDemoRequests(), 'get', '/api/admin/demo-requests'],
      ['getAdminStats', () => apiClient.getAdminStats(), 'get', '/api/admin/stats'],
      ['resetDemoData', () => apiClient.resetDemoData(), 'delete', '/api/admin/demo-data'],
      ['getHistoricalPrices', () => apiClient.getHistoricalPrices('AAPL', '2026-01-01', '2026-03-01'), 'get', 'https://market-api.test/history/AAPL'],
      ['getMarketData', () => apiClient.getMarketData(['AAPL', 'MSFT'], '2026-01-01', '2026-03-01'), 'post', '/market-data'],
      ['createWorkspace', () => apiClient.createWorkspace('u_1', { name: 'Desk', company_name: 'Cerniq' }), 'post', '/api/workspaces'],
      ['getNodeQuote', () => apiClient.getNodeQuote('AAPL'), 'get', 'https://market-api.test/quote/AAPL'],
      ['getNodeHistory', () => apiClient.getNodeHistory('AAPL', '2026-01-01', '2026-02-01'), 'get', 'https://market-api.test/history/AAPL'],
      ['getNodeFundamentals', () => apiClient.getNodeFundamentals('AAPL'), 'get', 'https://market-api.test/fundamentals/AAPL'],
      ['searchNodeTickers', () => apiClient.searchNodeTickers('bank', 'stock'), 'get', 'https://market-api.test/search'],
      ['getNodeInstrument', () => apiClient.getNodeInstrument('AAPL'), 'get', 'https://market-api.test/instrument/AAPL'],
      ['getNodeNews', () => apiClient.getNodeNews('AAPL', 5), 'get', 'https://market-api.test/news/AAPL'],
      ['getNodeSnapshot', () => apiClient.getNodeSnapshot('AAPL', 3), 'get', 'https://market-api.test/snapshot/AAPL'],
      ['getNodeInsights', () => apiClient.getNodeInsights('AAPL'), 'get', 'https://market-api.test/insights'],
      ['getNodeTechnicalChart', () => apiClient.getNodeTechnicalChart('AAPL', '6M', 'rsi'), 'get', '/api/charts/technical/AAPL'],
      ['getNodeOptionsChain', () => apiClient.getNodeOptionsChain('AAPL', '2026-06-19'), 'get', '/api/options/chain/AAPL'],
      ['calculateNodeGreeks', () => apiClient.calculateNodeGreeks({ underlying: 100, strike: 95, timeToExpiry: 0.25, riskFreeRate: 0.04, volatility: 0.2, optionType: 'call' }), 'post', '/api/options/calculate'],
      ['getAlmDemoAnalysis', () => apiClient.getAlmDemoAnalysis(), 'get', '/api/alm/demo-analysis'],
      ['getAlmDemoBalanceSheet', () => apiClient.getAlmDemoBalanceSheet(), 'get', '/api/alm/demo-balance-sheet'],
      ['postAlmFullAnalysis', () => apiClient.postAlmFullAnalysis({ assets: [] }, [100, -100], { lcr: 120 }), 'post', '/api/alm/full-analysis'],
      ['importBalanceSheetItems', () => apiClient.importBalanceSheetItems('inst-1', [{ balance: 100 }]), 'post', '/api/alm/institutions/inst-1/balance-sheet-items'],
      ['uploadBalanceSheetCSV', () => apiClient.uploadBalanceSheetCSV('inst-1', file, true), 'post', '/api/alm/institutions/inst-1/upload-csv?dryRun=true'],
      ['runCustomStressTest', () => apiClient.runCustomStressTest('inst-1', { rateShockBps: 200, depositRunoffPct: 8, defaultRateIncreasePct: 2, energyCostShockPct: 5 }), 'post', '/api/alm/inst-1/stress/custom'],
      ['getComplianceCalendar', () => apiClient.getComplianceCalendar('inst-1'), 'get', '/api/alm/inst-1/calendar'],
      ['askAdvisor', () => apiClient.askAdvisor('inst-1', 'What breaks first?'), 'post', '/api/alm/inst-1/advisor'],
      ['getMyWorkspaces', () => apiClient.getMyWorkspaces(), 'get', '/api/workspaces'],
      ['createMyWorkspace', () => apiClient.createMyWorkspace('Desk 2'), 'post', '/api/workspaces'],
      ['analyzeExpenses', () => apiClient.analyzeExpenses('org-1'), 'post', '/api/expenses/org-1/analyze'],
      ['uploadExpenseCSV', () => apiClient.uploadExpenseCSV('org-1', file), 'post', '/api/expenses/org-1/upload'],
      ['getProspects', () => apiClient.getProspects('qualified'), 'get', '/api/admin/prospects?stage=qualified'],
      ['createProspect', () => apiClient.createProspect({ name: 'Desk Lead' }), 'post', '/api/admin/prospects'],
      ['updateProspect', () => apiClient.updateProspect('pros-1', { stage: 'won' }), 'patch', '/api/admin/prospects/pros-1'],
      ['deleteProspect', () => apiClient.deleteProspect('pros-1'), 'delete', '/api/admin/prospects/pros-1'],
      ['seedProspects', () => apiClient.seedProspects(), 'post', '/api/admin/seed-prospects'],
      ['saveScenario', () => apiClient.saveScenario({ institutionId: 'inst-1', name: 'Crash', scenarioType: 'market', parameters: { rateShockBps: -200, depositRunoffPct: 10, defaultRateIncreasePct: 4, energyCostShockPct: 6 } }), 'post', '/api/alm/scenarios/save'],
      ['listScenarios', () => apiClient.listScenarios('inst-1', { page: 2, tag: 'down-day' }), 'get', '/api/alm/inst-1/scenarios?page=2&tag=down-day'],
      ['getScenario', () => apiClient.getScenario('scn-1'), 'get', '/api/alm/scenarios/scn-1'],
      ['compareScenarios', () => apiClient.compareScenarios(['scn-1', 'scn-2']), 'post', '/api/alm/scenarios/compare'],
      ['duplicateScenario', () => apiClient.duplicateScenario('scn-1', 'Crash Copy'), 'post', '/api/alm/scenarios/scn-1/duplicate'],
      ['deleteScenario', () => apiClient.deleteScenario('scn-1'), 'post', '/api/alm/scenarios/scn-1/delete'],
      ['getYieldCurveAnalysis', () => apiClient.getYieldCurveAnalysis('inst-1'), 'get', '/api/alm/inst-1/yield-curve-analysis'],
      ['applyYieldCurveShocks', () => apiClient.applyYieldCurveShocks({ shockType: 'flattening' }), 'post', '/api/alm/yield-curve/shocks'],
      ['saveCustomYieldCurve', () => apiClient.saveCustomYieldCurve({ institutionId: 'inst-1', name: 'Desk Curve', tenors: [{ tenor: 1, rate: 0.05 }] }), 'post', '/api/alm/yield-curve/custom'],
      ['getCECLAnalysis', () => apiClient.getCECLAnalysis('inst-1'), 'get', '/api/alm/inst-1/cecl'],
      ['importLoanSegments', () => apiClient.importLoanSegments('inst-1', [{ segment: 'CRE' }]), 'post', '/api/alm/inst-1/cecl/segments'],
      ['getCECLForecast', () => apiClient.getCECLForecast('inst-1'), 'get', '/api/alm/inst-1/cecl/forecast'],
      ['runWARMCalculation', () => apiClient.runWARMCalculation({ segments: [{ segmentName: 'CRE', balance: 100, weightedAvgMaturity: 3, historicalLossRate: 0.01 }] }), 'post', '/api/alm/cecl/warm'],
      ['getFTPAnalysis', () => apiClient.getFTPAnalysis('inst-1'), 'get', '/api/alm/inst-1/ftp'],
      ['getFTPSegments', () => apiClient.getFTPSegments('inst-1'), 'get', '/api/alm/inst-1/ftp/segments'],
      ['runCustomFTP', () => apiClient.runCustomFTP('inst-1', { spreadAdjBps: 15 }), 'post', '/api/alm/inst-1/ftp/custom'],
      ['getAdvancedLiquidity', () => apiClient.getAdvancedLiquidity('inst-1'), 'get', '/api/alm/inst-1/liquidity-advanced'],
      ['getConcentrationAnalysis', () => apiClient.getConcentrationAnalysis('inst-1'), 'get', '/api/alm/inst-1/concentration'],
      ['pullNCUAData', () => apiClient.pullNCUAData('12345'), 'post', '/api/alm/ncua/pull'],
      ['getAdvisorNarrative', () => apiClient.getAdvisorNarrative('inst-1', 'es'), 'get', '/api/alm/inst-1/advisor/narrative?lang=es'],
      ['getHealthScore', () => apiClient.getHealthScore('inst-1'), 'get', '/api/alm/inst-1/advisor/health-score'],
      ['getStressPack', () => apiClient.getStressPack('inst-1'), 'get', '/api/alm/inst-1/stress-pack'],
      ['getIRRPolicyDashboard', () => apiClient.getIRRPolicyDashboard('inst-1'), 'get', '/api/alm/inst-1/irr-policy'],
      ['getIRRPolicyLimits', () => apiClient.getIRRPolicyLimits('inst-1'), 'get', '/api/alm/inst-1/irr-policy/limits'],
      ['saveIRRPolicyLimits', () => apiClient.saveIRRPolicyLimits('inst-1', [{ name: 'EVE', value: 15 }]), 'post', '/api/alm/inst-1/irr-policy/limits'],
      ['getDepositBetaBenchmark', () => apiClient.getDepositBetaBenchmark('inst-1'), 'get', '/api/alm/inst-1/deposit-beta/benchmark'],
      ['getRepricingGap', () => apiClient.getRepricingGap('inst-1'), 'get', '/api/alm/inst-1/repricing-gap'],
      ['getFTPAttribution', () => apiClient.getFTPAttribution('inst-1'), 'get', '/api/alm/inst-1/ftp/attribution'],
      ['runForwardSimulation', () => apiClient.runForwardSimulation('inst-1', { horizon: 12 }), 'post', '/api/alm/inst-1/forward-simulation'],
      ['getPeerAnalytics', () => apiClient.getPeerAnalytics('inst-1'), 'get', '/api/alm/inst-1/peer-analytics'],
      ['getOASPortfolio', () => apiClient.getOASPortfolio('inst-1'), 'get', '/api/alm/inst-1/oas'],
      ['getCreditRisk', () => apiClient.getCreditRisk('inst-1'), 'get', '/api/alm/inst-1/credit-risk'],
      ['getVaRSuite', () => apiClient.getVaRSuite('inst-1', 99, 10), 'get', '/api/alm/inst-1/var?confidence=99&horizon=10'],
      ['optimizeCapital', () => apiClient.optimizeCapital('inst-1', 'aggressive'), 'post', '/api/alm/inst-1/optimize'],
      ['getAssetEWS', () => apiClient.getAssetEWS('inst-1'), 'get', '/api/alm/inst-1/ews'],
      ['getSOFRExposure', () => apiClient.getSOFRExposure('inst-1'), 'get', '/api/alm/inst-1/sofr-exposure'],
      ['getTreasuryRates', () => apiClient.getTreasuryRates(), 'get', '/api/alm/treasury/rates'],
      ['getAlerts', () => apiClient.getAlerts('inst-1', true), 'get', '/api/alm/inst-1/alerts?unreadOnly=true'],
      ['getCamelForecast', () => apiClient.getCamelForecast('inst-1'), 'get', '/api/alm/inst-1/camel-forecast'],
      ['getPeerSynthesis', () => apiClient.getPeerSynthesis(), 'get', '/api/alm/peer-synthesis/latest'],
      ['runStressV2', () => apiClient.runStressV2('inst-1', 'scenario-1'), 'post', '/api/alm/inst-1/stress-v2/run'],
      ['runAllStressV2', () => apiClient.runAllStressV2('inst-1'), 'post', '/api/alm/inst-1/stress-v2/run-all'],
      ['robustOptimize', () => apiClient.robustOptimize('inst-1', 'defensive'), 'post', '/api/alm/inst-1/robust-optimize'],
      ['getOptionality', () => apiClient.getOptionality('inst-1'), 'get', '/api/alm/inst-1/optionality'],
      ['getConcentrationVaR', () => apiClient.getConcentrationVaR('inst-1'), 'get', '/api/alm/inst-1/concentration-var'],
      ['buildDemoWorkspace', () => apiClient.buildDemoWorkspace('12345', 'Desk Demo'), 'post', '/api/alm/demo/build'],
      ['getOnboardingStatus', () => apiClient.getOnboardingStatus('inst-1'), 'get', '/api/alm/inst-1/onboarding'],
    ] as const;

    for (const [, invoke, method, url] of cases) {
      instance[method].mockResolvedValueOnce({ data: { ok: url }, headers: {} });
      await invoke();
      expect(instance[method].mock.calls.at(-1)?.[0]).toContain(url);
    }
  });

  it('returns report helper URLs and performs file downloads with deterministic filenames', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-03-29T15:45:00Z'));

    const createObjectUrlSpy = vi.spyOn(URL, 'createObjectURL').mockReturnValue('blob:report');
    const revokeObjectUrlSpy = vi.spyOn(URL, 'revokeObjectURL').mockImplementation(() => {});
    const appendSpy = vi.spyOn(document.body, 'appendChild');
    const removeSpy = vi.spyOn(document.body, 'removeChild');
    const createElementSpy = vi.spyOn(document, 'createElement');

    const { apiClient, instance } = await loadApiModule();

    instance.get.mockResolvedValueOnce({
      data: new Uint8Array([1, 2, 3]),
      headers: { 'content-disposition': 'attachment; filename="stress-pack.pdf"' },
    });
    instance.post
      .mockResolvedValueOnce({
        data: new Uint8Array([4, 5, 6]),
        headers: {},
      })
      .mockResolvedValueOnce({
        data: new Uint8Array([7, 8, 9]),
        headers: {},
      });

    await apiClient.downloadALMReport('inst-1', 'es');
    await apiClient.downloadAPReport('org-1', 'es', 'inst-1');
    await apiClient.generateSampleReport('12345');

    const anchors = createElementSpy.mock.results
      .map((result) => result.value)
      .filter((value): value is HTMLAnchorElement => value instanceof HTMLAnchorElement);

    expect(apiClient.getALMReportUrl('inst-1', 'es')).toBe('/api/alm/inst-1/report?lang=es');
    expect(apiClient.getExpenseTemplateUrl()).toBe('/api/expenses/template');
    expect(instance.get).toHaveBeenCalledWith('/api/alm/inst-1/report?lang=es', { responseType: 'blob' });
    expect(instance.post).toHaveBeenNthCalledWith(
      1,
      '/api/expenses/org-1/report?lang=es&institutionId=inst-1',
      {},
      { responseType: 'blob' },
    );
    expect(instance.post).toHaveBeenNthCalledWith(
      2,
      '/api/alm/sample-report',
      { charterNumber: '12345' },
      { responseType: 'blob' },
    );
    expect(anchors).toHaveLength(3);
    expect(anchors[0].download).toBe('stress-pack.pdf');
    expect(anchors[1].download).toBe('ap-intelligence-report-2026-03-29.pdf');
    expect(anchors[2].download).toBe('sample-alm-report-12345.pdf');
    expect(createObjectUrlSpy).toHaveBeenCalledTimes(3);
    expect(revokeObjectUrlSpy).toHaveBeenCalledTimes(3);
    expect(appendSpy).toHaveBeenCalledTimes(3);
    expect(removeSpy).toHaveBeenCalledTimes(3);
  });

  it('exposes mock market and portfolio data useful for demo and benchmark flows', async () => {
    const { apiClient } = await loadApiModule();

    const tickers = await apiClient.getPopularTickers();
    const search = await apiClient.searchTickers('prfd');
    const portfolios = await apiClient.getPortfolios();
    const analytics = await apiClient.getPortfolioAnalytics('demo-portfolio');
    const screener = await apiClient.getNodeValuationScreener({ sector: 'Technology', minScore: 90 });
    const valuation = await apiClient.getNodeValuation('nvda', 'frontier');
    const cyclical = await apiClient.getCyclicalValuation('msft');
    const computed = await apiClient.computeCyclicalValuation('msft');

    expect(tickers[0].ticker).toBe('NVDA');
    expect(search.some((item) => item.ticker === 'PRFD')).toBe(true);
    expect(portfolios[0].positions).toHaveLength(5);
    expect(analytics.portfolio_id).toBe('demo-portfolio');
    expect(screener).toHaveLength(2);
    expect(valuation).toMatchObject({ ticker: 'NVDA', valuation_type: 'frontier' });
    expect(cyclical).toMatchObject({ ticker: 'MSFT' });
    expect(computed).toEqual({ status: 'computed', ticker: 'MSFT' });
  });
});
