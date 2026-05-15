import {
  CanActivate,
  ExecutionContext,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  UnauthorizedException,
} from '@nestjs/common';
import { PrismaService } from '../../prisma.service';

// InstitutionScopeGuard verifies that the JWT-authenticated caller actually
// owns the institution named in the URL (`:institutionId` param). It also
// hands the verified id to `req.user.institutionId` so the existing
// TenantContextMiddleware can hydrate the RLS GUC variable on the same
// request.
//
// Why a dedicated guard: existing ALM controllers trust the URL param and
// rely on application-level filtering. RLS makes that safer at the row
// level, but we want a 403 (not just empty result sets) when a caller
// addresses someone else's institution. This guard is the explicit gate.
//
// FAIL-CLOSED: any database error or missing relation results in 403, never
// silent allow. AuthGuard MUST run first so `req.user` is populated.

@Injectable()
export class InstitutionScopeGuard implements CanActivate {
  private readonly logger = new Logger(InstitutionScopeGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.userId;
    if (!userId) {
      throw new UnauthorizedException('authentication required');
    }

    const institutionId: string | undefined = req.params?.institutionId;
    if (!institutionId) {
      throw new ForbiddenException('institutionId param required');
    }

    // Resolve the institution → workspace → owner chain. We use a single
    // query with a tight select so the guard adds at most one round-trip.
    // Fail-closed: any Prisma exception (connection loss, timeout, transient
    // error) becomes a 403 so an outage doesn't get reported to the client
    // as a generic 500.
    let institution: { workspace: { ownerId: string | null } | null } | null;
    try {
      institution = await this.prisma.institution.findUnique({
        where: { id: institutionId },
        select: { workspace: { select: { ownerId: true } } },
      });
    } catch (err) {
      this.logger.error(
        `institution lookup failed for ${institutionId}: ${String(err)}`,
      );
      throw new ForbiddenException('institution access check failed');
    }

    if (!institution) {
      throw new NotFoundException('institution not found');
    }

    // Master CEO override (existing platform pattern — see auth.guard.ts).
    // Master CEO can address any institution for support and audit.
    const isMasterCeo = !!req.user?.access?.isMasterCeo;
    if (!isMasterCeo && institution.workspace?.ownerId !== userId) {
      this.logger.warn(
        `denied: user ${userId} attempted to access institution ${institutionId}`,
      );
      throw new ForbiddenException('not authorized for this institution');
    }

    // Hand the verified id to the tenant middleware so RLS engages.
    req.user.institutionId = institutionId;
    return true;
  }
}
