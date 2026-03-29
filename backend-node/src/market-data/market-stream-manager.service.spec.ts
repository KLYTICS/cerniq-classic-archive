import { MarketStreamManagerService } from './market-stream-manager.service';

describe('MarketStreamManagerService', () => {
  let service: MarketStreamManagerService;
  const mockMarketDataService = {
    normalizeTicker: jest.fn((t: string) => t.toUpperCase()),
    getRealtimeQuote: jest.fn().mockResolvedValue({
      ticker: 'AAPL',
      price: 150,
      change: 1,
      changePercent: 0.67,
    }),
    getInstrumentProfile: jest.fn().mockResolvedValue({
      ticker: 'AAPL',
      assetType: 'stock',
      shortName: 'Apple',
    }),
    getNews: jest.fn().mockResolvedValue([]),
  };

  beforeEach(() => {
    service = new MarketStreamManagerService(mockMarketDataService as any);
    jest.clearAllMocks();
  });

  afterEach(() => {
    service.onModuleDestroy();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('subscribe creates a stream and returns subscriber count', async () => {
    const result = await service.subscribe('AAPL');
    expect(result.ticker).toBe('AAPL');
    expect(result.subscribers).toBe(1);
  });

  it('subscribe increments subscriber count on repeated calls', async () => {
    await service.subscribe('AAPL');
    const result = await service.subscribe('AAPL');
    expect(result.subscribers).toBe(2);
  });

  it('unsubscribe decrements subscriber count', async () => {
    await service.subscribe('AAPL');
    await service.subscribe('AAPL');
    const result = service.unsubscribe('AAPL');
    expect(result.subscribers).toBe(1);
  });

  it('unsubscribe returns 0 for unknown ticker', () => {
    const result = service.unsubscribe('UNKNOWN');
    expect(result.subscribers).toBe(0);
  });

  it('getStreamStatus returns status of all active streams', async () => {
    await service.subscribe('AAPL');
    const statuses = service.getStreamStatus();
    expect(statuses).toHaveLength(1);
    expect(statuses[0].ticker).toBe('AAPL');
    expect(statuses[0].subscribers).toBe(1);
    expect(statuses[0]).toHaveProperty('startedAt');
  });
});
