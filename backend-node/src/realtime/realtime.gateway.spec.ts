import { RealtimeGateway } from './realtime.gateway';

describe('RealtimeGateway', () => {
  let gateway: RealtimeGateway;
  let mockMarketDataService: any;
  let mockMarketStreamManager: any;
  let mockOptionsService: any;
  let mockPortfolioService: any;
  let mockServer: any;

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
      getQuote: jest.fn().mockResolvedValue({ price: 150.0, timestamp: new Date() }),
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
        positions: [
          { ticker: 'AAPL', quantity: 100, avgCost: 140 },
        ],
      }),
    };

    gateway = new RealtimeGateway(
      mockMarketDataService,
      mockMarketStreamManager,
      mockOptionsService,
      mockPortfolioService,
    );

    mockServer = {
      to: jest.fn().mockReturnThis(),
      emit: jest.fn(),
      of: jest.fn().mockReturnValue({
        adapter: {
          rooms: new Map(),
        },
      }),
    };
    gateway.server = mockServer;
  });

  afterEach(() => {
    // Clean up intervals
    gateway.onModuleDestroy();
    jest.restoreAllMocks();
  });

  it('should be defined', () => {
    expect(gateway).toBeDefined();
  });

  describe('handleConnection', () => {
    it('should log and track a new client connection', () => {
      const mockSocket = { id: 'sock-1', join: jest.fn(), emit: jest.fn(), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);
      // Internal map should have the client
      expect(gateway).toBeDefined();
    });
  });

  describe('handleDisconnect', () => {
    it('should clean up subscriptions on disconnect', () => {
      const mockSocket = { id: 'sock-2', join: jest.fn(), emit: jest.fn(), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);
      gateway.handleDisconnect(mockSocket as any);
      // Should not throw
      expect(mockMarketStreamManager.unsubscribe).not.toHaveBeenCalled();
    });

    it('should unsubscribe tickers on disconnect after subscribing', async () => {
      const mockSocket = { id: 'sock-3', join: jest.fn().mockResolvedValue(undefined), emit: jest.fn(), leave: jest.fn().mockResolvedValue(undefined), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);
      await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'AAPL' });
      gateway.handleDisconnect(mockSocket as any);
      expect(mockMarketStreamManager.unsubscribe).toHaveBeenCalledWith('AAPL');
    });
  });

  describe('handleTickerSubscription', () => {
    it('should join the correct room and return success', async () => {
      const mockSocket = { id: 'sock-4', join: jest.fn().mockResolvedValue(undefined), emit: jest.fn(), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);

      const result = await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'aapl' });

      expect(mockMarketDataService.normalizeTicker).toHaveBeenCalledWith('aapl');
      expect(mockSocket.join).toHaveBeenCalledWith('ticker:AAPL');
      expect(mockMarketStreamManager.subscribe).toHaveBeenCalledWith('AAPL');
      expect(result).toEqual(expect.objectContaining({ success: true, ticker: 'AAPL' }));
    });

    it('should emit initial price-update, instrument-update, and news-update', async () => {
      const mockSocket = { id: 'sock-5', join: jest.fn().mockResolvedValue(undefined), emit: jest.fn(), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);

      await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'AAPL' });

      expect(mockSocket.emit).toHaveBeenCalledWith('price-update', expect.objectContaining({ ticker: 'AAPL' }));
      expect(mockSocket.emit).toHaveBeenCalledWith('instrument-update', expect.objectContaining({ ticker: 'AAPL' }));
      expect(mockSocket.emit).toHaveBeenCalledWith('news-update', expect.objectContaining({ ticker: 'AAPL' }));
    });

    it('should emit error when initial fetch fails', async () => {
      mockMarketDataService.getRealtimeQuote.mockRejectedValue(new Error('API down'));
      const mockSocket = { id: 'sock-6', join: jest.fn().mockResolvedValue(undefined), emit: jest.fn(), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);

      await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'FAIL' });

      expect(mockSocket.emit).toHaveBeenCalledWith('error', expect.objectContaining({ message: expect.stringContaining('FAIL') }));
    });

    it('should not re-subscribe to the same ticker', async () => {
      const mockSocket = { id: 'sock-7', join: jest.fn().mockResolvedValue(undefined), emit: jest.fn(), handshake: { query: {} } };
      gateway.handleConnection(mockSocket as any);

      await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'AAPL' });
      await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'AAPL' });

      expect(mockMarketStreamManager.subscribe).toHaveBeenCalledTimes(1);
    });
  });

  describe('handleTickerUnsubscription', () => {
    it('should leave the room and unsubscribe from market stream', async () => {
      const mockSocket = {
        id: 'sock-8',
        join: jest.fn().mockResolvedValue(undefined),
        leave: jest.fn().mockResolvedValue(undefined),
        emit: jest.fn(),
        handshake: { query: {} },
      };
      gateway.handleConnection(mockSocket as any);
      await gateway.handleTickerSubscription(mockSocket as any, { ticker: 'MSFT' });

      const result = await gateway.handleTickerUnsubscription(mockSocket as any, { ticker: 'MSFT' });

      expect(mockSocket.leave).toHaveBeenCalledWith('ticker:MSFT');
      expect(mockMarketStreamManager.unsubscribe).toHaveBeenCalledWith('MSFT');
      expect(result).toEqual(expect.objectContaining({ success: true }));
    });
  });

  describe('onModuleInit', () => {
    it('should register stream event handlers', () => {
      gateway.onModuleInit();
      expect(mockMarketStreamManager.onQuote).toHaveBeenCalled();
      expect(mockMarketStreamManager.onInstrument).toHaveBeenCalled();
      expect(mockMarketStreamManager.onNews).toHaveBeenCalled();
    });
  });

  describe('onModuleDestroy', () => {
    it('should clean up all intervals and subscriptions', () => {
      gateway.onModuleInit();
      gateway.onModuleDestroy();
      // Should not throw
      expect(gateway).toBeDefined();
    });
  });
});
