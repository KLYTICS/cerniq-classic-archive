import { ApReportService } from './ap-report.service';

describe('ApReportService', () => {
  let service: ApReportService;
  const mockPrisma = {
    organization: {
      findUnique: jest.fn().mockResolvedValue({ id: 'org-1', name: 'Test Org' }),
    },
  };
  const mockAnomalyDetection = {
    analyzeOrganization: jest.fn().mockResolvedValue({
      totalExpenses: 100000,
      anomalyCount: 2,
      topVendors: [],
      categoryBreakdown: {},
      findings: [
        { type: 'duplicate', vendor: 'Test', amount: 500, estimatedRecovery: 500 },
      ],
      estimatedTotalRecovery: 500,
      vendorRiskScores: [],
      expensesByCategory: [],
      monthlyTrend: [],
    }),
    calculateApLcrImpact: jest.fn().mockResolvedValue({
      lcrBefore: 1.2,
      lcrAfter: 1.15,
      projectedLcr: 115.0,
      alertLevel: 'green',
      impact: -5,
    }),
  };

  beforeEach(() => {
    service = new ApReportService(
      mockPrisma as any,
      mockAnomalyDetection as any,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateAPReport returns a Buffer', async () => {
    const result = await service.generateAPReport('org-1', null, 'en');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generateAPReport calls anomaly detection service', async () => {
    await service.generateAPReport('org-1', null, 'en');
    expect(mockAnomalyDetection.analyzeOrganization).toHaveBeenCalledWith(
      'org-1',
    );
  });

  it('generateAPReport fetches LCR impact when institutionId provided', async () => {
    await service.generateAPReport('org-1', 'inst-1', 'en');
    expect(mockAnomalyDetection.calculateApLcrImpact).toHaveBeenCalledWith(
      'org-1',
      'inst-1',
    );
  });

  it('generateAPReport handles LCR impact failure gracefully', async () => {
    mockAnomalyDetection.calculateApLcrImpact.mockRejectedValueOnce(
      new Error('LCR calc failed'),
    );
    const result = await service.generateAPReport('org-1', 'inst-1', 'es');
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
