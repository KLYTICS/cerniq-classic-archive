import { Injectable } from '@nestjs/common';

/**
 * Margin Compression Analysis — Quant Model #73
 *
 * Measures and forecasts NIM compression from competitive and rate pressures.
 * Critical for cooperativas in competitive deposit markets.
 */
@Injectable()
export class MarginCompressionService {
  analyze(params: {
    historicalNIM: Array<{ quarter: string; nim: number }>;
    assetYield: number; fundingCost: number;
    competitorRates: { savingsRate: number; loanRate: number };
  }): {
    currentNIM: number; trend: 'compressing' | 'stable' | 'expanding';
    annualCompressionBps: number; projectedNIM12M: number;
    assetYieldPressure: number; fundingCostPressure: number;
    interpretation: string; interpretationEs: string;
  } {
    const { historicalNIM, assetYield, fundingCost, competitorRates } = params;
    const n = historicalNIM.length;
    const currentNIM = historicalNIM[n - 1]?.nim ?? assetYield - fundingCost;
    const prevNIM = historicalNIM[Math.max(0, n - 5)]?.nim ?? currentNIM;
    const quarterlyChange = (currentNIM - prevNIM) / Math.min(n, 4);
    const annualCompressionBps = +(quarterlyChange * 4 * 10000).toFixed(0);
    const projectedNIM12M = +(currentNIM + quarterlyChange * 4).toFixed(4);
    const trend = annualCompressionBps < -5 ? 'compressing' : annualCompressionBps > 5 ? 'expanding' : 'stable';
    const assetYieldPressure = +(competitorRates.loanRate - assetYield).toFixed(4);
    const fundingCostPressure = +(fundingCost - competitorRates.savingsRate).toFixed(4);

    return {
      currentNIM, trend, annualCompressionBps, projectedNIM12M, assetYieldPressure, fundingCostPressure,
      interpretation: `NIM ${trend}: ${annualCompressionBps}bps/year. Projected 12M NIM: ${(projectedNIM12M * 100).toFixed(2)}%. ${trend === 'compressing' ? 'Action needed to defend margins.' : 'Margins healthy.'}`,
      interpretationEs: `NIM ${trend === 'compressing' ? 'comprimiendose' : trend === 'expanding' ? 'expandiendose' : 'estable'}: ${annualCompressionBps}pbs/ano. NIM proyectado 12M: ${(projectedNIM12M * 100).toFixed(2)}%. ${trend === 'compressing' ? 'Accion necesaria para defender margenes.' : 'Margenes saludables.'}`,
    };
  }
}
