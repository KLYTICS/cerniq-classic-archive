import { Injectable, Logger } from '@nestjs/common';
import { PrismaService } from '../prisma.service';

/**
 * Earnings at Risk (EaR) Service — Quant Model #41
 *
 * Measures the maximum expected decline in Net Interest Income (NII)
 * over a given horizon at a specified confidence level.
 *
 * EaR = NII_base - NII_stressed at (1 - α) confidence
 *
 * Used by COSSEC examiners to assess forward-looking income risk.
 * Complements EVE (which measures balance sheet value risk).
 */

export interface EaRResult {
  baseNII: number;
  horizonQuarters: number;
  confidence: number;
  earAmount: number; // dollars at risk
  earPct: number; // % of base NII
  scenarios: Array<{
    name: string; nameEs: string;
    shockBps: number;
    projectedNII: number;
    niiChange: number;
    niiChangePct: number;
  }>;
  distribution: Array<{ bucket: string; frequency: number; cumulative: number }>;
  interpretation: string;
  interpretationEs: string;
}

@Injectable()
export class EarningsAtRiskService {
  private readonly logger = new Logger(EarningsAtRiskService.name);

  constructor(private readonly prisma: PrismaService) {}

  async calculateEaR(institutionId: string, horizonQuarters = 4, confidence = 0.95): Promise<EaRResult> {
    const institution = await this.prisma.institution.findFirst({ where: { id: institutionId } });
    if (!institution) return this.getDemoEaR(confidence);

    const totalAssets = institution.totalAssets || 18_900_000_000;
    const baseNIM = 0.0362;
    const baseNII = totalAssets * baseNIM;

    return this.computeEaR(baseNII, totalAssets, horizonQuarters, confidence);
  }

  private computeEaR(baseNII: number, totalAssets: number, horizonQ: number, confidence: number): EaRResult {
    // Generate rate scenarios: -300 to +300 bps in 25bp increments
    const scenarios: EaRResult['scenarios'] = [];
    for (let shock = -300; shock <= 300; shock += 25) {
      const sensitivity = -0.018; // NII changes ~1.8% per 100bps
      const niiChangePct = (shock / 100) * sensitivity * 100;
      const projectedNII = baseNII * (1 + niiChangePct / 100);
      scenarios.push({
        name: `${shock >= 0 ? '+' : ''}${shock} bps`,
        nameEs: `${shock >= 0 ? '+' : ''}${shock} pbs`,
        shockBps: shock,
        projectedNII,
        niiChange: projectedNII - baseNII,
        niiChangePct,
      });
    }

    // Monte Carlo: 10,000 paths with stochastic rate moves
    const numSims = 10_000;
    const niiResults: number[] = [];
    const annualVol = 0.015; // 1.5% NII volatility

    for (let i = 0; i < numSims; i++) {
      let cumReturn = 0;
      for (let q = 0; q < horizonQ; q++) {
        cumReturn += this.gaussianRandom() * annualVol * Math.sqrt(0.25);
      }
      niiResults.push(baseNII * (1 + cumReturn));
    }

    niiResults.sort((a, b) => a - b);
    const earIdx = Math.floor(numSims * (1 - confidence));
    const earNII = niiResults[earIdx];
    const earAmount = baseNII - earNII;
    const earPct = (earAmount / baseNII) * 100;

    // Build distribution histogram
    const min = niiResults[0];
    const max = niiResults[niiResults.length - 1];
    const bucketCount = 20;
    const bucketSize = (max - min) / bucketCount;
    const distribution: EaRResult['distribution'] = [];
    for (let i = 0; i < bucketCount; i++) {
      const lo = min + i * bucketSize;
      const hi = lo + bucketSize;
      const count = niiResults.filter(v => v >= lo && v < hi).length;
      distribution.push({
        bucket: `$${(lo / 1_000_000).toFixed(0)}M`,
        frequency: count,
        cumulative: niiResults.filter(v => v < hi).length / numSims,
      });
    }

    const status = earPct < 3 ? 'low' : earPct < 6 ? 'moderate' : 'high';

    return {
      baseNII,
      horizonQuarters: horizonQ,
      confidence,
      earAmount,
      earPct: +earPct.toFixed(2),
      scenarios: scenarios.filter(s => Math.abs(s.shockBps) <= 200),
      distribution,
      interpretation: `Earnings at Risk: $${(earAmount / 1_000_000).toFixed(1)}M (${earPct.toFixed(1)}% of base NII) at ${(confidence * 100).toFixed(0)}% confidence over ${horizonQ} quarters. Risk level: ${status}.`,
      interpretationEs: `Ganancias en Riesgo: $${(earAmount / 1_000_000).toFixed(1)}M (${earPct.toFixed(1)}% del NII base) al ${(confidence * 100).toFixed(0)}% de confianza sobre ${horizonQ} trimestres. Nivel de riesgo: ${status}.`,
    };
  }

  private gaussianRandom(): number {
    const u1 = Math.random();
    const u2 = Math.random();
    return Math.sqrt(-2 * Math.log(u1)) * Math.cos(2 * Math.PI * u2);
  }

  private getDemoEaR(confidence: number): EaRResult {
    const baseNII = 684_000_000;
    return this.computeEaR(baseNII, 18_900_000_000, 4, confidence);
  }
}
