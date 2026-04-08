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
      expect(result.breakdown.revenueGrowth).toBe(50);
    });

    it('should compute PE score based on fundamentals.peRatio', async () => {
      const result = await engine.calculate('DEF', {}, {});
      expect(result.breakdown.peRatio).toBe(75);

      const result2 = await engine.calculate('IDEAL', { peRatio: 15 }, {});
      expect(result2.breakdown.peRatio).toBe(100);
    });

    it('should compute PE score of 0 for extreme PE ratios', async () => {
      const result = await engine.calculate('EXP', { peRatio: 50 }, {});
      expect(result.breakdown.peRatio).toBe(0);
    });

    it('should score debtToEquity at 50 for placeholder value', async () => {
      const result = await engine.calculate('DTE', {}, {});
      expect(result.breakdown.debtToEquity).toBe(50);
    });

    it('should score fcfYield at 50 for placeholder value', async () => {
      const result = await engine.calculate('FCF', {}, {});
      expect(result.breakdown.fcfYield).toBe(50);
    });

    it('should score priceToSales at 70 for placeholder value', async () => {
      const result = await engine.calculate('PS', {}, {});
      expect(result.breakdown.priceToSales).toBe(70);
    });

    it('should weight overall score correctly (0.3 + 0.2 + 0.25 + 0.25)', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('WGT', {}, {});

      const fs = (50 + 80 + 66.66666666666667) / 3;
      const ms = 75;
      const vs = (75 + 70 + 50) / 3;
      const qs = (66.66666666666667 + 50 + 80) / 3;
      const expected = Math.round(fs * 0.3 + ms * 0.2 + vs * 0.25 + qs * 0.25);

      expect(result.overallScore).toBe(expected);
      spy.mockRestore();
    });
  });

  // ── Individual scorer coverage ─────────────────────────────

  describe('scoreFundamentals (private)', () => {
    it('should average revenueGrowth, marginTrend, and roic', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('FND', {}, {});
      // marginTrend = 60 + 0.5*40 = 80
      // roic = min(0.2/0.3*100, 100) = 66.67
      // revenueGrowth = 50
      // avg = (50 + 80 + 66.67) / 3
      const expected = Math.round((50 + 80 + 66.67) / 3);
      expect(result.fundamentalScore).toBe(expected);
      spy.mockRestore();
    });
  });

  describe('scoreMomentum (private)', () => {
    it('should produce value between 50 and 100', async () => {
      const result = await engine.calculate('MOM', {}, {});
      expect(result.momentumScore).toBeGreaterThanOrEqual(50);
      expect(result.momentumScore).toBeLessThanOrEqual(100);
    });

    it('should produce 75 when random is 0.5', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('MOM2', {}, {});
      expect(result.momentumScore).toBe(75);
      spy.mockRestore();
    });
  });

  describe('scoreValuation (private)', () => {
    it('should average peScore, psScore, and fcfYieldScore', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('VAL', {}, {});
      const expected = Math.round((75 + 70 + 50) / 3);
      expect(result.valuationScore).toBe(expected);
      spy.mockRestore();
    });
  });

  describe('scoreQuality (private)', () => {
    it('should average roicScore, debtScore, and marginScore', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('QL', {}, {});
      const expected = Math.round((66.67 + 50 + 80) / 3);
      expect(result.qualityScore).toBe(expected);
      spy.mockRestore();
    });
  });

  describe('scorePE edge cases', () => {
    it('should score 0 for PE ratio of 35 (|35-15|*5 = 100)', async () => {
      const result = await engine.calculate('PE35', { peRatio: 35 }, {});
      expect(result.breakdown.peRatio).toBe(0);
    });

    it('should score 100 for PE ratio of 15 (ideal)', async () => {
      const result = await engine.calculate('PE15', { peRatio: 15 }, {});
      expect(result.breakdown.peRatio).toBe(100);
    });

    it('should score 50 for PE ratio of 25', async () => {
      // |25-15|*5 = 50, score = 100 - 50 = 50
      const result = await engine.calculate('PE25', { peRatio: 25 }, {});
      expect(result.breakdown.peRatio).toBe(50);
    });

    it('should score based on distance from ideal 15 for PE of 5', async () => {
      // |5-15|*5 = 50, score = 100-50 = 50
      const result = await engine.calculate('PE5', { peRatio: 5 }, {});
      expect(result.breakdown.peRatio).toBe(50);
    });
  });

  describe('scoreROIC (private)', () => {
    it('should produce deterministic score of ~67 for placeholder ROIC=0.2', () => {
      const fn = (engine as any).scoreROIC.bind(engine);
      const score = fn({});
      expect(score).toBeCloseTo((0.2 / 0.3) * 100, 0);
    });
  });

  describe('scoreDebtLevel edge', () => {
    it('should produce 50 for placeholder debtToEquity=0.5', () => {
      const fn = (engine as any).scoreDebtLevel.bind(engine);
      const score = fn({});
      expect(score).toBe(50);
    });
  });

  describe('scoreFCFYield', () => {
    it('should produce 50 for placeholder fcfYield=0.05', () => {
      const fn = (engine as any).scoreFCFYield.bind(engine);
      const score = fn({});
      expect(score).toBe(50);
    });
  });

  describe('scorePriceToSales', () => {
    it('should produce 70 for placeholder ps=3', () => {
      const fn = (engine as any).scorePriceToSales.bind(engine);
      const score = fn({});
      expect(score).toBe(70);
    });
  });

  describe('scoreRevenueGrowth', () => {
    it('should produce 50 for placeholder growth=15', () => {
      const fn = (engine as any).scoreRevenueGrowth.bind(engine);
      const score = fn({});
      expect(score).toBe(50);
    });
  });
});
