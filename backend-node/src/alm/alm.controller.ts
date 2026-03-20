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
import { AnalysisRunsService } from './analysis-runs.service';
import { IngestionLogsService } from './ingestion-logs.service';
import { ComplianceCalendarService } from './compliance-calendar.service';
import { ScenarioPersistenceService } from './scenarios/scenario-persistence.service';
import { YieldCurveService } from './yield-curve.service';
import { CECLService } from './cecl.service';
import { FTPService } from './ftp.service';
import { DepositBetaService } from './deposit-beta.service';
import { LiquidityAdvancedService } from './liquidity-advanced.service';
import { ConcentrationService } from './concentration.service';
import { NCUADataPullService } from './data-pull/ncua-data-pull.service';
import { SampleReportFactoryService } from './sample-report-factory.service';
// Phase IV services
import { LiquidityStressPackService } from './liquidity-stress-pack.service';
import { IRRPolicyService } from './irr-policy.service';
import { DepositBetaLibraryService } from './deposit-beta-library.service';
import { RepricingGapService } from './repricing-gap.service';
import { FTPAttributionService } from './ftp-attribution.service';
import { ForwardSimulationService } from './forward-simulation.service';
import { PeerAnalyticsService } from './peer-analytics.service';
import { CECLVintageService } from './cecl-vintage.service';
import { MonteCarloService } from './monte-carlo.service';
import { OASCalculatorService } from './oas-calculator.service';
import { CreditRiskQuantService } from './credit-risk-quant.service';
import { PortfolioVaRService } from './portfolio-var.service';
import { CapitalOptimizerService } from './capital-optimizer.service';
import { AssetEWSService } from './asset-ews.service';
import { PrepaymentEngineService } from './prepayment-engine.service';
import { SOFRMonitorService } from './sofr-monitor.service';
import { TreasuryRatesService } from './treasury-rates.service';
import { AuthGuard } from '../auth/auth.guard';
import {
  ScenarioRequestDto,
  LCRRequestDto,
  FullAnalysisRequestDto,
  BalanceSheetDto,
} from './alm.dto';
import { SaveScenarioDto, CompareScenarioDto } from './dto/save-scenario.dto';
import { YieldCurveShockDto, SaveYieldCurveDto } from './dto/yield-curve.dto';
import { ImportLoanSegmentsDto, WARMCalculationDto } from './dto/cecl.dto';
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
import { CreateAnalysisRunDto } from './dto/create-analysis-run.dto';
import { PaginationQueryDto } from '../common/dto/pagination.dto';

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
    private readonly analysisRuns: AnalysisRunsService,
    private readonly ingestionLogs: IngestionLogsService,
    private readonly complianceCalendar: ComplianceCalendarService,
    private readonly scenarioPersistence: ScenarioPersistenceService,
    private readonly yieldCurve: YieldCurveService,
    private readonly cecl: CECLService,
    private readonly ftp: FTPService,
    private readonly depositBeta: DepositBetaService,
    private readonly liquidityAdvanced: LiquidityAdvancedService,
    private readonly concentration: ConcentrationService,
    private readonly ncuaDataPull: NCUADataPullService,
    private readonly sampleReportFactory: SampleReportFactoryService,
    // Phase IV
    private readonly liquidityStressPack: LiquidityStressPackService,
    private readonly irrPolicy: IRRPolicyService,
    private readonly depositBetaLibrary: DepositBetaLibraryService,
    private readonly repricingGap: RepricingGapService,
    private readonly ftpAttribution: FTPAttributionService,
    private readonly forwardSim: ForwardSimulationService,
    private readonly peerAnalytics: PeerAnalyticsService,
    private readonly ceclVintage: CECLVintageService,
    private readonly monteCarlo: MonteCarloService,
    // Phase V
    private readonly oasCalculator: OASCalculatorService,
    private readonly creditRiskQuant: CreditRiskQuantService,
    private readonly portfolioVaR: PortfolioVaRService,
    private readonly capitalOptimizer: CapitalOptimizerService,
    private readonly assetEWS: AssetEWSService,
    private readonly prepaymentEngine: PrepaymentEngineService,
    private readonly sofrMonitor: SOFRMonitorService,
    private readonly treasuryRates: TreasuryRatesService,
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
  async listInstitutions(@Req() req: any, @Query() pagination: PaginationQueryDto) {
    const workspaceId = req.query?.workspaceId;
    if (workspaceId) {
      return this.almEnterprise.getInstitutionsByWorkspace(workspaceId, pagination);
    }
    // No workspaceId provided — find all institutions for user's workspaces
    return this.almEnterprise.getInstitutionsByUser(req.user.userId, pagination);
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

  @Get('institutions/:institutionId/balance-sheet-items')
  @UseGuards(AuthGuard)
  async listBalanceSheetItems(
    @Param('institutionId') institutionId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.almEnterprise.listBalanceSheetItems(institutionId, pagination);
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

  @Get(':institutionId/regulatory-compliance')
  @UseGuards(AuthGuard)
  async getRegulatoryCompliance(@Param('institutionId') institutionId: string) {
    this.logger.log(`Regulatory compliance check for institution ${institutionId}`);
    return this.almEnterprise.getRegulatoryCompliance(institutionId);
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

  @Post('analysis/run')
  @UseGuards(AuthGuard)
  async createAnalysisRun(
    @Req() req: any,
    @Body() dto: CreateAnalysisRunDto,
  ) {
    this.logger.log(`Analysis run requested for institution ${dto.institutionId}`);
    return this.analysisRuns.createRun(req.user.userId, dto);
  }

  @Get('analysis-runs/:runId')
  @UseGuards(AuthGuard)
  async getAnalysisRun(
    @Req() req: any,
    @Param('runId') runId: string,
  ) {
    return this.analysisRuns.getRun(req.user.userId, runId);
  }

  @Get('institutions/:institutionId/analysis-runs')
  @UseGuards(AuthGuard)
  async listAnalysisRuns(
    @Req() req: any,
    @Param('institutionId') institutionId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.analysisRuns.listRuns(req.user.userId, institutionId, pagination);
  }

  @Get('institutions/:institutionId/ingestion-logs')
  @UseGuards(AuthGuard)
  async listIngestionLogs(
    @Req() req: any,
    @Param('institutionId') institutionId: string,
    @Query() pagination: PaginationQueryDto,
  ) {
    return this.ingestionLogs.listInstitutionLogs(req.user.userId, institutionId, pagination);
  }

  @Get(':institutionId/calendar')
  @UseGuards(AuthGuard)
  async getComplianceCalendar(@Param('institutionId') institutionId: string) {
    this.logger.log(`Compliance calendar requested for institution ${institutionId}`);
    return this.complianceCalendar.getUpcomingDeadlines(institutionId);
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
    @Req() req: any,
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
    const isDryRun = dryRun === 'true';

    if (!result.valid) {
      const log = await this.ingestionLogs.recordLog({
        userId: req.user.userId,
        institutionId,
        source: 'manual_upload',
        sourceFilename: file.originalname,
        dryRun: isDryRun,
        status: 'FAILED',
        parseResult: result,
      });
      return { ...result, imported: false, ingestionLogId: log.id };
    }

    // Dry run: validate only, don't import
    if (isDryRun) {
      const log = await this.ingestionLogs.recordLog({
        userId: req.user.userId,
        institutionId,
        source: 'manual_upload',
        sourceFilename: file.originalname,
        dryRun: true,
        status: 'DRY_RUN',
        parseResult: result,
      });
      return { ...result, imported: false, ingestionLogId: log.id };
    }

    // Import validated items
    const importResult = await this.almEnterprise.importBalanceSheetItems(
      institutionId,
      result.items,
    );
    const log = await this.ingestionLogs.recordLog({
      userId: req.user.userId,
      institutionId,
      source: 'manual_upload',
      sourceFilename: file.originalname,
      status: 'IMPORTED',
      parseResult: result,
      importedCount: importResult.count,
    });

    return {
      ...result,
      imported: true,
      importedCount: importResult.count,
      ingestionLogId: log.id,
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

  // ─── FTP (Funds Transfer Pricing) ────────────────────────────────

  @Get(':institutionId/ftp')
  @UseGuards(AuthGuard)
  async getFTPAnalysis(@Param('institutionId') institutionId: string) {
    this.logger.log(`FTP analysis for institution ${institutionId}`);
    return this.ftp.getFTPAnalysis(institutionId);
  }

  @Post(':institutionId/ftp/custom')
  @UseGuards(AuthGuard)
  async runCustomFTP(
    @Param('institutionId') institutionId: string,
    @Body() body: { curveId?: string; spreadAdjBps?: number },
  ) {
    return this.ftp.getFTPAnalysis(institutionId, body.spreadAdjBps);
  }

  @Get(':institutionId/ftp/segments')
  @UseGuards(AuthGuard)
  async getFTPSegments(@Param('institutionId') institutionId: string) {
    return this.ftp.getFTPSegments(institutionId);
  }

  // ─── CECL Credit Loss ────────────────────────────────────────────

  @Get(':institutionId/cecl')
  @UseGuards(AuthGuard)
  async getCECLAnalysis(
    @Param('institutionId') institutionId: string,
    @Query('methodology') methodology?: string,
  ) {
    this.logger.log(`CECL analysis for institution ${institutionId} (method=${methodology || 'warm'})`);
    return this.cecl.getCECLAnalysis(institutionId, methodology);
  }

  @Post(':institutionId/cecl/segments')
  @UseGuards(AuthGuard)
  async importLoanSegments(
    @Param('institutionId') institutionId: string,
    @Body() dto: ImportLoanSegmentsDto,
  ) {
    this.logger.log(`Importing ${dto.segments.length} loan segments for institution ${institutionId}`);
    return this.cecl.importLoanSegments(institutionId, dto.segments);
  }

  @Get(':institutionId/cecl/forecast')
  @UseGuards(AuthGuard)
  async getCECLForecast(@Param('institutionId') institutionId: string) {
    return this.cecl.getCECLForecast(institutionId);
  }

  @Post('cecl/warm')
  @UseGuards(AuthGuard)
  async runWARMCalculation(@Body() dto: WARMCalculationDto) {
    return this.cecl.calculateWARM(dto.segments);
  }

  // ─── Yield Curve ─────────────────────────────────────────────────

  @Get(':institutionId/yield-curve-analysis')
  @UseGuards(AuthGuard)
  async getYieldCurveAnalysis(@Param('institutionId') institutionId: string) {
    this.logger.log(`Yield curve analysis for institution ${institutionId}`);
    return this.yieldCurve.getYieldCurveAnalysis(institutionId);
  }

  @Post(':institutionId/yield-curve/forward-nii')
  @UseGuards(AuthGuard)
  async computeForwardNII(
    @Param('institutionId') institutionId: string,
    @Body() body: { shockBpsPerTenor: Record<string, number>; quarters?: number },
  ) {
    return this.yieldCurve.computeForwardNIISchedule(institutionId, body.shockBpsPerTenor, body.quarters);
  }

  @Post('yield-curve/shocks')
  @UseGuards(AuthGuard)
  async applyYieldCurveShocks(@Body() dto: YieldCurveShockDto) {
    // If curveId provided, load that curve; otherwise use default
    const baseCurve = dto.curveId
      ? (await this.yieldCurve.saveCustomCurve as any) // loaded internally
      : undefined;
    return this.yieldCurve.applyShock(
      baseCurve ?? [
        { tenor: 0.25, rate: 0.048 }, { tenor: 0.5, rate: 0.0465 }, { tenor: 1, rate: 0.044 },
        { tenor: 2, rate: 0.042 }, { tenor: 3, rate: 0.041 }, { tenor: 5, rate: 0.0405 },
        { tenor: 7, rate: 0.041 }, { tenor: 10, rate: 0.042 }, { tenor: 20, rate: 0.0455 }, { tenor: 30, rate: 0.0465 },
      ],
      dto.shockType,
      dto.customShocks,
    );
  }

  @Post('yield-curve/custom')
  @UseGuards(AuthGuard)
  async saveCustomYieldCurve(@Body() dto: SaveYieldCurveDto) {
    this.logger.log(`Saving custom yield curve "${dto.name}" for institution ${dto.institutionId}`);
    return this.yieldCurve.saveCustomCurve(dto);
  }

  // ─── Scenario Persistence ────────────────────────────────────────

  @Post('scenarios/save')
  @UseGuards(AuthGuard)
  async saveScenario(@Req() req: any, @Body() dto: SaveScenarioDto) {
    this.logger.log(`Saving scenario "${dto.name}" for institution ${dto.institutionId}`);
    return this.scenarioPersistence.saveScenario(req.user.userId, dto);
  }

  @Get(':institutionId/scenarios')
  @UseGuards(AuthGuard)
  async listScenarios(
    @Param('institutionId') institutionId: string,
    @Query() query: PaginationQueryDto & { tag?: string },
  ) {
    return this.scenarioPersistence.listScenarios(institutionId, query);
  }

  @Get('scenarios/:scenarioId')
  @UseGuards(AuthGuard)
  async getScenario(@Param('scenarioId') scenarioId: string) {
    return this.scenarioPersistence.getScenario(scenarioId);
  }

  @Post('scenarios/compare')
  @UseGuards(AuthGuard)
  async compareScenarios(@Body() dto: CompareScenarioDto) {
    return this.scenarioPersistence.compareScenarios(dto.scenarioIds);
  }

  @Post('scenarios/:scenarioId/duplicate')
  @UseGuards(AuthGuard)
  async duplicateScenario(
    @Req() req: any,
    @Param('scenarioId') scenarioId: string,
    @Body() body: { name?: string },
  ) {
    return this.scenarioPersistence.duplicateScenario(scenarioId, req.user.userId, body.name);
  }

  @Post('scenarios/:scenarioId/delete')
  @UseGuards(AuthGuard)
  async deleteScenario(@Param('scenarioId') scenarioId: string) {
    return this.scenarioPersistence.deleteScenario(scenarioId);
  }

  // ─── Deposit Beta ───────────────────────────────────────────────

  @Get(':institutionId/deposit-betas')
  @UseGuards(AuthGuard)
  async getDepositBetas(@Param('institutionId') institutionId: string) {
    return this.depositBeta.getDepositBetas(institutionId);
  }

  @Post(':institutionId/deposit-betas')
  @UseGuards(AuthGuard)
  async updateDepositBetas(
    @Param('institutionId') institutionId: string,
    @Body() body: { betas: Array<{ subcategory: string; beta: number }> },
  ) {
    return this.depositBeta.updateDepositBetas(institutionId, body.betas);
  }

  @Get(':institutionId/deposit-beta-impact')
  @UseGuards(AuthGuard)
  async getDepositBetaImpact(
    @Param('institutionId') institutionId: string,
    @Query('shockBps') shockBps?: string,
  ) {
    return this.depositBeta.calculateBetaImpact(institutionId, shockBps ? parseInt(shockBps) : 100);
  }

  // ─── Advanced Liquidity ────────────────────────────────────────

  @Get(':institutionId/liquidity-advanced')
  @UseGuards(AuthGuard)
  async getAdvancedLiquidity(@Param('institutionId') institutionId: string) {
    this.logger.log(`Advanced liquidity analysis for institution ${institutionId}`);
    return this.liquidityAdvanced.getAdvancedLiquidity(institutionId);
  }

  // ─── Concentration ─────────────────────────────────────────────

  @Get(':institutionId/concentration')
  @UseGuards(AuthGuard)
  async getConcentrationAnalysis(@Param('institutionId') institutionId: string) {
    this.logger.log(`Concentration analysis for institution ${institutionId}`);
    return this.concentration.getConcentrationAnalysis(institutionId);
  }

  @Post(':institutionId/concentration/limits')
  @UseGuards(AuthGuard)
  async saveConcentrationLimits(
    @Param('institutionId') institutionId: string,
    @Body() body: { limits: Array<{ limitType: string; limitName: string; maxPct: number }> },
  ) {
    return this.concentration.saveConcentrationLimits(institutionId, body.limits);
  }

  // ─── NCUA Auto-Pull ────────────────────────────────────────────

  @Post('ncua/pull')
  @UseGuards(AuthGuard)
  async pullNCUAData(@Body() body: { charterNumber: string }) {
    this.logger.log(`NCUA data pull for charter ${body.charterNumber}`);
    return this.ncuaDataPull.pullByCharterNumber(body.charterNumber);
  }

  // ─── Stress Testing ────────────────────────────────────────────

  @Post(':institutionId/stress-test')
  @UseGuards(AuthGuard)
  async runStressTest(
    @Param('institutionId') institutionId: string,
    @Body() params: { paths?: number; horizon?: number; volatility?: number; meanReversion?: number },
  ) {
    this.logger.log(`Stress test requested for institution ${institutionId}`);
    return this.stressTesting.runFullStressTest(institutionId, params);
  }

  @Post(':institutionId/stress/custom')
  @UseGuards(AuthGuard)
  async runCustomStressScenario(
    @Param('institutionId') institutionId: string,
    @Body() params: {
      rateShockBps: number;
      depositRunoffPct: number;
      defaultRateIncreasePct: number;
      energyCostShockPct: number;
    },
  ) {
    this.logger.log(`Custom stress scenario for institution ${institutionId}: rate=${params.rateShockBps}bps`);
    return this.stressTesting.runCustomScenario(institutionId, params);
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

  // ─── MP-003: CECL Vintage Analyzer ──────────────────────────────

  @Get(':institutionId/cecl/vintage')
  @UseGuards(AuthGuard)
  async getCECLVintage(
    @Param('institutionId') institutionId: string,
    @Query('scenario') scenario?: string,
  ) {
    return this.ceclVintage.runVintageAnalysis(
      institutionId,
      (scenario as 'base' | 'adverse' | 'severe') ?? 'base',
    );
  }

  @Get(':institutionId/cecl/cohorts')
  @UseGuards(AuthGuard)
  async getCECLCohorts(@Param('institutionId') institutionId: string) {
    return this.ceclVintage.getCohortMatrix(institutionId);
  }

  @Post(':institutionId/cecl/cohorts/upload')
  @UseGuards(AuthGuard)
  async uploadCohorts(
    @Param('institutionId') institutionId: string,
    @Body() body: { cohorts: any[] },
  ) {
    return this.ceclVintage.importCohorts(institutionId, body.cohorts);
  }

  // ─── MP-013: Monte Carlo Simulation ───────────────────────────

  @Post(':institutionId/monte-carlo/run')
  @UseGuards(AuthGuard)
  async runMonteCarlo(
    @Param('institutionId') institutionId: string,
    @Body() body: { paths?: number; quarters?: number; kappa?: number; theta?: number; sigma?: number },
  ) {
    this.logger.log(`Monte Carlo ${body.paths ?? 10000} paths for ${institutionId}`);
    return this.monteCarlo.runSimulation(institutionId, body);
  }

  // ─── Phase IV: COSSEC Stress Pack (MP-004) ──────────────────────

  @Get(':institutionId/stress-pack')
  @UseGuards(AuthGuard)
  async runStressPack(@Param('institutionId') institutionId: string) {
    this.logger.log(`COSSEC 5-scenario stress pack for ${institutionId}`);
    return this.liquidityStressPack.runAllScenarios(institutionId);
  }

  @Get(':institutionId/stress-pack/:scenarioId')
  @UseGuards(AuthGuard)
  async runStressPackScenario(
    @Param('institutionId') institutionId: string,
    @Param('scenarioId') scenarioId: string,
  ) {
    return this.liquidityStressPack.runScenario(institutionId, scenarioId);
  }

  // ─── Phase IV: IRR Policy Engine (MP-005) ──────────────────────

  @Get(':institutionId/irr-policy')
  @UseGuards(AuthGuard)
  async getIRRPolicyDashboard(@Param('institutionId') institutionId: string) {
    return this.irrPolicy.checkAll(institutionId);
  }

  @Get(':institutionId/irr-policy/limits')
  @UseGuards(AuthGuard)
  async getIRRPolicyLimits(@Param('institutionId') institutionId: string) {
    return this.irrPolicy.getLimits(institutionId);
  }

  @Post(':institutionId/irr-policy/limits')
  @UseGuards(AuthGuard)
  async saveIRRPolicyLimits(
    @Param('institutionId') institutionId: string,
    @Body() body: { limits: any[] },
  ) {
    return this.irrPolicy.saveLimits(institutionId, body.limits);
  }

  @Get(':institutionId/irr-policy/breaches')
  @UseGuards(AuthGuard)
  async getBreachHistory(@Param('institutionId') institutionId: string) {
    return this.irrPolicy.getBreachHistory(institutionId);
  }

  // ─── Phase IV: Deposit Beta Library (MP-007) ───────────────────

  @Get(':institutionId/deposit-beta/benchmark')
  @UseGuards(AuthGuard)
  async getDepositBetaBenchmark(@Param('institutionId') institutionId: string) {
    return this.depositBetaLibrary.getBenchmark(institutionId);
  }

  @Get('deposit-beta/library')
  @UseGuards(AuthGuard)
  async getDepositBetaLibrary() {
    return this.depositBetaLibrary.getRawLibrary();
  }

  // ─── Phase IV: Repricing Gap (MP-008) ──────────────────────────

  @Get(':institutionId/repricing-gap')
  @UseGuards(AuthGuard)
  async getRepricingGap(
    @Param('institutionId') institutionId: string,
    @Query('policyLimitPct') policyLimitPct?: string,
  ) {
    this.logger.log(`Repricing gap for ${institutionId}`);
    return this.repricingGap.getRepricingGap(institutionId, policyLimitPct ? parseFloat(policyLimitPct) : 15);
  }

  // ─── Phase IV: FTP v2 Attribution (MP-009) ─────────────────────

  @Get(':institutionId/ftp/attribution')
  @UseGuards(AuthGuard)
  async getFTPAttribution(@Param('institutionId') institutionId: string) {
    this.logger.log(`FTP attribution for ${institutionId}`);
    return this.ftpAttribution.getFullAttribution(institutionId);
  }

  // ─── Phase IV: Forward Simulation (MP-010) ─────────────────────

  @Post(':institutionId/forward-simulation')
  @UseGuards(AuthGuard)
  async runForwardSimulation(
    @Param('institutionId') institutionId: string,
    @Body() body: {
      horizon?: number;
      growthAssumptions?: Record<string, number>;
      prepaymentAssumptions?: Record<string, number>;
      ratePaths?: string[];
    },
  ) {
    this.logger.log(`Forward simulation for ${institutionId}`);
    return this.forwardSim.runForwardSimulation({ institutionId, ...body });
  }

  // ─── Phase IV: Peer Analytics (MP-011) ─────────────────────────

  @Get(':institutionId/peer-analytics')
  @UseGuards(AuthGuard)
  async getPeerAnalytics(@Param('institutionId') institutionId: string) {
    this.logger.log(`Peer analytics for ${institutionId}`);
    return this.peerAnalytics.getPeerAnalytics(institutionId);
  }

  // ─── Phase V: OAS Calculator (MP-014) ──────────────────────────

  @Get(':institutionId/oas')
  @UseGuards(AuthGuard)
  async getOASPortfolio(@Param('institutionId') institutionId: string) {
    this.logger.log(`OAS portfolio analysis for ${institutionId}`);
    return this.oasCalculator.analyzePortfolio(institutionId);
  }

  // ─── Phase V: Credit Risk Quant (MP-015) ──────────────────────

  @Get(':institutionId/credit-risk')
  @UseGuards(AuthGuard)
  async getCreditRisk(@Param('institutionId') institutionId: string) {
    this.logger.log(`Credit risk quant for ${institutionId}`);
    return this.creditRiskQuant.analyzePortfolio(institutionId);
  }

  // ─── Phase V: Portfolio VaR (MP-017) ──────────────────────────

  @Get(':institutionId/var')
  @UseGuards(AuthGuard)
  async getVaRSuite(
    @Param('institutionId') institutionId: string,
    @Query('confidence') confidence?: string,
    @Query('horizon') horizon?: string,
  ) {
    this.logger.log(`VaR suite for ${institutionId}`);
    return this.portfolioVaR.computeVaRSuite(
      institutionId,
      confidence === '99' ? 0.99 : 0.95,
      horizon === '10' ? 10 : 1,
    );
  }

  // ─── Phase V: Capital Optimizer (MP-019) ──────────────────────

  @Post(':institutionId/optimize')
  @UseGuards(AuthGuard)
  async optimizeCapital(
    @Param('institutionId') institutionId: string,
    @Body() body: { aggressiveness?: 'conservative' | 'moderate' | 'aggressive' },
  ) {
    this.logger.log(`Capital optimization for ${institutionId} (${body.aggressiveness ?? 'moderate'})`);
    return this.capitalOptimizer.optimize(institutionId, body.aggressiveness);
  }

  // ─── Phase V: Asset Quality EWS (MP-018) ──────────────────────

  @Get(':institutionId/ews')
  @UseGuards(AuthGuard)
  async getAssetEWS(@Param('institutionId') institutionId: string) {
    this.logger.log(`Asset EWS for ${institutionId}`);
    return this.assetEWS.computeEWS(institutionId);
  }

  // ─── Phase V: Prepayment Engine (MP-016) ──────────────────────

  @Post('prepayment/compute')
  @UseGuards(AuthGuard)
  async computePrepayment(@Body() body: {
    mortgageRate: number; currentMarketRate: number;
    ageMonths: number; month?: number;
    burnoutFactor?: number; disasterOverride?: number;
  }) {
    return this.prepaymentEngine.computePRCPR(body);
  }

  @Post('prepayment/sensitivity')
  @UseGuards(AuthGuard)
  async prepaymentSensitivity(@Body() body: {
    mortgageRate: number; currentMarketRate: number; ageMonths?: number;
  }) {
    return this.prepaymentEngine.computeSensitivity(body.mortgageRate, body.currentMarketRate, body.ageMonths);
  }

  // ─── Phase V: SOFR Monitor (MP-022) ──────────────────────────

  @Get(':institutionId/sofr-exposure')
  @UseGuards(AuthGuard)
  async getSOFRExposure(@Param('institutionId') institutionId: string) {
    return this.sofrMonitor.getExposureReport(institutionId);
  }

  // ─── Phase V: Treasury Rates (MP-025) ─────────────────────────

  @Get('treasury/rates')
  @UseGuards(AuthGuard)
  async getTreasuryRates() {
    return this.treasuryRates.getLatestSnapshot();
  }

  @Get('treasury/curve')
  @UseGuards(AuthGuard)
  async getTreasuryCurve() {
    return this.treasuryRates.getYieldCurvePoints();
  }

  // ─── Sample Report Factory ──────────────────────────────────────

  @Post('sample-report')
  @UseGuards(AuthGuard)
  async generateSampleReport(
    @Body() body: { charterNumber: string; lang?: string },
    @Res() res: any,
  ) {
    this.logger.log(`Sample report requested for charter ${body.charterNumber}`);
    const buffer = await this.sampleReportFactory.generateSampleReport(body.charterNumber, body.lang);
    res.set({
      'Content-Type': 'application/pdf',
      'Content-Disposition': `attachment; filename="sample-alm-report-${body.charterNumber}.pdf"`,
      'Content-Length': buffer.length,
    });
    res.end(buffer);
  }

  @Post('sample-report/prospect')
  @UseGuards(AuthGuard)
  async generateSampleForProspect(
    @Body() body: { charterNumber: string; prospectId: string },
  ) {
    return this.sampleReportFactory.generateAndSaveForProspect(body.charterNumber, body.prospectId);
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
