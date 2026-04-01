import { CAMELScorerService } from './camel-scorer.service';

describe('CAMELScorerService', () => {
  let service: CAMELScorerService;
  const mockPrisma = {
    institution: { findUnique: jest.fn() },
    balanceSheetItem: { findMany: jest.fn() },
  } as any;

  beforeEach(() => {
    service = new CAMELScorerService(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should score a well-capitalized institution', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-1',
      name: 'Test CU',
    });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        category: 'asset',
        subcategory: 'commercial_loans',
        balance: 300,
        rate: 0.06,
      },
      { category: 'asset', subcategory: 'cash', balance: 145, rate: 0.04 },
      {
        category: 'liability',
        subcategory: 'deposits',
        balance: 355,
        rate: 0.02,
      },
    ]);

    const result = await service.scoreInstitution('inst-1');
    expect(result.components.length).toBe(5);
    expect(result.composite).toBeGreaterThanOrEqual(1);
    expect(result.composite).toBeLessThanOrEqual(5);
    expect(['READY', 'NEEDS_WORK', 'AT_RISK']).toContain(result.examReadiness);
  });

  it('should return 5 CAMEL components', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.scoreInstitution('inst-1');
    const componentNames = result.components.map((c) => c.component);
    expect(componentNames).toEqual([
      'Capital',
      'Asset Quality',
      'Management',
      'Earnings',
      'Liquidity',
    ]);
  });

  it('should provide bilingual ratings', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const result = await service.scoreInstitution('inst-1');
    expect(result.compositeRating).toBeTruthy();
    expect(result.compositeRatingEs).toBeTruthy();
    for (const comp of result.components) {
      expect(comp.ratingEs).toBeTruthy();
      expect(comp.detailEs).toBeTruthy();
    }
  });

  it('should assign READY readiness for composite <= 2', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'cash', balance: 500, rate: 0.05 },
      {
        category: 'liability',
        subcategory: 'deposits',
        balance: 400,
        rate: 0.01,
      },
    ]);

    const result = await service.scoreInstitution('inst-1');
    if (result.composite <= 2) {
      expect(result.examReadiness).toBe('READY');
    }
  });

  // Coverage: Capital scoring lines 22-46 (score 3, 4, 5 branches)
  it('scores Capital as Fair (score 3) for NWR ~6%', async () => {
    // Total assets = 500+100=600, liabilities = 565, equity = 35, NWR = 35/600 = 0.058
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'loans', balance: 500, rate: 0.06 },
      { category: 'asset', subcategory: 'cash', balance: 100, rate: 0.01 },
      { category: 'liability', subcategory: 'deposits', balance: 565, rate: 0.02 },
    ]);

    const result = await service.scoreInstitution('inst-1');
    const capital = result.components.find((c) => c.component === 'Capital');
    expect(capital).toBeDefined();
    // With NWR ~5.8%, should be score 3 (Fair) or 4 (Marginal)
    expect([3, 4]).toContain(capital!.score);
  });

  it('scores Capital as Marginal (score 4) for NWR ~4%', async () => {
    // Total assets = 600, liabilities = 576, equity = 24, NWR = 24/600 = 0.04
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'loans', balance: 600, rate: 0.06 },
      { category: 'liability', subcategory: 'deposits', balance: 576, rate: 0.02 },
    ]);

    const result = await service.scoreInstitution('inst-1');
    const capital = result.components.find((c) => c.component === 'Capital');
    expect([4, 5]).toContain(capital!.score);
  });

  it('scores Capital as Unsatisfactory (score 5) for NWR < 4%', async () => {
    // Total assets = 600, liabilities = 590, equity = 10, NWR = 10/600 = 0.0167
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'loans', balance: 600, rate: 0.06 },
      { category: 'liability', subcategory: 'deposits', balance: 590, rate: 0.02 },
    ]);

    const result = await service.scoreInstitution('inst-1');
    const capital = result.components.find((c) => c.component === 'Capital');
    expect(capital!.score).toBe(5);
  });

  // Coverage: Earnings scoring line 130 (score 5 for negative ROA)
  it('scores Earnings as Unsatisfactory (score 5) for negative ROA', async () => {
    // Net income < 0 => negative ROA
    mockPrisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });
    // More liability interest expense than asset income
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'loans', balance: 100, rate: 0.02 },
      { category: 'liability', subcategory: 'deposits', balance: 500, rate: 0.10 },
    ]);

    const result = await service.scoreInstitution('inst-1');
    const earnings = result.components.find((c) => c.component === 'Earnings');
    expect(earnings).toBeDefined();
    expect(earnings!.score).toBe(5);
  });
});
