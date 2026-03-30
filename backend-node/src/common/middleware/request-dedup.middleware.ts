import { Injectable, NestMiddleware } from '@nestjs/common';
import { Request, Response, NextFunction } from 'express';
import { createHash } from 'crypto';

/**
 * Deduplicates identical GET requests that are in-flight simultaneously.
 * If the same GET request (method + URL + auth header) arrives while one is
 * already processing, the second caller waits for the first result.
 */
@Injectable()
export class RequestDeduplicationMiddleware implements NestMiddleware {
  private readonly inflight = new Map<string, Promise<void>>();
  private readonly TTL_MS = 5000;

  use(req: Request, _res: Response, next: NextFunction): void {
    // Only dedup safe, idempotent methods
    if (req.method !== 'GET') {
      return next();
    }

    const key = this.buildKey(req);
    const existing = this.inflight.get(key);

    if (!existing) {
      const promise = new Promise<void>((resolve) => {
        let settled = false;
        const cleanup = () => {
          if (settled) return;
          settled = true;
          this.inflight.delete(key);
          resolve();
        };
        const timeout = setTimeout(cleanup, this.TTL_MS);
        timeout.unref?.();

        _res.on('finish', () => {
          clearTimeout(timeout);
          cleanup();
        });
      });
      this.inflight.set(key, promise);
    }

    next();
  }

  private buildKey(req: Request): string {
    const raw = `${req.method}:${req.originalUrl}:${req.headers.authorization ?? 'anon'}`;
    return createHash('sha256').update(raw).digest('hex').slice(0, 16);
  }
}
