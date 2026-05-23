import { SECEdgarProvider } from './sec-edgar.provider';

/**
 * SECEdgarProvider spec — covers the auth-missing, CIK-padding, happy-
 * path, and error-mapping branches. Mocks `global.fetch` per-test.
 */

describe('SECEdgarProvider', () => {
  let provider: SECEdgarProvider;
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_UA = process.env.SEC_EDGAR_USER_AGENT;

  beforeEach(() => {
    provider = new SECEdgarProvider();
    process.env.SEC_EDGAR_USER_AGENT = 'cerniq-test contact@cerniq.io';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_UA === undefined) delete process.env.SEC_EDGAR_USER_AGENT;
    else process.env.SEC_EDGAR_USER_AGENT = ORIGINAL_UA;
    jest.restoreAllMocks();
  });

  describe('getRecentFilings', () => {
    it('zero-pads short CIK and hits the correct URL', async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cik: '320193',
          name: 'Apple Inc.',
          filings: {
            recent: {
              accessionNumber: ['0000320193-24-000001'],
              filingDate: ['2024-11-01'],
              form: ['10-K'],
              primaryDocument: ['aapl-20240928.htm'],
              size: [12345],
              isXBRL: [1],
              isInlineXBRL: [1],
            },
          },
        }),
      });
      global.fetch = fetchMock;
      const result = await provider.getRecentFilings('320193');
      expect(result).not.toBeNull();
      expect(result!.cik).toBe('0000320193');
      expect(result!.filings).toHaveLength(1);
      expect(result!.filings[0].form).toBe('10-K');
      expect(result!.filings[0].isXbrl).toBe(true);
      // URL contains the zero-padded CIK.
      const [calledUrl] = fetchMock.mock.calls[0];
      expect(calledUrl).toContain('CIK0000320193.json');
    });

    it('sends the SEC-required User-Agent header', async () => {
      const fetchMock = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          filings: {
            recent: {
              accessionNumber: ['a'],
              filingDate: ['2026-01-01'],
              form: ['10-Q'],
            },
          },
        }),
      });
      global.fetch = fetchMock;
      await provider.getRecentFilings('320193');
      const [, opts] = fetchMock.mock.calls[0];
      expect(opts.headers['User-Agent']).toBe('cerniq-test contact@cerniq.io');
    });

    it('returns null when SEC_EDGAR_USER_AGENT missing (graceful)', async () => {
      delete process.env.SEC_EDGAR_USER_AGENT;
      global.fetch = jest.fn();
      const result = await provider.getRecentFilings('320193');
      expect(result).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null for invalid CIK (non-numeric)', async () => {
      global.fetch = jest.fn();
      expect(await provider.getRecentFilings('not-a-cik')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on HTTP error', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 500,
        statusText: 'Internal Server Error',
        json: async () => ({}),
      });
      expect(await provider.getRecentFilings('320193')).toBeNull();
    });

    it('returns null when filings.recent is missing (malformed response)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({ cik: '320193', name: 'X' }),
      });
      expect(await provider.getRecentFilings('320193')).toBeNull();
    });

    it('returns null on network error', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNRESET'));
      expect(await provider.getRecentFilings('320193')).toBeNull();
    });
  });

  describe('getCompanyConcept', () => {
    it('returns time-series for valid concept', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cik: 320193,
          taxonomy: 'us-gaap',
          tag: 'Assets',
          label: 'Total Assets',
          units: {
            USD: [
              {
                accn: '0000320193-24-000001',
                end: '2024-09-28',
                val: 364980000000,
                fy: 2024,
                fp: 'FY',
                form: '10-K',
                filed: '2024-11-01',
              },
            ],
          },
        }),
      });
      const result = await provider.getCompanyConcept('320193', 'Assets');
      expect(result).not.toBeNull();
      expect(result!.concept).toBe('Assets');
      expect(result!.units.USD).toHaveLength(1);
      expect(result!.units.USD[0].val).toBe(364980000000);
    });

    it('returns null on 404 (concept not reported by this CIK)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: false,
        status: 404,
        statusText: 'Not Found',
        json: async () => ({}),
      });
      expect(await provider.getCompanyConcept('320193', 'Assets')).toBeNull();
    });

    it('rejects invalid concept names without making a request', async () => {
      global.fetch = jest.fn();
      expect(
        await provider.getCompanyConcept('320193', 'not a valid concept!'),
      ).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('filters malformed data points (missing val/end/accn/form/filed)', async () => {
      global.fetch = jest.fn().mockResolvedValueOnce({
        ok: true,
        status: 200,
        json: async () => ({
          cik: 320193,
          taxonomy: 'us-gaap',
          tag: 'Assets',
          label: 'Total Assets',
          units: {
            USD: [
              {
                accn: 'a1',
                end: '2024-09-28',
                val: 100,
                form: '10-K',
                filed: '2024-11-01',
              },
              {
                accn: 'a2',
                end: '2024-06-30',
                /* missing val */ form: '10-Q',
                filed: '2024-08-01',
              },
              {
                /* missing accn */ end: '2024-03-31',
                val: 200,
                form: '10-Q',
                filed: '2024-05-01',
              },
            ],
          },
        }),
      });
      const result = await provider.getCompanyConcept('320193', 'Assets');
      expect(result!.units.USD).toHaveLength(1);
      expect(result!.units.USD[0].val).toBe(100);
    });
  });
});
