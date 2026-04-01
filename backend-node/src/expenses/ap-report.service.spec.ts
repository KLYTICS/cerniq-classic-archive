import { ApReportService } from './ap-report.service';

describe('ApReportService', () => {
  let service: ApReportService;
  const mockPrisma = {
    organization: {
      findUnique: jest
        .fn()
        .mockResolvedValue({ id: 'org-1', name: 'Test Org' }),
    },
  };
  const mockAnomalyDetection = {
    analyzeOrganization: jest.fn().mockResolvedValue({
      totalExpenses: 100000,
      anomalyCount: 2,
      topVendors: [],
      categoryBreakdown: {},
      findings: [
        {
          type: 'duplicate',
          vendor: 'Test',
          amount: 500,
          estimatedRecovery: 500,
        },
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

  it('generateAPReport generates Spanish PDF', async () => {
    const result = await service.generateAPReport('org-1', null, 'es');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generateAPReport renders with findings and vendor report', async () => {
    mockAnomalyDetection.analyzeOrganization.mockResolvedValueOnce({
      totalExpenses: 250000,
      anomalyCount: 5,
      topVendors: [],
      categoryBreakdown: {},
      findings: [
        { findingType: 'DUPLICATE_INVOICE', affectedVendor: 'V1', amount: 1000, estimatedRecovery: 1000, severity: 'HIGH' },
        { findingType: 'AMOUNT_ANOMALY', affectedVendor: 'V2', amount: 500, estimatedRecovery: 250, severity: 'MEDIUM' },
      ],
      estimatedTotalRecovery: 1250,
      vendorRiskScores: [],
      expensesByCategory: [],
      monthlyTrend: [],
      healthScore: 72,
      topVendorName: 'V1',
      vendorReport: [
        { vendorName: 'V1', transactionCount: 5, quarterlyTotal: 50000, percentOfTotalSpend: 30, match: null, latestTransactionDate: new Date() },
      ],
    });
    const result = await service.generateAPReport('org-1', null, 'en');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  it('generateAPReport handles null organization gracefully', async () => {
    mockPrisma.organization.findUnique.mockResolvedValueOnce(null);
    const result = await service.generateAPReport('org-missing', null, 'en');
    expect(Buffer.isBuffer(result)).toBe(true);
  });

  // ── Coverage: report with institutionId for LCR impact ────────
  it('generates report with LCR impact when institutionId is provided', async () => {
    mockAnomalyDetection.calculateApLcrImpact = jest.fn().mockResolvedValue({
      currentLcr: 120, projectedLcr: 115, hqla: 50, currentNetOutflows: 40,
      apProjected30Day: 5000, delta: -5, alertLevel: 'ADEQUATE',
      quarterlyAPTotal: 15000, vsLastQuarter: 10,
    });
    const result = await service.generateAPReport('org-1', 'inst-1', 'en');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Coverage: Spanish language ──────────────────────────────
  it('generates report in Spanish', async () => {
    const result = await service.generateAPReport('org-1', null, 'es');
    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
  });

  // ── Coverage: LCR impact failure ────────────────────────────
  it('generates report even when LCR impact calculation fails', async () => {
    mockAnomalyDetection.calculateApLcrImpact = jest.fn().mockRejectedValue(new Error('LCR failed'));
    const result = await service.generateAPReport('org-1', 'inst-fail', 'en');
    expect(Buffer.isBuffer(result)).toBe(true);
  });
});
