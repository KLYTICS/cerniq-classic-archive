import { MarketStreamManagerService } from './market-stream-manager.service';

describe('MarketStreamManagerService', () => {
  let service: MarketStreamManagerService;
  let marketDataService: {
    normalizeTicker: jest.Mock;
    getRealtimeQuote: jest.Mock;
    getInstrumentProfile: jest.Mock;
    getNews: jest.Mock;
  };

  const originalQuoteInterval = process.env.MARKET_STREAM_INTERVAL_MS;
  const originalProfileInterval = process.env.MARKET_PROFILE_STREAM_INTERVAL_MS;
  const originalNewsInterval = process.env.MARKET_NEWS_STREAM_INTERVAL_MS;

  const quote = {
    ticker: 'AAPL',
    price: 150,
    change: 1,
    changePercent: 0.67,
  };

  const profile = {
    ticker: 'AAPL',
    assetType: 'stock',
    shortName: 'Apple',
  };

  const news = [
    {
      id: 'news-1',
      headline: 'Apple rallies on strong demand',
      source: 'Newswire',
      publishedAt: new Date('2026-03-30T09:30:00Z').toISOString(),
    },
  ];

  const createService = () => {
    marketDataService = {
      normalizeTicker: jest.fn((ticker: string) => ticker.trim().toUpperCase()),
      getRealtimeQuote: jest.fn().mockResolvedValue(quote),
      getInstrumentProfile: jest.fn().mockResolvedValue(profile),
      getNews: jest.fn().mockResolvedValue(news),
    };

    service = new MarketStreamManagerService(marketDataService as any);
  };

  beforeEach(() => {
    jest.useRealTimers();
    jest.restoreAllMocks();
    process.env.MARKET_STREAM_INTERVAL_MS = originalQuoteInterval;
    process.env.MARKET_PROFILE_STREAM_INTERVAL_MS = originalProfileInterval;
    process.env.MARKET_NEWS_STREAM_INTERVAL_MS = originalNewsInterval;
    createService();
  });

  afterEach(() => {
    service.onModuleDestroy();
    jest.useRealTimers();
    process.env.MARKET_STREAM_INTERVAL_MS = originalQuoteInterval;
    process.env.MARKET_PROFILE_STREAM_INTERVAL_MS = originalProfileInterval;
    process.env.MARKET_NEWS_STREAM_INTERVAL_MS = originalNewsInterval;
  });

  it('hydrates quote, profile, and news streams on first subscribe', async () => {
    const quoteEvents: any[] = [];
    const instrumentEvents: any[] = [];
    const newsEvents: any[] = [];

    const unsubscribeQuote = service.onQuote((event) =>
      quoteEvents.push(event),
    );
    const unsubscribeInstrument = service.onInstrument((event) =>
      instrumentEvents.push(event),
    );
    const unsubscribeNews = service.onNews((event) => newsEvents.push(event));

    const result = await service.subscribe(' aapl ');
    const [status] = service.getStreamStatus();

    expect(result).toEqual({ ticker: 'AAPL', subscribers: 1 });
    expect(marketDataService.normalizeTicker).toHaveBeenCalledWith(' aapl ');
    expect(quoteEvents).toEqual([
      { ticker: 'AAPL', quote },
      { ticker: 'AAPL', quote },
    ]);
    expect(instrumentEvents).toHaveLength(1);
    expect(instrumentEvents[0]).toMatchObject({
      ticker: 'AAPL',
      profile,
      quote,
    });
    expect(instrumentEvents[0].timestamp).toBeInstanceOf(Date);
    expect(newsEvents).toHaveLength(1);
    expect(newsEvents[0]).toMatchObject({ ticker: 'AAPL', items: news });
    expect(newsEvents[0].timestamp).toBeInstanceOf(Date);
    expect(status).toMatchObject({
      ticker: 'AAPL',
      subscribers: 1,
      lastErrorAt: undefined,
      lastErrorMessage: undefined,
    });
    expect(status.startedAt).toBeInstanceOf(Date);
    expect(status.lastQuoteAt).toBeInstanceOf(Date);
    expect(status.lastProfileAt).toBeInstanceOf(Date);
    expect(status.lastNewsAt).toBeInstanceOf(Date);

    unsubscribeQuote();
    unsubscribeInstrument();
    unsubscribeNews();
  });

  it('uses parsed polling intervals and falls back on invalid env values', async () => {
    process.env.MARKET_STREAM_INTERVAL_MS = '1200';
    process.env.MARKET_PROFILE_STREAM_INTERVAL_MS = '-1';
    process.env.MARKET_NEWS_STREAM_INTERVAL_MS = 'NaN';
    createService();

    await service.subscribe('AAPL');

    expect(service.getStreamStatus()).toEqual([
      expect.objectContaining({
        ticker: 'AAPL',
        quotePollIntervalMs: 1200,
        profilePollIntervalMs: 15 * 60 * 1000,
        newsPollIntervalMs: 5 * 60 * 1000,
      }),
    ]);
  });

  it('increments subscribers without duplicating the initial hydration calls', async () => {
    await service.subscribe('AAPL');
    jest.clearAllMocks();

    const result = await service.subscribe('AAPL');

    expect(result).toEqual({ ticker: 'AAPL', subscribers: 2 });
    expect(marketDataService.getRealtimeQuote).not.toHaveBeenCalled();
    expect(marketDataService.getInstrumentProfile).not.toHaveBeenCalled();
    expect(marketDataService.getNews).not.toHaveBeenCalled();
  });

  it('supports partial initial hydration when quote retrieval fails', async () => {
    marketDataService.getRealtimeQuote.mockRejectedValue(
      new Error('quote provider offline'),
    );
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    const quoteListener = jest.fn();
    const instrumentListener = jest.fn();
    const newsListener = jest.fn();

    service.onQuote(quoteListener);
    service.onInstrument(instrumentListener);
    service.onNews(newsListener);

    await service.subscribe('AAPL');

    expect(quoteListener).not.toHaveBeenCalled();
    expect(instrumentListener).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: 'AAPL',
        profile,
        quote: undefined,
      }),
    );
    expect(newsListener).toHaveBeenCalledWith(
      expect.objectContaining({
        ticker: 'AAPL',
        items: news,
      }),
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'quote provider offline',
      expect.any(String),
    );
  });

  it('lets listeners unsubscribe cleanly from all event channels', () => {
    const quoteListener = jest.fn();
    const instrumentListener = jest.fn();
    const newsListener = jest.fn();

    const stopQuote = service.onQuote(quoteListener);
    const stopInstrument = service.onInstrument(instrumentListener);
    const stopNews = service.onNews(newsListener);

    (service as any).emitQuote({ ticker: 'AAPL', quote });
    (service as any).emitInstrument({
      ticker: 'AAPL',
      profile,
      quote,
      timestamp: new Date(),
    });
    (service as any).emitNews({
      ticker: 'AAPL',
      items: news,
      timestamp: new Date(),
    });

    stopQuote();
    stopInstrument();
    stopNews();

    (service as any).emitQuote({ ticker: 'AAPL', quote });
    (service as any).emitInstrument({
      ticker: 'AAPL',
      profile,
      timestamp: new Date(),
    });
    (service as any).emitNews({
      ticker: 'AAPL',
      items: news,
      timestamp: new Date(),
    });

    expect(quoteListener).toHaveBeenCalledTimes(1);
    expect(instrumentListener).toHaveBeenCalledTimes(1);
    expect(newsListener).toHaveBeenCalledTimes(1);
  });

  it('records quote publishing failures for active streams', async () => {
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    await service.subscribe('AAPL');
    marketDataService.getRealtimeQuote.mockRejectedValueOnce(
      new Error('realtime quote unavailable'),
    );

    await (service as any).publishQuote('AAPL');

    const [status] = service.getStreamStatus();
    expect(status.lastErrorAt).toBeInstanceOf(Date);
    expect(status.lastErrorMessage).toBe('realtime quote unavailable');
    expect(errorSpy).toHaveBeenCalledWith(
      'realtime quote unavailable',
      expect.any(String),
    );
  });

  it('records profile publishing failures and preserves active stream state', async () => {
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    await service.subscribe('AAPL');
    marketDataService.getInstrumentProfile.mockRejectedValueOnce({
      stack: 'profile-stack',
    });

    await (service as any).publishProfile('AAPL');

    const [status] = service.getStreamStatus();
    expect(status.lastErrorMessage).toBe(
      'Failed to stream instrument profile for AAPL',
    );
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to stream instrument profile for AAPL',
      'profile-stack',
    );
  });

  it('records news publishing failures and preserves active stream state', async () => {
    const errorSpy = jest
      .spyOn((service as any).logger, 'error')
      .mockImplementation(() => undefined);
    await service.subscribe('AAPL');
    marketDataService.getNews.mockRejectedValueOnce({});

    await (service as any).publishNews('AAPL');

    const [status] = service.getStreamStatus();
    expect(status.lastErrorMessage).toBe('Failed to stream news for AAPL');
    expect(errorSpy).toHaveBeenCalledWith(
      'Failed to stream news for AAPL',
      undefined,
    );
  });

  it('no-ops publish helpers when the stream is not active', async () => {
    await expect(
      (service as any).publishQuote('MSFT'),
    ).resolves.toBeUndefined();
    await expect(
      (service as any).publishProfile('MSFT'),
    ).resolves.toBeUndefined();
    await expect((service as any).publishNews('MSFT')).resolves.toBeUndefined();
  });

  it('sorts active stream status alphabetically by ticker', async () => {
    await service.subscribe('msft');
    await service.subscribe('aapl');

    expect(service.getStreamStatus().map((status) => status.ticker)).toEqual([
      'AAPL',
      'MSFT',
    ]);
  });

  it('stops and clears timers when the final subscriber unsubscribes', async () => {
    const quoteTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const profileTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const newsTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValueOnce(quoteTimer)
      .mockReturnValueOnce(profileTimer)
      .mockReturnValueOnce(newsTimer);
    const clearIntervalSpy = jest
      .spyOn(global, 'clearInterval')
      .mockImplementation(() => undefined);

    await service.subscribe('AAPL');
    const result = service.unsubscribe('AAPL');

    expect(result).toEqual({ ticker: 'AAPL', subscribers: 0 });
    expect(clearIntervalSpy).toHaveBeenCalledWith(quoteTimer);
    expect(clearIntervalSpy).toHaveBeenCalledWith(profileTimer);
    expect(clearIntervalSpy).toHaveBeenCalledWith(newsTimer);
    expect(service.getStreamStatus()).toEqual([]);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
  });

  it('returns zero subscribers for unknown tickers and keeps known streams alive', async () => {
    await service.subscribe('AAPL');

    expect(service.unsubscribe('UNKNOWN')).toEqual({
      ticker: 'UNKNOWN',
      subscribers: 0,
    });
    expect(service.getStreamStatus()).toEqual([
      expect.objectContaining({ ticker: 'AAPL', subscribers: 1 }),
    ]);
  });

  it('stops active streams during module destroy', async () => {
    const clearIntervalSpy = jest
      .spyOn(global, 'clearInterval')
      .mockImplementation(() => undefined);
    await service.subscribe('AAPL');
    await service.subscribe('MSFT');

    service.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledTimes(6);
    expect(service.getStreamStatus()).toEqual([]);
    clearIntervalSpy.mockRestore();
  });
});
