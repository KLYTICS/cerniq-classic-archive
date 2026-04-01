import { CompounderValuationEngine } from './compounder.engine';

describe('CompounderValuationEngine', () => {
  let engine: CompounderValuationEngine;

  beforeEach(() => {
    engine = new CompounderValuationEngine();
  });

  describe('calculate', () => {
    it('should return a valid CompounderValuationDto with all fields', async () => {
      const result = await engine.calculate('AAPL', 150, { eps: 10, fcf: 8 });

      expect(result.ticker).toBe('AAPL');
      expect(result.currentPrice).toBe(150);
      expect(typeof result.fairValue).toBe('number');
      expect(typeof result.upside).toBe('number');
      expect(typeof result.qualityScore).toBe('number');
      expect(typeof result.roicSpread).toBe('number');
      expect(typeof result.revenueGrowth).toBe('number');
      expect(typeof result.marginStability).toBe('number');
      expect(typeof result.cashConversion).toBe('number');
      expect(typeof result.peMultiple).toBe('number');
      expect(typeof result.pegRatio).toBe('number');
    });

    it('should use default eps/fcf when fundamentals are empty', async () => {
      const result = await engine.calculate('MSFT', 300, {});

      // defaults: eps=10, fcf=8
      expect(result.cashConversion).toBe(8 / 10);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('should use default eps/fcf when fundamentals are null', async () => {
      const result = await engine.calculate('GOOG', 100, null);

      // defaults kick in: eps=10, fcf=8
      expect(result.cashConversion).toBe(0.8);
    });

    it('should compute upside correctly relative to currentPrice', async () => {
      const result = await engine.calculate('TSLA', 200, { eps: 10, fcf: 8 });

      const expectedUpside =
        ((result.fairValue - 200) / 200) * 100;
      expect(result.upside).toBeCloseTo(expectedUpside, 5);
    });

    it('should clamp qualityScore between 0 and 100', async () => {
      const result = await engine.calculate('LOW', 50, { eps: 10, fcf: 8 });

      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
    });

    it('should compute fairValue as eps * peMultiple', async () => {
      const result = await engine.calculate('HD', 100, { eps: 5, fcf: 4 });

      expect(result.fairValue).toBeCloseTo(5 * result.peMultiple, 5);
    });

    it('should handle pegRatio when revenueGrowth is zero-ish via fallback', async () => {
      // The engine uses random for revenueGrowth so we just test it does not blow up
      // and the PEG formula is peMultiple / (growth > 0 ? growth : 1)
      const result = await engine.calculate('TEST', 100, { eps: 10, fcf: 8 });
      expect(Number.isFinite(result.pegRatio)).toBe(true);
    });

    it('should convert roicSpread to percentage', async () => {
      const result = await engine.calculate('V', 200, { eps: 12, fcf: 10 });
      // roicSpread is (roic - wacc) * 100 where wacc=0.08, roic is 0.15-0.30
      expect(result.roicSpread).toBeGreaterThanOrEqual((0.15 - 0.08) * 100);
      expect(result.roicSpread).toBeLessThanOrEqual((0.30 - 0.08) * 100);
    });

    it('should have peMultiple >= base of 20', async () => {
      const result = await engine.calculate('MA', 350, { eps: 15, fcf: 12 });
      // baseMultiple is 20, adjustments are additive and non-negative
      expect(result.peMultiple).toBeGreaterThanOrEqual(20);
    });

    it('should return marginStability between 60 and 100', async () => {
      const result = await engine.calculate('JNJ', 170, {});
      expect(result.marginStability).toBeGreaterThanOrEqual(60);
      expect(result.marginStability).toBeLessThanOrEqual(100);
    });
  });
});
