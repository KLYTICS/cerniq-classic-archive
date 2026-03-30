import { NotFoundException } from '@nestjs/common';
import { ValuationService } from './valuation.service';

describe('ValuationService', () => {
  let service: ValuationService;
  let cyclicalEngine: { calculate: jest.Mock };
  let compounderEngine: { calculate: jest.Mock };
  let frontierEngine: { calculate: jest.Mock };
  let kpiEngine: { calculate: jest.Mock };
  let marketDataService: {
    getQuote: jest.Mock;
    getFundamentals: jest.Mock;
  };
  let tickerService: { listTickers: jest.Mock };

  beforeEach(() => {
    cyclicalEngine = {
      calculate: jest.fn().mockResolvedValue({ fairValue: 100, upside: 15 }),
    };
    compounderEngine = {
      calculate: jest.fn().mockResolvedValue({ fairValue: 200, upside: 20 }),
    };
    frontierEngine = {
      calculate: jest
        .fn()
        .mockResolvedValue({ probabilityWeightedValue: 300, upside: 50 }),
    };
    kpiEngine = {
      calculate: jest.fn().mockResolvedValue({ overallScore: 85 }),
    };
    marketDataService = {
      getQuote: jest.fn().mockResolvedValue({ price: 150 }),
      getFundamentals: jest.fn().mockResolvedValue({ sector: 'Technology' }),
    };
    tickerService = {
      listTickers: jest.fn().mockResolvedValue({
        tickers: [
          {
            ticker: 'AAPL',
            name: 'Apple',
            sector: 'Technology',
            marketCap: 3_000_000,
          },
          {
            ticker: 'NVDA',
            name: 'NVIDIA',
            sector: 'Technology',
            marketCap: 2_500_000,
          },
        ],
      }),
    };

    service = new ValuationService(
      cyclicalEngine as any,
      compounderEngine as any,
      frontierEngine as any,
      kpiEngine as any,
      marketDataService as any,
      tickerService as any,
    );
    jest.clearAllMocks();
  });

  it('defaults to compounder valuation for quality businesses', async () => {
    await expect(service.getValuation({ ticker: 'AAPL' })).resolves.toEqual({
      fairValue: 200,
      upside: 20,
    });
    expect(compounderEngine.calculate).toHaveBeenCalledWith(
      'AAPL',
      150,
      expect.objectContaining({ sector: 'Technology' }),
    );
  });

  it('routes semiconductor-equipment tickers to cyclical valuation in auto mode', async () => {
    await service.getValuation({ ticker: 'ASML' });

    expect(cyclicalEngine.calculate).toHaveBeenCalledWith(
      'ASML',
      150,
      expect.any(Object),
    );
  });

  it('routes AI tickers to frontier valuation in auto mode', async () => {
    await service.getValuation({ ticker: 'NVDA' });

    expect(frontierEngine.calculate).toHaveBeenCalledWith(
      'NVDA',
      150,
      expect.objectContaining({ sector: 'Technology' }),
    );
  });

  it('routes AI sector fundamentals to frontier valuation in auto mode', async () => {
    marketDataService.getFundamentals.mockResolvedValueOnce({ sector: 'AI' });

    await service.getValuation({ ticker: 'XYZ' });

    expect(frontierEngine.calculate).toHaveBeenCalled();
  });

  it('respects explicitly requested valuation types', async () => {
    await service.getValuation({ ticker: 'CLF', valuationType: 'cyclical' });
    await service.getValuation({ ticker: 'COST', valuationType: 'compounder' });
    await service.getValuation({ ticker: 'AI', valuationType: 'frontier' });

    expect(cyclicalEngine.calculate).toHaveBeenCalled();
    expect(compounderEngine.calculate).toHaveBeenCalled();
    expect(frontierEngine.calculate).toHaveBeenCalled();
  });

  it('falls back to empty fundamentals and logs a warning when fundamentals are unavailable', async () => {
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    marketDataService.getFundamentals.mockRejectedValueOnce(
      new Error('fundamentals offline'),
    );

    await service.getValuation({ ticker: 'AAPL', valuationType: 'compounder' });

    expect(warnSpy).toHaveBeenCalledWith(
      'Fundamentals not available for AAPL, using defaults',
    );
    expect(compounderEngine.calculate).toHaveBeenCalledWith('AAPL', 150, {});
  });

  it('throws for invalid valuation types', async () => {
    await expect(
      service.getValuation({
        ticker: 'AAPL',
        valuationType: 'broken' as any,
      }),
    ).rejects.toThrow(new NotFoundException('Invalid valuation type: broken'));
  });

  it('gets KPI scores with quote data and fundamentals', async () => {
    kpiEngine.calculate.mockResolvedValueOnce({ overallScore: 91 });

    await expect(service.getKPIScore('AAPL')).resolves.toEqual({
      overallScore: 91,
    });
    expect(kpiEngine.calculate).toHaveBeenCalledWith(
      'AAPL',
      expect.objectContaining({ sector: 'Technology' }),
      { price: 150 },
    );
  });

  it('gets KPI scores even when fundamentals are unavailable', async () => {
    marketDataService.getFundamentals.mockRejectedValueOnce(new Error('nope'));

    await service.getKPIScore('AAPL');

    expect(kpiEngine.calculate).toHaveBeenCalledWith('AAPL', {}, { price: 150 });
  });

  it('runs the screener, filters by minimum score, and passes query filters to the ticker service', async () => {
    tickerService.listTickers.mockResolvedValueOnce({
      tickers: [
        { ticker: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 100 },
        { ticker: 'NVDA', name: 'NVIDIA', sector: 'Technology', marketCap: 200 },
      ],
    });
    marketDataService.getQuote
      .mockResolvedValueOnce({ price: 100 })
      .mockResolvedValueOnce({ price: 200 });
    jest
      .spyOn(service, 'getKPIScore')
      .mockResolvedValueOnce({ overallScore: 65 } as any)
      .mockResolvedValueOnce({ overallScore: 95 } as any);
    jest
      .spyOn(service, 'getValuation')
      .mockResolvedValueOnce({ fairValue: 120, upside: 20 })
      .mockResolvedValueOnce({ fairValue: 300, upside: 50 });

    const results = await service.runScreener({
      assetType: 'stock',
      sector: 'Technology',
      minScore: 80,
      limit: 10,
    });

    expect(tickerService.listTickers).toHaveBeenCalledWith({
      assetType: 'stock',
      sector: 'Technology',
      isActive: true,
      limit: 10,
      page: 1,
    });
    expect(results).toEqual([
      expect.objectContaining({
        ticker: 'NVDA',
        score: 95,
      }),
    ]);
  });

  it('sorts screener results by upside when requested', async () => {
    tickerService.listTickers.mockResolvedValueOnce({
      tickers: [
        { ticker: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 10 },
        { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', marketCap: 30 },
      ],
    });
    marketDataService.getQuote
      .mockResolvedValueOnce({ price: 100 })
      .mockResolvedValueOnce({ price: 100 });
    jest
      .spyOn(service, 'getKPIScore')
      .mockResolvedValue({ overallScore: 90 } as any);
    jest
      .spyOn(service, 'getValuation')
      .mockResolvedValueOnce({ fairValue: 110, upside: 10 })
      .mockResolvedValueOnce({ fairValue: 160, upside: 60 });

    const results = await service.runScreener({
      sortBy: 'upside',
      valuationType: 'compounder',
    });

    expect(results.map((result) => result.ticker)).toEqual(['MSFT', 'AAPL']);
  });

  it('sorts screener results by market cap when requested', async () => {
    tickerService.listTickers.mockResolvedValueOnce({
      tickers: [
        { ticker: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 10 },
        { ticker: 'MSFT', name: 'Microsoft', sector: 'Technology', marketCap: 30 },
      ],
    });
    marketDataService.getQuote
      .mockResolvedValueOnce({ price: 100 })
      .mockResolvedValueOnce({ price: 100 });
    jest
      .spyOn(service, 'getKPIScore')
      .mockResolvedValue({ overallScore: 90 } as any);
    jest
      .spyOn(service, 'getValuation')
      .mockResolvedValue({ fairValue: 110, upside: 10 } as any);

    const results = await service.runScreener({
      sortBy: 'marketCap',
      valuationType: 'compounder',
    });

    expect(results.map((result) => result.ticker)).toEqual(['MSFT', 'AAPL']);
  });

  it('keeps only the first twenty tickers in the screener loop', async () => {
    tickerService.listTickers.mockResolvedValueOnce({
      tickers: Array.from({ length: 25 }, (_, index) => ({
        ticker: `TK${index}`,
        name: `Ticker ${index}`,
        sector: 'Technology',
        marketCap: index,
      })),
    });
    marketDataService.getQuote.mockResolvedValue({ price: 100 });
    jest
      .spyOn(service, 'getKPIScore')
      .mockResolvedValue({ overallScore: 90 } as any);
    jest
      .spyOn(service, 'getValuation')
      .mockResolvedValue({ fairValue: 120, upside: 20 } as any);

    await service.runScreener({});

    expect(marketDataService.getQuote).toHaveBeenCalledTimes(20);
  });

  it('logs and skips tickers that fail valuation during screening', async () => {
    const warnSpy = jest
      .spyOn((service as any).logger, 'warn')
      .mockImplementation(() => undefined);
    tickerService.listTickers.mockResolvedValueOnce({
      tickers: [
        { ticker: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 10 },
      ],
    });
    marketDataService.getQuote.mockResolvedValueOnce({ price: 100 });
    jest
      .spyOn(service, 'getKPIScore')
      .mockRejectedValueOnce(new Error('calc failed'));

    await expect(service.runScreener({})).resolves.toEqual([]);
    expect(warnSpy).toHaveBeenCalledWith('Failed to value AAPL: calc failed');
  });
});
