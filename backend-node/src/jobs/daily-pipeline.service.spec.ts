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
});
