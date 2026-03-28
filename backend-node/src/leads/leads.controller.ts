import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Req,
  Logger,
  HttpCode,
  UseGuards,
} from '@nestjs/common';
import { Throttle, SkipThrottle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { LeadQualificationService } from './lead-qualification.service';
import { LeadScoringService } from './lead-scoring.service';
import { OutreachExecutionService } from './outreach-execution.service';
import { SubmitLeadDto, UpdateLeadDto } from './leads.dto';
import { AdminGuard } from '../common/guards/admin.guard';

@Controller()
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(
    private readonly leads: LeadsService,
    private readonly qualification: LeadQualificationService,
    private readonly scoring: LeadScoringService,
    private readonly outreachExecution: OutreachExecutionService,
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

  // ── Demo Step Tracking ──

  @Post('api/demo/track')
  @SkipThrottle()
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
