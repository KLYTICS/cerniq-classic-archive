import { Injectable, Logger } from '@nestjs/common';

/**
 * Product Profitability Analysis — Quant Model
 *
 * Evaluates the risk-adjusted profitability of financial products using
 * Risk-Adjusted Return on Capital (RAROC).
 *
 * RAROC = (Revenue - Costs - ExpectedLoss) / EconomicCapital
 *
 * Where:
 *   Revenue         = Balance × Rate
 *   Costs           = Balance × CostOfFunds + Balance × OperatingCost
 *   ExpectedLoss    = Balance × ExpectedLossRate
 *   EconomicCapital = Balance × CapitalFactor (default 8%)
 *
 * Economic Profit = Net Income - (EconomicCapital × HurdleRate)
 */

export interface ProductInput {
  name: string;
  balance: number;
  rate: number;
  costOfFunds: number;
  operatingCost: number;
  expectedLoss: number;
  capitalFactor?: number;
}

export interface ProductProfitResult {
  name: string;
  revenue: number;
  costs: number;
  expectedLoss: number;
  netIncome: number;
  economicCapital: number;
  economicProfit: number;
  raroc: number;
  ranking: number;
}

export interface ProfitabilitySummary {
  totalRevenue: number;
  totalCosts: number;
  totalExpectedLoss: number;
  totalNetIncome: number;
  totalEconomicCapital: number;
  portfolioRAROC: number;
  profitableCount: number;
  unprofitableCount: number;
}

export interface ProfitabilityResult {
  products: ProductProfitResult[];
  summary: ProfitabilitySummary;
}

@Injectable()
export class ProfitabilityAnalysisService {
  private readonly logger = new Logger(ProfitabilityAnalysisService.name);

  /**
   * Analyze profitability of each product and rank by RAROC.
   *
   * @param params.products - Array of products with financial metrics
   * @param params.hurdleRate - Minimum acceptable return (default 0.10 = 10%)
   * @returns Product-level profitability metrics and portfolio summary
   */
  analyzeProductProfitability(params: {
    products: ProductInput[];
    hurdleRate?: number;
  }): ProfitabilityResult {
    const { products, hurdleRate = 0.1 } = params;

    this.logger.log(
      `Analyzing profitability for ${products.length} products, hurdle rate=${(hurdleRate * 100).toFixed(1)}%`,
    );

    let totalRevenue = 0;
    let totalCosts = 0;
    let totalExpectedLoss = 0;
    let totalNetIncome = 0;
    let totalEconomicCapital = 0;

    const results: ProductProfitResult[] = products.map((p) => {
      const capitalFactor = p.capitalFactor ?? 0.08;

      const revenue = p.balance * p.rate;
      const fundingCost = p.balance * p.costOfFunds;
      const opCost = p.balance * p.operatingCost;
      const costs = fundingCost + opCost;
      const expectedLoss = p.balance * p.expectedLoss;
      const economicCapital = p.balance * capitalFactor;
      const netIncome = revenue - costs - expectedLoss;
      const economicProfit = netIncome - economicCapital * hurdleRate;
      const raroc = economicCapital > 0 ? netIncome / economicCapital : 0;

      totalRevenue += revenue;
      totalCosts += costs;
      totalExpectedLoss += expectedLoss;
      totalNetIncome += netIncome;
      totalEconomicCapital += economicCapital;

      return {
        name: p.name,
        revenue: +revenue.toFixed(2),
        costs: +costs.toFixed(2),
        expectedLoss: +expectedLoss.toFixed(2),
        netIncome: +netIncome.toFixed(2),
        economicCapital: +economicCapital.toFixed(2),
        economicProfit: +economicProfit.toFixed(2),
        raroc: +raroc.toFixed(4),
        ranking: 0, // filled below
      };
    });

    // Rank by RAROC descending
    const sorted = [...results].sort((a, b) => b.raroc - a.raroc);
    sorted.forEach((item, idx) => {
      const match = results.find((r) => r.name === item.name);
      if (match) match.ranking = idx + 1;
    });

    const portfolioRAROC =
      totalEconomicCapital > 0 ? totalNetIncome / totalEconomicCapital : 0;

    const profitableCount = results.filter((r) => r.raroc >= hurdleRate).length;
    const unprofitableCount = results.length - profitableCount;

    return {
      products: results,
      summary: {
        totalRevenue: +totalRevenue.toFixed(2),
        totalCosts: +totalCosts.toFixed(2),
        totalExpectedLoss: +totalExpectedLoss.toFixed(2),
        totalNetIncome: +totalNetIncome.toFixed(2),
        totalEconomicCapital: +totalEconomicCapital.toFixed(2),
        portfolioRAROC: +portfolioRAROC.toFixed(4),
        profitableCount,
        unprofitableCount,
      },
    };
  }

  /**
   * Compute marginal profitability of adding a new product to the portfolio.
   */
  computeMarginalProfitability(params: {
    existingProducts: ProductInput[];
    newProduct: ProductInput;
    hurdleRate?: number;
  }): {
    beforeRAROC: number;
    afterRAROC: number;
    marginalRAROC: number;
    worthAdding: boolean;
  } {
    const { existingProducts, newProduct, hurdleRate = 0.1 } = params;

    const before = this.analyzeProductProfitability({
      products: existingProducts,
      hurdleRate,
    });
    const after = this.analyzeProductProfitability({
      products: [...existingProducts, newProduct],
      hurdleRate,
    });

    return {
      beforeRAROC: before.summary.portfolioRAROC,
      afterRAROC: after.summary.portfolioRAROC,
      marginalRAROC: +(
        after.summary.portfolioRAROC - before.summary.portfolioRAROC
      ).toFixed(4),
      worthAdding:
        after.summary.portfolioRAROC >= before.summary.portfolioRAROC,
    };
  }
}
