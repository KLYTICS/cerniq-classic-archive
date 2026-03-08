import {
  Controller, Post, Get, Body, Param, Query, Logger,
  UseGuards, UseInterceptors, Req, Res, UploadedFile,
  BadRequestException,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import { AlmService } from './alm.service';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { StressTestingService } from './stress-testing/stress-testing.service';
import { ReportsService } from './reports/reports.service';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  ScenarioRequestDto,
  LCRRequestDto,
  FullAnalysisRequestDto,
  BalanceSheetDto,
} from './alm.dto';
import type {
  DurationGapResult,
  NIIResult,
  EVEResult,
  LCRResult,
  BPVResult,
  FullAnalysisResult,
} from './alm.dto';
import { CreateInstitutionDto } from './dto/create-institution.dto';
import { BulkBalanceSheetImportDto } from './dto/create-balance-sheet-item.dto';

@Controller('api/alm')
export class AlmController {
  private readonly logger = new Logger(AlmController.name);

  constructor(
    private readonly almService: AlmService,
    private readonly almEnterprise: AlmEnterpriseService,
    private readonly stressTesting: StressTestingService,
    private readonly reportsService: ReportsService,
    private readonly onboarding: WorkspaceOnboardingService,
    private readonly csvIngestion: CSVIngestionService,
  ) {}

  // ═══════════════════════════════════════════════════════════════
  //  Enterprise Endpoints (DB-backed, auth-protected)
  // ═══════════════════════════════════════════════════════════════

  @Post('institutions')
  @UseGuards(AuthGuard)
  async createInstitution(@Body() dto: CreateInstitutionDto) {
    this.logger.log(`Creating institution: ${dto.name}`);
    return this.almEnterprise.createInstitution(dto);
  }

  @Get('institutions')
  @UseGuards(AuthGuard)
  async listInstitutions(@Req() req: any) {
    const workspaceId = req.query?.workspaceId;
    if (workspaceId) {
      return this.almEnterprise.getInstitutionsByWorkspace(workspaceId);
    }
    // No workspaceId provided — find all institutions for user's workspaces
    return this.almEnterprise.getInstitutionsByUser(req.user.userId);
  }

  @Get('institutions/:institutionId')
  @UseGuards(AuthGuard)
  async getInstitution(@Param('institutionId') institutionId: string) {
    return this.almEnterprise.getInstitution(institutionId);
  }

  @Post('institutions/:institutionId/balance-sheet-items')
  @UseGuards(AuthGuard)
  async importBalanceSheetItems(
    @Param('institutionId') institutionId: string,
    @Body() dto: BulkBalanceSheetImportDto,
  ) {
    this.logger.log(`Importing ${dto.items.length} balance sheet items for institution ${institutionId}`);
    return this.almEnterprise.importBalanceSheetItems(institutionId, dto.items);
  }

  @Get(':institutionId/summary')
  @UseGuards(AuthGuard)
  async getALMSummary(@Param('institutionId') institutionId: string) {
    this.logger.log(`ALM summary requested for institution ${institutionId}`);
    return this.almEnterprise.getALMSummary(institutionId);
  }

  @Get(':institutionId/cossec-compliance')
  @UseGuards(AuthGuard)
  async getCOSSECCompliance(@Param('institutionId') institutionId: string) {
    this.logger.log(`COSSEC compliance check for institution ${institutionId}`);
    return this.almEnterprise.getCOSSECCompliance(institutionId);
  }

  @Get(':institutionId/duration-gap')
  @UseGuards(AuthGuard)
  async getDurationGap(@Param('institutionId') institutionId: string) {
    return this.almEnterprise.calculateDurationGap(institutionId);
  }

  @Get(':institutionId/nii-sensitivity')
  @UseGuards(AuthGuard)
  async getNIISensitivity(@Param('institutionId') institutionId: string) {
    return this.almEnterprise.calculateNIISensitivity(institutionId);
  }

  @Get(':institutionId/liquidity')
  @UseGuards(AuthGuard)
  async getLiquidity(@Param('institutionId') institutionId: string) {
    return this.almEnterprise.calculateLCR(institutionId);
  }

  @Post('institutions/:institutionId/upload-csv')
  @UseGuards(AuthGuard)
  @UseInterceptors(FileInterceptor('file', {
    limits: { fileSize: 2 * 1024 * 1024 }, // 2MB max
    fileFilter: (_req, file, cb) => {
      if (!file.originalname.match(/\.csv$/i)) {
        return cb(new BadRequestException('Only .csv files are accepted'), false);
      }
      cb(null, true);
    },
  }))
  async uploadCSV(
    @Param('institutionId') institutionId: string,
    @UploadedFile() file: Express.Multer.File,
    @Query('dryRun') dryRun?: string,
  ) {
    if (!file) {
      throw new BadRequestException('No CSV file provided');
    }

    this.logger.log(`CSV upload for institution ${institutionId} (${file.size} bytes, dryRun=${dryRun})`);

    const csvContent = file.buffer.toString('utf-8');
    const result = this.csvIngestion.parseCSV(csvContent);

    if (!result.valid) {
      return { ...result, imported: false };
    }

    // Dry run: validate only, don't import
    if (dryRun === 'true') {
      return { ...result, imported: false };
    }

    // Import validated items
    const importResult = await this.almEnterprise.importBalanceSheetItems(
      institutionId,
      result.items,
    );

    return {
      ...result,
      imported: true,
      importedCount: importResult.count,
    };
  }

  @Get('templates/:type')
  getCSVTemplate(
    @Param('type') type: string,
    @Res() res: any,
  ) {
    const csv = type === 'cooperativa'
      ? this.csvIngestion.getCooperativaTemplate()
      : this.csvIngestion.getGenericTemplate();

    const filename = `balance_sheet_template_${type}.csv`;
    res.set({
      'Content-Type': 'text/csv; charset=utf-8',
      'Content-Disposition': `attachment; filename="${filename}"`,
    });
    // BOM for Excel UTF-8 compatibility
    res.send('\uFEFF' + csv);
  }

  @Post('seed-demo')
  @UseGuards(AuthGuard)
  async seedDemoData(
    @Body() body: { workspaceId: string; type: 'bank' | 'credit_union' | 'family_office' | 'cooperativa' },
  ) {
    this.logger.log(`Seeding demo data: type=${body.type}, workspace=${body.workspaceId}`);
    return this.onboarding.seedDemoData(body.workspaceId, body.type);
  }

  @Post(':institutionId/stress-test')
  @UseGuards(AuthGuard)
  async runStressTest(
    @Param('institutionId') institutionId: string,
    @Body() params: { paths?: number; horizon?: number; volatility?: number; meanReversion?: number },
  ) {
    this.logger.log(`Stress test requested for institution ${institutionId}`);
    return this.stressTesting.runFullStressTest(institutionId, params);
  }

  @Get(':institutionId/report')
  @UseGuards(AuthGuard)
  async downloadReport(
    @Param('institutionId') institutionId: string,
    @Query('lang') lang: string,
    @Res() res: any,
  ) {
    this.logger.log(`PDF report requested for institution ${institutionId} (lang=${lang || 'en'})`);
    const buffer = await this.reportsService.generateALMReport(institutionId, lang);
    const institution = await this.almEnterprise.getInstitution(institutionId);
    const dateStr = new Date().toISOString().split('T')[0];
    const filename = `alm-report-${institution.name.replace(/\s+/g, '-').toLowerCase()}-${dateStr}.pdf`;

    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="${filename}"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  // ═══════════════════════════════════════════════════════════════
  //  Stateless Endpoints (existing — no auth, POST-based)
  // ═══════════════════════════════════════════════════════════════

  @Post('duration-gap')
  durationGap(@Body() dto: ScenarioRequestDto): DurationGapResult {
    this.logger.log('Duration gap analysis requested');
    return this.almService.durationGapAnalysis(dto.balanceSheet);
  }

  @Post('nii-simulation')
  niiSimulation(@Body() dto: ScenarioRequestDto): NIIResult {
    this.logger.log('NII simulation requested');
    return this.almService.niiSimulation(dto.balanceSheet, dto.rateShocks);
  }

  @Post('eve')
  eve(@Body() dto: ScenarioRequestDto): EVEResult {
    this.logger.log('EVE analysis requested');
    return this.almService.eveAnalysis(dto.balanceSheet, dto.rateShocks);
  }

  @Post('lcr')
  lcr(@Body() dto: LCRRequestDto): LCRResult {
    this.logger.log('LCR computation requested');
    return this.almService.liquidityCoverageRatio(dto);
  }

  @Post('bpv')
  bpv(@Body() dto: ScenarioRequestDto): BPVResult {
    this.logger.log('BPV analysis requested');
    return this.almService.basisPointValue(dto.balanceSheet);
  }

  @Post('full-analysis')
  fullAnalysis(@Body() dto: FullAnalysisRequestDto): FullAnalysisResult {
    this.logger.log('Full ALM analysis requested');
    return this.almService.fullAnalysis(dto.balanceSheet, dto.rateShocks, dto.lcr);
  }

  @Get('demo-balance-sheet')
  demoBalanceSheet(): BalanceSheetDto {
    this.logger.log('Demo balance sheet requested');
    return this.almService.getDemoBalanceSheet();
  }

  @Get('demo-analysis')
  demoAnalysis(): FullAnalysisResult {
    this.logger.log('Demo full analysis requested');
    const bs = this.almService.getDemoBalanceSheet();
    return this.almService.fullAnalysis(bs);
  }
}
