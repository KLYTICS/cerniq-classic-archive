import { VintageAnalysisService } from './vintage-analysis.service';

describe('VintageAnalysisService', () => {
  let service: VintageAnalysisService;

  beforeEach(() => {
    service = new VintageAnalysisService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should calculate loss rates per vintage', () => {
    const result = service.analyze([
      {
        year: 2020,
        originalBalance: 100,
        currentBalance: 80,
        cumulativeLoss: 5,
        delinquent: 3,
      },
      {
        year: 2021,
        originalBalance: 120,
        currentBalance: 100,
        cumulativeLoss: 3,
        delinquent: 2,
      },
      {
        year: 2022,
        originalBalance: 150,
        currentBalance: 140,
        cumulativeLoss: 2,
        delinquent: 4,
      },
    ]);

    expect(result.vintages.length).toBe(3);
    expect(result.vintages[0].lossRate).toBe(5); // 5/100 * 100
    expect(result.vintages[1].lossRate).toBe(2.5); // 3/120 * 100
  });

  it('should identify worst and best vintage', () => {
    const result = service.analyze([
      {
        year: 2019,
        originalBalance: 100,
        currentBalance: 80,
        cumulativeLoss: 10,
        delinquent: 2,
      },
      {
        year: 2020,
        originalBalance: 100,
        currentBalance: 90,
        cumulativeLoss: 1,
        delinquent: 1,
      },
    ]);

    expect(result.worstVintage).toBe(2019);
    expect(result.bestVintage).toBe(2020);
  });

  it('should compute average loss rate', () => {
    const result = service.analyze([
      {
        year: 2020,
        originalBalance: 100,
        currentBalance: 80,
        cumulativeLoss: 4,
        delinquent: 2,
      },
      {
        year: 2021,
        originalBalance: 100,
        currentBalance: 90,
        cumulativeLoss: 6,
        delinquent: 1,
      },
    ]);

    expect(result.avgLossRate).toBe(5); // (4 + 6) / 2
  });

  it('should compute seasoning from current year', () => {
    const currentYear = new Date().getFullYear();
    const result = service.analyze([
      {
        year: currentYear - 3,
        originalBalance: 100,
        currentBalance: 80,
        cumulativeLoss: 5,
        delinquent: 2,
      },
    ]);

    expect(result.vintages[0].seasoning).toBe(3);
  });

  it('should provide bilingual interpretations', () => {
    const result = service.analyze([
      {
        year: 2020,
        originalBalance: 100,
        currentBalance: 90,
        cumulativeLoss: 3,
        delinquent: 1,
      },
    ]);

    expect(result.interpretation).toContain('Worst vintage');
    expect(result.interpretationEs).toContain('Peor cosecha');
  });
});
