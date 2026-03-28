import { FundingConcentrationService } from './funding-concentration.service';

describe('FundingConcentrationService', () => {
  let service: FundingConcentrationService;

  beforeEach(() => {
    service = new FundingConcentrationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('flags sources exceeding 5% of total funding', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Big Corp', nameEs: 'Gran Corp', amount: 12_000_000, type: 'wholesale' },
        { name: 'Retail Pool', nameEs: 'Pool Minorista', amount: 80_000_000, type: 'retail' },
        { name: 'Gov Fund', nameEs: 'Fondo Gov', amount: 8_000_000, type: 'government' },
      ],
      totalFunding: 100_000_000,
    });

    expect(result.concentrationFlags).toHaveLength(3); // Retail 80%, Big Corp 12%, Gov Fund 8%
    const bigCorp = result.concentrationFlags.find((f) => f.source === 'Big Corp');
    expect(bigCorp).toBeDefined();
    expect(bigCorp!.pct).toBeCloseTo(12.0, 1);
    expect(bigCorp!.flag).toContain('HIGH');
  });

  it('computes diversification score from HHI', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'A', nameEs: 'A', amount: 25, type: 'retail' },
        { name: 'B', nameEs: 'B', amount: 25, type: 'retail' },
        { name: 'C', nameEs: 'C', amount: 25, type: 'wholesale' },
        { name: 'D', nameEs: 'D', amount: 25, type: 'government' },
      ],
      totalFunding: 100,
    });

    // Equal distribution -> high diversification
    expect(result.diversificationScore).toBeGreaterThan(60);
  });

  it('returns correct type percentages', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Retail', nameEs: 'Minorista', amount: 60, type: 'retail' },
        { name: 'Wholesale', nameEs: 'Mayorista', amount: 30, type: 'wholesale' },
        { name: 'Brokered', nameEs: 'Intermediado', amount: 10, type: 'brokered' },
      ],
      totalFunding: 100,
    });

    expect(result.retailPct).toBeCloseTo(60, 0);
    expect(result.wholesalePct).toBeCloseTo(30, 0);
    expect(result.brokeredPct).toBeCloseTo(10, 0);
  });

  it('identifies largest source correctly', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Small', nameEs: 'Pequeno', amount: 10, type: 'retail' },
        { name: 'Large', nameEs: 'Grande', amount: 90, type: 'wholesale' },
      ],
      totalFunding: 100,
    });

    expect(result.largestSourcePct).toBeCloseTo(90, 0);
  });

  it('generates bilingual interpretation', () => {
    const result = service.analyze({
      fundingSources: [
        { name: 'Source A', nameEs: 'Fuente A', amount: 100, type: 'retail' },
      ],
      totalFunding: 100,
    });

    expect(result.interpretation).toContain('concentration');
    expect(result.interpretationEs).toContain('concentracion');
  });
});
