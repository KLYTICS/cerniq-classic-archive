import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';
import { DataGap, DataGapReason, dataGap } from './reports/data-gap';

// ─── Types ───────────────────────────────────────────────────

/**
 * `simulated` — historical-simulation methodology run over a SYNTHETIC
 * (parametric, not empirical) rate distribution. It is deliberately NOT named
 * `historical`: see `disclosureGaps()` and the WARNING gap on `var.simulated`.
 */
export type VaRMethod = 'simulated' | 'parametric' | 'montecarlo';

export interface VaRResult {
  method: VaRMethod;
  confidenceLevel: number;
  horizon: number; // days
  /** $ value at risk (positive = loss). `null` when inputs are unavailable. */
  var: number | null;
  /** Conditional VaR (expected shortfall). `null` when unavailable. */
  cvar: number | null;
  /** VaR as % of portfolio. `null` when portfolio value is unavailable or 0. */
  varPct: number | null;
  /** $ portfolio value the VaR was computed against. `null` when unavailable. */
  portfolioValue: number | null;
  status: 'ok' | 'data_unavailable';
}

export interface BacktestResult {
  testDays: number;
  exceptions: number | null; // days where actual loss exceeded VaR
  exceptionRate: number | null;
  expectedExceptions: number | null;
  kupiecLR: number | null; // Kupiec likelihood ratio
  kupiecPValue: number | null;
  trafficLight: 'GREEN' | 'AMBER' | 'RED' | null;
  status: 'ok' | 'data_unavailable';
}

export interface VaRSuite {
  simulated: VaRResult;
  parametric: VaRResult;
  montecarlo: VaRResult;
  backtestResult: BacktestResult;
  status: 'ok' | 'data_unavailable';
  /**
   * Disclosure + missing-input manifest (D1 contract). On `data_unavailable`
   * this carries a CRITICAL gap; on `ok` it carries WARNING methodology
   * disclosures (synthetic distribution, fixed-vol assumption). May be empty.
   */
  gaps?: DataGap[];
}

// ─── Synthetic-distribution parameters ───────────────────────
// These shape the SYNTHETIC rate-shock distribution used by the simulated +
// Monte Carlo methods and the Kupiec backtest. They are an explicit modelling
// assumption, disclosed via DataGaps — NOT empirical market calibration.
const DAILY_RATE_VOL_BPS = 5; // assumed daily rate volatility (std), bps
const JUMP_PROB = 0.02; // probability of a fat-tail jump on a given day
const JUMP_BPS = 30; // jump magnitude scale for historical-simulation scenarios
const MC_JUMP_BPS = 25; // jump magnitude scale for the Monte Carlo path shocks

// ─── Reproducible randomness (SR 11-7 model governance) ──────
// Quant outputs MUST be deterministic: the same institution + parameters must
// reproduce byte-identical VaR every run. We mirror the seeded xorshift32 +
// Box-Muller pattern from src/alm/quant/hjm/monte-carlo.ts. No `Math.random()`,
// no `crypto.randomBytes` — both are non-reproducible and a model-validation
// red flag.

/** xorshift32 PRNG. Same seed → same [0, 1) sequence. */
function createSeededRNG(seed: number): () => number {
  // Avoid the xorshift32 stuck-at-zero fixed point.
  let state = seed | 0 || 0x9e3779b9;
  return () => {
    state ^= state << 13;
    state ^= state >> 17;
    state ^= state << 5;
    return (state >>> 0) / 0xffffffff;
  };
}

/** FNV-1a hash of a string → uint32 seed. Stable across runs, distinct per id. */
function seedFromString(s: string): number {
  let h = 0x811c9dc5;
  for (let i = 0; i < s.length; i++) {
    h ^= s.charCodeAt(i);
    h = Math.imul(h, 0x01000193);
  }
  return h >>> 0;
}

/**
 * Box-Muller (polar) standard-normal generator over a seeded uniform RNG. The
 * spare draw lives in a closure (not module state) so each generator instance
 * is independent and reproducible.
 */
function makeGaussian(rng: () => number): () => number {
  let spare: number | null = null;
  return () => {
    if (spare !== null) {
      const cached = spare;
      spare = null;
      return cached;
    }
    let u: number;
    let v: number;
    let s: number;
    do {
      u = 2 * rng() - 1;
      v = 2 * rng() - 1;
      s = u * u + v * v;
    } while (s >= 1 || s === 0);
    const mul = Math.sqrt((-2 * Math.log(s)) / s);
    spare = v * mul;
    const z = u * mul;
    return Number.isFinite(z) ? z : 0;
  };
}

/**
 * Synthetic daily rate-shock scenarios in bps. THIS IS NOT EMPIRICAL MARKET
 * HISTORY — it is a parametric fat-tailed distribution (normal + occasional
 * jump), seeded for reproducibility. The suite discloses this via a DataGap so
 * the `simulated` VaR and the Kupiec backtest are never mistaken for an
 * empirical historical simulation.
 */
function generateSyntheticScenarios(
  rng: () => number,
  gaussian: () => number,
  days: number,
): number[] {
  const scenarios: number[] = [];
  for (let i = 0; i < days; i++) {
    const normal = gaussian() * DAILY_RATE_VOL_BPS; // ~N(0, vol)
    const jump = rng() < JUMP_PROB ? (rng() - 0.5) * JUMP_BPS : 0;
    scenarios.push(normal + jump);
  }
  return scenarios;
}

function round2(x: number): number {
  return Math.round(x * 100) / 100;
}

/** VaR as a percentage of portfolio value, to 2dp. `null` when value <= 0. */
function pctOf(value: number, portfolioValue: number): number | null {
  return portfolioValue > 0
    ? Math.round((value / portfolioValue) * 10000) / 100
    : null;
}

@Injectable()
export class PortfolioVaRService {
  private readonly logger = new Logger(PortfolioVaRService.name);

  constructor(private readonly prisma: PrismaService) {}

  async computeVaRSuite(
    institutionId: string,
    confidenceLevel: 0.95 | 0.99 = 0.95,
    horizon: 1 | 10 = 1,
  ): Promise<VaRSuite> {
    // ── Input validation ──
    if (confidenceLevel !== 0.95 && confidenceLevel !== 0.99) {
      throw new Error(
        `Invalid confidence level: ${confidenceLevel}. Must be 0.95 or 0.99.`,
      );
    }
    if (horizon !== 1 && horizon !== 10) {
      throw new Error(`Invalid horizon: ${horizon}. Must be 1 or 10.`);
    }

    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId, category: 'asset' },
    });

    // `balance` is a Prisma Decimal — coerce with Number() before arithmetic.
    // (A raw `Number.isFinite(decimal)` is always false, which silently zeroed
    // real balances in the previous implementation.)
    const portfolioValue = items.reduce((sum: number, item: any) => {
      const bal = Number(item.balance);
      return sum + (Number.isFinite(bal) ? bal : 0);
    }, 0);

    // ── Honest minimum (D1): never fabricate a portfolio. ──
    // No assets, or no positive total value → render a data_unavailable shell
    // with a CRITICAL gap. NEVER substitute a phantom $445M book.
    if (items.length === 0 || portfolioValue <= 0) {
      const reason: DataGapReason =
        items.length === 0 ? 'EMPTY_BALANCE_SHEET' : 'MISSING_TOTAL_ASSETS';
      this.logger.warn(
        `VaR data_unavailable for institution ${institutionId}: ${reason} ` +
          `(assets=${items.length}, totalValue=${portfolioValue}).`,
      );
      return this.dataUnavailableSuite(
        confidenceLevel,
        horizon,
        reason,
        institutionId,
      );
    }

    // Per-method seeds derived from a stable institution hash. Distinct streams
    // per method (order-independent), identical across runs (reproducible).
    const simulated = this.computeSimulatedVaR(
      items,
      portfolioValue,
      confidenceLevel,
      horizon,
      seedFromString(`${institutionId}:simulated`),
    );
    const parametric = this.computeParametricVaR(
      items,
      portfolioValue,
      confidenceLevel,
      horizon,
    );
    const montecarlo = this.computeMonteCarloVaR(
      items,
      portfolioValue,
      confidenceLevel,
      horizon,
      seedFromString(`${institutionId}:montecarlo`),
    );
    const backtestResult = this.backtestKupiec(
      simulated,
      items,
      confidenceLevel,
      seedFromString(`${institutionId}:backtest`),
    );

    return {
      simulated,
      parametric,
      montecarlo,
      backtestResult,
      status: 'ok',
      gaps: this.disclosureGaps(),
    };
  }

  /** Portfolio DV01 ($ change per 1bp) from real balances × durations. */
  private portfolioDV01(items: any[]): number {
    return items.reduce((sum, item) => {
      const balance = Number(item.balance);
      const duration = Number(item.duration);
      const b = Number.isFinite(balance) ? balance : 0;
      const d = Number.isFinite(duration) ? duration : 1;
      return sum + (b * d) / 10000;
    }, 0);
  }

  // ─── Simulated VaR (historical-simulation method, synthetic scenarios) ───

  /**
   * VaR by the historical-simulation methodology, but over a SYNTHETIC rate
   * distribution rather than empirical market history. Reproducible via the
   * seeded PRNG. The synthetic basis is disclosed by `disclosureGaps()`.
   */
  private computeSimulatedVaR(
    items: any[],
    portfolioValue: number,
    confidenceLevel: number,
    horizon: number,
    seed: number,
  ): VaRResult {
    const dv01 = this.portfolioDV01(items);
    const rng = createSeededRNG(seed);
    const gaussian = makeGaussian(rng);
    const scenarios = generateSyntheticScenarios(rng, gaussian, 1000);

    // Full revaluation reduces to -DV01 × shift (parallel-shift assumption).
    const scaleFactor = Math.sqrt(horizon); // square-root-of-time
    const scaledPnL = scenarios
      .map((bpsShift) => -dv01 * bpsShift * scaleFactor)
      .sort((a, b) => a - b);

    const varIndex = Math.max(
      0,
      Math.floor((1 - confidenceLevel) * scaledPnL.length),
    );
    const var_ = -scaledPnL[varIndex];
    const cvarSlice = scaledPnL.slice(0, Math.max(varIndex, 1));
    const cvar = -cvarSlice.reduce((a, b) => a + b, 0) / cvarSlice.length;

    return {
      method: 'simulated',
      confidenceLevel,
      horizon,
      var: round2(var_),
      cvar: round2(cvar),
      varPct: pctOf(var_, portfolioValue),
      portfolioValue,
      status: 'ok',
    };
  }

  // ─── Parametric (Delta-Normal) VaR ───────────────────────────

  /**
   * The one method backed by REAL portfolio data: a delta-normal VaR over the
   * actual balance-sheet DV01. Uses a fixed DAILY_RATE_VOL_BPS assumption (no
   * empirical vol estimate); that assumption is disclosed via a DataGap.
   */
  private computeParametricVaR(
    items: any[],
    portfolioValue: number,
    confidenceLevel: number,
    horizon: number,
  ): VaRResult {
    const portfolioDV01 = this.portfolioDV01(items);
    const dailyPortfolioVol = portfolioDV01 * DAILY_RATE_VOL_BPS;
    const z = confidenceLevel === 0.99 ? 2.326 : 1.645;
    const var_ = z * dailyPortfolioVol * Math.sqrt(horizon);

    // CVaR for a normal distribution: sigma * phi(z) / (1 - alpha).
    const phiZ = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
    const cvar =
      (dailyPortfolioVol * Math.sqrt(horizon) * phiZ) / (1 - confidenceLevel);

    return {
      method: 'parametric',
      confidenceLevel,
      horizon,
      var: round2(var_),
      cvar: round2(cvar),
      varPct: pctOf(var_, portfolioValue),
      portfolioValue,
      status: 'ok',
    };
  }

  // ─── Monte Carlo VaR ─────────────────────────────────────────

  private computeMonteCarloVaR(
    items: any[],
    portfolioValue: number,
    confidenceLevel: number,
    horizon: number,
    seed: number,
  ): VaRResult {
    const paths = 5000;
    const portfolioDV01 = this.portfolioDV01(items);
    const rng = createSeededRNG(seed);
    const gaussian = makeGaussian(rng);
    const pnlVector: number[] = [];

    for (let p = 0; p < paths; p++) {
      // Simulate the rate change over the horizon (sum of daily shocks).
      let totalShock = 0;
      for (let d = 0; d < horizon; d++) {
        const z = gaussian();
        const jump = rng() < JUMP_PROB ? (rng() - 0.5) * MC_JUMP_BPS : 0;
        totalShock += z * DAILY_RATE_VOL_BPS + jump;
      }
      const pnl = -portfolioDV01 * totalShock;
      pnlVector.push(Number.isFinite(pnl) ? pnl : 0);
    }

    pnlVector.sort((a, b) => a - b);
    const varIndex = Math.max(0, Math.floor((1 - confidenceLevel) * paths));
    const var_ = -pnlVector[varIndex];
    const cvarSlice = pnlVector.slice(0, Math.max(varIndex, 1));
    const cvar = -cvarSlice.reduce((a, b) => a + b, 0) / cvarSlice.length;

    return {
      method: 'montecarlo',
      confidenceLevel,
      horizon,
      var: round2(var_),
      cvar: round2(cvar),
      varPct: pctOf(var_, portfolioValue),
      portfolioValue,
      status: 'ok',
    };
  }

  // ─── Kupiec Backtest ─────────────────────────────────────────

  /**
   * Kupiec POF test + Basel traffic light. NOTE: both the VaR under test and
   * the P&L series are generated from the SAME synthetic rate distribution, so
   * this is a model SELF-CONSISTENCY check, not an empirical backtest against
   * realized market history. Disclosed via the WARNING gap on `var.simulated`.
   */
  private backtestKupiec(
    simulatedVaR: VaRResult,
    items: any[],
    confidenceLevel: number,
    seed: number,
  ): BacktestResult {
    const testDays = 250;
    const dv01 = this.portfolioDV01(items);
    const rng = createSeededRNG(seed);
    const gaussian = makeGaussian(rng);
    const scenarios = generateSyntheticScenarios(rng, gaussian, testDays);
    // P&L uses the same real DV01 as the VaR — the backtest is internally
    // consistent with the simulated VaR it tests.
    const actualPnL = scenarios.map((s) => -dv01 * s);

    const varThreshold = simulatedVaR.var ?? 0;
    const exceptions = actualPnL.filter((pnl) => pnl < -varThreshold).length;
    const exceptionRate = exceptions / testDays;
    const expectedExceptions = testDays * (1 - confidenceLevel);

    // Kupiec LR statistic.
    const p = 1 - confidenceLevel;
    const T = testDays;
    const x = exceptions;

    let kupiecLR: number;
    if (x === 0) {
      // No exceptions: LR = -2 * T * ln(1 - p).
      kupiecLR = -2 * (T * Math.log(1 - p));
    } else if (x === T) {
      // Every day an exception.
      kupiecLR = -2 * T * Math.log(p);
    } else {
      kupiecLR =
        -2 * ((T - x) * Math.log(1 - p) + x * Math.log(p)) +
        2 * ((T - x) * Math.log(1 - x / T) + x * Math.log(x / T));
    }
    if (!Number.isFinite(kupiecLR)) kupiecLR = 0;

    // chi-squared(1) critical values: 3.84 (95%), 6.63 (99%).
    const kupiecPValue = kupiecLR > 6.63 ? 0.01 : kupiecLR > 3.84 ? 0.05 : 0.1;

    // Basel traffic light over a 250-day window.
    let trafficLight: NonNullable<BacktestResult['trafficLight']>;
    if (confidenceLevel === 0.99) {
      // Basel standard: green <= 4, amber 5-9, red >= 10.
      if (exceptions <= 4) trafficLight = 'GREEN';
      else if (exceptions <= 9) trafficLight = 'AMBER';
      else trafficLight = 'RED';
    } else {
      // 95%: expected exceptions = 12.5 for 250 days; thresholds scaled.
      if (exceptions <= 17) trafficLight = 'GREEN';
      else if (exceptions <= 25) trafficLight = 'AMBER';
      else trafficLight = 'RED';
    }

    return {
      testDays,
      exceptions,
      exceptionRate: Math.round(exceptionRate * 10000) / 10000,
      expectedExceptions: Math.round(expectedExceptions * 10) / 10,
      kupiecLR: round2(kupiecLR),
      kupiecPValue,
      trafficLight,
      status: 'ok',
    };
  }

  // ─── Honest-minimum helpers ──────────────────────────────────

  private nullResult(
    method: VaRMethod,
    confidenceLevel: number,
    horizon: number,
  ): VaRResult {
    return {
      method,
      confidenceLevel,
      horizon,
      var: null,
      cvar: null,
      varPct: null,
      portfolioValue: null,
      status: 'data_unavailable',
    };
  }

  private dataUnavailableSuite(
    confidenceLevel: number,
    horizon: number,
    reason: DataGapReason,
    institutionId: string,
  ): VaRSuite {
    const action =
      reason === 'EMPTY_BALANCE_SHEET'
        ? 'Upload the institution’s asset balance sheet (balances + durations) to compute portfolio VaR.'
        : 'Asset balance sheet has no positive total value — verify imported balances before computing VaR.';
    return {
      simulated: this.nullResult('simulated', confidenceLevel, horizon),
      parametric: this.nullResult('parametric', confidenceLevel, horizon),
      montecarlo: this.nullResult('montecarlo', confidenceLevel, horizon),
      backtestResult: {
        testDays: 250,
        exceptions: null,
        exceptionRate: null,
        expectedExceptions: null,
        kupiecLR: null,
        kupiecPValue: null,
        trafficLight: null,
        status: 'data_unavailable',
      },
      status: 'data_unavailable',
      gaps: [
        dataGap('var', reason, {
          severity: 'CRITICAL',
          action,
          context: { institutionId },
        }),
      ],
    };
  }

  /**
   * Methodology disclosures (WARNING — render but flag). CerniQ must never
   * present a model self-consistency check as an empirical backtest, nor a
   * fixed-vol parametric VaR as a market-calibrated one. The honest path to
   * remove these is to wire MarketDataSnapshot history for an empirical VaR.
   */
  private disclosureGaps(): DataGap[] {
    return [
      dataGap('var.simulated', 'INDICATOR_NOT_WIRED', {
        severity: 'WARNING',
        action:
          'Simulated VaR and the Kupiec backtest use a synthetic parametric ' +
          'rate-shock distribution, not empirical market history. The Basel ' +
          'traffic light is a model self-consistency check, not an empirical ' +
          'backtest. Wire MarketDataSnapshot history for an empirical VaR.',
        context: { method: 'simulated', basis: 'synthetic_parametric' },
      }),
      dataGap('var.montecarlo', 'INDICATOR_NOT_WIRED', {
        severity: 'WARNING',
        action:
          `Monte Carlo VaR draws from a synthetic distribution ` +
          `(${DAILY_RATE_VOL_BPS}bps daily vol + jumps), not empirical history.`,
        context: { method: 'montecarlo', basis: 'synthetic_parametric' },
      }),
      dataGap('var.parametric', 'INDICATOR_NOT_WIRED', {
        severity: 'WARNING',
        action:
          `Parametric (delta-normal) VaR uses the real portfolio DV01 with a ` +
          `fixed ${DAILY_RATE_VOL_BPS}bps daily rate-volatility assumption ` +
          `(no empirical vol estimate wired).`,
        context: { method: 'parametric', dailyRateVolBps: DAILY_RATE_VOL_BPS },
      }),
    ];
  }
}
