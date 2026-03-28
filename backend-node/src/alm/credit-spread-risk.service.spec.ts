import { CreditSpreadRiskService } from './credit-spread-risk.service';

describe('CreditSpreadRiskService', () => {
  let service: CreditSpreadRiskService;

  beforeEach(() => {
    service = new CreditSpreadRiskService();
  });

  const portfolio = [
    {
      name: 'US Treasury 5Y',
      balance: 20_000_000,
      spread: 0.005,
      duration: 4.5,
    },
    {
      name: 'Corp Bond AAA',
      balance: 10_000_000,
      spread: 0.012,
      duration: 6.0,
    },
    { name: 'MBS Pool', balance: 15_000_000, spread: 0.018, duration: 3.2 },
  ];

  it('calculates total exposure', () => {
    const r = service.calculate({ bondPortfolio: portfolio });
    expect(r.totalExposure).toBe(45_000_000);
  });

  it('calculates weighted portfolio duration', () => {
    const r = service.calculate({ bondPortfolio: portfolio });
    // (20M*4.5 + 10M*6.0 + 15M*3.2) / 45M = (90+60+48)/45 = 4.4
    expect(r.portfolioDuration).toBeCloseTo(4.4, 1);
  });

  it('calculates CS01 (dollar value of 1bp spread change)', () => {
    const r = service.calculate({ bondPortfolio: portfolio });
    // CS01 = 45M * 4.4 / 10000 ≈ 19,800
    expect(r.cs01).toBeGreaterThan(15_000);
    expect(r.cs01).toBeLessThan(25_000);
  });

  it('defaults to 100bp shock', () => {
    const r = service.calculate({ bondPortfolio: portfolio });
    expect(r.stressLoss).toBe(r.cs01 * 100);
  });

  it('applies custom shock', () => {
    const r100 = service.calculate({ bondPortfolio: portfolio, shockBps: 100 });
    const r200 = service.calculate({ bondPortfolio: portfolio, shockBps: 200 });
    expect(r200.stressLoss).toBe(r100.stressLoss * 2);
  });

  it('provides bilingual interpretation with CS01 and stress loss', () => {
    const r = service.calculate({ bondPortfolio: portfolio });
    expect(r.interpretation).toContain('CS01');
    expect(r.interpretation).toContain('stress loss');
    expect(r.interpretationEs).toContain('CS01');
    expect(r.interpretationEs).toContain('Perdida estres');
  });
});
