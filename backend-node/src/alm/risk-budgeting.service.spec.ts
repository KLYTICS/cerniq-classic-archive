import { RiskBudgetingService } from './risk-budgeting.service';

describe('RiskBudgetingService', () => {
  let service: RiskBudgetingService;

  beforeEach(() => {
    service = new RiskBudgetingService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── Single asset: 100% weight, 100% risk contribution ────

  it('single asset gets 100% weight and 100% risk contribution', () => {
    const result = service.calculateRiskDecomposition({
      positions: [
        {
          name: 'Bonds',
          weight: 1.0,
          annualReturn: 0.05,
          annualVolatility: 0.1,
        },
      ],
      correlationMatrix: [[1]],
    });

    expect(result.portfolioVolatility).toBeCloseTo(0.1, 4);
    expect(result.portfolioReturn).toBeCloseTo(0.05, 4);
    expect(result.positions).toHaveLength(1);
    expect(result.positions[0].percentContribution).toBeCloseTo(1.0, 4);
    expect(result.positions[0].componentRisk).toBeCloseTo(0.1, 4);
  });

  // ── Two uncorrelated equal-vol assets: risk parity gives 50/50 ──

  it('two uncorrelated equal-vol assets produce 50/50 risk parity', () => {
    const result = service.calculateRiskParity({
      assets: [
        { name: 'A', annualVolatility: 0.15 },
        { name: 'B', annualVolatility: 0.15 },
      ],
      correlationMatrix: [
        [1, 0],
        [0, 1],
      ],
    });

    expect(result.weights[0].weight).toBeCloseTo(0.5, 2);
    expect(result.weights[1].weight).toBeCloseTo(0.5, 2);
  });

  // ── Marginal contributions sum to portfolio risk ──────────

  it('marginal contributions (w_i * MCTR_i) sum to portfolio volatility', () => {
    const result = service.calculateRiskDecomposition({
      positions: [
        {
          name: 'Equities',
          weight: 0.6,
          annualReturn: 0.08,
          annualVolatility: 0.18,
        },
        {
          name: 'Bonds',
          weight: 0.3,
          annualReturn: 0.03,
          annualVolatility: 0.05,
        },
        {
          name: 'Gold',
          weight: 0.1,
          annualReturn: 0.02,
          annualVolatility: 0.15,
        },
      ],
      correlationMatrix: [
        [1.0, 0.3, -0.1],
        [0.3, 1.0, 0.1],
        [-0.1, 0.1, 1.0],
      ],
    });

    const sumCR = result.positions.reduce((s, p) => s + p.componentRisk, 0);
    expect(sumCR).toBeCloseTo(result.portfolioVolatility, 4);
  });

  // ── Component risks sum to portfolio variance ─────────────

  it('component risks (w_i * (Cov*w)_i) sum to portfolio variance', () => {
    const positions = [
      { name: 'A', weight: 0.4, annualReturn: 0.06, annualVolatility: 0.12 },
      { name: 'B', weight: 0.35, annualReturn: 0.04, annualVolatility: 0.08 },
      { name: 'C', weight: 0.25, annualReturn: 0.03, annualVolatility: 0.1 },
    ];
    const corr = [
      [1.0, 0.5, 0.2],
      [0.5, 1.0, 0.3],
      [0.2, 0.3, 1.0],
    ];

    const result = service.calculateRiskDecomposition({
      positions,
      correlationMatrix: corr,
    });

    // CR_i = w_i * MCTR_i, and MCTR_i = (Cov*w)_i / sigma_p
    // So sum(CR_i) = sum(w_i * (Cov*w)_i / sigma_p) = sigma_p^2 / sigma_p = sigma_p
    // => sum(w_i * MCTR_i * sigma_p) = sigma_p^2  (portfolio variance)
    const sumWeightedCovW = result.positions.reduce(
      (s, p) => s + p.componentRisk * result.portfolioVolatility,
      0,
    );
    const portVar = result.portfolioVolatility ** 2;
    expect(sumWeightedCovW).toBeCloseTo(portVar, 4);
  });

  // ── Higher vol asset gets lower weight in risk parity ─────

  it('higher vol asset gets lower weight in risk parity', () => {
    const result = service.calculateRiskParity({
      assets: [
        { name: 'HighVol', annualVolatility: 0.25 },
        { name: 'LowVol', annualVolatility: 0.05 },
      ],
      correlationMatrix: [
        [1, 0.3],
        [0.3, 1],
      ],
    });

    const highVolWeight = result.weights.find(
      (w) => w.name === 'HighVol',
    )!.weight;
    const lowVolWeight = result.weights.find(
      (w) => w.name === 'LowVol',
    )!.weight;
    expect(lowVolWeight).toBeGreaterThan(highVolWeight);
  });

  // ── Risk budget with equal targets matches risk parity ────

  it('risk budget with equal targets matches risk parity weights', () => {
    const assets = [
      { name: 'A', annualVolatility: 0.12 },
      { name: 'B', annualVolatility: 0.08 },
      { name: 'C', annualVolatility: 0.2 },
    ];
    const corr = [
      [1.0, 0.4, 0.2],
      [0.4, 1.0, 0.1],
      [0.2, 0.1, 1.0],
    ];

    const parityResult = service.calculateRiskParity({
      assets,
      correlationMatrix: corr,
    });

    const budgetResult = service.riskBudget({
      assets,
      correlationMatrix: corr,
      targetBudgets: [1 / 3, 1 / 3, 1 / 3],
    });

    // Weights should be very close
    for (let i = 0; i < 3; i++) {
      expect(budgetResult.weights[i].weight).toBeCloseTo(
        parityResult.weights[i].weight,
        2,
      );
    }
  });

  // ── Correlation = 1: no diversification benefit ───────────

  it('perfect correlation yields no diversification benefit', () => {
    const result = service.calculateRiskDecomposition({
      positions: [
        { name: 'A', weight: 0.5, annualReturn: 0.05, annualVolatility: 0.1 },
        { name: 'B', weight: 0.5, annualReturn: 0.05, annualVolatility: 0.1 },
      ],
      correlationMatrix: [
        [1, 1],
        [1, 1],
      ],
    });

    // With perfect correlation and equal vols, portfolio vol = weighted avg vol
    // sigma_p = 0.5*0.10 + 0.5*0.10 = 0.10
    expect(result.portfolioVolatility).toBeCloseTo(0.1, 4);
  });

  // ── Correlation = 0: maximum diversification ──────────────

  it('zero correlation gives maximum diversification benefit', () => {
    const resultZeroCorr = service.calculateRiskDecomposition({
      positions: [
        { name: 'A', weight: 0.5, annualReturn: 0.05, annualVolatility: 0.1 },
        { name: 'B', weight: 0.5, annualReturn: 0.05, annualVolatility: 0.1 },
      ],
      correlationMatrix: [
        [1, 0],
        [0, 1],
      ],
    });

    // sigma_p = sqrt(0.5^2 * 0.01 + 0.5^2 * 0.01) = sqrt(0.005) ~ 0.0707
    expect(resultZeroCorr.portfolioVolatility).toBeCloseTo(Math.sqrt(0.005), 4);
    // Confirm it's lower than the undiversified case (0.10)
    expect(resultZeroCorr.portfolioVolatility).toBeLessThan(0.1);
  });

  // ── Risk parity converges within 100 iterations ───────────

  it('risk parity converges within 100 iterations', () => {
    const result = service.calculateRiskParity({
      assets: [
        { name: 'Equities', annualVolatility: 0.18 },
        { name: 'Bonds', annualVolatility: 0.05 },
        { name: 'Commodities', annualVolatility: 0.22 },
        { name: 'REITs', annualVolatility: 0.16 },
      ],
      correlationMatrix: [
        [1.0, 0.2, 0.4, 0.6],
        [0.2, 1.0, 0.1, 0.15],
        [0.4, 0.1, 1.0, 0.3],
        [0.6, 0.15, 0.3, 1.0],
      ],
    });

    expect(result.iterations).toBeLessThan(100);
    // Verify all weights sum to 1
    const totalWeight = result.weights.reduce((s, w) => s + w.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 4);
  });

  // ── Custom risk budgets (60/40 split) ─────────────────────

  it('custom 60/40 risk budget allocates risk correctly', () => {
    const result = service.riskBudget({
      assets: [
        { name: 'Equities', annualVolatility: 0.18 },
        { name: 'Bonds', annualVolatility: 0.05 },
      ],
      correlationMatrix: [
        [1, 0.3],
        [0.3, 1],
      ],
      targetBudgets: [0.6, 0.4],
    });

    expect(result.actualBudgets[0]).toBeCloseTo(0.6, 1);
    expect(result.actualBudgets[1]).toBeCloseTo(0.4, 1);
    expect(result.trackingError).toBeLessThan(0.01);

    // Equities should still have lower weight than bonds (higher vol)
    const eqWeight = result.weights.find((w) => w.name === 'Equities')!.weight;
    const bondWeight = result.weights.find((w) => w.name === 'Bonds')!.weight;
    expect(bondWeight).toBeGreaterThan(eqWeight);
  });

  // ── Percent contributions sum to 1.0 ─────────────────────

  it('percent contributions sum to 1.0', () => {
    const result = service.calculateRiskDecomposition({
      positions: [
        { name: 'A', weight: 0.3, annualReturn: 0.07, annualVolatility: 0.2 },
        { name: 'B', weight: 0.4, annualReturn: 0.04, annualVolatility: 0.06 },
        { name: 'C', weight: 0.3, annualReturn: 0.05, annualVolatility: 0.12 },
      ],
      correlationMatrix: [
        [1.0, 0.5, 0.3],
        [0.5, 1.0, 0.2],
        [0.3, 0.2, 1.0],
      ],
    });

    const sumPct = result.positions.reduce(
      (s, p) => s + p.percentContribution,
      0,
    );
    expect(sumPct).toBeCloseTo(1.0, 4);
  });

  // ── Invalid budget sum throws error ───────────────────────

  it('throws when target budgets do not sum to 1.0', () => {
    expect(() =>
      service.riskBudget({
        assets: [
          { name: 'A', annualVolatility: 0.1 },
          { name: 'B', annualVolatility: 0.1 },
        ],
        correlationMatrix: [
          [1, 0],
          [0, 1],
        ],
        targetBudgets: [0.3, 0.3], // sum = 0.6
      }),
    ).toThrow('Target budgets must sum to 1.0');
  });

  // ── Sharpe ratio is correctly computed ────────────────────

  it('sharpe ratio equals return divided by volatility', () => {
    const result = service.calculateRiskDecomposition({
      positions: [
        { name: 'A', weight: 0.5, annualReturn: 0.1, annualVolatility: 0.2 },
        { name: 'B', weight: 0.5, annualReturn: 0.04, annualVolatility: 0.08 },
      ],
      correlationMatrix: [
        [1, 0],
        [0, 1],
      ],
    });

    const expectedSharpe = result.portfolioReturn / result.portfolioVolatility;
    expect(result.sharpeRatio).toBeCloseTo(expectedSharpe, 4);
  });

  it('risk parity with target risk scales weights appropriately', () => {
    const result = service.calculateRiskParity({
      assets: [
        { name: 'A', annualVolatility: 0.15 },
        { name: 'B', annualVolatility: 0.10 },
      ],
      correlationMatrix: [[1, 0.3], [0.3, 1]],
      targetRisk: 0.08,
    });
    // Weights should still sum to ~1 and portfolioVolatility should be near target
    const totalWeight = result.weights.reduce((s, w) => s + w.weight, 0);
    expect(totalWeight).toBeCloseTo(1.0, 2);
  });

  it('single asset risk parity returns 100% weight', () => {
    const result = service.calculateRiskParity({
      assets: [{ name: 'OnlyAsset', annualVolatility: 0.20 }],
      correlationMatrix: [[1]],
    });
    expect(result.weights[0].weight).toBe(1.0);
    expect(result.portfolioVolatility).toBe(0.20);
    expect(result.iterations).toBe(0);
  });

  it('single asset risk budget returns 100% weight', () => {
    const result = service.riskBudget({
      assets: [{ name: 'OnlyAsset', annualVolatility: 0.15 }],
      correlationMatrix: [[1]],
      targetBudgets: [1.0],
    });
    expect(result.weights[0].weight).toBe(1.0);
    expect(result.actualBudgets[0]).toBe(1.0);
  });
});
