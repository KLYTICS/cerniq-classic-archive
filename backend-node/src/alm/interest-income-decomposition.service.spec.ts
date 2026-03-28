import { InterestIncomeDecompositionService } from './interest-income-decomposition.service';

describe('InterestIncomeDecompositionService', () => {
  let service: InterestIncomeDecompositionService;

  beforeEach(() => {
    service = new InterestIncomeDecompositionService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('decomposes NII change into volume, rate, and mix effects', () => {
    const result = service.decompose({
      segments: [
        {
          name: 'Mortgages',
          nameEs: 'Hipotecas',
          prevBalance: 1_000_000,
          currBalance: 1_100_000,
          prevRate: 0.05,
          currRate: 0.055,
        },
      ],
    });

    // Volume effect: deltaV * prevRate = 100,000 * 0.05 = 5,000
    expect(result.volumeEffect).toBeCloseTo(5_000, 0);
    // Rate effect: prevBalance * deltaR = 1,000,000 * 0.005 = 5,000
    expect(result.rateEffect).toBeCloseTo(5_000, 0);
    // Mix effect: deltaV * deltaR = 100,000 * 0.005 = 500
    expect(result.mixEffect).toBeCloseTo(500, 0);
    // Total = 10,500
    expect(result.totalNIIChange).toBeCloseTo(10_500, 0);
  });

  it('handles volume decrease correctly', () => {
    const result = service.decompose({
      segments: [
        {
          name: 'Auto Loans',
          nameEs: 'Prestamos Auto',
          prevBalance: 500_000,
          currBalance: 400_000,
          prevRate: 0.06,
          currRate: 0.06,
        },
      ],
    });

    // Rate didn't change -> rate effect = 0, mix = 0
    expect(result.rateEffect).toBeCloseTo(0, 2);
    expect(result.mixEffect).toBeCloseTo(0, 2);
    // Volume effect: -100,000 * 0.06 = -6,000
    expect(result.volumeEffect).toBeCloseTo(-6_000, 0);
    expect(result.totalNIIChange).toBeCloseTo(-6_000, 0);
  });

  it('aggregates multiple segments', () => {
    const result = service.decompose({
      segments: [
        {
          name: 'Seg A',
          nameEs: 'Seg A',
          prevBalance: 100_000,
          currBalance: 100_000,
          prevRate: 0.04,
          currRate: 0.05,
        },
        {
          name: 'Seg B',
          nameEs: 'Seg B',
          prevBalance: 200_000,
          currBalance: 200_000,
          prevRate: 0.03,
          currRate: 0.04,
        },
      ],
    });

    // Pure rate effects: 100k*0.01 + 200k*0.01 = 1,000 + 2,000 = 3,000
    expect(result.rateEffect).toBeCloseTo(3_000, 0);
    expect(result.volumeEffect).toBeCloseTo(0, 2);
  });

  it('computes segment-level prevIncome and currIncome', () => {
    const result = service.decompose({
      segments: [
        {
          name: 'CRE',
          nameEs: 'CRE',
          prevBalance: 1_000_000,
          currBalance: 1_200_000,
          prevRate: 0.06,
          currRate: 0.065,
        },
      ],
    });

    const seg = result.segments[0];
    expect(seg.prevIncome).toBeCloseTo(60_000, 0); // 1M * 6%
    expect(seg.currIncome).toBeCloseTo(78_000, 0); // 1.2M * 6.5%
  });

  it('generates bilingual interpretation', () => {
    const result = service.decompose({
      segments: [
        {
          name: 'Loans',
          nameEs: 'Prestamos',
          prevBalance: 10_000_000,
          currBalance: 11_000_000,
          prevRate: 0.05,
          currRate: 0.055,
        },
      ],
    });

    expect(result.interpretation).toContain('NII changed');
    expect(result.interpretationEs).toContain('NII cambio');
  });
});
