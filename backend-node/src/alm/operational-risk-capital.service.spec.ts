import { OperationalRiskCapitalService } from './operational-risk-capital.service';

describe('OperationalRiskCapitalService', () => {
  let service: OperationalRiskCapitalService;

  beforeEach(() => {
    service = new OperationalRiskCapitalService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates BIA charge as 15% of average positive gross income', () => {
    const result = service.calculate([10_000_000, 12_000_000, 11_000_000]);
    const avg = (10_000_000 + 12_000_000 + 11_000_000) / 3;
    expect(result.avgGrossIncome).toBe(Math.round(avg));
    expect(result.capitalCharge).toBe(Math.round(avg * 0.15));
    expect(result.alpha).toBe(0.15);
    expect(result.interpretation).toContain('OpRisk capital');
    expect(result.interpretationEs).toContain('riesgo operacional');
  });

  it('excludes negative income years from average', () => {
    const result = service.calculate([-5_000_000, 10_000_000, 20_000_000]);
    // Only two positive years: avg = (10M + 20M) / 2 = 15M
    expect(result.avgGrossIncome).toBe(15_000_000);
    expect(result.capitalCharge).toBe(Math.round(15_000_000 * 0.15));
  });

  it('returns zero charge when all years are negative', () => {
    const result = service.calculate([-1_000_000, -2_000_000, -500_000]);
    expect(result.avgGrossIncome).toBe(0);
    expect(result.capitalCharge).toBe(0);
  });

  it('handles single positive year among zeros', () => {
    const result = service.calculate([0, 0, 6_000_000]);
    // 0 is not > 0, so only one positive year
    expect(result.avgGrossIncome).toBe(6_000_000);
    expect(result.capitalCharge).toBe(Math.round(6_000_000 * 0.15));
  });

  it('output shape has all required fields', () => {
    const result = service.calculate([1, 2, 3]);
    expect(typeof result.avgGrossIncome).toBe('number');
    expect(typeof result.capitalCharge).toBe('number');
    expect(typeof result.alpha).toBe('number');
    expect(typeof result.interpretation).toBe('string');
    expect(typeof result.interpretationEs).toBe('string');
  });
});
