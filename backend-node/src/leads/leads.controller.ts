import {
  Controller,
  Post,
  Get,
  Put,
  Param,
  Body,
  Query,
  Logger,
  UseGuards,
} from '@nestjs/common';
import { Throttle } from '@nestjs/throttler';
import { LeadsService } from './leads.service';
import { SubmitLeadDto, UpdateLeadDto } from './leads.dto';
import { AdminGuard } from '../common/guards/admin.guard';

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
  async getLead(
    @Param('id') id: string,
  ) {
    return this.leads.getLead(id);
  }

  @Put('admin/api/leads/:id')
  @UseGuards(AdminGuard)
  async updateLead(
    @Param('id') id: string,
    @Body() dto: UpdateLeadDto,
  ) {
    this.logger.log(`Lead updated: ${id}`);
    return this.leads.updateLead(id, dto);
  }

  @Post('admin/api/leads/:id/note')
  @UseGuards(AdminGuard)
  async addNote(
    @Param('id') id: string,
    @Body('note') note: string,
  ) {
    return this.leads.addNote(id, note);
  }

  @Post('admin/api/leads/:id/mark-report-sent')
  @UseGuards(AdminGuard)
  async markReportSent(
    @Param('id') id: string,
  ) {
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
}
