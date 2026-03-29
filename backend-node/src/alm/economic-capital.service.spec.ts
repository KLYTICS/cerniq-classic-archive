import { EconomicCapitalService } from './economic-capital.service';

describe('EconomicCapitalService', () => {
  let service: EconomicCapitalService;

  beforeEach(() => {
    service = new EconomicCapitalService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate diversified EC with default correlation', () => {
    const result = service.calculate({
      creditRiskCapital: 5_000_000,
      marketRiskCapital: 2_000_000,
      operationalRiskCapital: 1_000_000,
      concentrationAddOn: 500_000,
      totalAssets: 200_000_000,
      regulatoryCapital: 20_000_000,
    });

    expect(result.diversifiedEC).toBeLessThan(result.undiversifiedEC);
    expect(result.diversificationBenefit).toBeGreaterThan(0);
    expect(result.components.length).toBe(4);
    expect(result.capitalAdequacy).toBeGreaterThan(0);
  });

  it('should show surplus when regulatory capital exceeds EC', () => {
    const result = service.calculate({
      creditRiskCapital: 1_000_000,
      marketRiskCapital: 500_000,
      operationalRiskCapital: 300_000,
      concentrationAddOn: 100_000,
      totalAssets: 100_000_000,
      regulatoryCapital: 10_000_000,
    });

    expect(result.surplus).toBeGreaterThan(0);
    expect(result.interpretation).toContain('Surplus');
  });

  it('should show shortfall when EC exceeds regulatory capital', () => {
    const result = service.calculate({
      creditRiskCapital: 15_000_000,
      marketRiskCapital: 8_000_000,
      operationalRiskCapital: 5_000_000,
      concentrationAddOn: 2_000_000,
      totalAssets: 200_000_000,
      regulatoryCapital: 10_000_000,
    });

    expect(result.surplus).toBeLessThan(0);
    expect(result.interpretation).toContain('Shortfall');
  });

  it('should support custom correlation matrix', () => {
    const highCorr = [
      [1.0, 0.8, 0.8],
      [0.8, 1.0, 0.8],
      [0.8, 0.8, 1.0],
    ];
    const result = service.calculate({
      creditRiskCapital: 5_000_000,
      marketRiskCapital: 2_000_000,
      operationalRiskCapital: 1_000_000,
      concentrationAddOn: 500_000,
      totalAssets: 200_000_000,
      regulatoryCapital: 20_000_000,
      correlationMatrix: highCorr,
    });

    // High correlation means less diversification benefit
    expect(result.diversificationBenefit).toBeGreaterThan(0);
  });

  it('should provide bilingual interpretations', () => {
    const result = service.calculate({
      creditRiskCapital: 5_000_000,
      marketRiskCapital: 2_000_000,
      operationalRiskCapital: 1_000_000,
      concentrationAddOn: 500_000,
      totalAssets: 200_000_000,
      regulatoryCapital: 20_000_000,
    });

    expect(result.interpretation).toBeTruthy();
    expect(result.interpretationEs).toBeTruthy();
    expect(result.interpretationEs).toContain('Capital economico');
  });
});
