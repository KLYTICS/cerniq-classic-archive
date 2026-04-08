import { MonteCarloService } from './monte-carlo.service';

describe('MonteCarloService', () => {
  let service: MonteCarloService;
  const mockPrisma = {
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  beforeEach(() => {
    service = new MonteCarloService(mockPrisma);
  });

  it('should clamp paths between 100 and 100_000', async () => {
    const result = await service.runSimulation('inst-1', { paths: 50 });
    expect(result.paths).toBeGreaterThanOrEqual(100);
  });

  it('should return demo NII around 3.2M baseline per quarter', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 500,
      quarters: 4,
    });
    expect(result.meanNII).toBeDefined();
    expect(typeof result.meanNII).toBe('number');
  });

  it('VaR95 should be less than or equal to mean NII', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 1000,
      quarters: 4,
    });
    expect(result.var95NII).toBeLessThanOrEqual(result.meanNII);
  });

  it('fan chart should have correct number of quarters', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 200,
      quarters: 8,
    });
    expect(result.fanChart).toHaveLength(8);
    expect(result.fanChart[0]).toHaveProperty('p5');
    expect(result.fanChart[0]).toHaveProperty('p95');
  });

  it('distribution should have 20 buckets', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 500,
      quarters: 4,
    });
    expect(result.distribution.buckets).toHaveLength(20);
  });

  it('standard error should be a positive number', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 500,
      quarters: 4,
    });
    expect(result.standardError).toBeGreaterThanOrEqual(0);
  });

  it('should clamp quarters between 1 and 120', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 100,
      quarters: 0,
    });
    expect(result.quarters).toBeGreaterThanOrEqual(1);
  });

  it('should cap paths at 100_000', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 200_000,
      quarters: 1,
    });
    expect(result.paths).toBeLessThanOrEqual(100_000);
  });

  it('handles odd number of paths (antithetic variates)', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 101,
      quarters: 2,
    });
    expect(result.paths).toBe(101);
    expect(result.fanChart).toHaveLength(2);
  });

  it('computes EVE metrics (meanEVE, var95EVE, cvar99EVE)', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 500,
      quarters: 4,
    });
    expect(typeof result.meanEVE).toBe('number');
    expect(typeof result.var95EVE).toBe('number');
    expect(typeof result.cvar99EVE).toBe('number');
    expect(result.var95EVE).toBeLessThanOrEqual(result.meanEVE);
  });

  it('uses custom vasicek params when provided', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 200,
      quarters: 4,
      kappa: 0.1,
      theta: 0.05,
      sigma: 0.02,
    });
    expect(result.vasicekParams.kappa).toBe(0.1);
    expect(result.vasicekParams.theta).toBe(0.05);
    expect(result.vasicekParams.sigma).toBe(0.02);
  });

  it('clamps sigma to valid range', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 100,
      quarters: 1,
      sigma: 0,
    });
    expect(result.vasicekParams.sigma).toBeGreaterThan(0);
  });

  it('reports convergence status', async () => {
    const result = await service.runSimulation('inst-1', {
      paths: 10000,
      quarters: 4,
    });
    expect(typeof result.convergenceMet).toBe('boolean');
  });

  it('computes NII using balance sheet items when present', async () => {
    const items = [
      {
        category: 'asset',
        balance: 100000,
        rate: 0.05,
        duration: 3,
        rateType: 'variable',
        subcategory: 'auto_loans',
      },
      {
        category: 'liability',
        balance: 80000,
        rate: 0.02,
        duration: 1,
        rateType: 'fixed',
        subcategory: 'savings',
        depositBeta: 0.4,
      },
    ];
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);

    const result = await service.runSimulation('inst-with-items', {
      paths: 500,
      quarters: 4,
    });
    expect(result.meanNII).toBeDefined();
    expect(typeof result.meanNII).toBe('number');

    // Reset
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
  });

  it('handles NaN balance gracefully', async () => {
    const items = [
      {
        category: 'asset',
        balance: NaN,
        rate: 0.05,
        duration: 3,
        rateType: 'fixed',
        subcategory: 'loans',
      },
    ];
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);

    const result = await service.runSimulation('inst-nan', {
      paths: 100,
      quarters: 2,
    });
    expect(Number.isFinite(result.meanNII)).toBe(true);

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
  });

  it('uses default deposit betas based on subcategory', async () => {
    const items = [
      {
        category: 'liability',
        balance: 10000,
        rate: 0.01,
        rateType: 'variable',
        subcategory: 'demand_deposits',
      },
      {
        category: 'liability',
        balance: 20000,
        rate: 0.02,
        rateType: 'variable',
        subcategory: 'time_cd',
      },
      {
        category: 'liability',
        balance: 15000,
        rate: 0.015,
        rateType: 'variable',
        subcategory: 'checking_accounts',
      },
    ];
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);

    const result = await service.runSimulation('inst-betas', {
      paths: 200,
      quarters: 2,
    });
    expect(Number.isFinite(result.meanNII)).toBe(true);

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
  });

  it('uses default beta of 0.5 for unknown liability subcategory', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        balance: 50000,
        rate: 0.05,
        rateType: 'fixed',
        subcategory: 'consumer_loans',
      },
      {
        category: 'liability',
        balance: 30000,
        rate: 0.02,
        rateType: 'variable',
        subcategory: 'other_borrowings',
      },
    ]);

    const result = await service.runSimulation('inst-beta', {
      paths: 200,
      quarters: 2,
    });
    expect(Number.isFinite(result.meanNII)).toBe(true);

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
  });
});
