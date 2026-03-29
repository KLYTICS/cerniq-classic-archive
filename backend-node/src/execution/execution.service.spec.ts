import { ExecutionService } from './execution.service';

describe('ExecutionService', () => {
  let service: ExecutionService;
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({
      price: 150,
      bid: 149.85,
      ask: 150.15,
    }),
  };

  beforeEach(() => {
    service = new ExecutionService(mockMarketDataService as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculateSlippage returns slippage analysis with quality rating', async () => {
    const execution = {
      ticker: 'AAPL',
      executionPrice: 150.05,
      executionTime: new Date(),
      side: 'BUY' as const,
      quantity: 100,
    };
    const result = await service.calculateSlippage(execution);
    expect(result.ticker).toBe('AAPL');
    expect(result.executionPrice).toBe(150.05);
    expect(result.side).toBe('BUY');
    expect(result.quantity).toBe(100);
    expect(['EXCELLENT', 'GOOD', 'FAIR', 'POOR']).toContain(result.quality);
    expect(typeof result.slippageBps).toBe('number');
    expect(typeof result.spreadBps).toBe('number');
  });

  it('analyzeVWAP returns VWAP comparison', async () => {
    const execution = {
      ticker: 'AAPL',
      executionPrice: 149.5,
      executionTime: new Date(),
      side: 'BUY' as const,
      quantity: 100,
    };
    const result = await service.analyzeVWAP(execution, 60);
    expect(result.ticker).toBe('AAPL');
    expect(result.periodMinutes).toBe(60);
    expect(typeof result.vwap).toBe('number');
    expect(typeof result.beatsVwap).toBe('boolean');
    expect(result.notional).toBe(149.5 * 100);
  });

  it('generateBestExecutionReport computes quality score', async () => {
    const executions = [
      {
        ticker: 'AAPL',
        executionPrice: 150.0,
        executionTime: new Date(),
        side: 'BUY' as const,
        quantity: 100,
      },
      {
        ticker: 'GOOGL',
        executionPrice: 140.0,
        executionTime: new Date(),
        side: 'SELL' as const,
        quantity: 50,
      },
    ];
    const result = await service.generateBestExecutionReport(executions, {
      start: new Date('2025-01-01'),
      end: new Date('2025-01-31'),
    });
    expect(result.totalExecutions).toBe(2);
    expect(result.summary.qualityScore).toBeGreaterThanOrEqual(0);
    expect(result.summary.qualityScore).toBeLessThanOrEqual(100);
    expect(result.reportId).toContain('BER-');
  });

  it('calculateImplementationShortfall returns delay and trading components', async () => {
    const trade = {
      ticker: 'AAPL',
      decisionPrice: 148.0,
      executions: [
        { price: 149.0, quantity: 50, time: new Date() },
        { price: 149.5, quantity: 50, time: new Date() },
      ],
    };
    const result = await service.calculateImplementationShortfall(trade);
    expect(result.ticker).toBe('AAPL');
    expect(result.decisionPrice).toBe(148.0);
    expect(result.totalQuantity).toBe(100);
    expect(result.shortfall).toHaveProperty('delayComponentBps');
    expect(result.shortfall).toHaveProperty('tradingComponentBps');
    expect(result.shortfall).toHaveProperty('totalBps');
    expect(result.executionCount).toBe(2);
  });
});
