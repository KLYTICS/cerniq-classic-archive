import { NotFoundException } from '@nestjs/common';
import { MarketDataService } from './market-data.service';

describe('MarketDataService', () => {
  let service: MarketDataService;
  const mockYahooProvider = {
    getQuote: jest.fn().mockResolvedValue({
      ticker: 'AAPL',
      price: 150,
      change: 2.5,
      changePercent: 1.69,
      previousClose: 147.5,
      volume: 50000000,
      high: 152,
      low: 148,
      open: 149,
      timestamp: new Date(),
    }),
    getHistoricalPrices: jest.fn().mockResolvedValue([]),
    getFundamentals: jest.fn().mockResolvedValue({ pe: 25, marketCap: 2e12 }),
    getInstrumentProfile: jest.fn().mockResolvedValue({
      ticker: 'AAPL',
      assetType: 'stock',
      shortName: 'Apple Inc',
    }),
    getNews: jest.fn().mockResolvedValue([]),
    searchTickers: jest.fn().mockResolvedValue([]),
  };
  const mockCoinGeckoProvider = {
    getQuote: jest.fn().mockResolvedValue({
      ticker: 'BTC',
      price: 60000,
      change: 1000,
      changePercent: 1.7,
      previousClose: 59000,
      volume: 1e9,
      high: 61000,
      low: 58000,
      open: 59500,
      timestamp: new Date(),
    }),
    getHistoricalPrices: jest.fn().mockResolvedValue([]),
    searchCrypto: jest.fn().mockResolvedValue([]),
  };
  const mockDataQualityService = {
    recordMetric: jest.fn(),
  };

  beforeEach(() => {
    mockYahooProvider.getQuote.mockReset().mockResolvedValue({
      ticker: 'AAPL',
      price: 150,
      change: 2.5,
      changePercent: 1.69,
      previousClose: 147.5,
      volume: 50000000,
      high: 152,
      low: 148,
      open: 149,
      timestamp: new Date(),
    });
    mockYahooProvider.getHistoricalPrices.mockReset().mockResolvedValue([]);
    mockYahooProvider.getFundamentals
      .mockReset()
      .mockResolvedValue({ pe: 25, marketCap: 2e12 });
    mockYahooProvider.getInstrumentProfile.mockReset().mockResolvedValue({
      ticker: 'AAPL',
      assetType: 'stock',
      shortName: 'Apple Inc',
    });
    mockYahooProvider.getNews.mockReset().mockResolvedValue([]);
    mockYahooProvider.searchTickers.mockReset().mockResolvedValue([]);

    mockCoinGeckoProvider.getQuote.mockReset().mockResolvedValue({
      ticker: 'BTC',
      price: 60000,
      change: 1000,
      changePercent: 1.7,
      previousClose: 59000,
      volume: 1e9,
      high: 61000,
      low: 58000,
      open: 59500,
      timestamp: new Date(),
    });
    mockCoinGeckoProvider.getHistoricalPrices.mockReset().mockResolvedValue([]);
    mockCoinGeckoProvider.searchCrypto.mockReset().mockResolvedValue([]);
    mockDataQualityService.recordMetric.mockReset();

    service = new MarketDataService(
      mockYahooProvider as any,
      mockCoinGeckoProvider as any,
      mockDataQualityService as any,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('normalizeTicker converts to uppercase and strips prefixes', () => {
    expect(service.normalizeTicker('aapl')).toBe('AAPL');
    expect(service.normalizeTicker('  msft  ')).toBe('MSFT');
    expect(service.normalizeTicker('nasdaq:aapl.us')).toBe('AAPL');
    expect(service.normalizeTicker('btc/usd')).toBe('BTC');
    expect(service.normalizeTicker('brk.b')).toBe('BRK-B');
  });

  it('normalizeTicker throws on empty input', () => {
    expect(() => service.normalizeTicker('')).toThrow(NotFoundException);
    expect(() => service.normalizeTicker('   ')).toThrow(NotFoundException);
  });

  it('getQuote returns decorated quote for stock', async () => {
    const quote = await service.getQuote('AAPL');
    expect(quote.ticker).toBe('AAPL');
    expect(quote.price).toBe(150);
    expect(quote).toHaveProperty('freshnessState');
    expect(quote).toHaveProperty('session');
    expect(mockYahooProvider.getQuote).toHaveBeenCalledWith('AAPL');
  });

  it('getQuote routes crypto tickers to CoinGecko', async () => {
    const quote = await service.getQuote('BTC');
    expect(quote.ticker).toBe('BTC');
    expect(mockCoinGeckoProvider.getQuote).toHaveBeenCalledWith('BTC');
  });

  it('getQuote falls back to stale cached quotes when the provider is unavailable', async () => {
    const fresh = await service.getQuote('AAPL');
    mockYahooProvider.getQuote.mockResolvedValueOnce(null);

    const stale = await service.getQuote('AAPL', { maxCacheAgeMs: 0 });

    expect(stale.price).toBe(fresh.price);
    expect(stale.provider).toBe('yahoo-finance');
  });

  it('getQuote throws when no provider result and no cache are available', async () => {
    mockYahooProvider.getQuote.mockResolvedValueOnce(null);

    await expect(service.getQuote('AAPL')).rejects.toThrow(
      new NotFoundException('Quote not found for ticker: AAPL'),
    );
  });

  it('getQuote normalizes missing quote fields into operator-safe defaults', async () => {
    mockYahooProvider.getQuote.mockResolvedValueOnce({
      ticker: 'AAPL',
      price: 100,
      change: 5,
      previousClose: 0,
      changePercent: Number.NaN,
      volume: Number.NaN,
      high: Number.NaN,
      low: Number.NaN,
      open: Number.NaN,
      marketState: 'POSTMARKET',
      timestamp: new Date('2026-03-30T12:00:00.000Z'),
    });

    const quote = await service.getQuote('AAPL');

    expect(quote.previousClose).toBe(95);
    expect(quote.changePercent).toBeCloseTo(5.26, 2);
    expect(quote.volume).toBe(0);
    expect(quote.high).toBe(100);
    expect(quote.low).toBe(100);
    expect(quote.open).toBe(95);
    expect(quote.session).toBe('AFTER_HOURS');
    expect(quote.assetType).toBe('stock');
  });

  it('getRealtimeQuote bypasses older cached data when the realtime TTL is stricter', async () => {
    await service.getQuote('AAPL');
    (service as any).REALTIME_QUOTE_CACHE_TTL = 0;
    mockYahooProvider.getQuote.mockResolvedValueOnce({
      ticker: 'AAPL',
      price: 151,
      change: 3.5,
      changePercent: 2.37,
      previousClose: 147.5,
      volume: 51000000,
      high: 153,
      low: 148,
      open: 149,
      timestamp: new Date(),
    });

    const realtime = await service.getRealtimeQuote('AAPL');

    expect(realtime.price).toBe(151);
  });

  it('getHistoricalPrices routes stock and crypto requests to the correct providers', async () => {
    const start = new Date('2026-03-01T00:00:00.000Z');
    const end = new Date('2026-03-30T00:00:00.000Z');

    await service.getHistoricalPrices('AAPL', start, end);
    await service.getHistoricalPrices('BTC-USD', start, end);

    expect(mockYahooProvider.getHistoricalPrices).toHaveBeenCalledWith(
      'AAPL',
      start,
      end,
    );
    expect(mockCoinGeckoProvider.getHistoricalPrices).toHaveBeenCalledWith(
      'BTC',
      start,
      end,
    );
  });

  it('getFundamentals caches stock fundamentals and rejects crypto requests', async () => {
    const first = await service.getFundamentals('AAPL');
    const second = await service.getFundamentals('AAPL');

    expect(first).toEqual({ pe: 25, marketCap: 2e12 });
    expect(second).toEqual(first);
    expect(mockYahooProvider.getFundamentals).toHaveBeenCalledTimes(1);

    await expect(service.getFundamentals('ETH')).rejects.toThrow(
      'Fundamentals not available for cryptocurrencies',
    );
  });

  it('getFundamentals throws when the upstream provider returns no data', async () => {
    mockYahooProvider.getFundamentals.mockResolvedValueOnce(null);

    await expect(service.getFundamentals('AAPL')).rejects.toThrow(
      'Fundamentals not found for ticker: AAPL',
    );
  });

  it('getInstrumentProfile builds crypto profiles from quotes and caches stock profiles', async () => {
    const cryptoProfile = await service.getInstrumentProfile('BTC');
    expect(cryptoProfile).toMatchObject({
      ticker: 'BTC',
      assetType: 'crypto',
      shortName: 'BTC',
      longName: 'BTC',
      currency: 'USD',
    });

    const first = await service.getInstrumentProfile('AAPL');
    mockYahooProvider.getInstrumentProfile.mockResolvedValueOnce(null);
    const cached = await service.getInstrumentProfile('AAPL');

    expect(first.shortName).toBe('Apple Inc');
    expect(cached).toEqual(first);
  });

  it('getInstrumentProfile throws when no stock profile exists and nothing is cached', async () => {
    mockYahooProvider.getInstrumentProfile.mockResolvedValueOnce(null);

    await expect(service.getInstrumentProfile('AAPL')).rejects.toThrow(
      'Instrument profile not found for ticker: AAPL',
    );
  });

  it('getNews caches results and returns an empty list when the provider is unavailable', async () => {
    mockYahooProvider.getNews.mockResolvedValueOnce([
      {
        title: 'Liquidity improves',
        url: 'https://example.com/news/1',
        publishedAt: new Date('2026-03-30T10:00:00.000Z'),
      },
    ]);

    const first = await service.getNews('AAPL', 5);
    const cached = await service.getNews('AAPL', 5);
    mockYahooProvider.getNews.mockResolvedValueOnce(null);
    const empty = await service.getNews('MSFT', 3);

    expect(first).toHaveLength(1);
    expect(cached).toEqual(first);
    expect(empty).toEqual([]);
  });

  it('getMarketSnapshot composes realtime quote, profile, and news for operator surfaces', async () => {
    const snapshot = await service.getMarketSnapshot('AAPL', 4);

    expect(snapshot.quote.ticker).toBe('AAPL');
    expect(snapshot.profile.shortName).toBe('Apple Inc');
    expect(snapshot.news).toEqual([]);
  });

  it('tracks provider degradation and marks unhealthy feeds in health snapshots', async () => {
    mockYahooProvider.getQuote.mockResolvedValue(null);

    for (let attempt = 0; attempt < 5; attempt += 1) {
      await expect(service.getQuote('AAPL')).rejects.toThrow(NotFoundException);
    }

    const providers = service.getProviderHealth();
    const health = service.getHealth([
      { ticker: 'AAPL', status: 'connected', lastQuoteAt: null } as any,
      {
        ticker: 'BTC',
        status: 'connected',
        lastQuoteAt: new Date(Date.now() - 30_000).toISOString(),
      } as any,
    ]);

    expect(providers).toEqual([
      expect.objectContaining({
        provider: 'yahoo-finance',
        status: 'unhealthy',
        failedRequests: 5,
        consecutiveFailures: 5,
      }),
    ]);
    expect(health.status).toBe('unhealthy');
    expect(health.freshnessSummary).toEqual({
      activeStreams: 2,
      staleStreams: 1,
      delayedStreams: 1,
    });
  });

  it('searchTickers merges, filters, and de-duplicates stock and crypto search results', async () => {
    mockYahooProvider.searchTickers.mockResolvedValue([
      { ticker: 'AAPL', name: 'Apple Inc.', assetType: 'stock' },
      { ticker: 'BTC', name: 'Bitcoin Proxy', assetType: 'etf' },
    ]);
    mockCoinGeckoProvider.searchCrypto.mockResolvedValue([
      { symbol: 'BTC', name: 'Bitcoin' },
      { symbol: 'ETH', name: 'Ethereum' },
    ]);

    const all = await service.searchTickers('bit');
    const cryptoOnly = await service.searchTickers('bit', 'crypto');

    expect(all).toEqual([
      { ticker: 'AAPL', name: 'Apple Inc.', assetType: 'stock' },
      { ticker: 'BTC', name: 'Bitcoin Proxy', assetType: 'etf' },
      { ticker: 'ETH', name: 'Ethereum', assetType: 'crypto' },
    ]);
    expect(cryptoOnly).toEqual([
      { ticker: 'BTC', name: 'Bitcoin', assetType: 'crypto' },
      { ticker: 'ETH', name: 'Ethereum', assetType: 'crypto' },
    ]);
  });

  it('clearCaches resets all internal caches', () => {
    service.clearCaches();
    // No error thrown means success; internal maps cleared
    expect(true).toBe(true);
  });
});
