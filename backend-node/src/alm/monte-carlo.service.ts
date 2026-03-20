import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';

// ─── Types ───────────────────────────────────────────────────

export interface VasicekParams {
  kappa: number;  // mean reversion speed
  theta: number;  // long-run mean rate
  sigma: number;  // volatility
  r0: number;     // current short rate
}

export interface MonteCarloResult {
  paths: number;
  quarters: number;
  vasicekParams: VasicekParams;
  meanNII: number;
  stdNII: number;
  var95NII: number;     // 5th percentile (worst-case)
  cvar99NII: number;    // expected value of worst 1%
  meanEVE: number;
  var95EVE: number;
  fanChart: Array<{
    quarter: string;
    p5: number;
    p25: number;
    p50: number;
    p75: number;
    p95: number;
  }>;
  distribution: {
    buckets: Array<{ min: number; max: number; count: number }>;
    mean: number;
    std: number;
  };
}

// Default Vasicek calibration (approximate from FRED Fed Funds 2015-2024)
const DEFAULT_PARAMS: VasicekParams = {
  kappa: 0.15,    // moderate mean reversion
  theta: 0.035,   // 3.5% long-run neutral rate
  sigma: 0.012,   // annualized volatility
  r0: 0.0475,     // current Fed Funds rate
};

@Injectable()
export class MonteCarloService {
  private readonly logger = new Logger(MonteCarloService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ─── Run Full Simulation ──────────────────────────────────

  async runSimulation(
    institutionId: string,
    opts?: { paths?: number; quarters?: number; kappa?: number; theta?: number; sigma?: number },
  ): Promise<MonteCarloResult> {
    const paths = opts?.paths ?? 10000;
    const quarters = opts?.quarters ?? 12;
    const dt = 0.25; // quarterly time step

    const params: VasicekParams = {
      kappa: opts?.kappa ?? DEFAULT_PARAMS.kappa,
      theta: opts?.theta ?? DEFAULT_PARAMS.theta,
      sigma: opts?.sigma ?? DEFAULT_PARAMS.sigma,
      r0: DEFAULT_PARAMS.r0,
    };

    const items = await this.prisma.balanceSheetItem.findMany({ where: { institutionId } });

    this.logger.log(`Monte Carlo: ${paths} paths × ${quarters}Q for institution ${institutionId}`);

    // Generate rate paths (Vasicek discretization with antithetic variates)
    const ratePaths = this.generateVasicekPaths(params, dt, quarters, paths);

    // Compute NII for each path
    const niiByPath: number[] = new Array(paths);
    const niiByQuarter: number[][] = Array.from({ length: quarters }, () => new Array(paths));

    for (let p = 0; p < paths; p++) {
      let totalNII = 0;
      for (let q = 0; q < quarters; q++) {
        const r = ratePaths[p][q];
        const quarterNII = this.computeQuarterNII(items, r, q);
        niiByQuarter[q][p] = quarterNII;
        totalNII += quarterNII;
      }
      niiByPath[p] = totalNII;
    }

    // Statistics
    niiByPath.sort((a, b) => a - b);
    const mean = niiByPath.reduce((a, b) => a + b, 0) / paths;
    const variance = niiByPath.reduce((a, v) => a + (v - mean) ** 2, 0) / paths;
    const std = Math.sqrt(variance);
    const var95Index = Math.floor(paths * 0.05);
    const var95 = niiByPath[var95Index];
    const cvar99Index = Math.floor(paths * 0.01);
    const cvar99 = niiByPath.slice(0, cvar99Index).reduce((a, b) => a + b, 0) / Math.max(cvar99Index, 1);

    // Fan chart: percentiles by quarter
    const fanChart = Array.from({ length: quarters }, (_, q) => {
      const qValues = [...niiByQuarter[q]].sort((a, b) => a - b);
      const now = new Date();
      const qDate = new Date(now.getFullYear(), now.getMonth() + (q + 1) * 3, 1);
      return {
        quarter: `Q${Math.ceil((qDate.getMonth() + 1) / 3)} ${qDate.getFullYear()}`,
        p5: qValues[Math.floor(paths * 0.05)],
        p25: qValues[Math.floor(paths * 0.25)],
        p50: qValues[Math.floor(paths * 0.50)],
        p75: qValues[Math.floor(paths * 0.75)],
        p95: qValues[Math.floor(paths * 0.95)],
      };
    });

    // Distribution histogram (20 buckets)
    const minNII = niiByPath[0];
    const maxNII = niiByPath[paths - 1];
    const bucketWidth = (maxNII - minNII) / 20 || 1;
    const buckets: MonteCarloResult['distribution']['buckets'] = [];
    for (let i = 0; i < 20; i++) {
      const bMin = minNII + i * bucketWidth;
      const bMax = bMin + bucketWidth;
      const count = niiByPath.filter(v => v >= bMin && (i === 19 ? v <= bMax : v < bMax)).length;
      buckets.push({ min: +bMin.toFixed(2), max: +bMax.toFixed(2), count });
    }

    return {
      paths,
      quarters,
      vasicekParams: params,
      meanNII: +mean.toFixed(3),
      stdNII: +std.toFixed(3),
      var95NII: +var95.toFixed(3),
      cvar99NII: +cvar99.toFixed(3),
      meanEVE: 0, // simplified — full EVE MC is Phase V+
      var95EVE: 0,
      fanChart: fanChart.map(f => ({
        ...f,
        p5: +f.p5.toFixed(3),
        p25: +f.p25.toFixed(3),
        p50: +f.p50.toFixed(3),
        p75: +f.p75.toFixed(3),
        p95: +f.p95.toFixed(3),
      })),
      distribution: { buckets, mean: +mean.toFixed(3), std: +std.toFixed(3) },
    };
  }

  // ─── Vasicek Path Generator ───────────────────────────────

  private generateVasicekPaths(
    params: VasicekParams, dt: number, quarters: number, paths: number,
  ): number[][] {
    const { kappa, theta, sigma, r0 } = params;
    const result: number[][] = [];
    const halfPaths = Math.floor(paths / 2);

    for (let p = 0; p < halfPaths; p++) {
      const path1: number[] = new Array(quarters);
      const path2: number[] = new Array(quarters); // antithetic
      let r1 = r0;
      let r2 = r0;

      for (let q = 0; q < quarters; q++) {
        const z = this.gaussianRandom();
        const dW = sigma * Math.sqrt(dt) * z;

        r1 = r1 + kappa * (theta - r1) * dt + dW;
        r2 = r2 + kappa * (theta - r2) * dt - dW; // antithetic

        path1[q] = Math.max(0, r1);
        path2[q] = Math.max(0, r2);
      }

      result.push(path1, path2);
    }

    // Handle odd paths
    if (paths % 2 !== 0) {
      const path: number[] = new Array(quarters);
      let r = r0;
      for (let q = 0; q < quarters; q++) {
        const z = this.gaussianRandom();
        r = r + kappa * (theta - r) * dt + sigma * Math.sqrt(dt) * z;
        path[q] = Math.max(0, r);
      }
      result.push(path);
    }

    return result;
  }

  // ─── Compute Quarter NII at Given Rate ────────────────────

  private computeQuarterNII(items: any[], rate: number, quarter: number): number {
    if (items.length === 0) {
      // Demo: generate realistic NII based on rate level
      const baseNII = 3.2; // $3.2M quarterly
      const rateSensitivity = 0.5; // 50% asset-sensitive
      const rateChange = rate - DEFAULT_PARAMS.r0;
      return baseNII + baseNII * rateChange * rateSensitivity;
    }

    let nii = 0;
    for (const item of items) {
      const isAsset = item.category === 'asset';
      const balance = item.balance;
      const baseRate = item.rate;
      const beta = item.depositBeta ?? (isAsset ? 1.0 : this.getDefaultBeta(item.subcategory));

      // Variable-rate reprices immediately; fixed-rate reprices at maturity
      const repricingQuarter = item.rateType === 'variable' ? 0 : Math.floor(item.duration * 4);
      const hasRepriced = quarter >= repricingQuarter;

      const effectiveRate = hasRepriced
        ? baseRate + (rate - DEFAULT_PARAMS.r0) * beta
        : baseRate;

      const quarterIncome = balance * effectiveRate / 4;
      nii += isAsset ? quarterIncome : -quarterIncome;
    }

    return nii;
  }

  private getDefaultBeta(subcategory: string): number {
    const s = (subcategory || '').toLowerCase();
    if (s.includes('demand') || s.includes('checking')) return 0.10;
    if (s.includes('saving')) return 0.40;
    if (s.includes('time') || s.includes('cd')) return 0.80;
    return 0.50;
  }

  // Box-Muller transform
  private gaussianRandom(): number {
    let u = 0, v = 0;
    while (u === 0) u = Math.random();
    while (v === 0) v = Math.random();
    return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
  }
}
