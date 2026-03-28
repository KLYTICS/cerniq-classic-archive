import { Injectable } from '@nestjs/common';

/**
 * Loan Loss Reserve Adequacy Service — Quant Model #55
 *
 * Evaluates whether the ALLL (Allowance for Loan and Lease Losses)
 * is adequate relative to the loan portfolio's risk profile.
 *
 * Combines:
 * - Historical loss rate (incurred loss model)
 * - CECL forward-looking estimate
 * - Qualitative factors (Q-factors: 9 COSSEC/NCUA adjustment factors)
 * - Coverage ratio analysis vs. peers
 */
@Injectable()
export class LoanLossReserveService {
  analyze(params: {
    totalLoans: number;
    currentALLL: number;
    netChargeOffs: number;
    delinquent30: number;
    delinquent60: number;
    delinquent90: number;
    nonPerforming: number;
    ceclEstimate?: number;
    peerCoverageRatio?: number;
  }): {
    coverageRatio: number;
    adequacy: 'adequate' | 'marginal' | 'deficient';
    historicalLossRate: number;
    adjustedReserve: number;
    gap: number;
    qFactors: Array<{ factor: string; factorEs: string; adjustment: number; reason: string }>;
    interpretation: string;
    interpretationEs: string;
  } {
    const { totalLoans, currentALLL, netChargeOffs, delinquent30, delinquent60, delinquent90, nonPerforming, ceclEstimate, peerCoverageRatio = 1.5 } = params;

    const coverageRatio = (currentALLL / totalLoans) * 100;
    const historicalLossRate = (netChargeOffs / totalLoans) * 100;
    const delinquencyRate = ((delinquent30 + delinquent60 + delinquent90) / totalLoans) * 100;
    const nplRatio = (nonPerforming / totalLoans) * 100;

    // Q-factors (qualitative adjustments)
    const qFactors = [
      { factor: 'Lending policies', factorEs: 'Politicas de prestamo', adjustment: delinquencyRate > 3 ? 0.15 : 0, reason: `Delinquency rate: ${delinquencyRate.toFixed(1)}%` },
      { factor: 'Economic conditions', factorEs: 'Condiciones economicas', adjustment: 0.10, reason: 'PR economy: moderate growth with hurricane risk' },
      { factor: 'Portfolio composition', factorEs: 'Composicion del portafolio', adjustment: nplRatio > 2 ? 0.20 : 0.05, reason: `NPL ratio: ${nplRatio.toFixed(1)}%` },
      { factor: 'Credit concentration', factorEs: 'Concentracion crediticia', adjustment: 0.08, reason: 'Sector concentration within PR cooperativa market' },
      { factor: 'Loss trend', factorEs: 'Tendencia de perdidas', adjustment: historicalLossRate > 1 ? 0.12 : 0.03, reason: `Historical loss rate: ${historicalLossRate.toFixed(2)}%` },
    ];

    const totalQFactor = qFactors.reduce((s, q) => s + q.adjustment, 0);
    const baseReserve = historicalLossRate / 100 * totalLoans;
    const adjustedReserve = baseReserve * (1 + totalQFactor) + (ceclEstimate ?? baseReserve * 0.3);
    const gap = adjustedReserve - currentALLL;

    const adequacy = coverageRatio >= peerCoverageRatio ? 'adequate' : coverageRatio >= peerCoverageRatio * 0.75 ? 'marginal' : 'deficient';

    return {
      coverageRatio: +coverageRatio.toFixed(2),
      adequacy,
      historicalLossRate: +historicalLossRate.toFixed(3),
      adjustedReserve: +adjustedReserve.toFixed(2),
      gap: +gap.toFixed(2),
      qFactors,
      interpretation: `Coverage ratio: ${coverageRatio.toFixed(2)}% (peer: ${peerCoverageRatio.toFixed(1)}%). Reserve ${adequacy}. ${gap > 0 ? `Shortfall: $${(gap / 1e6).toFixed(1)}M.` : `Excess: $${(Math.abs(gap) / 1e6).toFixed(1)}M.`}`,
      interpretationEs: `Ratio cobertura: ${coverageRatio.toFixed(2)}% (pares: ${peerCoverageRatio.toFixed(1)}%). Reserva ${adequacy === 'adequate' ? 'adecuada' : adequacy === 'marginal' ? 'marginal' : 'deficiente'}. ${gap > 0 ? `Deficit: $${(gap / 1e6).toFixed(1)}M.` : `Exceso: $${(Math.abs(gap) / 1e6).toFixed(1)}M.`}`,
    };
  }
}
