import { IsString, IsNumber, IsOptional, IsIn, Min, Max } from 'class-validator';

export class CyclicalValuationDto {
    ticker: string;
    currentPrice: number;
    fairValue: number;
    fairValueLow: number;
    fairValueHigh: number;
    upside: number;
    normalizedEarnings: number;
    peMultiple: number;
    cycleStage: 'early' | 'mid' | 'late' | 'peak' | 'trough';
    revenueGrowth: number;
    marginTrend: 'expanding' | 'stable' | 'contracting';
}

export class CompounderValuationDto {
    ticker: string;
    currentPrice: number;
    fairValue: number;
    upside: number;
    qualityScore: number;
    roicSpread: number;
    revenueGrowth: number;
    marginStability: number;
    cashConversion: number;
    peMultiple: number;
    pegRatio: number;
}

export class FrontierValuationDto {
    ticker: string;
    currentPrice: number;
    scenarios: ScenarioValuationDto[];
    probabilityWeightedValue: number;
    upside: number;
    optionality: number;
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
    overallScore: number;
    fundamentalScore: number;
    momentumScore: number;
    valuationScore: number;
    qualityScore: number;
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
    @IsOptional()
    @IsIn(['stock', 'etf'])
    assetType?: 'stock' | 'etf';

    @IsOptional()
    @IsString()
    sector?: string;

    @IsOptional()
    @IsNumber()
    @Min(0)
    minMarketCap?: number;

    @IsOptional()
    @IsNumber()
    @Min(0)
    maxMarketCap?: number;

    @IsOptional()
    @IsIn(['cyclical', 'compounder', 'frontier'])
    valuationType?: 'cyclical' | 'compounder' | 'frontier';

    @IsOptional()
    @IsNumber()
    @Min(0)
    @Max(100)
    minScore?: number;

    @IsOptional()
    @IsIn(['score', 'upside', 'marketCap'])
    sortBy?: 'score' | 'upside' | 'marketCap';

    @IsOptional()
    @IsNumber()
    @Min(1)
    @Max(100)
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
    @IsString()
    ticker: string;

    @IsOptional()
    @IsIn(['auto', 'cyclical', 'compounder', 'frontier'])
    valuationType?: 'auto' | 'cyclical' | 'compounder' | 'frontier';
}
