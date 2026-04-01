// @ts-nocheck — Mock data intentionally uses simplified shapes
/**
 * ALM Controller — Comprehensive Tests
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
import { BadRequestException } from '@nestjs/common';

describe('AlmController — Core Revenue Path', () => {
  let controller: AlmController;
  let enterprise: Record<string, jest.Mock>;
  let stressTesting: Record<string, jest.Mock>;
  let reportsService: Record<string, jest.Mock>;
  let workspaceOnboarding: Record<string, jest.Mock>;
  let csvIngestion: Record<string, jest.Mock>;
  let analysisRuns: Record<string, jest.Mock>;
  let ingestionLogs: Record<string, jest.Mock>;
  let complianceCalendar: Record<string, jest.Mock>;
  let scenarioPersistence: Record<string, jest.Mock>;
  let yieldCurve: Record<string, jest.Mock>;
  let cecl: Record<string, jest.Mock>;
  let ftp: Record<string, jest.Mock>;
  let depositBeta: Record<string, jest.Mock>;
  let liquidityAdvanced: Record<string, jest.Mock>;
  let concentration: Record<string, jest.Mock>;

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
      getRegulatoryCompliance: jest.fn(),
      calculateDurationGap: jest.fn(),
      calculateNIISensitivity: jest.fn(),
      calculateLCR: jest.fn(),
    };

    stressTesting = {
      runFullStressTest: jest.fn(),
    };

    reportsService = {
      generateReport: jest.fn(),
    };

    workspaceOnboarding = {
      seedDemoData: jest.fn(),
    };

    csvIngestion = {
      parseCSV: jest.fn(),
      getCooperativaTemplate: jest.fn().mockReturnValue('header1,header2'),
      getGenericTemplate: jest.fn().mockReturnValue('generic_header'),
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

    scenarioPersistence = {
      saveScenario: jest.fn(),
      listScenarios: jest.fn(),
    };

    yieldCurve = {
      getYieldCurveAnalysis: jest.fn(),
      computeForwardNIISchedule: jest.fn(),
      applyShock: jest.fn(),
      saveCustomCurve: jest.fn(),
    };

    cecl = {
      getCECLAnalysis: jest.fn(),
      importLoanSegments: jest.fn(),
      getCECLForecast: jest.fn(),
      calculateWARM: jest.fn(),
    };

    ftp = {
      getFTPAnalysis: jest.fn(),
      getFTPSegments: jest.fn(),
    };

    depositBeta = {};
    liquidityAdvanced = {};
    concentration = {};

    // Build args array matching constructor parameter count
    const paramCount = AlmController.length || 90;
    const args: any[] = Array.from({ length: paramCount }, () => mockSvc());
    // Slot known services into the correct constructor positions
    args[0] = mockSvc(); // almService
    args[1] = enterprise;
    args[2] = stressTesting;
    args[3] = reportsService;
    args[4] = workspaceOnboarding;
    args[5] = csvIngestion;
    args[6] = analysisRuns;
    args[7] = ingestionLogs;
    args[8] = complianceCalendar;
    args[9] = scenarioPersistence;
    args[10] = yieldCurve;
    args[11] = cecl;
    args[12] = ftp;
    args[13] = depositBeta;
    args[14] = liquidityAdvanced;
    args[15] = concentration;
    controller = new (AlmController as any)(...args);
  });

  // ═══════════════════════════════════════════════════════════════════
  // Institution CRUD
  // ═══════════════════════════════════════════════════════════════════

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
    it('lists balance sheet items', async () => {
      enterprise.listBalanceSheetItems.mockResolvedValue({
        data: [{ id: 'bs1', category: 'asset' }],
        total: 1,
      });
      const r = await controller.listBalanceSheetItems('i1', {} as any);
      expect(enterprise.listBalanceSheetItems).toHaveBeenCalledWith('i1', expect.any(Object));
      expect(r.total).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // ALM Analysis
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/:id/summary', () => {
    it('returns ALM summary', async () => {
      enterprise.getALMSummary.mockResolvedValue({
        durationGap: { durationGap: 2.1, riskProfile: 'asset-sensitive' },
        liquidity: { lcr: 142, status: 'compliant' },
        riskScore: 68,
      });
      const r = await controller.getALMSummary('i1');
      expect(r.durationGap.durationGap).toBe(2.1);
      expect(r.liquidity.lcr).toBe(142);
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

  describe('GET /api/alm/:id/regulatory-compliance', () => {
    it('returns regulatory compliance', async () => {
      enterprise.getRegulatoryCompliance.mockResolvedValue({
        ncua: { status: 'compliant' },
        cossec: { status: 'compliant' },
      });
      const r = await controller.getRegulatoryCompliance('i1');
      expect(r.ncua.status).toBe('compliant');
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
    it('returns NII sensitivity', async () => {
      enterprise.calculateNIISensitivity.mockResolvedValue({
        up100: -2.5,
        down100: 1.8,
      });
      const r = await controller.getNIISensitivity('i1');
      expect(r.up100).toBe(-2.5);
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

  // ═══════════════════════════════════════════════════════════════════
  // Analysis Runs
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/alm/analysis/run', () => {
    it('creates analysis run', async () => {
      const dto = { institutionId: 'i1', type: 'full' };
      analysisRuns.createRun.mockResolvedValue({ id: 'run1', status: 'queued' });
      const req = { user: { userId: 'u1' } };
      const r = await controller.createAnalysisRun(req, dto as any);
      expect(analysisRuns.createRun).toHaveBeenCalledWith('u1', dto);
      expect(r.id).toBe('run1');
    });
  });

  describe('GET /api/alm/analysis-runs/:runId', () => {
    it('returns analysis run', async () => {
      analysisRuns.getRun.mockResolvedValue({ id: 'run1', status: 'completed' });
      const req = { user: { userId: 'u1' } };
      const r = await controller.getAnalysisRun(req, 'run1');
      expect(analysisRuns.getRun).toHaveBeenCalledWith('u1', 'run1');
      expect(r.status).toBe('completed');
    });
  });

  describe('GET /api/alm/institutions/:id/analysis-runs', () => {
    it('lists analysis runs', async () => {
      analysisRuns.listRuns.mockResolvedValue({ data: [], total: 0 });
      const req = { user: { userId: 'u1' } };
      const r = await controller.listAnalysisRuns(req, 'i1', {} as any);
      expect(analysisRuns.listRuns).toHaveBeenCalledWith('u1', 'i1', expect.any(Object));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Ingestion Logs
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/institutions/:id/ingestion-logs', () => {
    it('lists ingestion logs', async () => {
      ingestionLogs.listInstitutionLogs.mockResolvedValue({ data: [], total: 0 });
      const req = { user: { userId: 'u1' } };
      const r = await controller.listIngestionLogs(req, 'i1', {} as any);
      expect(ingestionLogs.listInstitutionLogs).toHaveBeenCalledWith('u1', 'i1', expect.any(Object));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Compliance Calendar
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/:id/calendar', () => {
    it('returns compliance calendar deadlines', async () => {
      complianceCalendar.getUpcomingDeadlines.mockResolvedValue([
        { name: 'NCUA 5300', dueDate: '2024-03-31' },
      ]);
      const r = await controller.getComplianceCalendar('i1');
      expect(r).toHaveLength(1);
      expect(r[0].name).toBe('NCUA 5300');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CSV Upload
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/alm/institutions/:id/upload-csv', () => {
    it('throws BadRequestException when no file provided', async () => {
      const req = { user: { userId: 'u1' } };
      await expect(
        controller.uploadCSV(req, 'i1', undefined as any),
      ).rejects.toThrow(BadRequestException);
    });

    it('returns validation errors for invalid CSV', async () => {
      csvIngestion.parseCSV.mockReturnValue({
        valid: false,
        errors: ['Missing header'],
        items: [],
      });
      ingestionLogs.recordLog.mockResolvedValue({ id: 'log1' });

      const req = { user: { userId: 'u1' } };
      const file = { buffer: Buffer.from('bad,data'), originalname: 'test.csv', size: 8 };
      const r = await controller.uploadCSV(req, 'i1', file as any);
      expect(r.valid).toBe(false);
      expect(r.imported).toBe(false);
      expect(r.ingestionLogId).toBe('log1');
    });

    it('dry run validates without importing', async () => {
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        errors: [],
        items: [{ category: 'asset', balance: 100 }],
      });
      ingestionLogs.recordLog.mockResolvedValue({ id: 'log2' });

      const req = { user: { userId: 'u1' } };
      const file = { buffer: Buffer.from('good,data'), originalname: 'test.csv', size: 9 };
      const r = await controller.uploadCSV(req, 'i1', file as any, 'true');
      expect(r.imported).toBe(false);
      expect(enterprise.importBalanceSheetItems).not.toHaveBeenCalled();
    });

    it('imports valid CSV data', async () => {
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        errors: [],
        items: [{ category: 'asset', balance: 100 }],
      });
      enterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });
      ingestionLogs.recordLog.mockResolvedValue({ id: 'log3' });

      const req = { user: { userId: 'u1' } };
      const file = { buffer: Buffer.from('good,data'), originalname: 'test.csv', size: 9 };
      const r = await controller.uploadCSV(req, 'i1', file as any);
      expect(r.imported).toBe(true);
      expect(r.importedCount).toBe(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CSV Templates
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/templates/:type', () => {
    it('returns cooperativa template', () => {
      const res = { set: jest.fn(), send: jest.fn() };
      controller.getCSVTemplate('cooperativa', res);
      expect(csvIngestion.getCooperativaTemplate).toHaveBeenCalled();
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({
          'Content-Type': 'text/csv; charset=utf-8',
        }),
      );
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('header1,header2'));
    });

    it('returns generic template for non-cooperativa type', () => {
      const res = { set: jest.fn(), send: jest.fn() };
      controller.getCSVTemplate('bank', res);
      expect(csvIngestion.getGenericTemplate).toHaveBeenCalled();
      expect(res.send).toHaveBeenCalledWith(expect.stringContaining('generic_header'));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Demo Seeding
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/alm/seed-demo', () => {
    it('seeds demo data', async () => {
      workspaceOnboarding.seedDemoData.mockResolvedValue({ institutionId: 'i1' });
      const r = await controller.seedDemoData({
        workspaceId: 'ws1',
        type: 'cooperativa',
      });
      expect(workspaceOnboarding.seedDemoData).toHaveBeenCalledWith('ws1', 'cooperativa');
      expect(r.institutionId).toBe('i1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // FTP (Funds Transfer Pricing)
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/:id/ftp', () => {
    it('returns FTP analysis', async () => {
      ftp.getFTPAnalysis.mockResolvedValue({ nim: 2.8, spreads: [] });
      const r = await controller.getFTPAnalysis('i1');
      expect(ftp.getFTPAnalysis).toHaveBeenCalledWith('i1');
      expect(r.nim).toBe(2.8);
    });
  });

  describe('POST /api/alm/:id/ftp/custom', () => {
    it('runs custom FTP with spread adjustment', async () => {
      ftp.getFTPAnalysis.mockResolvedValue({ nim: 3.1 });
      const r = await controller.runCustomFTP('i1', { spreadAdjBps: 25 } as any);
      expect(ftp.getFTPAnalysis).toHaveBeenCalledWith('i1', 25);
    });
  });

  describe('GET /api/alm/:id/ftp/segments', () => {
    it('returns FTP segments', async () => {
      ftp.getFTPSegments.mockResolvedValue([{ segment: 'auto_loans' }]);
      const r = await controller.getFTPSegments('i1');
      expect(r).toHaveLength(1);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // CECL
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/:id/cecl', () => {
    it('returns CECL analysis', async () => {
      cecl.getCECLAnalysis.mockResolvedValue({ allowance: 1.2e6, methodology: 'warm' });
      const r = await controller.getCECLAnalysis('i1', 'warm');
      expect(cecl.getCECLAnalysis).toHaveBeenCalledWith('i1', 'warm');
      expect(r.methodology).toBe('warm');
    });

    it('defaults methodology when not provided', async () => {
      cecl.getCECLAnalysis.mockResolvedValue({ methodology: 'warm' });
      await controller.getCECLAnalysis('i1');
      expect(cecl.getCECLAnalysis).toHaveBeenCalledWith('i1', undefined);
    });
  });

  describe('POST /api/alm/:id/cecl/segments', () => {
    it('imports loan segments', async () => {
      const dto = { segments: [{ type: 'auto', balance: 5e6 }] };
      cecl.importLoanSegments.mockResolvedValue({ count: 1 });
      const r = await controller.importLoanSegments('i1', dto as any);
      expect(cecl.importLoanSegments).toHaveBeenCalledWith('i1', dto.segments);
    });
  });

  describe('GET /api/alm/:id/cecl/forecast', () => {
    it('returns CECL forecast', async () => {
      cecl.getCECLForecast.mockResolvedValue({ quarters: [] });
      const r = await controller.getCECLForecast('i1');
      expect(r.quarters).toEqual([]);
    });
  });

  describe('POST /api/alm/cecl/warm', () => {
    it('runs WARM calculation', async () => {
      cecl.calculateWARM.mockResolvedValue({ allowance: 500_000 });
      const dto = { segments: [{ type: 'auto' }] };
      const r = await controller.runWARMCalculation(dto as any);
      expect(cecl.calculateWARM).toHaveBeenCalledWith(dto.segments);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Yield Curve
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/:id/yield-curve-analysis', () => {
    it('returns yield curve analysis', async () => {
      yieldCurve.getYieldCurveAnalysis.mockResolvedValue({ tenors: [], rates: [] });
      const r = await controller.getYieldCurveAnalysis('i1');
      expect(yieldCurve.getYieldCurveAnalysis).toHaveBeenCalledWith('i1');
    });
  });

  describe('POST /api/alm/:id/yield-curve/forward-nii', () => {
    it('computes forward NII', async () => {
      yieldCurve.computeForwardNIISchedule.mockResolvedValue({ schedule: [] });
      const body = { shockBpsPerTenor: { '1Y': 50 }, quarters: 4 };
      await controller.computeForwardNII('i1', body);
      expect(yieldCurve.computeForwardNIISchedule).toHaveBeenCalledWith('i1', body.shockBpsPerTenor, 4);
    });
  });

  describe('POST /api/alm/yield-curve/shocks', () => {
    it('applies yield curve shocks', async () => {
      yieldCurve.applyShock.mockResolvedValue({ shockedCurve: [] });
      const dto = { shockType: 'parallel', customShocks: undefined };
      await controller.applyYieldCurveShocks(dto as any);
      expect(yieldCurve.applyShock).toHaveBeenCalled();
    });
  });

  describe('POST /api/alm/yield-curve/custom', () => {
    it('saves custom yield curve', async () => {
      yieldCurve.saveCustomCurve.mockResolvedValue({ id: 'yc1' });
      const dto = { name: 'Custom Curve', institutionId: 'i1', tenors: [] };
      const r = await controller.saveCustomYieldCurve(dto as any);
      expect(r.id).toBe('yc1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Scenario Persistence
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/alm/scenarios/save', () => {
    it('saves scenario', async () => {
      scenarioPersistence.saveScenario.mockResolvedValue({ id: 'sc1' });
      const req = { user: { userId: 'u1' } };
      const dto = { name: 'Base Case', institutionId: 'i1' };
      const r = await controller.saveScenario(req, dto as any);
      expect(scenarioPersistence.saveScenario).toHaveBeenCalledWith('u1', dto);
      expect(r.id).toBe('sc1');
    });
  });

  describe('GET /api/alm/:id/scenarios', () => {
    it('lists scenarios', async () => {
      scenarioPersistence.listScenarios.mockResolvedValue({ data: [], total: 0 });
      const r = await controller.listScenarios('i1', {} as any);
      expect(scenarioPersistence.listScenarios).toHaveBeenCalledWith('i1', expect.any(Object));
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Stress Testing
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/alm/:id/stress-test', () => {
    it('runs full stress test', async () => {
      stressTesting.runFullStressTest.mockResolvedValue({
        monteCarlo: { paths: 1000 },
        regulatory: { scenarios: [] },
      });
      const r = await controller.runStressTest('i1', {} as any);
      expect(stressTesting.runFullStressTest).toHaveBeenCalled();
      expect(r.monteCarlo.paths).toBe(1000);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Reports
  // ═══════════════════════════════════════════════════════════════════

  describe('POST /api/alm/:id/reports', () => {
    it('generates report', async () => {
      reportsService.generateReport.mockResolvedValue({
        reportId: 'rpt1',
        format: 'pdf',
      });
      const r = await controller.generateReport('i1', { format: 'pdf' } as any);
      expect(reportsService.generateReport).toHaveBeenCalled();
      expect(r.reportId).toBe('rpt1');
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Compliance Calendar — detailed
  // ═══════════════════════════════════════════════════════════════════

  describe('GET /api/alm/:id/calendar — empty result', () => {
    it('returns empty array when no deadlines', async () => {
      complianceCalendar.getUpcomingDeadlines.mockResolvedValue([]);
      const r = await controller.getComplianceCalendar('i1');
      expect(r).toHaveLength(0);
    });
  });

  // ═══════════════════════════════════════════════════════════════════
  // Ingestion Logs — error propagation
  // ═══════════════════════════════════════════════════════════════════

  describe('Ingestion logs error propagation', () => {
    it('propagates error from listInstitutionLogs', async () => {
      ingestionLogs.listInstitutionLogs.mockRejectedValue(new Error('DB error'));
      const req = { user: { userId: 'u1' } };
      await expect(
        controller.listIngestionLogs(req, 'i1', {} as any),
      ).rejects.toThrow('DB error');
    });
  });
});
