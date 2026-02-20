export class ComponentVaRRequestDto {
    positions: {
        ticker: string;
        quantity: number;
        price: number;
    }[];
    confidenceLevel: number; // e.g., 0.95 for 95%
    horizon: number; // days
}

export class ComponentVaRResponseDto {
    portfolioVaR: number;
    portfolioValue: number;
    confidenceLevel: number;
    horizon: number;
    components: {
        ticker: string;
        position: number;
        marginalVaR: number;
        componentVaR: number;
        riskContribution: number; // Percentage of total VaR
    }[];
    timestamp: Date;
}

export class VolatilityForecastRequestDto {
    ticker: string;
    horizon?: number; // Days to forecast (default: 30)
}

export class VolatilityForecastResponseDto {
    ticker: string;
    currentVolatility: number;
    forecast: {
        day: number;
        volatility: number;
        lower95: number;
        upper95: number;
    }[];
    model: string; // e.g., 'GARCH(1,1)'
    timestamp: Date;
}

export class ParametricVaRRequestDto {
    positions: {
        ticker: string;
        quantity: number;
        price: number;
    }[];
    confidenceLevel: number;
    horizon: number;
}

export class ParametricVaRResponseDto {
    portfolioVaR: number;
    portfolioValue: number;
    portfolioVolatility: number;
    confidenceLevel: number;
    horizon: number;
    method: string; // 'Parametric (Normal)'
    timestamp: Date;
}
