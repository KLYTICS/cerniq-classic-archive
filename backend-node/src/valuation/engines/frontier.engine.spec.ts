import { FrontierValuationEngine } from './frontier.engine';

describe('FrontierValuationEngine', () => {
  let engine: FrontierValuationEngine;

  beforeEach(() => {
    engine = new FrontierValuationEngine();
  });

  describe('calculate', () => {
    it('should return a valid FrontierValuationDto with all fields', async () => {
      const result = await engine.calculate('PLTR', 25, {});

      expect(result.ticker).toBe('PLTR');
      expect(result.currentPrice).toBe(25);
      expect(result.scenarios).toHaveLength(4);
      expect(typeof result.probabilityWeightedValue).toBe('number');
      expect(typeof result.upside).toBe('number');
      expect(typeof result.optionality).toBe('number');
      expect(Array.isArray(result.catalysts)).toBe(true);
      expect(result.catalysts.length).toBeGreaterThan(0);
    });

    it('should have scenario probabilities summing to 1.0', async () => {
      const result = await engine.calculate('SNOW', 160, {});

      const totalProb = result.scenarios.reduce((sum, s) => sum + s.probability, 0);
      expect(totalProb).toBeCloseTo(1.0, 5);
    });

    it('should compute probability-weighted value correctly', async () => {
      const result = await engine.calculate('COIN', 60, {});

      const expected = result.scenarios.reduce(
        (sum, s) => sum + s.value * s.probability,
        0,
      );
      expect(result.probabilityWeightedValue).toBeCloseTo(expected, 5);
    });

    it('should compute upside correctly', async () => {
      const result = await engine.calculate('RBLX', 40, {});

      const expected =
        ((result.probabilityWeightedValue - 40) / 40) * 100;
      expect(result.upside).toBeCloseTo(expected, 5);
    });

    it('should have bull case as the highest value scenario', async () => {
      const result = await engine.calculate('NET', 80, {});

      const bullCase = result.scenarios.find((s) => s.name.includes('Bull'));
      const maxValue = Math.max(...result.scenarios.map((s) => s.value));
      expect(bullCase?.value).toBe(maxValue);
    });

    it('should have bust case as the lowest value scenario', async () => {
      const result = await engine.calculate('NET', 80, {});

      const bustCase = result.scenarios.find((s) => s.name.includes('Bust'));
      const minValue = Math.min(...result.scenarios.map((s) => s.value));
      expect(bustCase?.value).toBe(minValue);
    });

    it('should compute optionality as a non-negative number capped at 100', async () => {
      const result = await engine.calculate('DDOG', 120, {});

      expect(result.optionality).toBeGreaterThanOrEqual(0);
      expect(result.optionality).toBeLessThanOrEqual(100);
    });

    it('should return exactly 4 catalysts', async () => {
      const result = await engine.calculate('U', 30, {});
      expect(result.catalysts).toHaveLength(4);
    });

    it('should scale scenario values relative to currentPrice', async () => {
      const result = await engine.calculate('TEST', 100, {});

      // Bull = 5x, Base = 2x, Bear = 0.5x, Bust = 0.1x
      expect(result.scenarios[0].value).toBeCloseTo(500, 5); // Bull
      expect(result.scenarios[1].value).toBeCloseTo(200, 5); // Base
      expect(result.scenarios[2].value).toBeCloseTo(50, 5);  // Bear
      expect(result.scenarios[3].value).toBeCloseTo(10, 5);  // Bust
    });

    it('should produce positive upside for a fairly low current price', async () => {
      // PWV = 0.25*500 + 0.4*200 + 0.25*50 + 0.1*10 = 125+80+12.5+1 = 218.5
      // upside = (218.5 - 100)/100 * 100 = 118.5%
      const result = await engine.calculate('CHEAP', 100, {});
      expect(result.upside).toBeGreaterThan(0);
    });
  });
});
