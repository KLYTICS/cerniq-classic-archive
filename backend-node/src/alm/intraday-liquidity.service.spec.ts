import {
  IntradayLiquidityService,
  IntradayLiquidityParams,
} from './intraday-liquidity.service';

// ─── Test fixtures ──────────────────────────────────────────────────

const BASE_PARAMS: IntradayLiquidityParams = {
  openingBalance: 10_000_000,
  expectedInflows: [
    { time: '09:00', amount: 5_000_000, description: 'ACH batch' },
    { time: '11:00', amount: 3_000_000, description: 'Wire transfer' },
    { time: '14:00', amount: 2_000_000, description: 'Loan payments' },
  ],
  expectedOutflows: [
    { time: '08:00', amount: 4_000_000, description: 'Fed settlement' },
    { time: '10:00', amount: 6_000_000, description: 'Wholesale payment' },
    { time: '13:00', amount: 3_000_000, description: 'Member withdrawals' },
    { time: '15:00', amount: 2_000_000, description: 'FHLB payment' },
  ],
};

describe('IntradayLiquidityService', () => {
  let svc: IntradayLiquidityService;

  beforeEach(() => {
    svc = new IntradayLiquidityService();
  });

  // ─── Test 1: Returns 10 hourly positions ─────────────────────────

  it('should return 10 hourly positions (08:00 through 17:00)', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    expect(result.hourlyPositions).toHaveLength(10);
    expect(result.hourlyPositions[0].time).toBe('08:00');
    expect(result.hourlyPositions[9].time).toBe('17:00');
  });

  // ─── Test 2: Opening balance feeds into first position ───────────

  it('should process the 08:00 outflow against the opening balance', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    const firstPos = result.hourlyPositions[0];
    // Opening 10M - 4M outflow = 6M
    expect(firstPos.balance).toBe(6_000_000);
    expect(firstPos.netFlow).toBe(-4_000_000);
  });

  // ─── Test 3: Peak usage computed correctly ───────────────────────

  it('should compute peak usage as the largest drawdown from opening', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    expect(result.peakUsage).toBeGreaterThanOrEqual(0);
    // The balance drops from 10M, so peak usage should reflect the lowest point
    const minBalance = Math.min(
      ...result.hourlyPositions.map((p) => p.balance),
    );
    expect(result.peakUsage).toBeCloseTo(10_000_000 - minBalance, 0);
  });

  // ─── Test 4: Minimum and maximum balance tracked ─────────────────

  it('should track minimum and maximum balance throughout the day', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    const balances = result.hourlyPositions.map((p) => p.balance);
    expect(result.minimumBalance).toBe(Math.min(...balances));
    expect(result.maximumBalance).toBeGreaterThanOrEqual(result.minimumBalance);
  });

  // ─── Test 5: No shortfall with sufficient opening balance ────────

  it('should report no shortfall when balance never goes negative', () => {
    const params: IntradayLiquidityParams = {
      openingBalance: 50_000_000,
      expectedInflows: [{ time: '09:00', amount: 10_000_000 }],
      expectedOutflows: [{ time: '10:00', amount: 5_000_000 }],
    };
    const result = svc.simulateIntradayLiquidity(params);
    expect(result.shortfallRisk).toBe(false);
    expect(result.shortfallPeriods).toHaveLength(0);
  });

  // ─── Test 6: Shortfall detected ──────────────────────────────────

  it('should detect shortfall when balance goes negative', () => {
    const params: IntradayLiquidityParams = {
      openingBalance: 1_000_000,
      expectedInflows: [{ time: '15:00', amount: 20_000_000 }],
      expectedOutflows: [{ time: '09:00', amount: 10_000_000 }],
    };
    const result = svc.simulateIntradayLiquidity(params);
    expect(result.shortfallRisk).toBe(true);
    expect(result.shortfallPeriods.length).toBeGreaterThan(0);
  });

  // ─── Test 7: Cumulative inflows tracked ──────────────────────────

  it('should track cumulative inflows across the day', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    const lastPos = result.hourlyPositions[result.hourlyPositions.length - 1];
    const totalInflows = BASE_PARAMS.expectedInflows.reduce(
      (s, f) => s + f.amount,
      0,
    );
    expect(lastPos.cumulativeInflows).toBe(totalInflows);
  });

  // ─── Test 8: Cumulative outflows tracked ─────────────────────────

  it('should track cumulative outflows across the day', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    const lastPos = result.hourlyPositions[result.hourlyPositions.length - 1];
    const totalOutflows = BASE_PARAMS.expectedOutflows.reduce(
      (s, f) => s + f.amount,
      0,
    );
    expect(lastPos.cumulativeOutflows).toBe(totalOutflows);
  });

  // ─── Test 9: Closing balance = opening + inflows - outflows ──────

  it('should compute closing balance as opening plus net flows', () => {
    const result = svc.simulateIntradayLiquidity(BASE_PARAMS);
    const totalInflows = BASE_PARAMS.expectedInflows.reduce(
      (s, f) => s + f.amount,
      0,
    );
    const totalOutflows = BASE_PARAMS.expectedOutflows.reduce(
      (s, f) => s + f.amount,
      0,
    );
    expect(result.closingBalance).toBeCloseTo(
      BASE_PARAMS.openingBalance + totalInflows - totalOutflows,
      0,
    );
  });

  // ─── Test 10: Stress test increases shortfall risk ───────────────

  it('should increase shortfall risk under stress conditions', () => {
    const normal = svc.simulateIntradayLiquidity(BASE_PARAMS);
    const stressed = svc.stressTest(BASE_PARAMS, 2.0, 2);
    // Stressed should have lower minimum balance
    expect(stressed.minimumBalance).toBeLessThanOrEqual(normal.minimumBalance);
  });
});
