import { ForwardSimulationService } from './forward-simulation.service';

describe('ForwardSimulationService', () => {
  let service: ForwardSimulationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
    };
    service = new ForwardSimulationService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -- Demo fallback when no balance sheet items ------------------

  it('returns demo result when no balance sheet items exist', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
    });

    expect(result.config.horizon).toBe(3);
    expect(result.config.ratePaths).toEqual(['base', 'up200', 'down100']);
    // 3 paths * 12 quarters = 36
    expect(result.quarters).toHaveLength(36);
    expect(result.summary.baseNIIYear1).toBeGreaterThan(0);
    expect(result.summary.baseNIIYear3).toBeGreaterThan(0);
  });

  // -- Custom horizon produces correct quarter count --------------

  it('produces correct number of quarters for a 2-year horizon', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
      horizon: 2,
    });

    expect(result.config.horizon).toBe(2);
    // 3 default paths * 8 quarters = 24
    expect(result.quarters).toHaveLength(24);
  });

  // -- Rate paths filter correctly --------------------------------

  it('limits simulation to specified rate paths only', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
      ratePaths: ['base'],
    });

    expect(result.config.ratePaths).toEqual(['base']);
    // 1 path * 12 quarters = 12
    expect(result.quarters).toHaveLength(12);
    expect(result.quarters.every((q) => q.ratePath === 'base')).toBe(true);
  });

  // -- Real items produce forward projections ---------------------

  it('projects NII from real balance sheet items across rate paths', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'consumer_loans',
        name: 'Consumer Portfolio',
        balance: 200,
        rate: 0.06,
        duration: 3,
        rateType: 'variable',
        depositBeta: null,
      },
      {
        category: 'liability',
        subcategory: 'savings',
        name: 'Savings Deposits',
        balance: 150,
        rate: 0.02,
        duration: 1,
        rateType: 'variable',
        depositBeta: 0.4,
      },
    ]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
      ratePaths: ['base', 'up200'],
    });

    // 2 paths * 12 quarters = 24
    expect(result.quarters).toHaveLength(24);

    // Each quarter should have positive NII (asset yield > liability cost)
    const baseQuarters = result.quarters.filter((q) => q.ratePath === 'base');
    expect(baseQuarters).toHaveLength(12);
    for (const q of baseQuarters) {
      expect(q.projectedNII).toBeGreaterThan(0);
      expect(q.totalAssets).toBeGreaterThan(0);
      expect(q.totalLiabilities).toBeGreaterThan(0);
    }
  });

  // -- Up200 shock increases NII for asset-sensitive balance sheet --

  it('shows higher cumulative NII under up200 shock for asset-sensitive institution', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'consumer_loans',
        name: 'Variable Loans',
        balance: 300,
        rate: 0.07,
        duration: 5,
        rateType: 'variable',
        depositBeta: null,
      },
      {
        category: 'liability',
        subcategory: 'demand_deposits',
        name: 'Demand Deposits',
        balance: 250,
        rate: 0.005,
        duration: 0.5,
        rateType: 'variable',
        depositBeta: 0.1,
      },
    ]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
      ratePaths: ['base', 'up200'],
    });

    const baseTotalNII = result.quarters
      .filter((q) => q.ratePath === 'base')
      .reduce((s, q) => s + q.projectedNII, 0);
    const up200TotalNII = result.quarters
      .filter((q) => q.ratePath === 'up200')
      .reduce((s, q) => s + q.projectedNII, 0);

    // Asset beta=1.0 vs liability beta=0.1 => up200 helps NII
    expect(up200TotalNII).toBeGreaterThan(baseTotalNII);
  });

  // -- NWR (Net Worth Ratio) stays positive -----------------------

  it('maintains positive net worth ratio throughout projection', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'residential_mortgage',
        name: 'Mortgages',
        balance: 400,
        rate: 0.055,
        duration: 10,
        rateType: 'fixed',
        depositBeta: null,
      },
      {
        category: 'liability',
        subcategory: 'time_deposits',
        name: 'CDs',
        balance: 350,
        rate: 0.03,
        duration: 2,
        rateType: 'fixed',
        depositBeta: 0.8,
      },
    ]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
      ratePaths: ['base'],
    });

    for (const q of result.quarters) {
      expect(q.projectedNWR).toBeGreaterThan(0);
    }
  });

  // -- Summary aggregates year 1 and year 3 NII correctly ---------

  it('aggregates summary NII correctly for year 1 and year 3', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.runForwardSimulation({
      institutionId: 'inst_123',
      ratePaths: ['base'],
    });

    const baseQuarters = result.quarters.filter((q) => q.ratePath === 'base');
    const year1NII = baseQuarters.slice(0, 4).reduce((s, q) => s + q.projectedNII, 0);
    const year3NII = baseQuarters.reduce((s, q) => s + q.projectedNII, 0);

    expect(result.summary.baseNIIYear1).toBeCloseTo(year1NII, 1);
    expect(result.summary.baseNIIYear3).toBeCloseTo(year3NII, 1);
  });
});
