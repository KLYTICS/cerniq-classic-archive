import { CapitalOptimizerService } from './capital-optimizer.service';

describe('CapitalOptimizerService', () => {
  let svc: CapitalOptimizerService;

  beforeEach(() => {
    const mockPrisma = {
      balanceSheetItem: {
        findMany: jest.fn().mockResolvedValue([]),
      },
    } as any;
    svc = new CapitalOptimizerService(mockPrisma);
  });

  it('should return demo result when no items exist', async () => {
    const result = await svc.optimize('inst-1');
    expect(result).toHaveProperty('deltaAllocations');
    expect(result).toHaveProperty('projectedNIIGain');
    expect(result).toHaveProperty('projectedNIIGainPct');
    expect(result).toHaveProperty('constraintSlacks');
    expect(result).toHaveProperty('aggressivenessLevel');
    expect(result).toHaveProperty('narrative');
    expect(result).toHaveProperty('narrativeEs');
  });

  it('should respect aggressiveness level in demo result', async () => {
    const conservative = await svc.optimize('inst-1', 'conservative');
    expect(conservative.aggressivenessLevel).toBe('conservative');

    const aggressive = await svc.optimize('inst-1', 'aggressive');
    expect(aggressive.aggressivenessLevel).toBe('aggressive');
  });

  it('should have non-negative NII gain in demo result', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.projectedNIIGain).toBeGreaterThanOrEqual(0);
    expect(result.projectedNIIGainPct).toBeGreaterThanOrEqual(0);
  });

  it('should produce balanced delta allocations (sum to zero)', async () => {
    const result = await svc.optimize('inst-1');
    const totalDelta = result.deltaAllocations.reduce(
      (s, d) => s + d.deltaUSD,
      0,
    );
    expect(totalDelta).toBeCloseTo(0, 1);
  });

  it('should compute correct constraint slacks in demo', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.constraintSlacks.length).toBeGreaterThan(0);
    for (const cs of result.constraintSlacks) {
      expect(cs).toHaveProperty('constraint');
      expect(cs).toHaveProperty('currentValue');
      expect(cs).toHaveProperty('limit');
      expect(cs).toHaveProperty('slack');
      expect(cs).toHaveProperty('binding');
    }
  });
});
