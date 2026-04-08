import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Req,
  Res,
  Logger,
  HttpCode,
  UseGuards,
  BadRequestException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadScoringService } from './lead-scoring.service';
import { OutreachExecutionService } from './outreach-execution.service';
import { InstitutionIntelligenceService } from './institution-intelligence.service';
import { DemoSeatService } from '../portal/demo-seat.service';
import { SubmitLeadDto, UpdateLeadDto } from './leads.dto';
import { AdminGuard } from '../common/guards/admin.guard';

interface ProvisionPortalDto {
  contactEmail?: string;
  contactName?: string;
  ttlDays?: number;
  preferredLanguage?: 'en' | 'es';
  sendEmail?: boolean;
}

@Controller()
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(
    private readonly leads: LeadsService,
    private readonly qualification: LeadQualificationService,
    private readonly scoring: LeadScoringService,
    private readonly outreachExecution: OutreachExecutionService,
    private readonly intelligence: InstitutionIntelligenceService,
    private readonly demoSeats: DemoSeatService,
  ) {}

  // ── Public endpoint (rate-limited at app level) ──

  @Post('api/v1/leads/submit')
  @Throttle({ default: { limit: 20, ttl: 3600000 } })
  async submitLead(@Body() dto: SubmitLeadDto) {
    this.logger.log(
      `Lead submission: ${dto.institutionName} (${dto.institutionType})`,
    );
    return this.leads.submitLead(dto);
  }

  // ── Admin endpoints (ADMIN_KEY protected) ──

  @Get('admin/api/leads')
  @UseGuards(AdminGuard)
  async listLeads(
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    return this.leads.listLeads({ status, priority });
  }

  @Get('admin/api/leads/metrics')
  @UseGuards(AdminGuard)
  async getMetrics() {
    return this.leads.getPipelineMetrics();
  }

  @Get('admin/api/leads/:id')
  @UseGuards(AdminGuard)
  async getLead(@Param('id') id: string) {
    return this.leads.getLead(id);
  }

  @Put('admin/api/leads/:id')
  @UseGuards(AdminGuard)
  async updateLead(@Param('id') id: string, @Body() dto: UpdateLeadDto) {
    this.logger.log(`Lead updated: ${id}`);
    return this.leads.updateLead(id, dto);
  }

  @Post('admin/api/leads/:id/note')
  @UseGuards(AdminGuard)
  async addNote(@Param('id') id: string, @Body('note') note: string) {
    return this.leads.addNote(id, note);
  }

  @Post('admin/api/leads/:id/mark-report-sent')
  @UseGuards(AdminGuard)
  async markReportSent(@Param('id') id: string) {
    return this.leads.markReportSent(id);
  }

  @Post('admin/api/prospects/seed')
  @UseGuards(AdminGuard)
  async seedProspects() {
    return this.leads.seedProspectPipeline();
  }

  @Get('admin/api/prospects')
  @UseGuards(AdminGuard)
  async listProspects() {
    return this.leads.listProspects();
  }

  @Get('admin/api/benchmarks')
  @UseGuards(AdminGuard)
  async getBenchmarks() {
    return this.leads.getBenchmarks();
  }

  @Get('admin/api/prospects/:id/outreach')
  @UseGuards(AdminGuard)
  async generateOutreach(
    @Param('id') id: string,
    @Query('lang') lang?: string,
  ) {
    return this.leads.generateOutreach(id, lang === 'en' ? 'en' : 'es');
  }

  // ── Lead Qualification ──

  @Get('admin/api/prospects/:id/qualify')
  @UseGuards(AdminGuard)
  async qualifyProspect(@Param('id') id: string) {
    return this.qualification.qualifyProspect(id);
  }

  @Get('admin/api/prospects/qualify/all')
  @UseGuards(AdminGuard)
  async qualifyAllProspects() {
    return this.qualification.qualifyAllProspects();
  }

  // ── Lead Scoring ──

  @Get('admin/api/leads/:id/score')
  @UseGuards(AdminGuard)
  async scoreLead(@Param('id') id: string) {
    return this.scoring.scoreLead(id);
  }

  @Post('admin/api/leads/score-all')
  @UseGuards(AdminGuard)
  async scoreAllLeads() {
    return this.scoring.scoreAllLeads();
  }

  // ── Outreach Execution ──

  @Post('admin/api/prospects/:id/send-outreach')
  @UseGuards(AdminGuard)
  async sendOutreach(@Param('id') id: string, @Query('lang') lang?: string) {
    return this.outreachExecution.executeOutreach(
      id,
      lang === 'en' ? 'en' : 'es',
    );
  }

  @Post('admin/api/prospects/bulk-outreach')
  @UseGuards(AdminGuard)
  async bulkOutreach(
    @Query('lang') lang?: string,
    @Query('limit') limit?: string,
  ) {
    return this.outreachExecution.executeBulkOutreach(
      lang === 'en' ? 'en' : 'es',
      parseInt(limit || '10', 10),
    );
  }

  // ── Institutional Intelligence ──

  @Post('admin/api/intelligence/sync')
  @UseGuards(AdminGuard)
  async syncIntelligence(@Query('limit') limit?: string) {
    return this.intelligence.syncProspectsToAccounts(
      parseInt(limit || '250', 10),
    );
  }

  @Post('admin/api/intelligence/refresh')
  @UseGuards(AdminGuard)
  async refreshIntelligence(
    @Query('limit') limit?: string,
    @Query('staleOnly') staleOnly?: string,
  ) {
    return this.intelligence.refreshAllBuyerAccounts(
      parseInt(limit || '25', 10),
      staleOnly !== 'false',
    );
  }

  @Get('admin/api/intelligence/accounts')
  @UseGuards(AdminGuard)
  async listIntelligenceAccounts(@Query('limit') limit?: string) {
    return this.intelligence.listBuyerAccountSummaries(
      parseInt(limit || '100', 10),
    );
  }

  @Get('admin/api/prospects/:id/dossier')
  @UseGuards(AdminGuard)
  async getProspectDossier(@Param('id') id: string) {
    return this.intelligence.getProspectDossier(id);
  }

  // ── Demo Portal Provisioning ───────────────────────
  // Spin up a portal seat for a prospect using only public NCUA / COSSEC
  // data. Returns a magic link Erwin can hand to the prospect (or trigger
  // delivery directly via sendEmail=true).

  @Post('admin/api/prospects/:id/provision-portal')
  @UseGuards(AdminGuard)
  async provisionPortalForProspect(
    @Param('id') id: string,
    @Body() dto: ProvisionPortalDto = {},
  ) {
    if (dto.ttlDays !== undefined && (dto.ttlDays < 1 || dto.ttlDays > 60)) {
      throw new BadRequestException('ttlDays must be between 1 and 60');
    }
    this.logger.log(
      `Provisioning portal for prospect ${id} (sendEmail=${dto.sendEmail ?? false})`,
    );
    return this.demoSeats.provisionFromProspect({
      prospectId: id,
      contactEmail: dto.contactEmail,
      contactName: dto.contactName,
      ttlDays: dto.ttlDays,
      preferredLanguage: dto.preferredLanguage,
      sendEmail: dto.sendEmail ?? false,
    });
  }

  @Post('admin/api/prospects/provision-portal/bulk')
  @UseGuards(AdminGuard)
  async bulkProvisionPortals(
    @Body()
    dto: {
      prospectIds: string[];
      ttlDays?: number;
      sendEmail?: boolean;
    },
  ) {
    if (!Array.isArray(dto?.prospectIds) || dto.prospectIds.length === 0) {
      throw new BadRequestException('prospectIds must be a non-empty array');
    }
    if (dto.prospectIds.length > 25) {
      throw new BadRequestException(
        'Bulk provisioning is capped at 25 prospects per request',
      );
    }
    const results = await Promise.allSettled(
      dto.prospectIds.map((prospectId) =>
        this.demoSeats.provisionFromProspect({
          prospectId,
          ttlDays: dto.ttlDays,
          sendEmail: dto.sendEmail ?? false,
        }),
      ),
    );
    return {
      total: dto.prospectIds.length,
      provisioned: results.filter((r) => r.status === 'fulfilled').length,
      failed: results
        .map((r, idx) => ({
          prospectId: dto.prospectIds[idx],
          status: r.status,
          error:
            r.status === 'rejected'
              ? (r.reason as Error)?.message || 'unknown'
              : null,
        }))
        .filter((entry) => entry.status === 'rejected'),
      results: results
        .map((r) => (r.status === 'fulfilled' ? r.value : null))
        .filter((value): value is NonNullable<typeof value> => value !== null),
    };
  }

  // ── Admin: Demo Seat Dashboard ──────────────────────
  // Lists all demo seats with engagement metadata for the admin console.
  // Filterable by active/expired/all. Used by the admin demo-seats page
  // to show provisioning history and engagement signals.

  @Get('admin/api/demo-seats')
  @UseGuards(AdminGuard)
  async listDemoSeats(@Query('filter') filter?: string) {
    const normalized =
      filter === 'active' || filter === 'expired' ? filter : 'all';
    return this.demoSeats.listAdminDemoSeats(normalized);
  }

  @Post('admin/api/demo-seats/sweep')
  @UseGuards(AdminGuard)
  async sweepDemoSeats() {
    return this.demoSeats.sweepExpired();
  }

  @Post('admin/api/prospects/:id/dossier/refresh')
  @UseGuards(AdminGuard)
  async refreshProspectDossier(@Param('id') id: string) {
    return this.intelligence.refreshProspectDossier(id);
  }

  @Get('admin/api/prospects/:id/dossier/export.csv')
  @UseGuards(AdminGuard)
  async exportProspectDossierCsv(@Param('id') id: string, @Res() res: any) {
    const csv = await this.intelligence.exportProspectDossierCsv(id);
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="prospect-dossier-${id}.csv"`,
    );
    res.send(csv);
  }

  @Get('admin/api/prospects/:id/dossier/sample-report')
  @UseGuards(AdminGuard)
  async downloadProspectSampleReport(
    @Param('id') id: string,
    @Query('lang') lang: string | undefined,
    @Res() res: any,
  ) {
    const report = await this.intelligence.generateProspectSampleReport(
      id,
      lang === 'en' ? 'en' : 'es',
    );
    res.setHeader('Content-Type', 'application/pdf');
    res.setHeader(
      'Content-Disposition',
      `attachment; filename="${report.filename}"`,
    );
    res.send(report.buffer);
  }

  @Post('admin/api/intelligence/actions/:actionId/complete')
  @UseGuards(AdminGuard)
  async completeIntelligenceAction(@Param('actionId') actionId: string) {
    return this.intelligence.completeAction(actionId);
  }

  // ── Demo Step Tracking ──

  @Post('api/demo/track')
  @Throttle({ default: { limit: 60, ttl: 60000 } })
  @HttpCode(200)
  async trackDemoStep(
    @Body() body: { step: number; timestamp: string },
    @Req() req: any,
  ) {
    // Fire-and-forget -- don't block the demo experience
    const sessionId = req.headers['x-request-id'] || 'anonymous';
    this.logger.debug({
      event: 'demo.step',
      step: body.step,
      sessionId,
      timestamp: body.timestamp,
    });

    // If step 6 (Get Started) -- capture as a warm lead
    if (body.step === 6) {
      this.logger.log({ event: 'demo.completed', sessionId });
    }

    return { tracked: true };
  }
}
