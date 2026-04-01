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

  it('generateNarrative uses fallback prompt for unknown metric', async () => {
    const result = await service.generateNarrative(
      'Cooperativa Y',
      'unknown_metric',
      0.05,
      0.04,
    );
    expect(result).toContain('UNKNOWN_METRIC');
    expect(result).toContain('Cooperativa Y');
  });

  it('generateNarrative includes citation for known metrics', async () => {
    const result = await service.generateNarrative(
      'Test CU',
      'nwr',
      0.09,
      0.092,
    );
    expect(result).toContain('NCUA 12 C.F.R.');
    expect(result).toContain('por debajo');
  });

  it('generateNarrative returns favorable message when value >= peerMedian', async () => {
    const result = await service.generateNarrative(
      'Test CU',
      'eve',
      0.05,
      0.03,
    );
    expect(result).toContain('favorable');
    expect(result).toContain('por encima');
  });

  it('generateNarrative handles zero peerMedian without division by zero', async () => {
    const result = await service.generateNarrative(
      'Zero Peer CU',
      'nim',
      0.05,
      0,
    );
    expect(result).toBeDefined();
    expect(result.length).toBeGreaterThan(0);
  });
});
