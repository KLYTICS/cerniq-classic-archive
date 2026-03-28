import { WrongWayRiskService } from './wrong-way-risk.service';

describe('WrongWayRiskService', () => {
  let service: WrongWayRiskService;

  describe('demo mode', () => {
    beforeEach(() => {
      const mockPrisma = {
        loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      service = new WrongWayRiskService(mockPrisma);
    });

    it('should return demo CVA values', async () => {
      const result = await service.computeWWR('inst-1');
      expect(result.naiveCVA).toBeCloseTo(2.4, 1);
      expect(result.adjustedCVA).toBeCloseTo(3.8, 1);
    });

    it('WWR premium should be adjustedCVA - naiveCVA', async () => {
      const result = await service.computeWWR('inst-1');
      expect(result.wwrPremium).toBeCloseTo(result.adjustedCVA - result.naiveCVA, 1);
    });

    it('multiplier should be > 1 (WWR increases CVA)', async () => {
      const result = await service.computeWWR('inst-1');
      expect(result.wwrMultiplier).toBeGreaterThan(1);
      expect(result.wwrMultiplier).toBeCloseTo(1.58, 2);
    });
  });

  it('should compute WWR with loan segments', async () => {
    const mockPrisma = {
      loanSegment: {
        findMany: jest.fn().mockResolvedValue([
          { segmentName: 'CRE', historicalLossRate: 0.02, lgd: 0.4, balance: 100, weightedAvgMaturity: 5 },
          { segmentName: 'Consumer', historicalLossRate: 0.03, lgd: 0.6, balance: 50, weightedAvgMaturity: 3 },
        ]),
      },
    } as any;
    service = new WrongWayRiskService(mockPrisma);
    const result = await service.computeWWR('inst-1', 0.3);
    expect(result.adjustedCVA).toBeGreaterThan(result.naiveCVA);
    expect(result.bySegment).toHaveLength(2);
  });

  it('narratives should be in both languages', async () => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    service = new WrongWayRiskService(mockPrisma);
    const result = await service.computeWWR('inst-1');
    expect(result.narrativeEn).toBeDefined();
    expect(result.narrativeEs).toBeDefined();
  });
});
