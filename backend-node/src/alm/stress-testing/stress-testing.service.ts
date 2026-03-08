import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../../prisma.service';
import { AlmEnterpriseService } from '../alm-enterprise.service';

/** Round to n decimal places */
function round(value: number, decimals: number): number {
  const factor = Math.pow(10, decimals);
  return Math.round(value * factor) / factor;
}

// ─── Result Interfaces ────────────────────────────────────────

export interface MonteCarloParams {
  paths: number;         // default 1000
  horizon: number;       // months, default 12
  volatility: number;    // rate vol in bps, default 150
  meanReversion: number; // Vasicek kappa, default 0.15
}

export interface NIIDistribution {
  p5: number;
  p25: number;
  median: number;
  p75: number;
  p95: number;
}

export interface MonteCarloResult {
  paths: number;
  horizon: number;
  ratePaths: number[][]; // sampled paths for charting (max 50)
  niiDistribution: NIIDistribution;
  monthlyNIIBands: Array<{
    month: number;
    p5: number;
    p25: number;
    median: number;
    p75: number;
    p95: number;
  }>;
  worstCaseNII: number;
  expectedNII: number;
  niiAtRisk: number;    // expected - worstCase
}

export interface RegulatoryScenario {
  name: string;
  description: string;
  rateShock: number[];   // monthly rate path in bps
  niImpact: number;
  mveImpact: number;
  lcrImpact: number;
  capitalImpact: number;
  passFailStatus: 'pass' | 'warn' | 'fail';
}

export interface RegulatoryStressResult {
  scenarios: RegulatoryScenario[];
  overallRating: 'resilient' | 'adequate' | 'vulnerable' | 'critical';
}

export interface StressTestResult {
  monteCarlo: MonteCarloResult;
  regulatory: RegulatoryStressResult;
}

// ─── Vasicek Model Parameters ─────────────────────────────────

const DEFAULT_PARAMS: MonteCarloParams = {
  paths: 1000,
  horizon: 12,
  volatility: 150,    // 150 bps annualized vol
  meanReversion: 0.15, // Vasicek kappa
};

// Current Fed Funds rate as mean-reversion target (θ)
// Reads from env or defaults to 4.50% (as of Q1 2026)
const THETA_BPS = parseInt(process.env.FED_FUNDS_RATE_BPS || '450', 10);

@Injectable()
export class StressTestingService {
  private readonly logger = new Logger(StressTestingService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly almEnterprise: AlmEnterpriseService,
  ) {}

  // ─── Monte Carlo Simulation (Vasicek) ─────────────────────────

  async runMonteCarloSimulation(
    institutionId: string,
    params: Partial<MonteCarloParams> = {},
  ): Promise<MonteCarloResult> {
    const p: MonteCarloParams = { ...DEFAULT_PARAMS, ...params };
    this.logger.log(
      `Monte Carlo: ${p.paths} paths, ${p.horizon}mo, vol=${p.volatility}bps, κ=${p.meanReversion}`,
    );

    // Fetch balance sheet data to calculate NII sensitivity
    const items = await this.prisma.balanceSheetItem.findMany({
      where: { institutionId },
    });

    if (items.length === 0) {
      return this.emptyMonteCarloResult(p);
    }

    // Separate floating vs fixed items
    const floatingAssets = items.filter(
      (i) => i.category === 'asset' && i.rateType === 'variable',
    );
    const floatingLiabilities = items.filter(
      (i) => i.category === 'liability' && i.rateType === 'variable',
    );
    const fixedAssets = items.filter(
      (i) => i.category === 'asset' && i.rateType === 'fixed',
    );
    const fixedLiabilities = items.filter(
      (i) => i.category === 'liability' && i.rateType === 'fixed',
    );

    const totalFloatingAssets = floatingAssets.reduce(
      (s, a) => s + a.balance,
      0,
    );
    const totalFloatingLiabilities = floatingLiabilities.reduce(
      (s, l) => s + l.balance,
      0,
    );
    const totalFixedAssets = fixedAssets.reduce((s, a) => s + a.balance, 0);
    const totalFixedLiabilities = fixedLiabilities.reduce(
      (s, l) => s + l.balance,
      0,
    );

    // Weighted average rates
    const avgFloatingAssetRate =
      totalFloatingAssets > 0
        ? floatingAssets.reduce((s, a) => s + a.balance * a.rate, 0) /
          totalFloatingAssets
        : 0;
    const avgFloatingLiabilityRate =
      totalFloatingLiabilities > 0
        ? floatingLiabilities.reduce((s, l) => s + l.balance * l.rate, 0) /
          totalFloatingLiabilities
        : 0;
    const avgFixedAssetRate =
      totalFixedAssets > 0
        ? fixedAssets.reduce((s, a) => s + a.balance * a.rate, 0) /
          totalFixedAssets
        : 0;
    const avgFixedLiabilityRate =
      totalFixedLiabilities > 0
        ? fixedLiabilities.reduce((s, l) => s + l.balance * l.rate, 0) /
          totalFixedLiabilities
        : 0;

    // Current short-term rate (starting point for simulation)
    const r0 = THETA_BPS; // in bps

    // Vasicek: dr = κ(θ - r)dt + σ√dt · ε
    const dt = 1 / 12; // monthly time step
    const kappa = p.meanReversion;
    const theta = THETA_BPS;
    const sigma = p.volatility; // annualized vol in bps
    const sqrtDt = Math.sqrt(dt);

    // Generate all rate paths
    const allPaths: number[][] = [];
    const allNIIPaths: number[] = []; // annual NII for each path

    for (let path = 0; path < p.paths; path++) {
      const ratePath: number[] = [r0];
      let r = r0;

      for (let month = 1; month <= p.horizon; month++) {
        const epsilon = this.boxMullerRandom();
        r = r + kappa * (theta - r) * dt + sigma * sqrtDt * epsilon;
        r = Math.max(0, r); // ZLB — rates can't go below 0
        ratePath.push(round(r, 1));
      }

      allPaths.push(ratePath);

      // Calculate NII under this rate path
      // Average rate change over the horizon
      const avgRate =
        ratePath.reduce((s, v) => s + v, 0) / ratePath.length;
      const rateChangeBps = avgRate - r0;

      // NII = fixed income + floating income - fixed cost - floating cost
      // Floating reprices with rate changes; fixed stays constant
      const fixedIncome = totalFixedAssets * (avgFixedAssetRate / 100) / 12 * p.horizon;
      const floatingIncome =
        totalFloatingAssets *
        ((avgFloatingAssetRate + rateChangeBps / 100) / 100) / 12 * p.horizon;
      const fixedCost = totalFixedLiabilities * (avgFixedLiabilityRate / 100) / 12 * p.horizon;
      const floatingCost =
        totalFloatingLiabilities *
        ((avgFloatingLiabilityRate + rateChangeBps / 100) / 100) / 12 * p.horizon;

      const annualNII = floatingIncome + fixedIncome - floatingCost - fixedCost;
      allNIIPaths.push(round(annualNII, 2));
    }

    // Sort NII for percentile calculation
    const sortedNII = [...allNIIPaths].sort((a, b) => a - b);

    const niiDistribution: NIIDistribution = {
      p5: this.percentile(sortedNII, 5),
      p25: this.percentile(sortedNII, 25),
      median: this.percentile(sortedNII, 50),
      p75: this.percentile(sortedNII, 75),
      p95: this.percentile(sortedNII, 95),
    };

    // Monthly NII bands (for fan chart)
    const monthlyNIIBands = [];
    for (let month = 0; month <= p.horizon; month++) {
      const ratesAtMonth = allPaths.map((path) => path[month]);
      const sorted = [...ratesAtMonth].sort((a, b) => a - b);

      // Convert rates to NII impact at each month
      const rateChanges = sorted.map((r) => r - r0);
      const monthlyNIIs = rateChanges.map((rc) => {
        const floatInc = totalFloatingAssets * ((avgFloatingAssetRate + rc / 100) / 100) / 12;
        const fixInc = totalFixedAssets * (avgFixedAssetRate / 100) / 12;
        const floatCst = totalFloatingLiabilities * ((avgFloatingLiabilityRate + rc / 100) / 100) / 12;
        const fixCst = totalFixedLiabilities * (avgFixedLiabilityRate / 100) / 12;
        return floatInc + fixInc - floatCst - fixCst;
      });
      const sortedMonthlyNII = [...monthlyNIIs].sort((a, b) => a - b);

      monthlyNIIBands.push({
        month,
        p5: round(this.percentile(sortedMonthlyNII, 5), 2),
        p25: round(this.percentile(sortedMonthlyNII, 25), 2),
        median: round(this.percentile(sortedMonthlyNII, 50), 2),
        p75: round(this.percentile(sortedMonthlyNII, 75), 2),
        p95: round(this.percentile(sortedMonthlyNII, 95), 2),
      });
    }

    // Sample 50 paths for charting
    const sampledPaths = allPaths
      .filter((_, i) => i % Math.ceil(p.paths / 50) === 0)
      .slice(0, 50);

    return {
      paths: p.paths,
      horizon: p.horizon,
      ratePaths: sampledPaths,
      niiDistribution,
      monthlyNIIBands,
      worstCaseNII: round(niiDistribution.p5, 2),
      expectedNII: round(niiDistribution.median, 2),
      niiAtRisk: round(niiDistribution.median - niiDistribution.p5, 2),
    };
  }

  // ─── Regulatory Stress Scenarios ─────────────────────────────

  async runRegulatoryStress(
    institutionId: string,
  ): Promise<RegulatoryStressResult> {
    this.logger.log(`Regulatory stress test for institution ${institutionId}`);

    // Get NII sensitivity and LCR data
    const [niiSensitivity, liquidity, durationGap] = await Promise.all([
      this.almEnterprise.calculateNIISensitivity(institutionId),
      this.almEnterprise.calculateLCR(institutionId),
      this.almEnterprise.calculateDurationGap(institutionId),
    ]);

    const baseNII = niiSensitivity.baseNII;
    const baseLCR = liquidity.lcr;
    const gap = durationGap.durationGap;

    // 4 regulatory scenarios
    const scenarios: RegulatoryScenario[] = [
      this.rapidRiseScenario(baseNII, baseLCR, gap, niiSensitivity),
      this.gradualRiseScenario(baseNII, baseLCR, gap, niiSensitivity),
      this.invertedScenario(baseNII, baseLCR, gap, niiSensitivity),
      this.shockDownScenario(baseNII, baseLCR, gap, niiSensitivity),
    ];

    // Overall rating
    const failCount = scenarios.filter((s) => s.passFailStatus === 'fail').length;
    const warnCount = scenarios.filter((s) => s.passFailStatus === 'warn').length;

    let overallRating: RegulatoryStressResult['overallRating'];
    if (failCount >= 2) overallRating = 'critical';
    else if (failCount >= 1) overallRating = 'vulnerable';
    else if (warnCount >= 2) overallRating = 'adequate';
    else overallRating = 'resilient';

    return { scenarios, overallRating };
  }

  // ─── Combined Stress Test ────────────────────────────────────

  async runFullStressTest(
    institutionId: string,
    params: Partial<MonteCarloParams> = {},
  ): Promise<StressTestResult> {
    const [monteCarlo, regulatory] = await Promise.all([
      this.runMonteCarloSimulation(institutionId, params),
      this.runRegulatoryStress(institutionId),
    ]);
    return { monteCarlo, regulatory };
  }

  // ─── Scenario Builders ───────────────────────────────────────

  private rapidRiseScenario(
    baseNII: number,
    baseLCR: number,
    gap: number,
    nii: { scenarios: Array<{ shiftBps: number; niImpact: number; mveImpact: number; niImpactPct: number }> },
  ): RegulatoryScenario {
    // +300bps over 6 months, hold for remaining
    const rateShock = Array.from({ length: 12 }, (_, i) =>
      i < 6 ? Math.round((i + 1) * 50) : 300,
    );
    const scenario300 = nii.scenarios.find((s) => s.shiftBps === 300);
    const niImpact = scenario300?.niImpact ?? baseNII * (gap > 0 ? 0.08 : -0.08);
    const mveImpact = scenario300?.mveImpact ?? -baseNII * 0.15;
    const lcrImpact = round(baseLCR * 0.92, 2); // LCR typically drops ~8% in rapid rise
    const capitalImpact = round(mveImpact / (baseNII * 10) * 100, 2); // rough capital ratio impact

    return {
      name: 'Rapid Rise',
      description: '+300bps over 6 months — sudden tightening cycle, stress on fixed-rate assets',
      rateShock,
      niImpact: round(niImpact, 2),
      mveImpact: round(mveImpact, 2),
      lcrImpact,
      capitalImpact,
      passFailStatus: this.assessPassFail(niImpact, baseNII, lcrImpact),
    };
  }

  private gradualRiseScenario(
    baseNII: number,
    baseLCR: number,
    gap: number,
    nii: { scenarios: Array<{ shiftBps: number; niImpact: number; mveImpact: number; niImpactPct: number }> },
  ): RegulatoryScenario {
    // +25bps per quarter for 8 quarters = +200bps
    const rateShock = Array.from({ length: 12 }, (_, i) =>
      Math.round(Math.min((Math.floor(i / 3) + 1) * 25, 200)),
    );
    const scenario200 = nii.scenarios.find((s) => s.shiftBps === 200);
    const niImpact = scenario200
      ? scenario200.niImpact * 0.7 // gradual has less impact than instant
      : baseNII * (gap > 0 ? 0.04 : -0.04);
    const mveImpact = scenario200?.mveImpact ?? -baseNII * 0.08;
    const lcrImpact = round(baseLCR * 0.96, 2);
    const capitalImpact = round(mveImpact / (baseNII * 10) * 100, 2);

    return {
      name: 'Gradual Rise',
      description: '+25bps per quarter for 2 years — orderly tightening, manageable repricing',
      rateShock,
      niImpact: round(niImpact, 2),
      mveImpact: round(mveImpact, 2),
      lcrImpact,
      capitalImpact,
      passFailStatus: this.assessPassFail(niImpact, baseNII, lcrImpact),
    };
  }

  private invertedScenario(
    baseNII: number,
    baseLCR: number,
    gap: number,
    nii: { scenarios: Array<{ shiftBps: number; niImpact: number; mveImpact: number; niImpactPct: number }> },
  ): RegulatoryScenario {
    // Short rates +200bps, long rates flat (yield curve inversion)
    const rateShock = Array.from({ length: 12 }, () => 200);
    const scenario200 = nii.scenarios.find((s) => s.shiftBps === 200);
    // Inversion is worse for banks: short liabilities reprice up, long assets don't move
    const niImpact = scenario200
      ? scenario200.niImpact * 0.6 - baseNII * 0.03 // additional NIM compression from flattening
      : -baseNII * 0.05;
    const mveImpact = scenario200 ? scenario200.mveImpact * 0.5 : -baseNII * 0.05;
    const lcrImpact = round(baseLCR * 0.88, 2); // more stress
    const capitalImpact = round(mveImpact / (baseNII * 10) * 100, 2);

    return {
      name: 'Yield Curve Inversion',
      description: 'Short rates +200bps, long rates flat — NIM compression, deposit competition',
      rateShock,
      niImpact: round(niImpact, 2),
      mveImpact: round(mveImpact, 2),
      lcrImpact,
      capitalImpact,
      passFailStatus: this.assessPassFail(niImpact, baseNII, lcrImpact),
    };
  }

  private shockDownScenario(
    baseNII: number,
    baseLCR: number,
    gap: number,
    nii: { scenarios: Array<{ shiftBps: number; niImpact: number; mveImpact: number; niImpactPct: number }> },
  ): RegulatoryScenario {
    // -200bps immediate
    const rateShock = Array.from({ length: 12 }, () => -200);
    const scenarioDown = nii.scenarios.find((s) => s.shiftBps === -200);
    const niImpact = scenarioDown?.niImpact ?? baseNII * (gap > 0 ? -0.06 : 0.04);
    const mveImpact = scenarioDown?.mveImpact ?? baseNII * (gap > 0 ? 0.10 : -0.05);
    const lcrImpact = round(baseLCR * 1.05, 2); // rates down can improve liquidity
    const capitalImpact = round(mveImpact / (baseNII * 10) * 100, 2);

    return {
      name: 'Shock Down',
      description: '-200bps immediate — recession/deflation, asset-sensitive banks lose NII',
      rateShock,
      niImpact: round(niImpact, 2),
      mveImpact: round(mveImpact, 2),
      lcrImpact,
      capitalImpact,
      passFailStatus: this.assessPassFail(niImpact, baseNII, lcrImpact),
    };
  }

  // ─── Helpers ──────────────────────────────────────────────────

  private assessPassFail(
    niImpact: number,
    baseNII: number,
    lcrImpact: number,
  ): 'pass' | 'warn' | 'fail' {
    const niImpactPct = baseNII !== 0 ? Math.abs(niImpact / baseNII) * 100 : 0;
    // Fail: NII drops > 15% or LCR goes below 100%
    if (niImpactPct > 15 && niImpact < 0) return 'fail';
    if (lcrImpact < 100) return 'fail';
    // Warn: NII drops > 8% or LCR buffer < 10%
    if (niImpactPct > 8 && niImpact < 0) return 'warn';
    if (lcrImpact < 110) return 'warn';
    return 'pass';
  }

  /** Box-Muller transform for standard normal random numbers */
  private boxMullerRandom(): number {
    let u = 0;
    let v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }

  private percentile(sorted: number[], pct: number): number {
    if (sorted.length === 0) return 0;
    const index = (pct / 100) * (sorted.length - 1);
    const lower = Math.floor(index);
    const upper = Math.ceil(index);
    if (lower === upper) return sorted[lower];
    const weight = index - lower;
    return round(sorted[lower] * (1 - weight) + sorted[upper] * weight, 2);
  }

  private emptyMonteCarloResult(p: MonteCarloParams): MonteCarloResult {
    return {
      paths: p.paths,
      horizon: p.horizon,
      ratePaths: [],
      niiDistribution: { p5: 0, p25: 0, median: 0, p75: 0, p95: 0 },
      monthlyNIIBands: Array.from({ length: p.horizon + 1 }, (_, month) => ({
        month,
        p5: 0, p25: 0, median: 0, p75: 0, p95: 0,
      })),
      worstCaseNII: 0,
      expectedNII: 0,
      niiAtRisk: 0,
    };
  }
}
