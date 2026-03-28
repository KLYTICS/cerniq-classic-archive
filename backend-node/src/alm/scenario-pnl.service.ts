import { Injectable } from '@nestjs/common';

/**
 * Scenario P&L Attribution — Quant Model #71
 *
 * Decomposes portfolio P&L into risk factor contributions:
 * rate moves, spread changes, credit events, and residual.
 */
@Injectable()
export class ScenarioPnLService {
  attribute(params: {
    totalPnL: number;
    rateContribution: number;
    spreadContribution: number;
    creditContribution: number;
    fxContribution?: number;
  }): {
    factors: Array<{ name: string; nameEs: string; amount: number; pct: number }>;
    residual: number;
    dominantFactor: string;
    interpretation: string; interpretationEs: string;
  } {
    const { totalPnL, rateContribution, spreadContribution, creditContribution, fxContribution = 0 } = params;
    const explained = rateContribution + spreadContribution + creditContribution + fxContribution;
    const residual = totalPnL - explained;

    const factors = [
      { name: 'Interest Rate', nameEs: 'Tasa de Interes', amount: rateContribution, pct: +(rateContribution / totalPnL * 100).toFixed(1) },
      { name: 'Credit Spread', nameEs: 'Spread Crediticio', amount: spreadContribution, pct: +(spreadContribution / totalPnL * 100).toFixed(1) },
      { name: 'Credit Events', nameEs: 'Eventos Crediticios', amount: creditContribution, pct: +(creditContribution / totalPnL * 100).toFixed(1) },
      { name: 'FX', nameEs: 'Tipo de Cambio', amount: fxContribution, pct: +(fxContribution / totalPnL * 100).toFixed(1) },
      { name: 'Residual', nameEs: 'Residual', amount: +residual.toFixed(2), pct: +(residual / totalPnL * 100).toFixed(1) },
    ];

    const dominant = factors.reduce((max, f) => Math.abs(f.amount) > Math.abs(max.amount) ? f : max);

    return {
      factors, residual: +residual.toFixed(2), dominantFactor: dominant.name,
      interpretation: `P&L of $${(totalPnL / 1e6).toFixed(1)}M driven primarily by ${dominant.name} ($${(dominant.amount / 1e6).toFixed(1)}M, ${dominant.pct}%).`,
      interpretationEs: `P&L de $${(totalPnL / 1e6).toFixed(1)}M impulsado principalmente por ${dominant.nameEs} ($${(dominant.amount / 1e6).toFixed(1)}M, ${dominant.pct}%).`,
    };
  }
}
