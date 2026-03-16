import { Controller, Get, Post, Body, Param, Query, HttpException, HttpStatus, UseGuards } from '@nestjs/common';
import { ValuationService } from './valuation.service';
import {
    ValuationRequestDto,
    KPIScoreDto,
    ScreenerRequestDto,
    ScreenerResultDto,
} from './dto/valuation.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/valuation')
@UseGuards(AuthGuard)
export class ValuationController {
    constructor(private readonly valuationService: ValuationService) { }

    /**
     * Get valuation for a specific ticker
     * POST /api/valuation/calculate
     */
    @Post('calculate')
    async getValuation(@Body() request: ValuationRequestDto) {
        try {
            return await this.valuationService.getValuation(request);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate valuation',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get KPI score for a ticker
     * GET /api/valuation/kpi/:ticker
     */
    @Get('kpi/:ticker')
    async getKPIScore(@Param('ticker') ticker: string): Promise<KPIScoreDto> {
        try {
            return await this.valuationService.getKPIScore(ticker);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate KPI score',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Run valuation screener
     * GET /api/valuation/screener?sector=Technology&minScore=70
     */
    @Get('screener')
    async runScreener(@Query() query: ScreenerRequestDto): Promise<ScreenerResultDto[]> {
        try {
            return await this.valuationService.runScreener(query);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to run screener',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get cyclical valuation specifically
     * GET /api/valuation/cyclical/:ticker
     */
    @Get('cyclical/:ticker')
    async getCyclicalValuation(@Param('ticker') ticker: string) {
        try {
            return await this.valuationService.getValuation({
                ticker,
                valuationType: 'cyclical',
            });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate cyclical valuation',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get compounder valuation specifically
     * GET /api/valuation/compounder/:ticker
     */
    @Get('compounder/:ticker')
    async getCompounderValuation(@Param('ticker') ticker: string) {
        try {
            return await this.valuationService.getValuation({
                ticker,
                valuationType: 'compounder',
            });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate compounder valuation',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get frontier valuation specifically
     * GET /api/valuation/frontier/:ticker
     */
    @Get('frontier/:ticker')
    async getFrontierValuation(@Param('ticker') ticker: string) {
        try {
            return await this.valuationService.getValuation({
                ticker,
                valuationType: 'frontier',
            });
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to calculate frontier valuation',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
