export class PortfolioDto {
    id: string;
    userId: string;
    name: string;
    description?: string;
    currency: string;
    initialCash: number;
    currentCash: number;
    totalValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    createdAt: Date;
    updatedAt: Date;
    positions?: PositionDto[];
}

export class PositionDto {
    id: string;
    portfolioId: string;
    ticker: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    weight: number; // % of portfolio
    addedAt: Date;
    updatedAt: Date;
}

export class CreatePortfolioDto {
    name: string;
    description?: string;
    currency?: string;
    initialCash?: number;
}

export class UpdatePortfolioDto {
    name?: string;
    description?: string;
    currentCash?: number;
}

export class AddPositionDto {
    ticker: string;
    quantity: number;
    price: number; // Purchase price
}

export class UpdatePositionDto {
    quantity?: number;
    avgCost?: number;
}

export class PortfolioAnalyticsDto {
    portfolioId: string;
    totalReturn: number;
    totalReturnPercent: number;
    dailyReturn: number;
    dailyReturnPercent: number;
    volatility: number; // Annualized
    sharpeRatio: number;
    beta: number;
    maxDrawdown: number;
    winRate: number;
    bestPerformer: { ticker: string; return: number };
    worstPerformer: { ticker: string; return: number };
}
