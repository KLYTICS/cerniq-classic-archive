import {
  IsNumber,
  IsString,
  IsEnum,
  IsArray,
  ValidateNested,
  Min,
} from 'class-validator';
import { Type } from 'class-transformer';
import { OptionType } from './options.dto';

export enum BuySell {
  BUY = 'buy',
  SELL = 'sell',
}

export class StrategyLegDto {
  @IsNumber()
  @Min(0)
  strike: number;

  @IsString()
  expiration: string; // ISO date format

  @IsEnum(OptionType)
  optionType: OptionType;

  @IsNumber()
  @Min(1)
  quantity: number; // Number of contracts (typically in lots of 100 shares)

  @IsEnum(BuySell)
  buySell: BuySell;

  @IsNumber()
  @Min(0)
  premium?: number; // Optional: premium paid/received per contract
}

export class CalculateStrategyDto {
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => StrategyLegDto)
  legs: StrategyLegDto[];

  @IsNumber()
  @Min(0)
  underlyingPrice: number;

  @IsNumber()
  @Min(0)
  volatility: number; // Assumed IV for all legs

  @IsNumber()
  @Min(0)
  riskFreeRate: number;
}

export class PayoffPoint {
  underlyingPrice: number;
  profitLoss: number;
}

export class StrategyGreeksDto {
  delta: number;
  gamma: number;
  theta: number;
  vega: number;
  rho: number;
}

export class StrategyResponseDto {
  strategyName: string; // Auto-detected (e.g., "Bull Call Spread", "Iron Condor")

  // Payoff diagram data points
  payoff: PayoffPoint[];

  // Break-even prices
  breakEvens: number[];

  // Risk metrics
  maxProfit: number;
  maxLoss: number;

  // Greeks (aggregated across all legs)
  greeks: StrategyGreeksDto;

  // Cost to enter (total premium paid)
  initialCost: number;

  // Probability metrics
  probabilityOfProfit?: number; // Based on current IV

  // Individual leg details
  legs: StrategyLegDto[];
}

export class StrategyPresetDto {
  name: string;
  description: string;
  category: 'bullish' | 'bearish' | 'neutral' | 'volatility';
  legs: Omit<StrategyLegDto, 'expiration'>[];
}

// Common strategy presets
export const STRATEGY_PRESETS: StrategyPresetDto[] = [
  {
    name: 'Bull Call Spread',
    description: 'Buy lower strike call, sell higher strike call',
    category: 'bullish',
    legs: [
      {
        strike: 0,
        optionType: OptionType.CALL,
        quantity: 1,
        buySell: BuySell.BUY,
      },
      {
        strike: 0,
        optionType: OptionType.CALL,
        quantity: 1,
        buySell: BuySell.SELL,
      },
    ],
  },
  {
    name: 'Bear Put Spread',
    description: 'Buy higher strike put, sell lower strike put',
    category: 'bearish',
    legs: [
      {
        strike: 0,
        optionType: OptionType.PUT,
        quantity: 1,
        buySell: BuySell.BUY,
      },
      {
        strike: 0,
        optionType: OptionType.PUT,
        quantity: 1,
        buySell: BuySell.SELL,
      },
    ],
  },
  {
    name: 'Long Straddle',
    description: 'Buy ATM call and put (volatility play)',
    category: 'volatility',
    legs: [
      {
        strike: 0,
        optionType: OptionType.CALL,
        quantity: 1,
        buySell: BuySell.BUY,
      },
      {
        strike: 0,
        optionType: OptionType.PUT,
        quantity: 1,
        buySell: BuySell.BUY,
      },
    ],
  },
  {
    name: 'Iron Condor',
    description: 'Sell OTM call spread + sell OTM put spread',
    category: 'neutral',
    legs: [
      {
        strike: 0,
        optionType: OptionType.PUT,
        quantity: 1,
        buySell: BuySell.BUY,
      },
      {
        strike: 0,
        optionType: OptionType.PUT,
        quantity: 1,
        buySell: BuySell.SELL,
      },
      {
        strike: 0,
        optionType: OptionType.CALL,
        quantity: 1,
        buySell: BuySell.SELL,
      },
      {
        strike: 0,
        optionType: OptionType.CALL,
        quantity: 1,
        buySell: BuySell.BUY,
      },
    ],
  },
];
