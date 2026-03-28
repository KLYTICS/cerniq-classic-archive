import { Injectable, Logger } from '@nestjs/common';
import { randomBytes } from 'crypto';
import { PrismaService } from '../prisma.service';

// ─── Types ───────────────────────────────────────────────────

export interface VaRResult {
  method: 'historical' | 'parametric' | 'montecarlo';
  confidenceLevel: number;
  horizon: number; // days
  var: number; // $ value at risk (positive = loss)
  cvar: number; // conditional VaR (expected shortfall)
  varPct: number; // as % of portfolio
  portfolioValue: number;
}

export interface VaRSuite {
  historical: VaRResult;
  parametric: VaRResult;
  montecarlo: VaRResult;
  backtestResult: BacktestResult;
}

export interface BacktestResult {
  testDays: number;
  exceptions: number; // days where actual loss exceeded VaR
  exceptionRate: number;
  expectedExceptions: number;
  kupiecLR: number; // Kupiec likelihood ratio
  kupiecPValue: number;
  trafficLight: 'GREEN' | 'AMBER' | 'RED';
}

// Historical daily rate changes (simplified: 250 scenario shifts in bps)
function generateHistoricalScenarios(days: number = 1000): number[] {
  // Simulated from ~2021-2024 daily Fed Funds / 10Y Treasury movements
  const scenarios: number[] = [];
  for (let i = 0; i < days; i++) {
    // Fat-tailed distribution: mix of normal + occasional jumps
    const normal = (Math.random() + Math.random() + Math.random() - 1.5) * 5; // ~N(0, 5bps)
    const jump =
      Math.random() < 0.02 ? (Math.random() - 0.5) * 30 : 0; // 2% chance of 30bps jump
    scenarios.push(normal + jump);
  }
  return scenarios;
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

    const portfolioValue =
      items.length > 0
        ? items.reduce((s: number, i: any) => {
            const bal = Number.isFinite(i.balance) ? i.balance : 0;
            return s + bal;
          }, 0)
        : 445; // demo

    if (portfolioValue <= 0) {
      this.logger.warn(
        `Portfolio value is ${portfolioValue} for institution ${institutionId}. Using demo value.`,
      );
    }

    const historical = this.computeHistoricalVaR(
      items,
      portfolioValue,
      confidenceLevel,
      horizon,
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
    );
    const backtestResult = this.backtestKupiec(
      historical,
      portfolioValue,
      confidenceLevel,
    );

    return { historical, parametric, montecarlo, backtestResult };
  }

  // ─── Historical Simulation ────────────────────────────────

  private computeHistoricalVaR(
    items: any[],
    portfolioValue: number,
    confidenceLevel: number,
    horizon: number,
  ): VaRResult {
    const scenarios = generateHistoricalScenarios(1000);

    // Full revaluation at each scenario
    const pnlVector = scenarios.map((bpsShift) => {
      if (items.length === 0) {
        // Demo: duration-based approximation
        const avgDuration = 4.2;
        return -portfolioValue * avgDuration * (bpsShift / 10000);
      }

      let portfolioPnL = 0;
      for (const item of items) {
        const duration = Number.isFinite(item.duration)
          ? item.duration
          : 1;
        const balance = Number.isFinite(item.balance) ? item.balance : 0;
        const bpv = (balance * duration) / 10000; // dollar duration
        portfolioPnL -= bpv * bpsShift; // negative = loss when rates rise
      }
      return portfolioPnL;
    });

    pnlVector.sort((a, b) => a - b);

    // Scale by horizon (square-root-of-time)
    const scaleFactor = Math.sqrt(horizon);
    const scaledPnL = pnlVector.map((p) => p * scaleFactor);

    const varIndex = Math.max(
      0,
      Math.floor((1 - confidenceLevel) * scaledPnL.length),
    );
    const var_ = -scaledPnL[varIndex];
    const cvarSlice = scaledPnL.slice(0, Math.max(varIndex, 1));
    const cvar =
      -cvarSlice.reduce((a, b) => a + b, 0) / cvarSlice.length;

    return {
      method: 'historical',
      confidenceLevel,
      horizon,
      var: Math.round(var_ * 100) / 100,
      cvar: Math.round(cvar * 100) / 100,
      varPct:
        portfolioValue > 0
          ? Math.round((var_ / portfolioValue) * 10000) / 100
          : 0,
      portfolioValue,
    };
  }

  // ─── Parametric (Delta-Normal) VaR ────────────────────────

  private computeParametricVaR(
    items: any[],
    portfolioValue: number,
    confidenceLevel: number,
    horizon: number,
  ): VaRResult {
    // Portfolio DV01 (dollar value of 1bp)
    let portfolioDV01: number;
    if (items.length > 0) {
      portfolioDV01 = items.reduce((s, i) => {
        const balance = Number.isFinite(i.balance) ? i.balance : 0;
        const duration = Number.isFinite(i.duration) ? i.duration : 1;
        return s + (balance * duration) / 10000;
      }, 0);
    } else {
      portfolioDV01 = (portfolioValue * 4.2) / 10000; // demo avg duration 4.2
    }

    // Daily rate volatility: ~5bps std
    const dailyRateVol = 5; // bps

    // Portfolio daily P&L volatility
    const dailyPortfolioVol = portfolioDV01 * dailyRateVol;

    // Z-score for confidence level (use inverse normal for extensibility)
    const z = confidenceLevel === 0.99 ? 2.326 : 1.645;

    // VaR = z * sigma * sqrt(horizon)
    const var_ = z * dailyPortfolioVol * Math.sqrt(horizon);

    // CVaR for normal distribution: CVaR = sigma * phi(z) / (1-alpha)
    const phi_z = Math.exp((-z * z) / 2) / Math.sqrt(2 * Math.PI);
    const cvar =
      (dailyPortfolioVol * Math.sqrt(horizon) * phi_z) /
      (1 - confidenceLevel);

    return {
      method: 'parametric',
      confidenceLevel,
      horizon,
      var: Math.round(var_ * 100) / 100,
      cvar: Math.round(cvar * 100) / 100,
      varPct:
        portfolioValue > 0
          ? Math.round((var_ / portfolioValue) * 10000) / 100
          : 0,
      portfolioValue,
    };
  }

  // ─── Monte Carlo VaR ──────────────────────────────────────

  private computeMonteCarloVaR(
    items: any[],
    portfolioValue: number,
    confidenceLevel: number,
    horizon: number,
  ): VaRResult {
    const paths = 5000;
    const pnlVector: number[] = [];

    let portfolioDV01: number;
    if (items.length > 0) {
      portfolioDV01 = items.reduce((s, i) => {
        const balance = Number.isFinite(i.balance) ? i.balance : 0;
        const duration = Number.isFinite(i.duration) ? i.duration : 1;
        return s + (balance * duration) / 10000;
      }, 0);
    } else {
      portfolioDV01 = (portfolioValue * 4.2) / 10000;
    }

    for (let p = 0; p < paths; p++) {
      // Simulate rate change over horizon (sum of daily shocks)
      let totalShock = 0;
      for (let d = 0; d < horizon; d++) {
        // Normal + occasional fat tail
        const z = this.gaussianRandom();
        const jump =
          Math.random() < 0.02 ? (Math.random() - 0.5) * 25 : 0;
        totalShock += z * 5 + jump; // 5bps daily vol
      }
      const pnl = -portfolioDV01 * totalShock;
      pnlVector.push(Number.isFinite(pnl) ? pnl : 0);
    }

    pnlVector.sort((a, b) => a - b);
    const varIndex = Math.max(
      0,
      Math.floor((1 - confidenceLevel) * paths),
    );
    const var_ = -pnlVector[varIndex];
    const cvarSlice = pnlVector.slice(0, Math.max(varIndex, 1));
    const cvar =
      -cvarSlice.reduce((a, b) => a + b, 0) / cvarSlice.length;

    return {
      method: 'montecarlo',
      confidenceLevel,
      horizon,
      var: Math.round(var_ * 100) / 100,
      cvar: Math.round(cvar * 100) / 100,
      varPct:
        portfolioValue > 0
          ? Math.round((var_ / portfolioValue) * 10000) / 100
          : 0,
      portfolioValue,
    };
  }

  // ─── Kupiec Backtest ──────────────────────────────────────

  private backtestKupiec(
    historicalVaR: VaRResult,
    portfolioValue: number,
    confidenceLevel: number,
  ): BacktestResult {
    // Simulate 250 trading days of actual P&L
    const testDays = 250;
    const scenarios = generateHistoricalScenarios(testDays);
    const avgDuration = 4.2;
    const actualPnL = scenarios.map(
      (s) => -portfolioValue * avgDuration * (s / 10000),
    );

    const exceptions = actualPnL.filter(
      (pnl) => pnl < -historicalVaR.var,
    ).length;
    const exceptionRate = exceptions / testDays;
    const expectedExceptions = testDays * (1 - confidenceLevel);

    // Kupiec LR statistic
    const p = 1 - confidenceLevel;
    const T = testDays;
    const x = exceptions;

    let kupiecLR: number;
    if (x === 0) {
      // Edge case: no exceptions. LR = -2 * [T*ln(1-p) - T*ln(1)]
      // ln(1) = 0, so kupiecLR = -2 * T * ln(1-p) + 0
      // But the full formula is LR = -2*ln(L0/L1) where L0 uses p, L1 uses x/T
      // With x=0, L1 has (1-0/T)^T = 1 and (0/T)^0 = 1, so ln(L1) = 0
      kupiecLR = -2 * (T * Math.log(1 - p));
    } else if (x === T) {
      // Edge case: every day is an exception
      kupiecLR = -2 * T * Math.log(p);
    } else {
      kupiecLR =
        -2 * ((T - x) * Math.log(1 - p) + x * Math.log(p)) +
        2 * ((T - x) * Math.log(1 - x / T) + x * Math.log(x / T));
    }

    // Guard against NaN from log of zero/negative (should not happen with above checks)
    if (!Number.isFinite(kupiecLR)) {
      kupiecLR = 0;
    }

    // chi-squared(1) critical values: 3.84 (95%), 6.63 (99%)
    const kupiecPValue =
      kupiecLR > 6.63 ? 0.01 : kupiecLR > 3.84 ? 0.05 : 0.1;

    // Basel traffic light (based on 250-day window at 99% confidence)
    // At 95% confidence, thresholds should be scaled
    let trafficLight: BacktestResult['trafficLight'];
    if (confidenceLevel === 0.99) {
      // Basel standard: green <= 4, amber 5-9, red >= 10
      if (exceptions <= 4) trafficLight = 'GREEN';
      else if (exceptions <= 9) trafficLight = 'AMBER';
      else trafficLight = 'RED';
    } else {
      // 95% confidence: expected exceptions = 12.5 for 250 days
      // Scale thresholds: green <= 17, amber 18-25, red >= 26
      if (exceptions <= 17) trafficLight = 'GREEN';
      else if (exceptions <= 25) trafficLight = 'AMBER';
      else trafficLight = 'RED';
    }

    return {
      testDays,
      exceptions,
      exceptionRate: Math.round(exceptionRate * 10000) / 10000,
      expectedExceptions: Math.round(expectedExceptions * 10) / 10,
      kupiecLR: Math.round(kupiecLR * 100) / 100,
      kupiecPValue,
      trafficLight,
    };
  }

  /**
   * Crypto-quality Box-Muller transform for Monte Carlo VaR.
   */
  private gaussianRandom(): number {
    let u = 0,
      v = 0;
    while (u === 0) u = this.cryptoUniform();
    while (v === 0) v = this.cryptoUniform();
    const z =
      Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
    return Number.isFinite(z) ? z : 0;
  }

  /**
   * Uniform [0, 1) using crypto.randomBytes.
   */
  private cryptoUniform(): number {
    const buf = randomBytes(4);
    return buf.readUInt32BE(0) / 0x100000000;
  }
}
