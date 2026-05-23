import { BloombergHapiProvider } from './bloomberg-hapi.provider';

/**
 * BloombergHapiProvider spec — covers OAuth2 token flow + DataRequest
 * envelope shape + submit endpoint behavior + every Rule-1 honest-degrade.
 *
 * Notably does NOT cover full async polling path; that is documented but
 * gated behind BLOOMBERG_HAPI_ENABLE_ASYNC_POLL and intentionally returns
 * null until production rollout. See bloomberg-hapi.provider.ts for the
 * rationale.
 */

function mockResponseSequence(
  responses: Array<{
    body?: unknown;
    ok?: boolean;
    status?: number;
    statusText?: string;
    headers?: Record<string, string>;
    throws?: Error;
  }>,
) {
  const fn = jest.fn();
  for (const r of responses) {
    if (r.throws) {
      fn.mockRejectedValueOnce(r.throws);
    } else {
      const headers = new Map(Object.entries(r.headers ?? {}));
      fn.mockResolvedValueOnce({
        ok: r.ok ?? true,
        status: r.status ?? 200,
        statusText: r.statusText ?? 'OK',
        headers: { get: (k: string) => headers.get(k) ?? null },
        json: async () => r.body ?? {},
      });
    }
  }
  return fn;
}

const VALID_TOKEN_BODY = {
  access_token: 'bb-mock-bearer',
  token_type: 'Bearer',
  expires_in: 3600,
};

describe('BloombergHapiProvider', () => {
  let provider: BloombergHapiProvider;
  const ORIGINAL_FETCH = global.fetch;
  const ORIG = {
    base: process.env.BLOOMBERG_HAPI_BASE_URL,
    id: process.env.BLOOMBERG_HAPI_CLIENT_ID,
    secret: process.env.BLOOMBERG_HAPI_CLIENT_SECRET,
    acct: process.env.BLOOMBERG_HAPI_ACCOUNT_ID,
    poll: process.env.BLOOMBERG_HAPI_ENABLE_ASYNC_POLL,
  };

  beforeEach(() => {
    provider = new BloombergHapiProvider();
    process.env.BLOOMBERG_HAPI_BASE_URL = 'https://api.bloomberg.com';
    process.env.BLOOMBERG_HAPI_CLIENT_ID = 'cid';
    process.env.BLOOMBERG_HAPI_CLIENT_SECRET = 'csec';
    process.env.BLOOMBERG_HAPI_ACCOUNT_ID = 'cerniq-acct';
    delete process.env.BLOOMBERG_HAPI_ENABLE_ASYNC_POLL;
  });

  afterEach(() => {
    global.fetch = ORIGINAL_FETCH;
    const set = (k: keyof typeof ORIG, v: string | undefined) => {
      if (v === undefined)
        delete process.env[`BLOOMBERG_HAPI_${k.toUpperCase()}`];
    };
    set('base', ORIG.base);
    set('id', ORIG.id);
    set('secret', ORIG.secret);
    set('acct', ORIG.acct);
    set('poll', ORIG.poll);
    jest.restoreAllMocks();
  });

  describe('isConfigured', () => {
    it('true with all four env vars', () => {
      expect(provider.isConfigured()).toBe(true);
    });
    it('false when any single var missing', () => {
      delete process.env.BLOOMBERG_HAPI_BASE_URL;
      expect(provider.isConfigured()).toBe(false);
    });
    it('false when ACCOUNT_ID missing', () => {
      delete process.env.BLOOMBERG_HAPI_ACCOUNT_ID;
      expect(provider.isConfigured()).toBe(false);
    });
  });

  describe('getAccessToken', () => {
    it('returns token on 200', async () => {
      global.fetch = mockResponseSequence([{ body: VALID_TOKEN_BODY }]);
      expect(await provider.getAccessToken()).toBe('bb-mock-bearer');
    });
    it('returns null when not configured', async () => {
      delete process.env.BLOOMBERG_HAPI_CLIENT_ID;
      global.fetch = jest.fn();
      expect(await provider.getAccessToken()).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });
    it('returns null on 401 token response', async () => {
      global.fetch = mockResponseSequence([
        { body: {}, ok: false, status: 401, statusText: 'Unauth' },
      ]);
      expect(await provider.getAccessToken()).toBeNull();
    });
    it('returns null on access_token missing', async () => {
      global.fetch = mockResponseSequence([{ body: { token_type: 'Bearer' } }]);
      expect(await provider.getAccessToken()).toBeNull();
    });
    it('returns null on network error', async () => {
      global.fetch = jest.fn().mockRejectedValueOnce(new Error('ECONNREFUSED'));
      expect(await provider.getAccessToken()).toBeNull();
    });
    it('caches token across calls', async () => {
      const fetchMock = mockResponseSequence([{ body: VALID_TOKEN_BODY }]);
      global.fetch = fetchMock;
      await provider.getAccessToken();
      await provider.getAccessToken();
      expect(fetchMock).toHaveBeenCalledTimes(1);
    });
  });

  describe('buildDataRequest', () => {
    it('produces well-formed DataRequest envelope', () => {
      const req = provider.buildDataRequest({
        security: 'AAPL US Equity',
        requestName: 'test-req',
      });
      expect(req['@type']).toBe('DataRequest');
      expect(req.identifier).toBe('test-req');
      // type-rationale: navigating dynamic Bloomberg request envelope for assertion
      const universe = req.universe as {
        contains: Array<{ identifierValue: string }>;
      };
      expect(universe.contains[0].identifierValue).toBe('AAPL US Equity');
      const fieldList = req.fieldList as {
        contains: Array<{ mnemonic: string }>;
      };
      expect(fieldList.contains).toContainEqual({ mnemonic: 'PX_LAST' });
      expect(fieldList.contains).toContainEqual({ mnemonic: 'PX_VOLUME' });
    });

    it('uses provided fields when supplied', () => {
      const req = provider.buildDataRequest({
        security: 'IBM US Equity',
        requestName: 'x',
        fields: ['PX_LAST', 'NAME'],
      });
      // type-rationale: navigating dynamic Bloomberg request envelope for assertion
      const fieldList = req.fieldList as {
        contains: Array<{ mnemonic: string }>;
      };
      expect(fieldList.contains).toHaveLength(2);
    });
  });

  describe('submitRealtimePriceRequest', () => {
    it('returns requestId on 201 with Location header', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        {
          body: {},
          status: 201,
          headers: {
            Location: '/eap/catalogs/cerniq-acct/requests/req-123abc/',
          },
        },
      ]);
      const id = await provider.submitRealtimePriceRequest('AAPL US Equity');
      expect(id).toBe('req-123abc');
    });

    it('returns null when not configured', async () => {
      delete process.env.BLOOMBERG_HAPI_BASE_URL;
      global.fetch = jest.fn();
      expect(
        await provider.submitRealtimePriceRequest('AAPL US Equity'),
      ).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('rejects malformed security without fetching', async () => {
      global.fetch = jest.fn();
      expect(
        await provider.submitRealtimePriceRequest('bad\n;security'),
      ).toBeNull();
      expect(global.fetch).not.toHaveBeenCalled();
    });

    it('returns null on non-201 response', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: { error: 'bad' }, ok: false, status: 400 },
      ]);
      expect(
        await provider.submitRealtimePriceRequest('AAPL US Equity'),
      ).toBeNull();
    });

    it('returns null when Location header absent', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: {}, status: 201 },
      ]);
      expect(
        await provider.submitRealtimePriceRequest('AAPL US Equity'),
      ).toBeNull();
    });

    it('returns null when Location header malformed', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        {
          body: {},
          status: 201,
          headers: { Location: 'completely/wrong/format' },
        },
      ]);
      expect(
        await provider.submitRealtimePriceRequest('AAPL US Equity'),
      ).toBeNull();
    });

    it('clears token cache on 401', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: {}, ok: false, status: 401 },
      ]);
      const first = await provider.submitRealtimePriceRequest('AAPL US Equity');
      expect(first).toBeNull();
      // Next call should re-auth (token cache cleared)
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        {
          body: {},
          status: 201,
          headers: {
            Location: '/eap/catalogs/cerniq-acct/requests/r2/',
          },
        },
      ]);
      const second =
        await provider.submitRealtimePriceRequest('AAPL US Equity');
      expect(second).toBe('r2');
    });

    it('handles network error defensively', async () => {
      global.fetch = jest
        .fn()
        .mockResolvedValueOnce({
          ok: true,
          status: 200,
          headers: { get: () => null },
          json: async () => VALID_TOKEN_BODY,
        })
        .mockRejectedValueOnce(new Error('ETIMEDOUT'));
      expect(
        await provider.submitRealtimePriceRequest('AAPL US Equity'),
      ).toBeNull();
    });
  });

  describe('getRealtimePrice', () => {
    it('returns null with async-poll disabled even after successful submit (current scaffold posture)', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        {
          body: {},
          status: 201,
          headers: {
            Location: '/eap/catalogs/cerniq-acct/requests/req-xyz/',
          },
        },
      ]);
      const result = await provider.getRealtimePrice('AAPL US Equity');
      expect(result).toBeNull();
    });

    it('returns null when async-poll enabled but polling not yet implemented', async () => {
      process.env.BLOOMBERG_HAPI_ENABLE_ASYNC_POLL = 'true';
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        {
          body: {},
          status: 201,
          headers: {
            Location: '/eap/catalogs/cerniq-acct/requests/req-xyz/',
          },
        },
      ]);
      const result = await provider.getRealtimePrice('AAPL US Equity');
      expect(result).toBeNull();
    });

    it('returns null when submission fails', async () => {
      global.fetch = mockResponseSequence([
        { body: VALID_TOKEN_BODY },
        { body: {}, ok: false, status: 500 },
      ]);
      expect(await provider.getRealtimePrice('AAPL US Equity')).toBeNull();
    });
  });
});
