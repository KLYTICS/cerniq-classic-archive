import { CacheService } from './cache.service';

// Mock ioredis
jest.mock('ioredis', () => {
  return jest.fn().mockImplementation(() => ({
    ping: jest.fn().mockResolvedValue('PONG'),
    get: jest.fn().mockResolvedValue(null),
    setex: jest.fn().mockResolvedValue('OK'),
    del: jest.fn().mockResolvedValue(1),
    exists: jest.fn().mockResolvedValue(0),
    keys: jest.fn().mockResolvedValue([]),
    info: jest
      .fn()
      .mockResolvedValue('keyspace_hits:100\r\nkeyspace_misses:20'),
    dbsize: jest.fn().mockResolvedValue(50),
    flushall: jest.fn().mockResolvedValue('OK'),
    quit: jest.fn().mockResolvedValue('OK'),
    on: jest.fn().mockReturnThis(),
  }));
});

describe('CacheService', () => {
  let service: CacheService;

  beforeEach(async () => {
    service = new CacheService();
    await service.onModuleInit();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('ping returns true when Redis is connected', async () => {
    const result = await service.ping();
    expect(result).toBe(true);
  });

  it('get returns null for missing key', async () => {
    const result = await service.get('nonexistent');
    expect(result).toBeNull();
  });

  it('set stores value with TTL', async () => {
    await service.set('test-key', { data: 'value' }, 60);
    // No error thrown means success
    expect(true).toBe(true);
  });

  it('getOrSet calls fetchFn on cache miss and caches result', async () => {
    const fetchFn = jest.fn().mockResolvedValue({ computed: true });
    const result = await service.getOrSet('miss-key', fetchFn, 300);
    expect(fetchFn).toHaveBeenCalled();
    expect(result).toEqual({ computed: true });
  });

  it('getStats returns hits, misses, and key count', async () => {
    const stats = await service.getStats();
    expect(stats).toHaveProperty('hits');
    expect(stats).toHaveProperty('misses');
    expect(stats).toHaveProperty('keys');
    expect(stats.keys).toBe(50);
  });

  // ── Coverage boost: getOrSet cache hit, deletePattern, flushAll, exists ──
  describe('getOrSet with cache hit', () => {
    it('returns cached value without calling fetchFn', async () => {
      const redis = (service as any).redis;
      redis.get.mockResolvedValueOnce(JSON.stringify({ cached: true }));

      const fetchFn = jest.fn().mockResolvedValue({ computed: true });
      const result = await service.getOrSet('hit-key', fetchFn, 300);

      expect(fetchFn).not.toHaveBeenCalled();
      expect(result).toEqual({ cached: true });
    });
  });

  describe('deletePattern', () => {
    it('deletes all keys matching a pattern', async () => {
      const redis = (service as any).redis;
      redis.keys.mockResolvedValueOnce(['iv-surface:1', 'iv-surface:2']);
      redis.del.mockResolvedValueOnce(2);

      await service.deletePattern('iv-surface:*');
      expect(redis.keys).toHaveBeenCalledWith('iv-surface:*');
      expect(redis.del).toHaveBeenCalledWith('iv-surface:1', 'iv-surface:2');
    });

    it('does nothing when no keys match', async () => {
      const redis = (service as any).redis;
      redis.keys.mockResolvedValueOnce([]);

      await service.deletePattern('no-match:*');
      expect(redis.del).not.toHaveBeenCalled();
    });
  });

  describe('flushAll', () => {
    it('calls redis.flushall', async () => {
      const redis = (service as any).redis;
      redis.flushall.mockResolvedValueOnce('OK');

      await service.flushAll();
      expect(redis.flushall).toHaveBeenCalled();
    });
  });

  describe('exists', () => {
    it('returns true when key exists', async () => {
      const redis = (service as any).redis;
      redis.exists.mockResolvedValueOnce(1);

      const result = await service.exists('some-key');
      expect(result).toBe(true);
    });

    it('returns false when key does not exist', async () => {
      const redis = (service as any).redis;
      redis.exists.mockResolvedValueOnce(0);

      const result = await service.exists('missing-key');
      expect(result).toBe(false);
    });
  });

  describe('graceful degradation when redis is null', () => {
    let nullService: CacheService;

    beforeEach(() => {
      nullService = new CacheService();
      (nullService as any).redis = null;
    });

    it('get returns null', async () => {
      expect(await nullService.get('key')).toBeNull();
    });

    it('set is a no-op', async () => {
      await expect(nullService.set('key', 'val', 60)).resolves.not.toThrow();
    });

    it('deletePattern is a no-op', async () => {
      await expect(nullService.deletePattern('*')).resolves.not.toThrow();
    });

    it('flushAll is a no-op', async () => {
      await expect(nullService.flushAll()).resolves.not.toThrow();
    });

    it('exists returns false', async () => {
      expect(await nullService.exists('key')).toBe(false);
    });

    it('ping returns false', async () => {
      expect(await nullService.ping()).toBe(false);
    });

    it('getOrSet calls fetchFn directly when no redis', async () => {
      const fetchFn = jest.fn().mockResolvedValue({ fresh: true });
      const result = await nullService.getOrSet('key', fetchFn, 60);
      expect(fetchFn).toHaveBeenCalled();
      expect(result).toEqual({ fresh: true });
    });
  });
});
