import { LoanPricingEngineService } from './loan-pricing-engine.service';

describe('LoanPricingEngineService', () => {
  let service: LoanPricingEngineService;

  const baseParams = {
    principal: 500_000,
    maturityYears: 5,
    costOfFunds: 0.035,
    creditSpread: 0.015,
    operatingCost: 0.005,
    targetROE: 0.12,
    capitalRequirement: 0.08,
  };

  beforeEach(() => {
    service = new LoanPricingEngineService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('minimum rate should equal sum of components', () => {
    const result = service.priceLoan(baseParams);
    const expectedRate =
      baseParams.costOfFunds +
      baseParams.creditSpread +
      baseParams.operatingCost +
      baseParams.targetROE * baseParams.capitalRequirement;
    expect(result.minimumRate).toBeCloseTo(expectedRate, 4);
  });

  it('breakdown components should sum to minimum rate', () => {
    const result = service.priceLoan(baseParams);
    const sum =
      result.breakdown.costOfFunds +
      result.breakdown.creditSpread +
      result.breakdown.operatingCost +
      result.breakdown.capitalCharge;
    expect(sum).toBeCloseTo(result.minimumRate, 4);
  });

  it('monthly payment should be positive', () => {
    const result = service.priceLoan(baseParams);
    expect(result.monthlyPayment).toBeGreaterThan(0);
  });

  it('total payment should exceed principal', () => {
    const result = service.priceLoan(baseParams);
    expect(result.totalPayment).toBeGreaterThan(baseParams.principal);
    expect(result.totalInterest).toBeGreaterThan(0);
  });

  it('higher credit spread should increase minimum rate', () => {
    const lowSpread = service.priceLoan({ ...baseParams, creditSpread: 0.01 });
    const highSpread = service.priceLoan({ ...baseParams, creditSpread: 0.03 });
    expect(highSpread.minimumRate).toBeGreaterThan(lowSpread.minimumRate);
  });

  it('higher target ROE should increase minimum rate', () => {
    const lowROE = service.priceLoan({ ...baseParams, targetROE: 0.08 });
    const highROE = service.priceLoan({ ...baseParams, targetROE: 0.2 });
    expect(highROE.minimumRate).toBeGreaterThan(lowROE.minimumRate);
  });

  it('compare scenarios should return results for each scenario', () => {
    const results = service.compareScenarios({
      principal: 500_000,
      maturityYears: 5,
      scenarios: [
        {
          name: 'Base',
          costOfFunds: 0.035,
          creditSpread: 0.015,
          operatingCost: 0.005,
          targetROE: 0.12,
          capitalRequirement: 0.08,
        },
        {
          name: 'Stress',
          costOfFunds: 0.05,
          creditSpread: 0.03,
          operatingCost: 0.005,
          targetROE: 0.12,
          capitalRequirement: 0.08,
        },
      ],
    });
    expect(results).toHaveLength(2);
    expect(results[1].minimumRate).toBeGreaterThan(results[0].minimumRate);
  });

  it('RAROC should be positive when rate exceeds costs', () => {
    const result = service.computeRAROC({
      principal: 500_000,
      loanRate: 0.08,
      costOfFunds: 0.035,
      operatingCost: 0.005,
      expectedLossRate: 0.01,
      capitalRequirement: 0.08,
    });
    expect(result.raroc).toBeGreaterThan(0);
  });
});
