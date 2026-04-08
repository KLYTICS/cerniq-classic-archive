import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { ChartDataRequestDto } from './chart.dto';

describe('ChartDataRequestDto', () => {
  it('passes validation with required ticker', async () => {
    const dto = plainToInstance(ChartDataRequestDto, { ticker: 'AAPL' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid timeframe 1D', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'TSLA',
      timeframe: '1D',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid timeframe 1W', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'TSLA',
      timeframe: '1W',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid timeframe 1M', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'TSLA',
      timeframe: '1M',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid timeframe 3M', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'TSLA',
      timeframe: '3M',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid timeframe 1Y', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'TSLA',
      timeframe: '1Y',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid timeframe ALL', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'TSLA',
      timeframe: 'ALL',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid timeframe', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'AAPL',
      timeframe: '5Y',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with indicators array', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'AAPL',
      indicators: ['sma20', 'rsi'],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with empty indicators array', async () => {
    const dto = plainToInstance(ChartDataRequestDto, {
      ticker: 'AAPL',
      indicators: [],
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
