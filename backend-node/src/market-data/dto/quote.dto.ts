export class QuoteDto {
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    volume: number;
    marketCap?: number;
    high: number;
    low: number;
    open: number;
    previousClose: number;
    timestamp: Date;
}

export class HistoricalPriceDto {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    adjustedClose: number;
}

export class FundamentalsDto {
    ticker: string;
    marketCap: number;
    peRatio?: number;
    forwardPE?: number;
    pbRatio?: number;
    dividendYield?: number;
    eps?: number;
    beta?: number;
    fiftyTwoWeekHigh?: number;
    fiftyTwoWeekLow?: number;
    averageVolume?: number;
    sector?: string;
    industry?: string;
}

export class TickerSearchResultDto {
    ticker: string;
    name: string;
    assetType: 'stock' | 'etf' | 'crypto' | 'index';
    exchange?: string;
    sector?: string;
}
