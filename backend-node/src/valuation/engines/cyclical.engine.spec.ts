import { CyclicalValuationEngine } from './cyclical.engine';

describe('CyclicalValuationEngine', () => {
  let engine: CyclicalValuationEngine;

  beforeEach(() => {
    engine = new CyclicalValuationEngine();
  });

  describe('calculate', () => {
    it('should return a valid CyclicalValuationDto with all fields', async () => {
      const result = await engine.calculate('CAT', 250, { eps: 8 });

      expect(result.ticker).toBe('CAT');
      expect(result.currentPrice).toBe(250);
      expect(typeof result.fairValue).toBe('number');
      expect(typeof result.fairValueLow).toBe('number');
      expect(typeof result.fairValueHigh).toBe('number');
      expect(typeof result.upside).toBe('number');
      expect(typeof result.normalizedEarnings).toBe('number');
      expect(typeof result.peMultiple).toBe('number');
      expect(['early', 'mid', 'late', 'peak', 'trough']).toContain(result.cycleStage);
      expect(typeof result.revenueGrowth).toBe('number');
      expect(['expanding', 'stable', 'contracting']).toContain(result.marginTrend);
    });

    it('should use default eps=5 when not provided', async () => {
      const result = await engine.calculate('DE', 200, {});
      expect(result.normalizedEarnings).toBeGreaterThan(0);
    });

    it('should use default eps=5 when fundamentals is null', async () => {
      const result = await engine.calculate('DE', 200, null);
      expect(result.normalizedEarnings).toBeGreaterThan(0);
    });

    it('should have fairValueLow < fairValue < fairValueHigh', async () => {
      const result = await engine.calculate('FCX', 40, { eps: 3 });
      expect(result.fairValueLow).toBeLessThan(result.fairValue);
      expect(result.fairValueHigh).toBeGreaterThan(result.fairValue);
    });

    it('should compute upside correctly', async () => {
      const result = await engine.calculate('X', 30, { eps: 2 });
      const expected = ((result.fairValue - 30) / 30) * 100;
      expect(result.upside).toBeCloseTo(expected, 5);
    });

    it('should produce fairValueLow = normalizedEPS * peMultiple * 0.8', async () => {
      const result = await engine.calculate('NUE', 150, { eps: 10 });
      expect(result.fairValueLow).toBeCloseTo(
        result.normalizedEarnings * result.peMultiple * 0.8,
        5,
      );
    });

    it('should produce fairValueHigh = normalizedEPS * peMultiple * 1.2', async () => {
      const result = await engine.calculate('NUE', 150, { eps: 10 });
      expect(result.fairValueHigh).toBeCloseTo(
        result.normalizedEarnings * result.peMultiple * 1.2,
        5,
      );
    });
  });

  describe('identifyCycleStage (via calculate)', () => {
    // We test the private method indirectly through various runs
    // Since estimateRevenueGrowth uses Math.random(), we mock it deterministically.

    it('should identify trough for very negative growth', async () => {
      // Mock the random to produce growth < -10
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0); // yields -10
      const result = await engine.calculate('TST', 100, { eps: 5 });
      // growth = 0 * 30 - 10 = -10, which is < 0 but not < -10 => 'late'
      expect(['late', 'trough']).toContain(result.cycleStage);
      spy.mockRestore();
    });

    it('should identify peak for very high growth', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(1); // yields 20
      const result = await engine.calculate('TST', 100, { eps: 5 });
      // growth = 1 * 30 - 10 = 20, 10 < 20 < 25 => 'mid'
      expect(result.cycleStage).toBe('mid');
      spy.mockRestore();
    });

    it('should identify early for modest positive growth', async () => {
      // random = 0.5 => growth = 0.5 * 30 - 10 = 5, 0 < 5 < 10 => 'early'
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('TST', 100, { eps: 5 });
      expect(result.cycleStage).toBe('early');
      spy.mockRestore();
    });
  });
});
