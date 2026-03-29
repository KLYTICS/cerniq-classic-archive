import { Injectable, Logger } from '@nestjs/common';

/**
 * Loan Pricing Engine — Quant Model
 *
 * Determines the minimum lending rate that covers all costs and achieves
 * the target return on equity (ROE).
 *
 * MinRate = CostOfFunds + CreditSpread + OperatingCost + CapitalCharge
 *
 * Where:
 *   CostOfFunds   = Weighted average cost of funding the loan
 *   CreditSpread  = Expected loss rate (PD × LGD) plus risk premium
 *   OperatingCost = Administrative cost as % of principal
 *   CapitalCharge  = TargetROE × CapitalRequirement (e.g. 8% Basel)
 *
 * Monthly Payment (amortizing):
 *   PMT = P × r(1+r)^n / ((1+r)^n - 1)
 *   where r = monthly rate, n = number of months
 */

export interface LoanPricingResult {
  minimumRate: number;
  breakdown: {
    costOfFunds: number;
    creditSpread: number;
    operatingCost: number;
    capitalCharge: number;
  };
  monthlyPayment: number;
  totalInterest: number;
  totalPayment: number;
  profitMargin: number;
}

@Injectable()
export class LoanPricingEngineService {
  private readonly logger = new Logger(LoanPricingEngineService.name);

  /**
   * Price a loan by computing the minimum acceptable interest rate.
   *
   * @param params.principal - Loan principal amount
   * @param params.maturityYears - Loan term in years
   * @param params.costOfFunds - Cost of funds rate (annual, decimal)
   * @param params.creditSpread - Credit spread / expected loss rate (annual, decimal)
   * @param params.operatingCost - Operating cost rate (annual, decimal)
   * @param params.targetROE - Target return on equity (annual, decimal)
   * @param params.capitalRequirement - Regulatory capital requirement (decimal, e.g. 0.08)
   * @returns Minimum rate, breakdown, monthly payment, total interest
   */
  priceLoan(params: {
    principal: number;
    maturityYears: number;
    costOfFunds: number;
    creditSpread: number;
    operatingCost: number;
    targetROE: number;
    capitalRequirement: number;
  }): LoanPricingResult {
    const {
      principal,
      maturityYears,
      costOfFunds,
      creditSpread,
      operatingCost,
      targetROE,
      capitalRequirement,
    } = params;

    this.logger.log(
      `Pricing loan: principal=${principal}, maturity=${maturityYears}y, COF=${(costOfFunds * 100).toFixed(2)}%`,
    );

    // Capital charge: required return on allocated capital
    const capitalCharge = targetROE * capitalRequirement;

    // Minimum acceptable rate
    const minimumRate =
      costOfFunds + creditSpread + operatingCost + capitalCharge;

    // Monthly payment calculation (amortizing loan)
    const n = maturityYears * 12;
    const monthlyRate = minimumRate / 12;
    let monthlyPayment: number;

    if (monthlyRate > 0) {
      const factor = Math.pow(1 + monthlyRate, n);
      monthlyPayment = (principal * (monthlyRate * factor)) / (factor - 1);
    } else {
      monthlyPayment = principal / n;
    }

    const totalPayment = monthlyPayment * n;
    const totalInterest = totalPayment - principal;
    const profitMargin = minimumRate - costOfFunds;

    return {
      minimumRate: +minimumRate.toFixed(6),
      breakdown: {
        costOfFunds: +costOfFunds.toFixed(6),
        creditSpread: +creditSpread.toFixed(6),
        operatingCost: +operatingCost.toFixed(6),
        capitalCharge: +capitalCharge.toFixed(6),
      },
      monthlyPayment: +monthlyPayment.toFixed(2),
      totalInterest: +totalInterest.toFixed(2),
      totalPayment: +totalPayment.toFixed(2),
      profitMargin: +profitMargin.toFixed(6),
    };
  }

  /**
   * Compare loan pricing across multiple scenarios.
   */
  compareScenarios(params: {
    principal: number;
    maturityYears: number;
    scenarios: Array<{
      name: string;
      costOfFunds: number;
      creditSpread: number;
      operatingCost: number;
      targetROE: number;
      capitalRequirement: number;
    }>;
  }): Array<{
    name: string;
    minimumRate: number;
    monthlyPayment: number;
    totalInterest: number;
  }> {
    const { principal, maturityYears, scenarios } = params;

    return scenarios.map((scenario) => {
      const result = this.priceLoan({
        principal,
        maturityYears,
        ...scenario,
      });
      return {
        name: scenario.name,
        minimumRate: result.minimumRate,
        monthlyPayment: result.monthlyPayment,
        totalInterest: result.totalInterest,
      };
    });
  }

  /**
   * Compute the risk-adjusted return on capital (RAROC) for a given loan rate.
   *
   * RAROC = (Interest Income - COF - OpCost - ExpectedLoss) / EconomicCapital
   */
  computeRAROC(params: {
    principal: number;
    loanRate: number;
    costOfFunds: number;
    operatingCost: number;
    expectedLossRate: number;
    capitalRequirement: number;
  }): { raroc: number; economicProfit: number; acceptable: boolean } {
    const {
      principal,
      loanRate,
      costOfFunds,
      operatingCost,
      expectedLossRate,
      capitalRequirement,
    } = params;

    const revenue = principal * loanRate;
    const fundingCost = principal * costOfFunds;
    const opCost = principal * operatingCost;
    const expectedLoss = principal * expectedLossRate;
    const economicCapital = principal * capitalRequirement;

    const netIncome = revenue - fundingCost - opCost - expectedLoss;
    const raroc = economicCapital > 0 ? netIncome / economicCapital : 0;
    const economicProfit = netIncome - economicCapital * 0.1; // hurdle rate 10%

    return {
      raroc: +raroc.toFixed(4),
      economicProfit: +economicProfit.toFixed(2),
      acceptable: raroc >= 0.1,
    };
  }
}
