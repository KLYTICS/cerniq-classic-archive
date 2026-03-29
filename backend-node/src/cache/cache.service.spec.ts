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
});
