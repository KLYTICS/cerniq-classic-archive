import { CreditVarService } from './credit-var.service';

describe('CreditVarService', () => {
  let service: CreditVarService;

  const sampleExposures = [
    { name: 'Loan A', balance: 1_000_000, pd: 0.02, lgd: 0.45 },
    { name: 'Loan B', balance: 500_000, pd: 0.05, lgd: 0.6 },
    { name: 'Loan C', balance: 750_000, pd: 0.01, lgd: 0.35 },
  ];

  beforeEach(() => {
    service = new CreditVarService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('Credit VaR should be positive for risky portfolio', () => {
    const result = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.99,
    });
    expect(result.creditVaR).toBeGreaterThan(0);
    expect(result.unexpectedLoss).toBeGreaterThan(0);
  });

  it('expected loss should equal sum of EAD * LGD * PD', () => {
    const result = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.99,
    });
    const manualEL =
      1_000_000 * 0.45 * 0.02 + 500_000 * 0.6 * 0.05 + 750_000 * 0.35 * 0.01;
    expect(result.expectedLoss).toBeCloseTo(manualEL, 0);
  });

  it('higher confidence should produce higher Credit VaR', () => {
    const var95 = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.95,
    });
    const var99 = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.99,
    });
    expect(var99.creditVaR).toBeGreaterThan(var95.creditVaR);
  });

  it('contributions should sum to total Credit VaR', () => {
    const result = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.99,
    });
    const sumContributions = result.contributions.reduce(
      (s, c) => s + c.contribution,
      0,
    );
    expect(sumContributions).toBeCloseTo(result.creditVaR, 0);
  });

  it('zero PD exposures should have zero contribution', () => {
    const zeroRisk = [{ name: 'Safe', balance: 1_000_000, pd: 0, lgd: 0.45 }];
    const result = service.calculateCreditVaR({
      exposures: zeroRisk,
      confidence: 0.99,
    });
    expect(result.creditVaR).toBe(0);
    expect(result.expectedLoss).toBe(0);
  });

  it('longer horizon should increase expected loss', () => {
    const el1 = service.computeExpectedLoss(sampleExposures, 1);
    const el3 = service.computeExpectedLoss(sampleExposures, 3);
    expect(el3).toBeGreaterThan(el1);
  });

  it('higher asset correlation should increase Credit VaR', () => {
    const lowCorr = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.99,
      assetCorrelation: 0.05,
    });
    const highCorr = service.calculateCreditVaR({
      exposures: sampleExposures,
      confidence: 0.99,
      assetCorrelation: 0.25,
    });
    expect(highCorr.creditVaR).toBeGreaterThan(lowCorr.creditVaR);
  });
});
