import { Injectable, Logger } from '@nestjs/common';

/**
 * Multi-Period Earnings Simulation Engine — Quant Model #XX
 *
 * Projects Net Interest Income (NII) over 8–12 quarters with DYNAMIC
 * balance-sheet evolution: assets amortize / prepay / originate, deposits
 * decay / grow, rates reprice along user-supplied paths.
 *
 * This is NOT the naive "freeze the balance sheet" approach.  Every quarter
 * the engine:
 *   1. Ages existing positions (amortization, prepayment, deposit decay)
 *   2. Reprices floating-rate instruments via beta-adjusted shocks
 *   3. Originates new loans & deposits at prevailing market rates
 *   4. Computes interest income / expense on the evolved portfolio
 *   5. Updates equity through retained NII
 *
 * Designed for cooperativa CFOs presenting to their boards and for
 * COSSEC / NCUA regulatory review.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface AssetPosition {
  name: string;
  balance: number;
  rate: number;
  maturityYears: number;
  isFloating: boolean;
  repricingMonths?: number;
  prepaymentSpeed?: number;
}

export interface LiabilityPosition {
  name: string;
  balance: number;
  rate: number;
  maturityYears: number;
  isFloating: boolean;
  repricingMonths?: number;
  decayRate?: number;
}

export interface BalanceSheetInput {
  assets: AssetPosition[];
  liabilities: LiabilityPosition[];
  equity: number;
}

export interface SimulationAssumptions {
  assetGrowthRate: number;
  depositGrowthRate: number;
  newLoanRate: number;
  newDepositRate: number;
  prepaymentMultiplier: number;
  depositDecayMultiplier: number;
}

export interface RatePath {
  name: string;
  shocksBps: number[];
}

export interface EarningsSimulationParams {
  balanceSheet: BalanceSheetInput;
  assumptions: SimulationAssumptions;
  ratePaths: RatePath[];
  quarters: number;
}

// ─── Output Types ───────────────────────────────────────────────────

export type RiskRating = 'LOW' | 'MODERATE' | 'ELEVATED' | 'HIGH' | 'CRITICAL';

export interface QuarterResult {
  quarter: number;
  date: string;
  totalAssets: number;
  totalLiabilities: number;
  equity: number;
  interestIncome: number;
  interestExpense: number;
  nii: number;
  nim: number;
  cumulativeNII: number;
  rateLevel: number;
}

export interface ScenarioSummary {
  totalNII: number;
  averageNIM: number;
  niiChange: number;
  niiChangePct: number;
  worstQuarterNII: number;
  bestQuarterNII: number;
  endingEquity: number;
  equityChange: number;
  riskRating: RiskRating;
}

export interface ScenarioResult {
  name: string;
  quarters: QuarterResult[];
  summary: ScenarioSummary;
}

export interface EarningsSimulationResult {
  scenarios: ScenarioResult[];
  baseScenarioIndex: number;
}

// ─── Internal working copies ────────────────────────────────────────

interface AssetWorking {
  name: string;
  balance: number;
  rate: number;
  maturityYears: number;
  isFloating: boolean;
  repricingMonths: number;
  prepaymentSpeed: number;
}

interface LiabilityWorking {
  name: string;
  balance: number;
  rate: number;
  maturityYears: number;
  isFloating: boolean;
  repricingMonths: number;
  decayRate: number;
}

// ─── Constants ──────────────────────────────────────────────────────

/** Floating-rate asset beta — assets reprice quickly */
const ASSET_BETA = 0.9;

/** Deposit beta — deposits are sticky, reprice slowly */
const DEPOSIT_BETA = 0.4;

/** Quarter = 0.25 years */
const QTR = 0.25;

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class EarningsSimulationService {
  private readonly logger = new Logger(EarningsSimulationService.name);

  /**
   * Run the multi-period earnings simulation across all supplied rate paths.
   */
  simulateEarnings(params: EarningsSimulationParams): EarningsSimulationResult {
    const { balanceSheet, assumptions, ratePaths, quarters } = params;

    if (quarters < 1 || quarters > 20) {
      throw new Error('quarters must be between 1 and 20');
    }

    // Identify the base scenario (shock of zero every quarter)
    let baseIndex = ratePaths.findIndex((p) =>
      p.shocksBps.every((s) => s === 0),
    );
    if (baseIndex === -1) baseIndex = 0;

    const scenarios: ScenarioResult[] = ratePaths.map((path) =>
      this.runScenario(balanceSheet, assumptions, path, quarters),
    );

    // Now that we have all scenarios, compute niiChange relative to base
    const baseTotal = scenarios[baseIndex].summary.totalNII;
    for (const sc of scenarios) {
      sc.summary.niiChange = sc.summary.totalNII - baseTotal;
      sc.summary.niiChangePct =
        baseTotal !== 0
          ? Math.abs(sc.summary.totalNII - baseTotal) / Math.abs(baseTotal)
          : 0;
      sc.summary.riskRating = this.classifyRisk(sc.summary.niiChangePct);
    }

    return { scenarios, baseScenarioIndex: baseIndex };
  }

  /**
   * Generate the 5 standard regulatory rate paths.
   *
   *  1. Base (unchanged)
   *  2. Gradual +200 bps  (25 bps / quarter × 8)
   *  3. Gradual −200 bps
   *  4. Shock +300 bps    (immediate, then flat)
   *  5. Shock −100 bps    (immediate, then flat)
   */
  generateStandardRatePaths(currentRate: number, quarters = 8): RatePath[] {
    const zero = new Array(quarters).fill(0);

    const gradualUp = new Array(quarters)
      .fill(0)
      .map((_, i) => (i < 8 ? 25 : 0));
    const gradualDown = new Array(quarters)
      .fill(0)
      .map((_, i) => (i < 8 ? -25 : 0));

    const shockUp = [300, ...new Array(quarters - 1).fill(0)];
    const shockDown = [-100, ...new Array(quarters - 1).fill(0)];

    return [
      { name: 'Base (Unchanged)', shocksBps: zero },
      { name: 'Gradual +200bps', shocksBps: gradualUp },
      { name: 'Gradual -200bps', shocksBps: gradualDown },
      { name: 'Shock +300bps', shocksBps: shockUp },
      { name: 'Shock -100bps', shocksBps: shockDown },
    ];
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private runScenario(
    bs: BalanceSheetInput,
    assumptions: SimulationAssumptions,
    path: RatePath,
    quarters: number,
  ): ScenarioResult {
    // Deep-clone positions so each scenario is independent
    const assets: AssetWorking[] = bs.assets.map((a) => ({
      name: a.name,
      balance: a.balance,
      rate: a.rate,
      maturityYears: a.maturityYears,
      isFloating: a.isFloating,
      repricingMonths: a.repricingMonths ?? 3,
      prepaymentSpeed: a.prepaymentSpeed ?? 0,
    }));

    const liabilities: LiabilityWorking[] = bs.liabilities.map((l) => ({
      name: l.name,
      balance: l.balance,
      rate: l.rate,
      maturityYears: l.maturityYears,
      isFloating: l.isFloating,
      repricingMonths: l.repricingMonths ?? 3,
      decayRate: l.decayRate ?? 0,
    }));

    let equity = bs.equity;
    let cumulativeNII = 0;
    let cumulativeRateShockBps = 0;
    const startDate = new Date();
    const quarterResults: QuarterResult[] = [];

    for (let q = 1; q <= quarters; q++) {
      const shockBps = path.shocksBps[q - 1] ?? 0;
      cumulativeRateShockBps += shockBps;
      const shockDecimal = shockBps / 10_000;

      const startAssets = this.sumBalances(assets);

      // ── 1. Reprice floating-rate instruments ────────────────────
      for (const a of assets) {
        if (a.isFloating) {
          a.rate += shockDecimal * ASSET_BETA;
          // Floor at 0 — rates can't go negative in cooperativa world
          if (a.rate < 0) a.rate = 0;
        }
      }
      for (const l of liabilities) {
        if (l.isFloating) {
          l.rate += shockDecimal * DEPOSIT_BETA;
          if (l.rate < 0) l.rate = 0;
        }
      }

      // ── 2. Compute interest income & expense on CURRENT balances ──
      let interestIncome = 0;
      for (const a of assets) {
        interestIncome += a.balance * a.rate * QTR;
      }

      let interestExpense = 0;
      for (const l of liabilities) {
        interestExpense += l.balance * l.rate * QTR;
      }

      // ── 3. Age positions (amortization, prepayments, decay) ─────
      for (const a of assets) {
        // Linear amortization
        if (a.maturityYears > 0) {
          const amort = a.balance * (1 / a.maturityYears) * QTR;
          a.balance -= amort;
        }
        // Prepayments (additional to amortization)
        if (a.prepaymentSpeed > 0) {
          const prepay =
            a.balance *
            a.prepaymentSpeed *
            assumptions.prepaymentMultiplier *
            QTR;
          a.balance -= prepay;
        }
        // Floor at zero
        if (a.balance < 0) a.balance = 0;
      }

      for (const l of liabilities) {
        // Scheduled maturity run-off
        if (l.maturityYears > 0) {
          const amort = l.balance * (1 / l.maturityYears) * QTR;
          l.balance -= amort;
        }
        // Deposit decay
        if (l.decayRate > 0) {
          const decay =
            l.balance * l.decayRate * assumptions.depositDecayMultiplier * QTR;
          l.balance -= decay;
        }
        if (l.balance < 0) l.balance = 0;
      }

      // ── 4. New originations ─────────────────────────────────────
      const newLoanAmount = assumptions.assetGrowthRate * QTR * startAssets;
      if (newLoanAmount > 0) {
        assets.push({
          name: `New Loans Q${q}`,
          balance: newLoanAmount,
          rate: assumptions.newLoanRate,
          maturityYears: 5, // assumed weighted-avg life for new production
          isFloating: false,
          repricingMonths: 0,
          prepaymentSpeed: 0.05,
        });
      }

      const startLiabilities = this.sumBalances(liabilities);
      const newDepositAmount =
        assumptions.depositGrowthRate * QTR * startLiabilities;
      if (newDepositAmount > 0) {
        liabilities.push({
          name: `New Deposits Q${q}`,
          balance: newDepositAmount,
          rate: assumptions.newDepositRate,
          maturityYears: 2,
          isFloating: false,
          repricingMonths: 0,
          decayRate: 0.03,
        });
      }

      // ── 5. Compute NII & update equity ──────────────────────────
      const nii = interestIncome - interestExpense;
      cumulativeNII += nii;
      equity += nii; // retained earnings (simplified)

      const endAssets = this.sumBalances(assets);
      const endLiabilities = this.sumBalances(liabilities);
      const avgAssets = (startAssets + endAssets) / 2;
      const nim = avgAssets > 0 ? (nii / avgAssets) * 4 : 0; // annualized

      // Quarter date label
      const qDate = new Date(startDate);
      qDate.setMonth(qDate.getMonth() + q * 3);
      const dateStr = `${qDate.getFullYear()}-Q${Math.ceil((qDate.getMonth() + 1) / 3)}`;

      quarterResults.push({
        quarter: q,
        date: dateStr,
        totalAssets: this.round2(endAssets),
        totalLiabilities: this.round2(endLiabilities),
        equity: this.round2(equity),
        interestIncome: this.round2(interestIncome),
        interestExpense: this.round2(interestExpense),
        nii: this.round2(nii),
        nim: this.round6(nim),
        cumulativeNII: this.round2(cumulativeNII),
        rateLevel: this.round6(cumulativeRateShockBps / 10_000),
      });
    }

    const totalNII = cumulativeNII;
    const niiValues = quarterResults.map((qr) => qr.nii);
    const nimValues = quarterResults.map((qr) => qr.nim);

    const summary: ScenarioSummary = {
      totalNII: this.round2(totalNII),
      averageNIM: this.round6(
        nimValues.reduce((a, b) => a + b, 0) / nimValues.length,
      ),
      niiChange: 0, // filled in by caller after all scenarios computed
      niiChangePct: 0,
      worstQuarterNII: this.round2(Math.min(...niiValues)),
      bestQuarterNII: this.round2(Math.max(...niiValues)),
      endingEquity: this.round2(equity),
      equityChange: this.round2(equity - bs.equity),
      riskRating: 'LOW', // filled in by caller
    };

    return { name: path.name, quarters: quarterResults, summary };
  }

  private sumBalances(positions: Array<{ balance: number }>): number {
    return positions.reduce((sum, p) => sum + p.balance, 0);
  }

  private classifyRisk(niiChangePct: number): RiskRating {
    if (niiChangePct < 0.05) return 'LOW';
    if (niiChangePct < 0.15) return 'MODERATE';
    if (niiChangePct < 0.25) return 'ELEVATED';
    if (niiChangePct < 0.35) return 'HIGH';
    return 'CRITICAL';
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
