/**
 * ALM Controller — Core Revenue Path Tests
 *
 * Direct instantiation with null-proxy to avoid 79-dep DI timeout.
 */

function mockSvc(): any {
  return new Proxy(
    {},
    {
      get: (_t: any, p: any) =>
        typeof p === 'symbol' ? undefined : jest.fn().mockResolvedValue(null),
    },
  );
}

import { AlmController } from './alm.controller';

describe('AlmController — Core Revenue Path', () => {
  let controller: AlmController;
  let enterprise: Record<string, jest.Mock>;
  let reports: Record<string, jest.Mock>;
  let stressTesting: Record<string, jest.Mock>;
  let stressV2: Record<string, jest.Mock>;
  let demoWorkspace: Record<string, jest.Mock>;
  let onboardingOrchestrator: Record<string, jest.Mock>;
  let customScenario: Record<string, jest.Mock>;
  let liquidityStressPack: Record<string, jest.Mock>;
  let irrPolicy: Record<string, jest.Mock>;
  let depositBetaLibrary: Record<string, jest.Mock>;
  let analysisRuns: Record<string, jest.Mock>;
  let ingestionLogs: Record<string, jest.Mock>;
  let complianceCalendar: Record<string, jest.Mock>;
  let csvIngestion: Record<string, jest.Mock>;
  let workspaceOnboarding: Record<string, jest.Mock>;
  let ftp: Record<string, jest.Mock>;
  let cecl: Record<string, jest.Mock>;
  let yieldCurve: Record<string, jest.Mock>;
  let scenarioPersistence: Record<string, jest.Mock>;
  let depositBeta: Record<string, jest.Mock>;
  let liquidityAdvanced: Record<string, jest.Mock>;
  let concentration: Record<string, jest.Mock>;
  let ncuaDataPull: Record<string, jest.Mock>;
  let excelExport: Record<string, jest.Mock>;
  let ceclVintage: Record<string, jest.Mock>;
  let monteCarlo: Record<string, jest.Mock>;
  let repricingGap: Record<string, jest.Mock>;
  let ftpAttribution: Record<string, jest.Mock>;
  let forwardSim: Record<string, jest.Mock>;
  let peerAnalytics: Record<string, jest.Mock>;
  let oasCalculator: Record<string, jest.Mock>;
  let creditRiskQuant: Record<string, jest.Mock>;
  let portfolioVaR: Record<string, jest.Mock>;
  let capitalOptimizer: Record<string, jest.Mock>;
  let assetEWS: Record<string, jest.Mock>;
  let sofrMonitor: Record<string, jest.Mock>;
  let treasuryRates: Record<string, jest.Mock>;
  let alertDelivery: Record<string, jest.Mock>;
  let camelForecaster: Record<string, jest.Mock>;
  let peerSynthesis: Record<string, jest.Mock>;
  let prepaymentEngine: Record<string, jest.Mock>;
  let examPrep: Record<string, jest.Mock>;
  let boardReport: Record<string, jest.Mock>;
  let chatAnalyst: Record<string, jest.Mock>;
  let ncua5300: Record<string, jest.Mock>;
  let prospectIntel: Record<string, jest.Mock>;
  let networkIntel: Record<string, jest.Mock>;
  let webhooks: Record<string, jest.Mock>;
  let usageMetering: Record<string, jest.Mock>;
  let dataPrivacy: Record<string, jest.Mock>;
  let csvIngestV2: Record<string, jest.Mock>;
  let nimOptimizer: Record<string, jest.Mock>;
  let keyRateDuration: Record<string, jest.Mock>;
  let ltp: Record<string, jest.Mock>;
  let usviExpansion: Record<string, jest.Mock>;
  let regAlert: Record<string, jest.Mock>;

  beforeEach(() => {
    enterprise = {
      createInstitution: jest.fn(),
      getInstitutionsByUser: jest.fn(),
      getInstitutionsByWorkspace: jest.fn(),
      getInstitution: jest.fn(),
      importBalanceSheetItems: jest.fn(),
      listBalanceSheetItems: jest.fn(),
      getALMSummary: jest.fn(),
      getCOSSECCompliance: jest.fn(),
      calculateDurationGap: jest.fn(),
      calculateNIISensitivity: jest.fn(),
      calculateLCR: jest.fn(),
    };
    reports = {
      generateALMReport: jest.fn(),
    };
    stressTesting = {
      runFullStressTest: jest.fn(),
      runCustomScenario: jest.fn(),
    };
    stressV2 = {
      getPresetScenarios: jest.fn(),
      runStressTest: jest.fn(),
      runAllPresets: jest.fn(),
    };
    demoWorkspace = {
      buildWorkspace: jest.fn(),
    };
    onboardingOrchestrator = {
      getOnboardingStatus: jest.fn(),
      getAllOnboardingStatuses: jest.fn(),
    };
    customScenario = {
      runCustomScenario: jest.fn(),
    };
    liquidityStressPack = {
      runScenario: jest.fn(),
      runAllScenarios: jest.fn(),
    };
    irrPolicy = {
      checkAll: jest.fn(),
      getLimits: jest.fn(),
      saveLimits: jest.fn(),
      getBreachHistory: jest.fn(),
    };
    depositBetaLibrary = {
      getBenchmark: jest.fn(),
      getRawLibrary: jest.fn(),
    };
    analysisRuns = {
      createRun: jest.fn(),
      getRun: jest.fn(),
      listRuns: jest.fn(),
    };
    ingestionLogs = {
      listInstitutionLogs: jest.fn(),
      recordLog: jest.fn(),
    };
    complianceCalendar = {
      getUpcomingDeadlines: jest.fn(),
    };
    csvIngestion = {
      parseCSV: jest.fn(),
      getCooperativaTemplate: jest.fn(),
      getGenericTemplate: jest.fn(),
    };
    workspaceOnboarding = {
      seedDemoData: jest.fn(),
    };
    ftp = {
      getFTPAnalysis: jest.fn(),
      getFTPSegments: jest.fn(),
    };
    cecl = {
      getCECLAnalysis: jest.fn(),
      importLoanSegments: jest.fn(),
      getCECLForecast: jest.fn(),
      calculateWARM: jest.fn(),
    };
    yieldCurve = {
      getYieldCurveAnalysis: jest.fn(),
      computeForwardNIISchedule: jest.fn(),
      saveCustomCurve: jest.fn(),
      applyShock: jest.fn(),
    };
    scenarioPersistence = {
      saveScenario: jest.fn(),
      listScenarios: jest.fn(),
      getScenario: jest.fn(),
      compareScenarios: jest.fn(),
      duplicateScenario: jest.fn(),
      deleteScenario: jest.fn(),
    };
    depositBeta = {
      getDepositBetas: jest.fn(),
      updateDepositBetas: jest.fn(),
      calculateBetaImpact: jest.fn(),
    };
    liquidityAdvanced = {
      getAdvancedLiquidity: jest.fn(),
    };
    concentration = {
      getConcentrationAnalysis: jest.fn(),
      saveConcentrationLimits: jest.fn(),
    };
    ncuaDataPull = {
      pullByCharterNumber: jest.fn(),
    };
    excelExport = {
      exportToExcel: jest.fn(),
    };
    ceclVintage = {
      runVintageAnalysis: jest.fn(),
      getCohortMatrix: jest.fn(),
      importCohorts: jest.fn(),
    };
    monteCarlo = {
      runSimulation: jest.fn(),
    };
    repricingGap = {
      getRepricingGap: jest.fn(),
    };
    ftpAttribution = {
      getFullAttribution: jest.fn(),
    };
    forwardSim = {
      runForwardSimulation: jest.fn(),
    };
    peerAnalytics = {
      getPeerAnalytics: jest.fn(),
    };
    oasCalculator = {
      analyzePortfolio: jest.fn(),
    };
    creditRiskQuant = {
      analyzePortfolio: jest.fn(),
    };
    portfolioVaR = {
      computeVaRSuite: jest.fn(),
    };
    capitalOptimizer = {
      optimize: jest.fn(),
    };
    assetEWS = {
      computeEWS: jest.fn(),
    };
    sofrMonitor = {
      getExposureReport: jest.fn(),
    };
    treasuryRates = {
      getLatestSnapshot: jest.fn(),
      getYieldCurvePoints: jest.fn(),
    };
    alertDelivery = {
      getInstitutionAlerts: jest.fn(),
      markRead: jest.fn(),
      dismiss: jest.fn(),
    };
    camelForecaster = {
      forecastForInstitution: jest.fn(),
    };
    peerSynthesis = {
      getLatestReport: jest.fn(),
    };
    prepaymentEngine = {
      computePRCPR: jest.fn(),
      computeSensitivity: jest.fn(),
    };
    examPrep = {
      getExamPrep: jest.fn(),
    };
    boardReport = {
      generateBoardReportData: jest.fn(),
    };
    chatAnalyst = {
      processMessage: jest.fn(),
      getAvailableTools: jest.fn(),
    };
    ncua5300 = {
      generateForm5300: jest.fn(),
    };
    prospectIntel = {
      analyzeProspect: jest.fn(),
      analyzeAllProspects: jest.fn(),
    };
    networkIntel = {
      getNetworkOverview: jest.fn(),
    };
    webhooks = {
      createSubscription: jest.fn(),
      listSubscriptions: jest.fn(),
      deleteSubscription: jest.fn(),
    };
    usageMetering = {
      getUsageSummary: jest.fn(),
    };
    dataPrivacy = {
      getDataInventory: jest.fn(),
      requestDeletion: jest.fn(),
      generateSAR: jest.fn(),
    };
    csvIngestV2 = {
      analyzeCSV: jest.fn(),
      commitIngestion: jest.fn(),
    };
    nimOptimizer = {
      optimize: jest.fn(),
    };
    keyRateDuration = {
      analyzePortfolio: jest.fn(),
    };
    ltp = {
      computeLTP: jest.fn(),
    };
    usviExpansion = {
      getUSVIFramework: jest.fn(),
    };
    regAlert = {
      getRecentPublications: jest.fn(),
      runFullPipeline: jest.fn(),
    };

    // Build args array matching constructor parameter count
    // Dynamic: match constructor parameter count (grows as services are added)
    const paramCount = AlmController.length || 90;
    const args: any[] = Array.from({ length: paramCount }, () => mockSvc());
    args[1] = enterprise;
    args[3] = reports;
    controller = new (AlmController as any)(...args);
    (controller as any).reportsService = reports;
    (controller as any).stressTesting = stressTesting;
    (controller as any).stressV2 = stressV2;
    (controller as any).demoWorkspace = demoWorkspace;
    (controller as any).onboardingOrchestrator = onboardingOrchestrator;
    (controller as any).customScenario = customScenario;
    (controller as any).liquidityStressPack = liquidityStressPack;
    (controller as any).irrPolicy = irrPolicy;
    (controller as any).depositBetaLibrary = depositBetaLibrary;
    (controller as any).analysisRuns = analysisRuns;
    (controller as any).ingestionLogs = ingestionLogs;
    (controller as any).complianceCalendar = complianceCalendar;
    (controller as any).csvIngestion = csvIngestion;
    (controller as any).workspaceOnboarding = workspaceOnboarding;
    (controller as any).ftp = ftp;
    (controller as any).cecl = cecl;
    (controller as any).yieldCurve = yieldCurve;
    (controller as any).scenarioPersistence = scenarioPersistence;
    (controller as any).depositBeta = depositBeta;
    (controller as any).liquidityAdvanced = liquidityAdvanced;
    (controller as any).concentration = concentration;
    (controller as any).ncuaDataPull = ncuaDataPull;
    (controller as any).excelExport = excelExport;
    (controller as any).ceclVintage = ceclVintage;
    (controller as any).monteCarlo = monteCarlo;
    (controller as any).repricingGap = repricingGap;
    (controller as any).ftpAttribution = ftpAttribution;
    (controller as any).forwardSim = forwardSim;
    (controller as any).peerAnalytics = peerAnalytics;
    (controller as any).oasCalculator = oasCalculator;
    (controller as any).creditRiskQuant = creditRiskQuant;
    (controller as any).portfolioVaR = portfolioVaR;
    (controller as any).capitalOptimizer = capitalOptimizer;
    (controller as any).assetEWS = assetEWS;
    (controller as any).sofrMonitor = sofrMonitor;
    (controller as any).treasuryRates = treasuryRates;
    (controller as any).alertDelivery = alertDelivery;
    (controller as any).camelForecaster = camelForecaster;
    (controller as any).peerSynthesis = peerSynthesis;
    (controller as any).prepaymentEngine = prepaymentEngine;
    (controller as any).examPrep = examPrep;
    (controller as any).boardReport = boardReport;
    (controller as any).chatAnalyst = chatAnalyst;
    (controller as any).ncua5300 = ncua5300;
    (controller as any).prospectIntel = prospectIntel;
    (controller as any).networkIntel = networkIntel;
    (controller as any).webhooks = webhooks;
    (controller as any).usageMetering = usageMetering;
    (controller as any).dataPrivacy = dataPrivacy;
    (controller as any).csvIngestV2 = csvIngestV2;
    (controller as any).nimOptimizer = nimOptimizer;
    (controller as any).keyRateDuration = keyRateDuration;
    (controller as any).ltp = ltp;
    (controller as any).usviExpansion = usviExpansion;
    (controller as any).regAlert = regAlert;
  });

  describe('POST /api/alm/institutions', () => {
    it('creates institution', async () => {
      const dto = {
        name: 'CoopAhorro',
        type: 'cooperativa',
        totalAssets: 250e6,
      };
      enterprise.createInstitution.mockResolvedValue({ id: 'i1', ...dto });
      const r = await controller.createInstitution(dto as any);
      expect(enterprise.createInstitution).toHaveBeenCalledWith(dto);
      expect(r.id).toBe('i1');
    });

    it('propagates errors', async () => {
      enterprise.createInstitution.mockRejectedValue(
        new Error('Name required'),
      );
      await expect(controller.createInstitution({} as any)).rejects.toThrow(
        'Name required',
      );
    });
  });

  describe('GET /api/alm/institutions', () => {
    it('lists by userId', async () => {
      enterprise.getInstitutionsByUser.mockResolvedValue({
        data: [{ id: 'i1' }],
        total: 1,
      });
      const req = { user: { userId: 'u1' }, query: {} };
      const r = await controller.listInstitutions(req, {} as any);
      expect(enterprise.getInstitutionsByUser).toHaveBeenCalledWith(
        'u1',
        expect.any(Object),
      );
      expect(r.total).toBe(1);
    });

    it('filters by workspaceId', async () => {
      enterprise.getInstitutionsByWorkspace.mockResolvedValue({
        data: [],
        total: 0,
      });
      const req = { user: { userId: 'u1' }, query: { workspaceId: 'ws1' } };
      await controller.listInstitutions(req, {} as any);
      expect(enterprise.getInstitutionsByWorkspace).toHaveBeenCalledWith(
        'ws1',
        expect.any(Object),
      );
    });
  });

  describe('GET /api/alm/institutions/:id', () => {
    it('returns details', async () => {
      enterprise.getInstitution.mockResolvedValue({
        id: 'i1',
        name: 'CoopAhorro',
      });
      const r = await controller.getInstitution('i1');
      expect(r.name).toBe('CoopAhorro');
    });
  });

  describe('POST /api/alm/institutions/:id/balance-sheet-items', () => {
    it('imports items', async () => {
      const dto = { items: [{ category: 'asset', balance: 45e6 }] };
      enterprise.importBalanceSheetItems.mockResolvedValue({
        count: 1,
        warnings: [],
      });
      const r = await controller.importBalanceSheetItems('i1', dto as any);
      expect(enterprise.importBalanceSheetItems).toHaveBeenCalledWith(
        'i1',
        dto.items,
      );
      expect(r.count).toBe(1);
    });
  });

  describe('GET /api/alm/institutions/:id/balance-sheet-items', () => {
    it('lists balance sheet items with pagination', async () => {
      enterprise.listBalanceSheetItems.mockResolvedValue({
        items: [{ id: 'bsi-1', category: 'asset' }],
        total: 1,
      });

      const pagination = { page: 2, limit: 25 };
      const r = await controller.listBalanceSheetItems('i1', pagination as any);

      expect(enterprise.listBalanceSheetItems).toHaveBeenCalledWith(
        'i1',
        pagination,
      );
      expect(r.total).toBe(1);
      expect(r.items[0].id).toBe('bsi-1');
    });
  });

  describe('GET /api/alm/:id/summary', () => {
    it('returns ALM summary', async () => {
      enterprise.getALMSummary.mockResolvedValue({
        institution: {
          id: 'i1',
          name: 'Stress Coop',
          type: 'cooperativa',
          totalAssets: 250,
          currency: 'USD',
          reportingDate: '2026-03-29T00:00:00.000Z',
        },
        durationGap: { durationGap: 2.1, riskProfile: 'asset-sensitive' },
        niiSensitivity: {
          baseNII: 12.1,
          riskRating: 'high',
          scenarios: [{ name: 'Same-Day -7%', niImpactPct: -7 }],
        },
        liquidity: { lcr: 142, status: 'compliant' },
        topRisks: ['NII at risk under Same-Day -7% scenario'],
        recommendations: ['Raise liquidity buffers before adding duration'],
        riskScore: 68,
      });
      const r = await controller.getALMSummary('i1');
      expect(r.durationGap.durationGap).toBe(2.1);
      expect(r.liquidity.lcr).toBe(142);
      expect(r.topRisks).toEqual(['NII at risk under Same-Day -7% scenario']);
      expect(r.recommendations).toEqual([
        'Raise liquidity buffers before adding duration',
      ]);
    });
  });

  describe('GET /api/alm/:id/report', () => {
    it('downloads a PDF report with deterministic headers and filename', async () => {
      const buffer = Buffer.from('pdf-binary');
      const res = {
        set: jest.fn(),
        end: jest.fn(),
      };
      const clock = jest.useFakeTimers();
      clock.setSystemTime(new Date('2026-03-29T12:00:00.000Z'));
      reports.generateALMReport.mockResolvedValue(buffer);
      enterprise.getInstitution.mockResolvedValue({
        id: 'i1',
        name: 'Stress Coop PR',
      });

      try {
        await controller.downloadReport('i1', 'es', res);
      } finally {
        clock.useRealTimers();
      }

      expect(reports.generateALMReport).toHaveBeenCalledWith('i1', 'es');
      expect(enterprise.getInstitution).toHaveBeenCalledWith('i1');
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="alm-report-stress-coop-pr-2026-03-29.pdf"',
        'Content-Length': buffer.length,
      });
      expect(res.end).toHaveBeenCalledWith(buffer);
    });
  });

  describe('GET /api/alm/:id/cossec-compliance', () => {
    it('returns compliance', async () => {
      enterprise.getCOSSECCompliance.mockResolvedValue({
        overallStatus: 'compliant',
        examReadinessScore: 85,
        checks: [],
      });
      const r = await controller.getCOSSECCompliance('i1');
      expect(r.overallStatus).toBe('compliant');
      expect(r.examReadinessScore).toBe(85);
    });
  });

  describe('GET /api/alm/:id/duration-gap', () => {
    it('calculates gap', async () => {
      enterprise.calculateDurationGap.mockResolvedValue({
        assetDuration: 4.2,
        liabilityDuration: 2.1,
        durationGap: 2.1,
        riskProfile: 'asset-sensitive',
      });
      const r = await controller.getDurationGap('i1');
      expect(r.durationGap).toBe(2.1);
      expect(r.riskProfile).toBe('asset-sensitive');
    });
  });

  describe('GET /api/alm/:id/nii-sensitivity', () => {
    it('returns NII sensitivity scenarios', async () => {
      enterprise.calculateNIISensitivity.mockResolvedValue({
        baseNII: 742,
        riskRating: 'moderate',
        scenarios: [
          { name: '+200 bps', shiftBps: 200, niImpactPct: 15.9 },
          { name: '-200 bps', shiftBps: -200, niImpactPct: -12.9 },
        ],
      });

      const r = await controller.getNIISensitivity('i1');

      expect(enterprise.calculateNIISensitivity).toHaveBeenCalledWith('i1');
      expect(r.baseNII).toBe(742);
      expect(r.scenarios).toHaveLength(2);
    });
  });

  describe('GET /api/alm/:id/liquidity', () => {
    it('calculates LCR', async () => {
      enterprise.calculateLCR.mockResolvedValue({
        lcr: 142.5,
        status: 'compliant',
      });
      const r = await controller.getLiquidity('i1');
      expect(r.lcr).toBe(142.5);
    });
  });

  describe('POST /api/alm/:id/stress-test', () => {
    it('runs full stress testing with quant params', async () => {
      const params = {
        paths: 500,
        horizon: 12,
        volatility: 0.18,
        meanReversion: 0.35,
      };
      stressTesting.runFullStressTest.mockResolvedValue({
        institutionId: 'i1',
        regulatory: {
          overallRating: 'adequate',
          scenarios: [
            {
              name: 'Same-Day -7%',
              description:
                'Capital remains above floor under a same-day -7% shock.',
              rateShock: [-700],
              niImpact: -4.9,
              mveImpact: -7.2,
              lcrImpact: -8.1,
              capitalImpact: -1.6,
              passFailStatus: 'warn',
            },
          ],
        },
      });

      const r = await controller.runStressTest('i1', params);

      expect(stressTesting.runFullStressTest).toHaveBeenCalledWith(
        'i1',
        params,
      );
      expect(r.regulatory.overallRating).toBe('adequate');
    });
  });

  describe('POST /api/alm/:id/stress/custom', () => {
    it('runs the custom stress scenario route', async () => {
      const params = {
        rateShockBps: -250,
        depositRunoffPct: 12,
        defaultRateIncreasePct: 4,
        energyCostShockPct: 6,
      };
      stressTesting.runCustomScenario.mockResolvedValue({
        verdict: 'VULNERABLE',
        narrative:
          'Liquidity remains above minimum but same-day market losses compress capital buffers.',
      });

      const r = await controller.runCustomStressScenario('i1', params);

      expect(stressTesting.runCustomScenario).toHaveBeenCalledWith(
        'i1',
        params,
      );
      expect(r.verdict).toBe('VULNERABLE');
    });
  });

  describe('POST /api/alm/:id/scenario/custom', () => {
    it('delegates custom scenario builder execution', async () => {
      const params = {
        name: 'Quant Down Day',
        rateShiftBps: -175,
        yieldCurveTwist: 20,
        depositRunoff: 9,
        loanDefaultIncrease: 2,
        prepaymentMultiplier: 1.1,
      };
      customScenario.runCustomScenario.mockResolvedValue({
        scenario: {
          id: 'scenario-1',
          name: 'Quant Down Day',
          params,
          createdAt: '2026-03-30T00:00:00.000Z',
        },
        niiImpact: -2.1,
        eveChange: -4.2,
        lcrImpact: -3.1,
        capitalImpact: -0.8,
        narrative: 'Same-day drawdown remains manageable with moderate runoff.',
      });

      const r = await controller.runCustomScenario('i1', params);

      expect(customScenario.runCustomScenario).toHaveBeenCalledWith(
        'i1',
        params,
      );
      expect(r.scenario.name).toBe('Quant Down Day');
    });
  });

  describe('Stress v2 routes', () => {
    it('lists preset scenarios', async () => {
      stressV2.getPresetScenarios.mockResolvedValue([
        { id: 'base', name: 'Base' },
        { id: 'shock-7', name: 'Same-Day -7%' },
      ]);

      const r = await controller.getStressV2Presets();

      expect(stressV2.getPresetScenarios).toHaveBeenCalledTimes(1);
      expect(r).toHaveLength(2);
    });

    it('runs the requested v2 preset when a matching scenario id is provided', async () => {
      const presets = [
        { id: 'base', name: 'Base' },
        { id: 'shock-7', name: 'Same-Day -7%' },
      ];
      stressV2.getPresetScenarios.mockReturnValue(presets);
      stressV2.runStressTest.mockResolvedValue({
        verdict: 'CRITICAL',
        scenarioId: 'shock-7',
      });

      const r = await controller.runStressV2('i1', { scenarioId: 'shock-7' });

      expect(stressV2.runStressTest).toHaveBeenCalledWith('i1', presets[1]);
      expect(r.scenarioId).toBe('shock-7');
    });

    it('falls back to the first v2 preset when the requested scenario is missing', async () => {
      const presets = [
        { id: 'base', name: 'Base' },
        { id: 'shock-7', name: 'Same-Day -7%' },
      ];
      stressV2.getPresetScenarios.mockReturnValue(presets);
      stressV2.runStressTest.mockResolvedValue({
        verdict: 'ADEQUATE',
        scenarioId: 'base',
      });

      const r = await controller.runStressV2('i1', { scenarioId: 'missing' });

      expect(stressV2.runStressTest).toHaveBeenCalledWith('i1', presets[0]);
      expect(r.scenarioId).toBe('base');
    });

    it('runs all v2 presets for an institution', async () => {
      stressV2.runAllPresets.mockResolvedValue([
        { scenarioId: 'base', verdict: 'RESILIENT' },
        { scenarioId: 'shock-7', verdict: 'VULNERABLE' },
      ]);

      const r = await controller.runAllStressV2('i1');

      expect(stressV2.runAllPresets).toHaveBeenCalledWith('i1');
      expect(r).toHaveLength(2);
    });
  });

  describe('POST /api/alm/demo/build', () => {
    it('builds a demo workspace from charter and label', async () => {
      demoWorkspace.buildWorkspace.mockResolvedValue({
        institutionId: 'inst-demo-1',
        name: 'Day 2 Desk',
        dashboardUrl: '/alm?institution=inst-demo-1&demo=true',
        talkingPoints: ['Lead with same-day -7% resilience'],
        metrics: { healthScore: 72, camelComposite: 2 },
        createdAt: '2026-03-30T00:00:00.000Z',
        expiresAt: '2026-03-30T08:00:00.000Z',
      });

      const r = await controller.buildDemoWorkspace({
        charterNumber: '12345',
        demoLabel: 'Day 2 Desk',
      });

      expect(demoWorkspace.buildWorkspace).toHaveBeenCalledWith(
        '12345',
        'Day 2 Desk',
      );
      expect(r.institutionId).toBe('inst-demo-1');
    });
  });

  describe('Onboarding status routes', () => {
    it('returns onboarding status for a single institution', async () => {
      onboardingOrchestrator.getOnboardingStatus.mockResolvedValue({
        institutionId: 'i1',
        milestones: [
          {
            id: 'data_loaded',
            label: 'Balance sheet data loaded',
            labelEs: 'Datos de balance cargados',
            completed: true,
            completedAt: '2026-03-30T00:00:00.000Z',
          },
        ],
        activationScore: 1,
        daysSinceSignup: 1,
        isStalled: false,
        stalledMilestone: null,
      });

      const r = await controller.getOnboardingStatus('i1');

      expect(onboardingOrchestrator.getOnboardingStatus).toHaveBeenCalledWith(
        'i1',
      );
      expect(r.activationScore).toBe(1);
    });

    it('returns all onboarding statuses for operator views', async () => {
      onboardingOrchestrator.getAllOnboardingStatuses.mockResolvedValue([
        {
          institutionId: 'i1',
          milestones: [],
          activationScore: 3,
          daysSinceSignup: 2,
          isStalled: false,
          stalledMilestone: null,
        },
        {
          institutionId: 'i2',
          milestones: [],
          activationScore: 5,
          daysSinceSignup: 4,
          isStalled: false,
          stalledMilestone: null,
        },
      ]);

      const r = await controller.getAllOnboardingStatuses();

      expect(
        onboardingOrchestrator.getAllOnboardingStatuses,
      ).toHaveBeenCalledTimes(1);
      expect(r).toHaveLength(2);
    });
  });

  describe('Analysis run and ingestion operations', () => {
    it('handles regulatory compliance, analysis runs, ingestion logs, and compliance calendar', async () => {
      enterprise.getRegulatoryCompliance = jest
        .fn()
        .mockResolvedValue({ status: 'compliant' });
      analysisRuns.createRun.mockResolvedValue({ id: 'run-1' });
      analysisRuns.getRun.mockResolvedValue({ id: 'run-1', status: 'done' });
      analysisRuns.listRuns.mockResolvedValue([{ id: 'run-1' }]);
      ingestionLogs.listInstitutionLogs.mockResolvedValue([{ id: 'log-1' }]);
      complianceCalendar.getUpcomingDeadlines.mockResolvedValue([
        { id: 'deadline-1' },
      ]);

      expect(await controller.getRegulatoryCompliance('i1')).toEqual({
        status: 'compliant',
      });
      expect(
        await controller.createAnalysisRun({ user: { userId: 'u1' } }, {
          institutionId: 'i1',
        } as any),
      ).toEqual({ id: 'run-1' });
      expect(
        await controller.getAnalysisRun({ user: { userId: 'u1' } }, 'run-1'),
      ).toEqual({
        id: 'run-1',
        status: 'done',
      });
      expect(
        await controller.listAnalysisRuns({ user: { userId: 'u1' } }, 'i1', {
          page: 1,
          limit: 10,
        } as any),
      ).toEqual([{ id: 'run-1' }]);
      expect(
        await controller.listIngestionLogs({ user: { userId: 'u1' } }, 'i1', {
          page: 1,
          limit: 10,
        } as any),
      ).toEqual([{ id: 'log-1' }]);
      expect(await controller.getComplianceCalendar('i1')).toEqual([
        { id: 'deadline-1' },
      ]);
    });

    it('rejects csv uploads when no file is provided', async () => {
      await expect(
        controller.uploadCSV(
          { user: { userId: 'u1' } },
          'i1',
          undefined as any,
          undefined,
        ),
      ).rejects.toThrow('No CSV file provided');
    });

    it('records failed csv parsing without importing data', async () => {
      csvIngestion.parseCSV.mockReturnValue({
        valid: false,
        errors: ['Missing balance column'],
      });
      ingestionLogs.recordLog.mockResolvedValue({ id: 'log-failed' });

      const result = await controller.uploadCSV(
        { user: { userId: 'u1' } },
        'i1',
        {
          originalname: 'balances.csv',
          buffer: Buffer.from('bad,csv'),
          size: 7,
        } as any,
        'false',
      );

      expect(ingestionLogs.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({
          userId: 'u1',
          institutionId: 'i1',
          status: 'FAILED',
          dryRun: false,
        }),
      );
      expect(result).toEqual({
        valid: false,
        errors: ['Missing balance column'],
        imported: false,
        ingestionLogId: 'log-failed',
      });
    });

    it('supports dry-run csv validation and full imports', async () => {
      csvIngestion.parseCSV
        .mockReturnValueOnce({
          valid: true,
          items: [{ category: 'asset', balance: 10 }],
        })
        .mockReturnValueOnce({
          valid: true,
          items: [{ category: 'asset', balance: 15 }],
        });
      ingestionLogs.recordLog
        .mockResolvedValueOnce({ id: 'log-dry-run' })
        .mockResolvedValueOnce({ id: 'log-imported' });
      enterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });

      const dryRun = await controller.uploadCSV(
        { user: { userId: 'u1' } },
        'i1',
        {
          originalname: 'balances.csv',
          buffer: Buffer.from('asset,10'),
          size: 8,
        } as any,
        'true',
      );
      const imported = await controller.uploadCSV(
        { user: { userId: 'u1' } },
        'i1',
        {
          originalname: 'balances.csv',
          buffer: Buffer.from('asset,15'),
          size: 8,
        } as any,
        'false',
      );

      expect(dryRun).toEqual({
        valid: true,
        items: [{ category: 'asset', balance: 10 }],
        imported: false,
        ingestionLogId: 'log-dry-run',
      });
      expect(enterprise.importBalanceSheetItems).toHaveBeenCalledWith('i1', [
        { category: 'asset', balance: 15 },
      ]);
      expect(imported).toEqual({
        valid: true,
        items: [{ category: 'asset', balance: 15 }],
        imported: true,
        importedCount: 1,
        ingestionLogId: 'log-imported',
      });
    });

    it('serves cooperativa and generic csv templates', () => {
      csvIngestion.getCooperativaTemplate.mockReturnValue('coop-header');
      csvIngestion.getGenericTemplate.mockReturnValue('generic-header');
      const coopRes = { set: jest.fn(), send: jest.fn() };
      const genericRes = { set: jest.fn(), send: jest.fn() };

      controller.getCSVTemplate('cooperativa', coopRes);
      controller.getCSVTemplate('generic', genericRes);

      expect(coopRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv; charset=utf-8',
        'Content-Disposition':
          'attachment; filename="balance_sheet_template_cooperativa.csv"',
      });
      expect(coopRes.send).toHaveBeenCalledWith('\uFEFFcoop-header');
      expect(genericRes.send).toHaveBeenCalledWith('\uFEFFgeneric-header');
    });

    it('seeds demo data through workspace onboarding', async () => {
      workspaceOnboarding.seedDemoData.mockResolvedValue({
        institutionId: 'i-demo',
      });

      const result = await controller.seedDemoData({
        workspaceId: 'ws-1',
        type: 'cooperativa',
      });

      expect(workspaceOnboarding.seedDemoData).toHaveBeenCalledWith(
        'ws-1',
        'cooperativa',
      );
      expect(result).toEqual({ institutionId: 'i-demo' });
    });
  });

  describe('ALM analytics pass-through routes', () => {
    it('covers ftp, cecl, yield-curve, scenarios, liquidity, and concentration routes', async () => {
      ftp.getFTPAnalysis
        .mockResolvedValueOnce({ ftpSpread: 12 })
        .mockResolvedValueOnce({ ftpSpread: 18 });
      ftp.getFTPSegments.mockResolvedValue([{ segment: 'core' }]);
      cecl.getCECLAnalysis.mockResolvedValue({ allowance: 33 });
      cecl.importLoanSegments.mockResolvedValue({ imported: 2 });
      cecl.getCECLForecast.mockResolvedValue({ forecastLoss: 9 });
      cecl.calculateWARM.mockResolvedValue({ reserve: 4.2 });
      yieldCurve.getYieldCurveAnalysis.mockResolvedValue({ twists: 3 });
      yieldCurve.computeForwardNIISchedule.mockResolvedValue({ quarters: 4 });
      yieldCurve.applyShock
        .mockResolvedValueOnce({ shocked: 'default-curve' })
        .mockResolvedValueOnce({ shocked: 'custom-curve' });
      yieldCurve.saveCustomCurve.mockResolvedValue({ id: 'curve-1' });
      scenarioPersistence.saveScenario.mockResolvedValue({ id: 'scenario-1' });
      scenarioPersistence.listScenarios.mockResolvedValue([
        { id: 'scenario-1' },
      ]);
      scenarioPersistence.getScenario.mockResolvedValue({ id: 'scenario-1' });
      scenarioPersistence.compareScenarios.mockResolvedValue({ delta: 7 });
      scenarioPersistence.duplicateScenario.mockResolvedValue({
        id: 'scenario-2',
      });
      scenarioPersistence.deleteScenario.mockResolvedValue({ deleted: true });
      depositBeta.getDepositBetas.mockResolvedValue([
        { subcategory: 'money_market' },
      ]);
      depositBeta.updateDepositBetas.mockResolvedValue({ updated: true });
      depositBeta.calculateBetaImpact
        .mockResolvedValueOnce({ impact: 5 })
        .mockResolvedValueOnce({ impact: 7 });
      liquidityAdvanced.getAdvancedLiquidity.mockResolvedValue({ lcr: 130 });
      concentration.getConcentrationAnalysis.mockResolvedValue({
        topExposure: 'CRE',
      });
      concentration.saveConcentrationLimits.mockResolvedValue({ saved: true });
      ncuaDataPull.pullByCharterNumber.mockResolvedValue({
        charterNumber: '12345',
      });

      expect(await controller.getFTPAnalysis('i1')).toEqual({ ftpSpread: 12 });
      expect(
        await controller.runCustomFTP('i1', { spreadAdjBps: 25 } as any),
      ).toEqual({ ftpSpread: 18 });
      expect(await controller.getFTPSegments('i1')).toEqual([
        { segment: 'core' },
      ]);
      expect(await controller.getCECLAnalysis('i1', 'discounted')).toEqual({
        allowance: 33,
      });
      expect(
        await controller.importLoanSegments('i1', {
          segments: [{ segmentName: 'CRE' }],
        } as any),
      ).toEqual({ imported: 2 });
      expect(await controller.getCECLForecast('i1')).toEqual({
        forecastLoss: 9,
      });
      expect(
        await controller.runWARMCalculation({
          segments: [{ annualChargeOffRate: 0.02 }],
        } as any),
      ).toEqual({ reserve: 4.2 });
      expect(await controller.getYieldCurveAnalysis('i1')).toEqual({
        twists: 3,
      });
      expect(yieldCurve.getYieldCurveAnalysis).toHaveBeenCalledWith('i1');
      expect(
        await controller.computeForwardNII('i1', {
          shockBpsPerTenor: { '1': 25 },
          quarters: 4,
        }),
      ).toEqual({ quarters: 4 });
      expect(yieldCurve.computeForwardNIISchedule).toHaveBeenCalledWith(
        'i1',
        { '1': 25 },
        4,
      );
      expect(
        await controller.applyYieldCurveShocks({
          shockType: 'parallel',
          customShocks: {},
        } as any),
      ).toEqual({ shocked: 'default-curve' });
      expect(yieldCurve.applyShock).toHaveBeenNthCalledWith(
        1,
        [
          { tenor: 0.25, rate: 0.048 },
          { tenor: 0.5, rate: 0.0465 },
          { tenor: 1, rate: 0.044 },
          { tenor: 2, rate: 0.042 },
          { tenor: 3, rate: 0.041 },
          { tenor: 5, rate: 0.0405 },
          { tenor: 7, rate: 0.041 },
          { tenor: 10, rate: 0.042 },
          { tenor: 20, rate: 0.0455 },
          { tenor: 30, rate: 0.0465 },
        ],
        'parallel',
        {},
      );
      expect(
        await controller.applyYieldCurveShocks({
          curveId: 'curve-1',
          shockType: 'steepener',
          customShocks: { '2': 12 },
        } as any),
      ).toEqual({ shocked: 'custom-curve' });
      expect(
        await controller.saveCustomYieldCurve({
          institutionId: 'i1',
          name: 'Quant Curve',
        } as any),
      ).toEqual({ id: 'curve-1' });
      expect(yieldCurve.saveCustomCurve).toHaveBeenCalledWith({
        institutionId: 'i1',
        name: 'Quant Curve',
      });
      expect(
        await controller.saveScenario({ user: { userId: 'u1' } }, {
          institutionId: 'i1',
          name: 'Same-Day -7%',
        } as any),
      ).toEqual({ id: 'scenario-1' });
      expect(
        await controller.listScenarios('i1', { tag: 'market' } as any),
      ).toEqual([{ id: 'scenario-1' }]);
      expect(await controller.getScenario('scenario-1')).toEqual({
        id: 'scenario-1',
      });
      expect(
        await controller.compareScenarios({
          scenarioIds: ['scenario-1', 'scenario-2'],
        } as any),
      ).toEqual({ delta: 7 });
      expect(
        await controller.duplicateScenario(
          { user: { userId: 'u1' } },
          'scenario-1',
          { name: 'Copy' },
        ),
      ).toEqual({ id: 'scenario-2' });
      expect(await controller.deleteScenario('scenario-1')).toEqual({
        deleted: true,
      });
      expect(await controller.getDepositBetas('i1')).toEqual([
        { subcategory: 'money_market' },
      ]);
      expect(
        await controller.updateDepositBetas('i1', {
          betas: [{ subcategory: 'money_market', beta: 0.4 }],
        }),
      ).toEqual({ updated: true });
      expect(await controller.getDepositBetaImpact('i1', undefined)).toEqual({
        impact: 5,
      });
      expect(await controller.getDepositBetaImpact('i1', '250')).toEqual({
        impact: 7,
      });
      expect(await controller.getAdvancedLiquidity('i1')).toEqual({
        lcr: 130,
      });
      expect(await controller.getConcentrationAnalysis('i1')).toEqual({
        topExposure: 'CRE',
      });
      expect(
        await controller.saveConcentrationLimits('i1', {
          limits: [{ limitType: 'sector', limitName: 'CRE', maxPct: 25 }],
        }),
      ).toEqual({ saved: true });
      expect(await controller.pullNCUAData({ charterNumber: '12345' })).toEqual(
        { charterNumber: '12345' },
      );
    });
  });

  describe('Export and operator helper routes', () => {
    it('exports excel, vintage/cohort data, monte carlo, and stress pack routes', async () => {
      const res = { set: jest.fn(), send: jest.fn() };
      const buffer = Buffer.from('xls-binary');
      excelExport.exportToExcel.mockResolvedValue(buffer);
      ceclVintage.runVintageAnalysis
        .mockResolvedValueOnce({ scenario: 'base' })
        .mockResolvedValueOnce({ scenario: 'adverse' });
      ceclVintage.getCohortMatrix.mockResolvedValue({ rows: 2 });
      ceclVintage.importCohorts.mockResolvedValue({ imported: 3 });
      monteCarlo.runSimulation.mockResolvedValue({ paths: 5000 });
      liquidityStressPack.runAllScenarios.mockResolvedValue([{ id: 'base' }]);

      await controller.exportExcel('institution-12345678', res);

      expect(excelExport.exportToExcel).toHaveBeenCalledWith(
        'institution-12345678',
      );
      expect(res.set).toHaveBeenCalledWith({
        'Content-Type': 'application/vnd.ms-excel',
        'Content-Disposition':
          'attachment; filename="cerniq-alm-report-institut.xls"',
        'Content-Length': buffer.length,
      });
      expect(res.send).toHaveBeenCalledWith(buffer);
      expect(await controller.getCECLVintage('i1', undefined)).toEqual({
        scenario: 'base',
      });
      expect(await controller.getCECLVintage('i1', 'adverse')).toEqual({
        scenario: 'adverse',
      });
      expect(await controller.getCECLCohorts('i1')).toEqual({ rows: 2 });
      expect(
        await controller.uploadCohorts('i1', {
          cohorts: [{ bucket: '2025Q4' }],
        }),
      ).toEqual({ imported: 3 });
      expect(await controller.runMonteCarlo('i1', { paths: 5000 })).toEqual({
        paths: 5000,
      });
      expect(await controller.runStressPack('i1')).toEqual([{ id: 'base' }]);
    });

    it('covers prepayment, treasury, exam prep, analyst, webhooks, privacy, and ingest helpers', async () => {
      prepaymentEngine.computePRCPR.mockResolvedValue({ cpr: 0.11 });
      prepaymentEngine.computeSensitivity.mockResolvedValue({ delta: 0.03 });
      treasuryRates.getYieldCurvePoints.mockResolvedValue([
        { tenor: 2, rate: 4.2 },
      ]);
      examPrep.getExamPrep.mockResolvedValue({ checklist: ['liquidity'] });
      boardReport.generateBoardReportData.mockResolvedValue({ sections: 5 });
      chatAnalyst.processMessage.mockResolvedValue({
        answer: 'hedge duration',
      });
      chatAnalyst.getAvailableTools.mockResolvedValue(['stress-pack']);
      ncua5300.generateForm5300.mockResolvedValue({ quarter: '2026Q1' });
      prospectIntel.analyzeProspect.mockResolvedValue({
        charterNumber: '12345',
      });
      prospectIntel.analyzeAllProspects.mockResolvedValue({ analyzed: 20 });
      networkIntel.getNetworkOverview.mockResolvedValue({ clusters: 4 });
      webhooks.createSubscription.mockResolvedValue({ id: 'wh-1' });
      webhooks.listSubscriptions.mockResolvedValue([{ id: 'wh-1' }]);
      webhooks.deleteSubscription.mockResolvedValue({ deleted: true });
      usageMetering.getUsageSummary.mockResolvedValue({ month: '2026-03' });
      dataPrivacy.getDataInventory.mockResolvedValue({ assets: 12 });
      dataPrivacy.requestDeletion.mockResolvedValue({ requestId: 'del-1' });
      dataPrivacy.generateSAR.mockResolvedValue({ packageId: 'sar-1' });
      csvIngestV2.analyzeCSV.mockResolvedValue({ inferredColumns: 8 });
      csvIngestV2.commitIngestion.mockResolvedValue({ committed: true });
      nimOptimizer.optimize.mockResolvedValue({ nimBps: 18 });
      keyRateDuration.analyzePortfolio.mockResolvedValue({ buckets: 6 });
      ltp.computeLTP.mockResolvedValue({ ltp: 0.9 });
      usviExpansion.getUSVIFramework.mockResolvedValue({ regulator: 'USVI' });
      regAlert.getRecentPublications.mockResolvedValue([{ id: 'pub-1' }]);
      regAlert.runFullPipeline.mockResolvedValue({ triggered: true });

      expect(
        await controller.computePrepayment({
          mortgageRate: 0.075,
          currentMarketRate: 0.06,
          ageMonths: 24,
        }),
      ).toEqual({ cpr: 0.11 });
      expect(
        await controller.prepaymentSensitivity({
          mortgageRate: 0.075,
          currentMarketRate: 0.06,
          ageMonths: 24,
        }),
      ).toEqual({ delta: 0.03 });
      expect(await controller.getTreasuryCurve()).toEqual([
        { tenor: 2, rate: 4.2 },
      ]);
      expect(await controller.getExamPrep('i1')).toEqual({
        checklist: ['liquidity'],
      });
      expect(await controller.getBoardReport('i1')).toEqual({ sections: 5 });
      expect(
        await controller.chatWithAnalyst('i1', {
          message: 'What fails under -7%?',
          sessionId: 'session-1',
          lang: 'en',
        }),
      ).toEqual({ answer: 'hedge duration' });
      expect(await controller.getAnalystTools()).toEqual(['stress-pack']);
      expect(await controller.getForm5300('i1', '2026Q1')).toEqual({
        quarter: '2026Q1',
      });
      expect(
        await controller.analyzeProspect({ charterNumber: '12345' }),
      ).toEqual({ charterNumber: '12345' });
      expect(await controller.analyzeAllProspects()).toEqual({ analyzed: 20 });
      expect(await controller.getNetworkOverview()).toEqual({ clusters: 4 });
      expect(
        await controller.createWebhook('i1', {
          url: 'https://cerniq.io/webhook',
          events: ['analysis.completed'],
        }),
      ).toEqual({ id: 'wh-1' });
      expect(await controller.listWebhooks('i1')).toEqual([{ id: 'wh-1' }]);
      expect(await controller.deleteWebhook('wh-1')).toEqual({
        deleted: true,
      });
      expect(await controller.getUsageSummary('i1', '2026-03')).toEqual({
        month: '2026-03',
      });
      expect(await controller.getDataInventory()).toEqual({ assets: 12 });
      expect(
        await controller.requestDeletion({ user: { userId: 'u1' } }, 'i1', {
          regulation: 'GDPR',
          scope: 'all',
        }),
      ).toEqual({ requestId: 'del-1' });
      expect(await controller.generateSAR({ user: { userId: 'u1' } })).toEqual({
        packageId: 'sar-1',
      });
      expect(
        await controller.analyzeCSV('i1', { csvContent: 'a,b\n1,2' }),
      ).toEqual({ inferredColumns: 8 });
      expect(
        await controller.commitSmartIngest('i1', {
          csvContent: 'a,b\n1,2',
          mappings: { a: 'asset' },
          saveMappings: true,
        }),
      ).toEqual({ committed: true });
      expect(await controller.getNIMOptimizer('i1')).toEqual({ nimBps: 18 });
      expect(await controller.getKeyRateDurations('i1')).toEqual({
        buckets: 6,
      });
      expect(await controller.getLTP('i1')).toEqual({ ltp: 0.9 });
      expect(await controller.getUSVIFramework()).toEqual({
        regulator: 'USVI',
      });
      expect(await controller.getPublications()).toEqual([{ id: 'pub-1' }]);
      expect(await controller.triggerRegScan()).toEqual({ triggered: true });
    });

    it('rejects nl ingest when no file is provided and processes uploads otherwise', async () => {
      (controller as any).nlIngest = {
        ingestDocument: jest.fn().mockResolvedValue({ pages: 4 }),
      };

      await expect(
        controller.nlDocumentIngest('i1', undefined as any),
      ).rejects.toThrow('No file provided');

      await expect(
        controller.nlDocumentIngest('i1', {
          originalname: 'minutes.pdf',
          buffer: Buffer.from('pdf'),
          mimetype: 'application/pdf',
        } as any),
      ).resolves.toEqual({ pages: 4 });
    });
  });

  describe('Late-stage quant and export routes', () => {
    it('covers advanced quant portfolio, climate, macro, and referral routes', async () => {
      const controllerAny = controller as any;
      controllerAny.robustOptimizer = {
        optimize: jest.fn().mockResolvedValue({ weights: [0.6, 0.4] }),
      };
      controllerAny.optionalitySuite = {
        analyzePortfolio: jest.fn().mockResolvedValue({ convexity: 1.8 }),
      };
      controllerAny.creditConcVaR = {
        compute: jest.fn().mockResolvedValue({ concentrationVar: 22 }),
      };
      controllerAny.climateRisk = {
        computeClimateRisk: jest
          .fn()
          .mockResolvedValue({ floodRisk: 'medium' }),
      };
      controllerAny.nimAttribution = {
        computeAttribution: jest.fn().mockResolvedValue({ depositBeta: -12 }),
      };
      controllerAny.behavioralDuration = {
        computeBehavioralDurations: jest.fn().mockResolvedValue({ decay: 3.1 }),
      };
      controllerAny.referralSvc = {
        generateCode: jest.fn().mockResolvedValue({ code: 'REF-123' }),
        validateCode: jest.fn().mockResolvedValue({ valid: true }),
      };
      controllerAny.hmmRegime = {
        generateObservationsFromRates: jest.fn().mockReturnValue([0.1, -0.2]),
        detectRegime: jest.fn().mockResolvedValue({ regime: 'risk-off' }),
      };
      controllerAny.blackLitterman = {
        computeBLPortfolio: jest.fn().mockResolvedValue({ tilt: 'quality' }),
      };
      controllerAny.cvarOptimizer = {
        optimize: jest.fn().mockResolvedValue({ alpha: 0.975 }),
      };
      controllerAny.hrpService = {
        computeHRP: jest.fn().mockResolvedValue({ clusters: 3 }),
      };
      controllerAny.creditMetricsSvc = {
        computePortfolioVaR: jest.fn().mockResolvedValue({ migrationVar: 17 }),
      };
      controllerAny.kmvMerton = {
        computeKMV: jest.fn().mockResolvedValue({ defaultDistance: 2.3 }),
      };
      controllerAny.pcaYieldCurve = {
        generateSyntheticChanges: jest.fn().mockReturnValue([[0.1, -0.1]]),
        computePCAFactors: jest.fn().mockResolvedValue({ factors: ['level'] }),
      };
      controllerAny.frtbES = {
        computeFRTBCapital: jest.fn().mockResolvedValue({ capital: 144 }),
      };
      controllerAny.fedFutures = {
        computeFedFuturesCurve: jest
          .fn()
          .mockResolvedValue({ terminalRate: 4.25 }),
      };
      controllerAny.macroFactor = {
        computeMacroImpact: jest.fn().mockResolvedValue({ beta: 0.7 }),
      };
      controllerAny.copulaCredit = {
        simulateWithCopula: jest.fn().mockResolvedValue({ type: 't' }),
      };
      controllerAny.wrongWayRisk = {
        computeWWR: jest.fn().mockResolvedValue({ wrongWayPct: 11 }),
      };
      controllerAny.irCapFloor = {
        priceCapFloor: jest.fn().mockResolvedValue({ pv: 125000 }),
      };
      controllerAny.ncuaRBC2 = {
        computeRBC2: jest.fn().mockResolvedValue({ ratio: 10.8 }),
      };

      expect(
        await controller.robustOptimize('i1', {
          aggressiveness: 'conservative',
        }),
      ).toEqual({ weights: [0.6, 0.4] });
      expect(await controller.getOptionality('i1')).toEqual({ convexity: 1.8 });
      expect(await controller.getConcVaR('i1')).toEqual({
        concentrationVar: 22,
      });
      expect(await controller.getClimateRisk('i1')).toEqual({
        floodRisk: 'medium',
      });
      expect(await controller.getNIMAttribution('i1')).toEqual({
        depositBeta: -12,
      });
      expect(await controller.getBehavioralDuration('i1')).toEqual({
        decay: 3.1,
      });
      expect(await controller.generateReferralCode('i1')).toEqual({
        code: 'REF-123',
      });
      expect(await controller.validateReferralCode('REF-123')).toEqual({
        valid: true,
      });
      expect(await controller.getMacroRegime()).toEqual({ regime: 'risk-off' });
      expect(await controller.runBlackLitterman('i1', { views: [] })).toEqual({
        tilt: 'quality',
      });
      expect(await controller.runCVaROptimizer('i1', { alpha: 0.975 })).toEqual(
        { alpha: 0.975 },
      );
      expect(await controller.getHRP('i1')).toEqual({ clusters: 3 });
      expect(await controller.runCreditMetrics('i1', { paths: 2500 })).toEqual({
        migrationVar: 17,
      });
      expect(await controller.getKMVMerton('i1')).toEqual({
        defaultDistance: 2.3,
      });
      expect(await controller.getPCAFactors('i1')).toEqual({
        factors: ['level'],
      });
      expect(await controller.getFRTBCapital('i1')).toEqual({ capital: 144 });
      expect(await controller.getFedFutures()).toEqual({ terminalRate: 4.25 });
      expect(await controller.getMacroFactors('i1')).toEqual({ beta: 0.7 });
      expect(
        await controller.runCopulaCredit('i1', { type: 't', paths: 4000 }),
      ).toEqual({ type: 't' });
      expect(await controller.getWrongWayRisk('i1')).toEqual({
        wrongWayPct: 11,
      });
      expect(
        await controller.priceCapFloor({
          type: 'cap',
          notional: 10_000_000,
          strike: 0.05,
        }),
      ).toEqual({ pv: 125000 });
      expect(controllerAny.irCapFloor.priceCapFloor).toHaveBeenCalledWith(
        'cap',
        10_000_000,
        0.05,
        expect.any(Array),
        0.2,
        expect.any(Array),
      );
      expect(await controller.getRBC2('i1')).toEqual({ ratio: 10.8 });
    });

    it('covers reseller, sample-report, stateless analysis, trend, export, and demo routes', async () => {
      const controllerAny = controller as any;
      const sampleBuffer = Buffer.from('sample-pdf');
      const sampleRes = { set: jest.fn(), end: jest.fn() };
      const csvRes = { set: jest.fn(), send: jest.fn() };
      const demoBalanceSheet = [{ category: 'asset', balance: 100 }];

      controllerAny.reseller = {
        createReseller: jest.fn().mockResolvedValue({ id: 'res-1' }),
        listResellers: jest.fn().mockResolvedValue([{ id: 'res-1' }]),
        getReseller: jest.fn().mockResolvedValue({ id: 'res-1', slug: 'desk' }),
      };
      controllerAny.sampleReportFactory = {
        generateSampleReport: jest.fn().mockResolvedValue(sampleBuffer),
        generateAndSaveForProspect: jest
          .fn()
          .mockResolvedValue({ reportId: 'rep-1' }),
      };
      controllerAny.almService = {
        durationGapAnalysis: jest.fn().mockReturnValue({ durationGap: 1.2 }),
        niiSimulation: jest.fn().mockReturnValue({ niiDelta: -7 }),
        eveAnalysis: jest.fn().mockReturnValue({ eveChangePct: -4 }),
        liquidityCoverageRatio: jest.fn().mockReturnValue({ lcr: 118 }),
        basisPointValue: jest.fn().mockReturnValue({ bpv: 5400 }),
        fullAnalysis: jest.fn().mockReturnValue({ overallRisk: 'moderate' }),
        getDemoBalanceSheet: jest.fn().mockReturnValue(demoBalanceSheet),
      };
      controllerAny.trendAnalysis = {
        getHistoricalTrend: jest.fn().mockResolvedValue({ points: 6 }),
      };
      controllerAny.dataExport = {
        exportMetrics: jest
          .fn()
          .mockResolvedValueOnce({ format: 'json' })
          .mockResolvedValueOnce('a,b\n1,2'),
      };

      expect(
        await controller.createReseller({
          name: 'Desk',
          slug: 'desk',
          revenueSharePct: 20,
        }),
      ).toEqual({ id: 'res-1' });
      expect(await controller.listResellers()).toEqual([{ id: 'res-1' }]);
      expect(await controller.getReseller('res-1')).toEqual({
        id: 'res-1',
        slug: 'desk',
      });

      await controller.generateSampleReport(
        { charterNumber: '12345', lang: 'es' },
        sampleRes,
      );
      expect(sampleRes.set).toHaveBeenCalledWith({
        'Content-Type': 'application/pdf',
        'Content-Disposition':
          'attachment; filename="sample-alm-report-12345.pdf"',
        'Content-Length': sampleBuffer.length,
      });
      expect(sampleRes.end).toHaveBeenCalledWith(sampleBuffer);
      expect(
        await controller.generateSampleForProspect({
          charterNumber: '12345',
          prospectId: 'pros-1',
        }),
      ).toEqual({ reportId: 'rep-1' });

      expect(
        controller.durationGap({ balanceSheet: demoBalanceSheet } as any),
      ).toEqual({ durationGap: 1.2 });
      expect(
        controller.niiSimulation({
          balanceSheet: demoBalanceSheet,
          rateShocks: [{ tenor: 1, shockBps: -100 }],
        } as any),
      ).toEqual({ niiDelta: -7 });
      expect(
        controller.eve({
          balanceSheet: demoBalanceSheet,
          rateShocks: [{ tenor: 1, shockBps: -100 }],
        } as any),
      ).toEqual({ eveChangePct: -4 });
      expect(controller.lcr({} as any)).toEqual({ lcr: 118 });
      expect(controller.bpv({ balanceSheet: demoBalanceSheet } as any)).toEqual(
        { bpv: 5400 },
      );
      expect(
        controller.fullAnalysis({
          balanceSheet: demoBalanceSheet,
          rateShocks: [],
          lcr: { cashInflows: [], cashOutflows: [] },
        } as any),
      ).toEqual({ overallRisk: 'moderate' });

      expect(await controller.getHistoricalTrend('i1')).toEqual({ points: 6 });
      expect(await controller.exportJSON('i1')).toEqual({ format: 'json' });
      await controller.exportCSV('i1', csvRes);
      expect(csvRes.set).toHaveBeenCalledWith({
        'Content-Type': 'text/csv',
        'Content-Disposition': 'attachment; filename="cerniq-metrics.csv"',
      });
      expect(csvRes.send).toHaveBeenCalledWith('a,b\n1,2');
      expect(controller.demoBalanceSheet()).toEqual(demoBalanceSheet);
      expect(controller.demoAnalysis()).toEqual({ overallRisk: 'moderate' });
    });
  });

  describe('Operator and advisor routes', () => {
    it('runs a named liquidity stress-pack scenario', async () => {
      liquidityStressPack.runScenario.mockResolvedValue({
        scenarioId: 'same-day-7',
        scenarioName: 'Same-Day -7%',
        scenarioNameEs: 'Mismo Dia -7%',
        daysOfLiquidity: 17,
        lcr: 88,
        hqlaCoverage: 0.91,
        availableLiquid: 120,
        netOutflow: 132,
        surplus: -12,
        regulatoryStatus: 'WATCH',
        narrative: 'Liquidity stays above zero but drops below policy buffer.',
        narrativeEs:
          'La liquidez permanece positiva pero por debajo del buffer.',
      });

      const r = await controller.runStressPackScenario('i1', 'same-day-7');

      expect(liquidityStressPack.runScenario).toHaveBeenCalledWith(
        'i1',
        'same-day-7',
      );
      expect(r.regulatoryStatus).toBe('WATCH');
    });

    it('serves IRR policy dashboard, limits, and persisted limit updates', async () => {
      irrPolicy.checkAll.mockResolvedValue({
        checks: [],
        breachCount: 0,
        warningCount: 1,
        watchCount: 0,
        overallStatus: 'AMBER',
        lastChecked: '2026-03-30T00:00:00.000Z',
      });
      irrPolicy.getLimits.mockResolvedValue([{ name: 'EVE', value: 15 }]);
      irrPolicy.saveLimits.mockResolvedValue({ saved: true });
      irrPolicy.getBreachHistory.mockResolvedValue([{ id: 'breach-1' }]);

      const dashboard = await controller.getIRRPolicyDashboard('i1');

      expect(dashboard.overallStatus).toBe('AMBER');
      expect(await controller.getIRRPolicyLimits('i1')).toEqual([
        { name: 'EVE', value: 15 },
      ]);
      expect(
        await controller.saveIRRPolicyLimits('i1', {
          limits: [{ name: 'EVE', value: 12 }],
        }),
      ).toEqual({ saved: true });
      expect(await controller.getBreachHistory('i1')).toEqual([
        { id: 'breach-1' },
      ]);
    });

    it('returns deposit beta benchmark and library views', async () => {
      depositBetaLibrary.getBenchmark.mockResolvedValue({ beta: 0.42 });
      depositBetaLibrary.getRawLibrary.mockResolvedValue([{ peer: 'PR Coop' }]);

      expect(await controller.getDepositBetaBenchmark('i1')).toEqual({
        beta: 0.42,
      });
      expect(await controller.getDepositBetaLibrary()).toEqual([
        { peer: 'PR Coop' },
      ]);
    });

    it('resolves repricing gap, FTP attribution, and forward simulation inputs', async () => {
      repricingGap.getRepricingGap.mockResolvedValue({ gapPct: 11.2 });
      ftpAttribution.getFullAttribution.mockResolvedValue({ spreadBps: 23 });
      forwardSim.runForwardSimulation.mockResolvedValue({ horizon: 12 });

      expect(await controller.getRepricingGap('i1', '20')).toEqual({
        gapPct: 11.2,
      });
      expect(repricingGap.getRepricingGap).toHaveBeenCalledWith('i1', 20);
      expect(await controller.getFTPAttribution('i1')).toEqual({
        spreadBps: 23,
      });
      expect(
        await controller.runForwardSimulation('i1', {
          horizon: 12,
          ratePaths: ['base', 'shock'],
        }),
      ).toEqual({ horizon: 12 });
      expect(forwardSim.runForwardSimulation).toHaveBeenCalledWith({
        institutionId: 'i1',
        horizon: 12,
        ratePaths: ['base', 'shock'],
      });
    });

    it('returns peer, OAS, credit risk, and VaR analytics with parameter coercion', async () => {
      peerAnalytics.getPeerAnalytics.mockResolvedValue({ peerRank: 3 });
      oasCalculator.analyzePortfolio.mockResolvedValue({ oas: 87 });
      creditRiskQuant.analyzePortfolio.mockResolvedValue({ expectedLoss: 12 });
      portfolioVaR.computeVaRSuite.mockResolvedValue({ cvar: 28 });

      expect(await controller.getPeerAnalytics('i1')).toEqual({ peerRank: 3 });
      expect(await controller.getOASPortfolio('i1')).toEqual({ oas: 87 });
      expect(await controller.getCreditRisk('i1')).toEqual({
        expectedLoss: 12,
      });
      expect(await controller.getVaRSuite('i1', '99', '10')).toEqual({
        cvar: 28,
      });
      expect(portfolioVaR.computeVaRSuite).toHaveBeenCalledWith('i1', 0.99, 10);
    });

    it('returns capital optimization, asset EWS, SOFR exposure, and treasury rates', async () => {
      capitalOptimizer.optimize.mockResolvedValue({ strategy: 'aggressive' });
      assetEWS.computeEWS.mockResolvedValue({ watchlist: ['CRE'] });
      sofrMonitor.getExposureReport.mockResolvedValue({ exposurePct: 31 });
      treasuryRates.getLatestSnapshot.mockResolvedValue({ tenYear: 4.1 });

      expect(
        await controller.optimizeCapital('i1', {
          aggressiveness: 'aggressive',
        }),
      ).toEqual({ strategy: 'aggressive' });
      expect(await controller.getAssetEWS('i1')).toEqual({
        watchlist: ['CRE'],
      });
      expect(await controller.getSOFRExposure('i1')).toEqual({
        exposurePct: 31,
      });
      expect(await controller.getTreasuryRates()).toEqual({ tenYear: 4.1 });
    });

    it('returns alerts with unread filtering and supports alert actions', async () => {
      alertDelivery.getInstitutionAlerts.mockResolvedValue([{ id: 'alert-1' }]);
      alertDelivery.markRead.mockResolvedValue({ ok: true });
      alertDelivery.dismiss.mockResolvedValue({ dismissed: true });

      expect(await controller.getAlerts('i1', 'true')).toEqual([
        { id: 'alert-1' },
      ]);
      expect(alertDelivery.getInstitutionAlerts).toHaveBeenCalledWith(
        'i1',
        true,
      );
      expect(await controller.markAlertRead('alert-1')).toEqual({ ok: true });
      expect(await controller.dismissAlert('alert-1')).toEqual({
        dismissed: true,
      });
    });

    it('returns camel forecast and peer synthesis reports', async () => {
      camelForecaster.forecastForInstitution.mockResolvedValue({
        composite: 2.4,
      });
      peerSynthesis.getLatestReport.mockResolvedValue({
        generatedAt: '2026-03-29T00:00:00.000Z',
      });

      expect(await controller.getCamelForecast('i1')).toEqual({
        composite: 2.4,
      });
      expect(await controller.getPeerSynthesis()).toEqual({
        generatedAt: '2026-03-29T00:00:00.000Z',
      });
    });
  });
});
