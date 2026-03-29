import { DataQualityService } from './data-quality.service';

describe('DataQualityService', () => {
  let service: DataQualityService;

  beforeEach(() => {
    service = new DataQualityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should validate price data with all valid points', () => {
    const report = service.validatePriceData([
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: 101 },
      { date: '2026-01-03', close: 102 },
    ]);
    expect(report.qualityScore).toBe(100);
    expect(report.validPoints).toBe(3);
    expect(report.invalidPoints).toBe(0);
  });

  it('should detect missing close prices', () => {
    const report = service.validatePriceData([
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: null },
    ]);
    expect(report.invalidPoints).toBe(1);
    expect(report.qualityScore).toBe(50);
  });

  it('should detect negative prices', () => {
    const report = service.validatePriceData([
      { date: '2026-01-01', close: 100 },
      { date: '2026-01-02', close: -5 },
    ]);
    expect(report.invalidPoints).toBe(1);
    expect(report.issues.length).toBeGreaterThan(0);
  });

  it('should record and retrieve quality metrics', () => {
    service.recordMetric('yahoo', { successfulRequests: 1, avgLatencyMs: 50 });
    service.recordMetric('yahoo', { successfulRequests: 2, avgLatencyMs: 40 });

    const metric = service.getMetrics('yahoo') as any;
    expect(metric).toBeDefined();
    expect(metric.totalRequests).toBe(2);
  });

  it('should return healthy status when no metrics exist', () => {
    const freshService = new DataQualityService();
    const health = freshService.getHealthStatus();
    expect(health.status).toBe('healthy');
    expect(health.message).toContain('No metrics');
  });
});
