import { Module } from '@nestjs/common';
import { JwtModule } from '@nestjs/jwt';
import { AlmService } from './alm.service';
import { AlmEnterpriseService } from './alm-enterprise.service';
import { AlmAdvisorService } from './alm-advisor.service';
import { StressTestingService } from './stress-testing/stress-testing.service';
import { ReportsService } from './reports/reports.service';
import { WorkspaceOnboardingService } from './workspace-onboarding.service';
import { CSVIngestionService } from './csv-ingestion.service';
import { AnalysisRunsService } from './analysis-runs.service';
import { IngestionLogsService } from './ingestion-logs.service';
import { ComplianceCalendarService } from './compliance-calendar.service';
import { DurationService } from './duration.service';
// Phase I-III services
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
import { AlmAdvisorV2Service } from './alm-advisor-v2.service';
import { LiquidityStressPackService } from './liquidity-stress-pack.service';
import { IRRPolicyService } from './irr-policy.service';
import { DepositBetaLibraryService } from './deposit-beta-library.service';
import { RepricingGapService } from './repricing-gap.service';
import { FTPAttributionService } from './ftp-attribution.service';
import { ForwardSimulationService } from './forward-simulation.service';
import { PeerAnalyticsService } from './peer-analytics.service';
import { CECLVintageService } from './cecl-vintage.service';
import { MonteCarloService } from './monte-carlo.service';
// Phase V services
import { OASCalculatorService } from './oas-calculator.service';
import { CreditRiskQuantService } from './credit-risk-quant.service';
import { PortfolioVaRService } from './portfolio-var.service';
import { CapitalOptimizerService } from './capital-optimizer.service';
import { AssetEWSService } from './asset-ews.service';
import { PrepaymentEngineService } from './prepayment-engine.service';
import { SOFRMonitorService } from './sofr-monitor.service';
import { TreasuryRatesService } from './treasury-rates.service';
// Phase VI services
import { CAMELScorerService } from './exam-prep/camel-scorer.service';
import { ExamPrepService } from './exam-prep/exam-prep.service';
import { BoardReportService } from './board-report.service';
import { ChatAnalystService } from './chat-analyst.service';
import { NCUA5300Service } from './ncua-5300.service';
import { ProspectIntelligenceService } from './prospect-intelligence.service';
import { NetworkIntelligenceService } from './network-intelligence.service';
import { WebhookService } from './webhook.service';
import { UsageMeteringService } from './usage-metering.service';
import { DataPrivacyService } from './data-privacy.service';
// Gap-closing services
import { CsvIngestV2Service } from './csv-ingest-v2.service';
import { NIMOptimizerService } from './nim-optimizer.service';
import { KeyRateDurationService } from './key-rate-duration.service';
import { LiquidityTransferPricingService } from './liquidity-transfer-pricing.service';
import { USVIExpansionService } from './usvi-expansion.service';
import { ResellerService } from './reseller.service';
// Controllers
import { AlmController } from './alm.controller';
import { AlmAdvisorController } from './alm-advisor.controller';
import { AlmAdvisorV2Controller } from './alm-advisor-v2.controller';
import { AuthGuard } from '../auth/auth.guard';

@Module({
  imports: [
    JwtModule.register({
      secret: process.env.JWT_SECRET,
      signOptions: { expiresIn: '24h' },
    }),
  ],
  controllers: [AlmController, AlmAdvisorController, AlmAdvisorV2Controller],
  providers: [
    // Core
    AlmService, AlmEnterpriseService, AlmAdvisorService, StressTestingService,
    ReportsService, WorkspaceOnboardingService, CSVIngestionService,
    AnalysisRunsService, IngestionLogsService, ComplianceCalendarService, DurationService,
    // Phase I-III
    ScenarioPersistenceService, YieldCurveService, CECLService, FTPService,
    DepositBetaService, LiquidityAdvancedService, ConcentrationService,
    NCUADataPullService, SampleReportFactoryService,
    // Phase IV
    AlmAdvisorV2Service, LiquidityStressPackService, IRRPolicyService,
    DepositBetaLibraryService, RepricingGapService, FTPAttributionService,
    ForwardSimulationService, PeerAnalyticsService,
    CECLVintageService, MonteCarloService,
    // Phase V
    OASCalculatorService, CreditRiskQuantService, PortfolioVaRService,
    CapitalOptimizerService, AssetEWSService, PrepaymentEngineService,
    SOFRMonitorService, TreasuryRatesService,
    // Phase VI
    CAMELScorerService, ExamPrepService,
    BoardReportService, ChatAnalystService, NCUA5300Service, ProspectIntelligenceService,
    NetworkIntelligenceService, WebhookService, UsageMeteringService, DataPrivacyService,
    CsvIngestV2Service, NIMOptimizerService, KeyRateDurationService,
    LiquidityTransferPricingService, USVIExpansionService, ResellerService,
    // Guards
    AuthGuard,
  ],
  exports: [
    AlmService, AlmEnterpriseService, AlmAdvisorService, StressTestingService,
    WorkspaceOnboardingService, CSVIngestionService, AnalysisRunsService,
    IngestionLogsService, ComplianceCalendarService, DurationService,
    ScenarioPersistenceService, YieldCurveService, CECLService, FTPService,
    DepositBetaService, LiquidityAdvancedService, ConcentrationService,
    NCUADataPullService, SampleReportFactoryService,
    AlmAdvisorV2Service, LiquidityStressPackService, IRRPolicyService,
    DepositBetaLibraryService, RepricingGapService, FTPAttributionService,
    ForwardSimulationService, PeerAnalyticsService,
    CECLVintageService, MonteCarloService,
    OASCalculatorService, CreditRiskQuantService, PortfolioVaRService,
    CapitalOptimizerService, AssetEWSService, PrepaymentEngineService,
    SOFRMonitorService, TreasuryRatesService,
    CAMELScorerService, ExamPrepService,
    BoardReportService, ChatAnalystService, NCUA5300Service, ProspectIntelligenceService,
    NetworkIntelligenceService, WebhookService, UsageMeteringService, DataPrivacyService,
    CsvIngestV2Service, NIMOptimizerService, KeyRateDurationService,
    LiquidityTransferPricingService, USVIExpansionService, ResellerService,
  ],
})
export class AlmModule {}
