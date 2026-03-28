import { ConcentrationService } from './concentration.service';

describe('ConcentrationService', () => {
  let service: ConcentrationService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
      concentrationLimit: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 3 }),
      },
    };
    service = new ConcentrationService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -- Demo fallback when no assets exist -------------------------

  it('returns demo analysis when total assets are zero', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.concentrationLimit.findMany.mockResolvedValue([]);

    const result = await service.getConcentrationAnalysis('inst_123');

    expect(result.exposures).toHaveLength(6);
    expect(result.hhi).toBe(1850);
    expect(result.hhiInterpretation).toBe('Moderate concentration');
    expect(result.diversificationScore).toBe(82);
    expect(result.breachCount).toBe(0);
    expect(result.warningCount).toBe(2);
    expect(result.totalAssets).toBe(445);
  });

  // -- HHI computation for equal sectors --------------------------

  it('computes low HHI for evenly distributed sectors', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'Consumer Loans', balance: 100 },
      { category: 'asset', subcategory: 'Auto Loans', balance: 100 },
      { category: 'asset', subcategory: 'Commercial RE', balance: 100 },
      { category: 'asset', subcategory: 'Residential Mortgage', balance: 100 },
    ]);
    prisma.concentrationLimit.findMany.mockResolvedValue([]);

    const result = await service.getConcentrationAnalysis('inst_123');

    // 4 equal sectors: each 25%, HHI = 4 * 25^2 = 2500
    expect(result.hhi).toBeCloseTo(2500, 0);
    expect(result.hhiInterpretation).toBe('Highly concentrated');
    expect(result.totalAssets).toBeCloseTo(400, 0);
  });

  // -- Well-diversified HHI interpretation ------------------------

  it('returns well-diversified interpretation for many small sectors', async () => {
    // 10 sectors each with balance 100 => each 10%, HHI = 10 * 10^2 = 1000
    const items = Array.from({ length: 10 }, (_, i) => ({
      category: 'asset',
      subcategory: `Sector ${i}`,
      balance: 100,
    }));
    prisma.balanceSheetItem.findMany.mockResolvedValue(items);
    prisma.concentrationLimit.findMany.mockResolvedValue([]);

    const result = await service.getConcentrationAnalysis('inst_123');

    expect(result.hhi).toBeCloseTo(1000, 0);
    expect(result.hhiInterpretation).toBe('Well diversified');
    expect(result.diversificationScore).toBe(90);
  });

  // -- Breach detection with default limits -----------------------

  it('flags a breach when sector exceeds its default limit', async () => {
    // Commercial RE limit is 30%; giving it 80 out of 100 = 80%
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'commercial re', balance: 80 },
      { category: 'asset', subcategory: 'Consumer Loans', balance: 20 },
    ]);
    prisma.concentrationLimit.findMany.mockResolvedValue([]);

    const result = await service.getConcentrationAnalysis('inst_123');

    expect(result.breachCount).toBeGreaterThanOrEqual(1);
    const cre = result.exposures.find((e) => e.limitName === 'Commercial RE');
    expect(cre).toBeDefined();
    expect(cre!.status).toBe('breach');
    expect(cre!.currentPct).toBeCloseTo(0.8, 2);
  });

  // -- Warning status at >80% utilization -------------------------

  it('assigns warning status when utilization exceeds 80 percent', async () => {
    // Auto Loans limit = 15%; give it 13% => util = 13/15 = 86.7%
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'Auto Loans', balance: 13 },
      { category: 'asset', subcategory: 'Consumer Loans', balance: 87 },
    ]);
    prisma.concentrationLimit.findMany.mockResolvedValue([]);

    const result = await service.getConcentrationAnalysis('inst_123');

    const auto = result.exposures.find((e) => e.limitName === 'Auto Loans');
    expect(auto).toBeDefined();
    expect(auto!.status).toBe('warning');
    expect(auto!.utilizationPct).toBeGreaterThan(80);
  });

  // -- Custom limits override defaults ----------------------------

  it('uses custom concentration limits when provided', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'Tech Loans', balance: 60 },
      { category: 'asset', subcategory: 'Pharma Loans', balance: 40 },
    ]);
    prisma.concentrationLimit.findMany.mockResolvedValue([
      { limitName: 'Tech Loans', limitType: 'sector', maxPct: 0.5 },
      { limitName: 'Pharma Loans', limitType: 'sector', maxPct: 0.3 },
    ]);

    const result = await service.getConcentrationAnalysis('inst_123');

    expect(result.exposures).toHaveLength(2);
    const tech = result.exposures.find((e) => e.limitName === 'Tech Loans');
    expect(tech).toBeDefined();
    expect(tech!.currentPct).toBeCloseTo(0.6, 2);
    expect(tech!.status).toBe('breach'); // 60% > 50%
  });

  // -- saveConcentrationLimits persists correctly -----------------

  it('deletes existing limits and creates new ones on save', async () => {
    const limits = [
      { limitType: 'sector', limitName: 'CRE', maxPct: 0.3 },
      { limitType: 'sector', limitName: 'Consumer', maxPct: 0.25 },
    ];

    await service.saveConcentrationLimits('inst_123', limits);

    expect(prisma.concentrationLimit.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst_123' },
    });
    expect(prisma.concentrationLimit.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          institutionId: 'inst_123',
          limitName: 'CRE',
          maxPct: 0.3,
          status: 'compliant',
        }),
      ]),
    });
  });

  // -- Exposures sorted by utilization descending -----------------

  it('sorts exposures by utilization percentage in descending order', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'Consumer Loans', balance: 20 },
      { category: 'asset', subcategory: 'Auto Loans', balance: 14 },
      { category: 'asset', subcategory: 'Commercial RE', balance: 5 },
      { category: 'asset', subcategory: 'Residential Mortgage', balance: 61 },
    ]);
    prisma.concentrationLimit.findMany.mockResolvedValue([]);

    const result = await service.getConcentrationAnalysis('inst_123');

    for (let i = 1; i < result.exposures.length; i++) {
      expect(result.exposures[i - 1].utilizationPct).toBeGreaterThanOrEqual(
        result.exposures[i].utilizationPct,
      );
    }
  });
});
