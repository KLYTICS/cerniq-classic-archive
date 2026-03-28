import { CECLService } from './cecl.service';

describe('CECLService', () => {
  let svc: CECLService;

  beforeEach(() => {
    const mockPrisma = {
      loanSegment: { findMany: jest.fn().mockResolvedValue([]), createMany: jest.fn(), deleteMany: jest.fn() },
      institution: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    svc = new CECLService(mockPrisma);
  });

  const segments = [
    { segmentName: 'Consumer', balance: 100_000_000, weightedAvgMaturity: 3, historicalLossRate: 0.02, lgd: 0.5, qualitativeAdj: 0.005 },
    { segmentName: 'Commercial', balance: 200_000_000, weightedAvgMaturity: 5, historicalLossRate: 0.01, lgd: 0.4, qualitativeAdj: 0.002 },
  ];

  it('should return correct WARM output shape', () => {
    const result = svc.calculateWARM(segments);
    expect(result).toHaveProperty('totalBalance');
    expect(result).toHaveProperty('totalAllowance');
    expect(result).toHaveProperty('weightedCoverageRatio');
    expect(result).toHaveProperty('methodology');
    expect(result).toHaveProperty('segments');
    expect(result.methodology).toBe('WARM');
    expect(result.segments.length).toBe(2);
  });

  it('should compute WARM lifetime loss correctly', () => {
    const result = svc.calculateWARM(segments);
    // Consumer: adjRate = 0.02 + 0.005 = 0.025; lifetimeLoss = 0.025 * 3 = 0.075
    // EL = 100M * 0.075 = 7,500,000
    const consumer = result.segments.find(s => s.segmentName === 'Consumer')!;
    expect(consumer.expectedLoss).toBeCloseTo(7_500_000, -3);
  });

  it('should compute totalBalance as sum of segment balances', () => {
    const result = svc.calculateWARM(segments);
    expect(result.totalBalance).toBeCloseTo(300_000_000, 0);
  });

  it('should return correct Vintage output with LGD applied', () => {
    const result = svc.calculateVintage(segments);
    expect(result.methodology).toBe('Vintage');
    // Vintage applies LGD to expected loss, so allowance should be smaller than EL
    for (const seg of result.segments) {
      expect(seg.allowanceRequired).toBeLessThanOrEqual(seg.expectedLoss);
    }
  });

  it('should compute PD x LGD with macro scenario weights', () => {
    const result = svc.calculatePDxLGD(segments);
    expect(result.methodology).toBe('PD×LGD');
    expect(result.macroScenarioBreakdown).toBeDefined();
    // adverse allowance >= baseline
    expect(result.macroScenarioBreakdown!.adverse).toBeGreaterThanOrEqual(result.macroScenarioBreakdown!.baseline);
    // severely adverse >= adverse
    expect(result.macroScenarioBreakdown!.severelyAdverse).toBeGreaterThanOrEqual(result.macroScenarioBreakdown!.adverse);
  });

  it('should handle zero balance segments gracefully', () => {
    const zeroSegments = [{ segmentName: 'Empty', balance: 0, weightedAvgMaturity: 3, historicalLossRate: 0.02, lgd: 0.5, qualitativeAdj: 0 }];
    const result = svc.calculateWARM(zeroSegments);
    expect(result.totalBalance).toBe(0);
    expect(result.totalAllowance).toBe(0);
    expect(result.weightedCoverageRatio).toBe(0);
  });
});
