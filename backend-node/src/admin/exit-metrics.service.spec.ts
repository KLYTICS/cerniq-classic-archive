import { ExitMetricsService } from './exit-metrics.service';

describe('ExitMetricsService', () => {
  let service: ExitMetricsService;
  const mockPrisma = {
    institution: { count: jest.fn().mockResolvedValue(10) },
    user: { count: jest.fn().mockResolvedValue(50) },
  };

  beforeEach(() => {
    service = new ExitMetricsService(mockPrisma as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getExitMetrics returns revenue metrics based on institution count', async () => {
    const result = await service.getExitMetrics();
    expect(result.activeInstitutions).toBe(10);
    expect(result.mrr).toBe(35000); // 10 * 3500
    expect(result.arr).toBe(420000); // 35000 * 12
    expect(result.impliedValuation.at10x).toBe(4200000);
  });

  it('getExitMetrics computes LTV/CAC ratio', async () => {
    const result = await service.getExitMetrics();
    expect(result.ltvCacRatio).toBeGreaterThan(0);
    expect(result.lifetimeValue).toBeGreaterThan(
      result.customerAcquisitionCost,
    );
    expect(typeof result.paybackPeriodMonths).toBe('number');
  });

  it('getExitMetrics includes acquirer scenarios', async () => {
    const result = await service.getExitMetrics();
    expect(result.acquirerScenarios.length).toBeGreaterThanOrEqual(4);
    for (const scenario of result.acquirerScenarios) {
      expect(scenario).toHaveProperty('acquirer');
      expect(scenario).toHaveProperty('thesis');
      expect(scenario).toHaveProperty('valuationRange');
    }
  });

  it('getExitReadinessChecklist returns items and overall readiness', () => {
    const result = service.getExitReadinessChecklist();
    expect(result.items.length).toBeGreaterThan(0);
    expect(result.overallReadiness).toBeGreaterThanOrEqual(0);
    expect(result.overallReadiness).toBeLessThanOrEqual(100);
    for (const item of result.items) {
      expect(['complete', 'in_progress', 'not_started']).toContain(item.status);
    }
  });

  it('exit readiness covers all categories', () => {
    const result = service.getExitReadinessChecklist();
    const categories = new Set(result.items.map((i) => i.category));
    expect(categories.has('Financial')).toBe(true);
    expect(categories.has('Product')).toBe(true);
    expect(categories.has('Technical')).toBe(true);
    expect(categories.has('IP')).toBe(true);
  });
});
