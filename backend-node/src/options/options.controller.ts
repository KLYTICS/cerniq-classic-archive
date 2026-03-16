import { Controller, Post, Get, Body, Param, Query, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { OptionsService } from './options.service';
import {
    CalculateGreeksDto,
    GreeksResponseDto,
    OptionChainRequestDto,
    OptionsChainResponseDto,
    ImpliedVolatilityRequestDto,
    ImpliedVolatilityResponseDto,
} from './dto/options.dto';
import { CalculateStrategyDto, StrategyResponseDto, STRATEGY_PRESETS } from './dto/strategy.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/options')
@UseGuards(AuthGuard)
export class OptionsController {
    constructor(private readonly optionsService: OptionsService) { }

    /**
     * Calculate Black-Scholes Greeks for a single option
     * POST /api/options/calculate
     * 
     * @example
     * {
     *   "underlying": 100,
     *   "strike": 105,
     *   "timeToExpiry": 0.25,
     *   "riskFreeRate": 0.05,
     *   "volatility": 0.25,
     *   "optionType": "call"
     * }
     */
    @Post('calculate')
    async calculateGreeks(@Body() dto: CalculateGreeksDto): Promise<GreeksResponseDto> {
        try {
            return await this.optionsService.calculateGreeks(dto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate Greeks',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get options chain for a ticker
     * GET /api/options/chain/:ticker?maturity=2024-06-21
     * 
     * Note: Requires options data provider integration
     */
    @Get('chain/:ticker')
    async getOptionsChain(
        @Param('ticker') ticker: string,
        @Query('maturity') maturity?: string,
    ): Promise<OptionsChainResponseDto> {
        try {
            const dto: OptionChainRequestDto = {
                ticker: ticker.toUpperCase(),
                maturity,
            };
            return await this.optionsService.getOptionsChain(dto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch options chain',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Calculate implied volatility for a specific option
     * POST /api/options/implied-volatility
     * 
     * @example
     * {
     *   "ticker": "AAPL",
     *   "strike": 150,
     *   "expiration": "2024-06-21",
     *   "optionType": "call",
     *   "marketPrice": 5.25
     * }
     */
    @Post('implied-volatility')
    async calculateImpliedVolatility(
        @Body() dto: ImpliedVolatilityRequestDto,
    ): Promise<ImpliedVolatilityResponseDto> {
        try {
            return await this.optionsService.calculateImpliedVolatility(dto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate implied volatility',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Calculate multi-leg options strategy
     * POST /api/options/strategy
     * 
     * @example
     * {
     *   "legs": [
     *     { "strike": 100, "expiration": "2024-06-21", "optionType": "call", "quantity": 1, "buySell": "buy" },
     *     { "strike": 110, "expiration": "2024-06-21", "optionType": "call", "quantity": 1, "buySell": "sell" }
     *   ],
     *   "underlyingPrice": 105,
     *   "volatility": 0.25,
     *   "riskFreeRate": 0.05
     * }
     */
    @Post('strategy')
    async calculateStrategy(@Body() dto: CalculateStrategyDto): Promise<StrategyResponseDto> {
        try {
            return await this.optionsService.calculateStrategy(dto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate strategy',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get list of common strategy presets
     * GET /api/options/strategy-presets
     */
    @Get('strategy-presets')
    getStrategyPresets() {
        return {
            presets: STRATEGY_PRESETS,
            count: STRATEGY_PRESETS.length,
        };
    }

    /**
     * Health check endpoint
     * GET /api/options/health
     */
    @Get('health')
    healthCheck() {
        return {
            status: 'ok',
            service: 'options',
            features: {
                greeksCalculation: true,
                impliedVolatility: true,
                strategyAnalysis: true,
                optionsChain: false, // Not yet implemented (needs data provider)
                volatilitySurface: true, // Mock data available
            },
            timestamp: new Date().toISOString(),
        };
    }

    /**
     * Get volatility surface for a ticker
     * GET /api/options/surface/:ticker
     */
    @Get('surface/:ticker')
    async getVolatilitySurface(@Param('ticker') ticker: string) {
        try {
            return await this.optionsService.getVolatilitySurface(ticker);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch volatility surface',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
