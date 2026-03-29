import { StressScenarioGeneratorService } from './stress-scenario-generator.service';

describe('StressScenarioGeneratorService', () => {
  let service: StressScenarioGeneratorService;

  beforeEach(() => {
    service = new StressScenarioGeneratorService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generates COSSEC scenarios with 6 standard scenarios', () => {
    const result = service.generate({ framework: 'cossec' });
    expect(result.scenarios).toHaveLength(6);
    const names = result.scenarios.map((s) => s.name);
    expect(names).toContain('COSSEC Parallel Up 200');
    expect(names).toContain('PR Hurricane Impact');
    expect(names).toContain('Deposit Flight');
    for (const s of result.scenarios) {
      expect(s.nameEs).toBeDefined();
      expect(s.shocks).toBeDefined();
      expect(['mild', 'moderate', 'severe', 'extreme']).toContain(s.severity);
    }
  });

  it('generates Basel IRRBB scenarios with 6 scenarios', () => {
    const result = service.generate({ framework: 'basel' });
    expect(result.scenarios).toHaveLength(6);
    const names = result.scenarios.map((s) => s.name);
    expect(names).toContain('Parallel Up 200');
    expect(names).toContain('Steepener');
    expect(names).toContain('Flattener');
    for (const s of result.scenarios) {
      expect(s.category).toBe('irrbb');
    }
  });

  it('generates DFAST scenarios with baseline, adverse, severely adverse', () => {
    const result = service.generate({ framework: 'dfast' });
    expect(result.scenarios).toHaveLength(3);
    const names = result.scenarios.map((s) => s.name);
    expect(names).toContain('Baseline');
    expect(names).toContain('Adverse');
    expect(names).toContain('Severely Adverse');

    const severe = result.scenarios.find((s) => s.name === 'Severely Adverse');
    expect(severe!.severity).toBe('extreme');
    expect(severe!.shocks.gdp).toBeLessThan(0);
    expect(severe!.shocks.unemployment).toBeGreaterThan(8);
  });

  it('custom framework returns user-provided shocks', () => {
    const result = service.generate({
      framework: 'custom',
      customShocks: { parallel: 300, credit: -50 },
    });

    expect(result.scenarios).toHaveLength(1);
    expect(result.scenarios[0].name).toBe('Custom');
    expect(result.scenarios[0].shocks.parallel).toBe(300);
    expect(result.scenarios[0].shocks.credit).toBe(-50);
    expect(result.scenarios[0].severity).toBe('moderate');
  });

  it('all scenarios have bilingual names', () => {
    for (const fw of ['cossec', 'basel', 'dfast'] as const) {
      const result = service.generate({ framework: fw });
      for (const s of result.scenarios) {
        expect(typeof s.name).toBe('string');
        expect(typeof s.nameEs).toBe('string');
        expect(s.name.length).toBeGreaterThan(0);
        expect(s.nameEs.length).toBeGreaterThan(0);
      }
    }
  });
});
