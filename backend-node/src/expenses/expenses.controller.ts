import {
  Controller,
  Get,
  Post,
  Body,
  Patch,
  Param,
  Delete,
  Req,
  Res,
  Query,
  UseGuards,
  UseInterceptors,
  UploadedFile,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { ExpensesService } from './expenses.service';
import { AnomalyDetectionService } from './anomaly-detection.service';
import { ApReportService } from './ap-report.service';
import { VendorIntelligenceService } from './vendor-intelligence/vendor-intelligence.service';
import { ExpenseIngestionService } from './expense-ingestion.service';
import { AuthGuard } from '../auth/auth.guard';
import { PrismaService } from '../prisma.service';
import * as path from 'path';
import * as fs from 'fs/promises';

@Controller('api/expenses')
@UseGuards(AuthGuard)
export class ExpensesController {
  private readonly logger = new Logger(ExpensesController.name);

  constructor(
    private readonly expensesService: ExpensesService,
    private readonly anomalyDetectionService: AnomalyDetectionService,
    private readonly apReportService: ApReportService,
    private readonly vendorIntelligenceService: VendorIntelligenceService,
    private readonly expenseIngestionService: ExpenseIngestionService,
    private readonly prisma: PrismaService,
  ) {}

  // ── CSV Upload Endpoint ──────────────────────────────────────────

  @Post(':orgId/upload')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10MB max
      fileFilter: (_req: any, file: any, cb: any) => {
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
  async uploadExpenseCSV(
    @Req() req: any,
    @Param('orgId') orgId: string,
    @UploadedFile() file: Express.Multer.File,
  ) {
    if (!file) {
      throw new BadRequestException('No CSV file provided');
    }

    this.logger.log(
      `SpendCheck CSV upload for org ${orgId} (${file.size} bytes, file: ${file.originalname})`,
    );

    const csvContent = file.buffer.toString('utf-8');
    const result = this.expenseIngestionService.parseExpenseCSV(csvContent);

    if (!result.valid) {
      return {
        ingested: 0,
        errors: result.errors,
        warnings: result.warnings,
        summary: result.summary,
        analysisTriggered: false,
      };
    }

    // Resolve orgId: use provided orgId, or find/create the user's default org
    let resolvedOrgId = orgId;
    const userId = req.user.userId;

    // If orgId is 'auto' or 'default', resolve the user's first org or create one
    if (orgId === 'auto' || orgId === 'default') {
      const membership = await this.prisma.organizationMember.findFirst({
        where: { userId },
        select: { organizationId: true },
      });

      if (membership) {
        resolvedOrgId = membership.organizationId;
      } else {
        // Create a default organization for the user
        const org = await this.prisma.organization.create({
          data: {
            name: 'SpendCheck Default',
            slug: `spendcheck-${userId.slice(0, 8)}-${Date.now()}`,
            members: {
              create: {
                userId,
                role: 'ADMIN',
              },
            },
          },
        });
        resolvedOrgId = org.id;
      }
    }

    // Batch-create expense records
    const created: string[] = [];
    const batchSize = 50;

    for (let i = 0; i < result.items.length; i += batchSize) {
      const batch = result.items.slice(i, i + batchSize);
      const records = await Promise.all(
        batch.map((item) =>
          this.prisma.expense.create({
            data: {
              organizationId: resolvedOrgId,
              userId,
              merchantName: item.vendor,
              amount: item.amount,
              currency: item.currency,
              category: item.category,
              description: item.description || null,
              transactionDate: new Date(item.date),
              status:
                item.status === 'PAID'
                  ? 'APPROVED'
                  : item.status === 'PENDING'
                    ? 'SUBMITTED'
                    : 'DRAFT',
              aiExtracted: false,
            },
            select: { id: true },
          }),
        ),
      );
      created.push(...records.map((r) => r.id));
    }

    this.logger.log(
      `SpendCheck CSV: ingested ${created.length} expenses for org ${resolvedOrgId}`,
    );

    // Auto-trigger anomaly detection
    let analysisTriggered = false;
    try {
      await this.anomalyDetectionService.analyzeOrganization(resolvedOrgId);
      analysisTriggered = true;
      this.logger.log(
        `SpendCheck anomaly detection completed for org ${resolvedOrgId}`,
      );
    } catch (err) {
      this.logger.error(
        `SpendCheck anomaly detection failed for org ${resolvedOrgId}`,
        err,
      );
    }

    return {
      ingested: created.length,
      orgId: resolvedOrgId,
      errors: result.errors,
      warnings: result.warnings,
      summary: result.summary,
      analysisTriggered,
    };
  }

  // ── Template Download Endpoint ───────────────────────────────────

  @Get('template')
  async getTemplate(@Res() res: any) {
    // Serve the CSV template file
    const templatePath = path.join(
      __dirname,
      '..',
      '..',
      '..',
      'frontend',
      'public',
      'templates',
      'cerniq-spendcheck-template.csv',
    );

    // If the file exists in the frontend directory, serve it (async I/O)
    try {
      const content = await fs.readFile(templatePath, 'utf-8');
      res.set({
        'Content-Type': 'text/csv',
        'Content-Disposition':
          'attachment; filename="cerniq-spendcheck-template.csv"',
      });
      res.send(content);
      return;
    } catch {
      // File doesn't exist — fall through to inline template
    }

    // Otherwise, generate an inline template
    const template = [
      'date,invoice_number,vendor,description,amount,currency,category,status',
      '2026-01-15,INV-001,LUMA Energy PR,Monthly electric bill Q1,12500.00,USD,utilities,PAID',
      '2026-01-20,INV-002,Triple-S Management,Health insurance premium Jan,8750.00,USD,insurance,PAID',
      '2026-01-22,INV-003,Claro PR,Internet and phone service,1250.00,USD,telecom,PAID',
      '2026-02-01,INV-004,BDO Puerto Rico,Q4 audit fees,15000.00,USD,audit,PAID',
      '2026-02-10,INV-005,Office Depot PR,Office supplies and toner,850.00,USD,supplies,PAID',
    ].join('\n');

    res.set({
      'Content-Type': 'text/csv',
      'Content-Disposition':
        'attachment; filename="cerniq-spendcheck-template.csv"',
    });
    res.send(template);
  }

  // ── Existing Endpoints ────────────────────────────────────────────

  @Post(':orgId/analyze')
  analyzeOrganization(@Param('orgId') orgId: string) {
    return this.anomalyDetectionService.analyzeOrganization(orgId);
  }

  @Post(':orgId/report')
  async generateAPReport(
    @Param('orgId') orgId: string,
    @Query('lang') lang: string,
    @Query('institutionId') institutionId: string,
    @Res() res: any,
  ) {
    const language = lang === 'es' ? 'es' : 'en';
    const buffer = await this.apReportService.generateAPReport(
      orgId,
      institutionId || null,
      language,
    );
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `ap-intelligence-report-${dateStr}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('process-receipt')
  processReceipt(@Body() dto: any, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.processReceipt(
      organizationId,
      req.user.userId,
      dto,
    );
  }

  @Post()
  create(
    @Body()
    createDto: {
      merchantName: string;
      amount: number;
      transactionDate: string;
      category?: string;
      description?: string;
      receiptUrl?: string;
    },
    @Req() req: any,
  ) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.create(
      organizationId,
      req.user.userId,
      createDto,
    );
  }

  @Get()
  findAll(@Query('status') status: string, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.findAll(
      organizationId,
      req.user.userId,
      status as any,
    );
  }

  @Get(':id')
  findOne(@Param('id') id: string, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.findOne(id, organizationId, req.user.userId);
  }

  @Patch(':id')
  update(@Param('id') id: string, @Body() updateDto: any, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.update(
      id,
      organizationId,
      req.user.userId,
      updateDto,
    );
  }

  @Post(':id/submit')
  submit(@Param('id') id: string, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.submit(id, organizationId, req.user.userId);
  }

  @Post(':id/approve')
  approve(@Param('id') id: string, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.approve(id, organizationId, req.user.userId);
  }

  @Post(':id/reject')
  reject(@Param('id') id: string, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.reject(id, organizationId, req.user.userId);
  }

  @Delete(':id')
  remove(@Param('id') id: string, @Req() req: any) {
    const organizationId = req.headers['x-organization-id'] || 'default-org';
    return this.expensesService.remove(id, organizationId, req.user.userId);
  }

  @Get(':orgId/vendor-report')
  async getVendorReport(@Param('orgId') orgId: string) {
    const rawExpenses = await this.prisma.expense.findMany({
      where: { organizationId: orgId },
      select: {
        merchantName: true,
        amount: true,
        transactionDate: true,
      },
    });

    const expenses = rawExpenses.map((e: any) => ({
      merchantName: e.merchantName,
      amount: Number(e.amount),
      transactionDate: new Date(e.transactionDate),
    }));

    return this.vendorIntelligenceService.generateVendorReport(expenses);
  }

  @Get(':orgId/liquidity-impact')
  async getLiquidityImpact(
    @Param('orgId') orgId: string,
    @Query('institutionId') institutionId: string,
  ) {
    return this.anomalyDetectionService.calculateApLcrImpact(
      orgId,
      institutionId,
    );
  }
}
