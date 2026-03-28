import { Injectable } from '@nestjs/common';

/**
 * Liquidity Survival Analysis Service
 *
 * Answers the question every board member asks during a crisis:
 * "How many days can we survive?"
 *
 * Runs a day-by-day cash simulation under liquidity stress,
 * tracking deposit run-off, asset liquidation, and wholesale
 * funding drawdowns across a 365-day horizon.
 *
 * Key outputs:
 * - Survival days until cash hits the regulatory floor (or zero)
 * - Daily cash-position waterfall with status flags
 * - Automatic asset-liquidation sequencing (treasuries → MBS → other)
 * - Wholesale funding activation when critical thresholds breach
 * - Bilingual board-ready recommendation
 */

// ─── Types ──────────────────────────────────────────────────────

export interface LiquidAssets {
  cash: number;
  fedFundsDeposits: number;
  treasuries: number;
  agencyMBS: number;
  otherSecurities: number;
}

export interface DailyCashFlows {
  loanRepayments: number;
  depositInflows: number;
  operatingExpenses: number;
  loanDisbursements: number;
}

export interface StressAssumptions {
  depositRunoffRate: number;
  totalDeposits: number;
  loanRepaymentReduction: number;
  newLoanHalt: boolean;
  wholesaleFundingAvailable: boolean;
  wholesaleFundingLimit: number;
}

export interface ContingencyTriggers {
  warningDays: number;
  criticalDays: number;
  minimumCashFloor: number;
}

export interface SurvivalParams {
  liquidAssets: LiquidAssets;
  dailyCashFlows: DailyCashFlows;
  stressAssumptions: StressAssumptions;
  contingencyTriggers: ContingencyTriggers;
}

export type DayStatus = 'NORMAL' | 'WARNING' | 'CRITICAL' | 'EXHAUSTED';

export interface DailyPosition {
  day: number;
  date: string;
  openingCash: number;
  inflows: number;
  outflows: number;
  netFlow: number;
  closingCash: number;
  depositBase: number;
  liquidAssetsSold: number;
  status: DayStatus;
}

export interface LiquidityAction {
  day: number;
  action: string;
  impact: number;
}

export interface LiquidityProfile {
  immediatelyAvailable: number;
  availableWithin7Days: number;
  availableWithin30Days: number;
  totalLiquidityBuffer: number;
}

export type Severity = 'ADEQUATE' | 'TIGHT' | 'STRESSED' | 'CRITICAL';

export interface SurvivalResult {
  survivalDays: number;
  peakStressDay: number;
  peakOutflow: number;
  dailyPositions: DailyPosition[];
  liquidityProfile: LiquidityProfile;
  actions: LiquidityAction[];
  recommendation: string;
  severity: Severity;
}

// ─── Constants ──────────────────────────────────────────────────

const MAX_HORIZON_DAYS = 365;

/** Haircuts applied when liquidating securities under stress */
const HAIRCUTS = {
  treasuries: 0.99,
  agencyMBS: 0.95,
  otherSecurities: 0.90,
} as const;

/** Settlement lag in days for each asset class */
const SETTLEMENT_DAYS = {
  treasuries: 1,
  agencyMBS: 2,
  otherSecurities: 5,
} as const;

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class LiquiditySurvivalService {
  /**
   * Run a full day-by-day liquidity survival simulation.
   */
  analyzeSurvival(params: SurvivalParams): SurvivalResult {
    const { liquidAssets, dailyCashFlows, contingencyTriggers } = params;
    // Clone so we can mutate newLoanHalt mid-simulation
    const stressAssumptions = { ...params.stressAssumptions };

    // Mutable state for the simulation
    let cash = liquidAssets.cash + liquidAssets.fedFundsDeposits;
    let depositBase = stressAssumptions.totalDeposits;
    let remainingTreasuries = liquidAssets.treasuries;
    let remainingMBS = liquidAssets.agencyMBS;
    let remainingOther = liquidAssets.otherSecurities;
    let wholesaleFundingUsed = 0;
    let cumulativeAssetsSold = 0;

    const dailyPositions: DailyPosition[] = [];
    const actions: LiquidityAction[] = [];
    const today = new Date();

    // Track pending settlements: day → cash arriving
    const pendingSettlements = new Map<number, number>();

    let survivalDays = MAX_HORIZON_DAYS;
    let peakOutflow = 0;
    let peakStressDay = 0;
    let exhausted = false;

    for (let day = 1; day <= MAX_HORIZON_DAYS; day++) {
      const openingCash = cash;

      // ── Receive settled security sales ──
      const settled = pendingSettlements.get(day) ?? 0;
      if (settled > 0) {
        cash += settled;
        pendingSettlements.delete(day);
      }

      // ── Inflows ──
      const adjustedLoanRepayments =
        dailyCashFlows.loanRepayments * (1 - stressAssumptions.loanRepaymentReduction);

      // Deposit inflows decay as run-off erodes confidence
      const depositInflowDecay = Math.max(0, 1 - (stressAssumptions.depositRunoffRate * day) / 30);
      const adjustedDepositInflows = dailyCashFlows.depositInflows * depositInflowDecay;

      const inflows = adjustedLoanRepayments + adjustedDepositInflows + settled;

      // ── Outflows ──
      const depositOutflow = depositBase * stressAssumptions.depositRunoffRate;
      const loanOriginations =
        stressAssumptions.newLoanHalt ? 0 : dailyCashFlows.loanDisbursements;
      const outflows = dailyCashFlows.operatingExpenses + depositOutflow + loanOriginations;

      // Track peak outflow
      if (outflows > peakOutflow) {
        peakOutflow = outflows;
        peakStressDay = day;
      }

      // ── Net flow (excluding settled amounts already added to cash) ──
      const netFlowExSettlement =
        (adjustedLoanRepayments + adjustedDepositInflows) - outflows;
      cash += netFlowExSettlement;

      // ── Deposit base decays ──
      depositBase = Math.max(0, depositBase - depositOutflow);

      // ── Estimate remaining survival to decide triggers ──
      const dailyBurn = outflows - (adjustedLoanRepayments + adjustedDepositInflows);
      const estSurvival = dailyBurn > 0 ? cash / dailyBurn : MAX_HORIZON_DAYS;

      // ── Sell securities when warning threshold is breached ──
      if (
        estSurvival <= contingencyTriggers.warningDays &&
        remainingTreasuries > 0
      ) {
        const sellAmount = remainingTreasuries;
        const proceeds = sellAmount * HAIRCUTS.treasuries;
        remainingTreasuries = 0;
        cumulativeAssetsSold += sellAmount;
        const settlementDay = day + SETTLEMENT_DAYS.treasuries;
        pendingSettlements.set(
          settlementDay,
          (pendingSettlements.get(settlementDay) ?? 0) + proceeds,
        );
        actions.push({
          day,
          action: `Sell $${fmt(sellAmount)} Treasury securities (settles day ${settlementDay})`,
          impact: proceeds,
        });
      }

      // ── Sell MBS and other securities at critical threshold ──
      if (estSurvival <= contingencyTriggers.criticalDays) {
        if (remainingMBS > 0) {
          const sellAmount = remainingMBS;
          const proceeds = sellAmount * HAIRCUTS.agencyMBS;
          remainingMBS = 0;
          cumulativeAssetsSold += sellAmount;
          const settlementDay = day + SETTLEMENT_DAYS.agencyMBS;
          pendingSettlements.set(
            settlementDay,
            (pendingSettlements.get(settlementDay) ?? 0) + proceeds,
          );
          actions.push({
            day,
            action: `Sell $${fmt(sellAmount)} Agency MBS (settles day ${settlementDay})`,
            impact: proceeds,
          });
        }
        if (remainingOther > 0) {
          const sellAmount = remainingOther;
          const proceeds = sellAmount * HAIRCUTS.otherSecurities;
          remainingOther = 0;
          cumulativeAssetsSold += sellAmount;
          const settlementDay = day + SETTLEMENT_DAYS.otherSecurities;
          pendingSettlements.set(
            settlementDay,
            (pendingSettlements.get(settlementDay) ?? 0) + proceeds,
          );
          actions.push({
            day,
            action: `Sell $${fmt(sellAmount)} other securities (settles day ${settlementDay})`,
            impact: proceeds,
          });
        }

        // ── Access wholesale funding ──
        if (
          stressAssumptions.wholesaleFundingAvailable &&
          wholesaleFundingUsed < stressAssumptions.wholesaleFundingLimit
        ) {
          const draw = stressAssumptions.wholesaleFundingLimit - wholesaleFundingUsed;
          cash += draw;
          wholesaleFundingUsed += draw;
          actions.push({
            day,
            action: `Draw $${fmt(draw)} wholesale funding (FHLB / Fed window)`,
            impact: draw,
          });
        }

        // ── Halt new lending if not already halted ──
        if (!stressAssumptions.newLoanHalt) {
          stressAssumptions.newLoanHalt = true;
          actions.push({
            day,
            action: 'Halt all new loan originations',
            impact: dailyCashFlows.loanDisbursements,
          });
        }
      }

      // ── Determine day status ──
      let status: DayStatus = 'NORMAL';
      if (cash <= contingencyTriggers.minimumCashFloor) {
        status = 'EXHAUSTED';
      } else if (estSurvival <= contingencyTriggers.criticalDays) {
        status = 'CRITICAL';
      } else if (estSurvival <= contingencyTriggers.warningDays) {
        status = 'WARNING';
      }

      const closingCash = cash;
      const date = new Date(today);
      date.setDate(date.getDate() + day);

      dailyPositions.push({
        day,
        date: date.toISOString().slice(0, 10),
        openingCash: round2(openingCash),
        inflows: round2(inflows),
        outflows: round2(outflows),
        netFlow: round2(inflows - outflows),
        closingCash: round2(closingCash),
        depositBase: round2(depositBase),
        liquidAssetsSold: round2(cumulativeAssetsSold),
        status,
      });

      // ── Stop if cash is below the regulatory floor ──
      if (cash <= contingencyTriggers.minimumCashFloor) {
        survivalDays = day;
        exhausted = true;
        break;
      }
    }

    // ── Liquidity profile ──
    const immediatelyAvailable = liquidAssets.cash + liquidAssets.fedFundsDeposits;
    const availableWithin7Days =
      immediatelyAvailable +
      liquidAssets.treasuries * HAIRCUTS.treasuries +
      liquidAssets.agencyMBS * HAIRCUTS.agencyMBS +
      liquidAssets.otherSecurities * HAIRCUTS.otherSecurities;
    const wholesaleAddon = stressAssumptions.wholesaleFundingAvailable
      ? stressAssumptions.wholesaleFundingLimit
      : 0;
    const availableWithin30Days = availableWithin7Days + wholesaleAddon;

    const liquidityProfile: LiquidityProfile = {
      immediatelyAvailable: round2(immediatelyAvailable),
      availableWithin7Days: round2(availableWithin7Days),
      availableWithin30Days: round2(availableWithin30Days),
      totalLiquidityBuffer: round2(availableWithin30Days),
    };

    // ── Severity classification ──
    const severity = classifySeverity(survivalDays);

    // ── Recommendation ──
    const recommendation = buildRecommendation(survivalDays, severity, exhausted);

    return {
      survivalDays,
      peakStressDay,
      peakOutflow: round2(peakOutflow),
      dailyPositions,
      liquidityProfile,
      actions,
      recommendation,
      severity,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function classifySeverity(survivalDays: number): Severity {
  if (survivalDays > 90) return 'ADEQUATE';
  if (survivalDays >= 30) return 'TIGHT';
  if (survivalDays >= 15) return 'STRESSED';
  return 'CRITICAL';
}

function buildRecommendation(
  survivalDays: number,
  severity: Severity,
  exhausted: boolean,
): string {
  const en = exhausted
    ? `CRITICAL: Liquidity exhausted at day ${survivalDays}. `
    : `Survival horizon: ${survivalDays} days. `;

  const es = exhausted
    ? `CRITICO: Liquidez agotada en el dia ${survivalDays}. `
    : `Horizonte de supervivencia: ${survivalDays} dias. `;

  switch (severity) {
    case 'ADEQUATE':
      return (
        en +
        'Liquidity position is adequate under the stress scenario. No immediate action required. | ' +
        es +
        'Posicion de liquidez adecuada bajo el escenario de estres. No se requiere accion inmediata.'
      );
    case 'TIGHT':
      return (
        en +
        'Liquidity is tight. Activate contingency funding plan and monitor daily. | ' +
        es +
        'Liquidez ajustada. Active el plan de fondeo contingente y monitoree diariamente.'
      );
    case 'STRESSED':
      return (
        en +
        'Liquidity is stressed. Begin asset liquidation and halt new lending immediately. | ' +
        es +
        'Liquidez estresada. Inicie liquidacion de activos y detenga nuevos prestamos inmediatamente.'
      );
    case 'CRITICAL':
      return (
        en +
        'EMERGENCY: Survival is critical. Activate all contingency measures, contact FHLB/Fed, and notify the board. | ' +
        es +
        'EMERGENCIA: Supervivencia critica. Active todas las medidas contingentes, contacte FHLB/Fed y notifique a la junta.'
      );
  }
}

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function fmt(n: number): string {
  if (n >= 1_000_000) return (n / 1_000_000).toFixed(1) + 'M';
  if (n >= 1_000) return (n / 1_000).toFixed(0) + 'K';
  return n.toFixed(0);
}
