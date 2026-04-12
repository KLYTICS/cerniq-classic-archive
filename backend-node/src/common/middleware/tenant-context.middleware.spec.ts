import { TenantContextMiddleware } from './tenant-context.middleware';

describe('TenantContextMiddleware', () => {
  let middleware: TenantContextMiddleware;
  let mockPrisma: { $executeRaw: jest.Mock };

  beforeEach(() => {
    mockPrisma = { $executeRaw: jest.fn().mockResolvedValue(undefined) };
    middleware = new TenantContextMiddleware(mockPrisma as any);
  });

  it('sets tenant context for authenticated requests with institutionId', async () => {
    const req: any = {
      headers: {},
      user: { institutionId: 'inst_abc123' },
    };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    // Verify the tagged template literal was called (Prisma parameterized query).
    // The first argument is a TemplateStringsArray; the second is the interpolated value.
    const call = mockPrisma.$executeRaw.mock.calls[0];
    // Tagged template calls pass [strings, ...values]
    expect(call[0]).toBeDefined(); // TemplateStringsArray
    expect(next).toHaveBeenCalled();
  });

  it('sets admin_mode for requests with x-admin-key header', async () => {
    const req: any = {
      headers: { 'x-admin-key': 'secret-admin-key-value' },
    };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalled();
  });

  it('does not set any context for unauthenticated requests', async () => {
    const req: any = { headers: {} };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('does not set tenant context when user has no institutionId', async () => {
    const req: any = {
      headers: {},
      user: { email: 'user@example.com' },
    };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(mockPrisma.$executeRaw).not.toHaveBeenCalled();
    expect(next).toHaveBeenCalled();
  });

  it('calls next() even if $executeRaw fails for tenant context', async () => {
    mockPrisma.$executeRaw.mockRejectedValue(new Error('DB connection lost'));
    const req: any = {
      headers: {},
      user: { institutionId: 'inst_abc123' },
    };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('calls next() even if $executeRaw fails for admin mode', async () => {
    mockPrisma.$executeRaw.mockRejectedValue(new Error('DB connection lost'));
    const req: any = {
      headers: { 'x-admin-key': 'secret-key' },
    };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    expect(next).toHaveBeenCalled();
  });

  it('prioritizes admin mode over tenant context when both are present', async () => {
    const req: any = {
      headers: { 'x-admin-key': 'secret-key' },
      user: { institutionId: 'inst_abc123' },
    };
    const res: any = {};
    const next = jest.fn();

    await middleware.use(req, res, next);

    // Should only set admin_mode, not tenant context
    expect(mockPrisma.$executeRaw).toHaveBeenCalledTimes(1);
    expect(next).toHaveBeenCalled();
  });
});
