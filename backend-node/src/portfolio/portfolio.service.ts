import { Injectable, Logger, NotFoundException } from '@nestjs/common';
import {
  PortfolioDto,
  PositionDto,
  CreatePortfolioDto,
  UpdatePortfolioDto,
  AddPositionDto,
  PortfolioAnalyticsDto,
} from './dto/portfolio.dto';
import { MarketDataService } from '../market-data/market-data.service';
import { PrismaService } from '../prisma.service';
import { Prisma } from '@prisma/client';

@Injectable()
export class PortfolioService {
  private readonly logger = new Logger(PortfolioService.name);

  constructor(
    private readonly marketDataService: MarketDataService,
    private readonly prisma: PrismaService,
  ) {}

  /**
   * Get all portfolios for a user
   */
  async getUserPortfolios(userId: string): Promise<PortfolioDto[]> {
    const portfolios = await this.prisma.portfolio.findMany({
      where: { userId },
      include: { positions: true },
      take: 100,
    });

    const results: PortfolioDto[] = [];

    // Enrich with current prices and calculations
    for (const p of portfolios) {
      const dto = this.mapToDto(p, p.positions);
      await this.updatePortfolioValues(dto);
      results.push(dto);
    }

    return results;
  }

  /**
   * Get a single portfolio by ID
   */
  async getPortfolio(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioDto> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
      include: { positions: true },
    });

    if (!portfolio || portfolio.userId !== userId) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    const dto = this.mapToDto(portfolio, portfolio.positions);
    await this.updatePortfolioValues(dto);

    return dto;
  }

  /**
   * Create a new portfolio
   */
  async createPortfolio(
    userId: string,
    createDto: CreatePortfolioDto,
  ): Promise<PortfolioDto> {
    // Ensure user exists (optional check, dependent on auth setup)
    // For now, we assume userId is valid or we might need to create a shadow user if it's from auth service

    const portfolio = await this.prisma.portfolio.create({
      data: {
        userId,
        name: createDto.name,
        description: createDto.description,
        currency: createDto.currency || 'USD',
      },
      include: { positions: true },
    });

    this.logger.log(`Created portfolio: ${portfolio.name} for user ${userId}`);
    const dto = this.mapToDto(portfolio, []);
    // No need to update values for empty portfolio
    return dto;
  }

  /**
   * Update portfolio metadata
   */
  async updatePortfolio(
    portfolioId: string,
    userId: string,
    updateDto: UpdatePortfolioDto,
  ): Promise<PortfolioDto> {
    // defined check first
    const existing = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    const portfolio = await this.prisma.portfolio.update({
      where: { id: portfolioId },
      data: {
        name: updateDto.name,
        description: updateDto.description,
        // currentCash is calculated, not stored directly in schema usually,
        // but if we want to support cash deposit/withdrawal we might need a Transaction model.
        // For simplicity properly mapping this would require schema change or just ignoring cash for now.
      },
      include: { positions: true },
    });

    const dto = this.mapToDto(portfolio, portfolio.positions);
    await this.updatePortfolioValues(dto);
    return dto;
  }

  /**
   * Delete a portfolio
   */
  async deletePortfolio(portfolioId: string, userId: string): Promise<void> {
    const existing = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!existing || existing.userId !== userId) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    await this.prisma.portfolio.delete({
      where: { id: portfolioId },
    });
    this.logger.log(`Deleted portfolio: ${portfolioId}`);
  }

  /**
   * Add a position to portfolio
   */
  async addPosition(
    portfolioId: string,
    userId: string,
    addDto: AddPositionDto,
  ): Promise<PositionDto> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!portfolio || portfolio.userId !== userId) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    // Upsert position
    // Check if exists
    const existing = await this.prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId,
          ticker: addDto.ticker,
        },
      },
    });

    let position;

    if (existing) {
      const newQuantity = Number(existing.quantity) + addDto.quantity;
      const totalCost =
        Number(existing.avgCost) * Number(existing.quantity) +
        addDto.price * addDto.quantity;
      const newAvgCost = totalCost / newQuantity;

      position = await this.prisma.position.update({
        where: { id: existing.id },
        data: {
          quantity: newQuantity,
          avgCost: newAvgCost,
        },
      });
    } else {
      position = await this.prisma.position.create({
        data: {
          portfolioId,
          ticker: addDto.ticker,
          quantity: addDto.quantity,
          avgCost: addDto.price,
        },
      });
    }

    this.logger.log(
      `Updated position ${addDto.ticker} in portfolio ${portfolioId}`,
    );

    return this.mapPositionToDto(position);
  }

  /**
   * Remove (sell) a position from portfolio
   */
  async removePosition(
    portfolioId: string,
    userId: string,
    ticker: string,
    quantity: number,
    sellPrice: number,
  ): Promise<void> {
    const portfolio = await this.prisma.portfolio.findUnique({
      where: { id: portfolioId },
    });
    if (!portfolio || portfolio.userId !== userId) {
      throw new NotFoundException(`Portfolio ${portfolioId} not found`);
    }

    const existing = await this.prisma.position.findUnique({
      where: {
        portfolioId_ticker: {
          portfolioId,
          ticker,
        },
      },
    });

    if (!existing) {
      throw new NotFoundException(`Position ${ticker} not found`);
    }

    const currentQty = Number(existing.quantity);

    if (quantity >= currentQty) {
      await this.prisma.position.delete({
        where: { id: existing.id },
      });
    } else {
      await this.prisma.position.update({
        where: { id: existing.id },
        data: {
          quantity: currentQty - quantity,
        },
      });
    }
  }

  /**
   * Get portfolio analytics
   */
  async getPortfolioAnalytics(
    portfolioId: string,
    userId: string,
  ): Promise<PortfolioAnalyticsDto> {
    const dto = await this.getPortfolio(portfolioId, userId);

    // Calculate analytics
    // Note: For real implementation we should store Cash Balance in DB.
    // usage of initialCash and currentCash in DTO is currently mocked/transient for 'totalValue' calculation

    const totalInvested = 0; // Needs Cash model
    const totalValue = dto.totalValue;
    const totalReturn = dto.totalPnL;
    const totalReturnPercent = dto.totalPnLPercent;

    // Find best/worst performers
    const sortedPositions = [...(dto.positions ?? [])].sort(
      (a, b) => b.unrealizedPnLPercent - a.unrealizedPnLPercent,
    );
    const bestPerformer = sortedPositions[0]
      ? {
          ticker: sortedPositions[0].ticker,
          return: sortedPositions[0].unrealizedPnLPercent,
        }
      : { ticker: 'N/A', return: 0 };
    const worstPerformer = sortedPositions[sortedPositions.length - 1]
      ? {
          ticker: sortedPositions[sortedPositions.length - 1].ticker,
          return:
            sortedPositions[sortedPositions.length - 1].unrealizedPnLPercent,
        }
      : { ticker: 'N/A', return: 0 };

    return {
      portfolioId,
      totalReturn,
      totalReturnPercent,
      dailyReturn: 0,
      dailyReturnPercent: 0,
      volatility: 0,
      sharpeRatio: 0,
      beta: 1.0,
      maxDrawdown: 0,
      winRate:
        (dto.positions ?? []).filter((p) => p.unrealizedPnL > 0).length /
        ((dto.positions ?? []).length || 1),
      bestPerformer,
      worstPerformer,
    };
  }

  private mapToDto(portfolio: any, positions: any[]): PortfolioDto {
    return {
      id: portfolio.id,
      userId: portfolio.userId,
      name: portfolio.name,
      description: portfolio.description,
      currency: portfolio.currency,
      initialCash: 100000, // Hardcoded for now as schema doesn't have it
      currentCash: 100000, // Hardcoded for now
      totalValue: 0,
      totalPnL: 0,
      totalPnLPercent: 0,
      createdAt: portfolio.createdAt,
      updatedAt: portfolio.updatedAt,
      positions: positions.map((p) => this.mapPositionToDto(p)),
    };
  }

  private mapPositionToDto(p: any): PositionDto {
    return {
      id: p.id,
      portfolioId: p.portfolioId,
      ticker: p.ticker,
      quantity: Number(p.quantity),
      avgCost: Number(p.avgCost),
      currentPrice: Number(p.avgCost), // defaulting, will be updated
      marketValue: 0,
      unrealizedPnL: 0,
      unrealizedPnLPercent: 0,
      weight: 0,
      addedAt: p.addedAt,
      updatedAt: p.updatedAt,
    };
  }

  /**
   * Update portfolio values with current market prices
   */
  private async updatePortfolioValues(portfolio: PortfolioDto): Promise<void> {
    let totalPositionValue = 0;
    let totalCostBasis = 0;

    for (const position of portfolio.positions ?? []) {
      try {
        const quote = await this.marketDataService.getQuote(position.ticker);
        // If quote fails, use last known or avgCost safely
        const currentPrice = quote ? quote.price : position.avgCost;

        position.currentPrice = currentPrice;
        position.marketValue = position.currentPrice * position.quantity;
        position.unrealizedPnL =
          position.marketValue - position.avgCost * position.quantity;
        position.unrealizedPnLPercent =
          position.avgCost > 0
            ? (position.unrealizedPnL /
                (position.avgCost * position.quantity)) *
              100
            : 0;

        totalPositionValue += position.marketValue;
        totalCostBasis += position.avgCost * position.quantity;
      } catch (error) {
        this.logger.warn(`Failed to update price for ${position.ticker}`);
      }
    }

    // We are simulating checks against "initialCash" but without a Transaction model (Deposits),
    // we can conceptually treat Total Value = Cash + Positions.
    // For now, let's assume 'initialCash' is a fixed starting point (e.g. 100k paper trading)
    // And 'currentCash' = initialCash - Cost of net positions.

    portfolio.currentCash = portfolio.initialCash - totalCostBasis;
    portfolio.totalValue = portfolio.currentCash + totalPositionValue;
    portfolio.totalPnL = portfolio.totalValue - portfolio.initialCash;
    portfolio.totalPnLPercent =
      portfolio.initialCash > 0
        ? (portfolio.totalPnL / portfolio.initialCash) * 100
        : 0;

    // Update position weights
    for (const position of portfolio.positions ?? []) {
      position.weight =
        portfolio.totalValue > 0
          ? (position.marketValue / portfolio.totalValue) * 100
          : 0;
    }
  }
}
