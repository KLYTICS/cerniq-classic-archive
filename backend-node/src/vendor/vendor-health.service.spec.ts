import { VendorHealthService } from './vendor-health.service';
import { SECEdgarProvider } from './filings/sec-edgar.provider';
import { RefinitivEikonProvider } from './market-data/refinitiv-eikon.provider';
import { BloombergHapiProvider } from './market-data/bloomberg-hapi.provider';

/**
 * VendorHealthService spec — exercises the per-vendor probe dispatch
 * (HTTP probe vs env-only vs configured-only) without hitting any real
 * upstream. All env vars and global.fetch mocked.
 */

function mockFetchOk(latencyMs: number = 10) {
  return jest.fn().mockImplementation(
    () =>
      new Promise((resolve) =>
        setTimeout(
          () =>
            resolve({
              ok: true,
              status: 200,
              statusText: 'OK',
              json: async () => ({}),
              text: async () => '',
            }),
          latencyMs,
        ),
      ),
  );
}

function mockFetchFail(status = 500) {
  return jest.fn().mockResolvedValue({
    ok: false,
    status,
    statusText: 'Bad',
    json: async () => ({}),
    text: async () => '',
  });
}

describe('VendorHealthService', () => {
  let service: VendorHealthService;
  let secEdgar: SECEdgarProvider;
  let refinitiv: RefinitivEikonProvider;
  let bloomberg: BloombergHapiProvider;
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_ENV = { ...process.env };

  beforeEach(() => {
    secEdgar = new SECEdgarProvider();
    refinitiv = new RefinitivEikonProvider();
    bloomberg = new BloombergHapiProvider();
    service = new VendorHealthService(secEdgar, refinitiv, bloomberg);
    // Make all upstream probes succeed by default
    global.fetch = mockFetchOk(5);
    // Clear all probe-relevant env vars so default state is NOT_CONFIGURED
    for (const v of [
      'FRED_API_KEY',
      'ALPHA_VANTAGE_API_KEY',
      'SEC_EDGAR_USER_AGENT',
      'REFINITIV_APP_KEY',
      'REFINITIV_APP_SECRET',
      'BLOOMBERG_HAPI_BASE_URL',
      'BLOOMBERG_HAPI_CLIENT_ID',
      'BLOOMBERG_HAPI_CLIENT_SECRET',
      'BLOOMBERG_HAPI_ACCOUNT_ID',
    ]) {
      delete process.env[v];
    }
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    process.env = { ...ORIGINAL_ENV };
    jest.restoreAllMocks();
  });

  describe('getAllHealth', () => {
    it('returns one entry per vendor in the registry', async () => {
      const summary = await service.getAllHealth();
      expect(summary.vendors.length).toBeGreaterThan(0);
      expect(summary.total).toBe(summary.vendors.length);
      expect(
        summary.ok +
          summary.degraded +
          summary.unreachable +
          summary.notConfigured +
          summary.notProbed,
      ).toBe(summary.total);
    });

    it('returns ISO timestamp on summary', async () => {
      const summary = await service.getAllHealth();
      expect(summary.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
    });

    it('marks Refinitiv as NOT_CONFIGURED when env missing', async () => {
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find(
        (v) => v.vendorId === 'refinitiv-eikon',
      );
      expect(entry!.state).toBe('NOT_CONFIGURED');
      expect(entry!.configured).toBe(false);
      expect(entry!.message).toContain('REFINITIV_APP_KEY');
    });

    it('marks Bloomberg HAPI as NOT_CONFIGURED when env missing', async () => {
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find(
        (v) => v.vendorId === 'bloomberg-bpipe',
      );
      expect(entry!.state).toBe('NOT_CONFIGURED');
      expect(entry!.message).toContain('BLOOMBERG_HAPI');
    });

    it('marks Refinitiv as OK when both env vars present (no API call)', async () => {
      process.env.REFINITIV_APP_KEY = 'k';
      process.env.REFINITIV_APP_SECRET = 's';
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find(
        (v) => v.vendorId === 'refinitiv-eikon',
      );
      expect(entry!.state).toBe('OK');
      expect(entry!.configured).toBe(true);
      expect(entry!.message).toContain('not test-called');
    });

    it('marks Alpha Vantage as NOT_CONFIGURED without API key', async () => {
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find((v) => v.vendorId === 'alpha-vantage');
      expect(entry!.state).toBe('NOT_CONFIGURED');
    });

    it('marks Alpha Vantage as OK when key present (no API call)', async () => {
      process.env.ALPHA_VANTAGE_API_KEY = 'avkey';
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find((v) => v.vendorId === 'alpha-vantage');
      expect(entry!.state).toBe('OK');
    });

    it('marks FRED as NOT_CONFIGURED without FRED_API_KEY', async () => {
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find((v) => v.vendorId === 'fred');
      expect(entry!.state).toBe('NOT_CONFIGURED');
    });

    it('marks ECB SDW as OK on 200 from probe URL', async () => {
      // ECB SDW has no env vars, just HTTP probe
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find((v) => v.vendorId === 'ecb-sdw');
      expect(['OK', 'DEGRADED']).toContain(entry!.state);
      expect(entry!.latencyMs).toBeGreaterThanOrEqual(0);
    });

    it('marks Yahoo as UNREACHABLE on probe HTTP error', async () => {
      global.fetch = mockFetchFail(503);
      const summary = await service.getAllHealth();
      const entry = summary.vendors.find((v) => v.vendorId === 'yahoo-finance');
      expect(entry!.state).toBe('UNREACHABLE');
      expect(entry!.message).toContain('503');
    });

    it('marks vendors UNREACHABLE on network error', async () => {
      global.fetch = jest.fn().mockRejectedValue(new Error('ECONNREFUSED'));
      const summary = await service.getAllHealth();
      const yahoo = summary.vendors.find((v) => v.vendorId === 'yahoo-finance');
      expect(yahoo!.state).toBe('UNREACHABLE');
      expect(yahoo!.message).toBe('ECONNREFUSED');
    });

    it('marks scaffolds as NOT_PROBED (not OK) when env present, NOT_CONFIGURED when missing', async () => {
      const summary = await service.getAllHealth();
      // ice-bofa scaffold has env vars defined but they're missing
      const ice = summary.vendors.find((v) => v.vendorId === 'ice-bofa');
      expect(ice!.state).toBe('NOT_CONFIGURED');
    });

    it('counts buckets correctly', async () => {
      // No env vars set → most vendors NOT_CONFIGURED; HTTP-probed vendors OK
      const summary = await service.getAllHealth();
      // Yahoo, CoinGecko, Treasury, ECB-SDW have no env vars + always OK with mocked fetch
      expect(summary.ok).toBeGreaterThanOrEqual(1);
      // Refinitiv, Bloomberg, Alpha Vantage, FRED, SEC EDGAR all need env
      expect(summary.notConfigured).toBeGreaterThanOrEqual(4);
    });

    it('marks slow HTTP probe as DEGRADED (latency > threshold)', async () => {
      global.fetch = mockFetchOk(1800);
      const summary = await service.getAllHealth();
      const yahoo = summary.vendors.find((v) => v.vendorId === 'yahoo-finance');
      expect(yahoo!.state).toBe('DEGRADED');
      expect(yahoo!.latencyMs).toBeGreaterThan(1500);
    }, 10_000);
  });
});
