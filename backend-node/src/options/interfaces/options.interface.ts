import { OptionType } from '../dto/options.dto';

export interface Greeks {
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho: number;
    price: number;
}

export interface OptionParams {
    underlying: number;
    strike: number;
    timeToExpiry: number;
    riskFreeRate: number;
    volatility: number;
    optionType: OptionType;
}

export interface OptionsChain {
    ticker: string;
    underlyingPrice: number;
    expiration: string;
    strikes: number[];
    calls: Map<number, OptionQuote>;
    puts: Map<number, OptionQuote>;
}

export interface OptionQuote {
    strike: number;
    expiration: string;
    bid: number;
    ask: number;
    lastPrice: number;
    volume?: number;
    openInterest?: number;
    impliedVolatility: number;
    delta: number;
    gamma: number;
    theta: number;
    vega: number;
    rho?: number;
}

export interface IVSurfacePoint {
    strike: number;
    maturity: number; // Days to expiration
    impliedVolatility: number;
}

export interface VolatilitySurface {
    ticker: string;
    underlyingPrice: number;
    strikes: number[];
    maturities: number[]; // Days to expiration
    ivSurface: number[][]; // 2D grid [strike_index][maturity_index]
    timestamp: Date;
}

/**
 * Abstract interface for options data providers
 * Allows swapping between free (yfinance) and paid (CBOE, Polygon) providers
 */
export interface IOptionsDataProvider {
    /**
     * Fetch options chain for a given ticker and optional maturity
     */
    getOptionsChain(ticker: string, maturity?: Date): Promise<OptionsChain>;

    /**
     * Fetch implied volatility for a specific option
     */
    getImpliedVolatility(
        ticker: string,
        strike: number,
        maturity: Date,
        optionType: OptionType,
    ): Promise<number>;

    /**
     * Fetch IV surface data (all strikes and maturities)
     */
    getVolatilitySurface(ticker: string): Promise<VolatilitySurface>;

    /**
     * Get available expiration dates for a ticker
     */
    getExpirations(ticker: string): Promise<Date[]>;
}
