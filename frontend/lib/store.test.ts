import { beforeEach, describe, expect, it, vi } from 'vitest';

const getCurrentUserMock = vi.fn();
const logoutMock = vi.fn();

vi.mock('./api', () => ({
  apiClient: {
    getCurrentUser: getCurrentUserMock,
    logout: logoutMock,
  },
}));

async function loadStoreModule() {
  vi.resetModules();
  return import('./store');
}

describe('useAuthStore', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
    getCurrentUserMock.mockReset();
    logoutMock.mockReset();
    delete process.env.NEXT_PUBLIC_NODE_API_URL;
  });

  it('does not authenticate from durable local auth metadata without a server session', async () => {
    localStorage.setItem(
      'cerniq_auth_user',
      JSON.stringify({ id: 'u_local', email: 'local@cerniq.io' }),
    );

    getCurrentUserMock.mockRejectedValue(new Error('Unauthorized'));

    const { useAuthStore } = await loadStoreModule();
    await useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      authBootstrapState: 'unauthenticated',
      initialized: true,
    });
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
  });

  it('hydrates from the backend profile when a cookie-backed session exists', async () => {
    getCurrentUserMock.mockResolvedValue({
      id: 'u_server',
      email: 'server@cerniq.io',
      name: 'Server Session',
    });

    const { useAuthStore } = await loadStoreModule();
    await useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState()).toMatchObject({
      user: {
        id: 'u_server',
        email: 'server@cerniq.io',
        name: 'Server Session',
      },
      isAuthenticated: true,
      authBootstrapState: 'authenticated_from_server',
      initialized: true,
    });
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
  });

  it('hydrates nested profile payloads and restores onboarding markers', async () => {
    localStorage.setItem('cerniq_onboarding_u_nested', 'true');
    getCurrentUserMock.mockResolvedValue({
      user: {
        id: 'u_nested',
        email: 'nested@cerniq.io',
        name: 'Nested Session',
      },
    });

    const { useAuthStore } = await loadStoreModule();
    await useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState()).toMatchObject({
      user: {
        id: 'u_nested',
        email: 'nested@cerniq.io',
        name: 'Nested Session',
      },
      isAuthenticated: true,
      authBootstrapState: 'authenticated_from_server',
      onboardingComplete: true,
    });
  });

  it('skips the server probe for split localhost frontend and backend origins', async () => {
    process.env.NEXT_PUBLIC_NODE_API_URL = 'http://127.0.0.1:4000';
    getCurrentUserMock.mockResolvedValue({
      id: 'u_server',
      email: 'server@cerniq.io',
    });

    const { useAuthStore } = await loadStoreModule();
    await useAuthStore.getState().hydrateFromStorage();

    expect(getCurrentUserMock).not.toHaveBeenCalled();
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      authBootstrapState: 'unauthenticated',
      initialized: true,
    });
  });

  it('falls back to unauthenticated when the backend profile is malformed', async () => {
    getCurrentUserMock.mockResolvedValue({
      user: {
        id: '',
        email: null,
      },
    });

    const { useAuthStore } = await loadStoreModule();
    await useAuthStore.getState().hydrateFromStorage();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      authBootstrapState: 'unauthenticated',
      initialized: true,
    });
  });

  it('normalizes alternate backend identity keys and invalid API URLs still probe the server', async () => {
    process.env.NEXT_PUBLIC_NODE_API_URL = '://not-a-valid-url';
    getCurrentUserMock.mockResolvedValue({
      user_id: 'u_alt',
      sub: 'ignored',
      email: 'alt@cerniq.io',
      name: 'Alt Session',
    });

    const { useAuthStore } = await loadStoreModule();
    await useAuthStore.getState().hydrateFromStorage();

    expect(getCurrentUserMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: {
        id: 'u_alt',
        email: 'alt@cerniq.io',
        name: 'Alt Session',
      },
      isAuthenticated: true,
      authBootstrapState: 'authenticated_from_server',
    });
  });

  it('normalizes sub and email fallback identities without a name', async () => {
    const { normalizeUser } = await loadStoreModule();

    expect(
      normalizeUser({
        sub: 'u_sub',
        email: 'sub@cerniq.io',
      }),
    ).toEqual({
      id: 'u_sub',
      email: 'sub@cerniq.io',
      name: undefined,
    });

    expect(
      normalizeUser({
        email: 'fallback@cerniq.io',
      }),
    ).toEqual({
      id: 'fallback@cerniq.io',
      email: 'fallback@cerniq.io',
      name: undefined,
    });
  });

  it('returns null for empty or missing normalized identities', async () => {
    const { normalizeUser } = await loadStoreModule();

    expect(normalizeUser(null)).toBeNull();
    expect(normalizeUser({})).toBeNull();
  });

  it('can initialize in a browserless context without probing storage', async () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      const { useAuthStore } = await loadStoreModule();
      await useAuthStore.getState().hydrateFromStorage();

      expect(getCurrentUserMock).not.toHaveBeenCalled();
      expect(useAuthStore.getState()).toMatchObject({
        user: null,
        isAuthenticated: false,
        authBootstrapState: 'unauthenticated',
        initialized: true,
      });
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('reports that server probing is unavailable when window is missing', async () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      const { shouldProbeServerSession } = await loadStoreModule();
      expect(shouldProbeServerSession()).toBe(false);
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });

  it('still probes the server for same-origin localhost backends', async () => {
    process.env.NEXT_PUBLIC_NODE_API_URL = 'http://localhost:3000';

    const { shouldProbeServerSession } = await loadStoreModule();

    expect(shouldProbeServerSession()).toBe(true);
  });

  it('probes the server for non-local backend origins', async () => {
    process.env.NEXT_PUBLIC_NODE_API_URL = 'https://api.cerniq.io';

    const { shouldProbeServerSession } = await loadStoreModule();

    expect(shouldProbeServerSession()).toBe(true);
  });

  it('can initialize anonymous state without probing storage', async () => {
    const { useAuthStore } = await loadStoreModule();

    useAuthStore.getState().initializeAnonymous();

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      authBootstrapState: 'unauthenticated',
      onboardingComplete: false,
      initialized: true,
      authRevision: 1,
    });
  });

  it('tracks onboarding completion per logged-in user', async () => {
    const { useAuthStore } = await loadStoreModule();

    useAuthStore.getState().setUser({
      id: 'u_onboard',
      email: 'desk@cerniq.io',
    });
    useAuthStore.getState().setOnboardingComplete(true);

    expect(useAuthStore.getState()).toMatchObject({
      isAuthenticated: true,
      authBootstrapState: 'authenticated_from_login',
      onboardingComplete: true,
    });
    expect(localStorage.getItem('cerniq_onboarding_u_onboard')).toBe('true');
  });

  it('does not write onboarding markers when no user is present', async () => {
    const { useAuthStore } = await loadStoreModule();

    useAuthStore.getState().setOnboardingComplete(true);

    expect(useAuthStore.getState().onboardingComplete).toBe(true);
    expect(localStorage.length).toBe(0);
  });

  it('resets login state when setUser receives null', async () => {
    localStorage.setItem('cerniq_auth_user', JSON.stringify({ id: 'u_old' }));

    const { useAuthStore } = await loadStoreModule();

    useAuthStore.getState().setUser({
      id: 'u_login',
      email: 'login@cerniq.io',
    });
    useAuthStore.getState().setUser(null);

    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      authBootstrapState: 'unauthenticated',
      onboardingComplete: false,
    });
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
  });

  it('clears the same browser auth artifacts during logout', async () => {
    logoutMock.mockResolvedValue(undefined);
    sessionStorage.setItem('cerniq_access_token', 'desk-token');
    sessionStorage.setItem('cerniq_admin_key', 'desk-admin');
    localStorage.setItem(
      'cerniq_auth_user',
      JSON.stringify({ id: 'u_login', email: 'login@cerniq.io' }),
    );

    const { useAuthStore } = await loadStoreModule();
    useAuthStore.getState().setUser({
      id: 'u_login',
      email: 'login@cerniq.io',
    });

    await useAuthStore.getState().logout();

    expect(logoutMock).toHaveBeenCalledTimes(1);
    expect(useAuthStore.getState()).toMatchObject({
      user: null,
      isAuthenticated: false,
      authBootstrapState: 'unauthenticated',
    });
    expect(sessionStorage.getItem('cerniq_access_token')).toBeNull();
    expect(sessionStorage.getItem('cerniq_admin_key')).toBeNull();
    expect(localStorage.getItem('cerniq_auth_user')).toBeNull();
  });
});

describe('usePortfolioStore', () => {
  it('sets, selects, and appends portfolios', async () => {
    const { usePortfolioStore } = await loadStoreModule();
    const first = { id: 'p1', name: 'Core Book', positions: [] };
    const second = { id: 'p2', name: 'Hedge Book', positions: [{ id: 'pos-1' }] };

    usePortfolioStore.getState().setPortfolios([first]);
    usePortfolioStore.getState().selectPortfolio(first);
    usePortfolioStore.getState().addPortfolio(second);

    expect(usePortfolioStore.getState()).toMatchObject({
      selectedPortfolio: first,
      portfolios: [first, second],
    });
  });
});

describe('useMarketDataStore', () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it('stores single quotes, expires stale entries, and clears the cache', async () => {
    const nowSpy = vi.spyOn(Date, 'now');
    nowSpy.mockReturnValue(1_000);

    const { useMarketDataStore } = await loadStoreModule();
    useMarketDataStore.getState().setQuote('AAPL', {
      ticker: 'AAPL',
      price: 100,
      change: 1.5,
      changePercent: 1.5,
    });

    expect(useMarketDataStore.getState().getQuote('AAPL')).toMatchObject({
      ticker: 'AAPL',
      price: 100,
    });
    expect(useMarketDataStore.getState().isStale('AAPL')).toBe(false);
    expect(useMarketDataStore.getState().isStale('MSFT')).toBe(true);

    nowSpy.mockReturnValue(62_500);
    expect(useMarketDataStore.getState().getQuote('AAPL')).toBeNull();
    expect(useMarketDataStore.getState().isStale('AAPL')).toBe(true);

    useMarketDataStore.getState().clearCache();
    expect(useMarketDataStore.getState()).toMatchObject({
      quotes: {},
      lastUpdated: null,
    });
  });

  it('returns null when requesting a quote that has never been cached', async () => {
    const { useMarketDataStore } = await loadStoreModule();

    expect(useMarketDataStore.getState().getQuote('MISSING')).toBeNull();
  });

  it('stores quote batches with a shared timestamp', async () => {
    vi.spyOn(Date, 'now').mockReturnValue(5_000);

    const { useMarketDataStore } = await loadStoreModule();
    useMarketDataStore.getState().setQuotes([
      { ticker: 'AAPL', price: 100, change: 1, changePercent: 1 },
      { ticker: 'MSFT', price: 200, change: -2, changePercent: -1 },
    ]);

    expect(useMarketDataStore.getState().quotes).toEqual({
      AAPL: {
        data: { ticker: 'AAPL', price: 100, change: 1, changePercent: 1 },
        timestamp: 5_000,
      },
      MSFT: {
        data: { ticker: 'MSFT', price: 200, change: -2, changePercent: -1 },
        timestamp: 5_000,
      },
    });
    expect(useMarketDataStore.getState().lastUpdated).toBe(5_000);
  });
});
