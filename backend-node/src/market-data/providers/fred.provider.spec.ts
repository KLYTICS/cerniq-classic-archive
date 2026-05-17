import { FredProvider } from './fred.provider';

/**
 * FredProvider spec — exercises every observable behaviour without ever
 * calling the live FRED API. `global.fetch` is mocked per-test; the
 * provider reads `process.env.FRED_API_KEY` at call time so each test can
 * mutate the env in beforeEach.
 *
 * Why fetch-level mocking (and not a network-mock library): the provider
 * uses one well-known method (`fetch` from the global namespace under
 * Node 22+). Mocking it directly keeps the spec dependency-free and the
 * intent visible — every test states the exact upstream shape it expects.
 */

type FredObservation = { date: string; value: string };
type FredResponse = { observations?: FredObservation[] };

function mockFetchOnce(
  body: FredResponse,
  opts: { ok?: boolean; status?: number; statusText?: string } = {},
) {
  return jest.fn().mockResolvedValueOnce({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: opts.statusText ?? 'OK',
    json: async () => body,
  });
}

function mockFetchSequence(
  responses: Array<{
    body?: FredResponse;
    ok?: boolean;
    status?: number;
    throws?: Error;
  }>,
) {
  const fn = jest.fn();
  for (const r of responses) {
    if (r.throws) {
      fn.mockRejectedValueOnce(r.throws);
    } else {
      fn.mockResolvedValueOnce({
        ok: r.ok ?? true,
        status: r.status ?? 200,
        statusText: 'OK',
        json: async () => r.body ?? {},
      });
    }
  }
  return fn;
}

describe('FredProvider', () => {
  let provider: FredProvider;
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_KEY = process.env.FRED_API_KEY;

  beforeEach(() => {
    provider = new FredProvider();
    process.env.FRED_API_KEY = 'test-key-abc123';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_KEY === undefined) {
      delete process.env.FRED_API_KEY;
    } else {
      process.env.FRED_API_KEY = ORIGINAL_KEY;
    }
    jest.restoreAllMocks();
  });

  describe('getLatestObservation', () => {
    it('returns parsed observation on success', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-05-15', value: '4.35' }],
      });
      const obs = await provider.getLatestObservation('DGS10');
      expect(obs).toEqual({ date: '2026-05-15', value: 4.35 });
    });

    it('returns null when FRED_API_KEY is missing (graceful degrade)', async () => {
      delete process.env.FRED_API_KEY;
      global.fetch = jest.fn();
      const obs = await provider.getLatestObservation('DGS10');
      expect(obs).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when value is FRED missing-sentinel "." (Rule 1 — never silent-zero)', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-05-15', value: '.' }],
      });
      const obs = await provider.getLatestObservation('DGS10');
      expect(obs).toBeNull();
    });

    it('returns null when value is non-numeric', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-05-15', value: 'not-a-number' }],
      });
      expect(await provider.getLatestObservation('DGS10')).toBeNull();
    });

    it('returns null when observations array is empty', async () => {
      global.fetch = mockFetchOnce({ observations: [] });
      expect(await provider.getLatestObservation('DGS10')).toBeNull();
    });

    it('returns null on non-2xx HTTP response', async () => {
      global.fetch = mockFetchOnce(
        {},
        { ok: false, status: 429, statusText: 'Too Many Requests' },
      );
      expect(await provider.getLatestObservation('DGS10')).toBeNull();
    });

    it('returns null on network error (catches, never throws)', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await provider.getLatestObservation('DGS10')).toBeNull();
    });
  });

  describe('getYieldCurve', () => {
    it('builds full curve when every tenor responds', async () => {
      // 11 tenors → 11 fetch calls expected. Each returns a different rate.
      const rates = [
        '4.20',
        '4.30',
        '4.40',
        '4.50',
        '4.45',
        '4.40',
        '4.35',
        '4.32',
        '4.30',
        '4.25',
        '4.20',
      ];
      global.fetch = mockFetchSequence(
        rates.map((r) => ({
          body: { observations: [{ date: '2026-05-15', value: r }] },
        })),
      );
      const curve = await provider.getYieldCurve();
      expect(curve).not.toBeNull();
      expect(curve!.points).toHaveLength(11);
      expect(curve!.provider).toBe('fred');
      expect(curve!.currency).toBe('USD');
      expect(curve!.curve).toBe('US_TREASURY_CMT');
    });

    it('returns partial curve when some tenors miss (Rule 1 — surface gaps, not zeros)', async () => {
      // Mark every other tenor as missing. Surviving tenors should populate
      // points; missing tenors are simply omitted (not zeroed).
      const responses = Array.from({ length: 11 }).map((_, i) => ({
        body: {
          observations: [
            { date: '2026-05-15', value: i % 2 === 0 ? '4.50' : '.' },
          ],
        },
      }));
      global.fetch = mockFetchSequence(responses);
      const curve = await provider.getYieldCurve();
      expect(curve).not.toBeNull();
      expect(curve!.points.length).toBe(6); // 6 of 11 succeeded
      // Every present point still has its seriesId for lineage.
      for (const p of curve!.points) {
        expect(p.seriesId).toMatch(/^DGS/);
        expect(typeof p.rate).toBe('number');
      }
    });

    it('returns null only when EVERY tenor failed (catastrophic miss)', async () => {
      global.fetch = mockFetchSequence(
        Array.from({ length: 11 }).map(() => ({ ok: false, status: 500 })),
      );
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('detects inversion when 10Y < 2Y (recession signal)', async () => {
      // 11 tenors in canonical order: 1M, 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y
      // Set 2Y = 5.00, 10Y = 4.30 → inverted, spread = -0.70
      const rates = [
        '4.5',
        '4.6',
        '4.7',
        '4.8',
        '5.0',
        '4.9',
        '4.7',
        '4.5',
        '4.3',
        '4.2',
        '4.1',
      ];
      global.fetch = mockFetchSequence(
        rates.map((r) => ({
          body: { observations: [{ date: '2026-05-15', value: r }] },
        })),
      );
      const curve = await provider.getYieldCurve();
      expect(curve!.inverted).toBe(true);
      expect(curve!.invertedDetail).toContain('-0.70');
    });

    it('detects non-inversion when 10Y > 2Y', async () => {
      const rates = [
        '4.5',
        '4.4',
        '4.3',
        '4.2',
        '4.1',
        '4.2',
        '4.3',
        '4.4',
        '4.5',
        '4.6',
        '4.7',
      ];
      global.fetch = mockFetchSequence(
        rates.map((r) => ({
          body: { observations: [{ date: '2026-05-15', value: r }] },
        })),
      );
      const curve = await provider.getYieldCurve();
      expect(curve!.inverted).toBe(false);
      expect(curve!.invertedDetail).toContain('0.40');
    });

    it('returns null when FRED_API_KEY missing (no fetches made)', async () => {
      delete process.env.FRED_API_KEY;
      global.fetch = jest.fn();
      expect(await provider.getYieldCurve()).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getInterestRate', () => {
    it('maps known seriesId to its human-readable name', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-05-15', value: '4.35' }],
      });
      const rate = await provider.getInterestRate('DGS10');
      expect(rate).toMatchObject({
        seriesId: 'DGS10',
        name: '10-Year Treasury Constant Maturity Rate',
        rate: 4.35,
        units: 'percent',
        provider: 'fred',
      });
    });

    it('falls back to seriesId as display name for unknown series', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-05-15', value: '1.23' }],
      });
      const rate = await provider.getInterestRate(
        'SOME_NEW_SERIES_PROVIDER_DOESNT_KNOW',
      );
      expect(rate!.name).toBe('SOME_NEW_SERIES_PROVIDER_DOESNT_KNOW');
    });
  });

  describe('getEconomicIndicator', () => {
    it('returns indicator with caller-supplied units + frequency', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-04-30', value: '305.7' }],
      });
      const indicator = await provider.getEconomicIndicator('CPIAUCSL', {
        units: 'Index 1982-1984=100',
        frequency: 'Monthly',
      });
      expect(indicator).toMatchObject({
        seriesId: 'CPIAUCSL',
        value: 305.7,
        units: 'Index 1982-1984=100',
        frequency: 'Monthly',
        provider: 'fred',
      });
    });

    it('defaults units + frequency when not supplied', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-04-30', value: '4.0' }],
      });
      const indicator = await provider.getEconomicIndicator('UNRATE');
      expect(indicator!.units).toBe('value');
      expect(indicator!.frequency).toBe('unknown');
    });
  });

  describe('getFXRate', () => {
    it('builds FX DTO with caller-specified base / quote currencies', async () => {
      global.fetch = mockFetchOnce({
        observations: [{ date: '2026-05-15', value: '0.92' }],
      });
      const fx = await provider.getFXRate('DEXUSEU', 'USD', 'EUR');
      expect(fx).toMatchObject({
        pair: 'USD/EUR',
        base: 'USD',
        quote: 'EUR',
        rate: 0.92,
        provider: 'fred',
      });
    });
  });
});
