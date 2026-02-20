export class CyclicalValuationDto {
    ticker: string;
    currentPrice: number;
    fairValue: number;
    fairValueLow: number;
    fairValueHigh: number;
    upside: number; // %
    normalizedEarnings: number;
    peMultiple: number;
    cycleStage: 'early' | 'mid' | 'late' | 'peak' | 'trough';
    revenueGrowth: number; // YoY
    marginTrend: 'expanding' | 'stable' | 'contracting';
}

export class CompounderValuationDto {
    ticker: string;
    currentPrice: number;
    fairValue: number;
    upside: number; // %
    qualityScore: number; // 0-100
    roicSpread: number; // ROIC - WACC
    revenueGrowth: number; // 3-year CAGR
    marginStability: number; // Score 0-100
    cashConversion: number; // FCF / Net Income
    peMultiple: number;
    pegRatio: number;
}

export class FrontierValuationDto {
    ticker: string;
    currentPrice: number;
    scenarios: ScenarioValuationDto[];
    probabilityWeightedValue: number;
    upside: number; // %
    optionality: number; // Score 0-100
    catalysts: string[];
}

export class ScenarioValuationDto {
    name: string;
    probability: number;
    value: number;
    assumptions: string;
}

export class KPIScoreDto {
    ticker: string;
    overallScore: number; // 0-100
    fundamentalScore: number; // 0-100
    momentumScore: number; // 0-100
    valuationScore: number; // 0-100
    qualityScore: number; // 0-100
    breakdown: {
        revenueGrowth: number;
        marginTrend: number;
        roic: number;
        debtToEquity: number;
        fcfYield: number;
        peRatio: number;
        priceToSales: number;
    };
}

export class ScreenerRequestDto {
    assetType?: 'stock' | 'etf';
    sector?: string;
    minMarketCap?: number;
    maxMarketCap?: number;
    valuationType?: 'cyclical' | 'compounder' | 'frontier';
    minScore?: number;
    sortBy?: 'score' | 'upside' | 'marketCap';
    limit?: number;
}

export class ScreenerResultDto {
    ticker: string;
    name: string;
    currentPrice: number;
    fairValue: number;
    upside: number;
    score: number;
    valuationType: 'cyclical' | 'compounder' | 'frontier';
    sector: string;
    marketCap: number;
}

export class ValuationRequestDto {
    ticker: string;
    valuationType?: 'auto' | 'cyclical' | 'compounder' | 'frontier';
}
