import { RefinitivEikonProvider } from './refinitiv-eikon.provider';

/**
 * RefinitivEikonProvider spec — covers OAuth2 token flow + snapshot
 * pricing parse + news parse + every Rule-1 honest-degrade path.
 */

function mockResponseSequence(
  responses: Array<{
    body?: unknown;
    ok?: boolean;
    status?: number;
    statusText?: string;
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
        statusText: r.statusText ?? 'OK',
        json: async () => r.body ?? {},
      });
    }
  }
  return fn;
}

const VALID_TOKEN_BODY = {
  access_token: 'eyJxxxxx-mock-token',
  token_type: 'Bearer',
  expires_in: 600,
  scope: 'trapi.data.pricing.read trapi.data.news.read',
};

const VALID_SNAPSHOT_BODY = {
  data: {
    universe: [{ Instrument: 'AAPL.O' }],
    fields: [
      { name: 'BID' },
      { name: 'ASK' },
      { name: 'TRDPRC_1' },
      { name: 'OPEN_PRC' },
      { name: 'HIGH_1' },
      { name: 'LOW_1' },
      { name: 'HST_CLOSE' },
      { name: 'NUM_MOVES' },
      { name: 'CF_VOLUME' },
    ],
    values: [
      [190.1, 190.2, 190.15, 189.5, 191.0, 188.75, 189.0, 4567, 50_000_000],
    ],
  },
};

describe('RefinitivEikonProvider', () => {
  let provider: RefinitivEikonProvider;
  const ORIGINAL_FETCH = global.fetch;
  const ORIGINAL_KEY = process.env.REFINITIV_APP_KEY;
  const ORIGINAL_SECRET = process.env.REFINITIV_APP_SECRET;

  beforeEach(() => {
    provider = new RefinitivEikonProvider();
    process.env.REFINITIV_APP_KEY = 'test-app-key';
    process.env.REFINITIV_APP_SECRET = 'test-app-secret';
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    if (ORIGINAL_KEY === undefined) delete process.env.REFINITIV_APP_KEY;
    else process.env.REFINITIV_APP_KEY = ORIGINAL_KEY;
    if (ORIGINAL_SECRET === undefined) delete process.env.REFINITIV_APP_SECRET;
    else process.env.REFINITIV_APP_SECRET = ORIGINAL_SECRET;
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('true when both env vars present', () => {
      expect(provider.isConfigured()).toBe(true);
    });

    it('false when REFINITIV_APP_KEY missing', () => {
      delete process.env.REFINITIV_APP_KEY;
      expect(provider.isConfigured()).toBe(false);
    });

    it('false when REFINITIV_APP_SECRET missing', () => {
      delete process.env.REFINITIV_APP_SECRET;
      expect(provider.isConfigured()).toBe(false);
    });

    it('false when env vars blank', () => {
      process.env.REFINITIV_APP_KEY = '   ';
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('returns token on successful OAuth2 response', async () => {
      global.fetch = mockResponseSequence([{ body: VALID_TOKEN_BODY }]);
      const token = await provider.getAccessToken();
      expect(token).toBe('eyJxxxxx-mock-token');
    });

    it('returns null when credentials missing (no fetch)', async () => {
      delete process.env.REFINITIV_APP_KEY;
      global.fetch = jest.fn();
      expect(await provider.getAccessToken()).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on non-200 token response', async () => {
      global.fetch = mockResponseSequence([
        {
          body: { error: 'invalid_client' },
          ok: false,
          status: 401,
          statusText: 'Unauthorized',
        },
      ]);
      expect(await provider.getAccessToken()).toBeNull();
    });

    it('returns null when access_token field missing', async () => {
      global.fetch = mockResponseSequence([{ body: { token_type: 'Bearer' } }]);
      expect(await provider.getAccessToken()).toBeNull();
    });

    it('returns null on network error', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ENETUNREACH'));
      expect(await provider.getAccessToken()).toBeNull();
    });

    it('caches token across calls (single fetch)', async () => {
      const fetchMock = mockResponseSequence([{ body: VALID_TOKEN_BODY }]);
      global.fetch = fetchMock;
      const t1 = await provider.getAccessToken();
      const t2 = await provider.getAccessToken();
      expect(t1).toBe(t2);
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });

    it('uses default 600s TTL when expires_in missing', async () => {
      global.fetch = mockResponseSequence([
        { body: { access_token: 'short-token', token_type: 'Bearer' } },
      ]);
      const token = await provider.getAccessToken();
      expect(token).toBe('short-token');
    });
  });

  describe('parseSnapshot', () => {
    it('parses standard snapshot body into QuoteDto', () => {
      const dto = provider.parseSnapshot('AAPL.O', VALID_SNAPSHOT_BODY);
      expect(dto).not.toBeNull();
      expect(dto!.ticker).toBe('AAPL.O');
      expect(dto!.price).toBe(190.15);
      expect(dto!.previousClose).toBe(189.0);
      expect(dto!.change).toBeCloseTo(1.15, 5);
      expect(dto!.changePercent).toBeCloseTo((1.15 / 189.0) * 100, 4);
      expect(dto!.volume).toBe(50_000_000);
      expect(dto!.provider).toBe('refinitiv-eikon');
    });

    it('returns null when data envelope missing', () => {
      expect(provider.parseSnapshot('AAPL.O', {})).toBeNull();
    });

    it('returns null when fields/values absent', () => {
      expect(provider.parseSnapshot('AAPL.O', { data: {} })).toBeNull();
    });

    it('returns null when TRDPRC_1 (price) missing', () => {
      const body = {
        data: {
          fields: [{ name: 'BID' }, { name: 'ASK' }],
          values: [[100, 101]],
        },
      };
      expect(provider.parseSnapshot('AAPL.O', body)).toBeNull();
    });

    it('handles missing HST_CLOSE gracefully (change=0)', () => {
      const body = {
        data: {
          fields: [{ name: 'TRDPRC_1' }],
          values: [[100]],
        },
      };
      const dto = provider.parseSnapshot('AAPL.O', body);
      expect(dto!.price).toBe(100);
      expect(dto!.change).toBe(0);
      expect(dto!.changePercent).toBe(0);
    });

    it('returns null on non-object body', () => {
      expect(provider.parseSnapshot('AAPL.O', null)).toBeNull();
      expect(provider.parseSnapshot('AAPL.O', 'string')).toBeNull();
    });
  });

  describe('getRealtimePrice', () => {
    it('happy path: token then snapshot', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: VALID_SNAPSHOT_BODY },
      ]);
      const dto = await provider.getRealtimePrice('AAPL.O');
      expect(dto).not.toBeNull();
      expect(dto!.ticker).toBe('AAPL.O');
      expect(dto!.price).toBe(190.15);
      expect(dto!.provider).toBe('refinitiv-eikon');
    });

    it('returns null when not configured (no fetch)', async () => {
      delete process.env.REFINITIV_APP_KEY;
      global.fetch = jest.fn();
      expect(await provider.getRealtimePrice('AAPL.O')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects malformed RIC without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getRealtimePrice('not a ric!')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null when token fetch fails', async () => {
      global.fetch = mockResponseSequence([
        { body: {}, ok: false, status: 500, statusText: 'Server' },
      ]);
      expect(await provider.getRealtimePrice('AAPL.O')).toBeNull();
    });

    it('clears token cache on 401 from snapshot endpoint', async () => {
      const fetchMock = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: { error: 'unauthorized' }, ok: false, status: 401 },
      ]);
      global.fetch = fetchMock;
      const result = await provider.getRealtimePrice('AAPL.O');
      expect(result).toBeNull();
      // Subsequent call should re-auth (token cache cleared)
      const refetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: VALID_SNAPSHOT_BODY },
      ]);
      global.fetch = refetch;
      const second = await provider.getRealtimePrice('AAPL.O');
      expect(second).not.toBeNull();
      expect(refetch).toHaveBeenCalledTimes(2); // token + snapshot
    });

    it('returns null on snapshot HTTP error', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: {}, ok: false, status: 503 },
      ]);
      expect(await provider.getRealtimePrice('AAPL.O')).toBeNull();
    });

    it('accepts currency-pair RIC (EUR=)', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: VALID_SNAPSHOT_BODY },
      ]);
      const dto = await provider.getRealtimePrice('EUR=');
      expect(dto).not.toBeNull();
    });
  });

  describe('parseHeadlines', () => {
    it('parses headline list', () => {
      const body = {
        data: {
          headlines: [
            {
              id: 'urn:rdp:foo:1',
              title: 'Apple beats Q1 earnings',
              source: 'Reuters',
              link: 'https://refinitiv/news/1',
              firstCreated: '2026-05-15T18:00:00Z',
            },
            {
              id: 'urn:rdp:foo:2',
              title: 'Apple announces new product',
              source: 'Bloomberg',
              link: 'https://refinitiv/news/2',
              firstCreated: '2026-05-15T17:00:00Z',
            },
          ],
        },
      };
      const out = provider.parseHeadlines(body);
      expect(out).toHaveLength(2);
      expect(out![0].title).toBe('Apple beats Q1 earnings');
      expect(out![0].publisher).toBe('Reuters');
    });

    it('skips entries missing required fields', () => {
      const body = {
        data: {
          headlines: [
            { id: 'a' }, // missing title
            { title: 'b' }, // missing id
            { id: 'c', title: 'real entry' },
          ],
        },
      };
      const out = provider.parseHeadlines(body);
      expect(out).toHaveLength(1);
      expect(out![0].id).toBe('c');
    });

    it('returns null on missing envelope', () => {
      expect(provider.parseHeadlines({})).toBeNull();
    });
  });

  describe('getNews', () => {
    it('rejects empty query without fetching', async () => {
      global.fetch = jest.fn();
      expect(await provider.getNews('')).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects out-of-bounds limit', async () => {
      global.fetch = jest.fn();
      expect(await provider.getNews('Apple', 0)).toBeNull();
      expect(await provider.getNews('Apple', 101)).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('happy path returns parsed headlines', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        {
          body: {
            data: {
              headlines: [
                {
                  id: 'a',
                  title: 'Apple news',
                  source: 'Reuters',
                  link: 'https://x',
                  firstCreated: '2026-05-15T18:00:00Z',
                },
              ],
            },
          },
        },
      ]);
      const news = await provider.getNews('Apple');
      expect(news).toHaveLength(1);
      expect(news![0].title).toBe('Apple news');
    });
  });
});
