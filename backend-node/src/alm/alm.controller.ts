import { Controller, Post, Get, Body, Logger } from '@nestjs/common';
import { AlmService } from './alm.service';
import {
    ScenarioRequestDto,
    LCRRequestDto,
    FullAnalysisRequestDto,
    BalanceSheetDto,
} from './alm.dto';
import type {
    DurationGapResult,
    NIIResult,
    EVEResult,
    LCRResult,
    BPVResult,
    FullAnalysisResult,
} from './alm.dto';

@Controller('api/alm')
export class AlmController {
    private readonly logger = new Logger(AlmController.name);

    constructor(private readonly almService: AlmService) {}

    /**
     * POST /api/alm/duration-gap
     * Compute duration gap analysis for a balance sheet.
     */
    @Post('duration-gap')
    durationGap(@Body() dto: ScenarioRequestDto): DurationGapResult {
        this.logger.log('Duration gap analysis requested');
        return this.almService.durationGapAnalysis(dto.balanceSheet);
    }

    /**
     * POST /api/alm/nii-simulation
     * Run NII simulation under parallel rate shocks.
     */
    @Post('nii-simulation')
    niiSimulation(@Body() dto: ScenarioRequestDto): NIIResult {
        this.logger.log('NII simulation requested');
        return this.almService.niiSimulation(dto.balanceSheet, dto.rateShocks);
    }

    /**
     * POST /api/alm/eve
     * Compute Economic Value of Equity under rate shocks.
     */
    @Post('eve')
    eve(@Body() dto: ScenarioRequestDto): EVEResult {
        this.logger.log('EVE analysis requested');
        return this.almService.eveAnalysis(dto.balanceSheet, dto.rateShocks);
    }

    /**
     * POST /api/alm/lcr
     * Compute Liquidity Coverage Ratio.
     */
    @Post('lcr')
    lcr(@Body() dto: LCRRequestDto): LCRResult {
        this.logger.log('LCR computation requested');
        return this.almService.liquidityCoverageRatio(dto);
    }

    /**
     * POST /api/alm/bpv
     * Compute Basis Point Value (DV01) for all instruments.
     */
    @Post('bpv')
    bpv(@Body() dto: ScenarioRequestDto): BPVResult {
        this.logger.log('BPV analysis requested');
        return this.almService.basisPointValue(dto.balanceSheet);
    }

    /**
     * POST /api/alm/full-analysis
     * Run all ALM analyses in a single call.
     */
    @Post('full-analysis')
    fullAnalysis(@Body() dto: FullAnalysisRequestDto): FullAnalysisResult {
        this.logger.log('Full ALM analysis requested');
        return this.almService.fullAnalysis(
            dto.balanceSheet,
            dto.rateShocks,
            dto.lcr,
        );
    }

    /**
     * GET /api/alm/demo-balance-sheet
     * Return the $500M community bank demo balance sheet.
     */
    @Get('demo-balance-sheet')
    demoBalanceSheet(): BalanceSheetDto {
        this.logger.log('Demo balance sheet requested');
        return this.almService.getDemoBalanceSheet();
    }

    /**
     * GET /api/alm/demo-analysis
     * Run the full analysis on the demo balance sheet — one-click demo.
     */
    @Get('demo-analysis')
    demoAnalysis(): FullAnalysisResult {
        this.logger.log('Demo full analysis requested');
        const bs = this.almService.getDemoBalanceSheet();
        return this.almService.fullAnalysis(bs);
    }
}
