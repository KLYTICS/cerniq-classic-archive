import {
  IsNumber,
  IsArray,
  IsString,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
} from 'class-validator';

export class MonteCarloRequestDto {
  @IsNumber()
  @Min(0)
  initialValue: number;

  @IsNumber()
  meanDailyReturn: number;

  @IsNumber()
  @Min(0)
  dailyVolatility: number;

  @IsNumber()
  @Min(1)
  @Max(100000)
  numSimulations: number;

  @IsNumber()
  @Min(1)
  @Max(3650)
  timeHorizon: number; // days

  @IsNumber()
  @Min(0.5)
  @Max(0.999)
  confidenceLevel: number; // e.g., 0.95 for 95%
}

export class MonteCarloResultDto {
  finalValues: number[];
  var: number;
  cvar: number;
  worstCase: number;
  bestCase: number;
  median: number;
  mean: number;
  percentile95: number;
  percentile5: number;
}

export class VaRRequestDto {
  @IsNumber()
  @Min(0)
  portfolioValue: number;

  @IsArray()
  @ArrayMinSize(1)
  @IsNumber({}, { each: true })
  returns: number[]; // Historical returns

  @IsNumber()
  @Min(0.5)
  @Max(0.999)
  confidenceLevel: number; // e.g., 0.95
}

export class VaRResultDto {
  var: number;
  cvar: number;
  confidenceLevel: number;
  timeHorizon: string;
}

export class CorrelationMatrixRequestDto {
  @IsArray()
  @ArrayMinSize(2)
  @IsString({ each: true })
  tickers: string[];

  @IsOptional()
  @IsString()
  startDate?: string;

  @IsOptional()
  @IsString()
  endDate?: string;
}

export class CorrelationMatrixDto {
  tickers: string[];
  matrix: number[][];
  computedAt: Date;
}

export class PortfolioRiskDto {
  portfolioId: string;
  totalValue: number;
  var95: number;
  cvar95: number;
  volatility: number;
  sharpeRatio: number;
  beta: number;
  maxDrawdown: number;
  diversificationRatio: number;
}

export class StressTestScenarioDto {
  @IsString()
  name: string;

  @IsString()
  description: string;

  @IsNumber()
  marketShock: number; // e.g., -0.20 for 20% drop

  @IsOptional()
  sectorShocks?: Record<string, number>;
}

export class StressTestResultDto {
  scenario: string;
  portfolioValue: number;
  portfolioLoss: number;
  portfolioLossPercent: number;
  worstPosition: { ticker: string; loss: number };
  recoveryTime?: number;
}
