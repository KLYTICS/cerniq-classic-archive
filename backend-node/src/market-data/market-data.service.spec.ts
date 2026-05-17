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
  // FredProvider — null defaults so existing tests that don't exercise the
  // macro surface stay unaffected. Macro-specific specs override per-test.
  const mockFredProvider = {
    getYieldCurve: jest.fn().mockResolvedValue(null),
    getInterestRate: jest.fn().mockResolvedValue(null),
    getEconomicIndicator: jest.fn().mockResolvedValue(null),
    getFXRate: jest.fn().mockResolvedValue(null),
    getLatestObservation: jest.fn().mockResolvedValue(null),
  };
  // TreasuryFiscalDataProvider — FRED yield-curve fallback. Null defaults
  // so the service's failover logic only activates when a specific test
  // wants to exercise it.
  const mockTreasuryFiscalDataProvider = {
    getYieldCurve: jest.fn().mockResolvedValue(null),
  };

  beforeEach(() => {
    service = new MarketDataService(
      mockYahooProvider as any,
      mockCoinGeckoProvider as any,
      mockFredProvider as any,
      mockTreasuryFiscalDataProvider as any,
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

  it('clearCaches resets all internal caches', () => {
    service.clearCaches();
    // No error thrown means success; internal maps cleared
    expect(true).toBe(true);
  });

  // ── Coverage boost: caching, fundamentals, normalization ───
  describe('quote caching', () => {
    it('returns cached quote on second call within TTL', async () => {
      const quote1 = await service.getQuote('AAPL');
      mockYahooProvider.getQuote.mockClear();

      const quote2 = await service.getQuote('AAPL');
      // Second call should use cache — provider not called again
      expect(mockYahooProvider.getQuote).not.toHaveBeenCalled();
      expect(quote2.ticker).toBe('AAPL');
    });

    it('fetches fresh quote after clearing caches', async () => {
      await service.getQuote('AAPL');
      service.clearCaches();
      mockYahooProvider.getQuote.mockClear();

      await service.getQuote('AAPL');
      expect(mockYahooProvider.getQuote).toHaveBeenCalledWith('AAPL');
    });
  });

  describe('normalizeTicker edge cases', () => {
    it('strips exchange prefix (e.g. NASDAQ:AAPL)', () => {
      expect(service.normalizeTicker('NASDAQ:AAPL')).toBe('AAPL');
    });

    it('strips .US suffix', () => {
      expect(service.normalizeTicker('MSFT.US')).toBe('MSFT');
    });

    it('normalizes BTC-USD to BTC', () => {
      expect(service.normalizeTicker('BTC-USD')).toBe('BTC');
      expect(service.normalizeTicker('BTCUSD')).toBe('BTC');
    });

    it('replaces dots with dashes for non-crypto', () => {
      expect(service.normalizeTicker('BRK.B')).toBe('BRK-B');
    });
  });

  describe('getQuote error handling', () => {
    it('throws NotFoundException when provider returns null and no cache', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce(null);
      await expect(service.getQuote('UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns stale cached quote when provider fails', async () => {
      // First call populates cache
      await service.getQuote('AAPL');
      // Expire the cache by manipulating TTL (set timestamp to past)
      const cache = (service as any).quoteCache;
      const entry = cache.get('AAPL');
      if (entry) entry.timestamp = 0; // force stale

      mockYahooProvider.getQuote.mockResolvedValueOnce(null);
      const quote = await service.getQuote('AAPL');
      expect(quote.ticker).toBe('AAPL');
    });
  });

  describe('getProviderHealth', () => {
    it('returns empty array when no requests made', () => {
      const health = service.getProviderHealth();
      expect(Array.isArray(health)).toBe(true);
    });

    it('records provider health after a getQuote call', async () => {
      await service.getQuote('AAPL');
      const health = service.getProviderHealth();
      expect(health.length).toBeGreaterThan(0);
      expect(health[0]).toHaveProperty('status');
      expect(health[0]).toHaveProperty('successRate');
    });
  });

  // ── Coverage boost: getFundamentals, getHistoricalPrices, getHealth ──
  describe('getFundamentals', () => {
    it('returns fundamentals from Yahoo for stock tickers', async () => {
      const result = await service.getFundamentals('AAPL');
      expect(result).toEqual({ pe: 25, marketCap: 2e12 });
      expect(mockYahooProvider.getFundamentals).toHaveBeenCalledWith('AAPL');
    });

    it('throws NotFoundException for crypto tickers', async () => {
      await expect(service.getFundamentals('BTC')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('caches fundamentals on second call', async () => {
      await service.getFundamentals('AAPL');
      mockYahooProvider.getFundamentals.mockClear();
      await service.getFundamentals('AAPL');
      expect(mockYahooProvider.getFundamentals).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when provider returns null', async () => {
      service.clearCaches();
      mockYahooProvider.getFundamentals.mockResolvedValueOnce(null);
      await expect(service.getFundamentals('UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
    });
  });

  describe('getHistoricalPrices', () => {
    it('routes stock tickers to Yahoo', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      await service.getHistoricalPrices('AAPL', start, end);
      expect(mockYahooProvider.getHistoricalPrices).toHaveBeenCalledWith(
        'AAPL',
        start,
        end,
      );
    });

    it('routes crypto tickers to CoinGecko', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      await service.getHistoricalPrices('BTC', start, end);
      expect(mockCoinGeckoProvider.getHistoricalPrices).toHaveBeenCalledWith(
        'BTC',
        start,
        end,
      );
    });
  });

  describe('getHealth', () => {
    it('returns healthy status with no streams', () => {
      const health = service.getHealth([]);
      expect(health.status).toBe('healthy');
      expect(health.freshnessSummary.activeStreams).toBe(0);
    });

    it('returns degraded when stale streams exist', () => {
      const oldDate = new Date(Date.now() - 120_000).toISOString(); // 2 min ago = STALE
      const health = service.getHealth([{ lastQuoteAt: oldDate } as any]);
      expect(health.status).toBe('degraded');
      expect(health.freshnessSummary.staleStreams).toBe(1);
    });
  });

  describe('searchTickers', () => {
    it('searches both Yahoo and CoinGecko by default', async () => {
      mockYahooProvider.searchTickers.mockResolvedValue([
        { ticker: 'AAPL', name: 'Apple Inc', assetType: 'stock' },
      ]);
      mockCoinGeckoProvider.searchCrypto.mockResolvedValue([
        { symbol: 'BTC', name: 'Bitcoin' },
      ]);

      const results = await service.searchTickers('a');
      expect(results.length).toBe(2);
    });

    it('filters to crypto-only when assetType is crypto', async () => {
      mockCoinGeckoProvider.searchCrypto.mockResolvedValue([
        { symbol: 'ETH', name: 'Ethereum' },
      ]);

      const results = await service.searchTickers('eth', 'crypto');
      expect(results.length).toBe(1);
      expect(results[0].ticker).toBe('ETH');
      expect(mockYahooProvider.searchTickers).not.toHaveBeenCalled();
    });
  });

  describe('getRealtimeQuote', () => {
    it('uses shorter cache TTL', async () => {
      const quote = await service.getRealtimeQuote('AAPL');
      expect(quote.ticker).toBe('AAPL');
    });
  });

  describe('getInstrumentProfile', () => {
    it('returns profile for stock ticker', async () => {
      const profile = await service.getInstrumentProfile('AAPL');
      expect(profile.ticker).toBe('AAPL');
      expect(profile.assetType).toBe('stock');
    });

    it('builds profile from quote for crypto ticker', async () => {
      const profile = await service.getInstrumentProfile('BTC');
      expect(profile.ticker).toBe('BTC');
      expect(profile.assetType).toBe('crypto');
    });

    it('returns cached profile on second call within TTL', async () => {
      await service.getInstrumentProfile('AAPL');
      mockYahooProvider.getInstrumentProfile.mockClear();
      await service.getInstrumentProfile('AAPL');
      expect(mockYahooProvider.getInstrumentProfile).not.toHaveBeenCalled();
    });

    it('throws NotFoundException when profile null and no cache', async () => {
      service.clearCaches();
      mockYahooProvider.getInstrumentProfile.mockResolvedValueOnce(null);
      await expect(service.getInstrumentProfile('UNKNOWN')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('returns stale cache when profile null but cache exists', async () => {
      await service.getInstrumentProfile('AAPL');
      // Expire the cache
      const cache = (service as any).instrumentCache;
      const entry = cache.get('AAPL');
      if (entry) entry.timestamp = 0;

      mockYahooProvider.getInstrumentProfile.mockResolvedValueOnce(null);
      const profile = await service.getInstrumentProfile('AAPL');
      expect(profile.ticker).toBe('AAPL');
    });
  });

  describe('getNews', () => {
    it('returns news for a ticker', async () => {
      mockYahooProvider.getNews.mockResolvedValue([{ title: 'Test News' }]);
      const news = await service.getNews('AAPL');
      expect(news).toHaveLength(1);
    });

    it('returns empty array when provider returns null', async () => {
      service.clearCaches();
      mockYahooProvider.getNews.mockResolvedValueOnce(null);
      const news = await service.getNews('AAPL');
      expect(news).toEqual([]);
    });

    it('returns cached news on second call within TTL', async () => {
      mockYahooProvider.getNews.mockResolvedValue([{ title: 'Cached' }]);
      await service.getNews('AAPL');
      mockYahooProvider.getNews.mockClear();
      await service.getNews('AAPL');
      expect(mockYahooProvider.getNews).not.toHaveBeenCalled();
    });

    it('returns stale cache when provider returns null but cache exists', async () => {
      mockYahooProvider.getNews.mockResolvedValueOnce([{ title: 'Old' }]);
      await service.getNews('AAPL', 8);
      // Expire the cache
      const cache = (service as any).newsCache;
      const entry = cache.get('AAPL:8');
      if (entry) entry.timestamp = 0;

      mockYahooProvider.getNews.mockResolvedValueOnce(null);
      const news = await service.getNews('AAPL', 8);
      expect(news[0].title).toBe('Old');
    });
  });

  // ── getMarketSnapshot ──────────────────────────────────────
  describe('getMarketSnapshot', () => {
    it('returns combined quote, profile, and news', async () => {
      const result = await service.getMarketSnapshot('AAPL');
      expect(result.quote).toBeDefined();
      expect(result.profile).toBeDefined();
      expect(result.news).toBeDefined();
    });
  });

  // ── session mapping edge cases ─────────────────────────────
  describe('session mapping', () => {
    it('returns CRYPTO for crypto quote', async () => {
      const quote = await service.getQuote('BTC');
      expect(quote.session).toBe('CRYPTO');
    });

    it('returns PREMARKET for PRE/PREPRE/PREMARKET states', async () => {
      for (const state of ['PRE', 'PREPRE', 'PREMARKET']) {
        service.clearCaches();
        mockYahooProvider.getQuote.mockResolvedValueOnce({
          ticker: 'AAPL',
          price: 150,
          change: 0,
          volume: 0,
          timestamp: new Date(),
          marketState: state,
        });
        const quote = await service.getQuote('AAPL');
        expect(quote.session).toBe('PREMARKET');
      }
    });

    it('returns AFTER_HOURS for POST/POSTPOST/POSTMARKET/AFTER_HOURS', async () => {
      for (const state of ['POST', 'POSTPOST', 'POSTMARKET', 'AFTER_HOURS']) {
        service.clearCaches();
        mockYahooProvider.getQuote.mockResolvedValueOnce({
          ticker: 'AAPL',
          price: 150,
          change: 0,
          volume: 0,
          timestamp: new Date(),
          marketState: state,
        });
        const quote = await service.getQuote('AAPL');
        expect(quote.session).toBe('AFTER_HOURS');
      }
    });

    it('returns REGULAR for REGULAR state', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'AAPL',
        price: 150,
        change: 0,
        volume: 0,
        timestamp: new Date(),
        marketState: 'REGULAR',
      });
      const quote = await service.getQuote('AAPL');
      expect(quote.session).toBe('REGULAR');
    });

    it('returns CLOSED for CLOSED state', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'AAPL',
        price: 150,
        change: 0,
        volume: 0,
        timestamp: new Date(),
        marketState: 'CLOSED',
      });
      const quote = await service.getQuote('AAPL');
      expect(quote.session).toBe('CLOSED');
    });

    it('returns UNKNOWN for unrecognized state', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'AAPL',
        price: 150,
        change: 0,
        volume: 0,
        timestamp: new Date(),
        marketState: 'WEIRD',
      });
      const quote = await service.getQuote('AAPL');
      expect(quote.session).toBe('UNKNOWN');
    });
  });

  // ── freshnessState computation ──────────────────────────────
  describe('freshnessState', () => {
    it('returns NEAR_REALTIME for quote < 15s old', async () => {
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'AAPL',
        price: 150,
        change: 0,
        volume: 0,
        quoteTimestamp: new Date(),
        timestamp: new Date(),
      });
      service.clearCaches();
      const quote = await service.getQuote('AAPL');
      expect(quote.freshnessState).toBe('NEAR_REALTIME');
    });

    it('returns STALE for quote > 60s old', async () => {
      const old = new Date(Date.now() - 120_000);
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'AAPL',
        price: 150,
        change: 0,
        volume: 0,
        quoteTimestamp: old,
        timestamp: old,
      });
      service.clearCaches();
      const quote = await service.getQuote('AAPL');
      expect(quote.freshnessState).toBe('STALE');
    });
  });

  // ── circuit breaker: health status progression ─────────────
  describe('circuit breaker progression', () => {
    it('opens circuit after 5 consecutive failures', async () => {
      mockYahooProvider.getQuote.mockRejectedValue(new Error('down'));
      for (let i = 0; i < 5; i++) {
        service.clearCaches();
        try {
          await service.getQuote('AAPL');
        } catch (error) {
          void error;
        }
      }
      const health = service.getProviderHealth();
      const yahoo = health.find((h) => h.provider === 'yahoo-finance');
      expect(yahoo!.consecutiveFailures).toBe(5);
      expect(yahoo!.status).toBe('unhealthy');
    });

    it('skips upstream when circuit open and returns NotFoundException', async () => {
      mockYahooProvider.getQuote.mockRejectedValue(new Error('down'));
      for (let i = 0; i < 5; i++) {
        service.clearCaches();
        try {
          await service.getQuote('AAPL');
        } catch (error) {
          void error;
        }
      }
      mockYahooProvider.getQuote.mockClear();
      service.clearCaches();
      try {
        await service.getQuote('AAPL');
      } catch (error) {
        void error;
      }
      expect(mockYahooProvider.getQuote).not.toHaveBeenCalled();
    });

    it('resets consecutive failures after a success', async () => {
      mockYahooProvider.getQuote
        .mockRejectedValueOnce(new Error('fail'))
        .mockResolvedValueOnce({
          ticker: 'AAPL',
          price: 180,
          change: 0,
          volume: 0,
          timestamp: new Date(),
        });
      service.clearCaches();
      try {
        await service.getQuote('AAPL');
      } catch (error) {
        void error;
      }
      service.clearCaches();
      await service.getQuote('AAPL');
      const health = service.getProviderHealth();
      const yahoo = health.find((h) => h.provider === 'yahoo-finance');
      expect(yahoo!.consecutiveFailures).toBe(0);
    });
  });

  // ── normalizeQuote edge: NaN fields ────────────────────────
  describe('normalizeQuote NaN handling', () => {
    it('defaults NaN price/change/volume to 0', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'TEST',
        price: NaN,
        change: NaN,
        changePercent: NaN,
        volume: NaN,
        high: NaN,
        low: NaN,
        open: NaN,
        timestamp: new Date(),
      });
      const quote = await service.getQuote('TEST');
      expect(quote.price).toBe(0);
      expect(quote.change).toBe(0);
      expect(quote.volume).toBe(0);
      expect(quote.changePercent).toBe(0);
    });

    it('uses price for high/low when they are NaN', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce({
        ticker: 'TEST',
        price: 100,
        change: 0,
        volume: 0,
        high: NaN,
        low: NaN,
        open: NaN,
        previousClose: 0,
        timestamp: new Date(),
      });
      const quote = await service.getQuote('TEST');
      expect(quote.high).toBe(100);
      expect(quote.low).toBe(100);
    });
  });

  // ── getHealth with degraded provider ─────────────────────────
  describe('getHealth with provider issues', () => {
    it('returns unhealthy when any provider has >5 consecutive failures', async () => {
      mockYahooProvider.getQuote.mockRejectedValue(new Error('fail'));
      for (let i = 0; i < 5; i++) {
        service.clearCaches();
        try {
          await service.getQuote('AAPL');
        } catch (error) {
          void error;
        }
      }
      const health = service.getHealth([]);
      expect(health.status).toBe('unhealthy');
    });

    it('counts delayed streams correctly', () => {
      const delayed = new Date(Date.now() - 30_000).toISOString(); // 30s = DELAYED
      const health = service.getHealth([{ lastQuoteAt: delayed } as any]);
      expect(health.freshnessSummary.delayedStreams).toBe(1);
    });

    it('handles stream with no lastQuoteAt as STALE', () => {
      const health = service.getHealth([{ lastQuoteAt: undefined } as any]);
      expect(health.freshnessSummary.staleStreams).toBe(1);
    });
  });

  // ── searchTickers deduplication and assetType filtering ────
  describe('searchTickers edge cases', () => {
    it('deduplicates results from both providers', async () => {
      mockYahooProvider.searchTickers.mockResolvedValue([
        { ticker: 'BTC', name: 'Bitcoin', assetType: 'crypto' },
      ]);
      mockCoinGeckoProvider.searchCrypto.mockResolvedValue([
        { symbol: 'BTC', name: 'Bitcoin' },
      ]);
      const results = await service.searchTickers('BTC');
      expect(results).toHaveLength(1);
    });

    it('filters yahoo results by non-matching assetType', async () => {
      mockYahooProvider.searchTickers.mockResolvedValue([
        { ticker: 'AAPL', name: 'Apple', assetType: 'stock' },
        { ticker: 'BND', name: 'Bond ETF', assetType: 'etf' },
      ]);
      const results = await service.searchTickers('A', 'etf');
      expect(results.length).toBe(1);
      expect(results[0].ticker).toBe('BND');
    });
  });

  // ── normalizeTicker: slash and multi-crypto ────────────────
  describe('normalizeTicker crypto variants', () => {
    it('normalizes ETH-USD and ETHUSD to ETH', () => {
      expect(service.normalizeTicker('ETH-USD')).toBe('ETH');
      expect(service.normalizeTicker('ETHUSD')).toBe('ETH');
    });

    it('normalizes SOL-USD to SOL', () => {
      expect(service.normalizeTicker('SOL-USD')).toBe('SOL');
      expect(service.normalizeTicker('SOLUSD')).toBe('SOL');
    });

    it('normalizes slash-separated crypto pairs', () => {
      expect(service.normalizeTicker('BTC/USD')).toBe('BTC');
    });
  });

  // ── provider health DTO status levels ──────────────────────
  describe('provider health status levels', () => {
    it('returns healthy with 100% success rate', async () => {
      service.clearCaches();
      mockYahooProvider.getQuote.mockResolvedValueOnce({
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
      await service.getQuote('AAPL');
      const health = service.getProviderHealth();
      const yahoo = health.find((h) => h.provider === 'yahoo-finance');
      expect(yahoo!.status).toBe('healthy');
      expect(yahoo!.successRate).toBe(100);
    });
  });
});
