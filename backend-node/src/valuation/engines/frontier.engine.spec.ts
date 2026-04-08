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
      const totalProb = result.scenarios.reduce(
        (sum, s) => sum + s.probability,
        0,
      );
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
      const expected = ((result.probabilityWeightedValue - 40) / 40) * 100;
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
      expect(result.scenarios[0].value).toBeCloseTo(500, 5);
      expect(result.scenarios[1].value).toBeCloseTo(200, 5);
      expect(result.scenarios[2].value).toBeCloseTo(50, 5);
      expect(result.scenarios[3].value).toBeCloseTo(10, 5);
    });

    it('should produce positive upside for low current price', async () => {
      const result = await engine.calculate('CHEAP', 100, {});
      expect(result.upside).toBeGreaterThan(0);
    });

    it('should handle very small currentPrice', async () => {
      const result = await engine.calculate('PENNY', 0.01, {});
      expect(result.probabilityWeightedValue).toBeGreaterThan(0);
      expect(Number.isFinite(result.upside)).toBe(true);
    });

    it('should have each scenario with name, probability, value, and assumptions', async () => {
      const result = await engine.calculate('CHK', 50, {});
      for (const scenario of result.scenarios) {
        expect(typeof scenario.name).toBe('string');
        expect(scenario.name.length).toBeGreaterThan(0);
        expect(typeof scenario.probability).toBe('number');
        expect(scenario.probability).toBeGreaterThan(0);
        expect(typeof scenario.value).toBe('number');
        expect(typeof scenario.assumptions).toBe('string');
      }
    });
  });

  // ── calculateOptionality ───────────────────────────────────

  describe('calculateOptionality (private)', () => {
    it('should return high optionality for widely spread scenarios', () => {
      const fn = (engine as any).calculateOptionality.bind(engine);
      const result = fn([
        { value: 1000, probability: 0.25 },
        { value: 200, probability: 0.4 },
        { value: 10, probability: 0.25 },
        { value: 1, probability: 0.1 },
      ]);
      expect(result).toBeGreaterThan(0);
      expect(result).toBeLessThanOrEqual(100);
    });

    it('should return low optionality for tightly clustered scenarios', () => {
      const fn = (engine as any).calculateOptionality.bind(engine);
      const result = fn([
        { value: 100, probability: 0.25 },
        { value: 101, probability: 0.25 },
        { value: 99, probability: 0.25 },
        { value: 100.5, probability: 0.25 },
      ]);
      expect(result).toBeLessThan(5); // Very low CV
    });

    it('should cap at 100', () => {
      const fn = (engine as any).calculateOptionality.bind(engine);
      const result = fn([
        { value: 10000, probability: 0.5 },
        { value: 1, probability: 0.5 },
      ]);
      expect(result).toBeLessThanOrEqual(100);
    });
  });

  // ── identifyCatalysts ──────────────────────────────────────

  describe('identifyCatalysts (private)', () => {
    it('should return array of catalyst strings', () => {
      const fn = (engine as any).identifyCatalysts.bind(engine);
      const catalysts = fn('AAPL', {});
      expect(Array.isArray(catalysts)).toBe(true);
      expect(catalysts.length).toBe(4);
      for (const c of catalysts) {
        expect(typeof c).toBe('string');
        expect(c.length).toBeGreaterThan(0);
      }
    });
  });
});
