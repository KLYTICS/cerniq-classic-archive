import { Controller, Get, Post, Put, Delete, Param, Query, Body, HttpException, HttpStatus } from '@nestjs/common';
import { TickerService } from './ticker.service';
import { TickerDto, CreateTickerDto, UpdateTickerDto, TickerListQueryDto } from './dto/ticker.dto';

@Controller('api/tickers')
export class TickerController {
    constructor(private readonly tickerService: TickerService) { }

    /**
     * Get a single ticker by symbol
     * GET /api/tickers/:symbol
     */
    @Get(':symbol')
    async getTicker(@Param('symbol') symbol: string): Promise<TickerDto> {
        try {
            return await this.tickerService.getTicker(symbol);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch ticker',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * List tickers with filtering and pagination
     * GET /api/tickers?assetType=stock&sector=Technology&page=1&limit=50
     */
    @Get()
    async listTickers(@Query() query: TickerListQueryDto) {
        try {
            return await this.tickerService.listTickers(query);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to list tickers',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Create a new ticker
     * POST /api/tickers
     */
    @Post()
    async createTicker(@Body() createDto: CreateTickerDto): Promise<TickerDto> {
        try {
            return await this.tickerService.createTicker(createDto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to create ticker',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Update an existing ticker
     * PUT /api/tickers/:symbol
     */
    @Put(':symbol')
    async updateTicker(
        @Param('symbol') symbol: string,
        @Body() updateDto: UpdateTickerDto,
    ): Promise<TickerDto> {
        try {
            return await this.tickerService.updateTicker(symbol, updateDto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to update ticker',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Delete a ticker (soft delete)
     * DELETE /api/tickers/:symbol
     */
    @Delete(':symbol')
    async deleteTicker(@Param('symbol') symbol: string): Promise<{ message: string }> {
        try {
            await this.tickerService.deleteTicker(symbol);
            return { message: `Ticker ${symbol} deleted successfully` };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to delete ticker',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Enrich ticker metadata from external sources
     * POST /api/tickers/:symbol/enrich
     */
    @Post(':symbol/enrich')
    async enrichTicker(@Param('symbol') symbol: string): Promise<TickerDto> {
        try {
            return await this.tickerService.enrichTicker(symbol);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to enrich ticker',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
