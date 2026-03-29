import { GracefulShutdownService } from './graceful-shutdown.service';

describe('GracefulShutdownService', () => {
  let service: GracefulShutdownService;

  beforeEach(() => {
    service = new GracefulShutdownService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('track and complete', () => {
    it('should start with zero pending tasks', () => {
      expect(service.pending).toBe(0);
    });

    it('should increment pending on track()', () => {
      service.track();
      expect(service.pending).toBe(1);

      service.track();
      expect(service.pending).toBe(2);
    });

    it('should decrement pending on complete()', () => {
      service.track();
      service.track();
      service.complete();
      expect(service.pending).toBe(1);
    });

    it('should not go below zero on extra complete() calls', () => {
      service.complete();
      service.complete();
      expect(service.pending).toBe(0);
    });
  });

  describe('onApplicationShutdown', () => {
    it('should resolve immediately when no active tasks', async () => {
      await expect(
        service.onApplicationShutdown('SIGTERM'),
      ).resolves.not.toThrow();
    });

    it('should wait for tasks to drain before shutdown', async () => {
      service.track();

      const shutdownPromise = service.onApplicationShutdown('SIGINT');

      // Simulate task completing after a short delay
      setTimeout(() => service.complete(), 50);

      await expect(shutdownPromise).resolves.not.toThrow();
      expect(service.pending).toBe(0);
    });

    it('should resolve after drain timeout even with pending tasks', async () => {
      service.track();
      // Intentionally do NOT call complete()

      // Reduce drain timeout for test speed
      (service as any).DRAIN_TIMEOUT_MS = 100;

      const start = Date.now();
      await service.onApplicationShutdown('SIGTERM');
      const elapsed = Date.now() - start;

      // Should have waited about 100ms (the reduced timeout)
      expect(elapsed).toBeGreaterThanOrEqual(90);
      expect(service.pending).toBe(1); // still pending since we never completed
    });
  });
});
