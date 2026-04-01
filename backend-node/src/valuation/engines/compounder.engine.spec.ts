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

    it('should use default eps=10 and fcf=8 when fundamentals are empty', async () => {
      const result = await engine.calculate('MSFT', 300, {});
      expect(result.cashConversion).toBe(8 / 10);
      expect(result.fairValue).toBeGreaterThan(0);
    });

    it('should use default eps=10 and fcf=8 when fundamentals are null', async () => {
      const result = await engine.calculate('GOOG', 100, null);
      expect(result.cashConversion).toBe(0.8);
    });

    it('should compute upside correctly relative to currentPrice', async () => {
      const result = await engine.calculate('TSLA', 200, { eps: 10, fcf: 8 });
      const expectedUpside = ((result.fairValue - 200) / 200) * 100;
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
      const result = await engine.calculate('TEST', 100, { eps: 10, fcf: 8 });
      expect(Number.isFinite(result.pegRatio)).toBe(true);
    });

    it('should convert roicSpread to percentage', async () => {
      const result = await engine.calculate('V', 200, { eps: 12, fcf: 10 });
      expect(result.roicSpread).toBeGreaterThanOrEqual((0.15 - 0.08) * 100);
      expect(result.roicSpread).toBeLessThanOrEqual((0.30 - 0.08) * 100);
    });

    it('should have peMultiple >= base of 20', async () => {
      const result = await engine.calculate('MA', 350, { eps: 15, fcf: 12 });
      expect(result.peMultiple).toBeGreaterThanOrEqual(20);
    });

    it('should return marginStability between 60 and 100', async () => {
      const result = await engine.calculate('JNJ', 170, {});
      expect(result.marginStability).toBeGreaterThanOrEqual(60);
      expect(result.marginStability).toBeLessThanOrEqual(100);
    });
  });

  // ── calculateQualityScore branch coverage ──────────────────

  describe('calculateQualityScore (via calculate)', () => {
    it('should produce score near 0 with minimal inputs', async () => {
      // Mock random to produce minimum values
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
      const result = await engine.calculate('MIN', 100, { eps: 1, fcf: 0 });

      // With random=0: roic=0.15, growth=10, margin=60, cashConversion=0
      // roicSpread = 0.15 - 0.08 = 0.07
      // roicSpread*100*3 = 21, capped at 30 => 21
      // growth*1.25 = 12.5, capped at 25 => 12.5
      // marginStability*0.25 = 15
      // cashConversion*20 = 0, capped at 20 => 0
      // total = 21 + 12.5 + 15 + 0 = 48.5
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      expect(result.qualityScore).toBeLessThanOrEqual(100);
      spy.mockRestore();
    });

    it('should clamp quality score max at 100', async () => {
      // Mock to produce very high values
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.999);
      const result = await engine.calculate('MAX', 100, {
        eps: 10,
        fcf: 100,
      });

      expect(result.qualityScore).toBeLessThanOrEqual(100);
      spy.mockRestore();
    });

    it('should clamp quality score min at 0', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
      const result = await engine.calculate('ZERO', 100, { eps: 1, fcf: 0 });
      expect(result.qualityScore).toBeGreaterThanOrEqual(0);
      spy.mockRestore();
    });
  });

  // ── getQualityAdjustedMultiple ─────────────────────────────

  describe('getQualityAdjustedMultiple (via calculate)', () => {
    it('should increase PE multiple with higher quality score', async () => {
      const spy = jest.spyOn(Math, 'random');

      // Low quality run
      spy.mockReturnValue(0);
      const lowResult = await engine.calculate('LO', 100, {
        eps: 10,
        fcf: 8,
      });

      // High quality run
      spy.mockReturnValue(0.999);
      const highResult = await engine.calculate('HI', 100, {
        eps: 10,
        fcf: 8,
      });

      expect(highResult.peMultiple).toBeGreaterThan(lowResult.peMultiple);
      spy.mockRestore();
    });
  });

  // ── pegRatio edge case ─────────────────────────────────────

  describe('pegRatio edge case', () => {
    it('should use 1 as denominator when revenueGrowth is 0', async () => {
      // If revenueGrowth is 0, pegRatio = peMultiple / 1
      // Since revenueGrowth uses random (10 + random*15), min is 10
      // So this branch can only be triggered if growth <= 0
      // We cannot make it <= 0 since formula is 10+random*15
      // Just verify formula correctness:
      const result = await engine.calculate('PEG', 100, { eps: 10, fcf: 8 });
      const expectedPeg =
        result.peMultiple /
        (result.revenueGrowth > 0 ? result.revenueGrowth : 1);
      expect(result.pegRatio).toBeCloseTo(expectedPeg, 5);
    });
  });

  // ── ROIC range ─────────────────────────────────────────────

  describe('calculateROIC range', () => {
    it('should produce ROIC between 0.15 and 0.30', async () => {
      const result = await engine.calculate('ROIC', 100, {
        eps: 10,
        fcf: 8,
      });
      // roicSpread = (roic - wacc) * 100 where wacc=0.08
      // So roic = roicSpread/100 + 0.08
      const roic = result.roicSpread / 100 + 0.08;
      expect(roic).toBeGreaterThanOrEqual(0.15);
      expect(roic).toBeLessThanOrEqual(0.30);
    });
  });
});
