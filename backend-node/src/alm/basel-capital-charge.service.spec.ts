import { BaselCapitalChargeService } from './basel-capital-charge.service';

describe('BaselCapitalChargeService', () => {
  let service: BaselCapitalChargeService;

  beforeEach(() => {
    service = new BaselCapitalChargeService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates RWA and capital charge for typical exposures', () => {
    const result = service.calculate([
      { assetClass: 'Sovereign', assetClassEs: 'Soberano', balance: 1000000, riskWeight: 0 },
      { assetClass: 'Corporate', assetClassEs: 'Corporativo', balance: 500000, riskWeight: 100 },
      { assetClass: 'Retail', assetClassEs: 'Minorista', balance: 300000, riskWeight: 75 },
    ]);

    expect(result.rwa).toBe(500000 + 225000); // 0 + 500000 + 225000
    expect(result.capitalCharge).toBe(Math.round((500000 + 225000) * 0.08));
    expect(result.breakdown).toHaveLength(3);
    expect(result.interpretation).toContain('RWA');
    expect(result.interpretationEs).toContain('APR');
  });

  it('zero risk-weight sovereign produces no charge', () => {
    const result = service.calculate([
      { assetClass: 'Sovereign', assetClassEs: 'Soberano', balance: 1_000_000_000, riskWeight: 0 },
    ]);

    expect(result.rwa).toBe(0);
    expect(result.capitalCharge).toBe(0);
    expect(result.breakdown[0].rwa).toBe(0);
  });

  it('breakdown matches totals', () => {
    const result = service.calculate([
      { assetClass: 'A', assetClassEs: 'A', balance: 200000, riskWeight: 50 },
      { assetClass: 'B', assetClassEs: 'B', balance: 400000, riskWeight: 100 },
    ]);

    const sumRWA = result.breakdown.reduce((s, b) => s + b.rwa, 0);
    expect(result.rwa).toBe(sumRWA);
  });

  it('capitalRatio8Pct reflects effective capital requirement pct', () => {
    const result = service.calculate([
      { assetClass: 'X', assetClassEs: 'X', balance: 1000, riskWeight: 100 },
    ]);
    // RWA = 1000*100/100 = 1000. capitalCharge = 80. pct = 80/1000*100 = 8
    expect(result.capitalRatio8Pct).toBeCloseTo(8.0, 1);
  });

  it('handles empty exposure array', () => {
    const result = service.calculate([]);
    expect(result.rwa).toBe(0);
    expect(result.capitalCharge).toBe(0);
    expect(result.breakdown).toHaveLength(0);
  });
});
