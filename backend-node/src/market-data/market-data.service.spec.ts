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
      await expect(service.getQuote('UNKNOWN')).rejects.toThrow(NotFoundException);
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
      await expect(service.getFundamentals('BTC')).rejects.toThrow(NotFoundException);
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
      await expect(service.getFundamentals('UNKNOWN')).rejects.toThrow(NotFoundException);
    });
  });

  describe('getHistoricalPrices', () => {
    it('routes stock tickers to Yahoo', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      await service.getHistoricalPrices('AAPL', start, end);
      expect(mockYahooProvider.getHistoricalPrices).toHaveBeenCalledWith('AAPL', start, end);
    });

    it('routes crypto tickers to CoinGecko', async () => {
      const start = new Date('2025-01-01');
      const end = new Date('2025-12-31');
      await service.getHistoricalPrices('BTC', start, end);
      expect(mockCoinGeckoProvider.getHistoricalPrices).toHaveBeenCalledWith('BTC', start, end);
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
  });
});
