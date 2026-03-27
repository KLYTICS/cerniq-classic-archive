import {
  IsString,
  IsNumber,
  IsOptional,
  IsBoolean,
  IsIn,
  Min,
  Max,
  MaxLength,
} from 'class-validator';

export class TickerDto {
  ticker: string;
  name: string;
  sector?: string;
  industry?: string;
  assetType: 'stock' | 'etf' | 'crypto' | 'index';
  exchange?: string;
  country?: string;
  marketCap?: number;
  isActive: boolean;
  firstAdded: Date;
  lastUpdated: Date;
  metadata?: Record<string, any>;
}

export class CreateTickerDto {
  @IsString()
  @MaxLength(10)
  ticker: string;

  @IsString()
  @MaxLength(200)
  name: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsIn(['stock', 'etf', 'crypto', 'index'])
  assetType: 'stock' | 'etf' | 'crypto' | 'index';

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marketCap?: number;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class UpdateTickerDto {
  @IsOptional()
  @IsString()
  @MaxLength(200)
  name?: string;

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  exchange?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  marketCap?: number;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  metadata?: Record<string, any>;
}

export class TickerListQueryDto {
  @IsOptional()
  @IsIn(['stock', 'etf', 'crypto', 'index'])
  assetType?: 'stock' | 'etf' | 'crypto' | 'index';

  @IsOptional()
  @IsString()
  sector?: string;

  @IsOptional()
  @IsBoolean()
  isActive?: boolean;

  @IsOptional()
  @IsNumber()
  @Min(1)
  page?: number;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  limit?: number;

  @IsOptional()
  @IsString()
  @MaxLength(100)
  search?: string;
}
