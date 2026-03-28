import { Injectable, Logger } from '@nestjs/common';

// ─── Input Interfaces ────────────────────────────────────────

export interface InstrumentInput {
  name: string;
  amount: number;
  rate: number;
  maturityYears: number;
  isFloating: boolean;
}

export interface BalanceSheetInput {
  assets: InstrumentInput[];
  liabilities: InstrumentInput[];
}

export interface ThresholdInput {
  metric: 'EVE' | 'NII' | 'LCR' | 'CAPITAL_RATIO';
  limit: number;
}

export interface SearchRangeInput {
  minShockBps: number;
  maxShockBps: number;
  stepBps: number;
}

// ─── Result Interfaces ──────────────────────────────────────

export interface BreachScenarioResult {
  breachShock: number | null;
  breachValue: number;
  baseValue: number;
  margin: number;
  scenarioDescription: string;
}

export interface MultiFactorScenarioResult {
  scenario: { factor: string; value: number }[];
  breachedMetrics: { metric: string; value: number; limit: number }[];
  severity: 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL';
}

export interface CapitalAdequacyResult {
  maxTolerableLoss: number;
  maxTolerableLossPct: number;
  impliedShock: number;
  capitalBuffer: number;
  bufferDays: number;
}

// ─── Helpers ─────────────────────────────────────────────────

/** Round to n decimal places with NaN guard */
function round(value: number, decimals: number): number {
  if (!Number.isFinite(value)) return 0;
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

/**
 * Approximate modified duration for a par instrument.
 * For a bond paying annual coupons at par: D_mod ~ (1 - (1+y)^-n) / y
 * Simplified: we use maturityYears * 0.9 as a rough proxy for
 * instruments without full cash-flow schedules.
 */
function approxDuration(maturityYears: number, rate: number): number {
  if (maturityYears <= 0) return 0;
  if (rate <= 0) return maturityYears;
  // Macaulay duration approximation for par bond
  const y = rate;
  const n = maturityYears;
  const pvAnnuity = (1 - Math.pow(1 + y, -n)) / y;
  const macaulay = pvAnnuity - (n * (y - y)) / (y * (Math.pow(1 + y, n) - 1));
  // Simplified: weighted average time of cash flows
  const mac =
    (1 + y) / y - (1 + y + n * y) / (y * (Math.pow(1 + y, n) - 1) + y);
  // Use simpler approximation that's robust
  const simpleDuration = (1 - Math.pow(1 + y, -n)) / y;
  return simpleDuration / (1 + y); // modified duration
}

@Injectable()
export class StressReverseService {
  private readonly logger = new Logger(StressReverseService.name);

  // ─── Core Metric Calculations ──────────────────────────────

  /**
   * Calculate EVE (Economic Value of Equity) under a rate shock.
   * Uses duration-based approximation: DeltaValue ~ -Duration * DeltaRate * Value
   */
  private calculateEVE(
    balanceSheet: BalanceSheetInput,
    shockBps: number,
  ): number {
    const deltaRate = shockBps / 10000;

    let assetValue = 0;
    for (const a of balanceSheet.assets) {
      const dur = a.isFloating ? 0.25 : approxDuration(a.maturityYears, a.rate);
      const deltaV = -dur * deltaRate * a.amount;
      assetValue += a.amount + deltaV;
    }

    let liabilityValue = 0;
    for (const l of balanceSheet.liabilities) {
      const dur = l.isFloating ? 0.25 : approxDuration(l.maturityYears, l.rate);
      const deltaV = -dur * deltaRate * l.amount;
      liabilityValue += l.amount + deltaV;
    }

    return assetValue - liabilityValue;
  }

  /**
   * Calculate NII (Net Interest Income) impact under a rate shock.
   * Floating-rate instruments reprice; fixed-rate instruments do not.
   */
  private calculateNII(
    balanceSheet: BalanceSheetInput,
    shockBps: number,
  ): number {
    const deltaRate = shockBps / 10000;

    let assetIncome = 0;
    for (const a of balanceSheet.assets) {
      const effectiveRate = a.isFloating ? a.rate + deltaRate : a.rate;
      assetIncome += a.amount * effectiveRate;
    }

    let liabilityExpense = 0;
    for (const l of balanceSheet.liabilities) {
      const effectiveRate = l.isFloating ? l.rate + deltaRate : l.rate;
      liabilityExpense += l.amount * effectiveRate;
    }

    return assetIncome - liabilityExpense;
  }

  /**
   * Simplified LCR (Liquidity Coverage Ratio) under stress.
   * Assumes rate shock causes deposit outflows and reduces HQLA values.
   */
  private calculateLCR(
    balanceSheet: BalanceSheetInput,
    shockBps: number,
  ): number {
    const totalAssets = balanceSheet.assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = balanceSheet.liabilities.reduce(
      (s, l) => s + l.amount,
      0,
    );

    // HQLA: assume 20% of assets are high-quality liquid assets
    const hqla = totalAssets * 0.2;
    // Rate shock reduces HQLA value via duration
    const avgAssetDuration = 3; // assume 3yr average for HQLA portfolio
    const deltaRate = shockBps / 10000;
    const hqlaStressed = hqla * (1 - avgAssetDuration * deltaRate);

    // Net cash outflows: 15% of liabilities in 30-day stress
    // Higher rate shock increases deposit outflow probability
    const outflowRate = 0.15 * (1 + Math.abs(deltaRate) * 2);
    const netOutflows = totalLiabilities * outflowRate;

    if (netOutflows <= 0) return 200; // cap
    return Math.max(0, Math.min(200, (hqlaStressed / netOutflows) * 100));
  }

  /**
   * Calculate capital ratio under EVE loss from rate shock.
   */
  private calculateCapitalRatio(
    balanceSheet: BalanceSheetInput,
    shockBps: number,
    currentCapitalRatio?: number,
  ): number {
    const totalAssets = balanceSheet.assets.reduce((s, a) => s + a.amount, 0);
    const totalLiabilities = balanceSheet.liabilities.reduce(
      (s, l) => s + l.amount,
      0,
    );

    const baseEquity = totalAssets - totalLiabilities;
    const baseRatio = currentCapitalRatio ?? (baseEquity / totalAssets) * 100;

    const baseEVE = this.calculateEVE(balanceSheet, 0);
    const stressedEVE = this.calculateEVE(balanceSheet, shockBps);
    const eveLoss = baseEVE - stressedEVE;

    const stressedEquity = baseEquity - eveLoss;
    if (totalAssets <= 0) return 0;
    return (stressedEquity / totalAssets) * 100;
  }

  /**
   * Evaluate a metric at a given shock level.
   */
  private evaluateMetric(
    balanceSheet: BalanceSheetInput,
    metric: string,
    shockBps: number,
  ): number {
    switch (metric) {
      case 'EVE':
        return this.calculateEVE(balanceSheet, shockBps);
      case 'NII':
        return this.calculateNII(balanceSheet, shockBps);
      case 'LCR':
        return this.calculateLCR(balanceSheet, shockBps);
      case 'CAPITAL_RATIO':
        return this.calculateCapitalRatio(balanceSheet, shockBps);
      default:
        throw new Error(`Unknown metric: ${metric}`);
    }
  }

  // ─── 1. findBreachScenario ─────────────────────────────────

  /**
   * Binary search for the smallest rate shock (in absolute bps) that
   * causes a metric to breach its limit.
   *
   * Required by COSSEC, NCUA, and Basel III IRRBB guidelines.
   */
  findBreachScenario(params: {
    balanceSheet: BalanceSheetInput;
    threshold: ThresholdInput;
    searchRange: SearchRangeInput;
  }): BreachScenarioResult {
    const { balanceSheet, threshold, searchRange } = params;
    const { metric, limit } = threshold;
    const { minShockBps, maxShockBps, stepBps } = searchRange;

    const baseValue = this.evaluateMetric(balanceSheet, metric, 0);

    // Determine if metric breaches when it goes below the limit (EVE, NII, LCR, CAPITAL_RATIO)
    const breaches = (value: number): boolean => value < limit;

    // Scan upward shocks
    let breachShockUp: number | null = null;
    let breachValueUp = baseValue;

    // Scan downward shocks
    let breachShockDown: number | null = null;
    let breachValueDown = baseValue;

    // Binary search in upward direction
    if (maxShockBps > 0) {
      const result = this.binarySearchBreach(
        balanceSheet,
        metric,
        Math.max(minShockBps, 0),
        maxShockBps,
        stepBps,
        breaches,
      );
      if (result !== null) {
        breachShockUp = result.shock;
        breachValueUp = result.value;
      }
    }

    // Binary search in downward direction
    if (minShockBps < 0) {
      const result = this.binarySearchBreach(
        balanceSheet,
        metric,
        Math.max(-maxShockBps, minShockBps),
        Math.min(-Math.max(minShockBps, -maxShockBps), 0),
        stepBps,
        breaches,
      );
      // Also scan negative shocks linearly for simplicity
      for (let shock = -stepBps; shock >= minShockBps; shock -= stepBps) {
        const val = this.evaluateMetric(balanceSheet, metric, shock);
        if (breaches(val)) {
          if (
            breachShockDown === null ||
            Math.abs(shock) < Math.abs(breachShockDown)
          ) {
            breachShockDown = shock;
            breachValueDown = val;
          }
          break;
        }
      }
    }

    // Pick the smallest absolute shock that breaches
    let breachShock: number | null = null;
    let breachValue = baseValue;

    if (breachShockUp !== null && breachShockDown !== null) {
      if (Math.abs(breachShockUp) <= Math.abs(breachShockDown)) {
        breachShock = breachShockUp;
        breachValue = breachValueUp;
      } else {
        breachShock = breachShockDown;
        breachValue = breachValueDown;
      }
    } else if (breachShockUp !== null) {
      breachShock = breachShockUp;
      breachValue = breachValueUp;
    } else if (breachShockDown !== null) {
      breachShock = breachShockDown;
      breachValue = breachValueDown;
    }

    const margin = baseValue - limit;

    const scenarioDescription =
      breachShock !== null
        ? `A ${breachShock > 0 ? '+' : ''}${breachShock}bps rate shock would cause ${metric} to breach the limit of ${limit} (value: ${round(breachValue, 2)}). Current ${metric}: ${round(baseValue, 2)}, margin: ${round(margin, 2)}.`
        : `No breach found within the search range [${minShockBps}, ${maxShockBps}]bps. Current ${metric}: ${round(baseValue, 2)}, limit: ${limit}, margin: ${round(margin, 2)}.`;

    return {
      breachShock,
      breachValue: round(breachValue, 4),
      baseValue: round(baseValue, 4),
      margin: round(margin, 4),
      scenarioDescription,
    };
  }

  /**
   * Binary search for the smallest shock in one direction that causes a breach.
   */
  private binarySearchBreach(
    balanceSheet: BalanceSheetInput,
    metric: string,
    low: number,
    high: number,
    stepBps: number,
    breaches: (value: number) => boolean,
  ): { shock: number; value: number } | null {
    // First check if high end even breaches
    const highVal = this.evaluateMetric(balanceSheet, metric, high);
    if (!breaches(highVal)) return null;

    // Check if low end already breaches
    const lowVal = this.evaluateMetric(balanceSheet, metric, low);
    if (breaches(lowVal)) {
      return { shock: low, value: lowVal };
    }

    // Binary search
    let lo = low;
    let hi = high;
    const tolerance = Math.max(stepBps, 1);

    while (hi - lo > tolerance) {
      const mid = Math.round((lo + hi) / 2);
      const midVal = this.evaluateMetric(balanceSheet, metric, mid);
      if (breaches(midVal)) {
        hi = mid;
      } else {
        lo = mid;
      }
    }

    const finalVal = this.evaluateMetric(balanceSheet, metric, hi);
    return { shock: hi, value: finalVal };
  }

  // ─── 2. multiFactorReverseStress ───────────────────────────

  /**
   * Explore combinations of multiple stress factors to find the most
   * plausible scenario that breaches ALL thresholds simultaneously.
   *
   * Factors: rate shock, spread widening, deposit runoff, etc.
   */
  multiFactorReverseStress(params: {
    balanceSheet: BalanceSheetInput;
    thresholds: ThresholdInput[];
    factors: { name: string; range: [number, number] }[];
  }): MultiFactorScenarioResult {
    const { balanceSheet, thresholds, factors } = params;

    // Generate candidate scenarios by gridding factor space
    const gridPoints = 10; // points per factor
    const candidates: { factor: string; value: number }[][] = [];

    this.generateCombinations(factors, gridPoints, 0, [], candidates);

    let bestScenario: { factor: string; value: number }[] | null = null;
    let bestBreachedMetrics: {
      metric: string;
      value: number;
      limit: number;
    }[] = [];
    let bestScore = Infinity; // lower = more plausible (smaller shocks)
    let bestBreachCount = 0;

    for (const candidate of candidates) {
      const adjustedBS = this.applyFactors(balanceSheet, candidate);
      const rateShockFactor = candidate.find(
        (f) => f.factor === 'rateShock' || f.factor === 'rate_shock',
      );
      const shockBps = rateShockFactor ? rateShockFactor.value : 0;

      const breached: { metric: string; value: number; limit: number }[] = [];
      for (const t of thresholds) {
        const val = this.evaluateMetric(adjustedBS, t.metric, shockBps);
        if (val < t.limit) {
          breached.push({
            metric: t.metric,
            value: round(val, 2),
            limit: t.limit,
          });
        }
      }

      // Score: prefer scenarios that breach ALL thresholds with smallest factor magnitudes
      const severity = candidate.reduce((s, f) => s + Math.abs(f.value), 0);

      if (
        breached.length > bestBreachCount ||
        (breached.length === bestBreachCount && severity < bestScore)
      ) {
        bestBreachCount = breached.length;
        bestScore = severity;
        bestScenario = candidate;
        bestBreachedMetrics = breached;
      }
    }

    const scenario =
      bestScenario ?? factors.map((f) => ({ factor: f.name, value: 0 }));

    return {
      scenario,
      breachedMetrics: bestBreachedMetrics,
      severity: this.classifySeverity(bestScore, factors),
    };
  }

  /**
   * Generate all combinations of factor values for grid search.
   */
  private generateCombinations(
    factors: { name: string; range: [number, number] }[],
    gridPoints: number,
    idx: number,
    current: { factor: string; value: number }[],
    results: { factor: string; value: number }[][],
  ): void {
    if (idx >= factors.length) {
      results.push([...current]);
      return;
    }

    const factor = factors[idx];
    const [min, max] = factor.range;
    const step = gridPoints > 1 ? (max - min) / (gridPoints - 1) : 0;

    for (let i = 0; i < gridPoints; i++) {
      const value = round(min + step * i, 2);
      current.push({ factor: factor.name, value });
      this.generateCombinations(factors, gridPoints, idx + 1, current, results);
      current.pop();
    }
  }

  /**
   * Apply non-rate factors (spread widening, deposit runoff) to the balance sheet.
   */
  private applyFactors(
    balanceSheet: BalanceSheetInput,
    factors: { factor: string; value: number }[],
  ): BalanceSheetInput {
    const adjustedAssets = [...balanceSheet.assets.map((a) => ({ ...a }))];
    const adjustedLiabilities = [
      ...balanceSheet.liabilities.map((l) => ({ ...l })),
    ];

    for (const f of factors) {
      const name = f.factor.toLowerCase();

      if (name === 'spread_widening' || name === 'spreadwidening') {
        // Spread widening reduces asset values — increase yield required
        for (const a of adjustedAssets) {
          a.rate = a.rate + f.value / 10000; // value in bps
        }
      } else if (name === 'deposit_runoff' || name === 'depositrunoff') {
        // Deposit runoff reduces liability balances, forcing costly replacement
        for (const l of adjustedLiabilities) {
          l.amount = l.amount * (1 - f.value / 100); // value in %
          l.rate = l.rate + (f.value / 100) * 0.02; // replacement cost
        }
      }
      // rateShock is handled separately via shockBps
    }

    return { assets: adjustedAssets, liabilities: adjustedLiabilities };
  }

  /**
   * Classify scenario severity based on how extreme the required factors are.
   */
  private classifySeverity(
    totalSeverity: number,
    factors: { name: string; range: [number, number] }[],
  ): 'LOW' | 'MEDIUM' | 'HIGH' | 'CRITICAL' {
    // Normalize severity by maximum possible
    const maxSeverity = factors.reduce(
      (s, f) => s + Math.max(Math.abs(f.range[0]), Math.abs(f.range[1])),
      0,
    );

    if (maxSeverity <= 0) return 'LOW';
    const ratio = totalSeverity / maxSeverity;

    if (ratio < 0.25) return 'CRITICAL'; // small shocks cause breach = very risky
    if (ratio < 0.5) return 'HIGH';
    if (ratio < 0.75) return 'MEDIUM';
    return 'LOW'; // only extreme scenarios cause breach = healthy
  }

  // ─── 3. capitalAdequacyReverseStress ───────────────────────

  /**
   * Find the EVE loss that would push capital below the minimum ratio.
   * Required for COSSEC/NCUA capital adequacy reverse stress testing.
   */
  capitalAdequacyReverseStress(params: {
    currentCapitalRatio: number;
    riskWeightedAssets: number;
    balanceSheet: BalanceSheetInput;
    minimumCapitalRatio: number;
  }): CapitalAdequacyResult {
    const {
      currentCapitalRatio,
      riskWeightedAssets,
      balanceSheet,
      minimumCapitalRatio,
    } = params;

    const totalAssets = balanceSheet.assets.reduce((s, a) => s + a.amount, 0);

    // Current capital = ratio * RWA
    const currentCapital = (currentCapitalRatio / 100) * riskWeightedAssets;
    const minimumCapital = (minimumCapitalRatio / 100) * riskWeightedAssets;

    // Maximum tolerable loss before breaching minimum
    const maxTolerableLoss = currentCapital - minimumCapital;
    const maxTolerableLossPct =
      totalAssets > 0 ? (maxTolerableLoss / totalAssets) * 100 : 0;

    // Capital buffer
    const capitalBuffer = currentCapitalRatio - minimumCapitalRatio;

    // Find the implied rate shock that would cause this EVE loss
    // Using weighted average duration of the balance sheet
    const avgDuration = this.weightedAverageDuration(balanceSheet);
    const baseEVE = this.calculateEVE(balanceSheet, 0);

    // DeltaEVE ~ -Duration * DeltaRate * TotalAssets
    // maxTolerableLoss = Duration * DeltaRate * TotalAssets
    // DeltaRate = maxTolerableLoss / (Duration * TotalAssets)
    let impliedShockBps = 0;
    if (avgDuration > 0 && totalAssets > 0) {
      const deltaRate = maxTolerableLoss / (avgDuration * totalAssets);
      impliedShockBps = round(deltaRate * 10000, 0);
    }

    // Buffer days: rough estimate of how many days of adverse NII
    // it would take to erode the buffer
    const baseNII = this.calculateNII(balanceSheet, 0);
    const dailyNII = baseNII / 365;
    const bufferDays =
      dailyNII > 0 ? Math.floor(maxTolerableLoss / dailyNII) : 0;

    return {
      maxTolerableLoss: round(maxTolerableLoss, 2),
      maxTolerableLossPct: round(maxTolerableLossPct, 4),
      impliedShock: impliedShockBps,
      capitalBuffer: round(capitalBuffer, 4),
      bufferDays: Math.max(0, bufferDays),
    };
  }

  /**
   * Calculate weighted average modified duration of the balance sheet.
   */
  private weightedAverageDuration(balanceSheet: BalanceSheetInput): number {
    let totalWeight = 0;
    let durationSum = 0;

    for (const a of balanceSheet.assets) {
      const dur = a.isFloating ? 0.25 : approxDuration(a.maturityYears, a.rate);
      durationSum += dur * a.amount;
      totalWeight += a.amount;
    }

    for (const l of balanceSheet.liabilities) {
      const dur = l.isFloating ? 0.25 : approxDuration(l.maturityYears, l.rate);
      durationSum += dur * l.amount;
      totalWeight += l.amount;
    }

    return totalWeight > 0 ? durationSum / totalWeight : 0;
  }
}
