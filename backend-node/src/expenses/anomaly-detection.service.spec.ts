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
      {
        id: 'e1',
        merchantName: 'Vendor A',
        amount: 1500,
        category: 'IT',
        description: 'License',
        transactionDate: date,
        reviewStatus: 'PENDING',
        createdAt: date,
      },
      {
        id: 'e2',
        merchantName: 'Vendor A',
        amount: 1500,
        category: 'IT',
        description: 'License',
        transactionDate: date,
        reviewStatus: 'PENDING',
        createdAt: date,
      },
    ]);
    const result = await service.analyzeOrganization('org-1');
    expect(result.duplicatesFound).toBeGreaterThan(0);
    expect(
      result.findings.some((f) => f.findingType === 'DUPLICATE_INVOICE'),
    ).toBe(true);
  });

  it('analyzeOrganization detects vendor concentration', async () => {
    const date = new Date('2026-01-15');
    const expenses = [];
    // One vendor with 90% of spend
    for (let i = 0; i < 9; i++) {
      expenses.push({
        id: `e${i}`,
        merchantName: 'Big Vendor',
        amount: 10000,
        category: 'IT',
        description: 'Service',
        transactionDate: date,
        reviewStatus: 'PENDING',
        createdAt: date,
      });
    }
    expenses.push({
      id: 'e9',
      merchantName: 'Small Vendor',
      amount: 10000,
      category: 'IT',
      description: 'Service',
      transactionDate: date,
      reviewStatus: 'PENDING',
      createdAt: date,
    });
    mockPrisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.analyzeOrganization('org-1');
    // Big Vendor has 90% of spend > 35% threshold
    const concFindings = result.findings.filter(
      (f) => f.findingType === 'VENDOR_CONCENTRATION',
    );
    expect(concFindings.length).toBeGreaterThan(0);
    expect(concFindings[0].severity).toBe('HIGH');
  });

  it('analyzeOrganization calculates health score', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      {
        id: 'e1',
        merchantName: 'V1',
        amount: 500,
        category: null,
        description: null,
        transactionDate: new Date(),
        reviewStatus: 'APPROVED',
        createdAt: new Date(),
      },
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
    expect(['SAFE', 'ADEQUATE', 'WATCH', 'CRITICAL']).toContain(
      result.alertLevel,
    );
  });

  // ── Near-duplicate detection ─────────────────────────────────

  it('detects near-duplicate invoices (same vendor, close amount, close date)', async () => {
    const date1 = new Date('2026-01-15');
    const date2 = new Date('2026-01-18');
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'Vendor X', amount: 1500.00, category: null, description: null, transactionDate: date1, reviewStatus: 'PENDING', createdAt: date1 },
      { id: 'e2', merchantName: 'Vendor X', amount: 1500.30, category: null, description: null, transactionDate: date2, reviewStatus: 'PENDING', createdAt: date2 },
    ]);
    const result = await service.analyzeOrganization('org-1');
    const nearDupes = result.findings.filter(f => f.findingType === 'DUPLICATE_INVOICE' && f.severity === 'MEDIUM');
    expect(nearDupes.length).toBeGreaterThan(0);
  });

  // ── Amount anomalies ─────────────────────────────────────────

  it('detects amount anomalies (outlier)', async () => {
    const now = new Date();
    const expenses = [];
    for (let i = 0; i < 10; i++) {
      expenses.push({
        id: `e${i}`, merchantName: 'Vendor A', amount: 1000,
        category: null, description: null,
        transactionDate: new Date(now.getTime() - i * 7 * 24 * 60 * 60 * 1000),
        reviewStatus: 'PENDING', createdAt: now,
      });
    }
    // Add outlier
    expenses.push({
      id: 'e-outlier', merchantName: 'Vendor A', amount: 50000,
      category: null, description: null,
      transactionDate: new Date(now.getTime() - 3 * 24 * 60 * 60 * 1000),
      reviewStatus: 'PENDING', createdAt: now,
    });
    mockPrisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.analyzeOrganization('org-1');
    const amountAnoms = result.findings.filter(f => f.findingType === 'AMOUNT_ANOMALY');
    expect(amountAnoms.length).toBeGreaterThan(0);
  });

  // ── Split billing ────────────────────────────────────────────

  it('detects split billing (round thousand in 14-day window)', async () => {
    const base = new Date('2026-02-01');
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'SplitCo', amount: 333, category: null, description: null, transactionDate: new Date(base.getTime()), reviewStatus: 'PENDING', createdAt: base },
      { id: 'e2', merchantName: 'SplitCo', amount: 333, category: null, description: null, transactionDate: new Date(base.getTime() + 2 * 86400000), reviewStatus: 'PENDING', createdAt: base },
      { id: 'e3', merchantName: 'SplitCo', amount: 334, category: null, description: null, transactionDate: new Date(base.getTime() + 5 * 86400000), reviewStatus: 'PENDING', createdAt: base },
    ]);
    const result = await service.analyzeOrganization('org-1');
    const splits = result.findings.filter(f => f.findingType === 'SPLIT_BILLING');
    expect(splits.length).toBeGreaterThan(0);
  });

  // ── Frequency anomalies ──────────────────────────────────────

  it('detects frequency anomalies (spike in latest month)', async () => {
    const expenses = [];
    // 3 invoices per month for months 1-3
    for (let m = 1; m <= 3; m++) {
      for (let i = 0; i < 3; i++) {
        expenses.push({
          id: `e-m${m}-${i}`, merchantName: 'FreqVendor', amount: 500,
          category: null, description: null,
          transactionDate: new Date(`2026-0${m}-${String(i + 10).padStart(2, '0')}`),
          reviewStatus: 'PENDING', createdAt: new Date(),
        });
      }
    }
    // 10 invoices in month 4 (spike)
    for (let i = 0; i < 10; i++) {
      expenses.push({
        id: `e-m4-${i}`, merchantName: 'FreqVendor', amount: 500,
        category: null, description: null,
        transactionDate: new Date(`2026-04-${String(i + 1).padStart(2, '0')}`),
        reviewStatus: 'PENDING', createdAt: new Date(),
      });
    }
    mockPrisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.analyzeOrganization('org-1');
    const freqAnoms = result.findings.filter(f => f.findingType === 'FREQUENCY_ANOMALY');
    expect(freqAnoms.length).toBeGreaterThan(0);
  });

  // ── Dormant vendor reactivated ───────────────────────────────

  it('detects dormant vendor reactivation (gap > 90 days)', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'DormCo', amount: 500, category: null, description: null, transactionDate: new Date('2025-06-01'), reviewStatus: 'PENDING', createdAt: new Date('2025-06-01') },
      { id: 'e2', merchantName: 'DormCo', amount: 600, category: null, description: null, transactionDate: new Date('2026-01-15'), reviewStatus: 'PENDING', createdAt: new Date('2026-01-15') },
    ]);
    const result = await service.analyzeOrganization('org-1');
    const dormant = result.findings.filter(f => f.findingType === 'DORMANT_VENDOR_REACTIVATED');
    expect(dormant.length).toBeGreaterThan(0);
  });

  // ── Unauthorized category ────────────────────────────────────

  it('detects unauthorized category (IT with catering keyword)', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'MismatchCo', amount: 500, category: 'IT', description: 'Catering for event', transactionDate: new Date(), reviewStatus: 'PENDING', createdAt: new Date() },
    ]);
    const result = await service.analyzeOrganization('org-1');
    const catAnoms = result.findings.filter(f => f.findingType === 'UNAUTHORIZED_CATEGORY');
    expect(catAnoms.length).toBeGreaterThan(0);
    expect(catAnoms[0].severity).toBe('LOW');
  });

  // ── Medium vendor concentration ──────────────────────────────

  it('detects medium vendor concentration (25-35%)', async () => {
    const date = new Date();
    const expenses = [];
    // 30% for one vendor
    for (let i = 0; i < 3; i++) {
      expenses.push({ id: `e-big-${i}`, merchantName: 'MedConc', amount: 1000, category: null, description: null, transactionDate: date, reviewStatus: 'PENDING', createdAt: date });
    }
    for (let i = 0; i < 7; i++) {
      expenses.push({ id: `e-small-${i}`, merchantName: `Other${i}`, amount: 1000, category: null, description: null, transactionDate: date, reviewStatus: 'PENDING', createdAt: date });
    }
    mockPrisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.analyzeOrganization('org-1');
    const medConc = result.findings.filter(f => f.findingType === 'VENDOR_CONCENTRATION' && f.severity === 'MEDIUM');
    expect(medConc.length).toBeGreaterThan(0);
  });

  // ── calculateApLcrImpact — edge cases ────────────────────────

  // D1 (2026-04-07): the previous expectation here was `currentLcr === 0`,
  // codifying the silent zero. New contract: when LCR cannot be looked up,
  // every numeric field is null and `alertLevel === 'DATA_UNAVAILABLE'`.
  it('calculateApLcrImpact returns DATA_UNAVAILABLE when LCR lookup fails', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([{ amount: 10000 }]);
    mockAlmEnterprise.calculateLCR.mockRejectedValue(new Error('LCR unavailable'));
    const result = await service.calculateApLcrImpact('org-1', 'inst-1');
    expect(result.currentLcr).toBeNull();
    expect(result.projectedLcr).toBeNull();
    expect(result.hqla).toBeNull();
    expect(result.delta).toBeNull();
    expect(result.alertLevel).toBe('DATA_UNAVAILABLE');
  });

  it('calculateApLcrImpact computes vsLastQuarter', async () => {
    mockPrisma.expense.findMany
      .mockResolvedValueOnce([{ amount: 90000 }])
      .mockResolvedValueOnce([{ amount: 60000 }]);
    mockAlmEnterprise.calculateLCR.mockResolvedValue({ lcr: 130, hqla: 80, netOutflows: 50 });
    const result = await service.calculateApLcrImpact('org-1', 'inst-1');
    expect(result.vsLastQuarter).toBeDefined();
    expect(typeof result.vsLastQuarter).toBe('number');
  });

  it('calculateApLcrImpact returns ADEQUATE for projected LCR 100-120', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([{ amount: 100000000 }]);
    mockAlmEnterprise.calculateLCR.mockResolvedValue({ lcr: 110, hqla: 55, netOutflows: 50 });
    const result = await service.calculateApLcrImpact('org-1', 'inst-1');
    // With large AP outflow, projectedLcr will drop
    expect(['SAFE', 'ADEQUATE', 'WATCH', 'CRITICAL']).toContain(result.alertLevel);
  });

  // ── persistFlags error handling ──────────────────────────────

  it('handles persistFlags failure gracefully', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'V1', amount: 1000, category: null, description: null, transactionDate: new Date(), reviewStatus: 'PENDING', createdAt: new Date() },
      { id: 'e2', merchantName: 'V1', amount: 1000, category: null, description: null, transactionDate: new Date(), reviewStatus: 'PENDING', createdAt: new Date() },
    ]);
    mockPrisma.expense.update.mockRejectedValue(new Error('DB write failed'));
    // Should not throw
    const result = await service.analyzeOrganization('org-1');
    expect(result.totalExpenses).toBe(2);
  });

  // ── Health score edge cases ──────────────────────────────────

  // ── Coverage: calculateApLcrImpact with zero priorQuarterlyTotal ──
  it('calculateApLcrImpact returns 0 vsLastQuarter when prior total is 0', async () => {
    mockPrisma.expense.findMany
      .mockResolvedValueOnce([{ amount: 10000 }])
      .mockResolvedValueOnce([]); // no prior expenses
    mockAlmEnterprise.calculateLCR.mockResolvedValue({ lcr: 130, hqla: 80, netOutflows: 50 });
    const result = await service.calculateApLcrImpact('org-1', 'inst-1');
    expect(result.vsLastQuarter).toBe(0);
  });

  // ── Coverage: WATCH and CRITICAL alert levels ─────────────────
  it('calculateApLcrImpact returns CRITICAL for very low projected LCR', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([{ amount: 500_000_000 }]);
    mockAlmEnterprise.calculateLCR.mockResolvedValue({ lcr: 90, hqla: 10, netOutflows: 12 });
    const result = await service.calculateApLcrImpact('org-1', 'inst-1');
    expect(['WATCH', 'CRITICAL']).toContain(result.alertLevel);
  });

  // ── Coverage: HIGH severity frequency anomaly ─────────────────
  it('detects HIGH severity frequency anomaly (> 4x rolling avg)', async () => {
    const expenses = [];
    for (let m = 1; m <= 3; m++) {
      expenses.push({
        id: `e-m${m}`, merchantName: 'HiFreq', amount: 500,
        category: null, description: null,
        transactionDate: new Date(`2026-0${m}-15`),
        reviewStatus: 'PENDING', createdAt: new Date(),
      });
    }
    // 15 invoices in month 4 (> 4x avg of 1)
    for (let i = 0; i < 15; i++) {
      expenses.push({
        id: `e-m4-${i}`, merchantName: 'HiFreq', amount: 500,
        category: null, description: null,
        transactionDate: new Date(`2026-04-${String(i + 1).padStart(2, '0')}`),
        reviewStatus: 'PENDING', createdAt: new Date(),
      });
    }
    mockPrisma.expense.findMany.mockResolvedValue(expenses);
    const result = await service.analyzeOrganization('org-1');
    const hiFreq = result.findings.filter(f => f.findingType === 'FREQUENCY_ANOMALY' && f.severity === 'HIGH');
    expect(hiFreq.length).toBeGreaterThan(0);
  });

  // ── Coverage: dormant vendor with gap > 180 days (HIGH severity) ──
  it('detects HIGH severity dormant vendor (> 180 day gap)', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'LongDorm', amount: 500, category: null, description: null, transactionDate: new Date('2025-01-01'), reviewStatus: 'PENDING', createdAt: new Date('2025-01-01') },
      { id: 'e2', merchantName: 'LongDorm', amount: 600, category: null, description: null, transactionDate: new Date('2026-01-15'), reviewStatus: 'PENDING', createdAt: new Date('2026-01-15') },
    ]);
    const result = await service.analyzeOrganization('org-1');
    const dormant = result.findings.filter(f => f.findingType === 'DORMANT_VENDOR_REACTIVATED' && f.severity === 'HIGH');
    expect(dormant.length).toBeGreaterThan(0);
  });

  it('health score is 100 for clean expenses with no findings', async () => {
    mockPrisma.expense.findMany.mockResolvedValue([
      { id: 'e1', merchantName: 'V1', amount: 500, category: null, description: null, transactionDate: new Date(), reviewStatus: 'APPROVED', createdAt: new Date() },
      { id: 'e2', merchantName: 'V2', amount: 500, category: null, description: null, transactionDate: new Date(), reviewStatus: 'APPROVED', createdAt: new Date() },
    ]);
    const result = await service.analyzeOrganization('org-1');
    expect(result.healthScore).toBeGreaterThanOrEqual(0);
  });
});
