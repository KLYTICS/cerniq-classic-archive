import { Injectable } from '@nestjs/common';
/** Credit Spread Risk (CSRBB) — Quant Model #82. Basel III credit spread risk in banking book. */
@Injectable()
export class CreditSpreadRiskService {
  calculate(params: { bondPortfolio: Array<{ name: string; balance: number; spread: number; duration: number }>; shockBps?: number }): {
    totalExposure: number; portfolioDuration: number; cs01: number; stressLoss: number;
    interpretation: string; interpretationEs: string;
  } {
    const shock = params.shockBps ?? 100;
    const total = params.bondPortfolio.reduce((s, b) => s + b.balance, 0);
    const portDur = params.bondPortfolio.reduce((s, b) => s + b.duration * b.balance, 0) / total;
    const cs01 = +(total * portDur / 10000).toFixed(0);
    const stressLoss = +(cs01 * shock).toFixed(0);
    return { totalExposure: total, portfolioDuration: +portDur.toFixed(2), cs01, stressLoss,
      interpretation: `CS01: $${(cs01 / 1e3).toFixed(0)}K/bp. ${shock}bp stress loss: $${(stressLoss / 1e6).toFixed(1)}M.`,
      interpretationEs: `CS01: $${(cs01 / 1e3).toFixed(0)}K/pb. Perdida estres ${shock}pb: $${(stressLoss / 1e6).toFixed(1)}M.` };
  }
}
