import { DailyPipelineService } from './daily-pipeline.service';

describe('DailyPipelineService', () => {
  let service: DailyPipelineService;
  const mockPrisma = {
    pipelineRun: {
      create: jest.fn(),
      update: jest.fn(),
      findFirst: jest.fn(),
    },
    position: {
      findMany: jest.fn(),
    },
    marketPrice: {
      upsert: jest.fn(),
    },
    portfolio: {
      findMany: jest.fn(),
    },
  } as any;
  const mockMarketData = {
    getQuote: jest.fn(),
  } as any;
  const mockCache = {
    set: jest.fn(),
  } as any;
  const mockRisk = {
    calculateCorrelationMatrix: jest.fn(),
    calculateVaR: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new DailyPipelineService(
      mockPrisma,
      mockMarketData,
      mockCache,
      mockRisk,
    );
    mockPrisma.pipelineRun.create.mockResolvedValue({ id: 'run-1' });
    mockPrisma.pipelineRun.update.mockResolvedValue({});
    mockPrisma.portfolio.findMany.mockResolvedValue([]);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('runPipeline returns SUCCESS with no active tickers', async () => {
    mockPrisma.position.findMany.mockResolvedValue([]);
    const result = await service.runPipeline();
    expect(result.status).toBe('SUCCESS');
    expect(result.tickersProcessed).toBe(0);
    expect(result.errors).toHaveLength(0);
  });

  it('runPipeline processes tickers and upserts prices', async () => {
    mockPrisma.position.findMany.mockResolvedValue([
      { ticker: 'AAPL' },
      { ticker: 'MSFT' },
    ]);
    mockMarketData.getQuote.mockResolvedValue({
      price: 150,
      change: 1.5,
      changePercent: 1.0,
    });
    mockPrisma.marketPrice.upsert.mockResolvedValue({});
    const result = await service.runPipeline();
    expect(result.status).toBe('SUCCESS');
    expect(result.tickersProcessed).toBe(2);
    expect(mockMarketData.getQuote).toHaveBeenCalledTimes(2);
  });

  it('runPipeline skips when already running', async () => {
    // Start first run but don't await
    mockPrisma.position.findMany.mockImplementation(
      () => new Promise((resolve) => setTimeout(() => resolve([]), 100)),
    );
    const p1 = service.runPipeline();
    const p2 = await service.runPipeline();
    expect(p2.status).toBe('SKIPPED');
    await p1;
  });

  it('getLastSuccessfulRun queries prisma', async () => {
    mockPrisma.pipelineRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: 'SUCCESS',
    });
    const result = await service.getLastSuccessfulRun();
    expect(result.status).toBe('SUCCESS');
  });

  it('getTrackedTickerCount returns distinct ticker count', async () => {
    mockPrisma.position.findMany.mockResolvedValue([
      { ticker: 'AAPL' },
      { ticker: 'GOOG' },
      { ticker: 'TSLA' },
    ]);
    const count = await service.getTrackedTickerCount();
    expect(count).toBe(3);
  });

  // ── Error handling in individual steps ────────────────────────
  describe('error handling in pipeline steps', () => {
    it('records fetch errors but continues processing', async () => {
      mockPrisma.position.findMany.mockResolvedValue([
        { ticker: 'AAPL' },
        { ticker: 'FAIL' },
        { ticker: 'MSFT' },
      ]);
      mockMarketData.getQuote
        .mockResolvedValueOnce({ price: 150, change: 1, changePercent: 0.5 })
        .mockRejectedValueOnce(new Error('Ticker not found'))
        .mockResolvedValueOnce({ price: 300, change: 2, changePercent: 0.7 });
      mockPrisma.marketPrice.upsert.mockResolvedValue({});

      const result = await service.runPipeline();
      expect(result.status).toBe('SUCCESS');
      expect(result.tickersProcessed).toBe(2); // 2 succeeded, 1 failed
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Fetch FAIL');
    });

    it('records upsert errors for individual tickers', async () => {
      mockPrisma.position.findMany.mockResolvedValue([
        { ticker: 'AAPL' },
      ]);
      mockMarketData.getQuote.mockResolvedValue({
        price: 150,
        change: 1,
        changePercent: 0.5,
      });
      mockPrisma.marketPrice.upsert.mockRejectedValue(new Error('DB constraint'));

      const result = await service.runPipeline();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Upsert AAPL');
    });

    it('returns FAILED status when fatal error occurs', async () => {
      mockPrisma.position.findMany.mockRejectedValue(new Error('DB connection lost'));

      const result = await service.runPipeline();
      expect(result.status).toBe('FAILED');
      expect(result.errors).toHaveLength(1);
      expect(result.errors[0]).toContain('Fatal');
    });
  });

  // ── handleScheduledRun ────────────────────────────────────────
  describe('handleScheduledRun', () => {
    it('calls runPipeline internally', async () => {
      mockPrisma.position.findMany.mockResolvedValue([]);
      await service.handleScheduledRun();
      // Verify pipeline was invoked by checking pipelineRun.create was called
      expect(mockPrisma.pipelineRun.create).toHaveBeenCalled();
    });
  });

  // ── recomputePortfolioRisk ────────────────────────────────────
  describe('portfolio risk recomputation', () => {
    it('caches correlation and VaR for each portfolio', async () => {
      mockPrisma.position.findMany.mockResolvedValue([{ ticker: 'AAPL' }]);
      mockMarketData.getQuote.mockResolvedValue({
        price: 150,
        change: 1,
        changePercent: 0.5,
      });
      mockPrisma.marketPrice.upsert.mockResolvedValue({});
      mockPrisma.portfolio.findMany.mockResolvedValue([
        {
          id: 'port-1',
          positions: [
            { ticker: 'AAPL', quantity: 100, avgCost: 150 },
          ],
        },
      ]);
      mockRisk.calculateCorrelationMatrix.mockResolvedValue({ matrix: [] });
      mockRisk.calculateVaR.mockResolvedValue({ var95: -5000 });

      const result = await service.runPipeline();
      expect(mockCache.set).toHaveBeenCalledTimes(2); // correlation + VaR
      expect(result.status).toBe('SUCCESS');
    });

    it('skips portfolios with no positions', async () => {
      mockPrisma.position.findMany.mockResolvedValue([{ ticker: 'AAPL' }]);
      mockMarketData.getQuote.mockResolvedValue({
        price: 150,
        change: 1,
        changePercent: 0.5,
      });
      mockPrisma.marketPrice.upsert.mockResolvedValue({});
      mockPrisma.portfolio.findMany.mockResolvedValue([
        { id: 'port-empty', positions: [] },
      ]);

      const result = await service.runPipeline();
      expect(mockRisk.calculateCorrelationMatrix).not.toHaveBeenCalled();
      expect(result.status).toBe('SUCCESS');
    });

    it('records risk computation errors without failing pipeline', async () => {
      mockPrisma.position.findMany.mockResolvedValue([{ ticker: 'AAPL' }]);
      mockMarketData.getQuote.mockResolvedValue({
        price: 150,
        change: 1,
        changePercent: 0.5,
      });
      mockPrisma.marketPrice.upsert.mockResolvedValue({});
      mockPrisma.portfolio.findMany.mockResolvedValue([
        {
          id: 'port-1',
          positions: [{ ticker: 'AAPL', quantity: 100, avgCost: 150 }],
        },
      ]);
      mockRisk.calculateCorrelationMatrix.mockRejectedValue(new Error('Corr failed'));

      const result = await service.runPipeline();
      expect(result.errors.length).toBeGreaterThan(0);
      expect(result.errors[0]).toContain('Risk port-1');
    });

    it('skips VaR cache when totalValue is 0', async () => {
      mockPrisma.position.findMany.mockResolvedValue([{ ticker: 'AAPL' }]);
      mockMarketData.getQuote.mockResolvedValue({
        price: 150,
        change: 1,
        changePercent: 0.5,
      });
      mockPrisma.marketPrice.upsert.mockResolvedValue({});
      mockPrisma.portfolio.findMany.mockResolvedValue([
        {
          id: 'port-1',
          positions: [{ ticker: 'AAPL', quantity: 0, avgCost: 0 }],
        },
      ]);
      mockRisk.calculateCorrelationMatrix.mockResolvedValue({ matrix: [] });

      await service.runPipeline();
      expect(mockRisk.calculateVaR).not.toHaveBeenCalled();
    });
  });

  // ── durationMs tracking ────────────────────────────────────────
  it('durationMs is a positive number', async () => {
    mockPrisma.position.findMany.mockResolvedValue([]);
    const result = await service.runPipeline();
    expect(result.durationMs).toBeGreaterThanOrEqual(0);
  });

  // ── batching (> BATCH_SIZE tickers) ─────────────────────────
  describe('batching', () => {
    it('processes tickers in batches of 10', async () => {
      const tickers = Array.from({ length: 25 }, (_, i) => ({
        ticker: `T${i}`,
      }));
      mockPrisma.position.findMany.mockResolvedValue(tickers);
      mockMarketData.getQuote.mockResolvedValue({
        price: 100,
        change: 0,
        changePercent: 0,
      });
      mockPrisma.marketPrice.upsert.mockResolvedValue({});

      const result = await service.runPipeline();
      expect(result.tickersProcessed).toBe(25);
      expect(mockMarketData.getQuote).toHaveBeenCalledTimes(25);
    });
  });

  // ── isRunning guard reset after failure ────────────────────
  it('resets isRunning flag after fatal failure', async () => {
    mockPrisma.position.findMany.mockRejectedValue(new Error('crash'));
    await service.runPipeline();

    // Second call should not be SKIPPED (isRunning should be reset)
    mockPrisma.position.findMany.mockResolvedValue([]);
    const result = await service.runPipeline();
    expect(result.status).toBe('SUCCESS');
  });
});
