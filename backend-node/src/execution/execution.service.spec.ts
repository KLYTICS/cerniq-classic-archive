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

  // ── Quality branches: GOOD ────────────────────────────────
  it('rates GOOD when BUY slippage is within half spread', async () => {
    // mock: bid=149.85, ask=150.15, mid=150, spread=0.3, spreadBps=20
    // halfSpread = 10bps → need 0 < effectiveSlippage < 10bps
    // execPrice = 150.075 → slippage = (150.075-150)/150*10000 = 5bps
    mockMarketDataService.getQuote.mockResolvedValueOnce({
      price: 150, bid: 149.85, ask: 150.15,
    });
    const result = await service.calculateSlippage({
      ticker: 'TEST', executionPrice: 150.075,
      executionTime: new Date(), side: 'BUY', quantity: 100,
    });
    expect(result.quality).toBe('GOOD');
  });

  // ── Quality branches: FAIR ────────────────────────────────
  it('rates FAIR when BUY slippage is within full spread', async () => {
    // spreadBps=20, halfSpread=10bps → need 10 <= effectiveSlippage < 20bps
    // execPrice = 150.22 → slippage = (150.22-150)/150*10000 ≈ 14.67bps
    mockMarketDataService.getQuote.mockResolvedValueOnce({
      price: 150, bid: 149.85, ask: 150.15,
    });
    const result = await service.calculateSlippage({
      ticker: 'TEST', executionPrice: 150.22,
      executionTime: new Date(), side: 'BUY', quantity: 100,
    });
    expect(result.quality).toBe('FAIR');
  });

  // ── Compliance flags ──────────────────────────────────────
  it('flags high slippage (>50bps) in compliance report', async () => {
    mockMarketDataService.getQuote.mockResolvedValue({
      price: 100, bid: 99.95, ask: 100.05,
    });
    const executions = [{
      ticker: 'BIG', executionPrice: 101.5,
      executionTime: new Date(), side: 'BUY' as const, quantity: 100,
    }];
    const result = await service.generateBestExecutionReport(executions, {
      start: new Date('2025-01-01'), end: new Date('2025-01-31'),
    });
    expect(result.complianceFlags.some((f) => f.includes('HIGH_SLIPPAGE'))).toBe(true);
  });

  it('flags large order poor fill in compliance report', async () => {
    mockMarketDataService.getQuote.mockResolvedValue({
      price: 100, bid: 99.95, ask: 100.05,
    });
    const executions = [{
      ticker: 'BIG', executionPrice: 101.5,
      executionTime: new Date(), side: 'BUY' as const, quantity: 15000,
    }];
    const result = await service.generateBestExecutionReport(executions, {
      start: new Date('2025-01-01'), end: new Date('2025-01-31'),
    });
    expect(result.complianceFlags.some((f) => f.includes('LARGE_ORDER_POOR_FILL'))).toBe(true);
  });

  it('handles empty executions in best execution report', async () => {
    const result = await service.generateBestExecutionReport([], {
      start: new Date('2025-01-01'), end: new Date('2025-01-31'),
    });
    expect(result.totalExecutions).toBe(0);
    expect(result.summary.averageSlippageBps).toBe(0);
  });

  it('counts all quality buckets in report (EXCELLENT + GOOD + FAIR + POOR)', async () => {
    // Set up 4 executions that hit each quality branch
    mockMarketDataService.getQuote
      .mockResolvedValueOnce({ price: 100, bid: 99.85, ask: 100.15 }) // EXCELLENT: buy below mid
      .mockResolvedValueOnce({ price: 100, bid: 99.85, ask: 100.15 }) // GOOD: within half spread
      .mockResolvedValueOnce({ price: 100, bid: 99.85, ask: 100.15 }) // FAIR: within full spread
      .mockResolvedValueOnce({ price: 100, bid: 99.85, ask: 100.15 }); // POOR: beyond spread
    const executions = [
      { ticker: 'A', executionPrice: 99.90, executionTime: new Date(), side: 'BUY' as const, quantity: 10 }, // below mid → EXCELLENT
      { ticker: 'B', executionPrice: 100.05, executionTime: new Date(), side: 'BUY' as const, quantity: 10 }, // ~5bps < 15bps half → GOOD
      { ticker: 'C', executionPrice: 100.20, executionTime: new Date(), side: 'BUY' as const, quantity: 10 }, // ~20bps between half(15) and full(30) → FAIR
      { ticker: 'D', executionPrice: 101.00, executionTime: new Date(), side: 'BUY' as const, quantity: 10 }, // ~100bps >> 30bps → POOR
    ];
    const result = await service.generateBestExecutionReport(executions, {
      start: new Date('2025-01-01'), end: new Date('2025-01-31'),
    });
    expect(result.summary.qualityBreakdown.excellent).toBeGreaterThanOrEqual(1);
    expect(result.summary.qualityBreakdown.good).toBeGreaterThanOrEqual(1);
    expect(result.summary.qualityBreakdown.fair).toBeGreaterThanOrEqual(1);
    expect(result.summary.qualityBreakdown.poor).toBeGreaterThanOrEqual(1);
    expect(result.totalExecutions).toBe(4);
  });
});
