import { Injectable, Logger } from '@nestjs/common';
import { MarketDataService } from '../market-data/market-data.service';
import { CacheService } from '../cache/cache.service';

/**
 * Factor Risk Model Service
 * Implements Fama-French factor models and risk decomposition
 */
@Injectable()
export class FactorRiskService {
  private readonly logger = new Logger(FactorRiskService.name);

  // Standard factor definitions
  private readonly factors = {
    MKT: 'Market Risk Premium (CAPM)',
    SMB: 'Small Minus Big (Size Factor)',
    HML: 'High Minus Low (Value Factor)',
    RMW: 'Robust Minus Weak (Profitability)',
    CMA: 'Conservative Minus Aggressive (Investment)',
    MOM: 'Momentum Factor',
  };

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly cacheService: CacheService,
  ) {}

  /**
   * Calculate factor exposures (betas) for a portfolio
   */
  async calculateFactorExposures(
    positions: PositionDto[],
  ): Promise<FactorExposureResult> {
    // Calculate portfolio weights
    let totalValue = 0;
    const positionValues: { ticker: string; value: number }[] = [];

    for (const pos of positions) {
      const quote = await this.marketDataService.getQuote(pos.ticker);
      const value = pos.quantity * quote.price;
      totalValue += value;
      positionValues.push({ ticker: pos.ticker, value });
    }

    // Calculate weighted factor exposures
    const portfolioExposures: Record<string, number> = {
      MKT: 0,
      SMB: 0,
      HML: 0,
      RMW: 0,
      CMA: 0,
      MOM: 0,
    };

    const stockExposures: StockFactorExposure[] = [];

    for (const pos of positionValues) {
      const weight = pos.value / totalValue;
      const exposures = this.estimateStockFactorExposures(pos.ticker);

      stockExposures.push({
        ticker: pos.ticker,
        weight,
        exposures,
      });

      // Aggregate to portfolio level
      for (const factor of Object.keys(portfolioExposures)) {
        portfolioExposures[factor] += weight * (exposures[factor] || 0);
      }
    }

    // Calculate risk contribution from each factor
    const factorRiskContributions = this.calculateFactorRiskContributions(
      portfolioExposures,
      this.getFactorCovariance(),
    );

    return {
      portfolioValue: totalValue,
      exposures: portfolioExposures,
      stockExposures,
      riskContributions: factorRiskContributions,
      totalFactorRisk: Object.values(factorRiskContributions).reduce(
        (a, b) => a + b,
        0,
      ),
      idiosyncraticRisk: this.estimateIdiosyncraticRisk(stockExposures),
      factorDescriptions: this.factors,
    };
  }

  /**
   * Estimate factor exposures for individual stock
   */
  private estimateStockFactorExposures(ticker: string): Record<string, number> {
    // Simplified factor loading estimation based on stock characteristics
    // Production would use regression analysis on historical returns

    const techLarge = ['AAPL', 'GOOGL', 'MSFT', 'META', 'NVDA'];
    const techSmall = ['PLTR', 'CRWD', 'NET', 'SNOW'];
    const valueStocks = ['BRK.B', 'JPM', 'BAC', 'XOM', 'CVX'];
    const growthStocks = ['TSLA', 'AMZN', 'SHOP'];
    const smallCap = ['GME', 'AMC', 'BBBY'];
    const momentum = ['NVDA', 'META', 'TSLA'];

    let exposures: Record<string, number> = {
      MKT: 1.0, // Base market exposure
      SMB: 0,
      HML: 0,
      RMW: 0,
      CMA: 0,
      MOM: 0,
    };

    // Adjust based on stock characteristics
    if (techLarge.includes(ticker)) {
      exposures = {
        MKT: 1.15,
        SMB: -0.2,
        HML: -0.4,
        RMW: 0.3,
        CMA: 0.1,
        MOM: 0.2,
      };
    } else if (techSmall.includes(ticker)) {
      exposures = {
        MKT: 1.3,
        SMB: 0.5,
        HML: -0.5,
        RMW: -0.2,
        CMA: -0.3,
        MOM: 0.1,
      };
    } else if (valueStocks.includes(ticker)) {
      exposures = {
        MKT: 0.9,
        SMB: -0.1,
        HML: 0.5,
        RMW: 0.4,
        CMA: 0.3,
        MOM: -0.1,
      };
    } else if (growthStocks.includes(ticker)) {
      exposures = {
        MKT: 1.4,
        SMB: 0.1,
        HML: -0.6,
        RMW: -0.3,
        CMA: -0.4,
        MOM: 0.3,
      };
    } else if (smallCap.includes(ticker)) {
      exposures = {
        MKT: 1.5,
        SMB: 0.8,
        HML: 0.1,
        RMW: -0.4,
        CMA: -0.2,
        MOM: 0.4,
      };
    }

    if (momentum.includes(ticker)) {
      exposures.MOM += 0.3;
    }

    return exposures;
  }

  /**
   * Get factor covariance matrix (annualized)
   */
  private getFactorCovariance(): number[][] {
    // Simplified factor covariance matrix (typical values)
    // Rows/cols: MKT, SMB, HML, RMW, CMA, MOM
    return [
      [0.04, 0.002, 0.001, 0.0005, 0.0005, -0.001], // MKT
      [0.002, 0.0144, 0.0015, 0.001, 0.0005, 0.0002], // SMB
      [0.001, 0.0015, 0.0121, -0.002, 0.003, -0.0025], // HML
      [0.0005, 0.001, -0.002, 0.0064, 0.0015, 0.001], // RMW
      [0.0005, 0.0005, 0.003, 0.0015, 0.0049, -0.0008], // CMA
      [-0.001, 0.0002, -0.0025, 0.001, -0.0008, 0.0196], // MOM
    ];
  }

  /**
   * Calculate risk contribution from each factor
   */
  private calculateFactorRiskContributions(
    exposures: Record<string, number>,
    covariance: number[][],
  ): Record<string, number> {
    const factors = ['MKT', 'SMB', 'HML', 'RMW', 'CMA', 'MOM'];
    const betas = factors.map((f) => exposures[f]);

    // Portfolio variance from factors: β' Σ β
    let portfolioVariance = 0;
    for (let i = 0; i < 6; i++) {
      for (let j = 0; j < 6; j++) {
        portfolioVariance += betas[i] * betas[j] * covariance[i][j];
      }
    }

    // Marginal contribution to risk
    const contributions: Record<string, number> = {};
    for (let i = 0; i < 6; i++) {
      let marginalContrib = 0;
      for (let j = 0; j < 6; j++) {
        marginalContrib += betas[j] * covariance[i][j];
      }
      contributions[factors[i]] =
        ((betas[i] * marginalContrib) / portfolioVariance) * 100;
    }

    return contributions;
  }

  /**
   * Estimate idiosyncratic (stock-specific) risk
   */
  private estimateIdiosyncraticRisk(
    stockExposures: StockFactorExposure[],
  ): number {
    // Approximate idiosyncratic risk based on concentration
    const herfindahl = stockExposures.reduce(
      (sum, s) => sum + s.weight * s.weight,
      0,
    );
    const effectiveStocks = 1 / herfindahl;

    // Average idiosyncratic vol ~30%, diversified by sqrt(N)
    const avgIdioVol = 0.3;
    return (avgIdioVol / Math.sqrt(effectiveStocks)) * 100;
  }

  /**
   * Decompose portfolio return into factor contributions
   */
  async decomposeReturns(
    positions: PositionDto[],
    returnPeriod: 'daily' | 'weekly' | 'monthly',
  ): Promise<ReturnDecomposition> {
    const exposures = await this.calculateFactorExposures(positions);

    // Simulated factor returns (production would use actual factor data)
    const factorReturns: Record<string, number> = {
      MKT:
        returnPeriod === 'daily'
          ? 0.05
          : returnPeriod === 'weekly'
            ? 0.35
            : 1.2,
      SMB:
        returnPeriod === 'daily' ? 0.02 : returnPeriod === 'weekly' ? 0.1 : 0.3,
      HML:
        returnPeriod === 'daily'
          ? -0.01
          : returnPeriod === 'weekly'
            ? -0.05
            : -0.15,
      RMW:
        returnPeriod === 'daily'
          ? 0.01
          : returnPeriod === 'weekly'
            ? 0.08
            : 0.25,
      CMA:
        returnPeriod === 'daily'
          ? 0.005
          : returnPeriod === 'weekly'
            ? 0.03
            : 0.1,
      MOM:
        returnPeriod === 'daily' ? 0.03 : returnPeriod === 'weekly' ? 0.2 : 0.6,
    };

    // Calculate return contribution from each factor
    const contributions: Record<string, number> = {};
    let totalFactorReturn = 0;

    for (const factor of Object.keys(exposures.exposures)) {
      const contribution = exposures.exposures[factor] * factorReturns[factor];
      contributions[factor] = Number(contribution.toFixed(4));
      totalFactorReturn += contribution;
    }

    // Alpha (unexplained return)
    const alpha = 0.02; // Simulated

    return {
      period: returnPeriod,
      totalReturn: totalFactorReturn + alpha,
      factorContributions: contributions,
      alpha,
      r_squared: 0.85, // Factor model explains 85% of variance
    };
  }
}

// Types
interface PositionDto {
  ticker: string;
  quantity: number;
}

interface StockFactorExposure {
  ticker: string;
  weight: number;
  exposures: Record<string, number>;
}

interface FactorExposureResult {
  portfolioValue: number;
  exposures: Record<string, number>;
  stockExposures: StockFactorExposure[];
  riskContributions: Record<string, number>;
  totalFactorRisk: number;
  idiosyncraticRisk: number;
  factorDescriptions: Record<string, string>;
}

interface ReturnDecomposition {
  period: string;
  totalReturn: number;
  factorContributions: Record<string, number>;
  alpha: number;
  r_squared: number;
}

export type { FactorExposureResult, ReturnDecomposition };
