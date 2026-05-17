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

// FirmOwnsClientGuard verifies the route's `:firmId` has an active
// `CpaClientRelationship` with the route's `:institutionId` (i.e.
// `removedAt IS NULL`).
//
// Companion to InstitutionScopeGuard for the CPA white-label surface
// where the tenancy contract is "this firm has a relationship with this
// client institution," not "this user owns this institution." Sits at
// the controller layer for fail-fast and uniform 403/404 semantics; the
// existing service-layer check in `CpaClientService.removeClient`
// remains as defense-in-depth.
//
// Pass-through when either `:firmId` or `:institutionId` is absent —
// same rule that lets `InstitutionScopeGuard` sit at class level on
// mixed-route controllers. Routes lacking the param shape (e.g.
// `GET /api/cpa/firms/:firmId/clients` — list endpoint with no
// `:institutionId`) don't have a relationship to verify; `AuthGuard`
// and `RolesGuard` upstream are the baseline.
//
// Master CEO bypass mirrors `auth.guard.ts` so platform support and
// audit users keep cross-tenant access.
//
// FAIL-CLOSED on Prisma exceptions: a database outage becomes 403,
// never a silent allow.

@Injectable()
export class FirmOwnsClientGuard implements CanActivate {
  private readonly logger = new Logger(FirmOwnsClientGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined =
      req.user?.userId ?? req.user?.id ?? req.user?.sub;
    if (!userId) {
      throw new UnauthorizedException('authentication required');
    }

    if (req.user?.access?.isMasterCeo === true) {
      return true;
    }

    const firmId: string | undefined = req.params?.firmId;
    const institutionId: string | undefined = req.params?.institutionId;
    if (!firmId || !institutionId) {
      return true;
    }

    let relationship: { id: string } | null;
    try {
      relationship = await this.prisma.cpaClientRelationship.findFirst({
        where: { cpaFirmId: firmId, institutionId, removedAt: null },
        select: { id: true },
      });
    } catch (err) {
      this.logger.error(
        `relationship lookup failed firm=${firmId} inst=${institutionId}: ${String(err)}`,
      );
      throw new ForbiddenException('firm-client relationship check failed');
    }

    if (!relationship) {
      this.logger.warn(
        `denied: firm ${firmId} has no active relationship with institution ${institutionId} (user=${userId})`,
      );
      throw new NotFoundException('firm-client relationship not found');
    }

    return true;
  }
}
