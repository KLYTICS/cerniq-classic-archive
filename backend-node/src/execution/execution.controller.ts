import { Controller, Post, Get, Body, Query, HttpException, HttpStatus } from '@nestjs/common';
import { ExecutionService } from './execution.service';
import { BacktestService } from './backtest.service';

@Controller('api/execution')
export class ExecutionController {
    constructor(
        private readonly executionService: ExecutionService,
        private readonly backtestService: BacktestService,
    ) { }

    @Post('slippage')
    async analyzeSlippage(@Body() execution: any) {
        try {
            return await this.executionService.calculateSlippage(execution);
        } catch (error: any) {
            throw new HttpException(
                `Slippage analysis failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('vwap')
    async analyzeVWAP(
        @Body() execution: any,
        @Query('period') periodMinutes: string = '60',
    ) {
        try {
            return await this.executionService.analyzeVWAP(execution, parseInt(periodMinutes));
        } catch (error: any) {
            throw new HttpException(
                `VWAP analysis failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('best-execution-report')
    async generateBestExecutionReport(
        @Body() body: { executions: any[]; startDate: string; endDate: string },
    ) {
        try {
            return await this.executionService.generateBestExecutionReport(body.executions, {
                start: new Date(body.startDate),
                end: new Date(body.endDate),
            });
        } catch (error: any) {
            throw new HttpException(
                `Report generation failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('implementation-shortfall')
    async calculateImplementationShortfall(@Body() trade: any) {
        try {
            return await this.executionService.calculateImplementationShortfall(trade);
        } catch (error: any) {
            throw new HttpException(
                `Implementation shortfall calculation failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Post('backtest')
    async runBacktest(@Body() config: any) {
        try {
            return await this.backtestService.runBacktest(config);
        } catch (error: any) {
            throw new HttpException(
                `Backtest failed: ${error.message}`,
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    @Get('strategies')
    getAvailableStrategies(): any[] {
        return [
            {
                name: 'SMA Crossover (10/30)',
                type: 'SMA_CROSSOVER',
                lookbackPeriod: 50,
                params: { shortPeriod: 10, longPeriod: 30 },
            },
            {
                name: 'SMA Crossover (20/50)',
                type: 'SMA_CROSSOVER',
                lookbackPeriod: 60,
                params: { shortPeriod: 20, longPeriod: 50 },
            },
            {
                name: 'RSI Mean Reversion',
                type: 'RSI_REVERSAL',
                lookbackPeriod: 20,
                params: { rsiPeriod: 14, oversold: 30, overbought: 70 },
            },
            {
                name: 'Momentum (30-day)',
                type: 'MOMENTUM',
                lookbackPeriod: 30,
                params: { momentumThreshold: 5 },
            },
        ];
    }
}
