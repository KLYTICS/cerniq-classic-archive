import { CounterpartyExposureService } from './counterparty-exposure.service';

describe('CounterpartyExposureService', () => {
  let service: CounterpartyExposureService;

  beforeEach(() => {
    service = new CounterpartyExposureService();
  });

  const totalAssets = 100_000_000;
  const counterparties = [
    {
      name: 'Banco Popular',
      exposure: 8_000_000,
      sector: 'Banking',
      rating: 'A',
    },
    {
      name: 'First BanCorp',
      exposure: 6_000_000,
      sector: 'Banking',
      rating: 'BBB',
    },
    { name: 'Gobierno de PR', exposure: 12_000_000, sector: 'Government' },
    { name: 'PREPA', exposure: 3_000_000, sector: 'Utilities', rating: 'BB' },
    { name: 'Small Corp', exposure: 1_000_000, sector: 'Corporate' },
  ];

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculates pctOfAssets correctly', () => {
    const result = service.analyze(counterparties, totalAssets);
    const gov = result.counterparties.find((c) => c.name === 'Gobierno de PR');
    expect(gov).toBeDefined();
    expect(gov!.pctOfAssets).toBe(12);
  });

  it('flags counterparties exceeding 5% threshold', () => {
    const result = service.analyze(counterparties, totalAssets);
    const flagged = result.counterparties.filter((c) => c.flag);
    expect(flagged.length).toBe(3); // Gobierno 12%, Banco Popular 8%, First BanCorp 6%
    expect(flagged.every((c) => c.pctOfAssets > 5)).toBe(true);
  });

  it('does not flag counterparties below 5%', () => {
    const result = service.analyze(counterparties, totalAssets);
    const prepa = result.counterparties.find((c) => c.name === 'PREPA');
    expect(prepa!.flag).toBe(false);
    const small = result.counterparties.find((c) => c.name === 'Small Corp');
    expect(small!.flag).toBe(false);
  });

  it('sorts by exposure descending', () => {
    const result = service.analyze(counterparties, totalAssets);
    for (let i = 1; i < result.counterparties.length; i++) {
      expect(result.counterparties[i].exposure).toBeLessThanOrEqual(
        result.counterparties[i - 1].exposure,
      );
    }
  });

  it('returns top 5 concentrations', () => {
    const result = service.analyze(counterparties, totalAssets);
    expect(result.topConcentrations.length).toBeLessThanOrEqual(5);
    expect(result.topConcentrations[0].name).toBe('Gobierno de PR');
    expect(result.topConcentrations[0].pct).toBe(12);
  });

  it('computes sector concentrations', () => {
    const result = service.analyze(counterparties, totalAssets);
    expect(result.sectorConcentrations['Banking']).toBe(14); // 8% + 6%
    expect(result.sectorConcentrations['Government']).toBe(12);
  });

  it('provides bilingual interpretation', () => {
    const result = service.analyze(counterparties, totalAssets);
    expect(result.interpretation).toContain('3 counterparties exceed');
    expect(result.interpretation).toContain('Gobierno de PR');
    expect(result.interpretationEs).toContain('3 contrapartes exceden');
  });

  it('handles empty counterparty list', () => {
    const result = service.analyze([], totalAssets);
    expect(result.counterparties).toHaveLength(0);
    expect(result.topConcentrations).toHaveLength(0);
  });
});
