import {
  IsNumber,
  IsString,
  IsArray,
  IsOptional,
  Min,
  Max,
  ArrayMinSize,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

class PositionItemDto {
  @IsString()
  ticker: string;

  @IsNumber()
  @Min(0)
  quantity: number;

  @IsNumber()
  @Min(0)
  price: number;
}

export class ComponentVaRRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PositionItemDto)
  positions: PositionItemDto[];

  @IsNumber()
  @Min(0.5)
  @Max(0.999)
  confidenceLevel: number;

  @IsNumber()
  @Min(1)
  @Max(365)
  horizon: number;
}

export class ComponentVaRResponseDto {
  portfolioVaR: number;
  portfolioValue: number;
  confidenceLevel: number;
  horizon: number;
  components: {
    ticker: string;
    position: number;
    marginalVaR: number;
    componentVaR: number;
    riskContribution: number;
  }[];
  timestamp: Date;
}

export class VolatilityForecastRequestDto {
  @IsString()
  ticker: string;

  @IsOptional()
  @IsNumber()
  @Min(1)
  @Max(365)
  horizon?: number;
}

export class VolatilityForecastResponseDto {
  ticker: string;
  currentVolatility: number;
  forecast: {
    day: number;
    volatility: number;
    lower95: number;
    upper95: number;
  }[];
  model: string;
  timestamp: Date;
}

export class ParametricVaRRequestDto {
  @IsArray()
  @ArrayMinSize(1)
  @ValidateNested({ each: true })
  @Type(() => PositionItemDto)
  positions: PositionItemDto[];

  @IsNumber()
  @Min(0.5)
  @Max(0.999)
  confidenceLevel: number;

  @IsNumber()
  @Min(1)
  @Max(365)
  horizon: number;
}

export class ParametricVaRResponseDto {
  portfolioVaR: number;
  portfolioValue: number;
  portfolioVolatility: number;
  confidenceLevel: number;
  horizon: number;
  method: string;
  timestamp: Date;
}
