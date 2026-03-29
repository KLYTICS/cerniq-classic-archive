import { RequestDeduplicationMiddleware } from './request-dedup.middleware';

describe('RequestDeduplicationMiddleware', () => {
  let middleware: RequestDeduplicationMiddleware;

  beforeEach(() => {
    middleware = new RequestDeduplicationMiddleware();
  });

  const createMocks = (
    method: string,
    originalUrl: string,
    headers: Record<string, string> = {},
  ) => {
    const req = { method, originalUrl, headers } as any;
    const res = { on: jest.fn() } as any;
    const next = jest.fn();
    return { req, res, next };
  };

  it('should call next() for GET requests', () => {
    const { req, res, next } = createMocks('GET', '/api/data');
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should call next() for non-GET requests without dedup', () => {
    const { req, res, next } = createMocks('POST', '/api/data');
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });

  it('should skip dedup for POST requests', () => {
    const { req, res, next } = createMocks('POST', '/api/data');
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('should register a finish listener for GET requests', () => {
    const { req, res, next } = createMocks('GET', '/api/data');
    middleware.use(req, res, next);
    expect(res.on).toHaveBeenCalledWith('finish', expect.any(Function));
  });

  it('should call next for duplicate GET requests (non-blocking)', () => {
    const { req, res, next } = createMocks('GET', '/api/data', {
      authorization: 'Bearer token123',
    });
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();

    // Second identical request
    const mocks2 = createMocks('GET', '/api/data', {
      authorization: 'Bearer token123',
    });
    middleware.use(mocks2.req, mocks2.res, mocks2.next);
    expect(mocks2.next).toHaveBeenCalled();
  });

  it('should not register finish listener for duplicate inflight GET', () => {
    const { req, res, next } = createMocks('GET', '/api/data');
    middleware.use(req, res, next);

    const mocks2 = createMocks('GET', '/api/data');
    middleware.use(mocks2.req, mocks2.res, mocks2.next);
    // Second request should not register a new finish listener
    // (the inflight map already has the key)
    expect(mocks2.res.on).not.toHaveBeenCalled();
  });

  it('should skip dedup for PUT requests', () => {
    const { req, res, next } = createMocks('PUT', '/api/data');
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
    expect(res.on).not.toHaveBeenCalled();
  });

  it('should use anonymous key when no authorization header', () => {
    const { req, res, next } = createMocks('GET', '/api/users');
    middleware.use(req, res, next);
    expect(next).toHaveBeenCalled();
  });
});
