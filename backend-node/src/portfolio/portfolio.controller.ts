import { Controller, Get, Post, Put, Delete, Param, Body, HttpException, HttpStatus, Headers } from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import { PortfolioDto, CreatePortfolioDto, UpdatePortfolioDto, AddPositionDto, PortfolioAnalyticsDto } from './dto/portfolio.dto';

@Controller('api/portfolios')
export class PortfolioController {
    constructor(private readonly portfolioService: PortfolioService) { }

    /**
     * Get all portfolios for the authenticated user
     * GET /api/portfolios
     */
    @Get()
    async getUserPortfolios(@Headers('user-id') userId: string): Promise<PortfolioDto[]> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            return await this.portfolioService.getUserPortfolios(userId);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch portfolios',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Get a specific portfolio
     * GET /api/portfolios/:id
     */
    @Get(':id')
    async getPortfolio(
        @Param('id') portfolioId: string,
        @Headers('user-id') userId: string,
    ): Promise<PortfolioDto> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            return await this.portfolioService.getPortfolio(portfolioId, userId);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch portfolio',
                error.status || HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Create a new portfolio
     * POST /api/portfolios
     */
    @Post()
    async createPortfolio(
        @Headers('user-id') userId: string,
        @Body() createDto: CreatePortfolioDto,
    ): Promise<PortfolioDto> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            return await this.portfolioService.createPortfolio(userId, createDto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to create portfolio',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Update portfolio metadata
     * PUT /api/portfolios/:id
     */
    @Put(':id')
    async updatePortfolio(
        @Param('id') portfolioId: string,
        @Headers('user-id') userId: string,
        @Body() updateDto: UpdatePortfolioDto,
    ): Promise<PortfolioDto> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            return await this.portfolioService.updatePortfolio(portfolioId, userId, updateDto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to update portfolio',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Delete a portfolio
     * DELETE /api/portfolios/:id
     */
    @Delete(':id')
    async deletePortfolio(
        @Param('id') portfolioId: string,
        @Headers('user-id') userId: string,
    ): Promise<{ message: string }> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            await this.portfolioService.deletePortfolio(portfolioId, userId);
            return { message: `Portfolio ${portfolioId} deleted successfully` };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to delete portfolio',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }

    /**
     * Add a position to portfolio
     * POST /api/portfolios/:id/positions
     */
    @Post(':id/positions')
    async addPosition(
        @Param('id') portfolioId: string,
        @Headers('user-id') userId: string,
        @Body() addDto: AddPositionDto,
    ) {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            return await this.portfolioService.addPosition(portfolioId, userId, addDto);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to add position',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Remove/sell a position from portfolio
     * DELETE /api/portfolios/:id/positions/:ticker?quantity=100&sellPrice=150
     */
    @Delete(':id/positions/:ticker')
    async removePosition(
        @Param('id') portfolioId: string,
        @Param('ticker') ticker: string,
        @Headers('user-id') userId: string,
        @Body() body: { quantity: number; sellPrice: number },
    ): Promise<{ message: string }> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            await this.portfolioService.removePosition(portfolioId, userId, ticker, body.quantity, body.sellPrice);
            return { message: `Position ${ticker} updated successfully` };
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to remove position',
                HttpStatus.BAD_REQUEST,
            );
        }
    }

    /**
     * Get portfolio analytics
     * GET /api/portfolios/:id/analytics
     */
    @Get(':id/analytics')
    async getPortfolioAnalytics(
        @Param('id') portfolioId: string,
        @Headers('user-id') userId: string,
    ): Promise<PortfolioAnalyticsDto> {
        if (!userId) {
            throw new HttpException('User ID required', HttpStatus.UNAUTHORIZED);
        }

        try {
            return await this.portfolioService.getPortfolioAnalytics(portfolioId, userId);
        } catch (error: any) {
            throw new HttpException(
                error.message || 'Failed to fetch analytics',
                HttpStatus.INTERNAL_SERVER_ERROR,
            );
        }
    }
}
