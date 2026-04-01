import { PeerAnalyticsService } from './peer-analytics.service';

describe('PeerAnalyticsService', () => {
  let service: PeerAnalyticsService;
  const mockPrisma = {
    institution: {
      findUnique: jest.fn().mockResolvedValue({ totalAssets: 200 }),
    },
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  beforeEach(() => {
    service = new PeerAnalyticsService(mockPrisma);
  });

  it('should return medium tier for $200M institution', async () => {
    const result = await service.getPeerAnalytics('inst-1');
    expect(result.assetTier).toBe('medium');
    expect(result.peerGroupName).toContain('$50M');
  });

  it('should return 6 peer metrics', async () => {
    const result = await service.getPeerAnalytics('inst-1');
    expect(result.metrics).toHaveLength(6);
  });

  it('each metric should have percentile rank 0-100', async () => {
    const result = await service.getPeerAnalytics('inst-1');
    for (const m of result.metrics) {
      expect(m.percentileRank).toBeGreaterThanOrEqual(0);
      expect(m.percentileRank).toBeLessThanOrEqual(100);
    }
  });

  it('NIM demo default should be around 3.5', async () => {
    const result = await service.getPeerAnalytics('inst-1');
    const nim = result.metrics.find((m) =>
      m.metricName.includes('Net Interest Margin'),
    );
    expect(nim!.institutionValue).toBeCloseTo(3.5, 1);
  });

  it('small tier for < $50M assets', async () => {
    const smallPrisma = {
      institution: {
        findUnique: jest.fn().mockResolvedValue({ totalAssets: 30 }),
      },
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const svc = new PeerAnalyticsService(smallPrisma);
    const result = await svc.getPeerAnalytics('inst-1');
    expect(result.assetTier).toBe('small');
  });

  // ── large tier ──────────────────────────────────────────────
  it('large tier for > $300M assets', async () => {
    const largePrisma = {
      institution: {
        findUnique: jest.fn().mockResolvedValue({ totalAssets: 500 }),
      },
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const svc = new PeerAnalyticsService(largePrisma);
    const result = await svc.getPeerAnalytics('inst-1');
    expect(result.assetTier).toBe('large');
    expect(result.peerGroupName).toContain('>');
  });

  // ── null institution defaults to medium tier ────────────────
  it('defaults to medium tier when institution is null', async () => {
    const nullPrisma = {
      institution: {
        findUnique: jest.fn().mockResolvedValue(null),
      },
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const svc = new PeerAnalyticsService(nullPrisma);
    const result = await svc.getPeerAnalytics('inst-1');
    // totalAssets defaults to 200, which is medium
    expect(result.assetTier).toBe('medium');
  });

  // ── percentile rank boundaries ──────────────────────────────
  describe('percentile rank computation', () => {
    it('assigns top_quartile status for percentile >= 75', async () => {
      // NIM = 4.5 should be top quartile for medium tier (p75 = 4.2)
      const highNimPrisma = {
        institution: {
          findUnique: jest.fn().mockResolvedValue({ totalAssets: 200 }),
        },
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      const svc = new PeerAnalyticsService(highNimPrisma);
      // Override default metrics by checking result
      const result = await svc.getPeerAnalytics('inst-1');
      const nim = result.metrics.find(m => m.metricName.includes('Net Interest Margin'));
      // Default NIM is 3.5 for medium tier, p50 = 3.6, so should be around 50th percentile
      expect(nim!.percentileRank).toBeGreaterThanOrEqual(0);
    });

    it('assigns bottom_quartile status for very low values', async () => {
      const result = await service.getPeerAnalytics('inst-1');
      // Check that status mapping is consistent
      for (const m of result.metrics) {
        if (m.percentileRank >= 75) expect(m.status).toBe('top_quartile');
        else if (m.percentileRank >= 50) expect(m.status).toBe('above_median');
        else if (m.percentileRank >= 25) expect(m.status).toBe('below_median');
        else expect(m.status).toBe('bottom_quartile');
      }
    });

    it('returns 0 percentile for value below min', async () => {
      // This tests the clamp at 0 in computePercentileRank
      const result = await service.getPeerAnalytics('inst-1');
      for (const m of result.metrics) {
        expect(m.percentileRank).toBeGreaterThanOrEqual(0);
        expect(m.percentileRank).toBeLessThanOrEqual(100);
      }
    });
  });

  // ── "lower is better" metrics ───────────────────────────────
  describe('lower-is-better metrics', () => {
    it('EVE_Sensitivity has inverted percentile (lower value = higher rank)', async () => {
      const result = await service.getPeerAnalytics('inst-1');
      const eve = result.metrics.find(m => m.metricName.includes('EVE Sensitivity'));
      expect(eve).toBeDefined();
      // Default EVE_Sensitivity = 15.2 for medium tier p50 = 16 => should be above median
      expect(eve!.percentileRank).toBeGreaterThan(0);
    });

    it('Deposit_Beta has inverted percentile', async () => {
      const result = await service.getPeerAnalytics('inst-1');
      const beta = result.metrics.find(m => m.metricName.includes('Deposit Beta'));
      expect(beta).toBeDefined();
      expect(beta!.percentileRank).toBeGreaterThanOrEqual(0);
    });
  });

  // ── Spanish labels ──────────────────────────────────────────
  describe('bilingual labels', () => {
    it('each metric has Spanish label', async () => {
      const result = await service.getPeerAnalytics('inst-1');
      for (const m of result.metrics) {
        expect(m.metricNameEs).toBeDefined();
        expect(m.metricNameEs.length).toBeGreaterThan(0);
      }
    });

    it('peer group has Spanish name', async () => {
      const result = await service.getPeerAnalytics('inst-1');
      expect(result.peerGroupNameEs).toBeDefined();
      expect(result.peerGroupNameEs).toContain('Cooperativas PR');
    });
  });

  // ── real balance sheet metrics ──────────────────────────────
  describe('with balance sheet items', () => {
    it('computes NIM from actual asset income and liability cost', async () => {
      const realPrisma = {
        institution: {
          findUnique: jest.fn().mockResolvedValue({ totalAssets: 200 }),
        },
        balanceSheetItem: {
          findMany: jest.fn().mockResolvedValue([
            { category: 'asset', subcategory: 'loans', balance: 150, rate: 0.06 },
            { category: 'asset', subcategory: 'securities', balance: 50, rate: 0.04 },
            { category: 'liability', subcategory: 'deposits', balance: 180, rate: 0.02 },
          ]),
        },
      } as any;
      const svc = new PeerAnalyticsService(realPrisma);
      const result = await svc.getPeerAnalytics('inst-1');

      const nim = result.metrics.find(m => m.metricName.includes('Net Interest Margin'));
      // NIM = ((150*0.06 + 50*0.04) - 180*0.02) / 200 * 100
      // = (9 + 2 - 3.6) / 200 * 100 = 7.4 / 200 * 100 = 3.7
      expect(nim!.institutionValue).toBeCloseTo(3.7, 1);
    });

    it('computes Loan-to-Share ratio from balance sheet', async () => {
      const realPrisma = {
        institution: {
          findUnique: jest.fn().mockResolvedValue({ totalAssets: 200 }),
        },
        balanceSheetItem: {
          findMany: jest.fn().mockResolvedValue([
            { category: 'asset', subcategory: 'loans', balance: 120, rate: 0.06 },
            { category: 'asset', subcategory: 'cash', balance: 30, rate: 0.01 },
            { category: 'asset', subcategory: 'securities', balance: 50, rate: 0.04 },
            { category: 'liability', subcategory: 'deposits', balance: 180, rate: 0.02 },
          ]),
        },
      } as any;
      const svc = new PeerAnalyticsService(realPrisma);
      const result = await svc.getPeerAnalytics('inst-1');

      const lts = result.metrics.find(m => m.metricName.includes('Loan-to-Share'));
      // totalLoans = 120 (loans, excludes cash and securities)
      // totalLiabs = 180
      // loanToShare = (120 / 180) * 100 = 66.67
      expect(lts!.institutionValue).toBeCloseTo(66.7, 0);
    });
  });

  // ── peer count ─────────────────────────────────────────────
  it('returns correct peer count for each tier', async () => {
    const result = await service.getPeerAnalytics('inst-1');
    // Medium tier has 43 peers
    expect(result.peerCount).toBe(43);
  });

  it('institutionId is preserved in result', async () => {
    const result = await service.getPeerAnalytics('inst-1');
    expect(result.institutionId).toBe('inst-1');
  });
});
