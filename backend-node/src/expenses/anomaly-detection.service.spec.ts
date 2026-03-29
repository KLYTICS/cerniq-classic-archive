import { AnomalyDetectionService } from './anomaly-detection.service';

describe('AnomalyDetectionService', () => {
  let service: AnomalyDetectionService;
  const mockPrisma = {
    expense: {
      findMany: jest.fn(),
      update: jest.fn(),
    },
  } as any;
  const mockAlmEnterprise = {
    calculateLCR: jest.fn(),
  } as any;
  const mockVendorIntelligence = {
    generateVendorReport: jest.fn().mockReturnValue([]),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AnomalyDetectionService(
      mockPrisma,
      mockAlmEnterprise,
      mockVendorIntelligence,
    );
    mockPrisma.expense.update.mockResolvedValue({});
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('analyzeOrganization returns results with empty expenses', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([]);
    const result = await service.analyzeOrganization('org-1');
    expect(result.totalExpenses).toBe(0);
    expect(result.findings).toEqual([]);
    expect(result.healthScore).toBeDefined();
  });

  it('analyzeOrganization detects duplicate invoices', async () => {
    const date = new Date('2026-01-15');
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'Vendor A', amount: 1500, category: 'IT', description: 'License', transactionDate: date, reviewStatus: 'PENDING', createdAt: date },
      { id: 'e2', merchantName: 'Vendor A', amount: 1500, category: 'IT', description: 'License', transactionDate: date, reviewStatus: 'PENDING', createdAt: date },
    ]);
    const result = await service.analyzeOrganization('org-1');
    expect(result.duplicatesFound).toBeGreaterThan(0);
    expect(result.findings.some((f) => f.findingType === 'DUPLICATE_INVOICE')).toBe(true);
  });

  it('analyzeOrganization detects vendor concentration', async () => {
    const date = new Date('2026-01-15');
    const expenses = [];
    // One vendor with 90% of spend
    for (let i = 0; i < 9; i++) {
      expenses.push({ id: `e${i}`, merchantName: 'Big Vendor', amount: 10000, category: 'IT', description: 'Service', transactionDate: date, reviewStatus: 'PENDING', createdAt: date });
    }
    expenses.push({ id: 'e9', merchantName: 'Small Vendor', amount: 10000, category: 'IT', description: 'Service', transactionDate: date, reviewStatus: 'PENDING', createdAt: date });
    mockPrisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.analyzeOrganization('org-1');
    // Big Vendor has 90% of spend > 35% threshold
    const concFindings = result.findings.filter((f) => f.findingType === 'VENDOR_CONCENTRATION');
    expect(concFindings.length).toBeGreaterThan(0);
    expect(concFindings[0].severity).toBe('HIGH');
  });

  it('analyzeOrganization calculates health score', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'V1', amount: 500, category: null, description: null, transactionDate: new Date(), reviewStatus: 'APPROVED', createdAt: new Date() },
    ]);
    const result = await service.analyzeOrganization('org-1');
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
    expect(result.healthScore).toBeLessThanOrEqual(100);
  });

  it('calculateApLcrImpact returns LCR impact projection', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { amount: 50000 },
      { amount: 30000 },
    ]);
    mockAlmEnterprise.calculateLCR.mockResolvedValue({
      lcr: 120,
      hqla: 50,
      netOutflows: 40,
    });
    const result = await service.calculateApLcrImpact('org-1', 'inst-1');
    expect(result).toHaveProperty('currentLcr');
    expect(result).toHaveProperty('projectedLcr');
    expect(result).toHaveProperty('alertLevel');
    expect(['SAFE', 'ADEQUATE', 'WATCH', 'CRITICAL']).toContain(result.alertLevel);
  });
});
