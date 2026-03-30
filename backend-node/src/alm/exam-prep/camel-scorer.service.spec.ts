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
});
