import { Injectable } from '@nestjs/common';

/**
 * Weighted Average Coupon (WAC) & Weighted Average Maturity (WAM) — Quant Model #67
 *
 * Portfolio-level yield and maturity metrics weighted by balance.
 * Core metrics for MBS/loan portfolio analysis and prepayment modeling.
 */
@Injectable()
export class WeightedAverageCouponService {
  calculate(loans: Array<{ name: string; balance: number; couponRate: number; remainingTermMonths: number; originalTermMonths: number }>): {
    wac: number; wam: number; waol: number; // weighted avg original life
    totalBalance: number;
    segments: Array<{ name: string; balance: number; weight: number; coupon: number; remainingMonths: number }>;
    seasoning: number; // avg months since origination
    interpretation: string; interpretationEs: string;
  } {
    const totalBalance = loans.reduce((s, l) => s + l.balance, 0);
    const wac = loans.reduce((s, l) => s + l.couponRate * l.balance, 0) / totalBalance;
    const wam = loans.reduce((s, l) => s + l.remainingTermMonths * l.balance, 0) / totalBalance;
    const waol = loans.reduce((s, l) => s + l.originalTermMonths * l.balance, 0) / totalBalance;
    const seasoning = waol - wam;

    const segments = loans.map(l => ({
      name: l.name, balance: l.balance,
      weight: +(l.balance / totalBalance * 100).toFixed(2),
      coupon: l.couponRate, remainingMonths: l.remainingTermMonths,
    }));

    return {
      wac: +wac.toFixed(4), wam: +wam.toFixed(1), waol: +waol.toFixed(1),
      totalBalance, segments, seasoning: +seasoning.toFixed(1),
      interpretation: `WAC: ${(wac * 100).toFixed(2)}%. WAM: ${(wam / 12).toFixed(1)} years. Seasoning: ${(seasoning / 12).toFixed(1)} years.`,
      interpretationEs: `WAC: ${(wac * 100).toFixed(2)}%. WAM: ${(wam / 12).toFixed(1)} anos. Antigüedad: ${(seasoning / 12).toFixed(1)} anos.`,
    };
  }
}
