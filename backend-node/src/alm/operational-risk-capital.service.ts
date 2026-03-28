import { Injectable } from '@nestjs/common';

/** Operational Risk Capital (Basic Indicator Approach) — Quant Model #78. Basel III BIA: 15% of avg gross income. */
@Injectable()
export class OperationalRiskCapitalService {
  calculate(grossIncome3Y: [number, number, number]): {
    avgGrossIncome: number; capitalCharge: number; alpha: number;
    interpretation: string; interpretationEs: string;
  } {
    const positiveYears = grossIncome3Y.filter(g => g > 0);
    const avg = positiveYears.length > 0 ? positiveYears.reduce((s, g) => s + g, 0) / positiveYears.length : 0;
    const alpha = 0.15;
    const charge = +(avg * alpha).toFixed(0);
    return {
      avgGrossIncome: +avg.toFixed(0), capitalCharge: charge, alpha,
      interpretation: `OpRisk capital (BIA): $${(charge / 1e6).toFixed(1)}M (15% × $${(avg / 1e6).toFixed(1)}M avg gross income).`,
      interpretationEs: `Capital riesgo operacional (BIA): $${(charge / 1e6).toFixed(1)}M (15% × $${(avg / 1e6).toFixed(1)}M ingreso bruto promedio).`,
    };
  }
}
