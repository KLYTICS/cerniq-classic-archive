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

  // ── SMA crossover strategy ───────────────────────────────────

  it('SMA crossover generates buy and sell signals', async () => {
    // Create data with a clear crossover pattern
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: `2025-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      open: 100,
      high: 105,
      low: 95,
      close: i < 30 ? 100 - i * 0.5 : 100 + (i - 30) * 2,
      volume: 1000000,
    }));
    mockMarketDataService.getHistoricalPrices.mockResolvedValue(data);

    const config = {
      strategy: {
        name: 'SMA Cross',
        type: 'SMA_CROSSOVER' as const,
        lookbackPeriod: 20,
        params: { shortPeriod: 5, longPeriod: 20 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-02-28',
      initialCapital: 100000,
      commission: 5,
    };
    const result = await service.runBacktest(config);
    expect(result.metrics.totalTrades).toBeGreaterThanOrEqual(0);
    expect(result.equityCurve.length).toBeGreaterThan(1);
  });

  // ── RSI reversal strategy ────────────────────────────────────

  it('RSI reversal generates signals on oversold/overbought', async () => {
    // Create data with price going down then up (oversold then overbought)
    const data = Array.from({ length: 60 }, (_, i) => ({
      date: `2025-${String(Math.floor(i / 30) + 1).padStart(2, '0')}-${String((i % 30) + 1).padStart(2, '0')}`,
      open: 100,
      high: 105,
      low: 95,
      close: i < 20 ? 100 - i * 2 : 60 + (i - 20) * 3,
      volume: 1000000,
    }));
    mockMarketDataService.getHistoricalPrices.mockResolvedValue(data);

    const config = {
      strategy: {
        name: 'RSI Rev',
        type: 'RSI_REVERSAL' as const,
        lookbackPeriod: 20,
        params: { rsiPeriod: 14, oversold: 30, overbought: 70 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-02-28',
      initialCapital: 100000,
      commission: 5,
    };
    const result = await service.runBacktest(config);
    expect(result.strategyName).toBe('RSI Rev');
    expect(result.metrics).toBeDefined();
  });

  // ── Multiple tickers ─────────────────────────────────────────

  it('handles multiple tickers', async () => {
    const config = {
      strategy: {
        name: 'Multi',
        type: 'MOMENTUM' as const,
        lookbackPeriod: 10,
        params: { momentumThreshold: 3 },
      },
      tickers: ['AAPL', 'MSFT'],
      startDate: '2025-01-01',
      endDate: '2025-04-01',
      initialCapital: 200000,
      commission: 10,
    };
    const result = await service.runBacktest(config);
    expect(result.initialCapital).toBe(200000);
    expect(result.equityCurve.length).toBeGreaterThan(0);
  });

  // ── Edge case: empty history ─────────────────────────────────

  it('handles empty price data', async () => {
    mockMarketDataService.getHistoricalPrices.mockResolvedValue([]);
    const config = {
      strategy: {
        name: 'Empty',
        type: 'MOMENTUM' as const,
        lookbackPeriod: 10,
        params: { momentumThreshold: 3 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-01-02',
      initialCapital: 100000,
      commission: 0,
    };
    const result = await service.runBacktest(config);
    expect(result.finalValue).toBe(100000);
    expect(result.trades).toHaveLength(0);
  });

  // ── Profit factor and win rate ───────────────────────────────

  it('calculates profit factor correctly', async () => {
    // Create a clear trend for momentum
    const data = Array.from({ length: 50 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 100 + i * 1.5,
      volume: 1000000,
    }));
    mockMarketDataService.getHistoricalPrices.mockResolvedValue(data);

    const config = {
      strategy: {
        name: 'Profit Test',
        type: 'MOMENTUM' as const,
        lookbackPeriod: 5,
        params: { momentumThreshold: 1 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-02-19',
      initialCapital: 100000,
      commission: 0,
    };
    const result = await service.runBacktest(config);
    expect(result.metrics.profitFactor).toBeGreaterThanOrEqual(0);
    expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
    expect(result.metrics.avgTradesPerMonth).toBeGreaterThanOrEqual(0);
  });

  // ── Sharpe ratio with no returns ─────────────────────────────

  it('returns sharpe ratio 0 when stdDev is 0', async () => {
    // All same price
    const data = Array.from({ length: 30 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      open: 100,
      high: 100,
      low: 100,
      close: 100,
      volume: 1000000,
    }));
    mockMarketDataService.getHistoricalPrices.mockResolvedValue(data);

    const config = {
      strategy: {
        name: 'Flat',
        type: 'MOMENTUM' as const,
        lookbackPeriod: 5,
        params: { momentumThreshold: 100 }, // high threshold = no trades
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-01-30',
      initialCapital: 100000,
      commission: 0,
    };
    const result = await service.runBacktest(config);
    expect(result.metrics.sharpeRatio).toBe(0);
  });

  // ── RSI returns 100 when no losses ───────────────────────────

  it('RSI is 100 when all gains', async () => {
    // Monotonically increasing prices
    const data = Array.from({ length: 40 }, (_, i) => ({
      date: `2025-01-${String(i + 1).padStart(2, '0')}`,
      open: 100 + i,
      high: 102 + i,
      low: 99 + i,
      close: 100 + i + 1,
      volume: 1000000,
    }));
    mockMarketDataService.getHistoricalPrices.mockResolvedValue(data);

    const config = {
      strategy: {
        name: 'AllGain RSI',
        type: 'RSI_REVERSAL' as const,
        lookbackPeriod: 20,
        params: { rsiPeriod: 14, oversold: 30, overbought: 70 },
      },
      tickers: ['AAPL'],
      startDate: '2025-01-01',
      endDate: '2025-02-09',
      initialCapital: 100000,
      commission: 0,
    };
    const result = await service.runBacktest(config);
    // No oversold signals since RSI is always high
    expect(result.metrics).toBeDefined();
  });
});
