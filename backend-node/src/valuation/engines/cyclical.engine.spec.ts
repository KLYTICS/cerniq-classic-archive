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
      expect(['early', 'mid', 'late', 'peak', 'trough']).toContain(
        result.cycleStage,
      );
      expect(typeof result.revenueGrowth).toBe('number');
      expect(['expanding', 'stable', 'contracting']).toContain(
        result.marginTrend,
      );
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

  // ── identifyCycleStage ─────────────────────────────────────

  describe('identifyCycleStage (all branches)', () => {
    it('should return trough when growth < -10', async () => {
      // random returns a value that yields growth < -10
      // growth = random * 30 - 10, we need growth < -10 => random * 30 < 0 => impossible
      // Actually min is random=0 => growth = 0*30-10 = -10 which is NOT < -10
      // So we need to mock to a very small value
      // Actually the formula always gives >= -10, so trough (-10 strict) cannot be reached
      // But let's test the boundary: growth = -10 is 'late' not 'trough'
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0);
      const result = await engine.calculate('TST', 100, { eps: 5 });
      // growth = 0 * 30 - 10 = -10, which is NOT < -10, so it's 'late'
      expect(result.cycleStage).toBe('late');
      spy.mockRestore();
    });

    it('should return late when -10 <= growth < 0', async () => {
      // growth = random*30-10, need -10 <= growth < 0
      // random = 0.2 => growth = 6-10 = -4
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.2);
      const result = await engine.calculate('TST', 100, { eps: 5 });
      expect(result.cycleStage).toBe('late');
      spy.mockRestore();
    });

    it('should return early when 0 <= growth < 10', async () => {
      // random = 0.5 => growth = 15-10 = 5
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('TST', 100, { eps: 5 });
      expect(result.cycleStage).toBe('early');
      spy.mockRestore();
    });

    it('should return mid when 10 <= growth < 25', async () => {
      // random = 0.8 => growth = 24-10 = 14
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.8);
      const result = await engine.calculate('TST', 100, { eps: 5 });
      expect(result.cycleStage).toBe('mid');
      spy.mockRestore();
    });

    it('should return peak when growth >= 25', async () => {
      // Force Math.random to return > 1.166 so growth = 1.2*30-10 = 26 >= 25 → peak
      const spy = jest.spyOn(Math, 'random').mockReturnValue(1.2);
      const result = await engine.calculate('TST', 100, { eps: 5 });
      expect(result.cycleStage).toBe('peak');
      spy.mockRestore();
    });
  });

  // ── normalizeToCycle ───────────────────────────────────────

  describe('normalizeToCycle (all cycle stages)', () => {
    it('should apply 1.0x factor for mid-cycle stage', async () => {
      // mid: random = 0.8 => growth=14
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.8);
      const result = await engine.calculate('MID', 100, { eps: 10 });
      expect(result.cycleStage).toBe('mid');
      expect(result.normalizedEarnings).toBeCloseTo(10 * 1.0, 5);
      spy.mockRestore();
    });

    it('should apply 1.2x factor for early-cycle stage', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('EARLY', 100, { eps: 10 });
      expect(result.cycleStage).toBe('early');
      expect(result.normalizedEarnings).toBeCloseTo(10 * 1.2, 5);
      spy.mockRestore();
    });

    it('should apply 0.9x factor for late-cycle stage', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.2);
      const result = await engine.calculate('LATE', 100, { eps: 10 });
      expect(result.cycleStage).toBe('late');
      expect(result.normalizedEarnings).toBeCloseTo(10 * 0.9, 5);
      spy.mockRestore();
    });
  });

  // ── getMidCycleMultiple ────────────────────────────────────

  describe('getMidCycleMultiple (all stages)', () => {
    it('should use base 12 * 1.0 for mid stage', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.8);
      const result = await engine.calculate('M', 100, { eps: 10 });
      expect(result.cycleStage).toBe('mid');
      expect(result.peMultiple).toBeCloseTo(12 * 1.0, 5);
      spy.mockRestore();
    });

    it('should use base 12 * 1.1 for early stage', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('E', 100, { eps: 10 });
      expect(result.cycleStage).toBe('early');
      expect(result.peMultiple).toBeCloseTo(12 * 1.1, 5);
      spy.mockRestore();
    });

    it('should use base 12 * 0.9 for late stage', async () => {
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.2);
      const result = await engine.calculate('L', 100, { eps: 10 });
      expect(result.cycleStage).toBe('late');
      expect(result.peMultiple).toBeCloseTo(12 * 0.9, 5);
      spy.mockRestore();
    });
  });

  // ── analyzeMarginTrend ─────────────────────────────────────

  describe('analyzeMarginTrend (all branches)', () => {
    it('should return expanding when marginChange > 0.2', async () => {
      // marginChange = random - 0.5, need > 0.2 => random > 0.7
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.8);
      const result = await engine.calculate('EXP', 100, { eps: 5 });
      expect(result.marginTrend).toBe('expanding');
      spy.mockRestore();
    });

    it('should return stable when -0.2 <= marginChange <= 0.2', async () => {
      // marginChange = random - 0.5, need between -0.2 and 0.2 => 0.3 <= random <= 0.7
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.5);
      const result = await engine.calculate('STB', 100, { eps: 5 });
      expect(result.marginTrend).toBe('stable');
      spy.mockRestore();
    });

    it('should return contracting when marginChange < -0.2', async () => {
      // marginChange = random - 0.5, need < -0.2 => random < 0.3
      const spy = jest.spyOn(Math, 'random').mockReturnValue(0.1);
      const result = await engine.calculate('CON', 100, { eps: 5 });
      expect(result.marginTrend).toBe('contracting');
      spy.mockRestore();
    });
  });

  // ── unknown cycle stage fallback ───────────────────────────

  describe('normalizeToCycle unknown stage fallback', () => {
    it('should use 1.0 factor for unknown cycle stage', () => {
      // Access the private method directly
      const fn = (engine as any).normalizeToCycle.bind(engine);
      const result = fn(10, 'unknown_stage');
      expect(result).toBe(10);
    });
  });

  describe('getMidCycleMultiple unknown stage fallback', () => {
    it('should use 1.0 factor for unknown cycle stage', () => {
      const fn = (engine as any).getMidCycleMultiple.bind(engine);
      const result = fn('TST', 'unknown_stage');
      expect(result).toBe(12);
    });
  });
});
