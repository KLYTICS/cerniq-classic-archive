import { Injectable, Logger } from '@nestjs/common';

/**
 * Country Risk Assessment Service
 *
 * Evaluates sovereign / geographic concentration risk across an
 * institution's cross-border exposures using S&P-style credit
 * ratings mapped to a 1-10 numeric scale.
 *
 * Key outputs:
 * - Balance-weighted average risk score
 * - Concentration breakdown by country (Herfindahl-style)
 * - Total high-risk exposure (rating >= 7)
 * - Diversification index (inverse HHI, 0-1 scale)
 */

// ─── Types ──────────────────────────────────────────────────────

export interface CountryExposure {
  country: string;
  balance: number;
  /** S&P-style rating mapped: AAA=1, AA=2, A=3, BBB=4, BB=5, B=6, CCC=7, CC=8, C=9, D=10 */
  riskRating: number;
}

export interface CountryRiskParams {
  exposures: CountryExposure[];
}

export interface CountryConcentration {
  country: string;
  balance: number;
  share: number;
  riskRating: number;
  weightedContribution: number;
}

export interface CountryRiskResult {
  weightedRiskScore: number;
  concentrationByCountry: CountryConcentration[];
  highRiskExposure: number;
  diversificationIndex: number;
}

// ─── Constants ──────────────────────────────────────────────────

const HIGH_RISK_THRESHOLD = 7;

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class CountryRiskService {
  private readonly logger = new Logger(CountryRiskService.name);

  /**
   * Assess country-level concentration and sovereign risk.
   *
   * Risk ratings follow the S&P mapping: AAA = 1 ... D = 10.
   */
  assessCountryRisk(params: CountryRiskParams): CountryRiskResult {
    const { exposures } = params;
    this.logger.log(
      `Assessing country risk across ${exposures.length} exposures`,
    );

    const totalBalance = exposures.reduce((sum, e) => sum + e.balance, 0);

    if (totalBalance === 0) {
      return {
        weightedRiskScore: 0,
        concentrationByCountry: [],
        highRiskExposure: 0,
        diversificationIndex: 0,
      };
    }

    // Aggregate by country
    const countryMap = new Map<
      string,
      { balance: number; riskRating: number }
    >();
    for (const e of exposures) {
      const existing = countryMap.get(e.country);
      if (existing) {
        // Weighted-average rating when aggregating
        const combinedBalance = existing.balance + e.balance;
        existing.riskRating =
          (existing.riskRating * existing.balance + e.riskRating * e.balance) /
          combinedBalance;
        existing.balance = combinedBalance;
      } else {
        countryMap.set(e.country, {
          balance: e.balance,
          riskRating: e.riskRating,
        });
      }
    }

    let weightedRiskSum = 0;
    let highRiskExposure = 0;
    let hhi = 0;
    const concentrationByCountry: CountryConcentration[] = [];

    for (const [country, data] of countryMap) {
      const share = data.balance / totalBalance;
      const weightedContribution = round4(share * data.riskRating);
      weightedRiskSum += weightedContribution;
      hhi += share * share;

      if (data.riskRating >= HIGH_RISK_THRESHOLD) {
        highRiskExposure += data.balance;
      }

      concentrationByCountry.push({
        country,
        balance: round2(data.balance),
        share: round4(share),
        riskRating: round2(data.riskRating),
        weightedContribution,
      });
    }

    // Sort by share descending
    concentrationByCountry.sort((a, b) => b.share - a.share);

    // Diversification index: 1 - HHI (0 = concentrated, 1 = diversified)
    const diversificationIndex = round4(1 - hhi);

    return {
      weightedRiskScore: round2(weightedRiskSum),
      concentrationByCountry,
      highRiskExposure: round2(highRiskExposure),
      diversificationIndex,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function round2(n: number): number {
  return Math.round(n * 100) / 100;
}

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
