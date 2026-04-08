import {
  Controller,
  Get,
  Post,
  Param,
  Body,
  Req,
  Res,
  Logger,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiParam,
  ApiQuery,
  ApiConsumes,
  ApiBody,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { Roles } from '../auth/roles.decorator';
import { PrismaService } from '../prisma.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import { CSVIngestionService } from '../alm/csv-ingestion.service';
import { EmailService } from '../email/email.service';
import { IngestionLogsService } from '../alm/ingestion-logs.service';
import { DataCryptoService } from '../crypto/data-crypto.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { IsEmail, IsIn, IsOptional, IsString } from 'class-validator';
import { SkipAuditLog } from '../common/decorators/audit-action.decorator';
import { PlatformAccessService } from '../auth/platform-access.service';
import { PortalDocumentExportsService } from './portal-document-exports.service';
import { PortalAlmReportService } from './portal-alm-report.service';
import { DemoSeatService } from './demo-seat.service';
import { buildPdfResponseHeaders } from '../alm/document-exports.util';

class InviteDto {
  @IsEmail()
  email: string;

  @IsIn(['OWNER', 'ANALYST', 'VIEWER'])
  role: 'OWNER' | 'ANALYST' | 'VIEWER';

  @IsOptional()
  @IsString()
  name?: string;
}

@ApiTags('Client Portal')
@ApiBearerAuth('BearerAuth')
@Controller('api/portal')
@UseGuards(AuthGuard, RolesGuard)
export class PortalController {
  private readonly logger = new Logger(PortalController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly csvIngestion: CSVIngestionService,
    private readonly ingestionLogs: IngestionLogsService,
    private readonly email: EmailService,
    private readonly dataCrypto: DataCryptoService,
    private readonly billing: BillingService,
    private readonly audit: AuditService,
    private readonly platformAccess: PlatformAccessService,
    private readonly portalExports: PortalDocumentExportsService,
    private readonly portalAlmReport: PortalAlmReportService,
    private readonly demoSeats: DemoSeatService,
  ) {}

  // ── List User's Report Jobs ─────────────────────────
  // All roles can view report jobs

  @Get('jobs')
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  @ApiOperation({ summary: 'List all report jobs for the authenticated user' })
  @ApiResponse({
    status: 200,
    description: 'Array of report jobs with status and metadata',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Paid subscription required' })
  async listJobs(@Req() req: any) {
    const userId = req.user.userId;
    const scope = await this.buildJobOwnerScope(userId);

    return this.prisma.reportJob.findMany({
      where: scope,
      orderBy: { createdAt: 'desc' },
      // Master CEO can see across all users → cap to keep responses bounded.
      take: scope.userId ? undefined : 200,
      select: {
        id: true,
        institutionName: true,
        status: true,
        analysisPeriod: true,
        previousJobId: true,
        completedAt: true,
        createdAt: true,
        reportUrl: true,
        reportUrlEn: true,
        reportLang: true,
        userId: true,
        triggeredBy: true,
      },
    });
  }

  // ── Get Job Detail ──────────────────────────────────
  // All roles can view job details (report download)

  @Get('jobs/:jobId')
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  @ApiOperation({ summary: 'Get report job details including download URLs' })
  @ApiParam({ name: 'jobId', description: 'Report job UUID' })
  @ApiResponse({ status: 200, description: 'Report job details' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async getJob(@Req() req: any, @Param('jobId') jobId: string) {
    const scope = await this.buildJobOwnerScope(req.user.userId);

    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, ...scope },
    });
    if (!job) throw new NotFoundException('Job not found');

    // Audit log for report access/download
    if (job.reportUrl || job.reportUrlEn) {
      this.audit.log({
        userId: req.user.userId,
        institutionId: job.institutionId || undefined,
        action: 'report_download',
        resource: 'report_job',
        resourceId: jobId,
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
        metadata: scope.userId
          ? undefined
          : { masterCeoBypass: true, jobOwnerId: job.userId },
      });
    }

    return job;
  }

  @Get('jobs/:jobId/ingestion-logs')
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  async getJobIngestionLogs(@Req() req: any, @Param('jobId') jobId: string) {
    const scope = await this.buildJobOwnerScope(req.user.userId);
    // For master CEO bypass, look up the job's true owner so the ingestion-logs
    // service can scope correctly. Normal users always pass their own id.
    const ownerId = scope.userId || (await this.resolveJobOwner(jobId));
    return this.ingestionLogs.listJobLogs(ownerId, jobId);
  }

  @Get('jobs/:jobId/exports')
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  @ApiOperation({ summary: 'List document export manifests for a report job' })
  async listJobExports(@Req() req: any, @Param('jobId') jobId: string) {
    const scope = await this.buildJobOwnerScope(req.user.userId);
    const ownerId = scope.userId || (await this.resolveJobOwner(jobId));
    return this.portalExports.listJobExports(ownerId, jobId);
  }

  // ── ALCO Meeting Pack (8-page board-ready PDF) ──────
  // All roles can generate ALCO packs for completed jobs

  @Post('jobs/:jobId/alco-pack')
  @SkipAuditLog()
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  @ApiOperation({
    summary: 'Generate an 8-page board-ready ALCO meeting pack PDF',
  })
  @ApiParam({ name: 'jobId', description: 'Completed report job UUID' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language (en or es, default: es)',
  })
  @ApiResponse({
    status: 201,
    description: 'ALCO pack PDF binary stream',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({
    status: 400,
    description: 'Job not complete or no institution linked',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async generateAlcoPack(
    @Req() req: any,
    @Res() res: any,
    @Param('jobId') jobId: string,
    @Query('lang') lang?: string,
  ) {
    const userId = req.user.userId;
    const scope = await this.buildJobOwnerScope(userId);
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, ...scope },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== 'COMPLETE') {
      throw new BadRequestException(
        `ALCO pack can only be generated for completed reports (current: ${job.status})`,
      );
    }
    if (!job.institutionId) {
      throw new BadRequestException('No institution linked to this job');
    }

    const language = lang === 'en' ? 'en' : 'es';
    const document = await this.portalExports.generateAlcoPackExport(
      job.userId,
      jobId,
      language,
    );

    this.audit.log({
      userId,
      institutionId: job.institutionId,
      action: 'alco_pack_download',
      resource: 'report_job',
      resourceId: jobId,
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
      metadata: scope.userId
        ? undefined
        : { masterCeoBypass: true, jobOwnerId: job.userId },
    });

    this.logger.log({
      event: 'portal.alco_pack.generated',
      jobId,
      userId,
      language,
    });

    res.set(buildPdfResponseHeaders(document.manifest, document.buffer.length));
    res.end(document.buffer);
  }

  // ── ALM Report (on-demand streaming PDF) ────────────
  // Used by demo seats (no R2 storage) and as a fallback when the
  // pipeline-uploaded URL is missing or relative. Re-runs the ALM engine
  // and Monte Carlo on every request — costlier than R2 but always fresh
  // and always available.

  @Get('jobs/:jobId/alm-report')
  @SkipAuditLog()
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  @ApiOperation({
    summary: 'Stream the ALM report PDF for a job, generated on demand',
  })
  @ApiParam({ name: 'jobId', description: 'Report job UUID' })
  @ApiQuery({
    name: 'lang',
    required: false,
    description: 'Language (en or es, default: es)',
  })
  @ApiResponse({
    status: 200,
    description: 'ALM report PDF binary stream',
    content: { 'application/pdf': {} },
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  async streamAlmReport(
    @Req() req: any,
    @Res() res: any,
    @Param('jobId') jobId: string,
    @Query('lang') lang?: string,
  ) {
    const userId = req.user.userId;
    const scope = await this.buildJobOwnerScope(userId);
    const ownerId = scope.userId || (await this.resolveJobOwner(jobId));

    const language = lang === 'en' ? 'en' : 'es';
    const document = await this.portalAlmReport.generateAlmReportExport(
      ownerId,
      jobId,
      language,
    );

    // Mark engagement on the prospect record (the actual demo user, not the master).
    void this.demoSeats.markViewed(ownerId);

    this.audit.log({
      userId,
      action: 'alm_report_download',
      resource: 'report_job',
      resourceId: jobId,
      metadata: {
        language,
        onDemand: true,
        ...(scope.userId ? {} : { masterCeoBypass: true, jobOwnerId: ownerId }),
      },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    res.set(buildPdfResponseHeaders(document.manifest, document.buffer.length));
    res.end(document.buffer);
  }

  // ── Demo Seat Context (portal home banner) ──────────
  // Returns provenance, expiry, and refresh state for the current user's
  // demo seat (if any). Returns null for non-demo users. Master CEO can
  // pass ?asUserId= to view any specific demo seat without leaving their
  // own session.

  @Get('demo-seat')
  @Roles('OWNER', 'ANALYST', 'VIEWER')
  @ApiOperation({
    summary: 'Get demo-seat context for the authenticated user (or null)',
  })
  async getDemoSeatContext(
    @Req() req: any,
    @Query('asUserId') asUserId?: string,
  ) {
    const callerId = req.user.userId;
    const callerAccess = await this.platformAccess.getAccessForUser(callerId);

    // Master CEO impersonation: ?asUserId= lets them view any specific seat
    let targetUserId = callerId;
    if (asUserId && callerAccess.isMasterCeo) {
      targetUserId = asUserId;
    }

    const targetAccess =
      targetUserId === callerId
        ? callerAccess
        : await this.platformAccess.getAccessForUser(targetUserId);

    if (!targetAccess.isDemo) {
      return { isDemo: false, seat: null };
    }

    const seat = await this.demoSeats.getDemoSeatForUser(targetUserId);
    // Master CEO views don't count as the prospect viewing their own report
    if (targetUserId === callerId) {
      void this.demoSeats.markViewed(callerId);
    }

    return {
      isDemo: true,
      daysRemaining: targetAccess.daysRemaining,
      expiresAt: targetAccess.effectivePeriodEnd,
      viewedAsMaster: targetUserId !== callerId,
      seat: seat
        ? {
            prospectId: seat.id,
            institutionName: seat.name,
            publicDataSource: seat.publicDataSource,
            provisionedAt: seat.demoProvisionedAt?.toISOString() || null,
            expiresAt: seat.demoExpiresAt?.toISOString() || null,
            reportJobId: seat.demoReportJobId,
          }
        : null,
    };
  }

  /**
   * Look up the owner userId of a report job. Used by master CEO bypass
   * paths to forward the correct ownerId to downstream services that
   * still scope by user. Throws NotFoundException if the job doesn't exist.
   */
  private async resolveJobOwner(jobId: string): Promise<string> {
    const job = await this.prisma.reportJob.findUnique({
      where: { id: jobId },
      select: { userId: true },
    });
    if (!job) {
      throw new NotFoundException('Job not found');
    }
    return job.userId;
  }

  // ── Submit Data for a Job ───────────────────────────
  // Only OWNER and ANALYST can upload/submit data

  @Post('jobs/:jobId/submit')
  @SkipAuditLog()
  @Roles('OWNER', 'ANALYST')
  @ApiOperation({ summary: 'Submit balance sheet CSV data for a report job' })
  @ApiParam({ name: 'jobId', description: 'Report job UUID' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    description: 'CSV file with balance sheet data',
    schema: {
      type: 'object',
      properties: {
        file: { type: 'string', format: 'binary' },
        institutionName: { type: 'string' },
        analysisPeriod: { type: 'string' },
      },
    },
  })
  @ApiResponse({
    status: 201,
    description: 'Data submitted and job queued for processing',
  })
  @ApiResponse({
    status: 400,
    description: 'Validation failed or job not awaiting data',
  })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 404, description: 'Job not found' })
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 },
      fileFilter: (_req, file, cb) => {
        if (!file.originalname.match(/\.csv$/i)) {
          return cb(
            new BadRequestException('Only .csv files are accepted'),
            false,
          );
        }
        cb(null, true);
      },
    }),
  )
  async submitData(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { institutionName?: string; analysisPeriod?: string },
  ) {
    const userId = req.user.userId;
    await this.requirePaidPortalAccess(userId);

    // Verify job belongs to user and is awaiting data
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== 'AWAITING_DATA') {
      throw new BadRequestException(
        `Job is not awaiting data (current: ${job.status})`,
      );
    }
    if (!file) throw new BadRequestException('No CSV file provided');

    // Parse and validate CSV
    const csvContent = file.buffer.toString('utf-8');
    const parseResult = this.csvIngestion.parseCSV(csvContent);
    if (!parseResult.valid) {
      await this.ingestionLogs.recordLog({
        userId,
        institutionId: job.institutionId || null,
        reportJobId: jobId,
        source: 'portal_submit',
        sourceFilename: file.originalname,
        status: 'FAILED',
        parseResult,
      });
      await this.prisma.reportJob.update({
        where: { id: jobId },
        data: {
          status: 'VALIDATION_FAILED',
          errorMessage: this.formatValidationErrors(parseResult.errors),
        },
      });
      return {
        valid: false,
        errors: parseResult.errors,
        status: 'VALIDATION_FAILED',
      };
    }

    // Transition to VALIDATING
    await this.prisma.reportJob.update({
      where: { id: jobId },
      data: { status: 'VALIDATING', submittedAt: new Date() },
    });

    // Create or find institution
    const instName = body.institutionName || job.institutionName || 'Unknown';
    let institution;
    if (job.institutionId) {
      institution = await this.almEnterprise.getInstitution(job.institutionId);
    } else {
      institution = await this.almEnterprise.createInstitution({
        name: instName,
        type: 'cooperativa',
        totalAssets: 0,
        reportingDate: new Date().toISOString().split('T')[0],
        workspaceId: '',
      });
    }

    // Import balance sheet items
    await this.almEnterprise.importBalanceSheetItems(
      institution.id,
      parseResult.items,
    );
    const log = await this.ingestionLogs.recordLog({
      userId,
      institutionId: institution.id,
      reportJobId: jobId,
      source: 'portal_submit',
      sourceFilename: file.originalname,
      status: 'IMPORTED',
      parseResult,
      importedCount: parseResult.items.length,
    });

    // Encrypt raw CSV data (AES-256-GCM) for audit trail; auto-purged after 90 days
    const encryptedRawData = this.dataCrypto.encrypt(csvContent);

    // ── Multi-period linking: find most recent COMPLETE job for same institution ──
    let previousJobId: string | null = null;
    try {
      const previousJob = await this.prisma.reportJob.findFirst({
        where: {
          institutionId: institution.id,
          status: 'COMPLETE',
          id: { not: jobId },
        },
        orderBy: { completedAt: 'desc' },
        select: { id: true },
      });
      if (previousJob) {
        previousJobId = previousJob.id;
      }
    } catch {
      // Gracefully ignore — column may not exist yet on older schemas
      this.logger.warn({ event: 'portal.previous_job_lookup_failed', jobId });
    }

    // Link institution and transition to QUEUED
    await this.prisma.reportJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        institutionId: institution.id,
        institutionName: instName,
        rawData: encryptedRawData,
        analysisPeriod: body.analysisPeriod || null,
        previousJobId,
        errorMessage: null,
      },
    });

    // Send acknowledgment email
    const user = await this.prisma.user.findUnique({ where: { id: userId } });
    if (user?.email) {
      await this.email.sendDataSubmissionAck({
        email: user.email,
        name: user.name || '',
        institutionName: instName,
      });
    }

    this.logger.log({
      event: 'portal.data_submitted',
      jobId,
      userId,
      items: parseResult.items.length,
    });

    this.audit.log({
      userId,
      institutionId: institution.id,
      action: 'data_upload',
      resource: 'report_job',
      resourceId: jobId,
      metadata: {
        filename: file.originalname,
        itemsImported: parseResult.items.length,
        ingestionLogId: log.id,
      },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    return {
      valid: true,
      status: 'QUEUED',
      itemsImported: parseResult.items.length,
      institutionId: institution.id,
      ingestionLogId: log.id,
    };
  }

  // ── Invite Team Member ────────────────────────────────
  // Only OWNER can invite new users

  @Post('invite')
  @SkipAuditLog()
  @Roles('OWNER')
  @ApiOperation({
    summary: 'Invite a team member to the portal via magic link email',
  })
  @ApiResponse({ status: 201, description: 'Invite sent successfully' })
  @ApiResponse({ status: 400, description: 'Email already registered' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Only OWNER role can invite' })
  async inviteUser(@Req() req: any, @Body() dto: InviteDto) {
    const ownerId = req.user.userId;
    await this.requirePaidPortalAccess(ownerId);

    // Look up the inviting user to find their workspace
    const owner = await this.prisma.user.findUnique({
      where: { id: ownerId },
      include: {
        workspaces: { take: 1, orderBy: { createdAt: 'asc' } },
      },
    });
    if (!owner) throw new NotFoundException('Owner not found');

    // Check if the email is already registered
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });
    if (existingUser) {
      throw new BadRequestException(
        'A user with this email already exists. They can be reassigned a role directly.',
      );
    }

    // Create the invited user linked to the same workspace
    const invitedUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name || null,
        provider: 'magic_link',
        emailVerified: true,
        role: dto.role as any,
      },
    });

    // If owner has a workspace, link the invited user to it
    if (owner.workspaces.length > 0) {
      await this.prisma.workspace.create({
        data: {
          name: `${dto.name || dto.email.split('@')[0]}'s Workspace`,
          ownerId: invitedUser.id,
        },
      });
    }

    // Generate a magic link for the invited user
    const magicUrl = await this.billing.generateMagicLink(invitedUser.id, 72);

    // Send invite email
    await this.email.sendTeamInviteEmail({
      email: dto.email,
      name: dto.name || '',
      inviterName: owner.name || owner.email,
      role: dto.role,
      magicUrl,
    });

    this.logger.log({
      event: 'portal.user_invited',
      invitedEmail: dto.email,
      role: dto.role,
      invitedBy: ownerId,
    });

    this.audit.log({
      userId: ownerId,
      action: 'team_invite',
      resource: 'user',
      resourceId: invitedUser.id,
      metadata: {
        invitedEmail: dto.email,
        invitedRole: dto.role,
      },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    return {
      id: invitedUser.id,
      email: invitedUser.email,
      role: invitedUser.role,
      invited: true,
    };
  }

  // ── Settings ────────────────────────────────────────
  // Only OWNER can access settings

  @Get('settings')
  @Roles('OWNER')
  async getSettings(@Req() req: any) {
    const userId = req.user.userId;
    await this.requirePaidPortalAccess(userId);

    const [
      user,
      subscription,
      workspaces,
      totalReports,
      completedReports,
      inProgressReports,
      awaitingDataReports,
      activeApiKeys,
    ] = await Promise.all([
      this.prisma.user.findUnique({
        where: { id: userId },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          createdAt: true,
          lastLoginAt: true,
        },
      }),
      this.prisma.subscription.findUnique({
        where: { userId },
        select: {
          tier: true,
          status: true,
          currentPeriodEnd: true,
          reportsUsed: true,
        },
      }),
      this.prisma.workspace.findMany({
        where: { ownerId: userId },
        select: {
          id: true,
          name: true,
          createdAt: true,
        },
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.reportJob.count({
        where: { userId },
      }),
      this.prisma.reportJob.count({
        where: { userId, status: 'COMPLETE' },
      }),
      this.prisma.reportJob.count({
        where: {
          userId,
          status: {
            in: [
              'QUEUED',
              'PROCESSING',
              'GENERATING_PDF',
              'UPLOADING',
              'VALIDATING',
            ],
          },
        },
      }),
      this.prisma.reportJob.count({
        where: {
          userId,
          status: {
            in: ['AWAITING_DATA', 'VALIDATION_FAILED'],
          },
        },
      }),
      this.prisma.apiKey.count({
        where: {
          userId,
          revokedAt: null,
        },
      }),
    ]);

    if (!user) throw new NotFoundException('User not found');

    const workspaceIds = workspaces.map((workspace: any) => workspace.id);
    const institutions =
      workspaceIds.length > 0
        ? await this.prisma.institution.findMany({
            where: {
              workspaceId: {
                in: workspaceIds,
              },
            },
            select: {
              id: true,
              name: true,
              type: true,
              totalAssets: true,
              preferredLanguage: true,
              updatedAt: true,
              workspaceId: true,
            },
            orderBy: { updatedAt: 'desc' },
          })
        : [];

    const totalInstitutionAssets = institutions.reduce(
      (sum: number, institution: any) => sum + institution.totalAssets,
      0,
    );

    return {
      user: user
        ? {
            ...user,
            role: req.user?.access?.isMasterCeo ? 'OWNER' : user.role,
          }
        : user,
      subscription: subscription || { tier: 'free', status: 'active' },
      workspaceCount: workspaces.length,
      workspaces,
      reportMetrics: {
        total: totalReports,
        completed: completedReports,
        inProgress: inProgressReports,
        awaitingData: awaitingDataReports,
      },
      institutionMetrics: {
        total: institutions.length,
        totalAssets: totalInstitutionAssets,
      },
      institutions: institutions.slice(0, 6),
      apiKeyCount: activeApiKeys,
    };
  }

  private formatValidationErrors(
    errors: Array<{ row: number; field: string; message: string }>,
  ): string {
    return errors
      .slice(0, 5)
      .map((error) => `row ${error.row} ${error.field}: ${error.message}`)
      .join(' | ');
  }

  private async requirePaidPortalAccess(userId: string) {
    const access = await this.platformAccess.getAccessForUser(userId);
    if (!access.platformAccessAllowed) {
      throw new ForbiddenException(
        this.platformAccess.buildForbiddenPayload(access),
      );
    }
    return access;
  }

  /**
   * Build the where-scope used by portal READ queries.
   *
   * - Normal users  → `{ userId }` (only their own jobs)
   * - Master CEO    → `{}`         (sees ALL jobs across the platform)
   *
   * Used for: listJobs, getJob, listJobExports, generateAlcoPack,
   * streamAlmReport, getJobIngestionLogs, getDemoSeatContext.
   *
   * Write endpoints (submitData, inviteUser) intentionally do NOT use this —
   * the master CEO has admin endpoints for those operations.
   */
  private async buildJobOwnerScope(
    userId: string,
  ): Promise<{ userId?: string }> {
    const access = await this.requirePaidPortalAccess(userId);
    if (access.isMasterCeo) {
      return {};
    }
    return { userId };
  }
}
