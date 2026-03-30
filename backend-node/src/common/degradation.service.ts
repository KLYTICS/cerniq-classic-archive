import { Injectable, Logger } from '@nestjs/common';

export type DegradationLevel = 'live' | 'cached' | 'demo' | 'static';

export interface DegradedResult<T> {
  data: T;
  level: DegradationLevel;
  cachedAt?: string;
  warning?: string;
}

// In-memory cache (production: Redis)
const cache = new Map<string, { data: any; cachedAt: string }>();

@Injectable()
export class DegradationService {
  private readonly logger = new Logger(DegradationService.name);

  private scheduleCacheEviction(key: string, delayMs: number): void {
    const evictionTimer = setTimeout(() => cache.delete(key), delayMs);
    if (evictionTimer.unref) {
      evictionTimer.unref();
    }
  }

  async resolve<T>(
    key: string,
    computeFn: () => Promise<T>,
    demoFn: () => T,
    cacheTtlMs: number = 3600000,
  ): Promise<DegradedResult<T>> {
    // Level 1: Live computation
    try {
      const data = await computeFn();
      cache.set(key, { data, cachedAt: new Date().toISOString() });
      this.scheduleCacheEviction(key, cacheTtlMs * 24);
      return { data, level: 'live' };
    } catch (liveError: any) {
      this.logger.warn(
        `Live computation failed for ${key}: ${liveError.message}`,
      );
    }

    // Level 2: Cached result
    const cached = cache.get(key);
    if (cached) {
      return {
        data: cached.data as T,
        level: 'cached',
        cachedAt: cached.cachedAt,
        warning: `Showing cached data from ${new Date(cached.cachedAt).toLocaleDateString('es-PR')}.`,
      };
    }

    // Level 3: Demo data
    this.logger.warn(`Serving demo data for ${key}`);
    return {
      data: demoFn(),
      level: 'demo',
      warning: 'Using demo data — live computation temporarily unavailable.',
    };
  }
}
