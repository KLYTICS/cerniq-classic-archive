import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  CalculateGreeksDto,
  OptionType,
  ExerciseStyle,
  OptionChainRequestDto,
  ImpliedVolatilityRequestDto,
} from './options.dto';

describe('CalculateGreeksDto', () => {
  function makeValid(): Partial<CalculateGreeksDto> {
    return {
      underlying: 150,
      strike: 155,
      timeToExpiry: 0.25,
      riskFreeRate: 0.05,
      volatility: 0.3,
      optionType: OptionType.CALL,
    };
  }

  it('passes validation with all required fields', async () => {
    const dto = plainToInstance(CalculateGreeksDto, makeValid());
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with optional exercise style', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      exercise: ExerciseStyle.AMERICAN,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with optional dividendYield', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      dividendYield: 0.02,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when underlying is negative', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      underlying: -10,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when strike is negative', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      strike: -5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when timeToExpiry exceeds 1', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      timeToExpiry: 2,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when riskFreeRate exceeds 1', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      riskFreeRate: 1.5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when volatility exceeds 5', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      volatility: 6,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails with invalid optionType', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      optionType: 'invalid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when dividendYield exceeds 1', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      dividendYield: 1.5,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('accepts PUT option type', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      optionType: OptionType.PUT,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('accepts EUROPEAN exercise style', async () => {
    const dto = plainToInstance(CalculateGreeksDto, {
      ...makeValid(),
      exercise: ExerciseStyle.EUROPEAN,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});

describe('OptionChainRequestDto', () => {
  it('passes with valid ticker', async () => {
    const dto = plainToInstance(OptionChainRequestDto, { ticker: 'AAPL' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with optional maturity and strikeCount', async () => {
    const dto = plainToInstance(OptionChainRequestDto, {
      ticker: 'TSLA',
      maturity: '2024-06-21',
      strikeCount: 30,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when strikeCount exceeds 100', async () => {
    const dto = plainToInstance(OptionChainRequestDto, {
      ticker: 'AAPL',
      strikeCount: 200,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when strikeCount is less than 1', async () => {
    const dto = plainToInstance(OptionChainRequestDto, {
      ticker: 'AAPL',
      strikeCount: 0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ImpliedVolatilityRequestDto', () => {
  it('passes with all required fields', async () => {
    const dto = plainToInstance(ImpliedVolatilityRequestDto, {
      ticker: 'AAPL',
      strike: 150,
      expiration: '2024-06-21',
      optionType: OptionType.CALL,
      marketPrice: 5.5,
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails when strike is negative', async () => {
    const dto = plainToInstance(ImpliedVolatilityRequestDto, {
      ticker: 'AAPL',
      strike: -10,
      expiration: '2024-06-21',
      optionType: OptionType.PUT,
      marketPrice: 3.0,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails when marketPrice is negative', async () => {
    const dto = plainToInstance(ImpliedVolatilityRequestDto, {
      ticker: 'AAPL',
      strike: 150,
      expiration: '2024-06-21',
      optionType: OptionType.CALL,
      marketPrice: -1,
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});
