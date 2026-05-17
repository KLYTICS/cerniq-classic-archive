import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminKeyGuard } from '../auth/admin-key.guard';
import { IntelligenceService } from './intelligence.service';
import {
  IntelligenceAccountsImportRequestDto,
  IntelligenceAccountKind,
  IntelligenceActionStatus,
  IntelligenceRefreshRequestDto,
  IntelligenceReportRequestDto,
  WorkspaceMemoryInputDto,
} from './dto/intelligence.dto';

@Controller('admin/api/intelligence')
@UseGuards(AdminKeyGuard)
export class IntelligenceController {
  constructor(private readonly intelligence: IntelligenceService) {}

  @Get('overview')
  async getOverview(@Query('workspaceId') workspaceId?: string) {
    return this.intelligence.getOverview(workspaceId);
  }

  @Get('accounts')
  async getAccounts(
    @Query('workspaceId') workspaceId?: string,
    @Query('kind') kind?: string,
    @Query('status') status?: string,
    @Query('search') search?: string,
  ) {
    return this.intelligence.listAccounts({
      workspaceId,
      kind: kind as IntelligenceAccountKind | undefined,
      status,
      search,
    });
  }

  @Get('accounts/:id')
  async getAccount(@Param('id') id: string) {
    return this.intelligence.getAccountDetail(id);
  }

  @Get('accounts/:id/timeline')
  async getTimeline(@Param('id') id: string) {
    return this.intelligence.getTimeline(id);
  }

  @Get('actions')
  async getActions(
    @Query('workspaceId') workspaceId?: string,
    @Query('status') status?: string,
    @Query('kind') kind?: string,
  ) {
    return this.intelligence.listActions({
      workspaceId,
      status: status as IntelligenceActionStatus | undefined,
      kind: kind as IntelligenceAccountKind | undefined,
    });
  }

  @Get('handoff')
  async getHandoff(@Query('workspaceId') workspaceId?: string) {
    return this.intelligence.getWorkspaceHandoff(workspaceId);
  }

  @Post('refresh')
  async refresh(@Body() body: IntelligenceRefreshRequestDto) {
    return this.intelligence.refreshAccounts(body);
  }

  @Post('accounts/import')
  async importAccounts(@Body() body: IntelligenceAccountsImportRequestDto) {
    return this.intelligence.importAccounts(body);
  }

  @Post('reports')
  async generateReport(@Body() body: IntelligenceReportRequestDto) {
    return this.intelligence.generateReport(body);
  }

  @Post('memory')
  async createMemoryEntry(@Body() body: WorkspaceMemoryInputDto) {
    return this.intelligence.createMemoryEntry(body);
  }

  @Get('artifacts/:id/export')
  async exportArtifact(
    @Param('id') id: string,
    @Query('format') format: 'csv' | 'json' = 'json',
    @Res() res: any,
  ) {
    const exportResult = await this.intelligence.exportArtifact(id, format);
    if (format === 'csv') {
      res.setHeader('Content-Type', exportResult.contentType);
      res.setHeader(
        'Content-Disposition',
        `attachment; filename="${exportResult.filename}"`,
      );
      return res.send(exportResult.body);
    }
    return res.json(exportResult.body);
  }
}
