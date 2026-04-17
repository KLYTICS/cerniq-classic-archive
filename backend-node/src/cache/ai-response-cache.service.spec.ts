import {
  AiResponseCacheService,
  AiResponsePayload,
  CachedAiResponse,
} from './ai-response-cache.service';
import { CacheService } from './cache.service';
import { RedisNamespaceService } from './redis-namespace.service';

describe('AiResponseCacheService', () => {
  let service: AiResponseCacheService;
  let cacheService: jest.Mocked<CacheService>;
  let namespace: RedisNamespaceService;

  const INST_ID = 'inst-42';
  const QUESTION_HASH = 'abc123def456';

  const samplePayload: AiResponsePayload = {
    content: 'Your liquidity ratio is 1.2x.',
    contentEs: 'Su ratio de liquidez es 1.2x.',
    modelId: 'claude-3-opus',
    tokenCount: 350,
    almModulesUsed: ['liquidity', 'capital'],
  };

  const sampleCached: CachedAiResponse = {
    content: 'Your liquidity ratio is 1.2x.',
    contentEs: 'Su ratio de liquidez es 1.2x.',
    modelId: 'claude-3-opus',
    cachedAt: '2026-04-16T12:00:00.000Z',
    tokenCount: 350,
  };

  beforeEach(() => {
    // Real namespace service (pure logic, no I/O)
    namespace = new RedisNamespaceService();

    // Mock CacheService
    cacheService = {
      get: jest.fn(),
      set: jest.fn(),
      delete: jest.fn(),
      deletePattern: jest.fn(),
      exists: jest.fn(),
      ping: jest.fn(),
      getOrSet: jest.fn(),
      getStats: jest.fn(),
      flushAll: jest.fn(),
      onModuleInit: jest.fn(),
      onModuleDestroy: jest.fn(),
    } as unknown as jest.Mocked<CacheService>;

    // Ensure no CACHE_AI_TTL_SECONDS is set for default tests
    delete process.env.CACHE_AI_TTL_SECONDS;

    service = new AiResponseCacheService(cacheService, namespace);
  });

  // ── getCachedResponse ──────────────────────────────────────────────

  describe('getCachedResponse()', () => {
    it('returns stored response on cache hit', async () => {
      cacheService.get.mockResolvedValue(sampleCached);

      const result = await service.getCachedResponse(INST_ID, QUESTION_HASH);

      expect(result).toEqual(sampleCached);
      expect(cacheService.get).toHaveBeenCalledWith(
        `cerniq:ai:${INST_ID}:${QUESTION_HASH}`,
      );
    });

    it('returns null on cache miss', async () => {
      cacheService.get.mockResolvedValue(null);

      const result = await service.getCachedResponse(INST_ID, QUESTION_HASH);

      expect(result).toBeNull();
    });

    it('returns null when cache throws', async () => {
      cacheService.get.mockRejectedValue(new Error('Redis down'));

      const result = await service.getCachedResponse(INST_ID, QUESTION_HASH);

      expect(result).toBeNull();
    });
  });

  // ── cacheResponse ──────────────────────────────────────────────────

  describe('cacheResponse()', () => {
    it('stores response with correct key and default TTL (3600s)', async () => {
      cacheService.set.mockResolvedValue(undefined);

      await service.cacheResponse(INST_ID, QUESTION_HASH, samplePayload);

      const expectedKey = `cerniq:ai:${INST_ID}:${QUESTION_HASH}`;
      expect(cacheService.set).toHaveBeenCalledWith(
        expectedKey,
        expect.objectContaining({
          content: samplePayload.content,
          contentEs: samplePayload.contentEs,
          modelId: samplePayload.modelId,
          tokenCount: samplePayload.tokenCount,
          cachedAt: expect.any(String),
        }),
        3600,
      );
    });

    it('respects CACHE_AI_TTL_SECONDS env override', async () => {
      process.env.CACHE_AI_TTL_SECONDS = '7200';
      const customService = new AiResponseCacheService(cacheService, namespace);
      cacheService.set.mockResolvedValue(undefined);

      await customService.cacheResponse(INST_ID, QUESTION_HASH, samplePayload);

      expect(cacheService.set).toHaveBeenCalledWith(
        expect.any(String),
        expect.any(Object),
        7200,
      );

      delete process.env.CACHE_AI_TTL_SECONDS;
    });

    it('handles cache write error gracefully', async () => {
      cacheService.set.mockRejectedValue(new Error('Write failed'));

      await expect(
        service.cacheResponse(INST_ID, QUESTION_HASH, samplePayload),
      ).resolves.toBeUndefined();
    });
  });

  // ── invalidateInstitution ──────────────────────────────────────────

  describe('invalidateInstitution()', () => {
    it('deletes all keys matching cerniq:ai:{institutionId}:*', async () => {
      cacheService.deletePattern.mockResolvedValue(undefined);

      await service.invalidateInstitution(INST_ID);

      expect(cacheService.deletePattern).toHaveBeenCalledWith(
        `cerniq:ai:${INST_ID}:*`,
      );
    });

    it('handles deletePattern error gracefully', async () => {
      cacheService.deletePattern.mockRejectedValue(new Error('Pattern failed'));

      await expect(
        service.invalidateInstitution(INST_ID),
      ).resolves.toBeUndefined();
    });
  });

  // ── computeQuestionHash ────────────────────────────────────────────

  describe('computeQuestionHash()', () => {
    it('returns a 64-char hex SHA-256 string', () => {
      const hash = service.computeQuestionHash('What is my NEL?');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('is deterministic — same input yields same output', () => {
      const a = service.computeQuestionHash('What is my NEL?');
      const b = service.computeQuestionHash('What is my NEL?');
      expect(a).toBe(b);
    });

    it('normalizes casing (lowercase)', () => {
      const upper = service.computeQuestionHash('What Is My NEL?');
      const lower = service.computeQuestionHash('what is my nel?');
      expect(upper).toBe(lower);
    });

    it('trims whitespace', () => {
      const padded = service.computeQuestionHash('  What is my NEL?  ');
      const clean = service.computeQuestionHash('What is my NEL?');
      expect(padded).toBe(clean);
    });

    it('produces different hash when ALM context differs', () => {
      const withoutCtx = service.computeQuestionHash('What is my NEL?');
      const withCtx = service.computeQuestionHash(
        'What is my NEL?',
        'liquidity-data',
      );
      expect(withoutCtx).not.toBe(withCtx);
    });

    it('handles empty question string', () => {
      const hash = service.computeQuestionHash('');
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });

    it('handles undefined almContext gracefully', () => {
      const hash = service.computeQuestionHash('test', undefined);
      expect(hash).toMatch(/^[a-f0-9]{64}$/);
    });
  });
});
