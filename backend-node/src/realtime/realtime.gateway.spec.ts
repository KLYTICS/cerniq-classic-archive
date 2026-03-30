import { RealtimeGateway } from './realtime.gateway';
import { OptionType } from '../options/dto/options.dto';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let quoteHandler: ((payload: any) => void) | undefined;
  let instrumentHandler: ((payload: any) => void) | undefined;
  let newsHandler: ((payload: any) => void) | undefined;
  let roomSizes: Map<string, number>;
  let roomEmitter: { emit: jest.Mock };
  let server: { of: jest.Mock; to: jest.Mock };

  const marketDataService = {
    normalizeTicker: jest.fn((ticker: string) => ticker.trim().toUpperCase()),
    getQuote: jest.fn(),
    getRealtimeQuote: jest.fn(),
    getInstrumentProfile: jest.fn(),
    getNews: jest.fn(),
  };
  const marketStreamManager = {
    onQuote: jest.fn((handler: (payload: any) => void) => {
      quoteHandler = handler;
      return jest.fn();
    }),
    onInstrument: jest.fn((handler: (payload: any) => void) => {
      instrumentHandler = handler;
      return jest.fn();
    }),
    onNews: jest.fn((handler: (payload: any) => void) => {
      newsHandler = handler;
      return jest.fn();
    }),
    subscribe: jest.fn(),
    unsubscribe: jest.fn(),
  };
  const optionsService = {
    calculateGreeks: jest.fn(),
  };
  const portfolioService = {
    getPortfolio: jest.fn(),
  };

  const makeClient = (id = 'client-1') => ({
    id,
    join: jest.fn(),
    leave: jest.fn(),
    emit: jest.fn(),
  });

  const setRoomSize = (room: string, size: number) => {
    roomSizes.set(
      room,
      new Set(
        Array.from({ length: size }, (_, index) => `client-${index}`),
      ) as any,
    );
  };

  beforeEach(() => {
    jest.clearAllMocks();
    quoteHandler = undefined;
    instrumentHandler = undefined;
    newsHandler = undefined;
    roomSizes = new Map();
    roomEmitter = { emit: jest.fn() };
    server = {
      of: jest.fn(() => ({ adapter: { rooms: roomSizes } })),
      to: jest.fn(() => roomEmitter),
    };

    marketDataService.getQuote.mockResolvedValue({
      ticker: 'AAPL',
      price: 150,
      assetType: 'stock',
      shortName: 'Apple',
      longName: 'Apple Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      marketState: 'REGULAR',
      session: 'REGULAR',
      freshnessState: 'NEAR_REALTIME',
      provider: 'yahoo-finance',
      quoteTimestamp: new Date('2026-03-30T14:00:00.000Z'),
      serverTimestamp: new Date('2026-03-30T14:00:01.000Z'),
      ageMs: 1000,
      change: 2.5,
      changePercent: 1.69,
      volume: 50000000,
      high: 152,
      low: 148,
      previousClose: 147.5,
      timestamp: new Date('2026-03-30T14:00:00.000Z'),
    });
    marketDataService.getRealtimeQuote.mockResolvedValue({
      ticker: 'AAPL',
      price: 151,
      assetType: 'stock',
      shortName: 'Apple',
      longName: 'Apple Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      marketState: 'REGULAR',
      session: 'REGULAR',
      freshnessState: 'NEAR_REALTIME',
      provider: 'yahoo-finance',
      quoteTimestamp: new Date('2026-03-30T14:00:00.000Z'),
      serverTimestamp: new Date('2026-03-30T14:00:01.000Z'),
      ageMs: 1000,
      change: 3.5,
      changePercent: 2.37,
      volume: 51000000,
      high: 153,
      low: 148,
      previousClose: 147.5,
      timestamp: new Date('2026-03-30T14:00:00.000Z'),
    });
    marketDataService.getInstrumentProfile.mockResolvedValue({
      ticker: 'AAPL',
      shortName: 'Apple Inc.',
      assetType: 'stock',
    });
    marketDataService.getNews.mockResolvedValue([
      { id: 'news-1', title: 'Rate shock update' },
    ]);
    optionsService.calculateGreeks.mockResolvedValue({
      delta: 0.52,
      gamma: 0.11,
    });
    portfolioService.getPortfolio.mockResolvedValue({
      id: 'portfolio-1',
      positions: [{ ticker: 'AAPL', quantity: 2, avgCost: 100 }],
    });

    gateway = new RealtimeGateway(
      marketDataService as any,
      marketStreamManager as any,
      optionsService as any,
      portfolioService as any,
    );
    gateway.server = server as any;
  });

  it('registers stream handlers on module init and rebroadcasts provider updates to subscribed rooms', () => {
    gateway.onModuleInit();

    expect(marketStreamManager.onQuote).toHaveBeenCalledTimes(1);
    expect(marketStreamManager.onInstrument).toHaveBeenCalledTimes(1);
    expect(marketStreamManager.onNews).toHaveBeenCalledTimes(1);

    quoteHandler?.({
      ticker: 'AAPL',
      quote: {
        ticker: 'AAPL',
        price: 151,
        assetType: 'stock',
        shortName: 'Apple',
        longName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        marketState: 'REGULAR',
        session: 'REGULAR',
        freshnessState: 'NEAR_REALTIME',
        provider: 'yahoo-finance',
        quoteTimestamp: new Date('2026-03-30T14:00:00.000Z'),
        serverTimestamp: new Date('2026-03-30T14:00:01.000Z'),
        ageMs: 1000,
        change: 3.5,
        changePercent: 2.37,
        volume: 51000000,
        high: 153,
        low: 148,
        previousClose: 147.5,
        timestamp: new Date('2026-03-30T14:00:00.000Z'),
      },
    });
    instrumentHandler?.({
      ticker: 'AAPL',
      profile: { shortName: 'Apple Inc.' },
      quote: { price: 151 },
      timestamp: new Date('2026-03-30T14:00:02.000Z'),
    });
    newsHandler?.({
      ticker: 'AAPL',
      items: [{ id: 'n1', title: 'Headline' }],
      timestamp: new Date('2026-03-30T14:00:03.000Z'),
    });

    expect(server.to).toHaveBeenCalledWith('ticker:AAPL');
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      'price-update',
      expect.objectContaining({ ticker: 'AAPL', price: 151 }),
    );
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      'instrument-update',
      expect.objectContaining({ ticker: 'AAPL' }),
    );
    expect(roomEmitter.emit).toHaveBeenCalledWith(
      'news-update',
      expect.objectContaining({ ticker: 'AAPL' }),
    );
  });

  it('tracks client connections, subscribes once per ticker, and sends immediate market context', async () => {
    const client = makeClient();

    gateway.handleConnection(client as any);
    const result = await gateway.handleTickerSubscription(client as any, {
      ticker: ' aapl ',
    });

    expect(client.join).toHaveBeenCalledWith('ticker:AAPL');
    expect(marketStreamManager.subscribe).toHaveBeenCalledWith('AAPL');
    expect(client.emit).toHaveBeenCalledWith(
      'price-update',
      expect.objectContaining({ ticker: 'AAPL', price: 151 }),
    );
    expect(client.emit).toHaveBeenCalledWith(
      'instrument-update',
      expect.objectContaining({ ticker: 'AAPL' }),
    );
    expect(client.emit).toHaveBeenCalledWith(
      'news-update',
      expect.objectContaining({ ticker: 'AAPL' }),
    );
    expect(result).toEqual({
      success: true,
      ticker: 'AAPL',
      message: 'Subscribed to AAPL',
    });

    await gateway.handleTickerSubscription(client as any, { ticker: 'AAPL' });
    expect(marketStreamManager.subscribe).toHaveBeenCalledTimes(1);
  });

  it('reports an operator-safe error when initial ticker hydration fails', async () => {
    const client = makeClient();
    marketDataService.getRealtimeQuote.mockRejectedValueOnce(
      new Error('provider down'),
    );

    const result = await gateway.handleTickerSubscription(client as any, {
      ticker: 'AAPL',
    });

    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Failed to fetch quote for AAPL',
    });
    expect(result.success).toBe(true);
  });

  it('unsubscribes clients from ticker rooms and tears down provider subscriptions', () => {
    const client = makeClient();
    gateway.handleConnection(client as any);
    (gateway as any).clientTickerSubscriptions.get(client.id).add('AAPL');

    const result = gateway.handleTickerUnsubscription(client as any, {
      ticker: 'AAPL',
    });

    expect(client.leave).toHaveBeenCalledWith('ticker:AAPL');
    expect(marketStreamManager.unsubscribe).toHaveBeenCalledWith('AAPL');
    expect(result).toEqual({
      success: true,
      ticker: 'AAPL',
      message: 'Unsubscribed from AAPL',
    });
  });

  it('subscribes to greeks, starts a stream once, and emits immediate analytics', async () => {
    const client = makeClient();
    const startGreeksStreamSpy = jest
      .spyOn(gateway as any, 'startGreeksStream')
      .mockResolvedValue(undefined);
    jest.spyOn(gateway as any, 'calculateTimeToMaturity').mockReturnValue(1.25);

    const result = await gateway.handleGreeksSubscription(client as any, {
      ticker: 'AAPL',
      strike: 100,
      maturity: '2030-01-01',
      optionType: OptionType.CALL,
      riskFreeRate: 0.05,
    });

    expect(client.join).toHaveBeenCalledWith('greeks:AAPL:100:2030-01-01:CALL');
    expect(startGreeksStreamSpy).toHaveBeenCalledWith(
      'AAPL',
      100,
      '2030-01-01',
      'CALL',
      0.05,
    );
    expect(optionsService.calculateGreeks).toHaveBeenCalledWith(
      expect.objectContaining({
        underlying: 150,
        strike: 100,
        timeToExpiry: 1.25,
        optionType: 'CALL',
      }),
    );
    expect(client.emit).toHaveBeenCalledWith(
      'greeks-update',
      expect.objectContaining({
        ticker: 'AAPL',
        strike: 100,
        optionType: 'CALL',
        underlyingPrice: 150,
      }),
    );
    expect(result).toEqual({
      success: true,
      message: 'Subscribed to Greeks',
    });
  });

  it('emits an error when immediate greeks calculation fails', async () => {
    const client = makeClient();
    jest
      .spyOn(gateway as any, 'startGreeksStream')
      .mockResolvedValue(undefined);
    marketDataService.getQuote.mockRejectedValueOnce(new Error('quote miss'));

    await gateway.handleGreeksSubscription(client as any, {
      ticker: 'AAPL',
      strike: 100,
      maturity: '2030-01-01',
      optionType: OptionType.CALL,
    });

    expect(client.emit).toHaveBeenCalledWith('error', {
      message: 'Failed to calculate Greeks',
    });
  });

  it('subscribes to portfolio pnl and starts the stream once per portfolio', async () => {
    const client = makeClient();
    const startPnLStreamSpy = jest
      .spyOn(gateway as any, 'startPnLStream')
      .mockResolvedValue(undefined);

    const result = await gateway.handlePortfolioPnLSubscription(client as any, {
      portfolioId: 'portfolio-1',
      userId: 'user-1',
    });

    expect(client.join).toHaveBeenCalledWith('pnl:portfolio-1');
    expect(startPnLStreamSpy).toHaveBeenCalledWith('portfolio-1', 'user-1');
    expect(result).toEqual({
      success: true,
      message: 'Subscribed to portfolio P&L',
    });

    (gateway as any).pnlIntervals.set('pnl:portfolio-1', {} as NodeJS.Timeout);
    await gateway.handlePortfolioPnLSubscription(client as any, {
      portfolioId: 'portfolio-1',
      userId: 'user-1',
    });
    expect(startPnLStreamSpy).toHaveBeenCalledTimes(1);
  });

  it('streams greeks updates, stops idle rooms, and logs errors without crashing the feed', async () => {
    const stopGreeksStreamSpy = jest.spyOn(gateway as any, 'stopGreeksStream');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    let callback!: () => Promise<void>;
    setIntervalSpy.mockImplementationOnce(((fn: any) => {
      callback = fn;
      return timer;
    }) as any);

    await (gateway as any).startGreeksStream(
      'AAPL',
      100,
      '2030-01-01',
      'CALL',
      0.05,
    );

    setRoomSize('greeks:AAPL:100:2030-01-01:CALL', 1);
    await callback();

    expect(roomEmitter.emit).toHaveBeenCalledWith(
      'greeks-update',
      expect.objectContaining({
        ticker: 'AAPL',
        strike: 100,
        optionType: 'CALL',
        underlyingPrice: 151,
      }),
    );
    expect((timer as any).unref).toHaveBeenCalled();

    setRoomSize('greeks:AAPL:100:2030-01-01:CALL', 0);
    await callback();
    expect(stopGreeksStreamSpy).toHaveBeenCalledWith(
      'greeks:AAPL:100:2030-01-01:CALL',
    );

    marketDataService.getRealtimeQuote.mockRejectedValueOnce(
      new Error('feed unavailable'),
    );
    setRoomSize('greeks:AAPL:100:2030-01-01:CALL', 1);
    await callback();

    setIntervalSpy.mockRestore();
  });

  it('streams portfolio pnl, skips empty portfolios, and stops idle rooms', async () => {
    const stopPnLStreamSpy = jest.spyOn(gateway as any, 'stopPnLStream');
    const setIntervalSpy = jest.spyOn(global, 'setInterval');
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    let callback!: () => Promise<void>;
    setIntervalSpy.mockImplementationOnce(((fn: any) => {
      callback = fn;
      return timer;
    }) as any);

    marketDataService.getRealtimeQuote.mockResolvedValue({
      price: 150,
      timestamp: new Date('2026-03-30T14:00:00.000Z'),
    });

    await (gateway as any).startPnLStream('portfolio-1', 'user-1');

    setRoomSize('pnl:portfolio-1', 1);
    await callback();

    expect(roomEmitter.emit).toHaveBeenCalledWith(
      'pnl-update',
      expect.objectContaining({
        portfolioId: 'portfolio-1',
        totalValue: 300,
        totalCost: 200,
        totalPnL: 100,
        totalPnLPercent: 50,
      }),
    );

    portfolioService.getPortfolio.mockResolvedValueOnce({
      id: 'portfolio-1',
      positions: [],
    });
    await callback();
    expect(roomEmitter.emit).toHaveBeenCalledTimes(1);

    setRoomSize('pnl:portfolio-1', 0);
    await callback();
    expect(stopPnLStreamSpy).toHaveBeenCalledWith('pnl:portfolio-1');

    setIntervalSpy.mockRestore();
  });

  it('cleans up subscriptions, intervals, and registered stream handlers on disconnect and destroy', () => {
    gateway.onModuleInit();
    const client = makeClient();
    gateway.handleConnection(client as any);
    (gateway as any).clientTickerSubscriptions.set(
      client.id,
      new Set(['AAPL']),
    );
    const greeksTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const pnlTimer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    (gateway as any).greeksIntervals.set(
      'greeks:AAPL:100:2030-01-01:CALL',
      greeksTimer,
    );
    (gateway as any).pnlIntervals.set('pnl:portfolio-1', pnlTimer);
    setRoomSize('greeks:AAPL:100:2030-01-01:CALL', 0);
    setRoomSize('pnl:portfolio-1', 0);

    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    gateway.handleDisconnect(client as any);

    expect(marketStreamManager.unsubscribe).toHaveBeenCalledWith('AAPL');
    expect((gateway as any).clientTickerSubscriptions.has(client.id)).toBe(
      false,
    );

    gateway.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledWith(greeksTimer);
    expect(clearIntervalSpy).toHaveBeenCalledWith(pnlTimer);
    clearIntervalSpy.mockRestore();
  });

  it('computes update intervals, room sizes, and price payloads', () => {
    expect((gateway as any).parseUpdateInterval('1500', 5000)).toBe(1500);
    expect((gateway as any).parseUpdateInterval('0', 5000)).toBe(5000);
    setRoomSize('ticker:AAPL', 3);
    expect((gateway as any).getRoomSize('ticker:AAPL')).toBe(3);
    expect((gateway as any).getRoomSize('ticker:MSFT')).toBe(0);

    const payload = (gateway as any).buildPriceUpdatePayload('AAPL', {
      assetType: 'stock',
      shortName: 'Apple',
      longName: 'Apple Inc.',
      exchange: 'NASDAQ',
      currency: 'USD',
      marketState: 'REGULAR',
      session: 'REGULAR',
      freshnessState: 'NEAR_REALTIME',
      provider: 'yahoo-finance',
      quoteTimestamp: new Date('2026-03-30T14:00:00.000Z'),
      serverTimestamp: new Date('2026-03-30T14:00:01.000Z'),
      ageMs: 1000,
      price: 151,
      change: 3.5,
      changePercent: 2.37,
      volume: 51000000,
      high: 153,
      low: 148,
      previousClose: 147.5,
      timestamp: new Date('2026-03-30T14:00:00.000Z'),
    });

    expect(payload).toEqual(
      expect.objectContaining({
        ticker: 'AAPL',
        price: 151,
        provider: 'yahoo-finance',
      }),
    );
  });
});
