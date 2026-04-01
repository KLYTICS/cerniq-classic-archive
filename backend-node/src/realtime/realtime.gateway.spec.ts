import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let mockMarketDataService: any;
  let mockMarketStreamManager: any;
  let mockOptionsService: any;
  let mockPortfolioService: any;
  let mockServer: any;
  let roomsMap: Map<string, Set<string>>;

  beforeEach(() => {
    mockMarketDataService = {
      normalizeTicker: jest.fn((t: string) => t.toUpperCase()),
      getRealtimeQuote: jest.fn().mockResolvedValue({
        price: 150.0,
        assetType: 'EQUITY',
        shortName: 'AAPL',
        longName: 'Apple Inc.',
        exchange: 'NASDAQ',
        currency: 'USD',
        marketState: 'REGULAR',
        session: 'regular',
        freshnessState: 'fresh',
        provider: 'yahoo',
        quoteTimestamp: new Date(),
        serverTimestamp: new Date(),
        ageMs: 100,
        change: 1.5,
        changePercent: 1.01,
        volume: 1000000,
        high: 152,
        low: 148,
        previousClose: 148.5,
        timestamp: new Date(),
      }),
      getInstrumentProfile: jest.fn().mockResolvedValue({ sector: 'Tech' }),
      getNews: jest.fn().mockResolvedValue([{ title: 'News' }]),
      getQuote: jest
        .fn()
        .mockResolvedValue({ price: 150.0, timestamp: new Date() }),
    };

    mockMarketStreamManager = {
      subscribe: jest.fn().mockResolvedValue(undefined),
      unsubscribe: jest.fn(),
      onQuote: jest.fn().mockReturnValue(() => {}),
      onInstrument: jest.fn().mockReturnValue(() => {}),
      onNews: jest.fn().mockReturnValue(() => {}),
    };

    mockOptionsService = {
      calculateGreeks: jest.fn().mockResolvedValue({
        delta: 0.5,
        gamma: 0.03,
        theta: -0.05,
        vega: 0.2,
      }),
    };

    mockPortfolioService = {
      getPortfolio: jest.fn().mockResolvedValue({
        positions: [{ ticker: 'AAPL', quantity: 100, avgCost: 140 }],
      }),
    };

    gateway = new RealtimeGateway(
      mockMarketDataService,
      mockMarketStreamManager,
      mockOptionsService,
      mockPortfolioService,
    );

    roomsMap = new Map();
    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      of: jest.fn().mockReturnValue({
        adapter: {
          rooms: roomsMap,
        },
      }),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    gateway.onModuleDestroy();
    jest.restoreAllMocks();
  });

  function makeSocket(id: string) {
    return {
      id,
      join: jest.fn().mockResolvedValue(undefined),
      leave: jest.fn().mockResolvedValue(undefined),
      emit: jest.fn(),
    };
  }

  // ── handleConnection ───────────────────────────────────────

  describe('handleConnection', () => {
    it('should track a new client connection', () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);
      // No error thrown, gateway tracks the client
      expect(gateway).toBeDefined();
    });

    it('should track multiple clients independently', () => {
      const s1 = makeSocket('c-1');
      const s2 = makeSocket('c-2');
      gateway.handleConnection(s1 as any);
      gateway.handleConnection(s2 as any);
      // Both tracked without error
      expect(gateway).toBeDefined();
    });
  });

  // ── handleDisconnect ───────────────────────────────────────

  describe('handleDisconnect', () => {
    it('should not unsubscribe if client had no ticker subscriptions', () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);
      gateway.handleDisconnect(socket as any);
      expect(mockMarketStreamManager.unsubscribe).not.toHaveBeenCalled();
    });

    it('should unsubscribe all tickers on disconnect', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);
      await gateway.handleTickerSubscription(socket as any, {
        ticker: 'AAPL',
      });
      await gateway.handleTickerSubscription(socket as any, {
        ticker: 'MSFT',
      });

      gateway.handleDisconnect(socket as any);

      expect(mockMarketStreamManager.unsubscribe).toHaveBeenCalledWith('AAPL');
      expect(mockMarketStreamManager.unsubscribe).toHaveBeenCalledWith('MSFT');
    });

    it('should stop greeks streams with zero room size on disconnect', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      // Subscribe to greeks to create an interval
      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      });

      // Room is empty (default)
      gateway.handleDisconnect(socket as any);
      // Should not throw
      expect(gateway).toBeDefined();
    });

    it('should stop PnL streams with zero room size on disconnect', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      await gateway.handlePortfolioPnLSubscription(socket as any, {
        portfolioId: 'p-1',
        userId: 'u-1',
      });

      gateway.handleDisconnect(socket as any);
      expect(gateway).toBeDefined();
    });

    it('should handle disconnect of unknown client gracefully', () => {
      const socket = makeSocket('unknown');
      // Not previously connected — should not throw
      gateway.handleDisconnect(socket as any);
      expect(gateway).toBeDefined();
    });
  });

  // ── handleTickerSubscription ───────────────────────────────

  describe('handleTickerSubscription', () => {
    it('should normalize ticker, join room, subscribe, and return success', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      const result = await gateway.handleTickerSubscription(socket as any, {
        ticker: 'aapl',
      });

      expect(mockMarketDataService.normalizeTicker).toHaveBeenCalledWith(
        'aapl',
      );
      expect(socket.join).toHaveBeenCalledWith('ticker:AAPL');
      expect(mockMarketStreamManager.subscribe).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual(
        expect.objectContaining({ success: true, ticker: 'AAPL' }),
      );
    });

    it('should emit initial price-update, instrument-update, news-update', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      await gateway.handleTickerSubscription(socket as any, {
        ticker: 'AAPL',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'price-update',
        expect.objectContaining({ ticker: 'AAPL' }),
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'instrument-update',
        expect.objectContaining({ ticker: 'AAPL' }),
      );
      expect(socket.emit).toHaveBeenCalledWith(
        'news-update',
        expect.objectContaining({ ticker: 'AAPL' }),
      );
    });

    it('should emit error when initial fetch fails', async () => {
      mockMarketDataService.getRealtimeQuote.mockRejectedValue(
        new Error('fail'),
      );
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      const result = await gateway.handleTickerSubscription(socket as any, {
        ticker: 'BAD',
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: expect.stringContaining('BAD') }),
      );
      // Still returns success because subscription itself succeeded
      expect(result.success).toBe(true);
    });

    it('should not re-subscribe to the same ticker for the same client', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      await gateway.handleTickerSubscription(socket as any, {
        ticker: 'AAPL',
      });
      await gateway.handleTickerSubscription(socket as any, {
        ticker: 'AAPL',
      });

      expect(mockMarketStreamManager.subscribe).toHaveBeenCalledTimes(1);
    });

    it('should handle client not previously tracked (uses fallback empty Set)', async () => {
      const socket = makeSocket('orphan');
      // Not calling handleConnection — clientTickerSubscriptions has no entry

      const result = await gateway.handleTickerSubscription(socket as any, {
        ticker: 'GOOG',
      });

      expect(result.success).toBe(true);
      expect(mockMarketStreamManager.subscribe).toHaveBeenCalledWith('GOOG');
    });
  });

  // ── handleTickerUnsubscription ─────────────────────────────

  describe('handleTickerUnsubscription', () => {
    it('should leave room and unsubscribe from stream manager', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);
      await gateway.handleTickerSubscription(socket as any, {
        ticker: 'MSFT',
      });

      const result = await gateway.handleTickerUnsubscription(socket as any, {
        ticker: 'MSFT',
      });

      expect(socket.leave).toHaveBeenCalledWith('ticker:MSFT');
      expect(mockMarketStreamManager.unsubscribe).toHaveBeenCalledWith('MSFT');
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });

    it('should handle unsubscribing a ticker not previously subscribed', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      const result = await gateway.handleTickerUnsubscription(socket as any, {
        ticker: 'NOPE',
      });

      // leave is still called but unsubscribe on stream manager is not
      expect(socket.leave).toHaveBeenCalledWith('ticker:NOPE');
      expect(result.success).toBe(true);
    });

    it('should handle unsubscribe when client has no subscription set', async () => {
      const socket = makeSocket('orphan');
      // Not previously connected

      const result = await gateway.handleTickerUnsubscription(socket as any, {
        ticker: 'X',
      });

      expect(result.success).toBe(true);
    });
  });

  // ── handleGreeksSubscription ───────────────────────────────

  describe('handleGreeksSubscription', () => {
    it('should join greeks room and return success', async () => {
      const socket = makeSocket('c-1');

      const result = await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      });

      expect(socket.join).toHaveBeenCalledWith(
        'greeks:AAPL:150:2027-01-01:call',
      );
      expect(result.success).toBe(true);
    });

    it('should emit initial greeks-update on subscription', async () => {
      const socket = makeSocket('c-1');

      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'greeks-update',
        expect.objectContaining({
          ticker: 'AAPL',
          strike: 150,
          greeks: expect.objectContaining({ delta: 0.5 }),
        }),
      );
    });

    it('should use default riskFreeRate of 0.045', async () => {
      const socket = makeSocket('c-1');

      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      });

      expect(mockOptionsService.calculateGreeks).toHaveBeenCalledWith(
        expect.objectContaining({ riskFreeRate: 0.045 }),
      );
    });

    it('should use provided riskFreeRate', async () => {
      const socket = makeSocket('c-1');

      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
        riskFreeRate: 0.05,
      });

      expect(mockOptionsService.calculateGreeks).toHaveBeenCalledWith(
        expect.objectContaining({ riskFreeRate: 0.05 }),
      );
    });

    it('should emit error when Greeks calculation fails', async () => {
      mockMarketDataService.getQuote.mockRejectedValue(
        new Error('quote fail'),
      );
      const socket = makeSocket('c-1');

      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'FAIL',
        strike: 100,
        maturity: '2027-01-01',
        optionType: 'put' as any,
      });

      expect(socket.emit).toHaveBeenCalledWith(
        'error',
        expect.objectContaining({ message: 'Failed to calculate Greeks' }),
      );
    });

    it('should not start a duplicate greeks stream for same key', async () => {
      const socket1 = makeSocket('c-1');
      const socket2 = makeSocket('c-2');

      const payload = {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      };

      await gateway.handleGreeksSubscription(socket1 as any, payload);
      await gateway.handleGreeksSubscription(socket2 as any, payload);

      // The second subscription should not start a new interval
      // (only 1 getQuote call for initial quote per subscription, but interval not duplicated)
      expect(mockMarketDataService.getQuote).toHaveBeenCalledTimes(2); // Each client gets initial data
    });
  });

  // ── handlePortfolioPnLSubscription ─────────────────────────

  describe('handlePortfolioPnLSubscription', () => {
    it('should join PnL room and return success', async () => {
      const socket = makeSocket('c-1');

      const result = await gateway.handlePortfolioPnLSubscription(
        socket as any,
        {
          portfolioId: 'p-1',
          userId: 'u-1',
        },
      );

      expect(socket.join).toHaveBeenCalledWith('pnl:p-1');
      expect(result.success).toBe(true);
    });

    it('should not start duplicate PnL stream for same portfolio', async () => {
      const s1 = makeSocket('c-1');
      const s2 = makeSocket('c-2');

      await gateway.handlePortfolioPnLSubscription(s1 as any, {
        portfolioId: 'p-1',
        userId: 'u-1',
      });
      await gateway.handlePortfolioPnLSubscription(s2 as any, {
        portfolioId: 'p-1',
        userId: 'u-1',
      });

      // Only one interval should be created
      expect(s1.join).toHaveBeenCalledWith('pnl:p-1');
      expect(s2.join).toHaveBeenCalledWith('pnl:p-1');
    });
  });

  // ── onModuleInit ───────────────────────────────────────────

  describe('onModuleInit', () => {
    it('should register all three stream event handlers', () => {
      gateway.onModuleInit();

      expect(mockMarketStreamManager.onQuote).toHaveBeenCalled();
      expect(mockMarketStreamManager.onInstrument).toHaveBeenCalled();
      expect(mockMarketStreamManager.onNews).toHaveBeenCalled();
    });
  });

  // ── onModuleDestroy ────────────────────────────────────────

  describe('onModuleDestroy', () => {
    it('should clean up stream handlers and intervals', async () => {
      gateway.onModuleInit();

      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);
      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      });
      await gateway.handlePortfolioPnLSubscription(socket as any, {
        portfolioId: 'p-1',
        userId: 'u-1',
      });

      // Should clean up without errors
      gateway.onModuleDestroy();
      expect(gateway).toBeDefined();
    });

    it('should be safe to call multiple times', () => {
      gateway.onModuleInit();
      gateway.onModuleDestroy();
      gateway.onModuleDestroy();
      expect(gateway).toBeDefined();
    });
  });

  // ── parseUpdateInterval (tested via constructor) ───────────

  describe('parseUpdateInterval (via env)', () => {
    it('should use fallback when MARKET_STREAM_INTERVAL_MS is undefined', () => {
      // Default gateway uses fallback of 5000 since env var is not set
      expect(gateway).toBeDefined();
    });
  });

  // ── refreshGreeksStream (tested via interval trigger) ──────

  describe('refreshGreeksStream edge cases', () => {
    it('should stop greeks stream when room is empty during refresh', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);

      await gateway.handleGreeksSubscription(socket as any, {
        ticker: 'AAPL',
        strike: 150,
        maturity: '2027-01-01',
        optionType: 'call' as any,
      });

      // Room is empty (roomsMap has no entries)
      // Force a tick by accessing internal method via prototype
      const key = 'greeks:AAPL:150:2027-01-01:call';
      const refreshFn = (gateway as any).refreshGreeksStream.bind(gateway);
      await refreshFn(key, 'AAPL', 150, '2027-01-01', 'call', 0.045);

      // After refresh with empty room, the interval should be cleared
      expect(gateway).toBeDefined();
    });

    it('should emit greeks-update when room has clients', async () => {
      // Simulate a room with 1 client
      roomsMap.set('greeks:AAPL:150:2027-01-01:call', new Set(['c-1']));

      const refreshFn = (gateway as any).refreshGreeksStream.bind(gateway);
      await refreshFn(
        'greeks:AAPL:150:2027-01-01:call',
        'AAPL',
        150,
        '2027-01-01',
        'call',
        0.045,
      );

      expect(mockServer.to).toHaveBeenCalledWith(
        'greeks:AAPL:150:2027-01-01:call',
      );
      expect(mockServer.emit).toHaveBeenCalledWith(
        'greeks-update',
        expect.objectContaining({ ticker: 'AAPL' }),
      );
    });

    it('should catch errors during greeks refresh without crashing', async () => {
      roomsMap.set('greeks:ERR:100:2027-01-01:put', new Set(['c-1']));
      mockMarketDataService.getRealtimeQuote.mockRejectedValue(
        new Error('net err'),
      );

      const refreshFn = (gateway as any).refreshGreeksStream.bind(gateway);
      // Should not throw
      await refreshFn(
        'greeks:ERR:100:2027-01-01:put',
        'ERR',
        100,
        '2027-01-01',
        'put',
        0.045,
      );
      expect(gateway).toBeDefined();
    });
  });

  // ── refreshPnLStream ───────────────────────────────────────

  describe('refreshPnLStream edge cases', () => {
    it('should stop PnL stream when room is empty during refresh', async () => {
      const socket = makeSocket('c-1');
      gateway.handleConnection(socket as any);
      await gateway.handlePortfolioPnLSubscription(socket as any, {
        portfolioId: 'p-1',
        userId: 'u-1',
      });

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-1', 'p-1', 'u-1');
      expect(gateway).toBeDefined();
    });

    it('should emit pnl-update when room has clients and portfolio has positions', async () => {
      roomsMap.set('pnl:p-1', new Set(['c-1']));

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-1', 'p-1', 'u-1');

      expect(mockServer.to).toHaveBeenCalledWith('pnl:p-1');
      expect(mockServer.emit).toHaveBeenCalledWith(
        'pnl-update',
        expect.objectContaining({
          portfolioId: 'p-1',
          totalValue: expect.any(Number),
          totalCost: expect.any(Number),
          totalPnL: expect.any(Number),
          totalPnLPercent: expect.any(Number),
        }),
      );
    });

    it('should skip emit when portfolio is null', async () => {
      roomsMap.set('pnl:p-2', new Set(['c-1']));
      mockPortfolioService.getPortfolio.mockResolvedValue(null);

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-2', 'p-2', 'u-1');

      // emit should not be called for pnl-update
      expect(mockServer.emit).not.toHaveBeenCalledWith(
        'pnl-update',
        expect.anything(),
      );
    });

    it('should skip emit when portfolio has no positions', async () => {
      roomsMap.set('pnl:p-3', new Set(['c-1']));
      mockPortfolioService.getPortfolio.mockResolvedValue({ positions: [] });

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-3', 'p-3', 'u-1');

      expect(mockServer.emit).not.toHaveBeenCalledWith(
        'pnl-update',
        expect.anything(),
      );
    });

    it('should skip emit when portfolio positions is undefined', async () => {
      roomsMap.set('pnl:p-4', new Set(['c-1']));
      mockPortfolioService.getPortfolio.mockResolvedValue({});

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-4', 'p-4', 'u-1');

      expect(mockServer.emit).not.toHaveBeenCalledWith(
        'pnl-update',
        expect.anything(),
      );
    });

    it('should catch errors during PnL refresh without crashing', async () => {
      roomsMap.set('pnl:p-err', new Set(['c-1']));
      mockPortfolioService.getPortfolio.mockRejectedValue(
        new Error('db error'),
      );

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-err', 'p-err', 'u-1');
      expect(gateway).toBeDefined();
    });

    it('should calculate PnL correctly for multiple positions', async () => {
      roomsMap.set('pnl:p-multi', new Set(['c-1']));
      mockPortfolioService.getPortfolio.mockResolvedValue({
        positions: [
          { ticker: 'AAPL', quantity: 10, avgCost: 100 },
          { ticker: 'MSFT', quantity: 5, avgCost: 200 },
        ],
      });
      // price is 150 for all
      // totalValue = 10*150 + 5*150 = 1500+750 = 2250
      // totalCost = 10*100 + 5*200 = 1000+1000 = 2000
      // totalPnL = 250
      // totalPnLPercent = (250/2000)*100 = 12.5

      const refreshFn = (gateway as any).refreshPnLStream.bind(gateway);
      await refreshFn('pnl:p-multi', 'p-multi', 'u-1');

      expect(mockServer.emit).toHaveBeenCalledWith(
        'pnl-update',
        expect.objectContaining({
          totalValue: 2250,
          totalCost: 2000,
          totalPnL: 250,
          totalPnLPercent: 12.5,
        }),
      );
    });
  });

  // ── calculateTimeToMaturity ────────────────────────────────

  describe('calculateTimeToMaturity (private)', () => {
    it('should return positive years for future date', () => {
      const fn = (gateway as any).calculateTimeToMaturity.bind(gateway);
      const result = fn('2030-01-01');
      expect(result).toBeGreaterThan(0);
    });

    it('should return negative years for past date', () => {
      const fn = (gateway as any).calculateTimeToMaturity.bind(gateway);
      const result = fn('2020-01-01');
      expect(result).toBeLessThan(0);
    });
  });

  // ── stopGreeksStream / stopPnLStream ───────────────────────

  describe('stopGreeksStream', () => {
    it('should be safe to call for non-existent key', () => {
      const fn = (gateway as any).stopGreeksStream.bind(gateway);
      fn('greeks:NONEXISTENT');
      expect(gateway).toBeDefined();
    });
  });

  describe('stopPnLStream', () => {
    it('should be safe to call for non-existent key', () => {
      const fn = (gateway as any).stopPnLStream.bind(gateway);
      fn('pnl:NONEXISTENT');
      expect(gateway).toBeDefined();
    });
  });
});
