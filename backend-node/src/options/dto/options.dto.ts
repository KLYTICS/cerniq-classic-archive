import {
  IsNumber,
  IsString,
  IsEnum,
  IsOptional,
  IsDateString,
  Min,
  Max,
} from 'class-validator';

export enum OptionType {
  CALL = 'call',
  PUT = 'put',
}

export enum ExerciseStyle {
  EUROPEAN = 'european',
  AMERICAN = 'american',
}

export class CalculateGreeksDto {
  @IsNumber()
  @Min(0)
  underlying: number;

  @IsNumber()
  @Min(0)
  strike: number;

  @IsNumber()
  @Min(0)
  @Max(1)
  timeToExpiry: number; // In years (e.g., 0.25 for 3 months)

  @IsNumber()
  @Min(0)
  @Max(1)
  riskFreeRate: number; // Decimal (e.g., 0.05 for 5%)

  @IsNumber()
  @Min(0)
  @Max(5)
  volatility: number; // Decimal (e.g., 0.25 for 25% IV)

  @IsEnum(OptionType)
  optionType: OptionType;

  @IsOptional()
  @IsEnum(ExerciseStyle)
  exercise?: ExerciseStyle; // Defaults to 'european' if omitted

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(1)
  dividendYield?: number; // Continuous dividend yield (e.g., 0.02 for 2%)
}

export class GreeksResponseDto {
  @IsNumber()
  delta: number;

  @IsNumber()
  gamma: number;

  @IsNumber()
  theta: number;

  @IsNumber()
  vega: number;

  @IsNumber()
  rho: number;

  @IsNumber()
  price: number;

  // Metadata
  underlying: number;
  strike: number;
  timeToExpiry: number;
  volatility: number;
  optionType: OptionType;
}

export class OptionChainRequestDto {
  @IsString()
  ticker: string;

  @IsOptional()
  @IsDateString()
  maturity?: string; // ISO date format (e.g., '2024-06-21')

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(100)
  strikeCount?: number; // Number of strikes to return (default: 20)
}

export class OptionQuoteDto {
  @IsNumber()
  strike: number;

  @IsString()
  expiration: string;

  @IsNumber()
  bid: number;

  @IsNumber()
  ask: number;

  @IsNumber()
  lastPrice: number;

  @IsNumber()
  @IsOptional()
  volume?: number;

  @IsNumber()
  @IsOptional()
  openInterest?: number;

  @IsNumber()
  impliedVolatility: number;

  // Greeks
  @IsNumber()
  delta: number;

  @IsNumber()
  gamma: number;

  @IsNumber()
  theta: number;

  @IsNumber()
  vega: number;

  @IsNumber()
  @IsOptional()
  rho?: number;
}

export class OptionsChainResponseDto {
  ticker: string;
  underlyingPrice: number;
  expiration: string;
  calls: OptionQuoteDto[];
  puts: OptionQuoteDto[];
  updatedAt: Date;
}

export class ImpliedVolatilityRequestDto {
  @IsString()
  ticker: string;

  @IsNumber()
  @Min(0)
  strike: number;

  @IsDateString()
  expiration: string;

  @IsEnum(OptionType)
  optionType: OptionType;

  @IsNumber()
  @Min(0)
  marketPrice: number; // Current market price of the option
}

export class ImpliedVolatilityResponseDto {
  @IsNumber()
  impliedVolatility: number;

  @IsNumber()
  iterations: number; // Number of iterations for Newton-Raphson convergence

  @IsNumber()
  error: number; // Final error in price matching
}
