import { AlphaVantageProvider } from './alpha-vantage.provider';

/**
 * AlphaVantageProvider spec — covers auth/rate-limit/error sentinels +
 * quote / FX / RSI happy paths + defensive parsing.
 */

function mockFetchJson(
  body: unknown,
  opts: { ok?: boolean; status?: number } = {},
) {
  return jest.fn().mockResolvedValueOnce({
    ok: opts.ok ?? true,
    status: opts.status ?? 200,
    statusText: 'OK',
    json: async () => body,
  });
}

describe('AlphaVantageProvider', () => {
  let provider: AlphaVantageProvider;
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_KEY = process.env.ALPHA_VANTAGE_API_KEY;

  beforeEach(() => {
    provider = new AlphaVantageProvider();
    process.env.ALPHA_VANTAGE_API_KEY = 'test-key-zzz';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_KEY === undefined) delete process.env.ALPHA_VANTAGE_API_KEY;
    else process.env.ALPHA_VANTAGE_API_KEY = ORIGINAL_KEY;
    jest.restoreAllMocks();
  });

  describe('getQuote', () => {
    it('returns parsed quote on Global Quote success', async () => {
      global.fetch = mockFetchJson({
        'Global Quote': {
          '01. symbol': 'IBM',
          '02. open': '180.00',
          '03. high': '182.50',
          '04. low': '179.10',
          '05. price': '181.45',
          '06. volume': '4567890',
          '07. latest trading day': '2026-05-15',
          '08. previous close': '180.30',
          '09. change': '1.15',
          '10. change percent': '0.6378%',
        },
      });
      const quote = await provider.getQuote('IBM');
      expect(quote).toMatchObject({
        ticker: 'IBM',
        price: 181.45,
        change: 1.15,
        changePercent: 0.6378,
        provider: 'alpha-vantage',
      });
    });

    it('returns null when ALPHA_VANTAGE_API_KEY missing', async () => {
      delete process.env.ALPHA_VANTAGE_API_KEY;
      global.fetch = jest.fn();
      expect(await provider.getQuote('IBM')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on rate-limit Note sentinel (Rule 1)', async () => {
      global.fetch = mockFetchJson({
        Note: 'Thank you for using Alpha Vantage! Our standard API rate limit is 25 requests per day.',
      });
      expect(await provider.getQuote('IBM')).toBeNull();
    });

    it('returns null on Error Message sentinel (invalid symbol)', async () => {
      global.fetch = mockFetchJson({
        'Error Message':
          'Invalid API call. Please retry or visit the documentation.',
      });
      expect(await provider.getQuote('IBM')).toBeNull();
    });

    it('returns null on Information sentinel (premium-required endpoint)', async () => {
      global.fetch = mockFetchJson({
        Information: 'This endpoint requires a premium subscription.',
      });
      expect(await provider.getQuote('IBM')).toBeNull();
    });

    it('rejects malformed symbol without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getQuote('not a symbol')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on empty Global Quote object', async () => {
      global.fetch = mockFetchJson({ 'Global Quote': {} });
      expect(await provider.getQuote('IBM')).toBeNull();
    });

    it('returns null when essential fields (price / latest trading day) missing', async () => {
      global.fetch = mockFetchJson({
        'Global Quote': { '01. symbol': 'IBM' },
      });
      expect(await provider.getQuote('IBM')).toBeNull();
    });

    it('handles non-2xx HTTP response defensively', async () => {
      global.fetch = mockFetchJson({}, { ok: false, status: 502 });
      expect(await provider.getQuote('IBM')).toBeNull();
    });

    it('handles network error defensively', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ENETUNREACH'));
      expect(await provider.getQuote('IBM')).toBeNull();
    });
  });

  describe('getFXRate', () => {
    it('returns parsed FX rate on success', async () => {
      global.fetch = mockFetchJson({
        'Realtime Currency Exchange Rate': {
          '1. From_Currency Code': 'USD',
          '2. From_Currency Name': 'United States Dollar',
          '3. To_Currency Code': 'EUR',
          '4. To_Currency Name': 'Euro',
          '5. Exchange Rate': '0.92340000',
          '6. Last Refreshed': '2026-05-15 18:00:00',
          '7. Time Zone': 'UTC',
          '8. Bid Price': '0.92330000',
          '9. Ask Price': '0.92350000',
        },
      });
      const fx = await provider.getFXRate('USD', 'EUR');
      expect(fx).toMatchObject({
        pair: 'USD/EUR',
        base: 'USD',
        quote: 'EUR',
        rate: 0.9234,
        provider: 'alpha-vantage',
      });
    });

    it('rejects invalid currency codes without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getFXRate('USD', 'invalid')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on rate-limit sentinel', async () => {
      global.fetch = mockFetchJson({ Note: 'Rate limit hit.' });
      expect(await provider.getFXRate('USD', 'EUR')).toBeNull();
    });
  });

  describe('getRSI', () => {
    it('returns most recent RSI value from technical analysis response', async () => {
      global.fetch = mockFetchJson({
        'Meta Data': {
          '1: Symbol': 'IBM',
          '2: Indicator': 'Relative Strength Index (RSI)',
        },
        'Technical Analysis: RSI': {
          '2026-05-13': { RSI: '50.10' },
          '2026-05-14': { RSI: '52.30' },
          '2026-05-15': { RSI: '54.80' },
        },
      });
      const rsi = await provider.getRSI('IBM', 'daily', 14);
      expect(rsi).toMatchObject({
        symbol: 'IBM',
        interval: 'daily',
        timePeriod: 14,
        rsi: 54.8,
        asOf: '2026-05-15',
        provider: 'alpha-vantage',
      });
    });

    it('rejects invalid interval without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getRSI('IBM', 'invalid-interval')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects out-of-bounds time period', async () => {
      global.fetch = jest.fn();
      expect(await provider.getRSI('IBM', 'daily', 500)).toBeNull();
      expect(await provider.getRSI('IBM', 'daily', 1)).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
  });
});
