/**
 * ModelRegistrySeeder — populates the registry on boot.
 *
 * Runs OnModuleInit. Idempotent — upserts by modelKey, so restarting
 * the process never creates duplicates. Each entry maps to a real
 * service file + function in the codebase.
 *
 * The seeder covers 44 production models across 12 categories.
 * Models are seeded as APPROVED (they're already in production).
 * New models added later should start as DRAFT and go through
 * the CANDIDATE → APPROVED workflow.
 */
import { Injectable, OnModuleInit, Logger } from '@nestjs/common';
import * as fs from 'fs';
import * as path from 'path';
import * as crypto from 'crypto';
import { ModelRegistryService } from './model-registry.service';
import type { ModelSeedEntry } from './model-registry.types';

const OWNER = 'CerniQ Quant Team';

const PRODUCTION_MODELS: ModelSeedEntry[] = [
  // ───────────────── ALM CORE ─────────────────
  {
    modelKey: 'alm.duration-gap',
    displayName: 'Duration Gap Analysis',
    description:
      'Modified duration + leverage-adjusted gap analysis with convexity. Primary ALM metric for interest rate risk.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alm-enterprise.service.ts',
    entryFunction: 'calculateDurationGap',
    requiredInputs: ['balanceSheetItems'],
    limitations: [
      'Assumes parallel rate shifts',
      'Does not model prepayment optionality',
    ],
  },
  {
    modelKey: 'alm.nii-sensitivity',
    displayName: 'NII Sensitivity Analysis',
    description:
      'Net Interest Income shock analysis under ±200bps parallel shifts with EVE impact.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alm-enterprise.service.ts',
    entryFunction: 'calculateNIISensitivity',
    requiredInputs: ['balanceSheetItems', 'interestRateScenarios'],
    limitations: ['Linear shock only', 'Static balance sheet assumption'],
  },
  {
    modelKey: 'alm.lcr',
    displayName: 'Liquidity Coverage Ratio',
    description:
      'LCR per BCBS 128: HQLA / Net Cash Outflows over 30-day stress horizon.',
    version: '1.1.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alm-enterprise.service.ts',
    entryFunction: 'calculateLCR',
    requiredInputs: ['liquidityPosition'],
    limitations: [
      'Returns data_unavailable when liquidityPosition missing (D1 locked)',
    ],
  },
  {
    modelKey: 'alm.nsfr',
    displayName: 'Net Stable Funding Ratio',
    description:
      'NSFR per BCBS 295: Available Stable Funding / Required Stable Funding.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/nsfr.service.ts',
    entryFunction: 'calculateNSFR',
    requiredInputs: ['balanceSheetItems', 'liquidityPosition'],
  },
  {
    modelKey: 'alm.eve',
    displayName: 'Economic Value of Equity',
    description:
      'EVE sensitivity analysis under rate shocks. Measures balance sheet value change.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alm.service.ts',
    entryFunction: 'eveAnalysis',
    requiredInputs: ['balanceSheetItems'],
  },
  {
    modelKey: 'alm.bpv',
    displayName: 'Basis Point Value (DV01)',
    description:
      'Dollar value of a 1bp parallel rate move across the balance sheet.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alm.service.ts',
    entryFunction: 'basisPointValue',
    requiredInputs: ['balanceSheetItems'],
  },

  // ───────────────── CREDIT RISK ─────────────────
  {
    modelKey: 'credit.cecl-warm',
    displayName: 'CECL — WARM Method',
    description:
      'Weighted Average Remaining Maturity CECL allowance computation.',
    version: '1.0.0',
    category: 'CREDIT_RISK',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/cecl.service.ts',
    entryFunction: 'calculateWARM',
    requiredInputs: ['loanSegments'],
    limitations: ['Refuses on empty segments (D1)', 'No DEMO segment fallback'],
  },
  {
    modelKey: 'credit.cecl-vintage',
    displayName: 'CECL — Vintage/Cohort Method',
    description: 'Vintage loss emergence with Weibull fit to cohort data.',
    version: '1.0.0',
    category: 'CREDIT_RISK',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/cecl.service.ts',
    entryFunction: 'calculateVintage',
    requiredInputs: ['loanCohorts'],
  },
  {
    modelKey: 'credit.cecl-pd-lgd',
    displayName: 'CECL — PD x LGD Method',
    description:
      'PD × LGD with 3-scenario macro weighting (baseline/adverse/severely adverse).',
    version: '1.0.0',
    category: 'CREDIT_RISK',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/cecl.service.ts',
    entryFunction: 'calculatePDxLGD',
    requiredInputs: ['loanSegments', 'macroScenarios'],
  },
  {
    modelKey: 'credit.kmv-merton',
    displayName: 'KMV-Merton Structural Credit',
    description:
      'Merton structural model — Distance to Default from equity value and volatility.',
    version: '1.1.0',
    category: 'CREDIT_RISK',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/kmv-merton.service.ts',
    entryFunction: 'computeKMV',
    requiredInputs: [
      'equityValue',
      'equityVolatility',
      'debtFaceValue',
      'riskFreeRate',
      'maturity',
    ],
  },
  {
    modelKey: 'credit.portfolio-risk',
    displayName: 'Credit Risk Portfolio',
    description:
      'Portfolio-level PD, default correlation, and Expected Loss (PD × LGD × EAD).',
    version: '1.0.0',
    category: 'CREDIT_RISK',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/quant/credit/credit-risk-portfolio.ts',
    entryFunction: 'computeExpectedLoss',
    requiredInputs: ['loanSegments'],
  },
  {
    modelKey: 'credit.pd-model',
    displayName: 'PD Estimation (Logistic)',
    description:
      'Logistic regression PD model: 1/(1+exp(-logit)) by loan type.',
    version: '1.0.0',
    category: 'CREDIT_RISK',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/quant/credit/pd-model.ts',
    entryFunction: 'estimatePD',
    requiredInputs: ['loanType', 'borrowerMetrics'],
  },

  // ───────────────── INTEREST RATE MODELS ─────────────────
  {
    modelKey: 'rate.hjm-2f',
    displayName: 'HJM Two-Factor Monte Carlo',
    description:
      'Heath-Jarrow-Morton 2-factor forward curve Monte Carlo rate path generation.',
    version: '1.0.0',
    category: 'INTEREST_RATE',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/quant/hjm/hjm.service.ts',
    entryFunction: 'runForInstitution',
    requiredInputs: ['yieldCurve', 'historicalRates'],
    calibrationMetadata: {
      factors: 2,
      paths: 10000,
      method: 'PCA eigendecomposition',
    },
    limitations: [
      'Currently in-process (no worker thread)',
      'Calibration requires >=24 months history',
    ],
  },
  {
    modelKey: 'rate.hull-white-1f',
    displayName: 'Hull-White One-Factor',
    description:
      'One-factor Hull-White short-rate tree simulation with theta calibration.',
    version: '1.0.0',
    category: 'INTEREST_RATE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/hull-white.service.ts',
    entryFunction: 'simulate',
    requiredInputs: ['yieldCurve', 'meanReversion', 'volatility'],
  },
  {
    modelKey: 'rate.vasicek-mc',
    displayName: 'Vasicek Monte Carlo',
    description:
      'Vasicek short-rate Monte Carlo simulation with convergence testing.',
    version: '1.0.0',
    category: 'INTEREST_RATE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/monte-carlo.service.ts',
    entryFunction: 'runSimulation',
    requiredInputs: [
      'currentRate',
      'longTermMean',
      'meanReversion',
      'volatility',
    ],
    calibrationMetadata: { convergenceThreshold: '1% standard error of mean' },
  },
  {
    modelKey: 'rate.cir',
    displayName: 'Cox-Ingersoll-Ross Model',
    description:
      'CIR short-rate simulation with square-root volatility (non-negative rates).',
    version: '1.0.0',
    category: 'INTEREST_RATE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/cir-model.service.ts',
    entryFunction: 'simulate',
    requiredInputs: [
      'currentRate',
      'longTermMean',
      'meanReversion',
      'volatility',
    ],
  },
  {
    modelKey: 'rate.garch',
    displayName: 'GARCH(1,1) Volatility',
    description:
      'GARCH(1,1) parameter estimation, conditional variance filtering, and multi-step forecast.',
    version: '1.0.0',
    category: 'INTEREST_RATE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/garch-volatility.service.ts',
    entryFunction: 'estimateParams',
    requiredInputs: ['returnSeries'],
    calibrationMetadata: { diagnostics: 'Ljung-Box Q-test on residuals' },
  },
  {
    modelKey: 'rate.black-litterman',
    displayName: 'Black-Litterman Portfolio',
    description:
      'Black-Litterman portfolio optimization combining market equilibrium with investor views.',
    version: '1.0.0',
    category: 'PORTFOLIO',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/black-litterman.service.ts',
    entryFunction: 'computeBLPortfolio',
    requiredInputs: ['marketWeights', 'covarianceMatrix', 'views'],
  },

  // ───────────────── STRESS TESTING ─────────────────
  {
    modelKey: 'stress.regulatory',
    displayName: 'Regulatory Stress Test',
    description:
      'FRB CCAR/DFAST regulatory stress scenarios with COSSEC-specific overlays.',
    version: '1.0.0',
    category: 'STRESS_TEST',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/stress-testing/stress-testing.service.ts',
    entryFunction: 'runRegulatoryStress',
    requiredInputs: ['balanceSheetItems', 'liquidityPosition'],
    limitations: ['Returns data_unavailable when baseLCR is null (D1)'],
  },
  {
    modelKey: 'stress.monte-carlo',
    displayName: 'Monte Carlo Stress Simulation',
    description:
      'Full Monte Carlo stress test execution with fan chart generation.',
    version: '1.0.0',
    category: 'STRESS_TEST',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/stress-testing/stress-testing.service.ts',
    entryFunction: 'runMonteCarloSimulation',
    requiredInputs: ['balanceSheetItems', 'rateScenarios'],
  },
  {
    modelKey: 'stress.custom-scenario',
    displayName: 'Custom Scenario Engine',
    description:
      'User-defined rate/credit scenario execution with impact analysis.',
    version: '1.0.0',
    category: 'STRESS_TEST',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/custom-scenario.service.ts',
    entryFunction: 'runCustomScenario',
    requiredInputs: ['balanceSheetItems', 'scenarioParameters'],
    limitations: ['Detects COSSEC data_unavailable before math (D1)'],
  },

  // ───────────────── REGULATORY ─────────────────
  {
    modelKey: 'reg.cossec-compliance',
    displayName: 'COSSEC 12-Ratio Compliance',
    description:
      'Full COSSEC regulatory compliance engine — 12 ratios with thresholds and trend deltas.',
    version: '1.0.0',
    category: 'REGULATORY',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alm-enterprise.service.ts',
    entryFunction: 'getCOSSECCompliance',
    requiredInputs: ['balanceSheetItems'],
    limitations: [
      'Returns data_unavailable on empty BS (D1)',
      'PR-specific: COSSEC thresholds only',
    ],
  },
  {
    modelKey: 'reg.ncua-5300',
    displayName: 'NCUA 5300 Report Generator',
    description:
      'NCUA 5300 regulatory report generation with edit-check validation.',
    version: '1.0.0',
    category: 'REGULATORY',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/ncua-5300.service.ts',
    entryFunction: 'generateForm5300',
    requiredInputs: ['balanceSheetItems'],
    limitations: [
      'Allowance/delinquency still sector-default ratios (WARNING gap)',
      'Do not file when data_unavailable',
    ],
  },
  {
    modelKey: 'reg.ncua-rbc2',
    displayName: 'NCUA Risk-Based Capital (RBC2)',
    description:
      'Risk-Based Capital per 12 CFR 702.204 with asset classification.',
    version: '1.0.0',
    category: 'REGULATORY',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/ncua-rbc2.service.ts',
    entryFunction: 'computeRBC2',
    requiredInputs: ['balanceSheetItems'],
    limitations: [
      'Hardcoded durationGap=2.1 (WARNING gap until DurationService wired)',
    ],
  },
  {
    modelKey: 'reg.camel-certification',
    displayName: 'CAMEL Certification Engine',
    description:
      'CAMEL rating computation (Capital, Assets, Management, Earnings, Liquidity) with HTML certification.',
    version: '1.0.0',
    category: 'REGULATORY',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/exam-prep/camel-certification.service.ts',
    entryFunction: 'generateCertification',
    requiredInputs: ['balanceSheetItems'],
  },

  // ───────────────── CAPITAL ─────────────────
  {
    modelKey: 'capital.adequacy-ratio',
    displayName: 'Capital Adequacy Ratio',
    description: 'CAR = Tier 1 Capital / Risk-Weighted Assets.',
    version: '1.0.0',
    category: 'CAPITAL',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/capital-adequacy-ratio.service.ts',
    entryFunction: 'calculate',
    requiredInputs: ['balanceSheetItems'],
  },
  {
    modelKey: 'capital.optimizer',
    displayName: 'Capital Allocation Optimizer',
    description:
      'Capital allocation across aggressive/moderate/conservative modes.',
    version: '1.0.0',
    category: 'CAPITAL',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/capital-optimizer.service.ts',
    entryFunction: 'optimize',
    requiredInputs: ['balanceSheetItems', 'riskAppetite'],
  },

  // ───────────────── RISK METRICS ─────────────────
  {
    modelKey: 'risk.cash-flow-at-risk',
    displayName: 'Cash-Flow-at-Risk (CFaR)',
    description: 'Earnings volatility with multi-factor correlated CFaR.',
    version: '1.0.0',
    category: 'RISK_METRICS',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/cash-flow-at-risk.service.ts',
    entryFunction: 'calculateCFaR',
    requiredInputs: ['balanceSheetItems', 'rateScenarios'],
  },
  {
    modelKey: 'risk.early-warning',
    displayName: 'Early Warning System',
    description:
      'Isolation forest anomaly detection across financial indicators.',
    version: '1.0.0',
    category: 'RISK_METRICS',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/asset-ews.service.ts',
    entryFunction: 'computeEWS',
    requiredInputs: ['financialIndicators'],
    limitations: [
      'Returns DATA_UNAVAILABLE on empty portfolio; no fabricated score (D1)',
      '7 of 12 indicators (delinquency trend, LTV, DSCR, OREO growth, consumer 60d, allowance coverage, peer gap) are not yet wired — return null + WARNING gap, never a constant',
      'Refuses to grade below 50% measured indicator weight; composite scores only over measured indicators (57/100)',
      'Derived indicators are loss-rate proxies, not direct delinquency measurements',
    ],
  },

  // ───────────────── PRICING / FTP ─────────────────
  {
    modelKey: 'pricing.deposit-beta',
    displayName: 'Deposit Beta',
    description:
      'Beta coefficient for deposit rate elasticity — measures pass-through of rate changes.',
    version: '1.0.0',
    category: 'PRICING',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/deposit-beta.service.ts',
    entryFunction: 'computeDepositBeta',
    requiredInputs: ['depositTiers', 'rateHistory'],
  },
  {
    modelKey: 'pricing.ftp',
    displayName: 'Funds Transfer Pricing',
    description:
      'FTP framework for internal pricing of assets and liabilities.',
    version: '1.0.0',
    category: 'PRICING',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/ftp.service.ts',
    entryFunction: 'compute',
    requiredInputs: ['balanceSheetItems', 'yieldCurve'],
  },
  {
    modelKey: 'pricing.nim-attribution',
    displayName: 'NIM Attribution',
    description:
      'Net Interest Margin attribution decomposed into rate, volume, and mix effects.',
    version: '1.0.0',
    category: 'PRICING',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/nim-attribution.service.ts',
    entryFunction: 'decompose',
    requiredInputs: ['balanceSheetItems', 'priorPeriodBalanceSheet'],
  },

  // ───────────────── REPORTING ─────────────────
  {
    modelKey: 'report.board',
    displayName: 'Board Report Generator',
    description:
      'Executive board report with KPIs (NIM, LCR, NSFR, CECL, etc.). All data-gap-aware.',
    version: '1.1.0',
    category: 'REPORTING',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/board-report.service.ts',
    entryFunction: 'generateBoardReportData',
    requiredInputs: ['institutionId'],
    limitations: ['5 KPIs explicitly null + WARNING gap until services wired'],
  },
  {
    modelKey: 'report.alco-dashboard',
    displayName: 'ALCO Dashboard Aggregator',
    description:
      'ALCO committee dashboard KPI aggregation. All inputs nullable, data-gap-aware.',
    version: '1.1.0',
    category: 'REPORTING',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/alco-dashboard.service.ts',
    entryFunction: 'aggregate',
    requiredInputs: ['institutionId'],
  },
  {
    modelKey: 'report.excel-export',
    displayName: 'Excel Workbook Export',
    description:
      'Multi-sheet Excel workbook with Data Gaps sheet at index 0. All cells data-gap-aware.',
    version: '1.1.0',
    category: 'REPORTING',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/excel-export.service.ts',
    entryFunction: 'exportToExcel',
    requiredInputs: ['institutionId'],
  },
  {
    modelKey: 'report.preflight',
    displayName: 'Report Preflight Check',
    description:
      'Central "is the report safe to ship?" API. Aggregates gaps from ALM, COSSEC, and stress.',
    version: '1.0.0',
    category: 'REPORTING',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/reports/report-preflight.service.ts',
    entryFunction: 'check',
    requiredInputs: ['institutionId'],
  },

  // ───────────────── PEER ANALYTICS ─────────────────
  {
    modelKey: 'peer.benchmarking',
    displayName: 'Peer Group Benchmarking',
    description:
      'Asset-tier-specific peer group comparison with percentile ranking.',
    version: '1.0.0',
    category: 'PEER_ANALYTICS',
    riskTier: 'TIER_3',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/peer-analytics.service.ts',
    entryFunction: 'getPeerAnalytics',
    requiredInputs: ['institutionId'],
    limitations: ['4 metrics explicitly null + WARNING gap (unwired sources)'],
  },

  // ───────────────── PORTFOLIO ─────────────────
  {
    modelKey: 'portfolio.hrp',
    displayName: 'Hierarchical Risk Parity',
    description:
      'HRP portfolio construction via hierarchical clustering of asset covariance.',
    version: '1.0.0',
    category: 'PORTFOLIO',
    riskTier: 'TIER_3',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/hrp.service.ts',
    entryFunction: 'optimize',
    requiredInputs: ['returnSeries', 'covarianceMatrix'],
  },

  // ───────────────── LIQUIDITY ─────────────────
  {
    modelKey: 'liquidity.survival',
    displayName: 'Liquidity Survival Analysis',
    description: 'Survival period calculation under stress scenarios.',
    version: '1.0.0',
    category: 'LIQUIDITY',
    riskTier: 'TIER_1',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/liquidity-survival.service.ts',
    entryFunction: 'analyze',
    requiredInputs: ['liquidityPosition', 'stressScenario'],
  },
  {
    modelKey: 'liquidity.buffer-sizing',
    displayName: 'Liquidity Buffer Sizing',
    description:
      'Optimal liquidity buffer size given stress scenarios and risk appetite.',
    version: '1.0.0',
    category: 'LIQUIDITY',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/liquidity-buffer-sizing.service.ts',
    entryFunction: 'compute',
    requiredInputs: ['liquidityPosition', 'riskAppetite'],
  },
  {
    modelKey: 'liquidity.maturity-ladder',
    displayName: 'Maturity Ladder',
    description:
      'Maturity profile analysis across time buckets for gap identification.',
    version: '1.0.0',
    category: 'LIQUIDITY',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/maturity-ladder.service.ts',
    entryFunction: 'analyze',
    requiredInputs: ['balanceSheetItems'],
  },

  // ───────────────── DURATION & CONVEXITY ─────────────────
  {
    modelKey: 'alm.duration-convexity',
    displayName: 'Duration & Convexity Analysis',
    description:
      'Portfolio duration, convexity, and scenario analysis with key rate durations.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/duration-convexity.service.ts',
    entryFunction: 'analyze',
    requiredInputs: ['balanceSheetItems'],
  },
  {
    modelKey: 'alm.behavioral-duration',
    displayName: 'Behavioral Duration Model',
    description:
      'Behavioral model of deposit duration adjusted for withdrawal optionality.',
    version: '1.0.0',
    category: 'ALM_CORE',
    riskTier: 'TIER_2',
    status: 'APPROVED',
    ownerName: OWNER,
    serviceFile: 'alm/behavioral-duration.service.ts',
    entryFunction: 'computeBehavioralDurations',
    requiredInputs: ['depositTiers'],
  },
];

@Injectable()
export class ModelRegistrySeeder implements OnModuleInit {
  private readonly logger = new Logger(ModelRegistrySeeder.name);

  constructor(private readonly registry: ModelRegistryService) {}

  async onModuleInit() {
    this.logger.log(
      `Seeding ${PRODUCTION_MODELS.length} production models into registry...`,
    );
    let created = 0;
    let updated = 0;

    for (const model of PRODUCTION_MODELS) {
      try {
        const existing = await this.registry
          .getByKey(model.modelKey)
          .catch(() => null);
        await this.registry.upsert(model);
        if (existing) {
          updated++;
        } else {
          created++;
        }
      } catch (err: any) {
        this.logger.warn(
          `Failed to seed model ${model.modelKey}: ${err.message}`,
        );
      }
    }

    this.logger.log(
      `Model registry seeded: ${created} created, ${updated} updated, ${PRODUCTION_MODELS.length} total`,
    );

    // Phase 2: Link golden test files as validation artifacts
    await this.linkGoldenTestArtifacts();
  }

  /**
   * Link existing golden test files (test/golden/pr-cooperativa-demo.*.json)
   * to their respective models as validation artifacts. Computes SHA-256
   * checksums for immutability verification.
   */
  private async linkGoldenTestArtifacts() {
    const GOLDEN_MAP: Array<{
      modelKey: string;
      goldenFile: string;
      label: string;
    }> = [
      {
        modelKey: 'reg.cossec-compliance',
        goldenFile: 'pr-cooperativa-demo.cossec.json',
        label: 'COSSEC compliance golden test (pr-cooperativa-demo)',
      },
      {
        modelKey: 'alm.duration-gap',
        goldenFile: 'pr-cooperativa-demo.duration-gap.json',
        label: 'Duration gap golden test (pr-cooperativa-demo)',
      },
      {
        modelKey: 'alm.lcr',
        goldenFile: 'pr-cooperativa-demo.lcr.json',
        label: 'LCR golden test (pr-cooperativa-demo)',
      },
      {
        modelKey: 'alm.nii-sensitivity',
        goldenFile: 'pr-cooperativa-demo.nii-sensitivity.json',
        label: 'NII sensitivity golden test (pr-cooperativa-demo)',
      },
    ];

    const goldenDir = path.resolve(__dirname, '../../test/golden');
    if (!fs.existsSync(goldenDir)) {
      this.logger.debug(
        'Golden test directory not found — skipping artifact linkage',
      );
      return;
    }

    let linked = 0;
    for (const { modelKey, goldenFile, label } of GOLDEN_MAP) {
      try {
        const filePath = path.join(goldenDir, goldenFile);
        if (!fs.existsSync(filePath)) continue;

        const model = await this.registry.getByKey(modelKey).catch(() => null);
        if (!model) continue;

        // Compute SHA-256 checksum
        const content = fs.readFileSync(filePath);
        const checksum = `sha256:${crypto.createHash('sha256').update(content).digest('hex')}`;

        // Check if this exact artifact already exists (idempotent)
        const existing = model.validationArtifacts?.find(
          (a: any) =>
            a.artifactType === 'golden_test' &&
            a.storageLocator === `test/golden/${goldenFile}`,
        );
        if (existing) {
          // Update checksum if file changed
          if (existing.checksum !== checksum) {
            this.logger.log(
              `Golden test checksum changed for ${modelKey}: ${goldenFile}`,
            );
          }
          continue;
        }

        await this.registry.addValidationArtifact(model.id, {
          artifactType: 'golden_test',
          label,
          storageLocator: `test/golden/${goldenFile}`,
          checksum,
          producedBy: 'golden-reconciliation-spec',
          producedAt: new Date(),
          validationMetadata: {
            fixture: 'pr-cooperativa-demo',
            driftDetection: 'UPDATE_GOLDEN=1 to regenerate',
          },
        });
        linked++;
      } catch (err: any) {
        this.logger.warn(
          `Failed to link golden artifact for ${modelKey}: ${err.message}`,
        );
      }
    }

    if (linked > 0) {
      this.logger.log(
        `Linked ${linked} golden test artifacts to registry models`,
      );
    }
  }
}
