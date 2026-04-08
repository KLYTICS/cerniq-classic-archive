import { ALCODashboardService } from './alco-dashboard.service';

describe('ALCODashboardService', () => {
  let service: ALCODashboardService;

  beforeEach(() => {
    service = new ALCODashboardService();
  });

  const healthyParams = {
    nim: 0.035,
    eve: 28_000_000,
    nii: 5_200_000,
    lcr: 142,
    nsfr: 118,
    capitalRatio: 12.5,
    durationGap: 1.8,
    camelScore: 2,
    earPct: 2.1,
    roeAnnualized: 0.08,
  };

  const stressedParams = {
    nim: 0.015,
    eve: 15_000_000,
    nii: 2_800_000,
    lcr: 72,
    nsfr: 85,
    capitalRatio: 4.5,
    durationGap: 5.2,
    camelScore: 4,
    earPct: 8.5,
    roeAnnualized: 0.02,
  };

  it('returns 7 metrics', () => {
    const r = service.aggregate(healthyParams);
    expect(r.metrics).toHaveLength(7);
  });

  it('all green for healthy institution', () => {
    const r = service.aggregate(healthyParams);
    expect(r.overallHealth).toBe('strong');
    expect(r.metrics.every((m) => m.status === 'green')).toBe(true);
  });

  it('needs_attention when any metric is red', () => {
    const r = service.aggregate(stressedParams);
    expect(r.overallHealth).toBe('needs_attention');
    expect(r.metrics.some((m) => m.status === 'red')).toBe(true);
  });

  it('NIM threshold: green ≥3%, amber ≥2%, red <2%', () => {
    expect(
      service.aggregate({ ...healthyParams, nim: 0.035 }).metrics[0].status,
    ).toBe('green');
    expect(
      service.aggregate({ ...healthyParams, nim: 0.025 }).metrics[0].status,
    ).toBe('amber');
    expect(
      service.aggregate({ ...healthyParams, nim: 0.015 }).metrics[0].status,
    ).toBe('red');
  });

  it('LCR threshold: green ≥100%, amber ≥80%, red <80%', () => {
    expect(
      service.aggregate({ ...healthyParams, lcr: 142 }).metrics[1].status,
    ).toBe('green');
    expect(
      service.aggregate({ ...healthyParams, lcr: 90 }).metrics[1].status,
    ).toBe('amber');
    expect(
      service.aggregate({ ...healthyParams, lcr: 70 }).metrics[1].status,
    ).toBe('red');
  });

  it('Duration Gap threshold: green ≤2yr, amber ≤4yr, red >4yr', () => {
    expect(
      service.aggregate({ ...healthyParams, durationGap: 1.5 }).metrics[4]
        .status,
    ).toBe('green');
    expect(
      service.aggregate({ ...healthyParams, durationGap: 3.5 }).metrics[4]
        .status,
    ).toBe('amber');
    expect(
      service.aggregate({ ...healthyParams, durationGap: 5.0 }).metrics[4]
        .status,
    ).toBe('red');
  });

  it('CAMEL threshold: green ≤2, amber ≤3, red >3', () => {
    expect(
      service.aggregate({ ...healthyParams, camelScore: 1 }).metrics[5].status,
    ).toBe('green');
    expect(
      service.aggregate({ ...healthyParams, camelScore: 3 }).metrics[5].status,
    ).toBe('amber');
    expect(
      service.aggregate({ ...healthyParams, camelScore: 4 }).metrics[5].status,
    ).toBe('red');
  });

  it('bilingual metrics have both name and nameEs', () => {
    const r = service.aggregate(healthyParams);
    r.metrics.forEach((m) => {
      expect(m.name.length).toBeGreaterThan(0);
      expect(m.nameEs.length).toBeGreaterThan(0);
    });
  });

  it('bilingual interpretation', () => {
    const r = service.aggregate(healthyParams);
    expect(r.interpretation).toContain('7/7 metrics green');
    expect(r.interpretationEs).toContain('7/7 metricas verdes');
  });

  it('adequate when multiple ambers but no reds', () => {
    const r = service.aggregate({
      ...healthyParams,
      nim: 0.025, // amber
      lcr: 90, // amber
      durationGap: 3.0, // amber
    });
    expect(r.overallHealth).toBe('adequate');
  });

  // D1 (2026-04-07): when an upstream metric is null (e.g. LCR returned
  // data_unavailable), the row renders with `value: '—'` and `status: 'info'`
  // (neutral grey). Previously the dashboard required `number` inputs and
  // would crash on null — or worse, callers would `?? 0` and create silent
  // false-failures.
  it('renders missing metrics as `—` with info status, never as red', () => {
    const r = service.aggregate({
      ...healthyParams,
      lcr: null, // upstream LCR was data_unavailable
    });
    const lcrMetric = r.metrics.find((m) => m.name === 'LCR')!;
    expect(lcrMetric.value).toBe('—');
    expect(lcrMetric.status).toBe('info');
    // The other metrics still render their real values.
    const nimMetric = r.metrics.find((m) => m.name === 'NIM')!;
    expect(nimMetric.status).toBe('green');
  });

  it('overallHealth is data_unavailable when more than half the metrics are missing', () => {
    const r = service.aggregate({
      nim: null,
      eve: null,
      nii: null,
      lcr: null,
      nsfr: null,
      capitalRatio: null,
      durationGap: null,
      camelScore: 2,
      earPct: 1.8,
      roeAnnualized: 0.08,
    });
    expect(r.overallHealth).toBe('data_unavailable');
    expect(r.interpretation).toMatch(/load institution data/i);
    expect(r.interpretationEs).toMatch(/cargue/i);
  });
});
