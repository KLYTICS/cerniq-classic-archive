import { HttpStatus } from '@nestjs/common';
import { ValuationController } from './valuation.controller';

describe('ValuationController', () => {
  let controller: ValuationController;
  let valuationService: {
    getValuation: jest.Mock;
    getKPIScore: jest.Mock;
    runScreener: jest.Mock;
  };

  beforeEach(() => {
    valuationService = {
      getValuation: jest.fn(),
      getKPIScore: jest.fn(),
      runScreener: jest.fn(),
    };

    controller = new ValuationController(valuationService as any);
  });

  it('returns a valuation payload for calculate requests', async () => {
    const request = { ticker: 'AAPL', valuationType: 'compounder' };
    const response = { ticker: 'AAPL', fairValue: 210, upside: 0.12 };
    valuationService.getValuation.mockResolvedValue(response);

    await expect(controller.getValuation(request as any)).resolves.toEqual(
      response,
    );
    expect(valuationService.getValuation).toHaveBeenCalledWith(request);
  });

  it('wraps calculate failures with upstream status codes', async () => {
    valuationService.getValuation.mockRejectedValue({
      message: 'Market data unavailable',
      status: HttpStatus.BAD_GATEWAY,
    });

    await expect(
      controller.getValuation({ ticker: 'AAPL' } as any),
    ).rejects.toMatchObject({
      message: 'Market data unavailable',
      status: HttpStatus.BAD_GATEWAY,
    });
  });

  it('falls back to an internal server error for calculate failures without metadata', async () => {
    valuationService.getValuation.mockRejectedValue({});

    await expect(
      controller.getValuation({ ticker: 'AAPL' } as any),
    ).rejects.toMatchObject({
      message: 'Failed to calculate valuation',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('returns KPI scores for a ticker', async () => {
    const response = { ticker: 'MSFT', overallScore: 88, moat: 90 };
    valuationService.getKPIScore.mockResolvedValue(response);

    await expect(controller.getKPIScore('MSFT')).resolves.toEqual(response);
    expect(valuationService.getKPIScore).toHaveBeenCalledWith('MSFT');
  });

  it('wraps KPI failures with sensible defaults', async () => {
    valuationService.getKPIScore.mockRejectedValue({});

    await expect(controller.getKPIScore('MSFT')).rejects.toMatchObject({
      message: 'Failed to calculate KPI score',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('returns screener results for operator queries', async () => {
    const query = { sector: 'Technology', minScore: 75 };
    const response = [{ ticker: 'NVDA', score: 93 }];
    valuationService.runScreener.mockResolvedValue(response);

    await expect(controller.runScreener(query as any)).resolves.toEqual(
      response,
    );
    expect(valuationService.runScreener).toHaveBeenCalledWith(query);
  });

  it('wraps screener failures with an internal server error', async () => {
    valuationService.runScreener.mockRejectedValue({
      message: 'Failed to load screener universe',
    });

    await expect(controller.runScreener({} as any)).rejects.toMatchObject({
      message: 'Failed to load screener universe',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('requests cyclical valuations through the shared valuation service', async () => {
    const response = { ticker: 'TSLA', valuationType: 'cyclical' };
    valuationService.getValuation.mockResolvedValue(response);

    await expect(controller.getCyclicalValuation('TSLA')).resolves.toEqual(
      response,
    );
    expect(valuationService.getValuation).toHaveBeenCalledWith({
      ticker: 'TSLA',
      valuationType: 'cyclical',
    });
  });

  it('wraps cyclical valuation failures', async () => {
    valuationService.getValuation.mockRejectedValue({
      message: 'Failed to build cyclical model',
    });

    await expect(controller.getCyclicalValuation('TSLA')).rejects.toMatchObject(
      {
        message: 'Failed to build cyclical model',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    );
  });

  it('requests compounder valuations through the shared valuation service', async () => {
    const response = { ticker: 'COST', valuationType: 'compounder' };
    valuationService.getValuation.mockResolvedValue(response);

    await expect(controller.getCompounderValuation('COST')).resolves.toEqual(
      response,
    );
    expect(valuationService.getValuation).toHaveBeenCalledWith({
      ticker: 'COST',
      valuationType: 'compounder',
    });
  });

  it('wraps compounder valuation failures', async () => {
    valuationService.getValuation.mockRejectedValue({});

    await expect(
      controller.getCompounderValuation('COST'),
    ).rejects.toMatchObject({
      message: 'Failed to calculate compounder valuation',
      status: HttpStatus.INTERNAL_SERVER_ERROR,
    });
  });

  it('requests frontier valuations through the shared valuation service', async () => {
    const response = { ticker: 'MELI', valuationType: 'frontier' };
    valuationService.getValuation.mockResolvedValue(response);

    await expect(controller.getFrontierValuation('MELI')).resolves.toEqual(
      response,
    );
    expect(valuationService.getValuation).toHaveBeenCalledWith({
      ticker: 'MELI',
      valuationType: 'frontier',
    });
  });

  it('wraps frontier valuation failures', async () => {
    valuationService.getValuation.mockRejectedValue({
      message: 'Failed to calculate frontier model',
    });

    await expect(controller.getFrontierValuation('MELI')).rejects.toMatchObject(
      {
        message: 'Failed to calculate frontier model',
        status: HttpStatus.INTERNAL_SERVER_ERROR,
      },
    );
  });
});
