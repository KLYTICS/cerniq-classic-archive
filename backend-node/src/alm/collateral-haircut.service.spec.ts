import { CollateralHaircutService } from './collateral-haircut.service';

describe('CollateralHaircutService', () => {
  let service: CollateralHaircutService;

  beforeEach(() => {
    service = new CollateralHaircutService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Zero haircut for cash and treasury bills ────────────────

  it('applies 0% haircut to cash and treasury bills', () => {
    const result = service.calculate([
      { type: 'Cash', typeEs: 'Efectivo', marketValue: 5000000 },
      {
        type: 'Treasury Bill',
        typeEs: 'Letra del Tesoro',
        marketValue: 3000000,
      },
    ]);

    expect(result.assets[0].haircut).toBe(0);
    expect(result.assets[0].pledgeableValue).toBe(5000000);
    expect(result.assets[1].haircut).toBe(0);
    expect(result.assets[1].pledgeableValue).toBe(3000000);
    expect(result.avgHaircut).toBe(0);
    expect(result.totalPledgeable).toBe(result.totalMarketValue);
  });

  // ── Treasury/government securities haircuts by maturity ─────

  it('applies higher haircut to long-maturity government bonds', () => {
    const result = service.calculate([
      {
        type: 'Treasury Bond',
        typeEs: 'Bono del Tesoro',
        marketValue: 1000000,
        maturityYears: 5,
      },
      {
        type: 'Government Bond',
        typeEs: 'Bono Gobierno',
        marketValue: 1000000,
        maturityYears: 15,
      },
    ]);

    expect(result.assets[0].haircut).toBe(2); // short maturity
    expect(result.assets[1].haircut).toBe(4); // long maturity (>10yr)
  });

  // ── Corporate bonds vary by credit rating ───────────────────

  it('applies rating-based haircuts to corporate bonds', () => {
    const result = service.calculate([
      {
        type: 'Corporate Bond',
        typeEs: 'Bono Corporativo',
        marketValue: 1000000,
        creditRating: 'AAA',
      },
      {
        type: 'Corporate Bond',
        typeEs: 'Bono Corporativo',
        marketValue: 1000000,
        creditRating: 'AA',
      },
      {
        type: 'Corporate Bond',
        typeEs: 'Bono Corporativo',
        marketValue: 1000000,
        creditRating: 'BBB',
      },
    ]);

    expect(result.assets[0].haircut).toBe(8); // AAA
    expect(result.assets[1].haircut).toBe(12); // AA
    expect(result.assets[2].haircut).toBe(20); // BBB (default)
  });

  // ── Equity gets highest haircut ─────────────────────────────

  it('applies 25% haircut to equity positions', () => {
    const result = service.calculate([
      { type: 'Equity', typeEs: 'Acciones', marketValue: 2000000 },
    ]);

    expect(result.assets[0].haircut).toBe(25);
    expect(result.assets[0].pledgeableValue).toBe(1500000);
  });

  // ── Average haircut and totals computed correctly ────────────

  it('computes correct totals and weighted average haircut', () => {
    const result = service.calculate([
      { type: 'Cash', typeEs: 'Efectivo', marketValue: 5000000 },
      {
        type: 'Agency MBS',
        typeEs: 'MBS Agencia',
        marketValue: 5000000,
        maturityYears: 7,
      },
    ]);

    expect(result.totalMarketValue).toBe(10000000);
    // Cash: 0% haircut => 5M pledgeable; MBS: 5% haircut => 4.75M pledgeable
    expect(result.totalPledgeable).toBe(9750000);
    expect(result.avgHaircut).toBe(2.5);
    expect(result.interpretation).toContain('$10M');
    expect(result.interpretationEs).toContain('$10M');
  });
});
