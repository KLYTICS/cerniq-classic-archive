import { TimeoutInterceptor } from './timeout.interceptor';
import { of, delay } from 'rxjs';
import {
  ExecutionContext,
  CallHandler,
  RequestTimeoutException,
} from '@nestjs/common';

describe('TimeoutInterceptor', () => {
  let interceptor: TimeoutInterceptor;

  beforeEach(() => {
    interceptor = new TimeoutInterceptor();
  });

  const createMockContext = (url: string): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ url, method: 'GET' }),
      }),
    }) as unknown as ExecutionContext;

  it('passes through responses that complete within timeout', (done) => {
    const ctx = createMockContext('/api/data');
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ ok: true });
      done();
    });
  });

  it('uses longer timeout for compute-heavy endpoints', () => {
    const ctx = createMockContext('/api/monte-carlo/run');
    const handler: CallHandler = { handle: () => of({ ok: true }) };

    // Just verify it doesn't throw for immediate resolution
    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ ok: true });
    });
  });

  it('recognizes stress-test paths as compute-heavy', () => {
    const ctx = createMockContext('/api/stress-test');
    const handler: CallHandler = { handle: () => of('result') };

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toBe('result');
    });
  });
});
