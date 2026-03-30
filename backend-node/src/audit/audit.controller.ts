import {
  Controller,
  Get,
  Query,
  Headers,
  Req,
  UseGuards,
  UnauthorizedException,
  Logger,
} from '@nestjs/common';
import { AuditService } from './audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';

// ── Admin Audit Endpoint ──────────────────────────────────
// GET /api/admin/audit-logs?institutionId=X&limit=100&offset=0
// Requires x-admin-key header

@Controller('api/admin')
export class AdminAuditController {
  private readonly logger = new Logger(AdminAuditController.name);

  constructor(private readonly audit: AuditService) {}

  private verifyAdmin(key: string) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  @Get('audit-logs')
  async getAuditLogs(
    @Headers('x-admin-key') adminKey: string,
    @Query('institutionId') institutionId?: string,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    this.verifyAdmin(adminKey);

    return this.audit.adminQuery({
      institutionId: institutionId || undefined,
      limit: limit ? parseInt(limit, 10) : 100,
      offset: offset ? parseInt(offset, 10) : 0,
    });
  }
}

// ── Portal Audit Endpoint ─────────────────────────────────
// GET /api/portal/audit-log
// Requires auth; OWNER sees full institution log, others see own logs only

@Controller('api/portal')
@UseGuards(AuthGuard)
export class PortalAuditController {
  private readonly logger = new Logger(PortalAuditController.name);

  constructor(
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  @Get('audit-log')
  async getAuditLog(
    @Req() req: any,
    @Query('limit') limit?: string,
    @Query('offset') offset?: string,
  ) {
    const userId = req.user.userId;
    const userRole = req.user.role;

    const parsedLimit = limit ? parseInt(limit, 10) : 100;
    const parsedOffset = offset ? parseInt(offset, 10) : 0;

    // OWNER role: find their institution and return full institution audit log
    if (userRole === 'OWNER') {
      // Look up user's institution via report jobs or workspaces
      const user = await this.prisma.user.findUnique({
        where: { id: userId },
        select: { role: true },
      });

      if (user?.role === 'OWNER') {
        // Find any institution linked to this user's report jobs
        const recentJob = await this.prisma.reportJob.findFirst({
          where: { userId, institutionId: { not: null } },
          orderBy: { createdAt: 'desc' },
          select: { institutionId: true },
        });

        if (recentJob?.institutionId) {
          return this.audit.queryByInstitution(recentJob.institutionId, {
            limit: parsedLimit,
            offset: parsedOffset,
            daysBack: 90,
          });
        }
      }
    }

    // Non-OWNER or no institution found: return user's own audit log
    return this.audit.queryByUser(userId, {
      limit: parsedLimit,
      offset: parsedOffset,
      daysBack: 90,
    });
  }
}
