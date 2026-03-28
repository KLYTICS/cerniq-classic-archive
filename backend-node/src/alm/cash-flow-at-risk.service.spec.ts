import { CashFlowAtRiskService } from './cash-flow-at-risk.service';

describe('CashFlowAtRiskService', () => {
  let service: CashFlowAtRiskService;

  const cashFlows = [
    { period: 1, expected: 100_000, volatility: 10_000 },
    { period: 2, expected: 120_000, volatility: 15_000 },
    { period: 3, expected: 110_000, volatility: 12_000 },
    { period: 4, expected: 130_000, volatility: 18_000 },
  ];

  beforeEach(() => {
    service = new CashFlowAtRiskService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('CFaR should be positive', () => {
    const result = service.calculateCFaR({
      cashFlows,
      confidence: 0.95,
    });
    expect(result.cfar).toBeGreaterThan(0);
  });

  it('worst-case CF should be less than expected CF', () => {
    const result = service.calculateCFaR({
      cashFlows,
      confidence: 0.95,
    });
    expect(result.worstCaseCF).toBeLessThan(result.expectedCF);
  });

  it('expected CF should equal sum of period expected values', () => {
    const result = service.calculateCFaR({
      cashFlows,
      confidence: 0.95,
    });
    const manualSum = 100_000 + 120_000 + 110_000 + 130_000;
    expect(result.expectedCF).toBeCloseTo(manualSum, 0);
  });

  it('higher confidence should produce higher CFaR', () => {
    const cfar90 = service.calculateCFaR({ cashFlows, confidence: 0.90 });
    const cfar99 = service.calculateCFaR({ cashFlows, confidence: 0.99 });
    expect(cfar99.cfar).toBeGreaterThan(cfar90.cfar);
  });

  it('periods array should match number of cash flows', () => {
    const result = service.calculateCFaR({
      cashFlows,
      confidence: 0.95,
    });
    expect(result.periods).toHaveLength(4);
    expect(result.periods[0].period).toBe(1);
    expect(result.periods[3].period).toBe(4);
  });

  it('each period worst case should be less than expected', () => {
    const result = service.calculateCFaR({
      cashFlows,
      confidence: 0.95,
    });
    for (const period of result.periods) {
      expect(period.worstCase).toBeLessThan(period.expected);
    }
  });

  it('horizon parameter should limit periods included', () => {
    const full = service.calculateCFaR({ cashFlows, confidence: 0.95 });
    const partial = service.calculateCFaR({ cashFlows, confidence: 0.95, horizon: 2 });
    expect(partial.periods).toHaveLength(2);
    expect(partial.expectedCF).toBeLessThan(full.expectedCF);
    expect(partial.cfar).toBeLessThan(full.cfar);
  });

  it('correlated CFaR with identity matrix should equal independent CFaR', () => {
    const identity = [
      [1, 0, 0, 0],
      [0, 1, 0, 0],
      [0, 0, 1, 0],
      [0, 0, 0, 1],
    ];
    const result = service.calculateCorrelatedCFaR({
      cashFlows,
      correlationMatrix: identity,
    });
    expect(result.correlatedCFaR).toBeCloseTo(result.independentCFaR, 0);
  });
});
