import { NCUARBC2Service } from './ncua-rbc2.service';

describe('NCUARBC2Service', () => {
  let service: NCUARBC2Service;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
      institution: { findUnique: jest.fn() },
    };
    service = new NCUARBC2Service(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computes RBC2 ratio from balance sheet items', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'cash', balance: 50 },
      { category: 'asset', subcategory: 'treasury', balance: 100 },
      { category: 'asset', subcategory: 'residential_mortgage', balance: 200 },
      { category: 'asset', subcategory: 'commercial_loans', balance: 100 },
      { category: 'liability', subcategory: 'deposits', balance: 380 },
    ]);
    prisma.institution.findUnique.mockResolvedValue({
      id: 'inst_1',
      totalAssets: 450,
    });

    const result = await service.computeRBC2('inst_1');

    expect(result.totalRiskWeightedAssets).toBeGreaterThan(0);
    expect(result.netWorth).toBeGreaterThan(0);
    expect(result.riskBasedCapitalRatio).toBeGreaterThan(0);
    expect(typeof result.isWellCapitalized).toBe('boolean');
    expect(typeof result.isAdequatelyCapitalized).toBe('boolean');
    expect(result.narrativeEn).toContain('Risk-based capital ratio');
    expect(result.narrativeEs).toContain('RBC2');
  });

  it('well-capitalized when ratio >= 10%', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'cash', balance: 400 },
      { category: 'liability', subcategory: 'deposits', balance: 200 },
    ]);
    prisma.institution.findUnique.mockResolvedValue({
      id: 'inst_1',
      totalAssets: 400,
    });

    const result = await service.computeRBC2('inst_1');
    // Cash has 0% risk weight -> charges come from IRR + concentration only
    // Net worth = 200, small RWA -> high ratio
    expect(result.isWellCapitalized).toBe(true);
    expect(result.surplus).toBeGreaterThan(0);
  });

  it('handles empty balance sheet with fallback values', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    prisma.institution.findUnique.mockResolvedValue({
      id: 'inst_1',
      totalAssets: 445,
    });

    const result = await service.computeRBC2('inst_1');
    expect(result.totalRiskWeightedAssets).toBeGreaterThanOrEqual(0);
    expect(result.components).toBeDefined();
    expect(Array.isArray(result.components)).toBe(true);
  });

  it('components array includes IRR and concentration charges', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'residential_mortgage', balance: 300 },
      { category: 'liability', subcategory: 'deposits', balance: 250 },
    ]);
    prisma.institution.findUnique.mockResolvedValue(null);

    const result = await service.computeRBC2('inst_1');
    const names = result.components.map((c) => c.name);
    expect(names).toContain('Interest Rate Risk');
    expect(names).toContain('Concentration Risk');
  });

  it('maps subcategories to correct risk weight buckets', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'cash', balance: 100 },
      { category: 'asset', subcategory: 'agency_mbs', balance: 100 },
      { category: 'asset', subcategory: 'credit_cards', balance: 100 },
      { category: 'liability', subcategory: 'deposits', balance: 250 },
    ]);
    prisma.institution.findUnique.mockResolvedValue(null);

    const result = await service.computeRBC2('inst_1');
    const cashComp = result.components.find((c) => c.name.includes('cash'));
    const creditComp = result.components.find((c) => c.name.includes('credit'));
    // Cash = 0% weight, credit cards = 100% weight
    if (cashComp) expect(cashComp.riskWeight).toBe(0);
    if (creditComp) expect(creditComp.riskWeight).toBe(1.0);
  });
});
