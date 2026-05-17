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

// OrgMembershipGuard verifies the JWT-authenticated caller belongs to the
// organization referenced in the URL — either directly via `:orgId`, or
// transitively via `:cycleId` → CloseCycle.organizationId. It mirrors the
// InstitutionScopeGuard pattern (see commit 8f69c148, agent-api/guards/) but
// for the organization-scoped Close Cockpit surface where ownership flows
// through OrganizationMember instead of Workspace.ownerId.
//
// Why the cycleId resolver: every CloseCycle has a non-null organizationId
// FK, so cycle-scoped routes can be authorized by a single 1-hop lookup
// without changing controller signatures or service contracts.
//
// Pass-through when neither :orgId nor :cycleId is in the route — same rule
// that lets InstitutionScopeGuard sit at the controller class level on a
// mixed-route controller. AuthGuard upstream is the baseline auth check;
// when the route has nothing tenant-scoped to verify, we pass.
//
// Master CEO override mirrors auth.guard.ts so platform support and audit
// users keep cross-tenant access.
//
// FAIL-CLOSED on Prisma exceptions: a database outage becomes 403, never a
// generic 500 reported as silent allow.

@Injectable()
export class OrgMembershipGuard implements CanActivate {
  private readonly logger = new Logger(OrgMembershipGuard.name);

  constructor(private readonly prisma: PrismaService) {}

  async canActivate(context: ExecutionContext): Promise<boolean> {
    const req = context.switchToHttp().getRequest();
    const userId: string | undefined = req.user?.userId ?? req.user?.id;
    if (!userId) {
      throw new UnauthorizedException('authentication required');
    }

    if (req.user?.access?.isMasterCeo === true) {
      // Fast-path: skip cycleId resolution + membership lookup.
      // Mirrors the original pre-extraction behavior.
      return true;
    }

    let orgId: string | undefined = req.params?.orgId;

    if (!orgId && req.params?.cycleId) {
      let cycle: { organizationId: string } | null;
      try {
        cycle = await this.prisma.closeCycle.findUnique({
          where: { id: req.params.cycleId },
          select: { organizationId: true },
        });
      } catch (err) {
        this.logger.error(
          `cycle lookup failed for ${req.params.cycleId}: ${String(err)}`,
        );
        throw new ForbiddenException('cycle access check failed');
      }
      if (!cycle) {
        throw new NotFoundException('cycle not found');
      }
      orgId = cycle.organizationId;
    }

    if (!orgId) {
      return true;
    }

    await this.verifyMembership(orgId, userId, false);
    req.user.orgId = orgId;
    return true;
  }

  /**
   * Public membership-check primitive. Same contract as the `canActivate`
   * path but callable from non-HTTP contexts where `:orgId` is not in the
   * URL — controllers handling body-supplied `organizationId`, WebSocket
   * event handlers, scheduled jobs, etc.
   *
   * Mirrors `InstitutionScopeGuard.verifyOwnership` (commit `b2a64c25`)
   * one-to-one — same Prisma lookup shape, same `ForbiddenException` /
   * `NotFoundException` semantics so callers get matching HTTP status
   * codes via Nest's exception filter, same fail-closed-on-Prisma-throw
   * behaviour, same master-CEO bypass.
   *
   * Unblocks the body-supplied `organizationId` fix on
   * `agents/agents.controller.ts` (and the future audit-doc-flagged
   * fixes on `agent-trust`, `agent-eval`).
   */
  async verifyMembership(
    orgId: string,
    userId: string,
    isMasterCeo: boolean,
  ): Promise<void> {
    if (isMasterCeo) {
      return;
    }

    let member: { organizationId: string } | null;
    try {
      member = await this.prisma.organizationMember.findUnique({
        where: {
          organizationId_userId: { organizationId: orgId, userId },
        },
        select: { organizationId: true },
      });
    } catch (err) {
      this.logger.error(
        `membership lookup failed org=${orgId} user=${userId}: ${String(err)}`,
      );
      throw new ForbiddenException('organization access check failed');
    }

    if (!member) {
      this.logger.warn(
        `denied: user ${userId} attempted to access org ${orgId}`,
      );
      throw new ForbiddenException('not authorized for this organization');
    }
  }
}
