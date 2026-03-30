import { RateLimitByUserGuard } from './rate-limit-by-user.guard';
import { HttpException, HttpStatus, ExecutionContext } from '@nestjs/common';

describe('RateLimitByUserGuard', () => {
  let guard: RateLimitByUserGuard;

  beforeEach(() => {
    jest.useFakeTimers();
    guard = new RateLimitByUserGuard(3, 60_000); // 3 requests per 60s
  });

  afterEach(() => {
    guard?.onModuleDestroy();
    jest.useRealTimers();
  });

  const createMockContext = (
    userId?: string,
    ip: string = '127.0.0.1',
  ): { ctx: ExecutionContext; res: any } => {
    const res = { setHeader: jest.fn() };
    const ctx = {
      switchToHttp: () => ({
        getRequest: () => ({
          user: userId ? { id: userId } : undefined,
          ip,
        }),
        getResponse: () => res,
      }),
    } as unknown as ExecutionContext;
    return { ctx, res };
  };

  it('should allow requests within the limit', () => {
    const { ctx } = createMockContext('user-1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should set rate limit headers on response', () => {
    const { ctx, res } = createMockContext('user-1');
    guard.canActivate(ctx);

    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Limit', '3');
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '2');
  });

  it('should decrement remaining count with each request', () => {
    const { ctx: ctx1, res: res1 } = createMockContext('user-2');
    guard.canActivate(ctx1);
    expect(res1.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '2');

    const { ctx: ctx2, res: res2 } = createMockContext('user-2');
    guard.canActivate(ctx2);
    expect(res2.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '1');

    const { ctx: ctx3, res: res3 } = createMockContext('user-2');
    guard.canActivate(ctx3);
    expect(res3.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('should throw HttpException when rate limit is exceeded', () => {
    const userId = 'user-3';
    for (let i = 0; i < 3; i++) {
      const { ctx } = createMockContext(userId);
      guard.canActivate(ctx);
    }

    const { ctx } = createMockContext(userId);
    expect(() => guard.canActivate(ctx)).toThrow(HttpException);
  });

  it('should throw 429 status when rate limited', () => {
    const userId = 'user-4';
    for (let i = 0; i < 3; i++) {
      const { ctx } = createMockContext(userId);
      guard.canActivate(ctx);
    }

    const { ctx } = createMockContext(userId);
    try {
      guard.canActivate(ctx);
      fail('Expected exception');
    } catch (e: any) {
      expect(e.getStatus()).toBe(HttpStatus.TOO_MANY_REQUESTS);
    }
  });

  it('should set Retry-After header when rate limited', () => {
    const userId = 'user-5';
    for (let i = 0; i < 3; i++) {
      const { ctx } = createMockContext(userId);
      guard.canActivate(ctx);
    }

    const { ctx, res } = createMockContext(userId);
    try {
      guard.canActivate(ctx);
    } catch {
      // expected
    }
    expect(res.setHeader).toHaveBeenCalledWith(
      'Retry-After',
      expect.any(String),
    );
    expect(res.setHeader).toHaveBeenCalledWith('X-RateLimit-Remaining', '0');
  });

  it('should track different users independently', () => {
    for (let i = 0; i < 3; i++) {
      const { ctx } = createMockContext('user-a');
      guard.canActivate(ctx);
    }

    // user-b should still be allowed
    const { ctx } = createMockContext('user-b');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should fall back to IP when no user is authenticated', () => {
    const { ctx } = createMockContext(undefined, '10.0.0.1');
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('should allow requests after window expires', () => {
    const userId = 'user-expire';
    for (let i = 0; i < 3; i++) {
      const { ctx } = createMockContext(userId);
      guard.canActivate(ctx);
    }

    // Advance time past the window
    jest.advanceTimersByTime(61_000);

    const { ctx } = createMockContext(userId);
    expect(guard.canActivate(ctx)).toBe(true);
  });

  it('unrefs and clears the background cleanup timer', () => {
    jest.useRealTimers();
    const timer = { unref: jest.fn() } as unknown as NodeJS.Timeout;
    const setIntervalSpy = jest
      .spyOn(global, 'setInterval')
      .mockReturnValue(timer);
    const clearIntervalSpy = jest.spyOn(global, 'clearInterval');

    const testGuard = new RateLimitByUserGuard(3, 60_000);

    expect((timer as any).unref).toHaveBeenCalled();

    testGuard.onModuleDestroy();

    expect(clearIntervalSpy).toHaveBeenCalledWith(timer);

    setIntervalSpy.mockRestore();
    clearIntervalSpy.mockRestore();
    jest.useFakeTimers();
  });
});
