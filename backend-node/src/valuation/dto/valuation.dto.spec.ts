import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import {
  ValuationRequestDto,
  ScreenerRequestDto,
} from './valuation.dto';

describe('ValuationRequestDto', () => {
  it('passes with valid ticker', async () => {
    const dto = plainToInstance(ValuationRequestDto, { ticker: 'AAPL' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid valuationType', async () => {
    const dto = plainToInstance(ValuationRequestDto, {
      ticker: 'AAPL',
      valuationType: 'compounder',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with auto valuationType', async () => {
    const dto = plainToInstance(ValuationRequestDto, {
      ticker: 'TSLA',
      valuationType: 'auto',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with cyclical valuationType', async () => {
    const dto = plainToInstance(ValuationRequestDto, {
      ticker: 'CAT',
      valuationType: 'cyclical',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with frontier valuationType', async () => {
    const dto = plainToInstance(ValuationRequestDto, {
      ticker: 'PLTR',
      valuationType: 'frontier',
    });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid valuationType', async () => {
    const dto = plainToInstance(ValuationRequestDto, {
      ticker: 'AAPL',
      valuationType: 'invalid',
    });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });
});

describe('ScreenerRequestDto', () => {
  it('passes with no fields (all optional)', async () => {
    const dto = plainToInstance(ScreenerRequestDto, {});
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid assetType stock', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { assetType: 'stock' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('passes with valid assetType etf', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { assetType: 'etf' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with invalid assetType', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { assetType: 'bond' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with valid minScore', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { minScore: 70 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with minScore greater than 100', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { minScore: 150 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with valid sortBy options', async () => {
    for (const sortBy of ['score', 'upside', 'marketCap']) {
      const dto = plainToInstance(ScreenerRequestDto, { sortBy });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('fails with invalid sortBy', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { sortBy: 'name' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with valid limit', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { limit: 50 });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });

  it('fails with limit greater than 100', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { limit: 200 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('fails with limit less than 1', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { limit: 0 });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with valid valuationType', async () => {
    for (const vt of ['cyclical', 'compounder', 'frontier']) {
      const dto = plainToInstance(ScreenerRequestDto, { valuationType: vt });
      const errors = await validate(dto);
      expect(errors).toHaveLength(0);
    }
  });

  it('fails with invalid valuationType', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { valuationType: 'magic' });
    const errors = await validate(dto);
    expect(errors.length).toBeGreaterThan(0);
  });

  it('passes with sector string', async () => {
    const dto = plainToInstance(ScreenerRequestDto, { sector: 'Technology' });
    const errors = await validate(dto);
    expect(errors).toHaveLength(0);
  });
});
