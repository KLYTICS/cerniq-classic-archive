import {
  Controller,
  Get,
  Post,
  Put,
  Delete,
  Param,
  Body,
  Req,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { PortfolioService } from './portfolio.service';
import {
  PortfolioDto,
  CreatePortfolioDto,
  UpdatePortfolioDto,
  AddPositionDto,
  PortfolioAnalyticsDto,
} from './dto/portfolio.dto';
import { AuthGuard } from '../auth/auth.guard';

@Controller('api/portfolios')
@UseGuards(AuthGuard)
export class PortfolioController {
  constructor(private readonly portfolioService: PortfolioService) {}

  @Get()
  async getUserPortfolios(@Req() req: any): Promise<PortfolioDto[]> {
    try {
      return await this.portfolioService.getUserPortfolios(req.user.userId);
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch portfolios',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Get(':id')
  async getPortfolio(
    @Param('id') portfolioId: string,
    @Req() req: any,
  ): Promise<PortfolioDto> {
    try {
      return await this.portfolioService.getPortfolio(
        portfolioId,
        req.user.userId,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch portfolio',
        error.status || HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post()
  async createPortfolio(
    @Req() req: any,
    @Body() createDto: CreatePortfolioDto,
  ): Promise<PortfolioDto> {
    try {
      return await this.portfolioService.createPortfolio(
        req.user.userId,
        createDto,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to create portfolio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Put(':id')
  async updatePortfolio(
    @Param('id') portfolioId: string,
    @Req() req: any,
    @Body() updateDto: UpdatePortfolioDto,
  ): Promise<PortfolioDto> {
    try {
      return await this.portfolioService.updatePortfolio(
        portfolioId,
        req.user.userId,
        updateDto,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to update portfolio',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id')
  async deletePortfolio(
    @Param('id') portfolioId: string,
    @Req() req: any,
  ): Promise<{ message: string }> {
    try {
      await this.portfolioService.deletePortfolio(portfolioId, req.user.userId);
      return { message: `Portfolio ${portfolioId} deleted successfully` };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to delete portfolio',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }

  @Post(':id/positions')
  async addPosition(
    @Param('id') portfolioId: string,
    @Req() req: any,
    @Body() addDto: AddPositionDto,
  ) {
    try {
      return await this.portfolioService.addPosition(
        portfolioId,
        req.user.userId,
        addDto,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to add position',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Delete(':id/positions/:ticker')
  async removePosition(
    @Param('id') portfolioId: string,
    @Param('ticker') ticker: string,
    @Req() req: any,
    @Body() body: { quantity: number; sellPrice: number },
  ): Promise<{ message: string }> {
    try {
      await this.portfolioService.removePosition(
        portfolioId,
        req.user.userId,
        ticker,
        body.quantity,
        body.sellPrice,
      );
      return { message: `Position ${ticker} updated successfully` };
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to remove position',
        HttpStatus.BAD_REQUEST,
      );
    }
  }

  @Get(':id/analytics')
  async getPortfolioAnalytics(
    @Param('id') portfolioId: string,
    @Req() req: any,
  ): Promise<PortfolioAnalyticsDto> {
    try {
      return await this.portfolioService.getPortfolioAnalytics(
        portfolioId,
        req.user.userId,
      );
    } catch (error: any) {
      throw new HttpException(
        error.message || 'Failed to fetch analytics',
        HttpStatus.INTERNAL_SERVER_ERROR,
      );
    }
  }
}
