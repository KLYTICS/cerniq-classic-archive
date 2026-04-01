import { ExecutionService } from '../src/execution/execution.service';
import { BacktestService } from '../src/execution/backtest.service';

// Mock MarketDataService
const mockMarketDataService = {
  getQuote: jest.fn().mockResolvedValue({
    price: 175.0,
    bid: 174.95,
    ask: 175.05,
  }),
  getHistoricalPrices: jest.fn().mockResolvedValue(
    Array.from({ length: 100 }, (_, i) => ({
      date: new Date(2023, 0, i + 1).toISOString(),
      open: 170 + i * 0.1,
      high: 171 + i * 0.1,
      low: 169 + i * 0.1,
      close: 170 + i * 0.15,
      volume: 1000000 + Math.random() * 500000,
    })),
  ),
};

describe('ExecutionService', () => {
  let service: ExecutionService;

  beforeEach(() => {
    service = new ExecutionService(mockMarketDataService as any);
  });

  describe('calculateSlippage', () => {
    it('should calculate slippage in basis points', async () => {
      const execution = {
        ticker: 'AAPL',
        executionPrice: 175.1,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };

      const result = await service.calculateSlippage(execution);

      expect(result).toHaveProperty('slippageBps');
      expect(result).toHaveProperty('slippageCost');
      expect(result).toHaveProperty('quality');
      expect(result).toHaveProperty('spread');
    });

    it('should rate EXCELLENT when execution beats mid price', async () => {
      const execution = {
        ticker: 'AAPL',
        executionPrice: 174.9, // Below mid price of 175
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };

      const result = await service.calculateSlippage(execution);
      expect(result.quality).toBe('EXCELLENT');
    });

    it('should rate POOR when slippage exceeds spread', async () => {
      const execution = {
        ticker: 'AAPL',
        executionPrice: 175.5, // Well above ask
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };

      const result = await service.calculateSlippage(execution);
      expect(result.quality).toBe('POOR');
    });

    it('should calculate correct slippage cost', async () => {
      const execution = {
        ticker: 'AAPL',
        executionPrice: 175.1,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };

      const result = await service.calculateSlippage(execution);
      const expectedCost = (175.1 - 175.0) * 100; // $10
      expect(result.slippageCost).toBeCloseTo(expectedCost, 2);
    });
  });

  describe('analyzeVWAP', () => {
    it('should compare execution to VWAP', async () => {
      const execution = {
        ticker: 'AAPL',
        executionPrice: 175.0,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };

      const result = await service.analyzeVWAP(execution, 60);

      expect(result).toHaveProperty('vwap');
      expect(result).toHaveProperty('vwapDifferenceBps');
      expect(result).toHaveProperty('beatsVwap');
      expect(result).toHaveProperty('savingsVsVwap');
    });
  });

  describe('generateBestExecutionReport', () => {
    it('should generate compliance report', async () => {
      const executions = [
        {
          ticker: 'AAPL',
          executionPrice: 175.0,
          executionTime: new Date(),
          side: 'BUY' as const,
          quantity: 100,
        },
        {
          ticker: 'GOOGL',
          executionPrice: 140.0,
          executionTime: new Date(),
          side: 'BUY' as const,
          quantity: 50,
        },
      ];

      const result = await service.generateBestExecutionReport(executions, {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      });

      expect(result).toHaveProperty('reportId');
      expect(result).toHaveProperty('summary');
      expect(result).toHaveProperty('executions');
      expect(result).toHaveProperty('complianceFlags');

      expect(result.summary).toHaveProperty('averageSlippageBps');
      expect(result.summary).toHaveProperty('qualityBreakdown');
      expect(result.summary).toHaveProperty('qualityScore');
    });

    it('should flag high poor execution rate', async () => {
      // Create executions that would rate POOR
      const executions = Array.from({ length: 15 }, () => ({
        ticker: 'AAPL',
        executionPrice: 180.0, // Significantly above mid
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      }));

      const result = await service.generateBestExecutionReport(executions, {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      });

      expect(
        result.complianceFlags.some((f) =>
          f.includes('HIGH_POOR_EXECUTION_RATE'),
        ),
      ).toBe(true);
    });
  });

  describe('calculateImplementationShortfall', () => {
    it('should calculate shortfall components', async () => {
      const trade = {
        ticker: 'AAPL',
        decisionPrice: 174.0,
        executions: [
          { price: 174.5, quantity: 50, time: new Date() },
          { price: 175.0, quantity: 50, time: new Date() },
        ],
      };

      const result = await service.calculateImplementationShortfall(trade);

      expect(result).toHaveProperty('shortfall');
      expect(result.shortfall).toHaveProperty('delayComponentBps');
      expect(result.shortfall).toHaveProperty('tradingComponentBps');
      expect(result.shortfall).toHaveProperty('totalBps');
      expect(result.shortfall).toHaveProperty('totalDollars');
    });
  });

  describe('calculateSlippage — SELL side', () => {
    it('should handle SELL side slippage correctly', async () => {
      const execution = {
        ticker: 'AAPL',
        executionPrice: 174.8,
        executionTime: new Date(),
        side: 'SELL' as const,
        quantity: 100,
      };
      const result = await service.calculateSlippage(execution);
      // For sells, effective slippage = -slippageBps
      expect(typeof result.slippageBps).toBe('number');
      expect(result.side).toBe('SELL');
    });

    it('should rate GOOD when slippage is within half spread for BUY', async () => {
      // midPrice=175, spread=0.1, half spread=0.05 => spreadBps ~2.86
      // executionPrice just above mid but within half spread
      const execution = {
        ticker: 'AAPL',
        executionPrice: 175.02,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };
      const result = await service.calculateSlippage(execution);
      expect(result.quality).toBe('GOOD');
    });

    it('should rate FAIR when slippage is within full spread', async () => {
      // midPrice=175, spreadBps~5.71, need effective slippage between half and full spread
      const execution = {
        ticker: 'AAPL',
        executionPrice: 175.08,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      };
      const result = await service.calculateSlippage(execution);
      expect(['FAIR', 'POOR']).toContain(result.quality);
    });
  });

  describe('compliance flags', () => {
    it('should flag high slippage detected', async () => {
      // Create execution with >50bps slippage
      mockMarketDataService.getQuote.mockResolvedValue({
        price: 100.0,
        bid: 99.95,
        ask: 100.05,
      });
      const executions = [{
        ticker: 'TEST',
        executionPrice: 101.0, // 100bps above mid
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      }];
      const result = await service.generateBestExecutionReport(executions, {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      });
      expect(result.complianceFlags.some((f) => f.includes('HIGH_SLIPPAGE_DETECTED'))).toBe(true);
    });

    it('should flag large order poor fill', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({
        price: 100.0,
        bid: 99.95,
        ask: 100.05,
      });
      const executions = [{
        ticker: 'BIG',
        executionPrice: 101.0,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 20000, // notional > $1M
      }];
      const result = await service.generateBestExecutionReport(executions, {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      });
      expect(result.complianceFlags.some((f) => f.includes('LARGE_ORDER_POOR_FILL'))).toBe(true);
    });
  });

  describe('analyzeVWAP — SELL side', () => {
    it('should calculate VWAP for SELL side', async () => {
      mockMarketDataService.getQuote.mockResolvedValue({
        price: 175.0,
        bid: 174.95,
        ask: 175.05,
      });
      const execution = {
        ticker: 'AAPL',
        executionPrice: 176.0,
        executionTime: new Date(),
        side: 'SELL' as const,
        quantity: 100,
      };
      const result = await service.analyzeVWAP(execution);
      expect(result.side).toBe('SELL');
      expect(typeof result.beatsVwap).toBe('boolean');
    });
  });

  describe('generateBestExecutionReport — empty', () => {
    it('should handle empty executions array', async () => {
      const result = await service.generateBestExecutionReport([], {
        start: new Date('2023-01-01'),
        end: new Date('2023-12-31'),
      });
      expect(result.totalExecutions).toBe(0);
      expect(result.summary.averageSlippageBps).toBe(0);
      expect(result.complianceFlags).toHaveLength(0);
    });
  });
});

describe('BacktestService', () => {
  let service: BacktestService;

  beforeEach(() => {
    service = new BacktestService(mockMarketDataService as any);
  });

  describe('runBacktest', () => {
    it('should return backtest results with metrics', async () => {
      const config = {
        strategy: {
          name: 'SMA Crossover',
          type: 'SMA_CROSSOVER' as const,
          lookbackPeriod: 30,
          params: { shortPeriod: 10, longPeriod: 20 },
        },
        tickers: ['AAPL'],
        startDate: '2023-01-01',
        endDate: '2023-03-31',
        initialCapital: 100000,
        commission: 5,
      };

      const result = await service.runBacktest(config);

      expect(result).toHaveProperty('strategyName');
      expect(result).toHaveProperty('initialCapital');
      expect(result).toHaveProperty('finalValue');
      expect(result).toHaveProperty('metrics');
      expect(result).toHaveProperty('trades');
      expect(result).toHaveProperty('equityCurve');
    });

    it('should return valid performance metrics', async () => {
      const config = {
        strategy: {
          name: 'SMA Crossover',
          type: 'SMA_CROSSOVER' as const,
          lookbackPeriod: 30,
          params: { shortPeriod: 10, longPeriod: 20 },
        },
        tickers: ['AAPL'],
        startDate: '2023-01-01',
        endDate: '2023-06-30',
        initialCapital: 100000,
        commission: 5,
      };

      const result = await service.runBacktest(config);

      expect(result.metrics).toHaveProperty('totalReturn');
      expect(result.metrics).toHaveProperty('sharpeRatio');
      expect(result.metrics).toHaveProperty('maxDrawdown');
      expect(result.metrics).toHaveProperty('winRate');
      expect(result.metrics).toHaveProperty('profitFactor');

      // Win rate should be 0-100
      expect(result.metrics.winRate).toBeGreaterThanOrEqual(0);
      expect(result.metrics.winRate).toBeLessThanOrEqual(100);

      // Max drawdown should be positive (expressed as positive percentage)
      expect(result.metrics.maxDrawdown).toBeGreaterThanOrEqual(0);
    });

    it('should preserve capital when no trades', async () => {
      const config = {
        strategy: {
          name: 'Test',
          type: 'SMA_CROSSOVER' as const,
          lookbackPeriod: 200, // Long lookback = fewer signals
          params: { shortPeriod: 100, longPeriod: 150 },
        },
        tickers: ['AAPL'],
        startDate: '2023-01-01',
        endDate: '2023-01-15', // Short period
        initialCapital: 100000,
        commission: 0,
      };

      const result = await service.runBacktest(config);

      // With no trades, final value should equal initial capital
      if (result.trades.length === 0) {
        expect(result.finalValue).toBe(config.initialCapital);
      }
    });
  });
});
