import { DegradationService } from './degradation.service';

describe('DegradationService', () => {
  let service: DegradationService;

  beforeEach(() => {
    service = new DegradationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('resolve', () => {
    it('should return live data when computeFn succeeds', async () => {
      const result = await service.resolve(
        'test-key',
        async () => ({ value: 42 }),
        () => ({ value: 0 }),
      );

      expect(result.level).toBe('live');
      expect(result.data.value).toBe(42);
      expect(result.warning).toBeUndefined();
    });

    it('should return cached data when computeFn fails and cache exists', async () => {
      // First call: populate cache
      await service.resolve(
        'cached-key',
        async () => ({ value: 100 }),
        () => ({ value: 0 }),
      );

      // Second call: computeFn fails, should fall back to cache
      const result = await service.resolve(
        'cached-key',
        async () => {
          throw new Error('DB down');
        },
        () => ({ value: 0 }),
      );

      expect(result.level).toBe('cached');
      expect(result.data.value).toBe(100);
      expect(result.cachedAt).toBeDefined();
      expect(result.warning).toContain('cached data');
    });

    it('should return demo data when computeFn fails and no cache', async () => {
      const result = await service.resolve(
        'no-cache-key',
        async () => {
          throw new Error('Service unavailable');
        },
        () => ({ value: -1, demo: true }),
      );

      expect(result.level).toBe('demo');
      expect(result.data.demo).toBe(true);
      expect(result.warning).toContain('demo data');
    });

    it('should use different cache keys independently', async () => {
      await service.resolve(
        'key-a',
        async () => ({ name: 'Alpha' }),
        () => ({ name: 'Demo' }),
      );
      await service.resolve(
        'key-b',
        async () => ({ name: 'Beta' }),
        () => ({ name: 'Demo' }),
      );

      // Fail key-a, should get its cached value (not key-b's)
      const result = await service.resolve(
        'key-a',
        async () => {
          throw new Error('fail');
        },
        () => ({ name: 'Demo' }),
      );

      expect(result.level).toBe('cached');
      expect(result.data.name).toBe('Alpha');
    });
  });
});
