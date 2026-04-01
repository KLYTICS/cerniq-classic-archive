import { KPIScoringEngine } from './kpi-scoring.engine';

describe('KPIScoringEngine', () => {
  let engine: KPIScoringEngine;

  beforeEach(() => {
    engine = new KPIScoringEngine();
  });

  describe('calculate', () => {
    it('should return a valid KPIScoreDto with all fields', async () => {
      const result = await engine.calculate('AAPL', {}, {});

      expect(result.ticker).toBe('AAPL');
      expect(typeof result.overallScore).toBe('number');
      expect(typeof result.fundamentalScore).toBe('number');
      expect(typeof result.momentumScore).toBe('number');
      expect(typeof result.valuationScore).toBe('number');
      expect(typeof result.qualityScore).toBe('number');
      expect(typeof result.breakdown).toBe('object');
    });

    it('should round all component scores to integers', async () => {
      const result = await engine.calculate('MSFT', {}, {});

      expect(result.overallScore).toBe(Math.round(result.overallScore));
      expect(result.fundamentalScore).toBe(Math.round(result.fundamentalScore));
      expect(result.momentumScore).toBe(Math.round(result.momentumScore));
      expect(result.valuationScore).toBe(Math.round(result.valuationScore));
      expect(result.qualityScore).toBe(Math.round(result.qualityScore));
    });

    it('should have breakdown with all required metric keys', async () => {
      const result = await engine.calculate('V', {}, {});

      expect(result.breakdown).toHaveProperty('revenueGrowth');
      expect(result.breakdown).toHaveProperty('marginTrend');
      expect(result.breakdown).toHaveProperty('roic');
      expect(result.breakdown).toHaveProperty('debtToEquity');
      expect(result.breakdown).toHaveProperty('fcfYield');
      expect(result.breakdown).toHaveProperty('peRatio');
      expect(result.breakdown).toHaveProperty('priceToSales');
    });

    it('should compute revenueGrowth score deterministically', async () => {
      const result = await engine.calculate('TST', {}, {});
      // growth = 15, score = min(15/30 * 100, 100) = 50
      expect(result.breakdown.revenueGrowth).toBe(50);
    });

    it('should compute PE score based on fundamentals.peRatio', async () => {
      // Default PE = 20. Score = max(0, 100 - |20 - 15| * 5) = max(0, 100 - 25) = 75
      const result = await engine.calculate('DEF', {}, {});
      expect(result.breakdown.peRatio).toBe(75);

      // PE exactly 15 => score 100
      const result2 = await engine.calculate('IDEAL', { peRatio: 15 }, {});
      expect(result2.breakdown.peRatio).toBe(100);
    });

    it('should compute PE score of 0 for extreme PE ratios', async () => {
      // PE = 50 => score = max(0, 100 - |50-15|*5) = max(0, 100-175) = 0
      const result = await engine.calculate('EXP', { peRatio: 50 }, {});
      expect(result.breakdown.peRatio).toBe(0);
    });

    it('should score debtToEquity at 50 for placeholder value', async () => {
      const result = await engine.calculate('DTE', {}, {});
      // debtToEquity = 0.5, score = max(0, 100 - 0.5*100) = 50
      expect(result.breakdown.debtToEquity).toBe(50);
    });

    it('should score fcfYield at 50 for placeholder value', async () => {
      const result = await engine.calculate('FCF', {}, {});
      // fcfYield = 0.05, score = min(0.05/0.1 * 100, 100) = 50
      expect(result.breakdown.fcfYield).toBe(50);
    });

    it('should score priceToSales at 70 for placeholder value', async () => {
      const result = await engine.calculate('PS', {}, {});
      // ps = 3, score = max(0, 100 - 3*10) = 70
      expect(result.breakdown.priceToSales).toBe(70);
    });

    it('should weight overall score correctly (0.3 + 0.2 + 0.25 + 0.25)', async () => {
      // Mock random to get deterministic momentum and margin scores
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('WGT', {}, {});

      // With random=0.5:
      // marginTrend = 60 + 0.5*40 = 80
      // momentum = 50 + 0.5*50 = 75
      // roic = min(0.2/0.3 * 100, 100) = 66.67
      // revenueGrowth = 50
      // fundamentalScore = (50 + 80 + 66.67) / 3
      // debtToEquity = 50
      // fcfYield = 50
      // peRatio = 75 (default)
      // priceToSales = 70
      // valuationScore = (75 + 70 + 50) / 3
      // qualityScore = (66.67 + 50 + 80) / 3

      const fs = (50 + 80 + 66.66666666666667) / 3;
      const ms = 75;
      const vs = (75 + 70 + 50) / 3;
      const qs = (66.66666666666667 + 50 + 80) / 3;
      const expected = Math.round(fs * 0.3 + ms * 0.2 + vs * 0.25 + qs * 0.25);

      expect(result.overallScore).toBe(expected);
      spy.mockRestore();
    });
  });
});
