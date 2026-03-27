import {
  IsString,
  IsNumber,
  IsOptional,
  Min,
  MaxLength,
} from 'class-validator';

export class PortfolioDto {
  id: string;
  userId: string;
  name: string;
  description?: string;
  currency: string;
  initialCash: number;
  currentCash: number;
  totalValue: number;
  totalPnL: number;
  totalPnLPercent: number;
  createdAt: Date;
  updatedAt: Date;
  positions?: PositionDto[];
}

export class PositionDto {
  id: string;
  portfolioId: string;
  ticker: string;
  quantity: number;
  avgCost: number;
  currentPrice: number;
  marketValue: number;
  unrealizedPnL: number;
  unrealizedPnLPercent: number;
  weight: number;
  addedAt: Date;
  updatedAt: Date;
}

export class CreatePortfolioDto {
  @IsString()
  @MaxLength(100)
  name: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsString()
  currency?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  initialCash?: number;
}

export class UpdatePortfolioDto {
  @IsOptional()
  @IsString()
  @MaxLength(100)
  name?: string;

  @IsOptional()
  @IsString()
  @MaxLength(500)
  description?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  currentCash?: number;
}

export class AddPositionDto {
  @IsString()
  ticker: string;

  @IsNumber()
  @Min(0.0001)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class UpdatePositionDto {
  @IsOptional()
  @IsNumber()
  @Min(0)
  quantity?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  avgCost?: number;
}

export class PortfolioAnalyticsDto {
  portfolioId: string;
  totalReturn: number;
  totalReturnPercent: number;
  dailyReturn: number;
  dailyReturnPercent: number;
  volatility: number;
  sharpeRatio: number;
  beta: number;
  maxDrawdown: number;
  winRate: number;
  bestPerformer: { ticker: string; return: number };
  worstPerformer: { ticker: string; return: number };
}
