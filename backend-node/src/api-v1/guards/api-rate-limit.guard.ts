import {
  Injectable,
  CanActivate,
  ExecutionContext,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import type { ApiKeyUser } from './api-key-auth.guard';

/**
 * Per-API-key rate limiter.
 * Standard tier: 100 requests / hour
 * Partner tier:  1,000 requests / hour
 *
 * Uses an in-memory sliding window. In production with multiple
 * replicas, replace with Redis-backed counters.
 */

interface RateBucket {
  count: number;
  windowStart: number;
}

const WINDOW_MS = 60 * 60 * 1000; // 1 hour
const STANDARD_LIMIT = 100;
const PARTNER_LIMIT = 1000;

@Injectable()
export class ApiRateLimitGuard implements CanActivate {
  private buckets = new Map<string, RateBucket>();

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const request = context.switchToHttp().getRequest();
    const apiUser: ApiKeyUser | undefined = request.apiUser;

    if (!apiUser) {
      // If no apiUser yet, let request pass (ApiKeyAuthGuard will reject)
      return true;
    }

    const limit = apiUser.tier === 'partner' ? PARTNER_LIMIT : STANDARD_LIMIT;
    const now = Date.now();
    const key = apiUser.apiKeyId;

    let bucket = this.buckets.get(key);
    if (!bucket || now - bucket.windowStart >= WINDOW_MS) {
      bucket = { count: 0, windowStart: now };
      this.buckets.set(key, bucket);
    }

    bucket.count++;

    if (bucket.count > limit) {
      const retryAfterSec = Math.ceil(
        (bucket.windowStart + WINDOW_MS - now) / 1000,
      );
      const response = context.switchToHttp().getResponse();
      response.setHeader('Retry-After', String(retryAfterSec));
      response.setHeader('X-RateLimit-Limit', String(limit));
      response.setHeader('X-RateLimit-Remaining', '0');
      response.setHeader(
        'X-RateLimit-Reset',
        String(Math.ceil((bucket.windowStart + WINDOW_MS) / 1000)),
      );

      throw new HttpException(
        {
          success: false,
          error: 'Rate limit exceeded',
          message: `API key rate limit of ${limit} requests/hour exceeded. Upgrade to Partner tier for higher limits.`,
          retryAfterSeconds: retryAfterSec,
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // Set rate limit headers on success too
    const response = context.switchToHttp().getResponse();
    response.setHeader('X-RateLimit-Limit', String(limit));
    response.setHeader('X-RateLimit-Remaining', String(limit - bucket.count));
    response.setHeader(
      'X-RateLimit-Reset',
      String(Math.ceil((bucket.windowStart + WINDOW_MS) / 1000)),
    );

    return true;
  }
}
