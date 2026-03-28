import { PeerAnalyticsService } from './peer-analytics.service';

describe('PeerAnalyticsService', () => {
  let service: PeerAnalyticsService;
  const mockPrisma = {
    institution: { findUnique: jest.fn().mockResolvedValue({ totalAssets: 200 }) },
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
    const nim = result.metrics.find(m => m.metricName.includes('Net Interest Margin'));
    expect(nim!.institutionValue).toBeCloseTo(3.5, 1);
  });

  it('small tier for < $50M assets', async () => {
    const smallPrisma = {
      institution: { findUnique: jest.fn().mockResolvedValue({ totalAssets: 30 }) },
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    const svc = new PeerAnalyticsService(smallPrisma);
    const result = await svc.getPeerAnalytics('inst-1');
    expect(result.assetTier).toBe('small');
  });
});
