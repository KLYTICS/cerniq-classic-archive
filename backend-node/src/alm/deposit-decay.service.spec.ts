import { DepositDecayService } from './deposit-decay.service';

describe('DepositDecayService', () => {
  let service: DepositDecayService;

  const mockPrisma = {} as any;

  beforeEach(() => {
    service = new DepositDecayService(mockPrisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Exponential Decay Model ────────────────────────────────

  it('should return all five NMD product types in the demo analysis', async () => {
    const result = await service.analyzeDecay('inst-1');

    expect(result.products).toHaveLength(5);
    const names = result.products.map((p) => p.name);
    expect(names).toContain('Regular Savings');
    expect(names).toContain('Share Accounts');
    expect(names).toContain('Money Market');
    expect(names).toContain('Checking/Draft');
    expect(names).toContain('Club Accounts');
  });

  it('should compute half-life correctly as ln(2) / decay_rate', async () => {
    const result = await service.analyzeDecay('inst-1');

    for (const product of result.products) {
      const expectedHalfLife = Math.log(2) / product.decayRate;
      expect(product.halfLife).toBeCloseTo(expectedHalfLife, 1);
    }
  });

  it('should compute behavioral maturity (WAL) as 1 / decay_rate', async () => {
    const result = await service.analyzeDecay('inst-1');

    for (const product of result.products) {
      const expectedWAL = 1 / product.decayRate;
      expect(product.behavioralMaturity).toBeCloseTo(expectedWAL, 1);
    }
  });

  it('should generate survival curve with correct exponential decay at year 0 and year 1', async () => {
    const result = await service.analyzeDecay('inst-1');

    for (const product of result.products) {
      // Year 0: 100% survival
      expect(product.survivalCurve[0].pctRemaining).toBeCloseTo(100, 0);
      expect(product.survivalCurve[0].balance).toBeCloseTo(product.balance, 0);

      // Year 1: e^(-lambda) * 100
      const expectedPctY1 = Math.exp(-product.decayRate * 1) * 100;
      expect(product.survivalCurve[1].pctRemaining).toBeCloseTo(expectedPctY1, 0);
    }
  });

  it('should produce survival curve spanning years 0 through 10', async () => {
    const result = await service.analyzeDecay('inst-1');

    for (const product of result.products) {
      expect(product.survivalCurve).toHaveLength(11); // 0..10
      expect(product.survivalCurve[0].year).toBe(0);
      expect(product.survivalCurve[10].year).toBe(10);
    }
  });

  it('should compute portfolio weighted average life as balance-weighted average of product WALs', async () => {
    const result = await service.analyzeDecay('inst-1');

    const totalBalance = result.products.reduce((s, p) => s + p.balance, 0);
    const expectedWAL =
      result.products.reduce((s, p) => s + p.balance * p.behavioralMaturity, 0) / totalBalance;

    expect(result.portfolioWeightedLife).toBeCloseTo(expectedWAL, 1);
  });

  it('should classify core deposits as those with behavioral maturity > 1 year', async () => {
    const result = await service.analyzeDecay('inst-1');

    // All products except Checking/Draft (lambda=0.22, WAL=4.55yr) should have WAL > 1yr
    // Even Checking at lambda=0.22 has WAL = 1/0.22 = 4.55 > 1
    // So all products should be core => stableCorePct should be 100
    const allAbove1yr = result.products.every((p) => p.behavioralMaturity > 1);
    if (allAbove1yr) {
      expect(result.stableCorePct).toBeCloseTo(100, 0);
    } else {
      expect(result.stableCorePct).toBeGreaterThan(0);
      expect(result.stableCorePct).toBeLessThanOrEqual(100);
    }
  });

  it('should include both English and Spanish product names', async () => {
    const result = await service.analyzeDecay('inst-1');

    const savings = result.products.find((p) => p.name === 'Regular Savings');
    expect(savings).toBeDefined();
    expect(savings!.nameEs).toBe('Ahorro Regular');
  });
});
