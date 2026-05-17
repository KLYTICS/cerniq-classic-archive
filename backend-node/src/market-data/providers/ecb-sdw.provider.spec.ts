import { EcbSdwProvider } from './ecb-sdw.provider';

/**
 * EcbSdwProvider spec — exercises CSV parsing + yield-curve composition
 * + HICP + FX + key-rate paths against mocked fetch responses.
 */

function mockFetchWithCsv(
  csv: string,
  opts: { ok?: boolean; status?: number } = {},
) {
  return jest.fn().mockResolvedValueOnce({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: 'OK',
    text: async () => csv,
  });
}

function mockFetchSequence(
  responses: Array<{
    csv?: string;
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
        text: async () => r.csv ?? '',
      });
    }
  }
  return fn;
}

describe('EcbSdwProvider', () => {
  let provider: EcbSdwProvider;
  const ORIGINAL_FETCH = global.fetch;

  beforeEach(() => {
    provider = new EcbSdwProvider();
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    jest.restoreAllMocks();
  });

  describe('parseLatestFromCsv', () => {
    it('returns most recent row with numeric OBS_VALUE', () => {
      const csv = [
        'KEY,FREQ,REF_AREA,TIME_PERIOD,OBS_VALUE,OBS_STATUS',
        'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,D,U2,2026-05-13,2.81,A',
        'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,D,U2,2026-05-14,2.83,A',
        'YC.B.U2.EUR.4F.G_N_A.SV_C_YM.SR_10Y,D,U2,2026-05-15,2.85,A',
      ].join('\n');
      const result = provider.parseLatestFromCsv(csv);
      expect(result).toEqual({ date: '2026-05-15', value: 2.85 });
    });

    it('walks back past blank-value trailing rows (ECB common pattern)', () => {
      const csv = [
        'KEY,TIME_PERIOD,OBS_VALUE',
        'x,2026-05-13,2.80',
        'x,2026-05-14,2.83',
        'x,2026-05-15,',
      ].join('\n');
      const result = provider.parseLatestFromCsv(csv);
      expect(result).toEqual({ date: '2026-05-14', value: 2.83 });
    });

    it('returns null when CSV has no header row', () => {
      expect(provider.parseLatestFromCsv('')).toBeNull();
    });

    it('returns null when expected columns are missing', () => {
      const csv = 'KEY,OTHER_COLUMN\nx,y\n';
      expect(provider.parseLatestFromCsv(csv)).toBeNull();
    });

    it('returns null when every row has unparseable values', () => {
      const csv = [
        'KEY,TIME_PERIOD,OBS_VALUE',
        'x,2026-05-15,not-a-number',
      ].join('\n');
      expect(provider.parseLatestFromCsv(csv)).toBeNull();
    });
  });

  describe('getLatestObservation', () => {
    it('returns parsed observation on 200 + valid CSV', async () => {
      const csv = 'TIME_PERIOD,OBS_VALUE\n2026-05-15,2.85\n';
      global.fetch = mockFetchWithCsv(csv);
      const obs = await provider.getLatestObservation('YC', 'X');
      expect(obs).toEqual({ date: '2026-05-15', value: 2.85 });
    });

    it('returns null on 404 (series id changed)', async () => {
      global.fetch = mockFetchWithCsv('', { ok: false, status: 404 });
      expect(await provider.getLatestObservation('YC', 'X')).toBeNull();
    });

    it('returns null on network error', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ETIMEDOUT'));
      expect(await provider.getLatestObservation('YC', 'X')).toBeNull();
    });
  });

  describe('getYieldCurve', () => {
    it('builds curve from all 10 EUR tenors', async () => {
      const rates = [
        '3.0',
        '3.05',
        '2.95',
        '2.90',
        '2.85',
        '2.83',
        '2.84',
        '2.85',
        '3.00',
        '3.10',
      ];
      global.fetch = mockFetchSequence(
        rates.map((r) => ({ csv: `TIME_PERIOD,OBS_VALUE\n2026-05-15,${r}\n` })),
      );
      const curve = await provider.getYieldCurve();
      expect(curve).not.toBeNull();
      expect(curve!.curve).toBe('EUR_AAA_SOVEREIGN');
      expect(curve!.currency).toBe('EUR');
      expect(curve!.provider).toBe('ecb-sdw');
      expect(curve!.points).toHaveLength(10);
    });

    it('returns null when every tenor fails', async () => {
      global.fetch = mockFetchSequence(
        Array.from({ length: 10 }).map(() => ({ ok: false, status: 500 })),
      );
      expect(await provider.getYieldCurve()).toBeNull();
    });

    it('detects inversion when 10Y < 2Y', async () => {
      // Tenors in registry order: 3M, 6M, 1Y, 2Y, 3Y, 5Y, 7Y, 10Y, 20Y, 30Y
      const rates = [
        '3.5',
        '3.4',
        '3.3',
        '3.5',
        '3.2',
        '3.0',
        '2.9',
        '2.8',
        '2.9',
        '3.0',
      ];
      global.fetch = mockFetchSequence(
        rates.map((r) => ({ csv: `TIME_PERIOD,OBS_VALUE\n2026-05-15,${r}\n` })),
      );
      const curve = await provider.getYieldCurve();
      expect(curve!.inverted).toBe(true);
      expect(curve!.invertedDetail).toContain('-0.70');
    });
  });

  describe('getHICP', () => {
    it('returns inflation reading wrapped in DTO', async () => {
      const csv = 'TIME_PERIOD,OBS_VALUE\n2026-04-30,2.3\n';
      global.fetch = mockFetchWithCsv(csv);
      const hicp = await provider.getHICP();
      expect(hicp).toMatchObject({
        value: 2.3,
        provider: 'ecb-sdw',
        units: 'Percent',
        frequency: 'Monthly',
      });
    });
  });

  describe('getECBReferenceRate', () => {
    it('returns EUR/X FX wrapped in DTO', async () => {
      const csv = 'TIME_PERIOD,OBS_VALUE\n2026-05-15,1.0850\n';
      global.fetch = mockFetchWithCsv(csv);
      const fx = await provider.getECBReferenceRate('USD');
      expect(fx).toMatchObject({
        pair: 'EUR/USD',
        base: 'EUR',
        quote: 'USD',
        rate: 1.085,
        provider: 'ecb-sdw',
      });
    });

    it('rejects invalid currency code without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getECBReferenceRate('not-a-ccy')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });

  describe('getKeyRate', () => {
    it('labels DFR key correctly', async () => {
      const csv = 'TIME_PERIOD,OBS_VALUE\n2026-05-15,3.75\n';
      global.fetch = mockFetchWithCsv(csv);
      const rate = await provider.getKeyRate('D.U2.EUR.4F.KR.DFR.LEV');
      expect(rate!.name).toBe('ECB Deposit Facility Rate');
      expect(rate!.rate).toBe(3.75);
    });

    it('rejects malformed key without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getKeyRate('bad key')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
