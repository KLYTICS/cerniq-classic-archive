import {
  Controller, Get, Post, Param, Body, Req, Logger,
  UseGuards, UseInterceptors, UploadedFile,
  BadRequestException, NotFoundException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import { CSVIngestionService } from '../alm/csv-ingestion.service';
import { EmailService } from '../email/email.service';

@Controller('api/portal')
@UseGuards(AuthGuard)
export class PortalController {
  private readonly logger = new Logger(PortalController.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly csvIngestion: CSVIngestionService,
    private readonly email: EmailService,
  ) {}

  // ── List User's Report Jobs ─────────────────────────

  @Get('jobs')
  async listJobs(@Req() req: any) {
    const userId = req.user.userId;
    return this.prisma.reportJob.findMany({
      where: { userId },
      orderBy: { createdAt: 'desc' },
      select: {
        id: true,
        institutionName: true,
        status: true,
        completedAt: true,
        createdAt: true,
        reportUrl: true,
        reportUrlEn: true,
        reportLang: true,
      },
    });
  }

  // ── Get Job Detail ──────────────────────────────────

  @Get('jobs/:jobId')
  async getJob(@Req() req: any, @Param('jobId') jobId: string) {
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, userId: req.user.userId },
    });
    if (!job) throw new NotFoundException('Job not found');
    return job;
  }

  // ── Submit Data for a Job ───────────────────────────

  @Post('jobs/:jobId/submit')
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 },
    fileFilter: (_req, file, cb) => {
      if (!file.originalname.match(/\.csv$/i)) {
        return cb(new BadRequestException('Only .csv files are accepted'), false);
      }
      cb(null, true);
    },
  }))
  async submitData(
    @Req() req: any,
    @Param('jobId') jobId: string,
    @UploadedFile() file: Express.Multer.File,
    @Body() body: { institutionName?: string },
  ) {
    const userId = req.user.userId;

    // Verify job belongs to user and is awaiting data
    const job = await this.prisma.reportJob.findFirst({
      where: { id: jobId, userId },
    });
    if (!job) throw new NotFoundException('Job not found');
    if (job.status !== 'AWAITING_DATA') {
      throw new BadRequestException(`Job is not awaiting data (current: ${job.status})`);
    }
    if (!file) throw new BadRequestException('No CSV file provided');

    // Parse and validate CSV
    const csvContent = file.buffer.toString('utf-8');
    const parseResult = this.csvIngestion.parseCSV(csvContent);
    if (!parseResult.valid) {
      await this.prisma.reportJob.update({
        where: { id: jobId },
        data: { status: 'VALIDATION_FAILED', errorMessage: `CSV validation failed: ${parseResult.errors?.join(', ')}` },
      });
      return { valid: false, errors: parseResult.errors, status: 'VALIDATION_FAILED' };
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
    await this.almEnterprise.importBalanceSheetItems(institution.id, parseResult.items);

    // Link institution and transition to QUEUED
    await this.prisma.reportJob.update({
      where: { id: jobId },
      data: {
        status: 'QUEUED',
        institutionId: institution.id,
        institutionName: instName,
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

    this.logger.log({ event: 'portal.data_submitted', jobId, userId, items: parseResult.items.length });

    return {
      valid: true,
      status: 'QUEUED',
      itemsImported: parseResult.items.length,
      institutionId: institution.id,
    };
  }
}
