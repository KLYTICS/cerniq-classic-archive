import { ApiV1Service } from './api-v1.service';

describe('ApiV1Service', () => {
  let service: ApiV1Service;
  const mockPrisma = {
    workspace: { create: jest.fn() },
    analysisRun: {
      create: jest.fn(),
      findFirst: jest.fn(),
    },
  } as any;
  const mockAlmEnterprise = {
    createInstitution: jest.fn(),
    importBalanceSheetItems: jest.fn(),
    getCOSSECCompliance: jest.fn(),
    getALMSummary: jest.fn(),
  } as any;
  const mockAlmService = {} as any;
  const mockCsvIngestion = {
    parseCSV: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new ApiV1Service(
      mockPrisma,
      mockAlmEnterprise,
      mockAlmService,
      mockCsvIngestion,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getBenchmarks returns sector benchmarks object', () => {
    const benchmarks = service.getBenchmarks();
    expect(benchmarks).toBeDefined();
    expect(typeof benchmarks).toBe('object');
  });

  it('getFrameworks returns array of supported frameworks', () => {
    const frameworks = service.getFrameworks();
    expect(frameworks).toHaveLength(2);
    expect(frameworks[0].id).toBe('cossec');
    expect(frameworks[1].id).toBe('ncua');
    expect(frameworks[0].supportedInstitutionTypes).toContain('cooperativa');
  });

  it('getAnalysis throws NotFoundException when not found', async () => {
    mockPrisma.analysisRun.findFirst.mockResolvedValue(null);
    await expect(service.getAnalysis('user-1', 'bad-id')).rejects.toThrow();
  });

  it('getAnalysis returns analysis when found', async () => {
    mockPrisma.analysisRun.findFirst.mockResolvedValue({
      id: 'run-1',
      status: 'COMPLETED',
      analysisType: 'api_full_analysis',
      triggeredBy: 'public_api',
      parameterSnapshot: {},
      resultSummary: { compliance: {} },
      errorMessage: null,
      createdAt: new Date('2026-01-01'),
      completedAt: new Date('2026-01-01'),
      institution: {
        id: 'inst-1',
        name: 'Test',
        type: 'cooperativa',
        totalAssets: 100,
        currency: 'USD',
        reportingDate: new Date('2026-01-31'),
      },
    });
    const result = await service.getAnalysis('user-1', 'run-1');
    expect(result.analysisId).toBe('run-1');
    expect(result.status).toBe('COMPLETED');
    expect(result.institution.name).toBe('Test');
  });

  it('analyzeFromCSV throws BadRequestException on invalid CSV', async () => {
    mockCsvIngestion.parseCSV.mockReturnValue({
      valid: false,
      errors: ['Missing required column'],
      summary: {},
      items: [],
    });
    await expect(
      service.analyzeFromCSV(
        'user-1',
        'bad,csv',
        'Test',
        'cooperativa',
        'cossec',
        'Q1-2026',
      ),
    ).rejects.toThrow();
  });
});
