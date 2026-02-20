export class MonteCarloRequestDto {
    initialValue: number;
    meanDailyReturn: number;
    dailyVolatility: number;
    numSimulations: number;
    timeHorizon: number; // days
    confidenceLevel: number; // e.g., 0.95 for 95%
}

export class MonteCarloResultDto {
    finalValues: number[];
    var: number; // Value at Risk
    cvar: number; // Conditional Value at Risk
    worstCase: number;
    bestCase: number;
    median: number;
    mean: number;
    percentile95: number;
    percentile5: number;
}

export class VaRRequestDto {
    portfolioValue: number;
    returns: number[]; // Historical returns
    confidenceLevel: number; // e.g., 0.95
}

export class VaRResultDto {
    var: number;
    cvar: number;
    confidenceLevel: number;
    timeHorizon: string;
}

export class CorrelationMatrixRequestDto {
    tickers: string[];
    startDate?: string;
    endDate?: string;
}

export class CorrelationMatrixDto {
    tickers: string[];
    matrix: number[][]; // Correlation matrix
    computedAt: Date;
}

export class PortfolioRiskDto {
    portfolioId: string;
    totalValue: number;
    var95: number;
    cvar95: number;
    volatility: number; // Annualized
    sharpeRatio: number;
    beta: number;
    maxDrawdown: number;
    diversificationRatio: number;
}

export class StressTestScenarioDto {
    name: string;
    description: string;
    marketShock: number; // e.g., -0.20 for 20% drop
    sectorShocks?: Record<string, number>; // Sector-specific shocks
}

export class StressTestResultDto {
    scenario: string;
    portfolioValue: number;
    portfolioLoss: number;
    portfolioLossPercent: number;
    worstPosition: { ticker: string; loss: number };
    recoveryTime?: number; // days (placeholder)
}
