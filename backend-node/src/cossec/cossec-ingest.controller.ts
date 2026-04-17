import {
  Controller,
  Post,
  Get,
  Param,
  Query,
  Body,
  Headers,
  UnauthorizedException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { CossecIngestService } from './cossec-ingest.service';
import { CossecMatchingService } from './cossec-matching.service';
import {
  CossecIngestPayloadSchema,
  FindingsQuerySchema,
  ManualMatchBodySchema,
  parseOrThrow,
} from './cossec.dto';

@Controller('admin/api/cossec')
export class CossecIngestController {
  private readonly logger = new Logger(CossecIngestController.name);

  constructor(
    private readonly ingestService: CossecIngestService,
    private readonly matchingService: CossecMatchingService,
  ) {}

  // ── Auth helper ──────────────────────────────────────────────────────────

  private verifyAdmin(key: string): void {
    const adminKey = process.env.ADMIN_KEY;
    if (!adminKey || key !== adminKey) {
      throw new UnauthorizedException('Invalid admin key');
    }
  }

  // ── POST /admin/api/cossec/ingest ────────────────────────────────────────

  /**
   * Receive parsed findings from the Python microservice.
   * Requires x-admin-key header.
   */
  @Post('ingest')
  async ingest(
    @Headers('x-admin-key') adminKey: string,
    @Body() body: unknown,
  ) {
    this.verifyAdmin(adminKey);

    let payload;
    try {
      payload = parseOrThrow(CossecIngestPayloadSchema, body);
    } catch (err) {
      throw new BadRequestException(
        (err as Error & { issues?: unknown }).issues ?? (err as Error).message,
      );
    }

    this.logger.log(
      `Ingest request: ${payload.findings.length} findings, examYear=${payload.examYear}`,
    );

    const result = await this.ingestService.ingestFindings(payload);

    return {
      message: 'Ingest complete',
      ...result,
    };
  }

  // ── GET /admin/api/cossec/findings ───────────────────────────────────────

  /**
   * List findings with optional filters (category, severity, examYear).
   */
  @Get('findings')
  async listFindings(
    @Headers('x-admin-key') adminKey: string,
    @Query() query: unknown,
  ) {
    this.verifyAdmin(adminKey);

    let filters;
    try {
      filters = parseOrThrow(FindingsQuerySchema, query);
    } catch (err) {
      throw new BadRequestException(
        (err as Error & { issues?: unknown }).issues ?? (err as Error).message,
      );
    }

    if (filters.category) {
      const stats = await this.ingestService.getFindingsByCategory(
        filters.category,
        filters.severity,
      );
      return stats;
    }

    if (filters.examYear) {
      const summary = await this.ingestService.getExamYearSummary(
        filters.examYear,
      );
      return summary;
    }

    // Default: return exam year summary for the latest available year
    return { message: 'Provide category or examYear filter' };
  }

  // ── GET /admin/api/cossec/findings/:prospectInstitutionId ────────────────

  /**
   * Get all findings for a specific institution.
   */
  @Get('findings/:prospectInstitutionId')
  async getInstitutionFindings(
    @Headers('x-admin-key') adminKey: string,
    @Param('prospectInstitutionId') prospectInstitutionId: string,
  ) {
    this.verifyAdmin(adminKey);

    const findings = await this.ingestService.getInstitutionFindings(
      prospectInstitutionId,
    );

    return {
      prospectInstitutionId,
      count: findings.length,
      findings,
    };
  }

  // ── GET /admin/api/cossec/stats ──────────────────────────────────────────

  /**
   * Aggregated stats: findings by category, severity distribution.
   */
  @Get('stats')
  async getStats(@Headers('x-admin-key') adminKey: string) {
    this.verifyAdmin(adminKey);

    // Aggregate across all findings
    const categories = [
      'ALM_POLICY',
      'DURATION_GAP',
      'LIQUIDITY',
      'CAPITAL_ADEQUACY',
      'CONCENTRATION',
      'GOVERNANCE',
      'DATA_QUALITY',
      'OPERATIONAL',
      'CREDIT_RISK',
      'INTEREST_RATE',
      'COMPLIANCE',
      'OTHER',
    ];

    const categoryStats = await Promise.all(
      categories.map((cat) => this.ingestService.getFindingsByCategory(cat)),
    );

    // Filter out categories with no findings
    const nonEmpty = categoryStats.filter((s) => s.total > 0);

    return {
      categories: nonEmpty,
      totalCategories: nonEmpty.length,
      matchCacheSize: this.matchingService.getMatchCache().size,
    };
  }

  // ── POST /admin/api/cossec/match ─────────────────────────────────────────

  /**
   * Admin: manually match an institution name to a ProspectInstitution.
   * Use this to resolve unmatched findings from the ingest.
   */
  @Post('match')
  async manualMatch(
    @Headers('x-admin-key') adminKey: string,
    @Body() body: unknown,
  ) {
    this.verifyAdmin(adminKey);

    let matchBody;
    try {
      matchBody = parseOrThrow(ManualMatchBodySchema, body);
    } catch (err) {
      throw new BadRequestException(
        (err as Error & { issues?: unknown }).issues ?? (err as Error).message,
      );
    }

    await this.matchingService.addManualMatch(
      matchBody.institutionName,
      matchBody.prospectInstitutionId,
    );

    return {
      message: `Manual match registered: "${matchBody.institutionName}" → ${matchBody.prospectInstitutionId}`,
    };
  }
}
