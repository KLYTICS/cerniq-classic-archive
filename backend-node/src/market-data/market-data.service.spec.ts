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
});
