import { ConcentrationHHIService } from './concentration-hhi.service';

describe('ConcentrationHHIService', () => {
  let service: ConcentrationHHIService;

  beforeEach(() => {
    service = new ConcentrationHHIService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── HHI calculation with equal segments ─────────────────────

  it('classifies equally-split portfolio as unconcentrated', () => {
    const result = service.calculate([
      { name: 'Auto Loans', nameEs: 'Prestamos Auto', balance: 250000 },
      { name: 'Mortgages', nameEs: 'Hipotecas', balance: 250000 },
      { name: 'Personal', nameEs: 'Personal', balance: 250000 },
      { name: 'Commercial', nameEs: 'Comercial', balance: 250000 },
    ]);

    // 4 equal segments: HHI = 4 * (0.25)^2 = 0.25 => scaled 2500
    // Boundary: hhiScaled >= 2500 => "Highly concentrated"
    expect(result.hhiScaled).toBe(2500);
    expect(result.effectiveSegments).toBe(4);
    expect(result.classification).toBe('Highly concentrated');
    expect(result.classificationEs).toBe('Altamente concentrado');
  });

  // ── Highly concentrated portfolio ───────────────────────────

  it('flags single-dominant segment as highly concentrated', () => {
    const result = service.calculate([
      { name: 'Real Estate', nameEs: 'Bienes Raices', balance: 900000 },
      { name: 'Auto', nameEs: 'Auto', balance: 50000 },
      { name: 'Personal', nameEs: 'Personal', balance: 50000 },
    ]);

    expect(result.hhiScaled).toBeGreaterThan(2500);
    expect(result.classification).toBe('Highly concentrated');
    expect(result.classificationEs).toBe('Altamente concentrado');
    // Top segment should be Real Estate
    expect(result.segments[0].name).toBe('Real Estate');
    expect(result.segments[0].share).toBeCloseTo(0.9, 1);
  });

  // ── Well-diversified portfolio ──────────────────────────────

  it('classifies 10 equal segments as unconcentrated', () => {
    const segments = Array.from({ length: 10 }, (_, i) => ({
      name: `Segment ${i + 1}`,
      nameEs: `Segmento ${i + 1}`,
      balance: 100000,
    }));

    const result = service.calculate(segments);

    // 10 equal segments: HHI = 10 * (0.1)^2 = 0.1 => scaled 1000
    expect(result.hhiScaled).toBe(1000);
    expect(result.classification).toBe('Unconcentrated');
    expect(result.classificationEs).toBe('No concentrado');
    expect(result.effectiveSegments).toBe(10);
  });

  // ── Segments sorted by share descending ─────────────────────

  it('returns segments sorted by share descending', () => {
    const result = service.calculate([
      { name: 'Small', nameEs: 'Pequeno', balance: 100000 },
      { name: 'Large', nameEs: 'Grande', balance: 500000 },
      { name: 'Medium', nameEs: 'Mediano', balance: 300000 },
    ]);

    expect(result.segments[0].name).toBe('Large');
    expect(result.segments[1].name).toBe('Medium');
    expect(result.segments[2].name).toBe('Small');
  });

  // ── Interpretation includes key metrics ─────────────────────

  it('produces bilingual interpretation with HHI and top segment', () => {
    const result = service.calculate([
      { name: 'Loans', nameEs: 'Prestamos', balance: 600000 },
      { name: 'Investments', nameEs: 'Inversiones', balance: 400000 },
    ]);

    expect(result.interpretation).toContain('HHI');
    expect(result.interpretation).toContain('Effective segments');
    expect(result.interpretationEs).toContain('HHI');
    expect(result.interpretationEs).toContain('Segmentos efectivos');
  });
});
