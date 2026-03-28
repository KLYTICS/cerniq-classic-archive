import { Injectable } from '@nestjs/common';

/**
 * Basel Capital Charge Calculator — Quant Model #72
 *
 * Calculates regulatory capital charges under Basel III standardized approach.
 * Risk weights by asset class for credit risk capital requirement.
 */
@Injectable()
export class BaselCapitalChargeService {
  calculate(
    exposures: Array<{
      assetClass: string;
      assetClassEs: string;
      balance: number;
      riskWeight: number;
    }>,
  ): {
    rwa: number;
    capitalCharge: number;
    capitalRatio8Pct: number;
    breakdown: Array<{
      assetClass: string;
      assetClassEs: string;
      balance: number;
      riskWeight: number;
      rwa: number;
      capitalCharge: number;
    }>;
    interpretation: string;
    interpretationEs: string;
  } {
    const breakdown = exposures.map((e) => ({
      ...e,
      rwa: +((e.balance * e.riskWeight) / 100).toFixed(0),
      capitalCharge: +(((e.balance * e.riskWeight) / 100) * 0.08).toFixed(0),
    }));
    const rwa = breakdown.reduce((s, b) => s + b.rwa, 0);
    const capitalCharge = +(rwa * 0.08).toFixed(0);
    const totalExposure = exposures.reduce((s, e) => s + e.balance, 0);
    const capitalRatio8Pct = +((capitalCharge / totalExposure) * 100).toFixed(
      2,
    );

    return {
      rwa,
      capitalCharge,
      capitalRatio8Pct,
      breakdown,
      interpretation: `RWA: $${(rwa / 1e9).toFixed(1)}B. Capital charge (8%): $${(capitalCharge / 1e6).toFixed(0)}M. Effective capital requirement: ${capitalRatio8Pct}% of total exposure.`,
      interpretationEs: `APR: $${(rwa / 1e9).toFixed(1)}B. Cargo de capital (8%): $${(capitalCharge / 1e6).toFixed(0)}M. Requerimiento efectivo: ${capitalRatio8Pct}% de exposicion total.`,
    };
  }
}
