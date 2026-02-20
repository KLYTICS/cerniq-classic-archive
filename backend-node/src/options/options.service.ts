import { Injectable, HttpException, HttpStatus } from '@nestjs/common';
import {
    CalculateGreeksDto,
    GreeksResponseDto,
    OptionChainRequestDto,
    OptionsChainResponseDto,
    OptionQuoteDto,
    ImpliedVolatilityRequestDto,
    ImpliedVolatilityResponseDto,
    OptionType,
} from './dto/options.dto';
import { CalculateStrategyDto, StrategyResponseDto, PayoffPoint } from './dto/strategy.dto';
import { Greeks, OptionParams } from './interfaces/options.interface';

@Injectable()
export class OptionsService {
    /**
     * Calculate Black-Scholes Greeks for a single option
     * Uses TypeScript fallback - will integrate WASM in next step
     */
    async calculateGreeks(dto: CalculateGreeksDto): Promise<GreeksResponseDto> {
        try {
            // TODO: Replace with WASM engine call
            // const greeks = WasmOptionEngine.calculate(...);

            // TypeScript fallback implementation
            const greeks = this.calculateBlackScholesGreeks({
                underlying: dto.underlying,
                strike: dto.strike,
                timeToExpiry: dto.timeToExpiry,
                riskFreeRate: dto.riskFreeRate,
                volatility: dto.volatility,
                optionType: dto.optionType,
            });

            return {
                ...greeks,
                underlying: dto.underlying,
                strike: dto.strike,
                timeToExpiry: dto.timeToExpiry,
                volatility: dto.volatility,
                optionType: dto.optionType,
            };
        } catch (error: any) {
            throw new HttpException(
                `Failed to calculate Greeks: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get options chain for a ticker
     * Will integrate with data provider in next phase
     */
    async getOptionsChain(dto: OptionChainRequestDto): Promise<OptionsChainResponseDto> {
        try {
            // TODO: Integrate with IOptionsDataProvider
            // const chain = await this.dataProvider.getOptionsChain(dto.ticker, maturity);

            // Mock response for now
            throw new HttpException(
                'Options chain data provider not yet integrated. Add yfinance or paid provider.',
                HttpStatus.NOT_IMPLEMENTED,
            );
        } catch (error: any) {
            throw new HttpException(
                `Failed to fetch options chain: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Calculate implied volatility using Newton-Raphson method
     */
    async calculateImpliedVolatility(
        dto: ImpliedVolatilityRequestDto,
    ): Promise<ImpliedVolatilityResponseDto> {
        try {
            const timeToExpiry = this.calculateTimeToExpiry(new Date(dto.expiration));

            // For IV calculation, we need an underlying price estimate
            // Using strike as proxy if not provided (should fetch from market data)
            const underlyingEstimate = dto.strike;

            const result = this.newtonRaphsonIV({
                underlying: underlyingEstimate,
                strike: dto.strike,
                timeToExpiry,
                riskFreeRate: 0.05, // Default 5% - should fetch from FRED
                marketPrice: dto.marketPrice,
                optionType: dto.optionType,
            });

            return result;
        } catch (error: any) {
            throw new HttpException(
                `Failed to calculate IV: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Calculate multi-leg strategy payoff and Greeks
     */
    async calculateStrategy(dto: CalculateStrategyDto): Promise<StrategyResponseDto> {
        try {
            // First calculate initial cost
            let initialCost = 0;

            for (const leg of dto.legs) {
                const timeToExpiry = this.calculateTimeToExpiry(new Date(leg.expiration));

                const greeks = this.calculateBlackScholesGreeks({
                    underlying: dto.underlyingPrice,
                    strike: leg.strike,
                    timeToExpiry,
                    riskFreeRate: dto.riskFreeRate,
                    volatility: dto.volatility,
                    optionType: leg.optionType,
                });

                const legCost = greeks.price * leg.quantity * 100;
                initialCost += leg.buySell === 'buy' ? legCost : -legCost;
            }

            // Calculate payoff across price range (at expiration)
            const priceRange = this.generatePriceRange(dto.underlyingPrice);
            const payoff: PayoffPoint[] = [];

            for (const price of priceRange) {
                let totalPL = 0;

                for (const leg of dto.legs) {
                    // At expiration (T=0), option value is just intrinsic value
                    const intrinsicValue = leg.optionType === 'call'
                        ? Math.max(price - leg.strike, 0)
                        : Math.max(leg.strike - price, 0);

                    const legValue = intrinsicValue * leg.quantity * 100;
                    const multiplier = leg.buySell === 'buy' ? 1 : -1;

                    totalPL += legValue * multiplier;
                }

                // Subtract initial cost to get profit/loss
                payoff.push({ underlyingPrice: price, profitLoss: totalPL - initialCost });
            }

            // Calculate aggregated Greeks at current price
            let aggregatedGreeks = { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0 };

            for (const leg of dto.legs) {
                const timeToExpiry = this.calculateTimeToExpiry(new Date(leg.expiration));

                const greeks = this.calculateBlackScholesGreeks({
                    underlying: dto.underlyingPrice,
                    strike: leg.strike,
                    timeToExpiry,
                    riskFreeRate: dto.riskFreeRate,
                    volatility: dto.volatility,
                    optionType: leg.optionType,
                });

                const multiplier = leg.buySell === 'buy' ? 1 : -1;
                const contractMultiplier = leg.quantity * 100;

                aggregatedGreeks.delta += greeks.delta * multiplier * contractMultiplier;
                aggregatedGreeks.gamma += greeks.gamma * multiplier * contractMultiplier;
                aggregatedGreeks.theta += greeks.theta * multiplier * contractMultiplier;
                aggregatedGreeks.vega += greeks.vega * multiplier * contractMultiplier;
                aggregatedGreeks.rho += greeks.rho * multiplier * contractMultiplier;
            }

            // Find break-evens and max profit/loss
            const breakEvens = this.findBreakEvens(payoff);
            const maxProfit = Math.max(...payoff.map(p => p.profitLoss));
            const maxLoss = Math.min(...payoff.map(p => p.profitLoss));

            return {
                strategyName: this.detectStrategyName(dto.legs),
                payoff,
                breakEvens,
                maxProfit,
                maxLoss,
                greeks: aggregatedGreeks,
                initialCost,
                legs: dto.legs,
            };
        } catch (error: any) {
            throw new HttpException(
                `Failed to calculate strategy: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Black-Scholes pricing formula (TypeScript implementation)
     * TODO: Replace with WASM for 10-100x performance improvement
     */
    private calculateBlackScholesGreeks(params: OptionParams): Greeks {
        const { underlying: S, strike: K, timeToExpiry: T, riskFreeRate: r, volatility: sigma, optionType } = params;

        if (T <= 0) {
            const price = optionType === 'call' ? Math.max(S - K, 0) : Math.max(K - S, 0);
            return { delta: 0, gamma: 0, theta: 0, vega: 0, rho: 0, price };
        }

        const d1 = (Math.log(S / K) + (r + 0.5 * sigma ** 2) * T) / (sigma * Math.sqrt(T));
        const d2 = d1 - sigma * Math.sqrt(T);

        const Nd1 = this.normalCDF(d1);
        const Nd2 = this.normalCDF(d2);
        const npd1 = this.normalPDF(d1);

        let price: number, delta: number, theta: number, rho: number;

        if (optionType === 'call') {
            price = S * Nd1 - K * Math.exp(-r * T) * Nd2;
            delta = Nd1;
            theta = (-S * npd1 * sigma / (2 * Math.sqrt(T)) - r * K * Math.exp(-r * T) * Nd2) / 365;
            rho = (K * T * Math.exp(-r * T) * Nd2) / 100;
        } else {
            price = K * Math.exp(-r * T) * this.normalCDF(-d2) - S * this.normalCDF(-d1);
            delta = Nd1 - 1;
            theta = (-S * npd1 * sigma / (2 * Math.sqrt(T)) + r * K * Math.exp(-r * T) * this.normalCDF(-d2)) / 365;
            rho = (-K * T * Math.exp(-r * T) * this.normalCDF(-d2)) / 100;
        }

        const gamma = npd1 / (S * sigma * Math.sqrt(T));
        const vega = (S * Math.sqrt(T) * npd1) / 100;

        return { delta, gamma, theta, vega, rho, price };
    }

    /**
     * Newton-Raphson method for implied volatility calculation
     */
    private newtonRaphsonIV(params: {
        underlying: number;
        strike: number;
        timeToExpiry: number;
        riskFreeRate: number;
        marketPrice: number;
        optionType: OptionType;
    }): ImpliedVolatilityResponseDto {
        let sigma = 0.25; // Initial guess: 25% volatility
        const maxIterations = 100;
        const tolerance = 0.0001;
        let iterations = 0;

        for (let i = 0; i < maxIterations; i++) {
            iterations++;

            const greeks = this.calculateBlackScholesGreeks({
                underlying: params.underlying,
                strike: params.strike,
                timeToExpiry: params.timeToExpiry,
                riskFreeRate: params.riskFreeRate,
                volatility: sigma,
                optionType: params.optionType,
            });

            const priceDiff = greeks.price - params.marketPrice;

            if (Math.abs(priceDiff) < tolerance) {
                return { impliedVolatility: sigma, iterations, error: priceDiff };
            }

            // Newton-Raphson update: σ_new = σ_old - f(σ) / f'(σ)
            // f(σ) = BS_price(σ) - market_price
            // f'(σ) = vega
            const vegaValue = greeks.vega * 100; // Convert back from percentage

            if (vegaValue < 0.0001) {
                // Vega too small, can't divide
                throw new Error('IV calculation: vega too small');
            }

            sigma = sigma - priceDiff / vegaValue;

            // Ensure volatility stays in reasonable bounds
            sigma = Math.max(0.01, Math.min(sigma, 3.0));
        }

        throw new Error('IV calculation exceeded max iterations');
    }

    /**
     * Helper: Normal cumulative distribution function
     */
    private normalCDF(x: number): number {
        const t = 1 / (1 + 0.2316419 * Math.abs(x));
        const d = 0.3989423 * Math.exp(-x * x / 2);
        const prob = d * t * (0.3193815 + t * (-0.3565638 + t * (1.781478 + t * (-1.821256 + t * 1.330274))));
        return x > 0 ? 1 - prob : prob;
    }

    /**
     * Helper: Normal probability density function
     */
    private normalPDF(x: number): number {
        return Math.exp(-x * x / 2) / Math.sqrt(2 * Math.PI);
    }

    /**
     * Helper: Calculate time to expiry in years
     */
    private calculateTimeToExpiry(expiration: Date): number {
        const now = new Date();
        const diffMs = expiration.getTime() - now.getTime();
        const diffDays = diffMs / (1000 * 60 * 60 * 24);
        return Math.max(diffDays / 365, 0);
    }

    /**
     * Helper: Generate price range for payoff diagram
     */
    private generatePriceRange(currentPrice: number): number[] {
        const range: number[] = [];
        const minPrice = currentPrice * 0.7; // -30%
        const maxPrice = currentPrice * 1.3; // +30%
        const step = (maxPrice - minPrice) / 100;

        for (let price = minPrice; price <= maxPrice; price += step) {
            range.push(price);
        }

        return range;
    }

    /**
     * Helper: Find break-even points in payoff
     */
    private findBreakEvens(payoff: PayoffPoint[]): number[] {
        const breakEvens: number[] = [];

        for (let i = 0; i < payoff.length - 1; i++) {
            const current = payoff[i];
            const next = payoff[i + 1];

            // Check if sign changes (crosses zero)
            if (current.profitLoss * next.profitLoss < 0) {
                // Linear interpolation to find exact break-even
                const slope = (next.profitLoss - current.profitLoss) / (next.underlyingPrice - current.underlyingPrice);
                const breakEven = current.underlyingPrice - current.profitLoss / slope;
                breakEvens.push(breakEven);
            }
        }

        return breakEvens;
    }

    /**
     * Helper: Detect strategy name from legs
     */
    private detectStrategyName(legs: any[]): string {
        if (legs.length === 1) {
            const leg = legs[0];
            return leg.buySell === 'buy'
                ? `Long ${leg.optionType === 'call' ? 'Call' : 'Put'}`
                : `Short ${leg.optionType === 'call' ? 'Call' : 'Put'}`;
        }

        if (legs.length === 2) {
            const calls = legs.filter(l => l.optionType === 'call');
            const puts = legs.filter(l => l.optionType === 'put');

            if (calls.length === 2) {
                return legs[0].buySell === 'buy' ? 'Bull Call Spread' : 'Bear Call Spread';
            }
            if (puts.length === 2) {
                return legs[0].buySell === 'buy' ? 'Bear Put Spread' : 'Bull Put Spread';
            }
            if (calls.length === 1 && puts.length === 1 && legs.every(l => l.strike === legs[0].strike)) {
                return legs[0].buySell === 'buy' ? 'Long Straddle' : 'Short Straddle';
            }
        }

        if (legs.length === 4) {
            const calls = legs.filter(l => l.optionType === 'call').length;
            const puts = legs.filter(l => l.optionType === 'put').length;
            if (calls === 2 && puts === 2) {
                return 'Iron Condor';
            }
        }

        return 'Custom Strategy';
    }

    /**
     * Generate mock volatility surface data
     * TODO: Replace with real data from options chain provider
     */
    async getVolatilitySurface(ticker: string): Promise<any> {
        // Generate mock IV surface data
        const strikes = Array.from({ length: 11 }, (_, i) => 80 + i * 5); // 80, 85, 90, ..., 130
        const maturities = [7, 14, 30, 60, 90, 180]; // Days to expiration

        const surface: any[] = [];

        for (const maturity of maturities) {
            for (const strike of strikes) {
                // Generate realistic IV smile pattern
                // IV tends to be higher for OTM options (volatility smile)
                const atmStrike = 105;
                const moneyness = Math.abs(strike - atmStrike) / atmStrike;

                // Base IV increases with time (term structure)
                const baseIV = 0.20 + (maturity / 365) * 0.10;

                // Smile effect: higher IV for OTM options
                const smileEffect = moneyness * 0.5;

                // Add some noise
                const noise = (Math.random() - 0.5) * 0.02;

                const iv = Math.max(0.10, Math.min(0.60, baseIV + smileEffect + noise));

                surface.push({
                    strike,
                    maturity,
                    maturityLabel: `${maturity}d`,
                    impliedVolatility: iv,
                    moneyness: strike / atmStrike,
                });
            }
        }

        return {
            ticker,
            underlyingPrice: 105,
            strikes,
            maturities,
            surface,
            timestamp: new Date(),
        };
    }
}
