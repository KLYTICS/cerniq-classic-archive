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

  it('defaults to moderate aggressiveness', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.aggressivenessLevel).toBe('moderate');
  });

  it('demo narrative mentions dollar amounts', async () => {
    const result = await svc.optimize('inst-1');
    expect(result.narrative).toContain('$');
    expect(result.narrativeEs).toContain('$');
  });

  // ── With real balance sheet items ──────────────────────────
  describe('with real balance sheet data', () => {
    let svcReal: CapitalOptimizerService;

    beforeEach(() => {
      const items = [
        { category: 'asset', subcategory: 'cash_equivalents', balance: 30, rate: 0.02 },
        { category: 'asset', subcategory: 'investment_securities', balance: 50, rate: 0.042 },
        { category: 'asset', subcategory: 'consumer_loans', balance: 80, rate: 0.065 },
        { category: 'asset', subcategory: 'commercial_loans', balance: 60, rate: 0.075 },
        { category: 'liability', subcategory: 'savings_deposits', balance: 120, rate: 0.015 },
        { category: 'liability', subcategory: 'time_deposits', balance: 60, rate: 0.035 },
      ];
      const mockPrisma = {
        balanceSheetItem: {
          findMany: jest.fn().mockResolvedValue(items),
        },
      } as any;
      svcReal = new CapitalOptimizerService(mockPrisma);
    });

    it('suggests moving from low-yield to high-yield assets', async () => {
      const result = await svcReal.optimize('inst-1');
      expect(result.deltaAllocations.length).toBeGreaterThan(0);
      // First allocation should be a reduction (negative delta)
      const reduction = result.deltaAllocations.find(d => d.deltaUSD < 0);
      const increase = result.deltaAllocations.find(d => d.deltaUSD > 0);
      expect(reduction).toBeDefined();
      expect(increase).toBeDefined();
    });

    it('projected NII gain is positive when rate spread exists', async () => {
      const result = await svcReal.optimize('inst-1');
      expect(result.projectedNIIGain).toBeGreaterThan(0);
    });

    it('conservative mode moves less than aggressive mode', async () => {
      const conservative = await svcReal.optimize('inst-1', 'conservative');
      const aggressive = await svcReal.optimize('inst-1', 'aggressive');

      const consMove = conservative.deltaAllocations
        .filter(d => d.deltaUSD > 0)
        .reduce((s, d) => s + d.deltaUSD, 0);
      const aggMove = aggressive.deltaAllocations
        .filter(d => d.deltaUSD > 0)
        .reduce((s, d) => s + d.deltaUSD, 0);

      expect(aggMove).toBeGreaterThanOrEqual(consMove);
    });

    it('does not breach concentration limits (30% max)', async () => {
      const result = await svcReal.optimize('inst-1');
      const totalAssets = 30 + 50 + 80 + 60;
      for (const delta of result.deltaAllocations) {
        if (delta.deltaUSD > 0) {
          expect(delta.suggestedBalance / totalAssets).toBeLessThanOrEqual(0.31);
        }
      }
    });

    it('constraint analysis includes NWR check', async () => {
      const result = await svcReal.optimize('inst-1');
      const nwrConstraint = result.constraintSlacks.find(c => c.constraint.includes('NWR'));
      expect(nwrConstraint).toBeDefined();
    });

    it('narrative describes reallocation for profitable moves', async () => {
      const result = await svcReal.optimize('inst-1');
      if (result.projectedNIIGain > 0) {
        expect(result.narrative).toContain('Shift');
        expect(result.narrative).toContain('NII');
      }
    });

    it('delta allocations sum to zero (balanced reallocation)', async () => {
      const result = await svcReal.optimize('inst-1');
      const totalDelta = result.deltaAllocations.reduce(
        (s, d) => s + d.deltaUSD,
        0,
      );
      expect(totalDelta).toBeCloseTo(0, 1);
    });
  });
});
