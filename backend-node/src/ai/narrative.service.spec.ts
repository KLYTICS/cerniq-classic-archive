import { NarrativeService } from './narrative.service';

describe('NarrativeService', () => {
  let service: NarrativeService;

  beforeEach(() => {
    service = new NarrativeService();
    // Clear ANTHROPIC_API_KEY so we get template fallback
    delete process.env.ANTHROPIC_API_KEY;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateNarrative returns template narrative when no API key', async () => {
    const result = await service.generateNarrative(
      'Cooperativa Test',
      'nim',
      0.035,
      0.03,
    );
    expect(result).toContain('Cooperativa Test');
    expect(result).toContain('NIM');
    expect(result).toContain('por encima');
    expect(result).toContain('COSSEC CC-2022-03');
  });

  it('generateNarrative uses "por debajo" when value is below peer', async () => {
    const result = await service.generateNarrative(
      'Cooperativa ABC',
      'lcr',
      0.8,
      1.0,
    );
    expect(result).toContain('por debajo');
  });

  it('generateNarrative caches results', async () => {
    const result1 = await service.generateNarrative('Inst', 'nim', 0.04, 0.03);
    const result2 = await service.generateNarrative('Inst', 'nim', 0.04, 0.03);
    expect(result1).toBe(result2);
  });

  it('generateDashboardNarratives returns narratives for multiple metrics', async () => {
    const metrics = {
      nim: { value: 0.035, peerMedian: 0.03 },
      lcr: { value: 1.2, peerMedian: 1.0 },
    };
    const result = await service.generateDashboardNarratives(
      'Cooperativa X',
      metrics,
    );
    expect(Object.keys(result)).toEqual(['nim', 'lcr']);
    expect(result.nim).toContain('NIM');
    expect(result.lcr).toContain('LCR');
  });
});
