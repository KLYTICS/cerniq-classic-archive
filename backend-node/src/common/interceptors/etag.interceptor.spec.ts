import { ETagInterceptor } from './etag.interceptor';
import { of } from 'rxjs';
import { ExecutionContext, CallHandler } from '@nestjs/common';

describe('ETagInterceptor', () => {
  let interceptor: ETagInterceptor;

  beforeEach(() => {
    interceptor = new ETagInterceptor();
  });

  const createMockContext = (method: string, headers: Record<string, string> = {}): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ method, headers }),
        getResponse: () => ({
          setHeader: jest.fn(),
          status: jest.fn(),
        }),
      }),
    }) as unknown as ExecutionContext;

  it('skips non-GET requests', (done) => {
    const ctx = createMockContext('POST');
    const handler: CallHandler = { handle: () => of({ data: 'test' }) };

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(result).toEqual({ data: 'test' });
      done();
    });
  });

  it('sets ETag header on GET requests', (done) => {
    const ctx = createMockContext('GET');
    const res = ctx.switchToHttp().getResponse() as any;
    const handler: CallHandler = { handle: () => of({ data: 'test' }) };

    interceptor.intercept(ctx, handler).subscribe(() => {
      expect(res.setHeader).toHaveBeenCalledWith('ETag', expect.stringMatching(/^W\/"[a-f0-9]+"/));
      expect(res.setHeader).toHaveBeenCalledWith('Cache-Control', 'private, no-cache');
      done();
    });
  });

  it('returns 304 when If-None-Match matches', (done) => {
    const body = { data: 'test' };
    const json = JSON.stringify(body);
    const crypto = require('crypto');
    const hash = crypto.createHash('md5').update(json).digest('hex').slice(0, 16);
    const etag = `W/"${hash}"`;

    const ctx = createMockContext('GET', { 'if-none-match': etag });
    const res = ctx.switchToHttp().getResponse() as any;
    const handler: CallHandler = { handle: () => of(body) };

    interceptor.intercept(ctx, handler).subscribe((result) => {
      expect(res.status).toHaveBeenCalledWith(304);
      expect(result).toBeUndefined();
      done();
    });
  });
});
