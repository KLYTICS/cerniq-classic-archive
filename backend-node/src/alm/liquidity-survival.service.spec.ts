import {
  LiquiditySurvivalService,
  SurvivalParams,
  SurvivalResult,
} from './liquidity-survival.service';

// ─── Helpers ────────────────────────────────────────────────────

/** Well-capitalized institution with comfortable liquidity */
function wellCapitalizedParams(): SurvivalParams {
  return {
    liquidAssets: {
      cash: 50_000_000,
      fedFundsDeposits: 10_000_000,
      treasuries: 30_000_000,
      agencyMBS: 20_000_000,
      otherSecurities: 10_000_000,
    },
    dailyCashFlows: {
      loanRepayments: 500_000,
      depositInflows: 300_000,
      operatingExpenses: 200_000,
      loanDisbursements: 400_000,
    },
    stressAssumptions: {
      depositRunoffRate: 0.001, // 0.1%/day — mild
      totalDeposits: 200_000_000,
      loanRepaymentReduction: 0.05, // 5% reduction
      newLoanHalt: false,
      wholesaleFundingAvailable: true,
      wholesaleFundingLimit: 20_000_000,
    },
    contingencyTriggers: {
      warningDays: 30,
      criticalDays: 15,
      minimumCashFloor: 1_000_000,
    },
  };
}

/** High-stress scenario: rapid deposit flight */
function highStressParams(): SurvivalParams {
  return {
    liquidAssets: {
      cash: 10_000_000,
      fedFundsDeposits: 2_000_000,
      treasuries: 5_000_000,
      agencyMBS: 3_000_000,
      otherSecurities: 2_000_000,
    },
    dailyCashFlows: {
      loanRepayments: 200_000,
      depositInflows: 100_000,
      operatingExpenses: 150_000,
      loanDisbursements: 300_000,
    },
    stressAssumptions: {
      depositRunoffRate: 0.03, // 3%/day — severe
      totalDeposits: 100_000_000,
      loanRepaymentReduction: 0.5, // 50% fewer payments
      newLoanHalt: false,
      wholesaleFundingAvailable: false,
      wholesaleFundingLimit: 0,
    },
    contingencyTriggers: {
      warningDays: 30,
      criticalDays: 15,
      minimumCashFloor: 500_000,
    },
  };
}

// ─── Tests ──────────────────────────────────────────────────────

describe('LiquiditySurvivalService', () => {
  let service: LiquiditySurvivalService;

  beforeEach(() => {
    service = new LiquiditySurvivalService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // 1. Well-capitalized institution survives 365 days
  it('well-capitalized institution survives the full 365-day horizon', () => {
    const result = service.analyzeSurvival(wellCapitalizedParams());
    expect(result.survivalDays).toBe(365);
    expect(result.severity).toBe('ADEQUATE');
  });

  // 2. High deposit runoff reduces survival days
  it('high deposit runoff reduces survival days significantly', () => {
    const result = service.analyzeSurvival(highStressParams());
    expect(result.survivalDays).toBeLessThan(365);
    expect(result.survivalDays).toBeGreaterThan(0);
  });

  // 3. Halting new loans extends survival
  it('halting new loan originations extends survival', () => {
    const base = highStressParams();
    const withHalt: SurvivalParams = {
      ...base,
      stressAssumptions: { ...base.stressAssumptions, newLoanHalt: true },
    };

    const resultBase = service.analyzeSurvival(base);
    const resultHalt = service.analyzeSurvival(withHalt);

    expect(resultHalt.survivalDays).toBeGreaterThanOrEqual(
      resultBase.survivalDays,
    );
  });

  // 4. Wholesale funding extends survival
  it('wholesale funding availability extends survival', () => {
    const base = highStressParams();
    const withWholesale: SurvivalParams = {
      ...base,
      stressAssumptions: {
        ...base.stressAssumptions,
        wholesaleFundingAvailable: true,
        wholesaleFundingLimit: 50_000_000,
      },
    };

    const resultBase = service.analyzeSurvival(base);
    const resultWholesale = service.analyzeSurvival(withWholesale);

    expect(resultWholesale.survivalDays).toBeGreaterThan(
      resultBase.survivalDays,
    );
  });

  // 5. Securities sold in priority order (treasuries first)
  it('sells treasuries before MBS and other securities', () => {
    const result = service.analyzeSurvival(highStressParams());
    const treasuryAction = result.actions.find((a) =>
      a.action.includes('Treasury'),
    );
    const mbsAction = result.actions.find((a) => a.action.includes('MBS'));
    const otherAction = result.actions.find((a) =>
      a.action.includes('other securities'),
    );

    // If all are sold, treasuries should be first
    if (treasuryAction && mbsAction) {
      expect(treasuryAction.day).toBeLessThanOrEqual(mbsAction.day);
    }
    if (mbsAction && otherAction) {
      expect(mbsAction.day).toBeLessThanOrEqual(otherAction.day);
    }
    // At a minimum, treasuries should appear if any securities are sold
    if (result.actions.length > 0) {
      expect(treasuryAction).toBeDefined();
    }
  });

  // 6. Severity matches survival days
  it('severity classification matches survival day thresholds', () => {
    // ADEQUATE: > 90
    const adequate = service.analyzeSurvival(wellCapitalizedParams());
    expect(adequate.severity).toBe('ADEQUATE');

    // CRITICAL: < 15 — build a scenario guaranteed to exhaust fast
    const criticalParams = highStressParams();
    criticalParams.liquidAssets.cash = 1_000_000;
    criticalParams.liquidAssets.fedFundsDeposits = 500_000;
    criticalParams.liquidAssets.treasuries = 0;
    criticalParams.liquidAssets.agencyMBS = 0;
    criticalParams.liquidAssets.otherSecurities = 0;
    criticalParams.stressAssumptions.depositRunoffRate = 0.05;
    criticalParams.stressAssumptions.totalDeposits = 50_000_000;
    const critical = service.analyzeSurvival(criticalParams);
    expect(critical.severity).toBe('CRITICAL');
    expect(critical.survivalDays).toBeLessThan(15);
  });

  // 7. Daily positions decrease monotonically under pure stress (no asset sales settling)
  it('closing cash decreases monotonically in early stress days', () => {
    const params = highStressParams();
    // Remove all securities so no asset-sale inflows distort the trend
    params.liquidAssets.treasuries = 0;
    params.liquidAssets.agencyMBS = 0;
    params.liquidAssets.otherSecurities = 0;
    params.stressAssumptions.wholesaleFundingAvailable = false;

    const result = service.analyzeSurvival(params);
    // Under pure outflows, cash should generally decline day over day
    for (let i = 1; i < Math.min(result.dailyPositions.length, 10); i++) {
      expect(result.dailyPositions[i].closingCash).toBeLessThanOrEqual(
        result.dailyPositions[i - 1].closingCash + 0.01, // tolerance for rounding
      );
    }
  });

  // 8. Peak outflow day identified correctly
  it('peak outflow day matches the day with highest outflow', () => {
    const result = service.analyzeSurvival(highStressParams());
    const maxOutflowPosition = result.dailyPositions.reduce(
      (max, pos) => (pos.outflows > max.outflows ? pos : max),
      result.dailyPositions[0],
    );
    expect(result.peakStressDay).toBe(maxOutflowPosition.day);
    expect(result.peakOutflow).toBeCloseTo(maxOutflowPosition.outflows, 0);
  });

  // 9. Actions generated when thresholds are crossed
  it('generates contingency actions when survival thresholds are crossed', () => {
    const result = service.analyzeSurvival(highStressParams());
    // Under high stress, actions must be generated
    expect(result.actions.length).toBeGreaterThan(0);
    // Each action should have a valid structure
    for (const action of result.actions) {
      expect(action.day).toBeGreaterThan(0);
      expect(action.action.length).toBeGreaterThan(0);
      expect(action.impact).toBeGreaterThan(0);
    }
  });

  // 10. Minimum cash floor respected
  it('simulation stops when cash drops to the minimum floor', () => {
    const params = highStressParams();
    params.contingencyTriggers.minimumCashFloor = 500_000;
    const result = service.analyzeSurvival(params);

    if (result.survivalDays < 365) {
      const lastDay = result.dailyPositions[result.dailyPositions.length - 1];
      expect(lastDay.closingCash).toBeLessThanOrEqual(
        params.contingencyTriggers.minimumCashFloor,
      );
      expect(lastDay.status).toBe('EXHAUSTED');
    }
  });

  // 11. Liquidity profile computed correctly
  it('liquidity profile reflects asset composition and wholesale access', () => {
    const params = wellCapitalizedParams();
    const result = service.analyzeSurvival(params);

    const expectedImmediate =
      params.liquidAssets.cash + params.liquidAssets.fedFundsDeposits;
    expect(result.liquidityProfile.immediatelyAvailable).toBe(
      expectedImmediate,
    );
    expect(result.liquidityProfile.availableWithin7Days).toBeGreaterThan(
      expectedImmediate,
    );
    expect(result.liquidityProfile.availableWithin30Days).toBeGreaterThan(
      result.liquidityProfile.availableWithin7Days,
    );
  });

  // 12. Recommendation is bilingual
  it('recommendation contains both English and Spanish text', () => {
    const result = service.analyzeSurvival(wellCapitalizedParams());
    expect(result.recommendation).toContain('|');
    // English portion
    expect(result.recommendation).toMatch(/liquidity|Survival/i);
    // Spanish portion
    expect(result.recommendation).toMatch(/liquidez|supervivencia/i);
  });

  // 13. Daily positions array length matches survival days
  it('daily positions array length equals survival days', () => {
    const stressResult = service.analyzeSurvival(highStressParams());
    expect(stressResult.dailyPositions).toHaveLength(stressResult.survivalDays);

    const okResult = service.analyzeSurvival(wellCapitalizedParams());
    expect(okResult.dailyPositions).toHaveLength(365);
  });
});
