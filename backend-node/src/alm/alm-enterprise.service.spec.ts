import { NotFoundException } from '@nestjs/common';
import {
  AlmEnterpriseService,
  DurationGapSummary,
  LCRSummary,
  NIISensitivityResult,
} from './alm-enterprise.service';

function makeInstitution(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inst-1',
    name: 'Stress Coop',
    type: 'cooperativa',
    totalAssets: 250,
    currency: 'USD',
    reportingDate: new Date('2026-03-29T00:00:00.000Z'),
    primaryRegulator: 'COSSEC',
    balanceSheetItems: [],
    liquidityPositions: [],
    ...overrides,
  };
}

function makeDurationGap(
  overrides: Partial<DurationGapSummary> = {},
): DurationGapSummary {
  return {
    assetDuration: 4.2,
    liabilityDuration: 1.9,
    durationGap: 2.3,
    riskProfile: 'asset-sensitive',
    ...overrides,
  };
}

function makeNII(
  overrides: Partial<NIISensitivityResult> = {},
): NIISensitivityResult {
  return {
    scenarios: [
      {
        name: 'Same-Day -7%',
        shiftBps: -700,
        niImpact: -4.9,
        niImpactPct: -7,
        mveImpact: -6.1,
        mveImpactPct: -9.4,
      },
    ],
    baseNII: 12.1,
    riskRating: 'high',
    ...overrides,
  };
}

function makeLCR(overrides: Partial<LCRSummary> = {}): LCRSummary {
  return {
    lcr: 96,
    hqla: 28,
    netOutflows: 29,
    status: 'warning',
    buffer: -4,
    ...overrides,
  };
}

describe('AlmEnterpriseService', () => {
  let service: AlmEnterpriseService;
  const mockPrisma = {
    institution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      findMany: jest.fn(),
    },
    balanceSheetItem: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    liquidityPosition: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
    interestRateScenario: {
      deleteMany: jest.fn(),
      createMany: jest.fn(),
    },
    analysisRun: {
      findFirst: jest.fn(),
    },
    reportJob: {
      findFirst: jest.fn(),
    },
  } as any;
  const mockAlmService = {
    analyzeBalanceSheet: jest.fn(),
    fullAnalysis: jest.fn(),
    durationGapAnalysis: jest.fn(),
    niiSimulation: jest.fn(),
    eveAnalysis: jest.fn(),
  } as any;
  const mockDurationService = {
    analyzePortfolio: jest.fn(),
    calculateEVESensitivity: jest.fn(),
    calculatePortfolioMetrics: jest.fn(),
    fullDurationAnalysis: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    service = new AlmEnterpriseService(
      mockPrisma,
      mockAlmService,
      mockDurationService,
    );

    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    mockPrisma.interestRateScenario.deleteMany.mockResolvedValue({ count: 0 });
    mockPrisma.interestRateScenario.createMany.mockResolvedValue({ count: 1 });
    mockPrisma.liquidityPosition.findFirst.mockResolvedValue(null);
    mockPrisma.analysisRun.findFirst.mockResolvedValue(null);
    mockPrisma.reportJob.findFirst.mockResolvedValue(null);
    mockAlmService.fullAnalysis.mockReturnValue({
      durationGap: { durationGap: 2.3 },
      lcr: {
        lcr: 96,
        hqlaTotal: 28_000_000,
        totalNetOutflows: 29_000_000,
        status: 'warning',
      },
    });
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('createInstitution creates with correct defaults', async () => {
    mockPrisma.institution.create.mockResolvedValue({ id: 'inst-1' });

    const result = await service.createInstitution({
      workspaceId: 'ws-1',
      name: 'Test Coop',
      type: 'cooperativa',
      totalAssets: 250,
      reportingDate: '2026-01-31',
    });

    expect(mockPrisma.institution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test Coop',
        type: 'cooperativa',
        currency: 'USD',
        primaryRegulator: 'COSSEC',
      }),
    });
    expect(result.id).toBe('inst-1');
  });

  it('getInstitution throws NotFoundException when not found', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue(null);

    await expect(service.getInstitution('bad-id')).rejects.toThrow(
      NotFoundException,
    );
  });

  it('getInstitution returns institution with balance sheet items', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-1',
      name: 'Test',
      balanceSheetItems: [{ id: 'bsi-1', category: 'asset', balance: 100 }],
      liquidityPositions: [],
    });

    const result = await service.getInstitution('inst-1');

    expect(result.id).toBe('inst-1');
    expect(result.balanceSheetItems).toHaveLength(1);
  });

  it('getInstitutionsByWorkspace returns paginated results', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'Coop A' },
    ]);
    mockPrisma.institution.count.mockResolvedValue(1);

    const result = await service.getInstitutionsByWorkspace('ws-1');

    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  it('getInstitutionsByUser returns empty when user has no workspaces', async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([]);

    const result = await service.getInstitutionsByUser('user-1');

    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  it('getInstitutionsByUser paginates across owned workspaces', async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([
      { id: 'ws-1' },
      { id: 'ws-2' },
    ]);
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-2', name: 'Coop B' },
    ]);
    mockPrisma.institution.count.mockResolvedValue(1);

    const result = await service.getInstitutionsByUser('user-1', {
      page: 2,
      pageSize: 5,
      sortOrder: 'asc',
    } as any);

    expect(mockPrisma.institution.findMany).toHaveBeenCalledWith({
      where: { workspaceId: { in: ['ws-1', 'ws-2'] } },
      skip: 5,
      take: 5,
      orderBy: { createdAt: 'asc' },
    });
    expect(result).toMatchObject({
      items: [{ id: 'inst-2', name: 'Coop B' }],
      total: 1,
      page: 2,
      pageSize: 5,
      totalPages: 1,
    });
  });

  it('importBalanceSheetItems replaces existing items and updates totalAssets', async () => {
    mockPrisma.balanceSheetItem.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.balanceSheetItem.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.institution.update.mockResolvedValue({});

    const items = [
      {
        category: 'asset',
        subcategory: 'loans',
        name: 'Auto Loans',
        balance: 100,
        rate: 0.06,
        duration: 3,
        rateType: 'fixed',
      },
      {
        category: 'asset',
        subcategory: 'cash',
        name: 'Cash',
        balance: 50,
        rate: 0.02,
        duration: 0.1,
        rateType: 'variable',
      },
      {
        category: 'liability',
        subcategory: 'deposits',
        name: 'Savings',
        balance: 80,
        rate: 0.01,
        duration: 0.5,
        rateType: 'variable',
      },
    ];

    const result = await service.importBalanceSheetItems('inst-1', items);

    expect(result.count).toBe(3);
    expect(mockPrisma.balanceSheetItem.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-1' },
    });
    expect(mockPrisma.institution.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: { totalAssets: 150 },
    });
  });

  it('listBalanceSheetItems returns paginated balance sheet rows', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { id: 'bsi-1', name: 'Cash' },
      { id: 'bsi-2', name: 'Deposits' },
    ]);
    mockPrisma.balanceSheetItem.count.mockResolvedValue(2);

    const result = await service.listBalanceSheetItems('inst-1', {
      page: 1,
      pageSize: 2,
    } as any);

    expect(mockPrisma.balanceSheetItem.findMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-1' },
      skip: 0,
      take: 2,
      orderBy: { createdAt: 'desc' },
    });
    expect(result.totalPages).toBe(1);
    expect(result.items).toHaveLength(2);
  });

  it('saveLiquidityPosition persists the latest liquidity snapshot', async () => {
    mockPrisma.liquidityPosition.create.mockResolvedValue({ id: 'liq-1' });

    const result = await service.saveLiquidityPosition('inst-1', {
      hqlaLevel1: 10,
      hqlaLevel2: 4,
      cashOutflows: 20,
      cashInflows: 5,
      lcr: 93,
      nsfr: 110,
    });

    expect(mockPrisma.liquidityPosition.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        institutionId: 'inst-1',
        hqlaLevel1: 10,
        hqlaLevel2: 4,
        cashOutflows: 20,
        cashInflows: 5,
        lcr: 93,
        nsfr: 110,
      }),
    });
    expect(result.id).toBe('liq-1');
  });

  it('builds a balance sheet snapshot with date-derived maturity and repricing frequency', async () => {
    const now = new Date('2026-03-30T00:00:00.000Z').getTime();
    jest.spyOn(Date, 'now').mockReturnValue(now);
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        name: 'Floating Loans',
        category: 'asset',
        balance: 25,
        rate: 0.08,
        duration: 1.2,
        maturityDate: new Date('2027-03-30T00:00:00.000Z'),
        repriceDate: new Date('2026-06-30T00:00:00.000Z'),
        rateType: 'variable',
      },
      {
        name: 'Core Deposits',
        category: 'liability',
        balance: 20,
        rate: 0.02,
        duration: 0.5,
        maturityDate: null,
        repriceDate: null,
        rateType: 'fixed',
      },
    ]);

    const snapshot = await service.getBalanceSheetSnapshot('inst-1');

    expect(snapshot.equity).toBe(5_000_000);
    expect(snapshot.assets[0]).toEqual(
      expect.objectContaining({
        name: 'Floating Loans',
        amount: 25_000_000,
        maturityYears: 1,
        isFloating: true,
        repricingFrequencyMonths: 3,
      }),
    );
    expect(snapshot.liabilities[0]).toEqual(
      expect.objectContaining({
        name: 'Core Deposits',
        amount: 20_000_000,
        maturityYears: 0.5,
        isFloating: false,
      }),
    );
  });

  it('returns a valid empty balance sheet snapshot when no rows exist', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);

    const snapshot = await service.getBalanceSheetSnapshot('inst-empty');

    expect(snapshot).toEqual({
      assets: [
        {
          name: 'No assets',
          amount: 0,
          rate: 0,
          maturityYears: 0,
          isFloating: false,
        },
      ],
      liabilities: [
        {
          name: 'No liabilities',
          amount: 0,
          rate: 0,
          maturityYears: 0,
          isFloating: false,
        },
      ],
      equity: 0,
    });
  });

  it('calculateDurationGap uses DurationService analytics when positions exist', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      { id: 'bsi-1', category: 'asset', balance: 100 },
    ]);
    mockDurationService.calculatePortfolioMetrics.mockReturnValue({
      assetDuration: 4.235,
      liabilityDuration: 2.126,
      leverageAdjustedDurationGap: 2.1094,
      assetConvexity: 0.123456,
      liabilityConvexity: 0.054321,
    });

    const result = await service.calculateDurationGap('inst-1');

    expect(result).toEqual({
      assetDuration: 4.24,
      liabilityDuration: 2.13,
      durationGap: 2.11,
      riskProfile: 'asset-sensitive',
      assetConvexity: 0.1235,
      liabilityConvexity: 0.0543,
      leverageAdjustedDurationGap: 2.1094,
    });
  });

  it('calculateDurationGap falls back to AlmService when there are no positions', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([]);
    mockAlmService.durationGapAnalysis.mockReturnValue({
      assetDuration: 1.7,
      liabilityDuration: 2.1,
      durationGap: -0.4,
    });

    const result = await service.calculateDurationGap('inst-1');

    expect(mockAlmService.durationGapAnalysis).toHaveBeenCalled();
    expect(result).toEqual({
      assetDuration: 1.7,
      liabilityDuration: 2.1,
      durationGap: -0.4,
      riskProfile: 'neutral',
    });
  });

  it('calculateNIISensitivity filters the base scenario and escalates risk from worst-case stress', async () => {
    mockAlmService.niiSimulation.mockReturnValue({
      baseNII: 12_000_000,
      scenarios: [
        { shockBps: 0, change: 0, changePct: 0 },
        { shockBps: 100, change: -500_000, changePct: -0.06 },
        { shockBps: -200, change: -2_000_000, changePct: -0.22 },
      ],
    });
    mockAlmService.eveAnalysis.mockReturnValue({
      scenarios: [
        { shockBps: 100, change: -1_100_000, changePct: -0.12 },
        { shockBps: -200, change: -3_400_000, changePct: -0.31 },
      ],
    });

    const result = await service.calculateNIISensitivity('inst-1');

    expect(result.baseNII).toBe(12);
    expect(result.riskRating).toBe('critical');
    expect(result.scenarios).toEqual([
      {
        name: '+100bps',
        shiftBps: 100,
        niImpact: -0.5,
        niImpactPct: -6,
        mveImpact: -1.1,
        mveImpactPct: -12,
      },
      {
        name: '-200bps',
        shiftBps: -200,
        niImpact: -2,
        niImpactPct: -22,
        mveImpact: -3.4,
        mveImpactPct: -31,
      },
    ]);
  });

  it('calculateNIISensitivity keeps low-risk ratings and zeroes missing EVE matches', async () => {
    mockAlmService.niiSimulation.mockReturnValue({
      baseNII: 4_000_000,
      scenarios: [
        { shockBps: 0, change: 0, changePct: 0 },
        { shockBps: 50, change: -120_000, changePct: -0.03 },
      ],
    });
    mockAlmService.eveAnalysis.mockReturnValue({
      scenarios: [],
    });

    const result = await service.calculateNIISensitivity('inst-1', [0, 50]);

    expect(result).toEqual({
      baseNII: 4,
      riskRating: 'low',
      scenarios: [
        {
          name: '+50bps',
          shiftBps: 50,
          niImpact: -0.12,
          niImpactPct: -3,
          mveImpact: 0,
          mveImpactPct: 0,
        },
      ],
    });
  });

  it('calculateLCR prefers persisted liquidity positions and derives warning status from thresholds', async () => {
    mockPrisma.liquidityPosition.findFirst.mockResolvedValue({
      hqlaLevel1: 15,
      hqlaLevel2: 10,
      cashOutflows: 40,
      cashInflows: 5,
      lcr: 95,
      nsfr: 110,
    });

    const result = await service.calculateLCR('inst-1');

    expect(result).toEqual({
      lcr: 95,
      hqla: 25,
      netOutflows: 35,
      status: 'warning',
      buffer: -5,
    });
  });

  it('calculateLCR falls back to AlmService analysis and handles missing LCR output', async () => {
    mockPrisma.liquidityPosition.findFirst.mockResolvedValue(null);
    mockAlmService.fullAnalysis
      .mockReturnValueOnce({
        lcr: {
          lcr: 123.4,
          hqlaTotal: 28_000_000,
          totalNetOutflows: 21_000_000,
          status: 'compliant',
        },
      })
      .mockReturnValueOnce({
        lcr: null,
      });

    const compliant = await service.calculateLCR('inst-1');
    const missing = await service.calculateLCR('inst-2');

    expect(compliant).toEqual({
      lcr: 123.4,
      hqla: 28,
      netOutflows: 21,
      status: 'compliant',
      buffer: 23.4,
    });
    expect(missing).toEqual({
      lcr: 0,
      hqla: 0,
      netOutflows: 0,
      status: 'breach',
      buffer: -100,
    });
  });

  it('builds COSSEC compliance ratios with summary math and benchmark-aware status', async () => {
    const items = [
      {
        category: 'asset',
        subcategory: 'consumer_loans',
        balance: 120,
        rate: 0.08,
      },
      {
        category: 'asset',
        subcategory: 'investment_securities',
        balance: 40,
        rate: 0.04,
      },
      {
        category: 'asset',
        subcategory: 'cash_equivalents',
        balance: 20,
        rate: 0.01,
      },
      {
        category: 'liability',
        subcategory: 'savings_deposits',
        balance: 130,
        rate: 0.02,
      },
      {
        category: 'liability',
        subcategory: 'demand_deposits',
        balance: 15,
        rate: 0,
      },
      {
        category: 'liability',
        subcategory: 'time_deposits',
        balance: 10,
        rate: 0.03,
      },
    ];
    mockPrisma.institution.findUnique.mockResolvedValue(
      makeInstitution({ balanceSheetItems: items }),
    );
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);
    jest
      .spyOn(service, 'calculateLCR')
      .mockResolvedValue(
        makeLCR({ lcr: 130, status: 'compliant', buffer: 30 }),
      );
    jest.spyOn(service, 'calculateDurationGap').mockResolvedValue(
      makeDurationGap({
        durationGap: 0.6,
        riskProfile: 'neutral',
      }),
    );
    jest.spyOn(service, 'calculateNIISensitivity').mockResolvedValue(
      makeNII({
        riskRating: 'low',
        scenarios: [
          {
            name: '+100bps',
            shiftBps: 100,
            niImpact: -0.2,
            niImpactPct: -1.1,
            mveImpact: -0.3,
            mveImpactPct: -1.4,
          },
        ],
        baseNII: 8.3,
      }),
    );

    const result = await service.getCOSSECCompliance('inst-1');

    expect(result.ratios).toHaveLength(12);
    expect(result.overallStatus).toBe('non-compliant');
    expect(result.examReadinessScore).toBe(95);
    expect(result.summary).toMatchObject({
      totalAssets: 180,
      totalLiabilities: 155,
      equity: 25,
      totalLoans: 120,
      totalShares: 155,
      liquidAssets: 60,
      capitalRatio: 13.89,
      loanToShareRatio: 77.42,
      liquidityRatio: 33.33,
      largestSectorPct: 100,
      largestSectorName: 'consumer_loans',
    });
    expect(result.ratios.find((ratio) => ratio.id === 8)).toEqual(
      expect.objectContaining({
        name: 'Concentration Risk',
        status: 'fail',
        value: 100,
      }),
    );
  });

  it('adds trend deltas when a previous completed run exists', async () => {
    jest.spyOn(service, 'getCOSSECCompliance').mockResolvedValue({
      institutionName: 'Stress Coop',
      institutionType: 'cooperativa',
      reportingDate: '2026-03-29T00:00:00.000Z',
      checks: [],
      ratios: [
        {
          id: 1,
          name: 'Capital Adequacy',
          nameEs: 'Capital',
          value: 11.5,
          unit: '%',
          threshold: '>= 8%',
          thresholdDirection: 'gte',
          status: 'pass',
          description: '',
          descriptionEs: '',
          examReadinessContribution: 20,
          sectorMedian: null,
          percentileRank: null,
          percentileRankEs: null,
        },
        {
          id: 4,
          name: 'Loan-to-Deposit Ratio',
          nameEs: 'Prestamos/Depositos',
          value: 77,
          unit: '%',
          threshold: '<= 80%',
          thresholdDirection: 'lte',
          status: 'pass',
          description: '',
          descriptionEs: '',
          examReadinessContribution: 10,
          sectorMedian: null,
          percentileRank: null,
          percentileRankEs: null,
        },
      ],
      examReadinessScore: 30,
      overallStatus: 'compliant',
      summary: {} as any,
    });
    mockPrisma.analysisRun.findFirst.mockResolvedValue({
      createdAt: new Date('2025-12-31T00:00:00.000Z'),
      resultSummary: {
        summary: {
          capitalRatio: 10.9,
          loanToShareRatio: 80.2,
        },
      },
    });
    mockPrisma.reportJob.findFirst.mockResolvedValue({
      analysisPeriod: 'Q4-2025',
      completedAt: new Date('2026-01-15T00:00:00.000Z'),
    });

    const result = await service.getCOSSECComplianceWithTrend('inst-1');

    expect(result.previousPeriod).toBe('Q4-2025');
    expect(result.trends).toEqual(
      expect.arrayContaining([
        expect.objectContaining({
          ratioId: 1,
          delta: 0.6,
          trend: 'improving',
          previousPeriod: 'Q4-2025',
        }),
        expect.objectContaining({
          ratioId: 4,
          delta: -3.2,
          trend: 'improving',
        }),
      ]),
    );
  });

  it('returns null trend metadata when no prior run is available', async () => {
    jest.spyOn(service, 'getCOSSECCompliance').mockResolvedValue({
      institutionName: 'Stress Coop',
      institutionType: 'cooperativa',
      reportingDate: '2026-03-29T00:00:00.000Z',
      checks: [],
      ratios: [],
      examReadinessScore: 0,
      overallStatus: 'compliant',
      summary: {} as any,
    });
    mockPrisma.analysisRun.findFirst.mockResolvedValue(null);

    const result = await service.getCOSSECComplianceWithTrend('inst-1');

    expect(result.trends).toBeNull();
    expect(result.previousPeriod).toBeNull();
  });

  it('dispatches regulatory compliance to the NCUA framework when required', async () => {
    const items = [
      {
        category: 'asset',
        subcategory: 'consumer_loans',
        balance: 100,
        rate: 0.08,
      },
      {
        category: 'asset',
        subcategory: 'investment_securities',
        balance: 20,
        rate: 0.04,
      },
      {
        category: 'asset',
        subcategory: 'cash_equivalents',
        balance: 15,
        rate: 0.01,
      },
      {
        category: 'liability',
        subcategory: 'savings_deposits',
        balance: 95,
        rate: 0.02,
      },
      {
        category: 'liability',
        subcategory: 'time_deposits',
        balance: 15,
        rate: 0.03,
      },
    ];
    mockPrisma.institution.findUnique.mockResolvedValue(
      makeInstitution({
        primaryRegulator: 'NCUA',
        balanceSheetItems: items,
      }),
    );
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue(items);

    const result = await service.getRegulatoryCompliance('inst-1');

    expect(result.ratios).toHaveLength(12);
    expect(result.ratios.filter((ratio) => ratio.name === 'N/A')).toHaveLength(
      5,
    );
    expect(result.institutionName).toBe('Stress Coop');
  });

  it('defaults regulatory compliance to the COSSEC engine for non-NCUA institutions', async () => {
    const cossecResult = {
      institutionName: 'Stress Coop',
      institutionType: 'cooperativa',
      reportingDate: '2026-03-29T00:00:00.000Z',
      checks: [],
      ratios: [],
      examReadinessScore: 88,
      overallStatus: 'compliant',
      summary: {} as any,
    };
    jest
      .spyOn(service, 'getInstitution')
      .mockResolvedValue(
        makeInstitution({ primaryRegulator: 'COSSEC' }) as any,
      );
    jest
      .spyOn(service, 'getCOSSECCompliance')
      .mockResolvedValue(cossecResult as any);

    const result = await service.getRegulatoryCompliance('inst-1');

    expect(service.getCOSSECCompliance).toHaveBeenCalledWith('inst-1');
    expect(result).toBe(cossecResult);
  });

  it('derives the prior period label from the previous run when report-job lookup fails', async () => {
    jest.spyOn(service, 'getCOSSECCompliance').mockResolvedValue({
      institutionName: 'Stress Coop',
      institutionType: 'cooperativa',
      reportingDate: '2026-03-29T00:00:00.000Z',
      checks: [],
      ratios: [
        {
          id: 1,
          name: 'Capital Adequacy',
          nameEs: 'Capital',
          value: 11.1,
          unit: '%',
          threshold: '>= 8%',
          thresholdDirection: 'gte',
          status: 'pass',
          description: '',
          descriptionEs: '',
          examReadinessContribution: 20,
          sectorMedian: null,
          percentileRank: null,
          percentileRankEs: null,
        },
      ],
      examReadinessScore: 20,
      overallStatus: 'compliant',
      summary: {} as any,
    });
    mockPrisma.analysisRun.findFirst.mockResolvedValue({
      createdAt: new Date('2025-09-30T00:00:00.000Z'),
      resultSummary: {
        summary: {
          capitalRatio: 10.8,
        },
      },
    });
    mockPrisma.reportJob.findFirst.mockRejectedValue(
      new Error('report missing'),
    );

    const result = await service.getCOSSECComplianceWithTrend('inst-1');

    expect(result.previousPeriod).toBe('Q3-2025');
    expect(result.trends).toEqual([
      expect.objectContaining({
        ratioId: 1,
        previousPeriod: 'Q3-2025',
      }),
    ]);
  });

  describe('getALMSummary narrative integrity', () => {
    beforeEach(() => {
      mockPrisma.institution.findUnique.mockResolvedValue(makeInstitution());
    });

    it('computes the weighted summary risk score from duration, NII, and LCR buckets', async () => {
      jest.spyOn(service, 'calculateDurationGap').mockResolvedValue(
        makeDurationGap({
          assetDuration: 2.7,
          liabilityDuration: 1.9,
          durationGap: 0.8,
          riskProfile: 'neutral',
        }),
      );
      jest.spyOn(service, 'calculateNIISensitivity').mockResolvedValue(
        makeNII({
          riskRating: 'moderate',
          scenarios: [
            {
              name: '+100bps',
              shiftBps: 100,
              niImpact: -1.1,
              niImpactPct: -2.4,
              mveImpact: -1.6,
              mveImpactPct: -3.2,
            },
          ],
        }),
      );
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(
        makeLCR({
          lcr: 120,
          status: 'compliant',
          buffer: 20,
        }),
      );
      mockAlmService.fullAnalysis.mockReturnValue({
        durationGap: { durationGap: 0.8 },
      });

      const result = await service.getALMSummary('inst-1');

      expect(result.riskScore).toBe(78);
      expect(result.topRisks).toEqual([
        'No significant risks identified — strong ALM position',
      ]);
    });

    it('turns a same-day -7% severe profile into aligned top risks, recommendations, and persisted scenarios', async () => {
      const durationGap = makeDurationGap();
      const nii = makeNII();
      const lcr = makeLCR();

      jest
        .spyOn(service, 'calculateDurationGap')
        .mockResolvedValue(durationGap);
      jest.spyOn(service, 'calculateNIISensitivity').mockResolvedValue(nii);
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(lcr);

      const result = await service.getALMSummary('inst-1');

      expect(result.riskScore).toBe(40);
      expect(result.topRisks).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Significant duration mismatch (+2.3yr)'),
          expect.stringContaining('Same-Day -7% scenario impacts NII'),
          expect.stringContaining('LCR near minimum threshold (96%)'),
        ]),
      );
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Consider extending liability duration'),
          expect.stringContaining('Evaluate interest rate swaps'),
          expect.stringContaining('Implement rate caps/floors'),
          expect.stringContaining('Build HQLA buffer'),
        ]),
      );
      expect(mockPrisma.interestRateScenario.deleteMany).toHaveBeenCalledWith({
        where: { institutionId: 'inst-1' },
      });
      expect(mockPrisma.interestRateScenario.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            institutionId: 'inst-1',
            name: 'Same-Day -7%',
            shiftBps: -700,
            niImpact: -4.9,
            mveImpact: -6.1,
            duration: 2.3,
          }),
        ],
      });
      expect(
        mockPrisma.interestRateScenario.deleteMany.mock.invocationCallOrder[0],
      ).toBeLessThan(
        mockPrisma.interestRateScenario.createMany.mock.invocationCallOrder[0],
      );
    });

    it('produces liability-sensitive and breach escalation narratives when downside pressure is severe', async () => {
      jest.spyOn(service, 'calculateDurationGap').mockResolvedValue(
        makeDurationGap({
          assetDuration: 1.7,
          liabilityDuration: 4.1,
          durationGap: -2.4,
          riskProfile: 'liability-sensitive',
        }),
      );
      jest.spyOn(service, 'calculateNIISensitivity').mockResolvedValue(
        makeNII({
          riskRating: 'critical',
          scenarios: [
            {
              name: 'Same-Day -7%',
              shiftBps: -700,
              niImpact: -7.4,
              niImpactPct: -10.2,
              mveImpact: -9.8,
              mveImpactPct: -14.6,
            },
          ],
        }),
      );
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(
        makeLCR({
          lcr: 82,
          status: 'breach',
          buffer: -18,
        }),
      );
      mockAlmService.fullAnalysis.mockReturnValue({
        durationGap: { durationGap: -2.4 },
      });

      const result = await service.getALMSummary('inst-1');

      expect(result.riskScore).toBe(26);
      expect(result.topRisks).toEqual(
        expect.arrayContaining([
          expect.stringContaining('Significant duration mismatch (-2.4yr)'),
          expect.stringContaining('Same-Day -7% scenario impacts NII'),
          expect.stringContaining('LCR below Basel III minimum (82%'),
        ]),
      );
      expect(result.recommendations).toEqual(
        expect.arrayContaining([
          expect.stringContaining(
            'Consider shortening asset duration or adding floating-rate loans',
          ),
          expect.stringContaining('Evaluate receive-fixed interest rate swaps'),
          expect.stringContaining('Implement rate caps/floors'),
          expect.stringContaining('URGENT: Increase HQLA holdings immediately'),
        ]),
      );
      expect(mockPrisma.interestRateScenario.createMany).toHaveBeenCalled();
    });

    it('populates duration convexity and EVE sensitivity when duration analytics are available', async () => {
      const durationMetrics = {
        assetDuration: 4.3,
        liabilityDuration: 2.2,
        equityDuration: 5.1,
      };
      const eveSensitivity = [
        { shockBps: -200, eveChangePct: 6.8 },
        { shockBps: 200, eveChangePct: -7.1 },
      ];

      mockPrisma.balanceSheetItem.findMany
        .mockResolvedValueOnce([])
        .mockResolvedValueOnce([
          {
            id: 'bsi-1',
            category: 'asset',
            balance: 100,
            duration: 4,
            rateType: 'fixed',
          },
        ]);
      mockDurationService.fullDurationAnalysis.mockReturnValue({
        portfolio: durationMetrics,
        eveSensitivity,
      });
      jest
        .spyOn(service, 'calculateDurationGap')
        .mockResolvedValue(makeDurationGap());
      jest
        .spyOn(service, 'calculateNIISensitivity')
        .mockResolvedValue(makeNII());
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(makeLCR());

      const result = await service.getALMSummary('inst-1');

      expect(mockDurationService.fullDurationAnalysis).toHaveBeenCalledWith(
        [
          expect.objectContaining({
            id: 'bsi-1',
            category: 'asset',
            balance: 100,
          }),
        ],
        [-200, -100, 100, 200, 300],
      );
      expect(result.durationConvexity).toEqual(durationMetrics);
      expect(result.eveSensitivity).toEqual(eveSensitivity);
    });

    it('returns a summary with null duration analytics when the duration lookup branch fails', async () => {
      mockPrisma.balanceSheetItem.findMany
        .mockResolvedValueOnce([])
        .mockRejectedValueOnce(new Error('duration lookup failed'));
      jest
        .spyOn(service, 'calculateDurationGap')
        .mockResolvedValue(makeDurationGap());
      jest
        .spyOn(service, 'calculateNIISensitivity')
        .mockResolvedValue(makeNII());
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(makeLCR());

      const result = await service.getALMSummary('inst-1');

      expect(result.durationConvexity).toBeNull();
      expect(result.eveSensitivity).toBeNull();
    });

    it('falls back to low-risk maintenance language when no significant risks are present', async () => {
      jest.spyOn(service, 'calculateDurationGap').mockResolvedValue(
        makeDurationGap({
          assetDuration: 2.1,
          liabilityDuration: 1.9,
          durationGap: 0.2,
          riskProfile: 'neutral',
        }),
      );
      jest.spyOn(service, 'calculateNIISensitivity').mockResolvedValue(
        makeNII({
          riskRating: 'low',
          scenarios: [
            {
              name: '+100bps',
              shiftBps: 100,
              niImpact: -0.4,
              niImpactPct: -1.1,
              mveImpact: -0.6,
              mveImpactPct: -1.4,
            },
          ],
        }),
      );
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(
        makeLCR({
          lcr: 150,
          status: 'compliant',
          buffer: 50,
        }),
      );
      mockAlmService.fullAnalysis.mockReturnValue({
        durationGap: { durationGap: 0.2 },
      });

      const result = await service.getALMSummary('inst-1');

      expect(result.riskScore).toBe(93);
      expect(result.topRisks).toEqual([
        'No significant risks identified — strong ALM position',
      ]);
      expect(result.recommendations).toEqual([
        'Maintain current ALM strategy — risk metrics within acceptable ranges',
        'Continue monitoring rate sensitivity quarterly',
      ]);
      expect(mockPrisma.interestRateScenario.createMany).toHaveBeenCalledWith({
        data: [
          expect.objectContaining({
            name: '+100bps',
            shiftBps: 100,
            duration: 0.2,
          }),
        ],
      });
    });

    it('deletes prior scenarios but skips createMany when no NII scenarios are available', async () => {
      jest.spyOn(service, 'calculateDurationGap').mockResolvedValue(
        makeDurationGap({
          assetDuration: 2.3,
          liabilityDuration: 2.2,
          durationGap: 0.1,
          riskProfile: 'neutral',
        }),
      );
      jest.spyOn(service, 'calculateNIISensitivity').mockResolvedValue(
        makeNII({
          riskRating: 'low',
          scenarios: [],
        }),
      );
      jest.spyOn(service, 'calculateLCR').mockResolvedValue(
        makeLCR({
          lcr: 145,
          status: 'compliant',
          buffer: 45,
        }),
      );
      mockAlmService.fullAnalysis.mockReturnValue({
        durationGap: { durationGap: 0.1 },
      });

      const result = await service.getALMSummary('inst-1');

      expect(result.topRisks).toEqual([
        'No significant risks identified — strong ALM position',
      ]);
      expect(mockPrisma.interestRateScenario.deleteMany).toHaveBeenCalledWith({
        where: { institutionId: 'inst-1' },
      });
      expect(mockPrisma.interestRateScenario.createMany).not.toHaveBeenCalled();
    });
  });
});
