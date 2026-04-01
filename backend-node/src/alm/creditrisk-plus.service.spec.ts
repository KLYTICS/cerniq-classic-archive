import { CreditRiskPlusService } from './creditrisk-plus.service';

describe('CreditRiskPlusService', () => {
  const svc = new CreditRiskPlusService();

  const baseParams = {
    segments: [
      {
        name: 'Consumer',
        nameEs: 'Consumo',
        exposure: 100_000_000,
        pd: 0.02,
        lgd: 0.5,
        count: 5000,
      },
      {
        name: 'Commercial',
        nameEs: 'Comercial',
        exposure: 150_000_000,
        pd: 0.01,
        lgd: 0.4,
        count: 200,
      },
      {
        name: 'Mortgage',
        nameEs: 'Hipoteca',
        exposure: 200_000_000,
        pd: 0.005,
        lgd: 0.25,
        count: 3000,
      },
    ],
  };

  it('should return correct output shape', () => {
    const result = svc.analyze(baseParams);
    expect(result).toHaveProperty('expectedLoss');
    expect(result).toHaveProperty('unexpectedLoss');
    expect(result).toHaveProperty('economicCapital');
    expect(result).toHaveProperty('lossDistribution');
    expect(result).toHaveProperty('sectorContributions');
    expect(result).toHaveProperty('var99');
    expect(result).toHaveProperty('var999');
    expect(result).toHaveProperty('interpretation');
    expect(result).toHaveProperty('interpretationEs');
  });

  it('should compute expected loss as sum of PD * LGD * EAD', () => {
    const result = svc.analyze(baseParams);
    // Consumer: 100M * 0.02 * 0.5 = 1M
    // Commercial: 150M * 0.01 * 0.4 = 0.6M
    // Mortgage: 200M * 0.005 * 0.25 = 0.25M
    // Total = 1.85M
    expect(result.expectedLoss).toBeCloseTo(1_850_000, -4);
  });

  it('should have VaR999 >= VaR99', () => {
    const result = svc.analyze(baseParams);
    expect(result.var999).toBeGreaterThanOrEqual(result.var99);
  });

  it('should have sector contributions summing to ~1', () => {
    const result = svc.analyze(baseParams);
    const totalContrib = result.sectorContributions.reduce(
      (s, c) => s + c.contribution,
      0,
    );
    expect(totalContrib).toBeCloseTo(1, 1);
  });

  it('should produce a loss distribution with cumulative reaching 1', () => {
    const result = svc.analyze(baseParams);
    expect(result.lossDistribution.length).toBeGreaterThan(0);
    const lastCum =
      result.lossDistribution[result.lossDistribution.length - 1].cumulative;
    expect(lastCum).toBeCloseTo(1, 1);
  });

  it('findVaR falls back to last entry when cumulative never reaches level', () => {
    // Use very small exposure so distribution does not reach 0.999
    const tinyParams = {
      segments: [
        { name: 'Micro', nameEs: 'Micro', exposure: 1, pd: 0.0001, lgd: 0.01, count: 1 },
      ],
      confidenceLevel: 0.999,
    };
    const result = svc.analyze(tinyParams);
    // var999 should still be a valid number (falls back to last entry or 0)
    expect(typeof result.var999).toBe('number');
  });
});
