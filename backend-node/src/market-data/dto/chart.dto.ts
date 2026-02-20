export class OHLCVDataDto {
    date: Date;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

export class TechnicalDataDto {
    ohlcv: OHLCVDataDto[];
    indicators: {
        sma20?: number[];
        sma50?: number[];
        sma200?: number[];
        ema12?: number[];
        ema26?: number[];
        rsi?: number[];
        macd?: {
            macd: number[];
            signal: number[];
            histogram: number[];
        };
        bollingerBands?: {
            upper: number[];
            middle: number[];
            lower: number[];
        };
        vwap?: number[];
        atr?: number[];
        stochastic?: {
            k: number[];
            d: number[];
        };
    };
}

export class ChartDataRequestDto {
    ticker: string;
    timeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
    indicators?: string[]; // Array of indicator names to include
}
