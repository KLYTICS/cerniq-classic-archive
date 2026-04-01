import { CECLService } from './cecl.service';

describe('CECLService', () => {
  let svc: CECLService;

  beforeEach(() => {
    const mockPrisma = {
      loanSegment: {
        findMany: jest.fn().mockResolvedValue([]),
        createMany: jest.fn(),
        deleteMany: jest.fn(),
      },
      institution: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    svc = new CECLService(mockPrisma);
  });

  const segments = [
    {
      segmentName: 'Consumer',
      balance: 100_000_000,
      weightedAvgMaturity: 3,
      historicalLossRate: 0.02,
      lgd: 0.5,
      qualitativeAdj: 0.005,
    },
    {
      segmentName: 'Commercial',
      balance: 200_000_000,
      weightedAvgMaturity: 5,
      historicalLossRate: 0.01,
      lgd: 0.4,
      qualitativeAdj: 0.002,
    },
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

  it('should compute WARM lifetime loss with PV discounting correctly', () => {
    const result = svc.calculateWARM(segments);
    // Consumer: adjRate = 0.02 + 0.005 = 0.025; maturity = 3; discountRate = 0.03 (default)
    // undiscountedLoss = 0.025 * 3 = 0.075
    // pvFactor = (1 - (1.03)^-3) / (0.03 * 3) ≈ 0.9429
    // lifetimeLoss = 0.075 * 0.9429 ≈ 0.07072
    // EL = 100M * 0.07072 ≈ 7,071,712
    const consumer = result.segments.find((s) => s.segmentName === 'Consumer')!;
    expect(consumer.expectedLoss).toBeCloseTo(7_071_712, -4);
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
    expect(result.macroScenarioBreakdown!.adverse).toBeGreaterThanOrEqual(
      result.macroScenarioBreakdown!.baseline,
    );
    // severely adverse >= adverse
    expect(
      result.macroScenarioBreakdown!.severelyAdverse,
    ).toBeGreaterThanOrEqual(result.macroScenarioBreakdown!.adverse);
  });

  it('should handle zero balance segments gracefully', () => {
    const zeroSegments = [
      {
        segmentName: 'Empty',
        balance: 0,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ];
    const result = svc.calculateWARM(zeroSegments);
    expect(result.totalBalance).toBe(0);
    expect(result.totalAllowance).toBe(0);
    expect(result.weightedCoverageRatio).toBe(0);
  });

  // ── WARM: zero maturity ────────────────────────────────────
  it('should handle zero maturity (pvFactor = 1)', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'Short',
        balance: 100_000,
        weightedAvgMaturity: 0,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ]);
    const seg = result.segments[0];
    // With maturity 0, undiscountedLoss = 0, lifetimeLoss = 0
    expect(seg.expectedLoss).toBe(0);
    expect(seg.coverageRatio).toBe(0);
  });

  // ── WARM: custom discount rate ─────────────────────────────
  it('should use custom discount rate when provided', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'Custom',
        balance: 100_000,
        weightedAvgMaturity: 5,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0,
        discountRate: 0.05,
      },
    ]);
    expect(result.totalAllowance).toBeGreaterThan(0);
  });

  // ── WARM: negative qualitative adj ─────────────────────────
  it('should allow negative qualitative adjustment', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'Good',
        balance: 100_000,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: -0.01,
      },
    ]);
    const seg = result.segments[0];
    expect(seg.adjustedLossRate).toBe(0.01); // 0.02 - 0.01
    expect(seg.expectedLoss).toBeGreaterThan(0);
  });

  // ── WARM: cap lifetime loss at 100% ────────────────────────
  it('should cap lifetime loss rate at 1 (100%)', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'HighLoss',
        balance: 100_000,
        weightedAvgMaturity: 50,
        historicalLossRate: 0.5,
        lgd: 1.0,
        qualitativeAdj: 0.1,
      },
    ]);
    const seg = result.segments[0];
    expect(seg.expectedLoss).toBeLessThanOrEqual(100_000);
  });

  // ── Vintage: years > emergence pattern length ──────────────
  it('should use flat tail for years beyond emergence pattern', () => {
    const result = svc.calculateVintage([
      {
        segmentName: 'Long',
        balance: 100_000,
        weightedAvgMaturity: 10,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ]);
    const seg = result.segments[0];
    // Years = 10, emergence has 5 entries, 5 remaining years at 5%
    expect(seg.expectedLoss).toBeGreaterThan(0);
    expect(seg.allowanceRequired).toBeGreaterThan(0);
  });

  // ── Vintage: cumulative loss capped at 100% ────────────────
  it('should cap vintage cumulative loss at 100%', () => {
    const result = svc.calculateVintage([
      {
        segmentName: 'Extreme',
        balance: 100_000,
        weightedAvgMaturity: 30,
        historicalLossRate: 0.9,
        lgd: 1.0,
        qualitativeAdj: 0.1,
      },
    ]);
    const seg = result.segments[0];
    expect(seg.expectedLoss).toBeLessThanOrEqual(100_000);
  });

  // ── PD x LGD: scenario ordering ───────────────────────────
  it('PD x LGD scenario totals increase with scenario severity', () => {
    const result = svc.calculatePDxLGD(segments);
    const bd = result.macroScenarioBreakdown!;
    expect(bd.baseline).toBeLessThanOrEqual(bd.adverse);
    expect(bd.adverse).toBeLessThanOrEqual(bd.severelyAdverse);
  });

  // ── PD x LGD: weighted allowance is between baseline and severely adverse
  it('PD x LGD weighted allowance is between baseline and severely adverse', () => {
    const result = svc.calculatePDxLGD(segments);
    const bd = result.macroScenarioBreakdown!;
    expect(bd.weighted).toBeGreaterThanOrEqual(bd.baseline);
    expect(bd.weighted).toBeLessThanOrEqual(bd.severelyAdverse);
  });

  // ── PD x LGD: zero balance ─────────────────────────────────
  it('PD x LGD handles zero balance segments', () => {
    const result = svc.calculatePDxLGD([
      {
        segmentName: 'Empty',
        balance: 0,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ]);
    expect(result.totalBalance).toBe(0);
    expect(result.totalAllowance).toBe(0);
    expect(result.weightedCoverageRatio).toBe(0);
  });

  // ── Validation: clamp NaN and out-of-range values ──────────
  it('should sanitize NaN balance to 0', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'NaN',
        balance: NaN,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ]);
    expect(result.totalBalance).toBe(0);
  });

  it('should sanitize NaN historicalLossRate to 0', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'NaN',
        balance: 100_000,
        weightedAvgMaturity: 3,
        historicalLossRate: NaN,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ]);
    const seg = result.segments[0];
    expect(seg.historicalLossRate).toBe(0);
  });

  it('should clamp maturity to max 50 years', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'Long',
        balance: 100_000,
        weightedAvgMaturity: 100,
        historicalLossRate: 0.01,
        lgd: 0.5,
        qualitativeAdj: 0,
      },
    ]);
    // Should not crash and should use clamped maturity
    expect(result.segments[0].expectedLoss).toBeGreaterThanOrEqual(0);
  });

  it('should clamp qualitative adj to ±10%', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'Over',
        balance: 100_000,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: 0.5, // should be clamped to 0.1
      },
    ]);
    expect(result.segments[0].qualitativeAdj).toBe(0.1);
  });

  it('should clamp negative qualitative adj to -10%', () => {
    const result = svc.calculateWARM([
      {
        segmentName: 'Under',
        balance: 100_000,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
        lgd: 0.5,
        qualitativeAdj: -0.5, // should be clamped to -0.1
      },
    ]);
    expect(result.segments[0].qualitativeAdj).toBe(-0.1);
  });

  it('should default LGD to 0.5 when undefined', () => {
    const result = svc.calculatePDxLGD([
      {
        segmentName: 'NoLGD',
        balance: 100_000,
        weightedAvgMaturity: 3,
        historicalLossRate: 0.02,
      },
    ]);
    // With default LGD=0.5, allowance should be non-zero
    expect(result.totalAllowance).toBeGreaterThan(0);
  });

  // ── getCECLAnalysis: routing by methodology ────────────────
  describe('getCECLAnalysis', () => {
    it('uses demo segments when no segments exist', async () => {
      const result = await svc.getCECLAnalysis('inst-1');
      expect(result.methodology).toBe('WARM');
      expect(result.segments.length).toBeGreaterThan(0);
    });

    it('routes to vintage method when specified', async () => {
      const mockPrisma = {
        loanSegment: {
          findMany: jest.fn().mockResolvedValue([
            {
              segmentName: 'Loans',
              balance: 100_000,
              weightedAvgRate: 0.06,
              weightedAvgMaturity: 5,
              historicalLossRate: 0.02,
              lgd: 0.4,
              qualitativeAdj: 0,
            },
          ]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      } as any;
      const service = new CECLService(mockPrisma);
      const result = await service.getCECLAnalysis('inst-1', 'vintage');
      expect(result.methodology).toBe('Vintage');
    });

    it('routes to PD x LGD method when specified', async () => {
      const mockPrisma = {
        loanSegment: {
          findMany: jest.fn().mockResolvedValue([
            {
              segmentName: 'Loans',
              balance: 100_000,
              weightedAvgRate: 0.06,
              weightedAvgMaturity: 5,
              historicalLossRate: 0.02,
              lgd: 0.4,
              qualitativeAdj: 0,
            },
          ]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
      } as any;
      const service = new CECLService(mockPrisma);
      const result = await service.getCECLAnalysis('inst-1', 'pdlgd');
      expect(result.methodology).toBe('PD×LGD');
    });

    it('defaults to WARM when methodology is not specified', async () => {
      const result = await svc.getCECLAnalysis('inst-1');
      expect(result.methodology).toBe('WARM');
    });
  });

  // ── getCECLForecast ────────────────────────────────────────
  describe('getCECLForecast', () => {
    it('returns 8 quarterly projections', async () => {
      const result = await svc.getCECLForecast('inst-1');
      expect(result.quarters).toHaveLength(8);
    });

    it('returns totalProvision12M as sum of first 4 quarters', async () => {
      const result = await svc.getCECLForecast('inst-1');
      const sum4 = result.quarters.slice(0, 4).reduce((s, q) => s + q.provisionExpense, 0);
      expect(result.totalProvision12M).toBeCloseTo(sum4, 2);
    });

    it('each quarter has positive or zero provisionExpense', async () => {
      const result = await svc.getCECLForecast('inst-1');
      for (const q of result.quarters) {
        expect(q.provisionExpense).toBeGreaterThanOrEqual(0);
      }
    });

    it('each quarter has a label like Q1 YYYY', async () => {
      const result = await svc.getCECLForecast('inst-1');
      for (const q of result.quarters) {
        expect(q.quarter).toMatch(/^Q[1-4] \d{4}$/);
      }
    });
  });

  // ── importLoanSegments ─────────────────────────────────────
  describe('importLoanSegments', () => {
    it('deletes existing segments and creates new ones', async () => {
      const mockPrisma = {
        loanSegment: {
          findMany: jest.fn().mockResolvedValue([]),
          createMany: jest.fn().mockResolvedValue({ count: 2 }),
          deleteMany: jest.fn().mockResolvedValue({ count: 1 }),
        },
      } as any;
      const service = new CECLService(mockPrisma);

      const result = await service.importLoanSegments('inst-1', [
        {
          segmentName: 'Auto',
          balance: 50_000,
          weightedAvgRate: 0.06,
          weightedAvgMaturity: 4,
          historicalLossRate: 0.01,
        },
        {
          segmentName: 'Mortgage',
          balance: 100_000,
          weightedAvgRate: 0.05,
          weightedAvgMaturity: 15,
          historicalLossRate: 0.005,
          lgd: 0.3,
          qualitativeAdj: 0.001,
        },
      ]);

      expect(mockPrisma.loanSegment.deleteMany).toHaveBeenCalledWith({
        where: { institutionId: 'inst-1' },
      });
      expect(result.imported).toBe(2);
      expect(result.institutionId).toBe('inst-1');
    });
  });

  describe('getCECLAnalysis default methodology', () => {
    it('uses WARM when methodology is not vintage or pdlgd', async () => {
      const mockPrisma = {
        loanSegment: {
          findMany: jest.fn().mockResolvedValue([
            { segmentName: 'Consumer', balance: 100000, weightedAvgMaturity: 3, historicalLossRate: 0.02, lgd: 0.5, qualitativeAdj: 0.005 },
          ]),
          createMany: jest.fn(),
          deleteMany: jest.fn(),
        },
        institution: { findFirst: jest.fn().mockResolvedValue(null) },
      } as any;
      const service = new CECLService(mockPrisma);
      const result = await service.getCECLAnalysis('inst-1', 'unknown_method');
      expect(result).toHaveProperty('totalBalance');
      expect(result).toHaveProperty('totalAllowance');
    });
  });
});
