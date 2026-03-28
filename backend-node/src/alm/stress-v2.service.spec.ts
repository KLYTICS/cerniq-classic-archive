import { StressV2Service } from './stress-v2.service';

describe('StressV2Service', () => {
  let service: StressV2Service;
  const mockPrisma = {
    balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
  } as any;

  beforeEach(() => {
    service = new StressV2Service(mockPrisma);
  });

  it('should return 3 preset DFAST scenarios', () => {
    const presets = service.getPresetScenarios();
    expect(presets).toHaveLength(3);
    expect(presets[0].name).toBe('Severe Adverse');
    expect(presets[1].name).toBe('Hurricane Scenario');
  });

  it('each preset should have 9 quarter rate path', () => {
    const presets = service.getPresetScenarios();
    for (const s of presets) {
      expect(s.ratePathBps).toHaveLength(9);
    }
  });

  it('stress test should produce 9 quarters of results', async () => {
    const scenarios = service.getPresetScenarios();
    const result = await service.runStressTest('inst-1', scenarios[0]);
    expect(result.quarters).toHaveLength(9);
    expect(result.scenarioName).toBe('Severe Adverse');
  });

  it('minNWR should be the minimum across quarters', async () => {
    const scenarios = service.getPresetScenarios();
    const result = await service.runStressTest('inst-1', scenarios[0]);
    const calcMin = Math.min(...result.quarters.map((q) => q.nwr));
    expect(result.minNWR).toBeCloseTo(calcMin, 1);
  });

  it('runAllPresets should return 3 results', async () => {
    const results = await service.runAllPresets('inst-1');
    expect(results).toHaveLength(3);
  });

  it('narratives should be in both languages', async () => {
    const scenarios = service.getPresetScenarios();
    const result = await service.runStressTest('inst-1', scenarios[0]);
    expect(result.narrativeEn).toContain('Severe Adverse');
    expect(result.narrativeEs).toContain('Severamente Adverso');
  });
});
