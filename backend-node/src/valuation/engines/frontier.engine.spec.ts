import { FrontierValuationEngine } from './frontier.engine';

describe('FrontierValuationEngine', () => {
  let engine: FrontierValuationEngine;

  beforeEach(() => {
    engine = new FrontierValuationEngine();
  });

  it('calculates scenario-weighted frontier valuations and catalysts', async () => {
    const result = await engine.calculate('NVDA', 100, { sector: 'AI' });

    expect(result.ticker).toBe('NVDA');
    expect(result.currentPrice).toBe(100);
    expect(result.scenarios).toHaveLength(4);
    expect(result.probabilityWeightedValue).toBeCloseTo(218.5, 5);
    expect(result.upside).toBeCloseTo(118.5, 5);
    expect(result.optionality).toBe(100);
    expect(result.catalysts).toEqual([
      'Product launch in 6 months',
      'Potential strategic partnership',
      'Market expansion to Europe',
      'First profitability target FY2026',
    ]);
  });

  it('caps optionality at one hundred for extreme scenario variance', () => {
    const optionality = (engine as any).calculateOptionality([
      { name: 'Low', probability: 0.5, value: 1, assumptions: '' },
      { name: 'High', probability: 0.5, value: 1000, assumptions: '' },
    ]);

    expect(optionality).toBeGreaterThan(99);
    expect(optionality).toBeLessThanOrEqual(100);
  });
});
