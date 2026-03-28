import { LiquidityStressPackService } from './liquidity-stress-pack.service';

describe('LiquidityStressPackService', () => {
  let service: LiquidityStressPackService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
      liquidityPosition: { findFirst: jest.fn() },
    };
    service = new LiquidityStressPackService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns 5 COSSEC scenarios in demo mode', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.liquidityPosition.findFirst.mockResolvedValue(null);

    const results = await service.runAllScenarios('inst_1');
    expect(results).toHaveLength(5);
    expect(results[0].scenarioId).toBe('SCEN-1');
    expect(results[4].scenarioId).toBe('SCEN-5');
  });

  it('demo Seasonal Outflow scenario passes', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.liquidityPosition.findFirst.mockResolvedValue(null);

    const results = await service.runAllScenarios('inst_1');
    const seasonal = results.find((r) => r.scenarioId === 'SCEN-3');
    expect(seasonal).toBeDefined();
    expect(seasonal!.regulatoryStatus).toBe('PASS');
  });

  it('computes stress from real balance sheet items', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', balance: 1000 },
      { category: 'liability', balance: 900 },
    ]);
    prisma.liquidityPosition.findFirst.mockResolvedValue({
      hqlaLevel1: 100,
      hqlaLevel2: 50,
    });

    const results = await service.runAllScenarios('inst_1');
    expect(results).toHaveLength(5);
    for (const r of results) {
      expect(r.netOutflow).toBeGreaterThanOrEqual(0);
      expect(r.daysOfLiquidity).toBeGreaterThanOrEqual(0);
      expect(['PASS', 'WATCH', 'FAIL']).toContain(r.regulatoryStatus);
    }
  });

  it('runScenario returns a single scenario result', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.liquidityPosition.findFirst.mockResolvedValue(null);

    const result = await service.runScenario('inst_1', 'SCEN-2');
    expect(result.scenarioId).toBe('SCEN-2');
    expect(result.scenarioName).toContain('Prolonged');
  });

  it('generates bilingual narratives for each scenario', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.liquidityPosition.findFirst.mockResolvedValue(null);

    const results = await service.runAllScenarios('inst_1');
    for (const r of results) {
      expect(r.narrative.length).toBeGreaterThan(10);
      expect(r.narrativeEs.length).toBeGreaterThan(10);
      expect(r.scenarioNameEs.length).toBeGreaterThan(0);
    }
  });
});
