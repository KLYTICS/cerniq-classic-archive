import { BacktestService } from './backtest.service';

describe('BacktestService', () => {
  let service: BacktestService;
  const historicalPrices = Array.from({ length: 100 }, (_, i) => ({
    date: `2025-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
    open: 100 + i * 0.5,
    high: 102 + i * 0.5,
    low: 98 + i * 0.5,
    close: 100 + i * 0.5 + Math.sin(i / 5) * 3,
    volume: 1000000,
  }));

  const mockMarketDataService = {
    getHistoricalPrices: jest.fn().mockResolvedValue(historicalPrices),
  };

  beforeEach(() => {
    service = new BacktestService(mockMarketDataService as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('runBacktest with momentum strategy returns performance metrics', async () => {
    const config = {
      strategy: {
        name: 'Test Momentum',
        type: 'MOMENTUM' as const,
        lookbackPeriod: 20,
        params: { momentumThreshold: 5 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-04-01',
      initialCapital: 100000,
      commission: 9.99,
    };
    const result = await service.runBacktest(config);
    expect(result.strategyName).toBe('Test Momentum');
    expect(result.initialCapital).toBe(100000);
    expect(typeof result.finalValue).toBe('number');
    expect(result.metrics).toHaveProperty('totalReturn');
    expect(result.metrics).toHaveProperty('sharpeRatio');
    expect(result.metrics).toHaveProperty('maxDrawdown');
    expect(result.metrics).toHaveProperty('winRate');
  });

  it('runBacktest equity curve starts at initial capital', async () => {
    const config = {
      strategy: {
        name: 'SMA Test',
        type: 'SMA_CROSSOVER' as const,
        lookbackPeriod: 20,
        params: { shortPeriod: 5, longPeriod: 20 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-04-01',
      initialCapital: 50000,
      commission: 0,
    };
    const result = await service.runBacktest(config);
    expect(result.equityCurve[0].value).toBe(50000);
    expect(result.equityCurve.length).toBeGreaterThan(1);
  });

  it('runBacktest max drawdown is between 0 and 100', async () => {
    const config = {
      strategy: {
        name: 'RSI Test',
        type: 'RSI_REVERSAL' as const,
        lookbackPeriod: 20,
        params: { rsiPeriod: 14, oversold: 30, overbought: 70 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-04-01',
      initialCapital: 100000,
      commission: 5,
    };
    const result = await service.runBacktest(config);
    expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    expect(result.metrics.maxDrawdown).toBeLessThanOrEqual(100);
  });

  it('runBacktest with zero-commission has no commission impact', async () => {
    const config = {
      strategy: {
        name: 'Momentum',
        type: 'MOMENTUM' as const,
        lookbackPeriod: 10,
        params: { momentumThreshold: 2 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-04-01',
      initialCapital: 100000,
      commission: 0,
    };
    const result = await service.runBacktest(config);
    for (const trade of result.trades) {
      expect(trade.commission).toBe(0);
    }
  });
});
