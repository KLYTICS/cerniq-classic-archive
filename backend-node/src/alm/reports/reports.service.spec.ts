import { ReportsService } from './reports.service';

function buildSummary(overrides: Record<string, unknown> = {}) {
  return {
    institution: {
      id: 'inst-1',
      name: 'Stress Coop',
      type: 'cooperativa',
      totalAssets: 250,
      currency: 'USD',
      reportingDate: '2026-03-29T00:00:00.000Z',
    },
    riskScore: 61,
    durationGap: {
      assetDuration: 4.2,
      liabilityDuration: 1.9,
      durationGap: 2.3,
      riskProfile: 'asset-sensitive',
    },
    niiSensitivity: {
      baseNII: 12.1,
      riskRating: 'high',
      scenarios: [
        {
          name: 'Same-Day -7%',
          shiftBps: -700,
          niImpact: -4.9,
          niImpactPct: -7,
          mveImpact: -6.1,
          mveImpactPct: -9.4,
        },
        {
          name: '+200bps',
          shiftBps: 200,
          niImpact: -2.2,
          niImpactPct: -3.1,
          mveImpact: -1.7,
          mveImpactPct: -2.4,
        },
      ],
    },
    liquidity: {
      lcr: 96,
      hqla: 28,
      netOutflows: 29,
      status: 'warning',
      buffer: -4,
    },
    topRisks: [
      'Significant duration mismatch (+2.3yr) - equity exposed to rising rates',
      'NII at risk: Same-Day -7% scenario impacts NII by $-4.9M (-7%)',
      'LCR near minimum threshold (96%) - limited buffer',
    ],
    recommendations: [
      'Raise liquidity buffers before adding new duration risk.',
      'De-risk longer-duration assets until stressed NII stabilizes.',
    ],
    ...overrides,
  };
}

function buildStressTest(overrides: Record<string, unknown> = {}) {
  return {
    monteCarlo: {
      niiAtRisk: 4.9,
      expectedNII: 12.1,
      worstCaseNII: 7.2,
      niiDistribution: {
        p5: 7.2,
        p25: 9.1,
        median: 11.8,
        p75: 13.4,
        p95: 14.9,
      },
      paths: 500,
      horizon: 12,
    },
    regulatory: {
      overallRating: 'vulnerable',
      scenarios: [
        {
          name: 'Same-Day -7%',
          description: 'Single-session equity shock',
          niImpact: -4.9,
          mveImpact: -6.1,
          lcrImpact: -14,
          capitalImpact: -1.8,
          passFailStatus: 'fail',
        },
        {
          name: 'Parallel +200bp',
          description: 'Rate shock scenario',
          niImpact: -2.2,
          mveImpact: -1.7,
          lcrImpact: -3.2,
          capitalImpact: -0.4,
          passFailStatus: 'warn',
        },
      ],
    },
    cossecScenarios: [],
    ...overrides,
  };
}

function buildCompliance(overrides: Record<string, unknown> = {}) {
  return {
    framework: 'cossec',
    overallStatus: 'conditional',
    checks: [
      {
        name: 'Capital Ratio',
        nameEs: 'Razon de Capital',
        value: 10.5,
        threshold: 6,
        unit: '%',
        status: 'pass',
        description: 'Capital remains above threshold.',
        descriptionEs: 'El capital se mantiene sobre el umbral.',
      },
    ],
    ratios: [],
    ...overrides,
  };
}

function buildInstitution(overrides: Record<string, unknown> = {}) {
  return {
    id: 'inst-1',
    name: 'Stress Coop',
    type: 'cooperativa',
    totalAssets: 250,
    primaryRegulator: 'COSSEC',
    balanceSheetItems: [
      {
        category: 'asset',
        name: 'Loans',
        balance: 150,
        rate: 0.075,
        duration: 4,
        rateType: 'fixed',
      },
      {
        category: 'liability',
        name: 'Deposits',
        balance: 200,
        rate: 0.02,
        duration: 0.5,
        rateType: 'variable',
      },
    ],
    ...overrides,
  };
}

function stubRenderPipeline(service: ReportsService) {
  jest
    .spyOn(service as any, 'renderCoverPage')
    .mockImplementation(() => undefined);
  const execSpy = jest
    .spyOn(service as any, 'renderExecutiveSummary')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as any, 'renderBalanceSheetSnapshot')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as any, 'renderInterestRateRisk')
    .mockImplementation(() => undefined);
  jest
    .spyOn(service as any, 'renderLiquidityRisk')
    .mockImplementation(() => undefined);
  const stressSpy = jest
    .spyOn(service as any, 'renderStressTesting')
    .mockImplementation(() => undefined);
  const regulatorySpy = jest
    .spyOn(service as any, 'renderRegulatoryCompliance')
    .mockImplementation(() => undefined);
  const recommendationsSpy = jest
    .spyOn(service as any, 'renderRecommendations')
    .mockImplementation(() => undefined);

  return { execSpy, stressSpy, regulatorySpy, recommendationsSpy };
}

describe('ReportsService', () => {
  let service: ReportsService;
  const mockAlmEnterprise = {
    getALMSummary: jest.fn(),
    getRegulatoryCompliance: jest.fn(),
    getInstitution: jest.fn(),
  } as any;
  const mockStressTesting = {
    runFullStressTest: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    service = new ReportsService(mockAlmEnterprise, mockStressTesting);

    mockAlmEnterprise.getALMSummary.mockResolvedValue(buildSummary());
    mockStressTesting.runFullStressTest.mockResolvedValue(buildStressTest());
    mockAlmEnterprise.getRegulatoryCompliance.mockResolvedValue(
      buildCompliance(),
    );
    mockAlmEnterprise.getInstitution.mockResolvedValue(buildInstitution());
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generateALMReport calls all data dependencies', async () => {
    await service.generateALMReport('inst-1', 'en');

    expect(mockAlmEnterprise.getALMSummary).toHaveBeenCalledWith('inst-1');
    expect(mockStressTesting.runFullStressTest).toHaveBeenCalledWith('inst-1', {
      paths: 500,
      horizon: 12,
    });
    expect(mockAlmEnterprise.getRegulatoryCompliance).toHaveBeenCalledWith(
      'inst-1',
    );
    expect(mockAlmEnterprise.getInstitution).toHaveBeenCalledWith('inst-1');
  });

  it('generateALMReport returns a Buffer on success', async () => {
    const result = await service.generateALMReport('inst-1');

    expect(Buffer.isBuffer(result)).toBe(true);
  });

  it('routes risk score, top risks, stress facts, and recommendations into the report sections', async () => {
    const summary = buildSummary();
    const stressTest = buildStressTest();
    mockAlmEnterprise.getALMSummary.mockResolvedValue(summary);
    mockStressTesting.runFullStressTest.mockResolvedValue(stressTest);
    const { execSpy, stressSpy, recommendationsSpy } =
      stubRenderPipeline(service);

    await service.generateALMReport('inst-1', 'en');

    expect(execSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        riskScore: 61,
        durationGap: expect.objectContaining({
          durationGap: 2.3,
          riskProfile: 'asset-sensitive',
        }),
        liquidity: expect.objectContaining({
          lcr: 96,
          status: 'warning',
        }),
        topRisks: summary.topRisks,
      }),
    );
    expect(stressSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        regulatory: expect.objectContaining({
          scenarios: expect.arrayContaining([
            expect.objectContaining({
              name: 'Same-Day -7%',
              niImpact: -4.9,
              passFailStatus: 'fail',
            }),
          ]),
        }),
      }),
      expect.objectContaining({
        recommendations: summary.recommendations,
      }),
    );
    expect(recommendationsSpy.mock.calls[0][1].recommendations).toEqual(
      summary.recommendations,
    );
  });

  it('includes the regulatory section for cooperativas and skips it for non-coop institutions', async () => {
    const { regulatorySpy } = stubRenderPipeline(service);

    await service.generateALMReport('inst-1', 'en');
    expect(regulatorySpy).toHaveBeenCalledTimes(1);

    jest.restoreAllMocks();
    service = new ReportsService(mockAlmEnterprise, mockStressTesting);
    mockAlmEnterprise.getALMSummary.mockResolvedValue(
      buildSummary({
        institution: {
          ...buildSummary().institution,
          type: 'community_bank',
        },
      }),
    );
    mockAlmEnterprise.getInstitution.mockResolvedValue(
      buildInstitution({
        type: 'community_bank',
        primaryRegulator: 'FDIC',
      }),
    );
    const nonCoopSpies = stubRenderPipeline(service);

    await service.generateALMReport('inst-1', 'en');
    expect(nonCoopSpies.regulatorySpy).not.toHaveBeenCalled();
  });

  it('uses Spanish section headers without changing the underlying risk facts', async () => {
    const summary = buildSummary();
    const originalRenderSectionHeader = (
      service as any
    ).renderSectionHeader.bind(service);
    const sectionHeaderSpy = jest
      .spyOn(service as any, 'renderSectionHeader')
      .mockImplementation((...args: unknown[]) =>
        originalRenderSectionHeader(...args),
      );
    const execSpy = jest.spyOn(service as any, 'renderExecutiveSummary');

    await service.generateALMReport('inst-1', 'es');

    expect(sectionHeaderSpy).toHaveBeenCalledWith(
      expect.anything(),
      '5',
      'PRUEBAS DE ESTRÉS',
      'Simulación Monte Carlo y escenarios regulatorios',
    );
    expect(sectionHeaderSpy).toHaveBeenCalledWith(
      expect.anything(),
      '7',
      'RECOMENDACIONES',
      'Estrategias de mitigación de riesgo',
    );
    expect(execSpy).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({
        riskScore: summary.riskScore,
        topRisks: summary.topRisks,
      }),
    );
  });

  it('accepts the watermark option without changing report dependencies', async () => {
    await service.generateALMReport('inst-1', 'en', { watermark: 'SAMPLE' });

    expect(mockAlmEnterprise.getALMSummary).toHaveBeenCalledWith('inst-1');
    expect(mockStressTesting.runFullStressTest).toHaveBeenCalledTimes(1);
  });
});
