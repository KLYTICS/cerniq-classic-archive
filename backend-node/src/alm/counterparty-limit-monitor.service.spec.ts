import {
  CounterpartyLimitMonitorService,
  CounterpartyLimitParams,
} from './counterparty-limit-monitor.service';

// ─── Helpers ────────────────────────────────────────────────────

function mixedParams(): CounterpartyLimitParams {
  return {
    exposures: [
      {
        counterparty: 'Bank A',
        amount: 12_000_000,
        limit: 10_000_000,
        rating: 'AA',
      }, // breach
      {
        counterparty: 'Bank B',
        amount: 8_500_000,
        limit: 10_000_000,
        rating: 'A',
      }, // warning
      {
        counterparty: 'Bank C',
        amount: 5_000_000,
        limit: 10_000_000,
        rating: 'AAA',
      }, // OK
      {
        counterparty: 'Bank D',
        amount: 9_200_000,
        limit: 10_000_000,
        rating: 'BBB',
      }, // warning
    ],
  };
}

function compliantParams(): CounterpartyLimitParams {
  return {
    exposures: [
      {
        counterparty: 'Bank X',
        amount: 3_000_000,
        limit: 10_000_000,
        rating: 'AA',
      },
      {
        counterparty: 'Bank Y',
        amount: 2_000_000,
        limit: 10_000_000,
        rating: 'A',
      },
    ],
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('CounterpartyLimitMonitorService', () => {
  let service: CounterpartyLimitMonitorService;

  beforeEach(() => {
    service = new CounterpartyLimitMonitorService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Detects breaches correctly
  it('identifies counterparties that exceed their limits', () => {
    const result = service.checkLimits(mixedParams());
    expect(result.breaches).toHaveLength(1);
    expect(result.breaches[0].counterparty).toBe('Bank A');
    expect(result.breaches[0].utilization).toBeGreaterThan(1);
  });

  // 2. Detects warnings correctly
  it('identifies counterparties approaching limits (> 80%)', () => {
    const result = service.checkLimits(mixedParams());
    expect(result.warnings).toHaveLength(2);
    const names = result.warnings.map((w) => w.counterparty);
    expect(names).toContain('Bank B');
    expect(names).toContain('Bank D');
  });

  // 3. Compliant when no breaches
  it('sets compliant to true when no breaches exist', () => {
    const result = service.checkLimits(compliantParams());
    expect(result.compliant).toBe(true);
    expect(result.breaches).toHaveLength(0);
  });

  // 4. Non-compliant when breaches exist
  it('sets compliant to false when breaches exist', () => {
    const result = service.checkLimits(mixedParams());
    expect(result.compliant).toBe(false);
  });

  // 5. Total exposure is sum of all amounts
  it('calculates total exposure as sum of all counterparty amounts', () => {
    const params = mixedParams();
    const expected = params.exposures.reduce((s, e) => s + e.amount, 0);
    const result = service.checkLimits(params);
    expect(result.totalExposure).toBeCloseTo(expected, 2);
  });

  // 6. Breaches sorted by utilisation descending
  it('sorts breaches by utilisation descending', () => {
    const params: CounterpartyLimitParams = {
      exposures: [
        {
          counterparty: 'A',
          amount: 15_000_000,
          limit: 10_000_000,
          rating: 'BB',
        },
        {
          counterparty: 'B',
          amount: 20_000_000,
          limit: 10_000_000,
          rating: 'B',
        },
      ],
    };
    const result = service.checkLimits(params);
    expect(result.breaches[0].counterparty).toBe('B');
    expect(result.breaches[1].counterparty).toBe('A');
  });

  // 7. Aggregate utilisation
  it('aggregate utilisation reflects total exposure vs total limits', () => {
    const utilization = service.aggregateUtilization(compliantParams());
    // (3M + 2M) / (10M + 10M) = 0.25
    expect(utilization).toBeCloseTo(0.25, 2);
  });
});
