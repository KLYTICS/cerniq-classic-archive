import { Injectable, Logger } from '@nestjs/common';
import * as crypto from 'crypto';
import { CacheService } from './cache.service';
import { RedisNamespaceService } from './redis-namespace.service';

/**
 * Cached AI response stored in Redis.
 */
export interface CachedAiResponse {
  content: string;
  contentEs?: string;
  modelId: string;
  cachedAt: string;
  tokenCount: number;
}

/**
 * Payload provided when caching a new AI response.
 */
export interface AiResponsePayload {
  content: string;
  contentEs?: string;
  modelId: string;
  tokenCount: number;
  almModulesUsed: string[];
}

/**
 * Caching layer for AI/LLM responses.
 *
 * Prevents duplicate LLM API calls for identical questions within
 * the same institution context (dedup + cost savings).
 *
 * TD-005: AI Response Caching
 */
const DEFAULT_TTL_SECONDS = 3600;

@Injectable()
export class AiResponseCacheService {
  private readonly logger = new Logger(AiResponseCacheService.name);
  private readonly defaultTtl: number;

  constructor(
    private readonly cache: CacheService,
    private readonly namespace: RedisNamespaceService,
  ) {
    this.defaultTtl = AiResponseCacheService.resolveTtlSeconds(
      process.env,
      (msg) => this.logger.warn(msg),
    );
  }

  /**
   * Resolve cache TTL from env. Exported static so specs can exercise
   * the resolution table. Previously `parseInt(raw, 10)` passed `NaN`
   * through to `cache.set(key, value, NaN)` on bad input — the
   * resulting Redis TTL is implementation-defined (no-TTL in ioredis,
   * which silently leaks keys forever).
   */
  static resolveTtlSeconds(
    env: NodeJS.ProcessEnv,
    warn: (msg: string) => void = () => {},
  ): number {
    const raw = env.CACHE_AI_TTL_SECONDS;
    if (raw === undefined || raw === '') return DEFAULT_TTL_SECONDS;

    const parsed = Number(raw);
    if (!Number.isFinite(parsed) || !Number.isInteger(parsed) || parsed < 1) {
      warn(
        `CACHE_AI_TTL_SECONDS="${raw}" is not a positive integer — using default ${DEFAULT_TTL_SECONDS}s`,
      );
      return DEFAULT_TTL_SECONDS;
    }
    return parsed;
  }

  /**
   * Look up a cached AI response.
   *
   * @returns The cached response, or null on miss.
   */
  async getCachedResponse(
    institutionId: string,
    questionHash: string,
  ): Promise<CachedAiResponse | null> {
    const key = this.namespace.aiKey(institutionId, questionHash);
    try {
      const cached = await this.cache.get<CachedAiResponse>(key);
      if (cached) {
        this.logger.debug(`AI cache HIT: ${key}`);
      }
      return cached;
    } catch (error) {
      this.logger.error(`AI cache get error for ${key}:`, error);
      return null;
    }
  }

  /**
   * Store an AI response in the cache.
   */
  async cacheResponse(
    institutionId: string,
    questionHash: string,
    response: AiResponsePayload,
  ): Promise<void> {
    const key = this.namespace.aiKey(institutionId, questionHash);
    const cached: CachedAiResponse = {
      content: response.content,
      contentEs: response.contentEs,
      modelId: response.modelId,
      cachedAt: new Date().toISOString(),
      tokenCount: response.tokenCount,
    };

    try {
      await this.cache.set(key, cached, this.defaultTtl);
      this.logger.debug(
        `AI cache SET: ${key} (TTL: ${this.defaultTtl}s, tokens: ${response.tokenCount})`,
      );
    } catch (error) {
      this.logger.error(`AI cache set error for ${key}:`, error);
    }
  }

  /**
   * Invalidate all cached AI responses for a given institution.
   * Useful when underlying ALM data changes and cached answers are stale.
   */
  async invalidateInstitution(institutionId: string): Promise<void> {
    const pattern = this.namespace.aiKey(institutionId, '*');
    try {
      await this.cache.deletePattern(pattern);
      this.logger.log(`AI cache invalidated for institution: ${institutionId}`);
    } catch (error) {
      this.logger.error(
        `AI cache invalidation error for institution ${institutionId}:`,
        error,
      );
    }
  }

  /**
   * Compute a deterministic SHA-256 hash of the question + optional ALM context.
   * The question is trimmed and lowercased for normalization.
   */
  computeQuestionHash(question: string, almContext?: string): string {
    const normalized = (question || '').trim().toLowerCase();
    const contextPart = almContext ? `|${almContext.trim()}` : '';
    return crypto
      .createHash('sha256')
      .update(`${normalized}${contextPart}`)
      .digest('hex');
  }
}
