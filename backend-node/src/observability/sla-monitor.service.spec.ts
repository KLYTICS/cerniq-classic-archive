import { SLAMonitorService } from './sla-monitor.service';

describe('SLAMonitorService', () => {
  let service: SLAMonitorService;

  beforeEach(() => {
    service = new SLAMonitorService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('recordRequest', () => {
    it('should record successful requests', () => {
      service.recordRequest(100, false);
      service.recordRequest(200, false);

      const report = service.getSLAReport();
      expect(report.current.totalRequests).toBe(2);
      expect(report.current.errorRate).toBe(0);
    });

    it('should track error requests separately', () => {
      service.recordRequest(100, false);
      service.recordRequest(500, true);

      const report = service.getSLAReport();
      expect(report.current.totalRequests).toBe(2);
      expect(report.current.errorRate).toBeGreaterThan(0);
    });
  });

  describe('getSLAReport', () => {
    it('should return correct SLA structure with no data', () => {
      const report = service.getSLAReport();

      expect(report).toHaveProperty('targets');
      expect(report).toHaveProperty('current');
      expect(report).toHaveProperty('history');
      expect(report.targets.availabilityPercent).toBe(99.9);
      expect(report.targets.p95LatencyMs).toBe(2000);
      expect(report.current.totalRequests).toBe(0);
      expect(report.current.overallSLAMet).toBe(true);
    });

    it('should calculate p95 and p99 latencies correctly', () => {
      // Record 100 requests with increasing latency
      for (let i = 1; i <= 100; i++) {
        service.recordRequest(i * 10, false);
      }

      const report = service.getSLAReport();
      expect(report.current.p95Ms).toBeGreaterThanOrEqual(900);
      expect(report.current.p99Ms).toBeGreaterThanOrEqual(980);
      expect(report.current.availabilityPercent).toBe(100);
    });

    it('should report SLA as not met when error rate is too high', () => {
      // 50% error rate exceeds 0.1% threshold
      service.recordRequest(100, true);
      service.recordRequest(100, false);

      const report = service.getSLAReport();
      expect(report.current.errorRateMet).toBe(false);
      expect(report.current.overallSLAMet).toBe(false);
    });

    it('should report SLA as not met when p95 exceeds 2000ms', () => {
      for (let i = 0; i < 100; i++) {
        service.recordRequest(2500, false);
      }

      const report = service.getSLAReport();
      expect(report.current.p95Met).toBe(false);
      expect(report.current.overallSLAMet).toBe(false);
    });
  });
});
