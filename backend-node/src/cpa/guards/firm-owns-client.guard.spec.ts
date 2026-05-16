import {
  ExecutionContext,
  ForbiddenException,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { FirmOwnsClientGuard } from './firm-owns-client.guard';
import type { PrismaService } from '../../prisma.service';

// Mirrors the agent-api/guards/institution-scope.guard.spec.ts and
// close/guards/org-membership.guard.spec.ts patterns so reviewers
// recognise the contract: 401 if unauthenticated, pass-through for
// master CEO and missing-param routes, 403 on denied / fail-closed,
// 404 if relationship doesn't exist or was soft-removed.

describe('FirmOwnsClientGuard', () => {
  let prisma: { cpaClientRelationship: { findFirst: jest.Mock } };
  let guard: FirmOwnsClientGuard;

  const buildCtx = (
    user: any,
    params: Record<string, string | undefined> = {},
  ): ExecutionContext =>
    ({
      switchToHttp: () => ({
        getRequest: () => ({ user, params }),
      }),
    }) as unknown as ExecutionContext;

  beforeEach(() => {
    prisma = { cpaClientRelationship: { findFirst: jest.fn() } };
    guard = new FirmOwnsClientGuard(prisma as unknown as PrismaService);
  });

  it('throws Unauthorized when there is no authenticated user', async () => {
    await expect(
      guard.canActivate(
        buildCtx(undefined, { firmId: 'f1', institutionId: 'i1' }),
      ),
    ).rejects.toBeInstanceOf(UnauthorizedException);
  });

  it('passes through for Master CEO without touching the database', async () => {
    const ok = await guard.canActivate(
      buildCtx(
        { userId: 'u1', access: { isMasterCeo: true } },
        { firmId: 'f1', institutionId: 'i1' },
      ),
    );
    expect(ok).toBe(true);
    expect(prisma.cpaClientRelationship.findFirst).not.toHaveBeenCalled();
  });

  it('passes through when :institutionId is absent (list/dashboard routes)', async () => {
    const ok = await guard.canActivate(
      buildCtx({ userId: 'u1' }, { firmId: 'f1' }),
    );
    expect(ok).toBe(true);
    expect(prisma.cpaClientRelationship.findFirst).not.toHaveBeenCalled();
  });

  it('passes through when :firmId is absent (unusual but defense-in-depth)', async () => {
    const ok = await guard.canActivate(
      buildCtx({ userId: 'u1' }, { institutionId: 'i1' }),
    );
    expect(ok).toBe(true);
    expect(prisma.cpaClientRelationship.findFirst).not.toHaveBeenCalled();
  });

  it('allows when an active relationship exists', async () => {
    prisma.cpaClientRelationship.findFirst.mockResolvedValue({ id: 'rel-1' });
    const ok = await guard.canActivate(
      buildCtx({ userId: 'u1' }, { firmId: 'f1', institutionId: 'i1' }),
    );
    expect(ok).toBe(true);
    expect(prisma.cpaClientRelationship.findFirst).toHaveBeenCalledWith({
      where: { cpaFirmId: 'f1', institutionId: 'i1', removedAt: null },
      select: { id: true },
    });
  });

  it('throws NotFound when no active relationship exists', async () => {
    prisma.cpaClientRelationship.findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(
        buildCtx({ userId: 'u1' }, { firmId: 'f1', institutionId: 'i1' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('treats soft-removed relationships as not-existing (removedAt filter)', async () => {
    // The findFirst where-clause already filters `removedAt: null`, so a
    // soft-removed relationship returns null from Prisma — same 404 path.
    prisma.cpaClientRelationship.findFirst.mockResolvedValue(null);
    await expect(
      guard.canActivate(
        buildCtx({ userId: 'u1' }, { firmId: 'f1', institutionId: 'i1' }),
      ),
    ).rejects.toBeInstanceOf(NotFoundException);
  });

  it('fails closed (Forbidden) when the Prisma lookup throws', async () => {
    prisma.cpaClientRelationship.findFirst.mockRejectedValue(
      new Error('db down'),
    );
    await expect(
      guard.canActivate(
        buildCtx({ userId: 'u1' }, { firmId: 'f1', institutionId: 'i1' }),
      ),
    ).rejects.toBeInstanceOf(ForbiddenException);
  });

  it('reads userId via wider chain (userId → id → sub)', async () => {
    prisma.cpaClientRelationship.findFirst.mockResolvedValue({ id: 'rel-1' });

    await guard.canActivate(
      buildCtx({ userId: 'fresh' }, { firmId: 'f1', institutionId: 'i1' }),
    );
    await guard.canActivate(
      buildCtx({ id: 'legacy-id' }, { firmId: 'f1', institutionId: 'i1' }),
    );
    await guard.canActivate(
      buildCtx({ sub: 'legacy-sub' }, { firmId: 'f1', institutionId: 'i1' }),
    );
    // All three should reach the Prisma call (no UnauthorizedException).
    expect(prisma.cpaClientRelationship.findFirst).toHaveBeenCalledTimes(3);
  });
});
