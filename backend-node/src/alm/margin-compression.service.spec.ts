import { MarginCompressionService } from './margin-compression.service';

describe('MarginCompressionService', () => {
  let service: MarginCompressionService;

  beforeEach(() => {
    service = new MarginCompressionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should detect compressing NIM trend', () => {
    const result = service.analyze({
      historicalNIM: [
        { quarter: '2025-Q1', nim: 0.035 },
        { quarter: '2025-Q2', nim: 0.034 },
        { quarter: '2025-Q3', nim: 0.033 },
        { quarter: '2025-Q4', nim: 0.031 },
        { quarter: '2026-Q1', nim: 0.029 },
      ],
      assetYield: 0.055,
      fundingCost: 0.026,
      competitorRates: { savingsRate: 0.03, loanRate: 0.05 },
    });

    expect(result.trend).toBe('compressing');
    expect(result.annualCompressionBps).toBeLessThan(0);
  });

  it('should detect expanding NIM trend', () => {
    const result = service.analyze({
      historicalNIM: [
        { quarter: '2025-Q1', nim: 0.03 },
        { quarter: '2025-Q2', nim: 0.031 },
        { quarter: '2025-Q3', nim: 0.033 },
        { quarter: '2025-Q4', nim: 0.035 },
        { quarter: '2026-Q1', nim: 0.038 },
      ],
      assetYield: 0.06,
      fundingCost: 0.022,
      competitorRates: { savingsRate: 0.025, loanRate: 0.055 },
    });

    expect(result.trend).toBe('expanding');
    expect(result.annualCompressionBps).toBeGreaterThan(0);
  });

  it('should detect stable NIM trend', () => {
    const result = service.analyze({
      historicalNIM: [
        { quarter: '2025-Q1', nim: 0.035 },
        { quarter: '2025-Q2', nim: 0.035 },
        { quarter: '2025-Q3', nim: 0.035 },
        { quarter: '2025-Q4', nim: 0.035 },
      ],
      assetYield: 0.055,
      fundingCost: 0.02,
      competitorRates: { savingsRate: 0.02, loanRate: 0.055 },
    });

    expect(result.trend).toBe('stable');
  });

  it('should project NIM 12 months forward', () => {
    const result = service.analyze({
      historicalNIM: [
        { quarter: '2025-Q1', nim: 0.035 },
        { quarter: '2025-Q2', nim: 0.034 },
      ],
      assetYield: 0.055,
      fundingCost: 0.021,
      competitorRates: { savingsRate: 0.025, loanRate: 0.05 },
    });

    expect(typeof result.projectedNIM12M).toBe('number');
    expect(result.projectedNIM12M).not.toBeNaN();
  });

  it('should provide bilingual interpretations', () => {
    const result = service.analyze({
      historicalNIM: [{ quarter: '2025-Q1', nim: 0.035 }],
      assetYield: 0.055,
      fundingCost: 0.02,
      competitorRates: { savingsRate: 0.02, loanRate: 0.055 },
    });

    expect(result.interpretation).toBeTruthy();
    expect(result.interpretationEs).toBeTruthy();
  });
});
