import {
  SectorRotationService,
  SectorRotationParams,
} from './sector-rotation.service';

// ─── Helpers ────────────────────────────────────────────────────

function baseParams(): SectorRotationParams {
  return {
    sectors: [
      {
        name: 'Treasuries',
        currentWeight: 0.4,
        targetWeight: 0.35,
        yield: 0.04,
        duration: 5.0,
      },
      {
        name: 'Corporates',
        currentWeight: 0.25,
        targetWeight: 0.3,
        yield: 0.055,
        duration: 6.5,
      },
      {
        name: 'MBS',
        currentWeight: 0.2,
        targetWeight: 0.2,
        yield: 0.045,
        duration: 4.0,
      },
      {
        name: 'Munis',
        currentWeight: 0.15,
        targetWeight: 0.15,
        yield: 0.035,
        duration: 7.0,
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('SectorRotationService', () => {
  let service: SectorRotationService;

  beforeEach(() => {
    service = new SectorRotationService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Produces correct action types
  it('assigns BUY, SELL, and HOLD actions correctly', () => {
    const result = service.analyzeSectorRotation(baseParams());
    const actions = Object.fromEntries(
      result.rebalancingActions.map((a) => [a.sector, a.action]),
    );
    expect(actions['Treasuries']).toBe('SELL');
    expect(actions['Corporates']).toBe('BUY');
    expect(actions['MBS']).toBe('HOLD');
    expect(actions['Munis']).toBe('HOLD');
  });

  // 2. Turnover is half the sum of absolute weight changes
  it('calculates turnover as half the absolute weight change sum', () => {
    const result = service.analyzeSectorRotation(baseParams());
    // |−0.05| + |+0.05| + 0 + 0 = 0.10, turnover = 0.05
    expect(result.turnover).toBeCloseTo(0.05, 4);
  });

  // 3. Duration impact reflects the rebalance
  it('computes duration impact from weight shift', () => {
    const result = service.analyzeSectorRotation(baseParams());
    // Moving from Treasuries (dur 5) to Corporates (dur 6.5) increases duration
    expect(result.durationImpact).toBeGreaterThan(0);
  });

  // 4. Yield impact reflects the rebalance
  it('computes yield impact from weight shift', () => {
    const result = service.analyzeSectorRotation(baseParams());
    // Moving from Treasuries (4%) to Corporates (5.5%) increases yield
    expect(result.yieldImpact).toBeGreaterThan(0);
  });

  // 5. Zero-drift portfolio has no rebalancing
  it('produces HOLD for all sectors when weights match targets', () => {
    const params: SectorRotationParams = {
      sectors: baseParams().sectors.map((s) => ({
        ...s,
        targetWeight: s.currentWeight,
      })),
    };
    const result = service.analyzeSectorRotation(params);
    for (const a of result.rebalancingActions) {
      expect(a.action).toBe('HOLD');
    }
    expect(result.turnover).toBe(0);
  });

  // 6. Action amounts are positive absolute values
  it('action amounts are non-negative', () => {
    const result = service.analyzeSectorRotation(baseParams());
    for (const a of result.rebalancingActions) {
      expect(a.amount).toBeGreaterThanOrEqual(0);
    }
  });
});
