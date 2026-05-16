import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { OrgMembershipGuard } from './org-membership.guard';

// Spec covers the 7 reachable branches of OrgMembershipGuard. Mirrors the
// shape of agent-api/guards/institution-scope.guard.spec.ts so reviewers
// recognise the contract.

describe('OrgMembershipGuard', () => {
  const buildCtx = (
    user: any,
    params: Record<string, string | undefined> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
    }) as unknown as ExecutionContext;

  const buildPrisma = (overrides: Record<string, any> = {}) =>
    ({
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue(null),
        ...(overrides.organizationMember ?? {}),
      },
      closeCycle: {
        findUnique: jest.fn().mockResolvedValue(null),
        ...(overrides.closeCycle ?? {}),
      },
    }) as any;

  it('throws Unauthorized when there is no authenticated user', async () => {
    const guard = new OrgMembershipGuard(buildPrisma());
    await expect(guard.canActivate(buildCtx(undefined))).rejects.toBeInstanceOf(
      UnauthorizedException,
    );
  });

  it('passes through for Master CEO without touching the database', async () => {
    const prisma = buildPrisma();
    const guard = new OrgMembershipGuard(prisma);
    const ok = await guard.canActivate(
      buildCtx(
        { userId: 'u1', access: { isMasterCeo: true } },
        { orgId: 'org-x' },
      ),
    );
    expect(ok).toBe(true);
    expect(prisma.organizationMember.findUnique).not.toHaveBeenCalled();
    expect(prisma.closeCycle.findUnique).not.toHaveBeenCalled();
  });

  it('passes through when neither :orgId nor :cycleId is in the route', async () => {
    const prisma = buildPrisma();
    const guard = new OrgMembershipGuard(prisma);
    const ok = await guard.canActivate(buildCtx({ userId: 'u1' }, {}));
    expect(ok).toBe(true);
    expect(prisma.organizationMember.findUnique).not.toHaveBeenCalled();
  });

  it('allows when the user is a member of the :orgId organization', async () => {
    const prisma = buildPrisma({
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
    });
    const guard = new OrgMembershipGuard(prisma);
    const req: { user: any; params: any } = {
      user: { userId: 'u1' },
      params: { orgId: 'org-1' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(req.user.orgId).toBe('org-1');
  });

  it('denies when the user is not a member of the :orgId organization', async () => {
    const prisma = buildPrisma();
    const guard = new OrgMembershipGuard(prisma);
    await expect(
      guard.canActivate(buildCtx({ userId: 'u1' }, { orgId: 'org-other' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('resolves :cycleId → orgId then enforces membership', async () => {
    const prisma = buildPrisma({
      closeCycle: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-7' }),
      },
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-7' }),
      },
    });
    const guard = new OrgMembershipGuard(prisma);
    const req: { user: any; params: any } = {
      user: { userId: 'u1' },
      params: { cycleId: 'cyc-1' },
    };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(prisma.closeCycle.findUnique).toHaveBeenCalledWith({
      where: { id: 'cyc-1' },
      select: { organizationId: true },
    });
    expect(req.user.orgId).toBe('org-7');
  });

  it('throws NotFound when :cycleId does not exist', async () => {
    const prisma = buildPrisma({
      closeCycle: { findUnique: jest.fn().mockResolvedValue(null) },
    });
    const guard = new OrgMembershipGuard(prisma);
    await expect(
      guard.canActivate(buildCtx({ userId: 'u1' }, { cycleId: 'missing' })),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails closed (403) when the cycle lookup throws', async () => {
    const prisma = buildPrisma({
      closeCycle: {
        findUnique: jest.fn().mockRejectedValue(new Error('connection lost')),
      },
    });
    const guard = new OrgMembershipGuard(prisma);
    await expect(
      guard.canActivate(buildCtx({ userId: 'u1' }, { cycleId: 'cyc-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('fails closed (403) when the membership lookup throws', async () => {
    const prisma = buildPrisma({
      organizationMember: {
        findUnique: jest.fn().mockRejectedValue(new Error('timeout')),
      },
    });
    const guard = new OrgMembershipGuard(prisma);
    await expect(
      guard.canActivate(buildCtx({ userId: 'u1' }, { orgId: 'org-1' })),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads userId from `id` when `userId` is absent (legacy auth shape)', async () => {
    const prisma = buildPrisma({
      organizationMember: {
        findUnique: jest.fn().mockResolvedValue({ organizationId: 'org-1' }),
      },
    });
    const guard = new OrgMembershipGuard(prisma);
    const req = { user: { id: 'u-legacy' }, params: { orgId: 'org-1' } };
    const ctx = {
      switchToHttp: () => ({ getRequest: () => req }),
    } as unknown as ExecutionContext;
    const ok = await guard.canActivate(ctx);
    expect(ok).toBe(true);
    expect(prisma.organizationMember.findUnique).toHaveBeenCalledWith({
      where: {
        organizationId_userId: { organizationId: 'org-1', userId: 'u-legacy' },
      },
      select: { organizationId: true },
    });
  });
});
