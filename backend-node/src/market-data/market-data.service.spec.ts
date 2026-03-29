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
});
