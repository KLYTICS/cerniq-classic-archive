import {
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
  type ExecutionContext,
} from '@nestjs/common';
import { InstitutionScopeGuard } from './institution-scope.guard';
import type { PrismaService } from '../../prisma.service';

describe('InstitutionScopeGuard', () => {
  let prisma: { institution: { findUnique: jest.Mock } };
  let guard: InstitutionScopeGuard;

  const createContext = (overrides: {
    userId?: string;
    institutionId?: string;
    isMasterCeo?: boolean;
  }): { ctx: ExecutionContext; req: any } => {
    const req: any = {
      user: overrides.userId
        ? {
            userId: overrides.userId,
            access: overrides.isMasterCeo ? { isMasterCeo: true } : {},
          }
        : undefined,
      params: overrides.institutionId
        ? { institutionId: overrides.institutionId }
        : {},
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    return { ctx, req };
  };

  beforeEach(() => {
    prisma = { institution: { findUnique: jest.fn() } };
    guard = new InstitutionScopeGuard(prisma as unknown as PrismaService);
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    const { ctx } = createContext({ institutionId: 'inst-1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('throws Forbidden when :institutionId path param is missing', async () => {
    const { ctx } = createContext({ userId: 'user-1' });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('throws NotFound when the institution does not exist', async () => {
    prisma.institution.findUnique.mockResolvedValue(null);
    const { ctx } = createContext({
      userId: 'user-1',
      institutionId: 'missing',
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('throws Forbidden when caller is not the workspace owner', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      workspace: { ownerId: 'other-user' },
    });
    const { ctx } = createContext({
      userId: 'user-1',
      institutionId: 'inst-1',
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });

  it('allows access when caller owns the institution and sets req.user.institutionId', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      workspace: { ownerId: 'user-1' },
    });
    const { ctx, req } = createContext({
      userId: 'user-1',
      institutionId: 'inst-1',
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user.institutionId).toBe('inst-1');
  });

  it('allows master CEO bypass even when ownership does not match (and still sets institutionId for RLS)', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      workspace: { ownerId: 'other-user' },
    });
    const { ctx, req } = createContext({
      userId: 'user-1',
      institutionId: 'inst-1',
      isMasterCeo: true,
    });
    await expect(guard.canActivate(ctx)).resolves.toBe(true);
    expect(req.user.institutionId).toBe('inst-1');
  });

  it('fails closed (Forbidden) when Prisma throws during ownership lookup', async () => {
    prisma.institution.findUnique.mockRejectedValue(new Error('db down'));
    const { ctx } = createContext({
      userId: 'user-1',
      institutionId: 'inst-1',
    });
    await expect(guard.canActivate(ctx)).rejects.toBeInstanceOf(
      ForbiddenException,
    );
  });
});
