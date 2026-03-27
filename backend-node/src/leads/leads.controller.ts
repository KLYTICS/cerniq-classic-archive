import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Logger,
  Headers,
  UnauthorizedException,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { SubmitLeadDto, UpdateLeadDto } from './leads.dto';

@Controller()
export class LeadsController {
  private readonly logger = new Logger(LeadsController.name);

  constructor(private readonly leads: LeadsService) {}

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
  async listLeads(
    @Headers('x-admin-key') adminKey: string,
    @Query('status') status?: string,
    @Query('priority') priority?: string,
  ) {
    this.verifyAdmin(adminKey);
    return this.leads.listLeads({ status, priority });
  }

  @Get('admin/api/leads/metrics')
  async getMetrics(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    return this.leads.getPipelineMetrics();
  }

  @Get('admin/api/leads/:id')
  async getLead(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
  ) {
    this.verifyAdmin(adminKey);
    return this.leads.getLead(id);
  }

  @Put('admin/api/leads/:id')
  async updateLead(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    this.verifyAdmin(adminKey);
    this.logger.log(`Lead updated: ${id}`);
    return this.leads.updateLead(id, dto);
  }

  @Post('admin/api/leads/:id/note')
  async addNote(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    this.verifyAdmin(adminKey);
    return this.leads.addNote(id, note);
  }

  @Post('admin/api/leads/:id/mark-report-sent')
  async markReportSent(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
  ) {
    this.verifyAdmin(adminKey);
    return this.leads.markReportSent(id);
  }

  @Post('admin/api/prospects/seed')
  async seedProspects(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    return this.leads.seedProspectPipeline();
  }

  @Get('admin/api/prospects')
  async listProspects(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    return this.leads.listProspects();
  }

  @Get('admin/api/benchmarks')
  async getBenchmarks(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);
    return this.leads.getBenchmarks();
  }

  @Get('admin/api/prospects/:id/outreach')
  async generateOutreach(
    @Headers('x-admin-key') adminKey: string,
    @Param('id') id: string,
    @Query('lang') lang?: string,
  ) {
    this.verifyAdmin(adminKey);
    return this.leads.generateOutreach(id, lang === 'en' ? 'en' : 'es');
  }

  private verifyAdmin(key: string) {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }
}
