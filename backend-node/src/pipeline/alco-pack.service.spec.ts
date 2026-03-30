type Listener = (...args: any[]) => void;

const createdDocs: FakePDFDocument[] = [];

class FakePDFDocument {
  readonly texts: string[] = [];
  readonly fills: string[] = [];
  readonly strokeColors: string[] = [];
  pageCount = 1;
  private readonly listeners: Record<string, Listener[]> = {
    data: [],
    end: [],
    error: [],
  };

  on(event: string, listener: Listener) {
    this.listeners[event] ??= [];
    this.listeners[event].push(listener);
    return this;
  }

  rect() {
    return this;
  }

  fill(color?: string) {
    if (typeof color === 'string') {
      this.fills.push(color);
    }
    return this;
  }

  font() {
    return this;
  }

  fontSize() {
    return this;
  }

  text(value: unknown) {
    this.texts.push(String(value));
    return this;
  }

  moveTo() {
    return this;
  }

  lineTo() {
    return this;
  }

  strokeColor(color?: string) {
    if (typeof color === 'string') {
      this.strokeColors.push(color);
    }
    return this;
  }

  lineWidth() {
    return this;
  }

  stroke() {
    return this;
  }

  circle() {
    return this;
  }

  addPage() {
    this.pageCount += 1;
    return this;
  }

  heightOfString(value: unknown) {
    return Math.max(16, Math.ceil(String(value).length / 48) * 12);
  }

  end() {
    const chunk = Buffer.from('fake-pdf-pack');
    for (const listener of this.listeners.data) {
      listener(chunk);
    }
    for (const listener of this.listeners.end) {
      listener();
    }
    return this;
  }
}

jest.mock('pdfkit', () =>
  jest.fn().mockImplementation(() => {
    const doc = new FakePDFDocument();
    createdDocs.push(doc);
    return doc;
  }),
);

import { AlcoPackService } from './alco-pack.service';

describe('AlcoPackService', () => {
  let service: AlcoPackService;
  const mockAlmEnterprise = {
    getCOSSECCompliance: jest.fn(),
    getALMSummary: jest.fn(),
    getInstitution: jest.fn(),
  } as any;
  const mockStressTesting = {
    runFullStressTest: jest.fn(),
  } as any;
  const mockPrisma = {} as any;

  const makeInstitution = (overrides: Record<string, unknown> = {}) => ({
    id: 'inst-1',
    name: 'Test Coop',
    type: 'cooperativa',
    currency: 'USD',
    totalAssets: 250,
    ...overrides,
  });

  const makeCOSSEC = (overrides: Record<string, unknown> = {}) => ({
    ratios: [
      {
        id: 1,
        name: 'Capital Adequacy',
        nameEs: 'Adecuacion de Capital',
        value: 9.2,
        unit: '%',
        threshold: '>= 8.0%',
        status: 'pass',
        sectorMedian: 8.8,
        percentileRank: 82,
      },
      {
        id: 2,
        name: 'Asset Quality',
        nameEs: 'Calidad de Activos',
        value: 1.8,
        unit: '%',
        threshold: '<= 3.0%',
        status: 'info',
        sectorMedian: 2.1,
        percentileRank: 74,
      },
      {
        id: 3,
        name: 'Duration Gap',
        nameEs: 'Brecha de Duracion',
        value: 1.4,
        unit: 'yr',
        threshold: '-1 to +3 yr',
        status: 'warning',
        percentileRank: 48,
      },
      {
        id: 4,
        name: 'Exam Score',
        nameEs: 'Puntaje de Examen',
        value: 88,
        unit: 'score',
        threshold: '>= 80',
        status: 'pass',
      },
      {
        id: 5,
        name: 'Narrative Watchlist',
        nameEs: 'Lista de Observacion',
        value: 'Review',
        unit: 'text',
        threshold: 'Board review',
        status: 'fail',
      },
    ],
    overallStatus: 'conditional',
    examReadinessScore: 78,
    summary: {
      capitalRatio: 6.8,
      totalAssets: 245.5,
      totalLiabilities: 221.1,
      equity: 24.4,
      loanToShareRatio: 86,
      liquidityRatio: 16.5,
      nim: 2.3,
      earningAssetsYield: 5.4,
      costOfFunds: 3.1,
      pass: 9,
      fail: 3,
    },
    ...overrides,
  });

  const makeSummary = (overrides: Record<string, unknown> = {}) => ({
    institution: { name: 'Test Coop' },
    durationGap: {
      durationGap: 1.9,
      assetDuration: 3.8,
      liabilityDuration: 1.9,
    },
    niiSensitivity: {
      baseNII: 12.2,
      up100: -2.5,
      riskRating: 'moderate',
      scenarios: [
        {
          name: '+100 bps',
          shiftBps: 100,
          niImpact: -1.5,
          niImpactPct: -12.3,
          mveImpact: -4.2,
          mveImpactPct: -9.8,
        },
        {
          name: '-100 bps',
          shiftBps: -100,
          niImpact: 1.1,
          niImpactPct: 9.2,
          mveImpact: 3.6,
          mveImpactPct: 7.4,
        },
      ],
    },
    liquidity: {
      status: 'warning',
      lcr: 110,
      hqla: 44,
      netOutflows: 40,
      buffer: 10,
    },
    recommendations: [
      'Reduce duration mismatch before the next ALCO review.',
      'Tighten deposit runoff assumptions for severe scenarios.',
      'Refresh contingency funding triggers and owners.',
    ],
    ...overrides,
  });

  const makeStressTest = (overrides: Record<string, unknown> = {}) => ({
    regulatory: {
      overallRating: 'vulnerable',
      scenarios: [
        {
          name: '-7% same-day market down',
          niImpact: -2.9,
          mveImpact: -6.1,
          lcrImpact: 94,
          capitalImpact: 6.4,
          passFailStatus: 'warn',
        },
        {
          name: 'Deposit flight',
          niImpact: -3.8,
          mveImpact: -4.4,
          lcrImpact: 88,
          capitalImpact: 5.9,
          passFailStatus: 'fail',
        },
      ],
    },
    monteCarlo: {
      paths: 500,
      horizon: 12,
      expectedNII: 11.7,
      worstCaseNII: 8.4,
      niiAtRisk: 3.3,
      var95: -5.2,
    },
    ...overrides,
  });

  beforeEach(() => {
    jest.clearAllMocks();
    createdDocs.length = 0;

    service = new AlcoPackService(
      mockAlmEnterprise,
      mockStressTesting,
      mockPrisma,
    );

    mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(makeCOSSEC());
    mockAlmEnterprise.getALMSummary.mockResolvedValue(makeSummary());
    mockStressTesting.runFullStressTest.mockResolvedValue(makeStressTest());
    mockAlmEnterprise.getInstitution.mockResolvedValue(makeInstitution());
  });

  it('renders an English conditional ALCO pack with quant stress and Monte Carlo content', async () => {
    const result = await service.buildALCOPack('inst-1', 'en');
    const doc = createdDocs.at(-1);
    const rendered = doc?.texts.join('\n') ?? '';

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(result.length).toBeGreaterThan(0);
    expect(mockAlmEnterprise.getCOSSECCompliance).toHaveBeenCalledWith(
      'inst-1',
    );
    expect(mockAlmEnterprise.getALMSummary).toHaveBeenCalledWith('inst-1');
    expect(mockStressTesting.runFullStressTest).toHaveBeenCalledWith('inst-1', {
      paths: 500,
      horizon: 12,
    });
    expect(mockAlmEnterprise.getInstitution).toHaveBeenCalledWith('inst-1');

    expect(doc).toBeDefined();
    expect(doc?.pageCount).toBe(8);
    expect(rendered).toContain('ALCO MEETING PACK');
    expect(rendered).toContain('CONDITIONAL — Attention Required');
    expect(rendered).toContain('RATE RISK ANALYSIS');
    expect(rendered).toContain('LIQUIDITY POSITION');
    expect(rendered).toContain('STRESS TEST SUMMARY');
    expect(rendered).toContain('MONTE CARLO SIMULATION');
    expect(rendered).toContain('Review');
    expect(rendered).toContain('WARN');
    expect(rendered).toContain('FAIL');
  });

  it('renders a Spanish compliant pack with default recommendations and no stress appendices', async () => {
    mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(
      makeCOSSEC({
        overallStatus: 'compliant',
        examReadinessScore: 92,
        ratios: [
          {
            id: 1,
            name: 'Capital Adequacy',
            nameEs: 'Adecuacion de Capital',
            value: 10.2,
            unit: '%',
            threshold: '>= 8.0%',
            status: 'pass',
          },
        ],
        summary: {
          capitalRatio: 10.2,
          totalAssets: 310,
          totalLiabilities: 270,
          equity: 40,
          loanToShareRatio: 70,
          liquidityRatio: 22,
          nim: 3.4,
          earningAssetsYield: 6.1,
          costOfFunds: 2.7,
          pass: 12,
          fail: 0,
        },
      }),
    );
    mockAlmEnterprise.getALMSummary.mockResolvedValue(
      makeSummary({
        durationGap: {
          durationGap: 0.6,
          assetDuration: 2.4,
          liabilityDuration: 1.8,
        },
        niiSensitivity: {
          baseNII: 14.8,
          up100: -0.8,
          riskRating: 'low',
        },
        liquidity: {
          status: 'compliant',
          lcr: 132,
          hqla: 62,
          netOutflows: 47,
          buffer: 32,
        },
        recommendations: [],
      }),
    );
    mockStressTesting.runFullStressTest.mockResolvedValue({});
    mockAlmEnterprise.getInstitution.mockResolvedValue(
      makeInstitution({
        type: undefined,
        currency: undefined,
      }),
    );

    const result = await service.buildALCOPack('inst-es', 'es');
    const doc = createdDocs.at(-1);
    const rendered = doc?.texts.join('\n') ?? '';

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(doc?.pageCount).toBe(8);
    expect(rendered).toContain('PAQUETE ALCO');
    expect(rendered).toContain('CUMPLE — Listo para Examen COSSEC');
    expect(rendered).toContain('POSICION DE LIQUIDEZ');
    expect(rendered).toContain('CUMPLE');
    expect(rendered).toContain(
      'No se identificaron acciones urgentes. Continuar monitoreando metricas trimestralmente.',
    );
    expect(rendered).toContain('Cooperativa | USD');
    expect(rendered).not.toContain('MONTE CARLO SIMULATION');
    expect(rendered).not.toContain('ESCENARIOS REGULATORIOS');
  });

  it('renders breach and failure narratives for severe non-compliant operator states', async () => {
    mockAlmEnterprise.getCOSSECCompliance.mockResolvedValue(
      makeCOSSEC({
        overallStatus: 'non-compliant',
        examReadinessScore: 41,
        ratios: [
          {
            id: 2,
            name: 'Asset Quality',
            nameEs: 'Calidad de Activos',
            value: 5.2,
            unit: '%',
            threshold: '<= 3.0%',
            status: 'fail',
          },
          {
            id: 6,
            name: 'Liquidity Coverage',
            nameEs: 'Cobertura de Liquidez',
            value: 91,
            unit: '%',
            threshold: '>= 100%',
            status: 'warning',
          },
        ],
        summary: {
          capitalRatio: 5.4,
          totalAssets: 200,
          totalLiabilities: 188,
          equity: 12,
          loanToShareRatio: 108,
          liquidityRatio: 12,
          nim: 1.7,
          earningAssetsYield: 4.9,
          costOfFunds: 3.8,
          pass: 4,
          fail: 8,
        },
      }),
    );
    mockAlmEnterprise.getALMSummary.mockResolvedValue(
      makeSummary({
        durationGap: {
          durationGap: 3.6,
          assetDuration: 5.2,
          liabilityDuration: 1.6,
        },
        niiSensitivity: {
          baseNII: 8.8,
          riskRating: 'high',
          scenarios: [
            {
              name: '+300 bps',
              shiftBps: 300,
              niImpact: -4.4,
              niImpactPct: -35.2,
              mveImpact: -7.9,
              mveImpactPct: -18.4,
            },
          ],
        },
        liquidity: {
          status: 'breach',
          lcr: 82,
          hqla: 18,
          netOutflows: 22,
          buffer: -18,
        },
        recommendations: [
          'Raise contingent liquidity immediately.',
          'Pause longer-duration originations until capital stabilizes.',
          'Escalate breach remediation to the board within 24 hours.',
          'Refresh deposit retention pricing.',
          'Re-run same-day -7% market stress with updated runoff assumptions.',
        ],
      }),
    );
    mockStressTesting.runFullStressTest.mockResolvedValue(
      makeStressTest({
        regulatory: {
          overallRating: 'fragile',
          scenarios: [
            {
              name: 'Capital breach',
              niImpact: -5.1,
              mveImpact: -8.4,
              lcrImpact: 79,
              capitalImpact: 4.9,
              passFailStatus: 'fail',
            },
          ],
        },
        monteCarlo: {
          paths: 1000,
          horizon: 12,
          expectedNII: 7.4,
          worstCaseNII: 3.1,
          niiAtRisk: 4.3,
        },
      }),
    );

    const result = await service.buildALCOPack('inst-risk', 'en');
    const doc = createdDocs.at(-1);
    const rendered = doc?.texts.join('\n') ?? '';

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(rendered).toContain('NON-COMPLIANT — Immediate Action');
    expect(rendered).toContain('BREACH');
    expect(rendered).toContain('HIGH');
    expect(rendered).toContain('Capital breach');
    expect(rendered).toContain('FRAGILE');
    expect(rendered).toContain('REVIEW');
    expect(doc?.fills).toEqual(
      expect.arrayContaining(['#DC2626', '#D97706', '#16A34A']),
    );
  });

  it('renders fallback operator placeholders and positive regulatory outcomes when optional fields are sparse', async () => {
    const result = await (service as any).generatePDF(
      makeInstitution({
        name: undefined,
        type: undefined,
        currency: undefined,
      }),
      makeCOSSEC({
        ratios: [],
        examReadinessScore: undefined,
        overallStatus: 'compliant',
        summary: {
          capitalRatio: 8.1,
          totalAssets: 150,
          totalLiabilities: 120,
          equity: 30,
          loanToShareRatio: 79,
          liquidityRatio: 21,
          nim: 3.1,
          earningAssetsYield: 5.8,
          costOfFunds: 2.5,
          pass: 8,
          fail: 0,
        },
      }),
      makeSummary({
        durationGap: {
          durationGap: -0.4,
          assetDuration: 0,
          liabilityDuration: 0,
        },
        niiSensitivity: {
          baseNII: 9.4,
          riskRating: 'low',
          scenarios: [],
        },
        liquidity: {
          status: 'compliant',
          lcr: 125,
          hqla: 30,
          netOutflows: 24,
          buffer: 25,
        },
        recommendations: ['Maintain current posture and document assumptions.'],
      }),
      {
        regulatory: {
          overallRating: 'adequate',
          scenarios: [
            {
              name: 'Base case',
              niImpact: 0.6,
              mveImpact: 0.3,
              lcrImpact: 126,
              capitalImpact: 8.4,
              passFailStatus: 'pass',
            },
          ],
        },
      },
      'en',
    );
    const doc = createdDocs.at(-1);
    const rendered = doc?.texts.join('\n') ?? '';

    expect(Buffer.isBuffer(result)).toBe(true);
    expect(rendered).toContain('Institution');
    expect(rendered).toContain('Cooperativa | USD');
    expect(rendered).toContain('0');
    expect(rendered).toContain('Gap: -0.40 yr');
    expect(rendered).toContain('ADEQUATE');
    expect(rendered).toContain('Base case');
    expect(rendered).toContain('PASS');
    expect(rendered).not.toContain('MONTE CARLO SIMULATION');
  });

  it('rejects the pack build when an upstream dependency fails', async () => {
    mockAlmEnterprise.getALMSummary.mockRejectedValue(
      new Error('summary unavailable'),
    );

    await expect(service.buildALCOPack('inst-1', 'en')).rejects.toThrow(
      'summary unavailable',
    );
    expect(createdDocs).toHaveLength(0);
  });
});
