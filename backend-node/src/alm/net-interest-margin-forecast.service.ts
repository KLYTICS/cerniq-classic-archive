import { Injectable } from '@nestjs/common';

/**
 * Net Interest Margin (NIM) Forecasting — Quant Model #65
 *
 * Projects NIM forward using rate scenarios, repricing schedules,
 * and deposit beta assumptions. Core ALCO planning tool.
 *
 * NIM = (Interest Income - Interest Expense) / Average Earning Assets
 */
@Injectable()
export class NIMForecastService {
  forecast(params: {
    currentNIM: number;
    earningAssets: number;
    interestIncome: number;
    interestExpense: number;
    assetBeta: number;
    liabilityBeta: number; // sensitivity to rate changes
    rateScenarios: Array<{ name: string; nameEs: string; shockBps: number }>;
    quarters?: number;
  }): {
    projections: Array<{
      scenario: string;
      scenarioEs: string;
      shockBps: number;
      quarterlyNIM: number[];
      endingNIM: number;
      nimChangeBps: number;
      annualizedNIIChange: number;
    }>;
    baseNIM: number;
    interpretation: string;
    interpretationEs: string;
  } {
    const {
      currentNIM,
      earningAssets,
      assetBeta,
      liabilityBeta,
      rateScenarios,
      quarters = 8,
    } = params;

    const projections = rateScenarios.map((sc) => {
      const quarterlyNIM: number[] = [];
      let nim = currentNIM;
      const rateChangePerQ = sc.shockBps / (quarters * 100);

      for (let q = 0; q < quarters; q++) {
        const assetYieldChange = rateChangePerQ * assetBeta;
        const fundingCostChange = rateChangePerQ * liabilityBeta;
        nim = nim + assetYieldChange - fundingCostChange;
        nim = Math.max(nim, 0.005); // floor at 0.5%
        quarterlyNIM.push(+nim.toFixed(4));
      }

      const endingNIM = quarterlyNIM[quarterlyNIM.length - 1];
      const nimChangeBps = +((endingNIM - currentNIM) * 10000).toFixed(0);
      const annualizedNIIChange = +(
        (nimChangeBps / 10000) *
        earningAssets
      ).toFixed(0);

      return {
        scenario: sc.name,
        scenarioEs: sc.nameEs,
        shockBps: sc.shockBps,
        quarterlyNIM,
        endingNIM,
        nimChangeBps,
        annualizedNIIChange,
      };
    });

    return {
      projections,
      baseNIM: currentNIM,
      interpretation: `Base NIM: ${(currentNIM * 100).toFixed(2)}%. Range under scenarios: ${Math.min(...projections.map((p) => p.endingNIM * 100)).toFixed(2)}% to ${Math.max(...projections.map((p) => p.endingNIM * 100)).toFixed(2)}%.`,
      interpretationEs: `NIM base: ${(currentNIM * 100).toFixed(2)}%. Rango bajo escenarios: ${Math.min(...projections.map((p) => p.endingNIM * 100)).toFixed(2)}% a ${Math.max(...projections.map((p) => p.endingNIM * 100)).toFixed(2)}%.`,
    };
  }
}
