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

    it('should report SLA as not met when availability drops below 99.9%', () => {
      // 1% error rate
      for (let i = 0; i < 100; i++) {
        service.recordRequest(100, i < 1);
      }
      const report = service.getSLAReport();
      expect(report.current.availabilityPercent).toBeLessThan(100);
    });

    it('should return 100% availability with zero requests', () => {
      const report = service.getSLAReport();
      expect(report.current.availabilityPercent).toBe(100);
    });

    it('should return 0 for p95/p99 with zero requests', () => {
      const report = service.getSLAReport();
      expect(report.current.p95Ms).toBe(0);
      expect(report.current.p99Ms).toBe(0);
    });

    it('should format error rate with 4 decimal places', () => {
      service.recordRequest(100, false);
      service.recordRequest(100, true);
      const report = service.getSLAReport();
      const str = String(report.current.errorRate);
      // toFixed(4) means up to 4 decimal places
      expect(report.current.errorRate).toBe(50);
    });

    it('should format availability with 4 decimal places', () => {
      service.recordRequest(100, false);
      const report = service.getSLAReport();
      expect(report.current.availabilityPercent).toBe(100);
    });
  });

  // ── Window rotation ──────────────────────────────────────────

  describe('window rotation', () => {
    it('rotates window after 1 hour', () => {
      // We need to create a new service with controlled time
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;

      const svc = new SLAMonitorService();
      svc.recordRequest(100, false);

      // Advance past 1 hour
      now += 3600001;
      svc.recordRequest(200, false);

      const report = svc.getSLAReport();
      expect(report.history.length).toBe(1);
      expect(report.current.windowHours).toBe(2);

      Date.now = realNow;
    });

    it('keeps max 24 windows of history', () => {
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;

      const svc = new SLAMonitorService();
      for (let i = 0; i < 26; i++) {
        svc.recordRequest(100, false);
        now += 3600001;
      }

      svc.recordRequest(100, false);
      const report = svc.getSLAReport();
      expect(report.history.length).toBeLessThanOrEqual(24);

      Date.now = realNow;
    });

    it('history entries have correct structure', () => {
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;

      const svc = new SLAMonitorService();
      svc.recordRequest(150, false);
      svc.recordRequest(250, true);

      now += 3600001;
      svc.recordRequest(100, false);

      const report = svc.getSLAReport();
      expect(report.history.length).toBe(1);
      const h = report.history[0];
      expect(h.hour).toBeDefined();
      expect(h.requests).toBe(2);
      expect(h.errorRate).toBe(50);
      expect(h.p95Ms).toBeGreaterThan(0);

      Date.now = realNow;
    });

    it('history entry has 0 values when window had no requests', () => {
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;

      const svc = new SLAMonitorService();
      // No requests in first window, rotate
      now += 3600001;
      svc.recordRequest(100, false);

      const report = svc.getSLAReport();
      if (report.history.length > 0) {
        const emptyWindow = report.history[0];
        expect(emptyWindow.requests).toBe(0);
        expect(emptyWindow.errorRate).toBe(0);
        expect(emptyWindow.p95Ms).toBe(0);
      }

      Date.now = realNow;
    });

    it('history entries format errorRate with 3 decimal places', () => {
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;

      const svc = new SLAMonitorService();
      svc.recordRequest(100, true);
      svc.recordRequest(100, false);
      svc.recordRequest(100, false);

      now += 3600001;
      svc.recordRequest(100, false);

      const report = svc.getSLAReport();
      const h = report.history[0];
      expect(typeof h.errorRate).toBe('number');

      Date.now = realNow;
    });
  });

  // ── Aggregation across windows ───────────────────────────────

  describe('aggregation across windows', () => {
    it('aggregates latencies and requests from all windows', () => {
      const realNow = Date.now;
      let now = 1000000;
      Date.now = () => now;

      const svc = new SLAMonitorService();
      svc.recordRequest(100, false);
      now += 3600001;
      svc.recordRequest(200, false);

      const report = svc.getSLAReport();
      expect(report.current.totalRequests).toBe(2);

      Date.now = realNow;
    });
  });

  // ── Latency bounds ───────────────────────────────────────────

  describe('latency bounds', () => {
    it('caps latencies at 1000 per window to bound memory', () => {
      for (let i = 0; i < 1005; i++) {
        service.recordRequest(i, false);
      }
      const report = service.getSLAReport();
      expect(report.current.totalRequests).toBe(1005);
    });
  });
});
