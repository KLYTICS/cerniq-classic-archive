import { StressTestingService } from './stress-testing.service';

describe('StressTestingService', () => {
  let service: StressTestingService;
  const mockPrisma = {
    balanceSheetItem: {
      findMany: jest.fn(),
    },
    institution: {
      findUnique: jest.fn(),
    },
  } as any;
  const mockAlmEnterprise = {
    getALMSummary: jest.fn(),
    getInstitution: jest.fn(),
    getCOSSECCompliance: jest.fn(),
    calculateLCR: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new StressTestingService(mockPrisma, mockAlmEnterprise);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── runMonteCarloSimulation ───────────────────────────────────
  it('returns empty result when no balance sheet items exist', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.runMonteCarloSimulation('inst-1');
    expect(result.paths).toBeGreaterThan(0);
    expect(result.ratePaths).toBeDefined();
    expect(result.niiDistribution).toBeDefined();
  });

  it('runs Monte Carlo with custom params clamped to safe bounds', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', rateType: 'variable', balance: 100, rate: 0.05 },
      { category: 'liability', rateType: 'variable', balance: 80, rate: 0.02 },
      { category: 'asset', rateType: 'fixed', balance: 200, rate: 0.06 },
      { category: 'liability', rateType: 'fixed', balance: 150, rate: 0.03 },
    ]);

    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 200,
      horizon: 6,
      volatility: 100,
    });

    expect(result.paths).toBe(200);
    expect(result.horizon).toBe(6);
    expect(result.ratePaths.length).toBeGreaterThan(0);
    // Rate paths should be capped at 50 for charting
    expect(result.ratePaths.length).toBeLessThanOrEqual(50);

    // NII distribution should have valid percentiles
    expect(result.niiDistribution.p5).toBeLessThanOrEqual(result.niiDistribution.median);
    expect(result.niiDistribution.median).toBeLessThanOrEqual(result.niiDistribution.p95);
  });

  it('clamps paths to MAX_MC_PATHS (50000)', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 999999,
    });
    expect(result.paths).toBeLessThanOrEqual(50000);
  });

  it('clamps horizon to MAX_MC_HORIZON (120)', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.runMonteCarloSimulation('inst-1', {
      horizon: 999,
    });
    expect(result.horizon).toBeLessThanOrEqual(120);
  });

  it('generates monthly NII bands with correct month count', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', rateType: 'variable', balance: 50, rate: 0.05 },
      { category: 'liability', rateType: 'fixed', balance: 40, rate: 0.03 },
    ]);

    const result = await service.runMonteCarloSimulation('inst-1', {
      paths: 100,
      horizon: 12,
    });

    // MC returns horizon+1 bands (month 0 = baseline through month N)
    expect(result.monthlyNIIBands).toHaveLength(13);
    result.monthlyNIIBands.forEach((band) => {
      expect(band.month).toBeGreaterThanOrEqual(0);
      expect(band.p5).toBeLessThanOrEqual(band.p95);
    });
  });
});
