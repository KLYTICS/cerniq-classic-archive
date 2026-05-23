import { TreasuryFiscalDataProvider } from './treasury-fiscal-data.provider';

/**
 * TreasuryFiscalDataProvider spec — exercises every observable behaviour
 * without calling the live Treasury API. Mocks `global.fetch` per-test,
 * mirroring the FredProvider spec pattern.
 */

interface TreasuryRow {
  record_date?: string;
  bc_1month?: string | null;
  bc_3month?: string | null;
  bc_6month?: string | null;
  bc_1year?: string | null;
  bc_2year?: string | null;
  bc_3year?: string | null;
  bc_5year?: string | null;
  bc_7year?: string | null;
  bc_10year?: string | null;
  bc_20year?: string | null;
  bc_30year?: string | null;
}

function mockFetchWithData(
  rows: TreasuryRow[],
  opts: { ok?: boolean; status?: number } = {},
) {
  return jest.fn().mockResolvedValueOnce({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: 'OK',
    json: async () => ({ data: rows }),
  });
}

function fullCurveRow(date: string): TreasuryRow {
  return {
    record_date: date,
    bc_1month: '5.30',
    bc_3month: '5.28',
    bc_6month: '5.20',
    bc_1year: '4.85',
    bc_2year: '4.60',
    bc_3year: '4.50',
    bc_5year: '4.40',
    bc_7year: '4.35',
    bc_10year: '4.32',
    bc_20year: '4.45',
    bc_30year: '4.50',
  };
}

describe('TreasuryFiscalDataProvider', () => {
  let provider: TreasuryFiscalDataProvider;
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    provider = new TreasuryFiscalDataProvider();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  describe('getYieldCurve', () => {
    it('builds full 11-point curve when every tenor is present', async () => {
      global.fetch = mockFetchWithData([fullCurveRow('2026-05-15')]);
      const curve = await provider.getYieldCurve();
      expect(curve).not.toBeNull();
      expect(curve!.points).toHaveLength(11);
      expect(curve!.provider).toBe('treasury-fiscal-data');
      expect(curve!.currency).toBe('USD');
      expect(curve!.curve).toBe('US_TREASURY_CMT');
      expect(curve!.asOf).toBe('2026-05-15');
    });

    it('omits missing tenors (Rule 1 — surfaces gaps, never zeros)', async () => {
      // 20Y was suspended 2002-2020; the API returns null for it then.
      const row = fullCurveRow('2003-05-15');
      row.bc_20year = null;
      global.fetch = mockFetchWithData([row]);
      const curve = await provider.getYieldCurve();
      expect(curve).not.toBeNull();
      expect(curve!.points).toHaveLength(10);
      expect(curve!.points.find((p) => p.tenor === '20Y')).toBeUndefined();
    });

    it('returns null when EVERY tenor is null (catastrophic miss)', async () => {
      const row: TreasuryRow = {
        record_date: '2026-05-15',
        bc_1month: null,
        bc_3month: null,
        bc_6month: null,
        bc_1year: null,
        bc_2year: null,
        bc_3year: null,
        bc_5year: null,
        bc_7year: null,
        bc_10year: null,
        bc_20year: null,
        bc_30year: null,
      };
      global.fetch = mockFetchWithData([row]);
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('returns null when data array is empty', async () => {
      global.fetch = mockFetchWithData([]);
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('returns null when record_date is missing', async () => {
      const row = fullCurveRow('2026-05-15');
      delete row.record_date;
      global.fetch = mockFetchWithData([row]);
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('skips unparseable rate strings (defensive — never throws)', async () => {
      const row = fullCurveRow('2026-05-15');
      row.bc_10year = 'NaN-like garbage';
      global.fetch = mockFetchWithData([row]);
      const curve = await provider.getYieldCurve();
      expect(curve).not.toBeNull();
      expect(curve!.points.find((p) => p.tenor === '10Y')).toBeUndefined();
      // Other tenors still loaded
      expect(curve!.points.length).toBe(10);
    });

    it('returns null on non-2xx HTTP response', async () => {
      global.fetch = mockFetchWithData([], { ok: false, status: 503 });
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('returns null on network error (catches, never throws)', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('detects inversion when 10Y < 2Y', async () => {
      const row = fullCurveRow('2026-05-15');
      row.bc_2year = '5.00';
      row.bc_10year = '4.30';
      global.fetch = mockFetchWithData([row]);
      const curve = await provider.getYieldCurve();
      expect(curve!.inverted).toBe(true);
      expect(curve!.invertedDetail).toContain('-0.70');
    });

    it('detects non-inversion when 10Y > 2Y', async () => {
      const row = fullCurveRow('2026-05-15');
      row.bc_2year = '4.00';
      row.bc_10year = '4.50';
      global.fetch = mockFetchWithData([row]);
      const curve = await provider.getYieldCurve();
      expect(curve!.inverted).toBe(false);
      expect(curve!.invertedDetail).toContain('0.50');
    });

    it('each point carries the Treasury field name as seriesId for lineage', async () => {
      global.fetch = mockFetchWithData([fullCurveRow('2026-05-15')]);
      const curve = await provider.getYieldCurve();
      expect(curve!.points.find((p) => p.tenor === '10Y')?.seriesId).toBe(
        'bc_10year',
      );
      expect(curve!.points.find((p) => p.tenor === '30Y')?.seriesId).toBe(
        'bc_30year',
      );
    });
  });
});
