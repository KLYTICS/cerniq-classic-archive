import {
  QuoteDto,
  HistoricalPriceDto,
  FundamentalsDto,
  TickerSearchResultDto,
  NewsArticleDto,
  EtfHoldingDto,
  InstrumentProfileDto,
  MarketSnapshotDto,
  ProviderHealthDto,
  StreamStatusDto,
  MarketDataHealthDto,
} from './quote.dto';

describe('QuoteDto', () => {
  it('can be instantiated with all required fields', () => {
    const dto = new QuoteDto();
    dto.ticker = 'AAPL';
    dto.price = 150.5;
    dto.change = 1.2;
    dto.changePercent = 0.8;
    dto.volume = 50000000;
    dto.high = 151;
    dto.low = 149;
    dto.open = 149.5;
    dto.previousClose = 149.3;
    dto.timestamp = new Date();

    expect(dto.ticker).toBe('AAPL');
    expect(dto.price).toBe(150.5);
    expect(dto.volume).toBe(50000000);
  });

  it('supports optional fields', () => {
    const dto = new QuoteDto();
    dto.ticker = 'BTC-USD';
    dto.price = 67000;
    dto.change = 1500;
    dto.changePercent = 2.3;
    dto.volume = 30000;
    dto.high = 68000;
    dto.low = 65000;
    dto.open = 65500;
    dto.previousClose = 65500;
    dto.timestamp = new Date();
    dto.assetType = 'crypto';
    dto.session = 'CRYPTO';
    dto.freshnessState = 'NEAR_REALTIME';
    dto.provider = 'coingecko';
    dto.marketCap = 1300000000000;

    expect(dto.assetType).toBe('crypto');
    expect(dto.session).toBe('CRYPTO');
    expect(dto.freshnessState).toBe('NEAR_REALTIME');
  });
});

describe('HistoricalPriceDto', () => {
  it('holds OHLCV data with date string', () => {
    const dto = new HistoricalPriceDto();
    dto.date = '2024-01-15';
    dto.open = 100;
    dto.high = 105;
    dto.low = 99;
    dto.close = 103;
    dto.volume = 5000000;
    dto.adjustedClose = 102.5;

    expect(dto.date).toBe('2024-01-15');
    expect(dto.adjustedClose).toBe(102.5);
  });
});

describe('FundamentalsDto', () => {
  it('holds fundamental data with required fields', () => {
    const dto = new FundamentalsDto();
    dto.ticker = 'MSFT';
    dto.marketCap = 3000000000000;
    dto.peRatio = 35;
    dto.eps = 12.5;
    dto.sector = 'Technology';

    expect(dto.ticker).toBe('MSFT');
    expect(dto.peRatio).toBe(35);
    expect(dto.sector).toBe('Technology');
  });

  it('supports optional fields being undefined', () => {
    const dto = new FundamentalsDto();
    dto.ticker = 'X';
    dto.marketCap = 100000;
    expect(dto.beta).toBeUndefined();
    expect(dto.dividendYield).toBeUndefined();
    expect(dto.forwardPE).toBeUndefined();
  });
});

describe('TickerSearchResultDto', () => {
  it('holds search result data', () => {
    const dto = new TickerSearchResultDto();
    dto.ticker = 'GOOG';
    dto.name = 'Alphabet Inc.';
    dto.assetType = 'stock';
    dto.exchange = 'NASDAQ';

    expect(dto.ticker).toBe('GOOG');
    expect(dto.assetType).toBe('stock');
  });
});

describe('NewsArticleDto', () => {
  it('holds news data', () => {
    const dto = new NewsArticleDto();
    dto.id = 'news-1';
    dto.title = 'Apple reports earnings';
    dto.publisher = 'Reuters';
    dto.link = 'https://example.com/news/1';
    dto.publishedAt = new Date();
    dto.relatedTickers = ['AAPL'];

    expect(dto.title).toBe('Apple reports earnings');
    expect(dto.relatedTickers).toContain('AAPL');
  });
});

describe('EtfHoldingDto', () => {
  it('holds ETF holding data', () => {
    const dto = new EtfHoldingDto();
    dto.symbol = 'AAPL';
    dto.name = 'Apple Inc.';
    dto.weight = 7.5;

    expect(dto.symbol).toBe('AAPL');
    expect(dto.weight).toBe(7.5);
  });
});

describe('InstrumentProfileDto', () => {
  it('holds profile data for stock', () => {
    const dto = new InstrumentProfileDto();
    dto.ticker = 'AAPL';
    dto.assetType = 'stock';
    dto.shortName = 'Apple Inc.';
    dto.sector = 'Technology';
    dto.marketCap = 3000000000000;

    expect(dto.assetType).toBe('stock');
    expect(dto.sector).toBe('Technology');
  });

  it('holds profile data for ETF', () => {
    const dto = new InstrumentProfileDto();
    dto.ticker = 'SPY';
    dto.assetType = 'etf';
    dto.categoryName = 'Large Blend';
    dto.expenseRatio = 0.09;
    dto.topHoldings = [{ symbol: 'AAPL', name: 'Apple', weight: 7.5 }];

    expect(dto.assetType).toBe('etf');
    expect(dto.topHoldings).toHaveLength(1);
  });
});

describe('MarketSnapshotDto', () => {
  it('combines quote, profile, and news', () => {
    const dto = new MarketSnapshotDto();
    dto.quote = { ticker: 'AAPL', price: 150 } as any;
    dto.profile = { ticker: 'AAPL', assetType: 'stock' } as any;
    dto.news = [{ id: '1', title: 'News' } as any];

    expect(dto.quote.ticker).toBe('AAPL');
    expect(dto.profile.assetType).toBe('stock');
    expect(dto.news).toHaveLength(1);
  });
});

describe('ProviderHealthDto', () => {
  it('holds provider health metrics', () => {
    const dto = new ProviderHealthDto();
    dto.provider = 'yahoo';
    dto.status = 'healthy';
    dto.totalRequests = 1000;
    dto.successfulRequests = 990;
    dto.failedRequests = 10;
    dto.successRate = 99;
    dto.avgLatencyMs = 150;
    dto.consecutiveFailures = 0;

    expect(dto.provider).toBe('yahoo');
    expect(dto.successRate).toBe(99);
  });
});

describe('StreamStatusDto', () => {
  it('holds stream status data', () => {
    const dto = new StreamStatusDto();
    dto.ticker = 'AAPL';
    dto.subscribers = 3;
    dto.quotePollIntervalMs = 5000;
    dto.profilePollIntervalMs = 900000;
    dto.newsPollIntervalMs = 300000;
    dto.startedAt = new Date();

    expect(dto.ticker).toBe('AAPL');
    expect(dto.subscribers).toBe(3);
  });
});

describe('MarketDataHealthDto', () => {
  it('holds overall health status', () => {
    const dto = new MarketDataHealthDto();
    dto.status = 'healthy';
    dto.freshnessSummary = {
      activeStreams: 5,
      staleStreams: 0,
      delayedStreams: 1,
    };
    dto.providers = [];
    dto.streams = [];
    dto.generatedAt = new Date();

    expect(dto.status).toBe('healthy');
    expect(dto.freshnessSummary.activeStreams).toBe(5);
  });
});
