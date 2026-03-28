import { Injectable } from '@nestjs/common';

/**
 * Contingent Liquidity Planning Service — Quant Model #62
 *
 * Models available contingent funding sources during stress:
 * - FHLB borrowing capacity
 * - Fed discount window
 * - Repo market access
 * - Asset liquidation (haircuts by asset class)
 *
 * Answers: "If deposits flee, how much can we borrow and how fast?"
 */
@Injectable()
export class ContingentLiquidityService {
  analyze(params: {
    totalAssets: number;
    pledgeableAssets: number;
    fhlbCapacity: number;
    fedDiscountCapacity: number;
    unencumberedSecurities: number;
    cashReserves: number;
  }): {
    totalContingentFunding: number;
    coverageDays: number;
    sources: Array<{ name: string; nameEs: string; capacity: number; timeToAccess: string; haircut: number }>;
    stressCapacity: number;
    interpretation: string;
    interpretationEs: string;
  } {
    const { totalAssets, pledgeableAssets, fhlbCapacity, fedDiscountCapacity, unencumberedSecurities, cashReserves } = params;
    const repoCapacity = unencumberedSecurities * 0.95;
    const assetSale = pledgeableAssets * 0.85;

    const sources = [
      { name: 'Cash Reserves', nameEs: 'Reservas Efectivo', capacity: cashReserves, timeToAccess: 'Immediate', haircut: 0 },
      { name: 'FHLB Advances', nameEs: 'Adelantos FHLB', capacity: fhlbCapacity, timeToAccess: '1-2 days', haircut: 5 },
      { name: 'Fed Discount Window', nameEs: 'Ventana Descuento Fed', capacity: fedDiscountCapacity, timeToAccess: 'Same day', haircut: 2 },
      { name: 'Repo Market', nameEs: 'Mercado Repo', capacity: repoCapacity, timeToAccess: '1 day', haircut: 5 },
      { name: 'Asset Liquidation', nameEs: 'Liquidacion Activos', capacity: assetSale, timeToAccess: '3-7 days', haircut: 15 },
    ];

    const totalContingent = sources.reduce((s, src) => s + src.capacity, 0);
    const dailyOutflow = totalAssets * 0.02;
    const coverageDays = Math.floor(totalContingent / dailyOutflow);
    const stressCapacity = cashReserves + fhlbCapacity + fedDiscountCapacity;

    return {
      totalContingentFunding: +totalContingent.toFixed(0),
      coverageDays,
      sources,
      stressCapacity: +stressCapacity.toFixed(0),
      interpretation: `Total contingent funding: $${(totalContingent / 1e9).toFixed(1)}B. Coverage: ${coverageDays} days at 2% daily outflow. Immediate access: $${(stressCapacity / 1e9).toFixed(1)}B.`,
      interpretationEs: `Financiamiento contingente total: $${(totalContingent / 1e9).toFixed(1)}B. Cobertura: ${coverageDays} dias al 2% de salida diaria. Acceso inmediato: $${(stressCapacity / 1e9).toFixed(1)}B.`,
    };
  }
}
