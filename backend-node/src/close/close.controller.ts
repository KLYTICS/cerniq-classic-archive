import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiConsumes,
  ApiOperation,
  ApiParam,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { AuthGuard } from '../auth/auth.guard';
import { OrgMembershipGuard } from './guards/org-membership.guard';
import { CloseService } from './close.service';
import { BinderService } from './binder.service';
import { GlDataSourceService } from './gl-data-source.service';
import { GlUploadService } from './gl-upload.service';
import { CreateCycleDto } from './dto/create-cycle.dto';
import { PostJournalEntryDto } from './dto/post-journal-entry.dto';
import { RunTieOutDto } from './dto/run-tie-out.dto';
import { UpdateTaskDto } from './dto/update-task.dto';

interface AuthedRequest {
  // Canonical chain set by AuthGuard (auth.guard.ts:271 sets `userId`);
  // `id`/`sub` retained for Passport-OAuth + legacy JWT-strategy paths.
  // R5 verifier (verify-userid-chain.mjs) locks reads as
  // `userId ?? id ?? sub ?? <sentinel>`.
  user?: { userId?: string; id?: string; sub?: string };
}

@ApiTags('Close Cockpit')
@ApiBearerAuth('BearerAuth')
@Controller('api/close')
@UseGuards(AuthGuard, OrgMembershipGuard)
export class CloseController {
  constructor(
    private readonly closeService: CloseService,
    private readonly binder: BinderService,
    private readonly gl: GlDataSourceService,
    private readonly glUpload: GlUploadService,
  ) {}

  // ── Cycles ─────────────────────────────────────────────────────────

  @Post(':orgId/cycles')
  @ApiOperation({ summary: 'Open a new month-end close cycle' })
  @ApiParam({ name: 'orgId', description: 'Organization UUID' })
  @ApiResponse({
    status: 201,
    description: 'Cycle opened with default task template',
  })
  @ApiResponse({
    status: 409,
    description: 'Cycle for this period already exists',
  })
  async createCycle(
    @Param('orgId') orgId: string,
    @Body() dto: CreateCycleDto,
  ) {
    return this.closeService.createCycle(
      orgId,
      dto.periodYear,
      dto.periodMonth,
      dto.targetCloseAt ? new Date(dto.targetCloseAt) : undefined,
    );
  }

  @Get(':orgId/cycles')
  @ApiOperation({ summary: 'List all close cycles for an organization' })
  async listCycles(@Param('orgId') orgId: string) {
    return this.closeService.listCycles(orgId);
  }

  @Get('cycles/:cycleId')
  @ApiOperation({
    summary: 'Get full close cycle detail (tasks, recs, JEs, flux)',
  })
  async getCycle(@Param('cycleId') cycleId: string) {
    return this.closeService.getCycle(cycleId);
  }

  @Post('cycles/:cycleId/sign-off')
  @ApiOperation({
    summary: 'CFO sign-off — locks the period if all gates clear',
  })
  async signOff(@Param('cycleId') cycleId: string, @Req() req: AuthedRequest) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.signOffCycle(cycleId, userId);
  }

  @Post('cycles/:cycleId/reopen')
  @ApiOperation({
    summary:
      'Reopen a signed-off cycle. Requires a reason (≥10 chars) — stored in activity log for audit trail.',
  })
  async reopen(
    @Param('cycleId') cycleId: string,
    @Body() body: { reason: string },
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.reopenCycle(cycleId, body.reason ?? '', userId);
  }

  // ── Tasks ──────────────────────────────────────────────────────────

  @Patch('cycles/:cycleId/tasks/:taskId')
  @ApiOperation({
    summary:
      'Update a task — status, owner, due, evidence. Cascades blocker resolution.',
  })
  async updateTask(
    @Param('cycleId') cycleId: string,
    @Param('taskId') taskId: string,
    @Body() dto: UpdateTaskDto,
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.updateTask(cycleId, taskId, dto, userId);
  }

  // ── Tie-out ────────────────────────────────────────────────────────

  @Patch('cycles/:cycleId/reconciliations/:reconId/review')
  @ApiOperation({
    summary:
      'Mark a reconciliation as REVIEWED with optional notes. Idempotent for already-reviewed recs.',
  })
  async reviewReconciliation(
    @Param('cycleId') cycleId: string,
    @Param('reconId') reconId: string,
    @Body() body: { notes?: string },
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.reviewReconciliation(
      cycleId,
      reconId,
      body.notes?.trim() || undefined,
      userId,
    );
  }

  @Post('cycles/:cycleId/tie-out')
  @ApiOperation({ summary: 'Run reconciliation tie-out for an account' })
  async runTieOut(
    @Param('cycleId') cycleId: string,
    @Body() dto: RunTieOutDto,
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.runTieOut(
      cycleId,
      dto.account,
      dto.reconType,
      dto.glBalance,
      dto.externalBalance,
      dto.lines,
      userId,
    );
  }

  // ── Journal entries ────────────────────────────────────────────────

  @Post('cycles/:cycleId/journal-entries')
  @ApiOperation({ summary: 'Post a balanced journal entry' })
  async postJournalEntry(
    @Param('cycleId') cycleId: string,
    @Body() dto: PostJournalEntryDto,
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.postJournalEntry(cycleId, dto, userId);
  }

  @Post('cycles/:cycleId/journal-entries/:jeId/reverse')
  @ApiOperation({
    summary:
      'Reverse a posted JE. Posts an offsetting JE linked back via reversesJeId; flips the original to REVERSED. Requires a ≥10-char reason.',
  })
  async reverseJournalEntry(
    @Param('cycleId') cycleId: string,
    @Param('jeId') jeId: string,
    @Body() body: { reason: string },
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.reverseJournalEntry(
      cycleId,
      jeId,
      body.reason ?? '',
      userId,
    );
  }

  // ── Flux narrative ─────────────────────────────────────────────────

  @Post('cycles/:cycleId/flux')
  @ApiOperation({ summary: 'Generate bilingual flux narrative for the cycle' })
  async runFlux(
    @Param('cycleId') cycleId: string,
    @Body()
    body: {
      rows: Array<{
        account: string;
        priorBalance: number;
        currentBalance: number;
      }>;
    },
    @Req() req: AuthedRequest,
  ) {
    const userId =
      req.user?.userId ?? req.user?.id ?? req.user?.sub ?? 'system';
    return this.closeService.runFlux(cycleId, body.rows, userId);
  }

  // ── Activity feed ──────────────────────────────────────────────────

  @Get('cycles/:cycleId/activity')
  @ApiOperation({ summary: 'Recent activity stream for the cycle workspace' })
  async listActivity(
    @Param('cycleId') cycleId: string,
    @Query('limit') limit?: string,
  ) {
    const parsed = limit ? parseInt(limit, 10) : 50;
    const safeLimit = Number.isFinite(parsed)
      ? Math.min(Math.max(parsed, 1), 500)
      : 50;
    return this.closeService.listActivity(cycleId, safeLimit);
  }

  // ── Audit binder ───────────────────────────────────────────────────

  @Get('cycles/:cycleId/binder')
  @ApiOperation({ summary: 'Build deterministic audit binder JSON pack' })
  async binderPack(@Param('cycleId') cycleId: string) {
    return this.binder.build(cycleId);
  }

  // ── GL integration ─────────────────────────────────────────────────

  @Get(':orgId/gl-balance')
  @ApiOperation({
    summary:
      'Pull a single GL balance for an account. Falls back to deterministic demo data when no real ALM data is wired.',
  })
  async getGlBalance(
    @Param('orgId') orgId: string,
    @Query('account') account: string,
    @Query('periodYear') periodYear: string,
    @Query('periodMonth') periodMonth: string,
  ) {
    if (!account || !periodYear || !periodMonth) {
      return { error: 'account, periodYear and periodMonth are required' };
    }
    const y = parseInt(periodYear, 10);
    const m = parseInt(periodMonth, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return { error: 'Invalid period' };
    }
    return this.gl.getBalance(orgId, account, y, m);
  }

  @Get(':orgId/gl-accounts')
  @ApiOperation({
    summary:
      'List every account the org has a GL balance for, with prior and current period balances. Used by the flux panel auto-populate.',
  })
  async listGlAccounts(
    @Param('orgId') orgId: string,
    @Query('periodYear') periodYear: string,
    @Query('periodMonth') periodMonth: string,
  ) {
    const y = parseInt(periodYear, 10);
    const m = parseInt(periodMonth, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return { error: 'Invalid period' };
    }
    return this.gl.listAccountBalances(orgId, y, m);
  }

  @Get(':orgId/gl-snapshots')
  @ApiOperation({
    summary:
      'List the org\u2019s GL balance snapshot rows for a given period. Used by the GL Snapshot inspector panel.',
  })
  async listGlSnapshots(
    @Param('orgId') orgId: string,
    @Query('periodYear') periodYear: string,
    @Query('periodMonth') periodMonth: string,
  ) {
    const y = parseInt(periodYear, 10);
    const m = parseInt(periodMonth, 10);
    if (!Number.isFinite(y) || !Number.isFinite(m) || m < 1 || m > 12) {
      return { error: 'Invalid period' };
    }
    return this.gl.listSnapshotsForPeriod(orgId, y, m);
  }

  @Delete(':orgId/gl-snapshots/:snapshotId')
  @ApiOperation({
    summary:
      'Delete a single GL balance snapshot row by id. Idempotent for already-gone rows.',
  })
  async deleteGlSnapshot(
    @Param('orgId') orgId: string,
    @Param('snapshotId') snapshotId: string,
  ) {
    return this.gl.deleteSnapshot(orgId, snapshotId);
  }

  @Post(':orgId/gl-upload')
  @ApiOperation({
    summary:
      'Upload a GL CSV (account,period_year,period_month,balance[,notes]). Upserts into gl_balance_snapshots — safe to re-run. Returns row counts + per-row errors.',
  })
  @ApiConsumes('multipart/form-data')
  @UseInterceptors(
    FileInterceptor('file', {
      limits: { fileSize: 10 * 1024 * 1024 }, // 10 MB
      fileFilter: (
        _req: unknown,
        file: { originalname: string },
        cb: (err: Error | null, accept: boolean) => void,
      ) => {
        if (!file.originalname.match(/\.csv$/i)) {
          cb(new BadRequestException('Only .csv files are accepted'), false);
          return;
        }
        cb(null, true);
      },
    }),
  )
  async uploadGlCsv(
    @Param('orgId') orgId: string,
    @UploadedFile() file: Express.Multer.File,
    @Req() req: AuthedRequest,
  ) {
    if (!file) {
      throw new BadRequestException('No CSV file provided');
    }
    const userId = req.user?.userId ?? req.user?.id ?? req.user?.sub ?? null;
    const csvContent = file.buffer.toString('utf-8');
    const sourceLabel = `upload:${file.originalname}`;
    return this.glUpload.upload(orgId, csvContent, sourceLabel, userId);
  }
}
