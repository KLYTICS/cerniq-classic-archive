import { QuantSwarmService } from './quant-swarm.service';

describe('QuantSwarmService', () => {
  let service: QuantSwarmService;
  const mockPrisma = {} as any;

  const makeMockService = (result: any) => ({
    getYieldCurveAnalysis: jest.fn().mockResolvedValue(result),
    getAdvancedLiquidity: jest.fn().mockResolvedValue(result),
    getCECLAnalysis: jest.fn().mockResolvedValue(result),
    getConcentrationAnalysis: jest.fn().mockResolvedValue(result),
    getFTPAnalysis: jest.fn().mockResolvedValue(result),
    getPeerAnalytics: jest.fn().mockResolvedValue(result),
    scoreInstitution: jest.fn().mockResolvedValue(result),
    computeClimateRisk: jest.fn().mockResolvedValue(result),
    computeHealthScore: jest.fn().mockResolvedValue({ overall: 75 }),
  });

  beforeEach(() => {
    service = new QuantSwarmService(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('runFullSwarm returns results from all 8 models', async () => {
    const mockSvc = makeMockService({ score: 80 });
    const result = await service.runFullSwarm('inst-1', {
      yieldCurve: mockSvc,
      liquidity: mockSvc,
      cecl: mockSvc,
      concentration: mockSvc,
      ftp: mockSvc,
      peers: mockSvc,
      camel: mockSvc,
      climate: mockSvc,
      advisor: mockSvc,
    });
    expect(result.institutionId).toBe('inst-1');
    expect(result.completedModels).toHaveLength(8);
    expect(result.failedModels).toHaveLength(0);
    expect(result.healthScore).toBe(75);
    expect(result.computeTimeMs).toBeGreaterThanOrEqual(0);
  });

  it('handles partial model failures gracefully', async () => {
    const mockSvc = makeMockService({ score: 80 });
    const failingSvc = {
      ...mockSvc,
      getYieldCurveAnalysis: jest
        .fn()
        .mockRejectedValue(new Error('rate shock failed')),
    };
    const result = await service.runFullSwarm('inst-1', {
      yieldCurve: failingSvc,
      liquidity: mockSvc,
      cecl: mockSvc,
      concentration: mockSvc,
      ftp: mockSvc,
      peers: mockSvc,
      camel: mockSvc,
      climate: mockSvc,
      advisor: mockSvc,
    });
    expect(result.failedModels).toContain('rateShock');
    expect(result.completedModels).toHaveLength(7);
    expect(result.rateShock).toBeNull();
  });

  it('returns default health score of 50 when advisor fails', async () => {
    const mockSvc = makeMockService({ score: 80 });
    const failingAdvisor = {
      ...mockSvc,
      computeHealthScore: jest
        .fn()
        .mockRejectedValue(new Error('advisor down')),
    };
    const result = await service.runFullSwarm('inst-1', {
      yieldCurve: mockSvc,
      liquidity: mockSvc,
      cecl: mockSvc,
      concentration: mockSvc,
      ftp: mockSvc,
      peers: mockSvc,
      camel: mockSvc,
      climate: mockSvc,
      advisor: failingAdvisor,
    });
    expect(result.healthScore).toBe(50);
  });

  it('computeTimeMs is a positive number', async () => {
    const mockSvc = makeMockService({ score: 80 });
    const result = await service.runFullSwarm('inst-1', {
      yieldCurve: mockSvc,
      liquidity: mockSvc,
      cecl: mockSvc,
      concentration: mockSvc,
      ftp: mockSvc,
      peers: mockSvc,
      camel: mockSvc,
      climate: mockSvc,
      advisor: mockSvc,
    });
    expect(result.computeTimeMs).toBeGreaterThanOrEqual(0);
  });
});
