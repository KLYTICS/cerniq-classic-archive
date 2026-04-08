import { YahooFinanceProvider } from './yahoo-finance.provider';

// Mock the yahoo-finance2 module
jest.mock('yahoo-finance2', () => {
  return jest.fn().mockImplementation(() => ({
    quote: jest.fn(),
    historical: jest.fn(),
    quoteSummary: jest.fn(),
    search: jest.fn(),
  }));
});

describe('YahooFinanceProvider', () => {
  let provider: YahooFinanceProvider;
  let mockClient: any;

  beforeEach(() => {
    provider = new YahooFinanceProvider();
    // Access the private client through the instance
    mockClient = (provider as any).client;
    jest.clearAllMocks();
  });

  // ── mapYahooQuoteType ──────────────────────────────────────────────

  describe('mapYahooQuoteType (via getQuote)', () => {
    it('maps ETF quoteType', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'SPY',
        quoteType: 'ETF',
        regularMarketPrice: 450,
        regularMarketChange: 2,
        regularMarketChangePercent: 0.45,
        regularMarketVolume: 5_000_000,
      });
      const result = await provider.getQuote('SPY');
      expect(result).not.toBeNull();
      expect(result!.assetType).toBe('etf');
    });

    it('maps MUTUALFUND quoteType to etf', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'VTSAX',
        quoteType: 'MUTUALFUND',
        regularMarketPrice: 100,
      });
      const result = await provider.getQuote('VTSAX');
      expect(result!.assetType).toBe('etf');
    });

    it('maps INDEX quoteType', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: '^GSPC',
        quoteType: 'INDEX',
        regularMarketPrice: 5100,
      });
      const result = await provider.getQuote('^GSPC');
      expect(result!.assetType).toBe('index');
    });

    it('maps CRYPTOCURRENCY quoteType', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'BTC-USD',
        quoteType: 'CRYPTOCURRENCY',
        regularMarketPrice: 65000,
      });
      const result = await provider.getQuote('BTC-USD');
      expect(result!.assetType).toBe('crypto');
    });

    it('maps unknown quoteType to stock', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'AAPL',
        quoteType: 'EQUITY',
        regularMarketPrice: 175,
      });
      const result = await provider.getQuote('AAPL');
      expect(result!.assetType).toBe('stock');
    });

    it('maps undefined quoteType to stock', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'AAPL',
        regularMarketPrice: 175,
      });
      const result = await provider.getQuote('AAPL');
      expect(result!.assetType).toBe('stock');
    });
  });

  // ── getQuote ───────────────────────────────────────────────────────

  describe('getQuote', () => {
    it('returns a valid QuoteDto for a successful fetch', async () => {
      const mockQuote = {
        symbol: 'AAPL',
        quoteType: 'EQUITY',
        shortName: 'Apple Inc.',
        longName: 'Apple Inc.',
        fullExchangeName: 'NasdaqGS',
        currency: 'USD',
        marketState: 'REGULAR',
        regularMarketPrice: 175.5,
        regularMarketChange: 2.3,
        regularMarketChangePercent: 1.33,
        regularMarketVolume: 50_000_000,
        marketCap: 2_800_000_000_000,
        regularMarketDayHigh: 176.2,
        regularMarketDayLow: 173.1,
        regularMarketOpen: 174.0,
        regularMarketPreviousClose: 173.2,
        regularMarketTime: Date.now(),
      };
      mockClient.quote.mockResolvedValue(mockQuote);

      const result = await provider.getQuote('AAPL');

      expect(result).not.toBeNull();
      expect(result!.ticker).toBe('AAPL');
      expect(result!.price).toBe(175.5);
      expect(result!.change).toBe(2.3);
      expect(result!.changePercent).toBe(1.33);
      expect(result!.volume).toBe(50_000_000);
      expect(result!.marketCap).toBe(2_800_000_000_000);
      expect(result!.high).toBe(176.2);
      expect(result!.low).toBe(173.1);
      expect(result!.open).toBe(174.0);
      expect(result!.previousClose).toBe(173.2);
      expect(result!.exchange).toBe('NasdaqGS');
      expect(result!.currency).toBe('USD');
      expect(result!.timestamp).toBeInstanceOf(Date);
    });

    it('returns null when no quote data found', async () => {
      mockClient.quote.mockResolvedValue(null);
      const result = await provider.getQuote('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('returns null on error and does not throw', async () => {
      mockClient.quote.mockRejectedValue(new Error('Network error'));
      const result = await provider.getQuote('AAPL');
      expect(result).toBeNull();
    });

    it('uses ticker as fallback when symbol is missing', async () => {
      mockClient.quote.mockResolvedValue({
        regularMarketPrice: 100,
      });
      const result = await provider.getQuote('XYZ');
      expect(result!.ticker).toBe('XYZ');
    });

    it('defaults numeric fields to 0 when missing', async () => {
      mockClient.quote.mockResolvedValue({ symbol: 'XYZ' });
      const result = await provider.getQuote('XYZ');
      expect(result!.price).toBe(0);
      expect(result!.change).toBe(0);
      expect(result!.changePercent).toBe(0);
      expect(result!.volume).toBe(0);
      expect(result!.high).toBe(0);
      expect(result!.low).toBe(0);
      expect(result!.open).toBe(0);
      expect(result!.previousClose).toBe(0);
    });
  });

  // ── getHistoricalPrices ────────────────────────────────────────────

  describe('getHistoricalPrices', () => {
    it('returns mapped historical prices', async () => {
      const mockData = [
        {
          date: new Date('2024-01-02'),
          open: 170,
          high: 172,
          low: 169,
          close: 171,
          volume: 40_000_000,
          adjClose: 171,
        },
        {
          date: new Date('2024-01-03'),
          open: 171,
          high: 173,
          low: 170,
          close: 172,
          volume: 38_000_000,
        },
      ];
      mockClient.historical.mockResolvedValue(mockData);

      const result = await provider.getHistoricalPrices(
        'AAPL',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );

      expect(result).toHaveLength(2);
      expect(result[0].date).toBe('2024-01-02');
      expect(result[0].open).toBe(170);
      expect(result[0].close).toBe(171);
      expect(result[0].adjustedClose).toBe(171);
      // Falls back to close when adjClose is missing
      expect(result[1].adjustedClose).toBe(172);
    });

    it('returns empty array on error', async () => {
      mockClient.historical.mockRejectedValue(new Error('API error'));
      const result = await provider.getHistoricalPrices(
        'AAPL',
        new Date('2024-01-01'),
        new Date('2024-01-31'),
      );
      expect(result).toEqual([]);
    });
  });

  // ── getFundamentals ────────────────────────────────────────────────

  describe('getFundamentals', () => {
    it('returns fundamentals data', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'AAPL',
        quoteType: 'EQUITY',
        marketCap: 2_800_000_000_000,
        trailingPE: 28.5,
        forwardPE: 25.2,
        priceToBook: 46.3,
        dividendYield: 0.005,
        epsTrailingTwelveMonths: 6.15,
        beta: 1.2,
        fiftyTwoWeekHigh: 199.62,
        fiftyTwoWeekLow: 143.9,
        averageVolume: 55_000_000,
        sector: 'Technology',
        industry: 'Consumer Electronics',
      });

      const result = await provider.getFundamentals('AAPL');

      expect(result).not.toBeNull();
      expect(result!.ticker).toBe('AAPL');
      expect(result!.marketCap).toBe(2_800_000_000_000);
      expect(result!.peRatio).toBe(28.5);
      expect(result!.forwardPE).toBe(25.2);
      expect(result!.beta).toBe(1.2);
      expect(result!.sector).toBe('Technology');
      expect(result!.industry).toBe('Consumer Electronics');
    });

    it('returns null when no quote data found', async () => {
      mockClient.quote.mockResolvedValue(null);
      const result = await provider.getFundamentals('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockClient.quote.mockRejectedValue(new Error('Timeout'));
      const result = await provider.getFundamentals('AAPL');
      expect(result).toBeNull();
    });

    it('defaults marketCap to 0 when missing', async () => {
      mockClient.quote.mockResolvedValue({
        symbol: 'XYZ',
        quoteType: 'EQUITY',
      });
      const result = await provider.getFundamentals('XYZ');
      expect(result!.marketCap).toBe(0);
    });
  });

  // ── getInstrumentProfile ───────────────────────────────────────────

  describe('getInstrumentProfile', () => {
    it('returns full instrument profile for a stock', async () => {
      mockClient.quoteSummary.mockResolvedValue({
        quoteType: {
          quoteType: 'EQUITY',
          shortName: 'Apple',
          longName: 'Apple Inc.',
          symbol: 'AAPL',
          exchange: 'NMS',
        },
        price: {
          symbol: 'AAPL',
          currency: 'USD',
          marketState: 'REGULAR',
          shortName: 'Apple',
          longName: 'Apple Inc.',
          exchangeName: 'NASDAQ',
        },
        summaryProfile: {
          sector: 'Technology',
          industry: 'Consumer Electronics',
          longBusinessSummary: 'Apple designs...',
          website: 'https://apple.com',
        },
        fundProfile: {},
        summaryDetail: { marketCap: 2_800_000_000_000, currency: 'USD' },
        defaultKeyStatistics: {},
        topHoldings: {},
      });

      const result = await provider.getInstrumentProfile('AAPL');

      expect(result).not.toBeNull();
      expect(result!.ticker).toBe('AAPL');
      expect(result!.assetType).toBe('stock');
      expect(result!.sector).toBe('Technology');
      expect(result!.industry).toBe('Consumer Electronics');
      expect(result!.description).toBe('Apple designs...');
      expect(result!.website).toBe('https://apple.com');
    });

    it('returns profile for an ETF with holdings', async () => {
      mockClient.quoteSummary.mockResolvedValue({
        quoteType: {
          quoteType: 'ETF',
          shortName: 'SPDR S&P 500',
          symbol: 'SPY',
        },
        price: { symbol: 'SPY', currency: 'USD' },
        summaryProfile: {},
        fundProfile: { categoryName: 'Large Blend', family: 'SPDR' },
        summaryDetail: { totalAssets: 400_000_000_000 },
        defaultKeyStatistics: {},
        topHoldings: {
          holdings: [
            { symbol: 'AAPL', holdingName: 'Apple', holdingPercent: 0.07 },
            { symbol: 'MSFT', holdingName: 'Microsoft', holdingPercent: 0.065 },
          ],
        },
      });

      const result = await provider.getInstrumentProfile('SPY');

      expect(result!.assetType).toBe('etf');
      expect(result!.categoryName).toBe('Large Blend');
      expect(result!.family).toBe('SPDR');
      expect(result!.topHoldings).toHaveLength(2);
      expect(result!.topHoldings![0].symbol).toBe('AAPL');
    });

    it('returns null when quoteSummary returns null', async () => {
      mockClient.quoteSummary.mockResolvedValue(null);
      const result = await provider.getInstrumentProfile('NONEXISTENT');
      expect(result).toBeNull();
    });

    it('returns null on error', async () => {
      mockClient.quoteSummary.mockRejectedValue(new Error('404'));
      const result = await provider.getInstrumentProfile('AAPL');
      expect(result).toBeNull();
    });

    it('handles missing topHoldings gracefully', async () => {
      mockClient.quoteSummary.mockResolvedValue({
        quoteType: { quoteType: 'EQUITY', symbol: 'XYZ' },
        price: { symbol: 'XYZ' },
        summaryProfile: {},
        fundProfile: {},
        summaryDetail: {},
        defaultKeyStatistics: {},
        topHoldings: null,
      });

      const result = await provider.getInstrumentProfile('XYZ');
      expect(result!.topHoldings).toEqual([]);
    });
  });

  // ── getNews ────────────────────────────────────────────────────────

  describe('getNews', () => {
    it('returns news articles', async () => {
      mockClient.search.mockResolvedValue({
        news: [
          {
            uuid: 'n1',
            title: 'Apple Earnings Beat',
            publisher: 'Reuters',
            link: 'https://reuters.com/article1',
            providerPublishTime: Date.now() / 1000,
            relatedTickers: ['AAPL'],
            thumbnail: { resolutions: [{ url: 'https://img.jpg' }] },
          },
          {
            uuid: 'n2',
            title: 'Tech Rally',
            publisher: 'Bloomberg',
            link: 'https://bloomberg.com/article2',
          },
        ],
      });

      const result = await provider.getNews('AAPL', 5);

      expect(result).toHaveLength(2);
      expect(result[0].id).toBe('n1');
      expect(result[0].title).toBe('Apple Earnings Beat');
      expect(result[0].publisher).toBe('Reuters');
      expect(result[0].thumbnailUrl).toBe('https://img.jpg');
      expect(result[1].publishedAt).toBeInstanceOf(Date);
    });

    it('returns empty array when no news found', async () => {
      mockClient.search.mockResolvedValue({ news: [] });
      const result = await provider.getNews('AAPL');
      expect(result).toEqual([]);
    });

    it('returns empty array when results.news is undefined', async () => {
      mockClient.search.mockResolvedValue({});
      const result = await provider.getNews('AAPL');
      expect(result).toEqual([]);
    });

    it('returns empty array on error', async () => {
      mockClient.search.mockRejectedValue(new Error('Rate limited'));
      const result = await provider.getNews('AAPL');
      expect(result).toEqual([]);
    });

    it('limits to default 8 if not specified', async () => {
      mockClient.search.mockResolvedValue({ news: [] });
      await provider.getNews('AAPL');
      expect(mockClient.search).toHaveBeenCalledWith(
        'AAPL',
        expect.objectContaining({
          newsCount: 8,
        }),
      );
    });

    it('clamps newsCount to max 20', async () => {
      mockClient.search.mockResolvedValue({ news: [] });
      await provider.getNews('AAPL', 50);
      expect(mockClient.search).toHaveBeenCalledWith(
        'AAPL',
        expect.objectContaining({
          newsCount: 20,
        }),
      );
    });
  });

  // ── searchTickers ──────────────────────────────────────────────────

  describe('searchTickers', () => {
    it('returns mapped search results', async () => {
      mockClient.search.mockResolvedValue({
        quotes: [
          {
            symbol: 'AAPL',
            shortname: 'Apple Inc.',
            quoteType: 'EQUITY',
            exchDisp: 'NASDAQ',
            sectorDisp: 'Technology',
          },
          {
            symbol: 'AAPB',
            longname: 'GraniteShares',
            quoteType: 'ETF',
            exchDisp: 'NYSE',
          },
        ],
      });

      const result = await provider.searchTickers('AAPL');

      expect(result).toHaveLength(2);
      expect(result[0].ticker).toBe('AAPL');
      expect(result[0].name).toBe('Apple Inc.');
      expect(result[0].assetType).toBe('stock');
      expect(result[0].exchange).toBe('NASDAQ');
      expect(result[0].sector).toBe('Technology');
      expect(result[1].assetType).toBe('etf');
    });

    it('returns empty array on error', async () => {
      mockClient.search.mockRejectedValue(new Error('Error'));
      const result = await provider.searchTickers('AAPL');
      expect(result).toEqual([]);
    });

    it('handles missing quotes array', async () => {
      mockClient.search.mockResolvedValue({});
      const result = await provider.searchTickers('AAPL');
      expect(result).toEqual([]);
    });

    it('limits results to 12', async () => {
      const quotes = Array.from({ length: 20 }, (_, i) => ({
        symbol: `SYM${i}`,
        shortname: `Name ${i}`,
        quoteType: 'EQUITY',
      }));
      mockClient.search.mockResolvedValue({ quotes });
      const result = await provider.searchTickers('SYM');
      expect(result).toHaveLength(12);
    });
  });
});
