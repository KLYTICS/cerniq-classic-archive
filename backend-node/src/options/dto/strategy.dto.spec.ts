import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  StrategyLegDto,
  CalculateStrategyDto,
  BuySell,
  STRATEGY_PRESETS,
} from './strategy.dto';
import { OptionType } from './options.dto';

describe('StrategyLegDto', () => {
  function makeValidLeg(): Record<string, any> {
    return {
      strike: 150,
      expiration: '2024-06-21',
      optionType: OptionType.CALL,
      quantity: 1,
      buySell: BuySell.BUY,
      premium: 5.0,
    };
  }

  it('passes validation with all required fields', async () => {
    const dto = plainToInstance(StrategyLegDto, makeValidLeg());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with premium set', async () => {
    const dto = plainToInstance(StrategyLegDto, {
      ...makeValidLeg(),
      premium: 5.5,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when strike is negative', async () => {
    const dto = plainToInstance(StrategyLegDto, {
      ...makeValidLeg(),
      strike: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when quantity is less than 1', async () => {
    const dto = plainToInstance(StrategyLegDto, {
      ...makeValidLeg(),
      quantity: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails with invalid buySell enum', async () => {
    const dto = plainToInstance(StrategyLegDto, {
      ...makeValidLeg(),
      buySell: 'hold',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts SELL buySell value', async () => {
    const dto = plainToInstance(StrategyLegDto, {
      ...makeValidLeg(),
      buySell: BuySell.SELL,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts PUT optionType', async () => {
    const dto = plainToInstance(StrategyLegDto, {
      ...makeValidLeg(),
      optionType: OptionType.PUT,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('CalculateStrategyDto', () => {
  function makeValidStrategy(): any {
    return {
      legs: [
        {
          strike: 150,
          expiration: '2024-06-21',
          optionType: OptionType.CALL,
          quantity: 1,
          buySell: BuySell.BUY,
          premium: 5.0,
        },
      ],
      underlyingPrice: 155,
      volatility: 0.25,
      riskFreeRate: 0.05,
    };
  }

  it('passes validation with valid strategy', async () => {
    const dto = plainToInstance(CalculateStrategyDto, makeValidStrategy());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when underlyingPrice is negative', async () => {
    const dto = plainToInstance(CalculateStrategyDto, {
      ...makeValidStrategy(),
      underlyingPrice: -10,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when volatility is negative', async () => {
    const dto = plainToInstance(CalculateStrategyDto, {
      ...makeValidStrategy(),
      volatility: -0.1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when riskFreeRate is negative', async () => {
    const dto = plainToInstance(CalculateStrategyDto, {
      ...makeValidStrategy(),
      riskFreeRate: -0.05,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('STRATEGY_PRESETS', () => {
  it('contains expected preset names', () => {
    const names = STRATEGY_PRESETS.map((p) => p.name);
    expect(names).toContain('Bull Call Spread');
    expect(names).toContain('Bear Put Spread');
    expect(names).toContain('Long Straddle');
    expect(names).toContain('Iron Condor');
  });

  it('all presets have valid categories', () => {
    for (const preset of STRATEGY_PRESETS) {
      expect(['bullish', 'bearish', 'neutral', 'volatility']).toContain(
        preset.category,
      );
    }
  });

  it('all presets have at least 2 legs', () => {
    for (const preset of STRATEGY_PRESETS) {
      expect(preset.legs.length).toBeGreaterThanOrEqual(2);
    }
  });

  it('Iron Condor has 4 legs', () => {
    const ironCondor = STRATEGY_PRESETS.find((p) => p.name === 'Iron Condor');
    expect(ironCondor).toBeDefined();
    expect(ironCondor!.legs).toHaveLength(4);
  });

  it('Long Straddle has both call and put legs', () => {
    const straddle = STRATEGY_PRESETS.find((p) => p.name === 'Long Straddle');
    expect(straddle).toBeDefined();
    const types = straddle!.legs.map((l) => l.optionType);
    expect(types).toContain(OptionType.CALL);
    expect(types).toContain(OptionType.PUT);
  });

  it('all presets have description', () => {
    for (const preset of STRATEGY_PRESETS) {
      expect(preset.description.length).toBeGreaterThan(0);
    }
  });
});
