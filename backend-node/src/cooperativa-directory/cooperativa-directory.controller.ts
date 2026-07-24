import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Put,
  Query,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AdminKeyGuard } from '../auth/admin-key.guard';
import { CooperativaDirectoryService } from './cooperativa-directory.service';

@Controller('admin/api/cooperativa-directory')
@UseGuards(AdminKeyGuard)
export class CooperativaDirectoryController {
  constructor(private readonly directory: CooperativaDirectoryService) {}

  @Post('seed')
  async seedDirectory() {
    return this.directory.seedFullDirectory();
  }

  @Get()
  async listProfiles(@Query('limit') limit?: string) {
    return this.directory.listProfiles(parseInt(limit || '200', 10));
  }

  @Get('export/agent-bundle')
  async exportAgentBundle(@Query('limit') limit?: string) {
    return this.directory.buildAgentBundle(parseInt(limit || '500', 10));
  }

  @Get('export/agent-bundle.ndjson')
  async exportAgentBundleNdjson(
    @Query('limit') limit: string | undefined,
    @Res() res: { setHeader: Function; send: Function },
  ) {
    const body = await this.directory.exportAgentBundleNdjson(
      parseInt(limit || '500', 10),
    );
    res.setHeader('Content-Type', 'application/x-ndjson; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cooperativa-directory.ndjson"',
    );
    res.send(body);
  }

  @Get('export/leadership.csv')
  async exportLeadershipCsv(
    @Query('limit') limit: string | undefined,
    @Res() res: { setHeader: Function; send: Function },
  ) {
    const csv = await this.directory.exportFlatCsv(parseInt(limit || '500', 10));
    res.setHeader('Content-Type', 'text/csv; charset=utf-8');
    res.setHeader(
      'Content-Disposition',
      'attachment; filename="cooperativa-leadership.csv"',
    );
    res.send(csv);
  }

  @Get('export/outreach-summary')
  async exportOutreachSummary(@Query('limit') limit?: string) {
    return this.directory.buildOutreachSummary(parseInt(limit || '500', 10));
  }

  @Get(':slugOrId/structure')
  async getStructure(@Param('slugOrId') slugOrId: string) {
    return this.directory.getInstitutionStructure(slugOrId);
  }

  @Put(':slug/leaders/:roleKey')
  async upsertLeader(
    @Param('slug') slug: string,
    @Param('roleKey') roleKey: string,
    @Body()
    body: {
      fullName?: string;
      email?: string;
      phone?: string;
      linkedinUrl?: string;
      provenance?: string;
    },
  ) {
    return this.directory.upsertLeaderContact({
      slug,
      roleKey,
      ...body,
    });
  }
}
