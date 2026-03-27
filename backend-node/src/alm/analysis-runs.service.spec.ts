import { AnalysisRunsService } from './analysis-runs.service';

describe('AnalysisRunsService', () => {
  let service: AnalysisRunsService;
  let prisma: any;
  let almEnterprise: any;
  let stressTesting: any;

  beforeEach(() => {
    prisma = {
      institution: {
        findFirst: jest.fn().mockResolvedValue({
          id: 'inst_123',
          name: 'Coop Test',
          reportingDate: new Date('2026-01-31T00:00:00.000Z'),
        }),
      },
      analysisRun: {
        create: jest.fn().mockResolvedValue({
          id: 'run_123',
          institutionId: 'inst_123',
          createdByUserId: 'user_123',
          status: 'RUNNING',
          analysisType: 'full_analysis',
          triggeredBy: 'manual_api',
          modelVersion: 'alm-v1',
          scenarioSet: 'custom_-100_0_100',
          assumptions: {},
          parameterSnapshot: { rateShocks: [-100, 0, 100] },
          balanceSheetSnapshot: { assets: [], liabilities: [], equity: 0 },
          resultSummary: null,
          errorMessage: null,
          createdAt: new Date('2026-03-15T12:00:00.000Z'),
          completedAt: null,
          updatedAt: new Date('2026-03-15T12:00:00.000Z'),
          institution: {
            id: 'inst_123',
            name: 'Coop Test',
            type: 'cooperativa',
            totalAssets: 120,
            currency: 'USD',
            reportingDate: new Date('2026-01-31T00:00:00.000Z'),
          },
        }),
        update: jest.fn().mockImplementation(({ data }: any) =>
          Promise.resolve({
            id: 'run_123',
            institutionId: 'inst_123',
            createdByUserId: 'user_123',
            status: data.status,
            analysisType: 'full_analysis',
            triggeredBy: 'manual_api',
            modelVersion: 'alm-v1',
            scenarioSet: 'custom_-100_0_100',
            assumptions: {},
            parameterSnapshot: { rateShocks: [-100, 0, 100] },
            balanceSheetSnapshot: { assets: [], liabilities: [], equity: 0 },
            resultSummary: data.resultSummary ?? null,
            errorMessage: data.errorMessage ?? null,
            createdAt: new Date('2026-03-15T12:00:00.000Z'),
            completedAt: new Date('2026-03-15T12:01:00.000Z'),
            updatedAt: new Date('2026-03-15T12:01:00.000Z'),
            institution: {
              id: 'inst_123',
              name: 'Coop Test',
              type: 'cooperativa',
              totalAssets: 120,
              currency: 'USD',
              reportingDate: new Date('2026-01-31T00:00:00.000Z'),
            },
          }),
        ),
        findMany: jest.fn(),
        findFirst: jest.fn(),
      },
    };

    almEnterprise = {
      getBalanceSheetSnapshot: jest.fn().mockResolvedValue({
        assets: [
          {
            name: 'Cash',
            amount: 1000000,
            rate: 0.05,
            maturityYears: 0.1,
            isFloating: true,
          },
        ],
        liabilities: [
          {
            name: 'Deposits',
            amount: 900000,
            rate: 0.01,
            maturityYears: 0.1,
            isFloating: true,
          },
        ],
        equity: 100000,
      }),
      getALMSummary: jest.fn().mockResolvedValue({
        institution: {
          id: 'inst_123',
          name: 'Coop Test',
          type: 'cooperativa',
          totalAssets: 120,
          currency: 'USD',
          reportingDate: '2026-01-31T00:00:00.000Z',
        },
        durationGap: {
          assetDuration: 1,
          liabilityDuration: 0.5,
          durationGap: 0.5,
          riskProfile: 'neutral',
        },
        niiSensitivity: { scenarios: [], baseNII: 1.2, riskRating: 'low' },
        liquidity: {
          lcr: 115,
          hqla: 20,
          netOutflows: 18,
          status: 'compliant',
          buffer: 15,
        },
        topRisks: [],
        recommendations: [],
        riskScore: 82,
        fullAnalysis: {
          summary: {
            totalAssets: 1,
            totalLiabilities: 1,
            equity: 0,
            timestamp: '2026-03-15T12:00:00.000Z',
          },
          durationGap: {} as any,
          niiSimulation: {} as any,
          eve: {} as any,
          bpv: {} as any,
          lcr: null,
        },
      }),
    };

    stressTesting = {
      runFullStressTest: jest.fn().mockResolvedValue({
        monteCarlo: {
          paths: 1000,
          horizon: 12,
          ratePaths: [],
          niiDistribution: {},
          monthlyNIIBands: [],
          worstCaseNII: 0,
          expectedNII: 0,
          niiAtRisk: 0,
        },
        regulatory: { scenarios: [], overallRating: 'resilient' },
      }),
    };

    service = new AnalysisRunsService(prisma, almEnterprise, stressTesting);
  });

  it('creates a completed run with normalized metadata', async () => {
    const result = await service.createRun('user_123', {
      institutionId: 'inst_123',
      rateShocks: [100, -100, 100, 0],
      stressTesting: { paths: 500, horizon: 6 },
    });

    expect(prisma.analysisRun.create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          scenarioSet: 'custom_-100_0_100',
        }),
      }),
    );
    expect(almEnterprise.getALMSummary).toHaveBeenCalledWith(
      'inst_123',
      [-100, 0, 100],
    );
    expect(stressTesting.runFullStressTest).toHaveBeenCalledWith(
      'inst_123',
      expect.objectContaining({
        paths: 500,
        horizon: 6,
        volatility: 150,
        meanReversion: 0.15,
      }),
    );
    expect(result.status).toBe('COMPLETED');
    expect(result.resultSummary?.summary?.riskScore).toBe(82);
  });

  it('persists a failed run when analysis execution throws', async () => {
    almEnterprise.getALMSummary.mockRejectedValueOnce(
      new Error('summary failed'),
    );

    const result = await service.createRun('user_123', {
      institutionId: 'inst_123',
    });

    expect(result.status).toBe('FAILED');
    expect(result.errorMessage).toBe('summary failed');
    expect(prisma.analysisRun.update).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({ status: 'FAILED' }),
      }),
    );
  });
});
