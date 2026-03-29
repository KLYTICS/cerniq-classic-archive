import { FundingConcentrationService } from './funding-concentration.service';

describe('FundingConcentrationService', () => {
  let service: FundingConcentrationService;

  beforeEach(() => {
    service = new FundingConcentrationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Flags sources exceeding 5% threshold ────────────────────

  it('flags funding sources above 5% of total funding', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Core Deposits', nameEs: 'Depositos Base', amount: 600000, type: 'retail' },
        { name: 'FHLB Borrowing', nameEs: 'Prestamo FHLB', amount: 250000, type: 'wholesale' },
        { name: 'Brokered CDs', nameEs: 'CDs Intermediados', amount: 150000, type: 'brokered' },
      ],
      totalFunding: 1000000,
    });

    // All three sources are >5%, so all should be flagged
    expect(result.concentrationFlags).toHaveLength(3);
    // Core Deposits at 60% should be HIGH concentration risk
    const coreFlag = result.concentrationFlags.find((f) => f.source === 'Core Deposits');
    expect(coreFlag).toBeDefined();
    expect(coreFlag!.flag).toContain('HIGH');
    expect(coreFlag!.pct).toBe(60);
  });

  // ── Does not flag small sources ─────────────────────────────

  it('does not flag sources at or below 5%', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Large Source', nameEs: 'Fuente Grande', amount: 900000, type: 'retail' },
        { name: 'Small Source', nameEs: 'Fuente Pequena', amount: 40000, type: 'wholesale' },
        { name: 'Tiny Source', nameEs: 'Fuente Minima', amount: 10000, type: 'brokered' },
      ],
      totalFunding: 1000000,
    });

    // Only the large source (90%) should be flagged
    expect(result.concentrationFlags).toHaveLength(1);
    expect(result.concentrationFlags[0].source).toBe('Large Source');
  });

  // ── Type breakdown percentages ──────────────────────────────

  it('computes correct funding type breakdown', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Retail A', nameEs: 'Minorista A', amount: 400000, type: 'retail' },
        { name: 'Retail B', nameEs: 'Minorista B', amount: 200000, type: 'retail' },
        { name: 'Wholesale', nameEs: 'Mayorista', amount: 300000, type: 'wholesale' },
        { name: 'Brokered', nameEs: 'Intermediado', amount: 100000, type: 'brokered' },
      ],
      totalFunding: 1000000,
    });

    expect(result.retailPct).toBe(60);
    expect(result.wholesalePct).toBe(30);
    expect(result.brokeredPct).toBe(10);
    expect(result.largestSourcePct).toBe(40);
  });

  // ── Diversification score: well-diversified vs concentrated ──

  it('gives higher diversification score to well-diversified portfolio', () => {
    const diversified = service.analyze({
      fundingSources: [
        { name: 'A', nameEs: 'A', amount: 250000, type: 'retail' },
        { name: 'B', nameEs: 'B', amount: 250000, type: 'wholesale' },
        { name: 'C', nameEs: 'C', amount: 250000, type: 'government' },
        { name: 'D', nameEs: 'D', amount: 250000, type: 'brokered' },
      ],
      totalFunding: 1000000,
    });

    const concentrated = service.analyze({
      fundingSources: [
        { name: 'Dominant', nameEs: 'Dominante', amount: 950000, type: 'retail' },
        { name: 'Minor', nameEs: 'Menor', amount: 50000, type: 'wholesale' },
      ],
      totalFunding: 1000000,
    });

    expect(diversified.diversificationScore).toBeGreaterThan(concentrated.diversificationScore);
  });

  // ── Bilingual output ────────────────────────────────────────

  it('produces bilingual interpretation and flag labels', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Core', nameEs: 'Base', amount: 800000, type: 'retail' },
        { name: 'Wholesale', nameEs: 'Mayorista', amount: 200000, type: 'wholesale' },
      ],
      totalFunding: 1000000,
    });

    expect(result.interpretation).toContain('Retail');
    expect(result.interpretation).toContain('Diversification');
    expect(result.interpretationEs).toContain('Minorista');
    expect(result.interpretationEs).toContain('Diversificacion');
    // Check Spanish flag labels
    const coreFlag = result.concentrationFlags.find((f) => f.source === 'Core');
    expect(coreFlag!.flagEs).toBeTruthy();
  });
});
