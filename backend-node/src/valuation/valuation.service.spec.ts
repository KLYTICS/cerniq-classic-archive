import { NotFoundException } from '@nestjs/common';
import { ValuationService } from './valuation.service';

describe('ValuationService', () => {
  let service: ValuationService;
  const mockCyclicalEngine = { calculate: jest.fn().mockReturnValue({ fairValue: 100, upside: 15 }) };
  const mockCompounderEngine = { calculate: jest.fn().mockReturnValue({ fairValue: 200, upside: 20 }) };
  const mockFrontierEngine = { calculate: jest.fn().mockReturnValue({ probabilityWeightedValue: 300, upside: 50 }) };
  const mockKpiEngine = { calculate: jest.fn().mockReturnValue({ overallScore: 85 }) };
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({ price: 150 }),
    getFundamentals: jest.fn().mockResolvedValue({ sector: 'Technology' }),
  };
  const mockTickerService = {
    listTickers: jest.fn().mockResolvedValue({
      tickers: [{ ticker: 'AAPL', name: 'Apple', sector: 'Technology', marketCap: 3000000 }],
    }),
  };

  beforeEach(() => {
    service = new ValuationService(
      mockCyclicalEngine as any,
      mockCompounderEngine as any,
      mockFrontierEngine as any,
      mockKpiEngine as any,
      mockMarketDataService as any,
      mockTickerService as any,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should auto-detect compounder valuation type by default', async () => {
    const result = await service.getValuation({ ticker: 'AAPL' });
    expect(mockCompounderEngine.calculate).toHaveBeenCalled();
    expect(result.fairValue).toBe(200);
  });

  it('should use cyclical engine when explicitly requested', async () => {
    const result = await service.getValuation({ ticker: 'CLF', valuationType: 'cyclical' });
    expect(mockCyclicalEngine.calculate).toHaveBeenCalled();
  });

  it('should use frontier engine for AI tickers', async () => {
    const result = await service.getValuation({ ticker: 'NVDA' });
    expect(mockFrontierEngine.calculate).toHaveBeenCalled();
  });

  it('should get KPI score for a ticker', async () => {
    const result = await service.getKPIScore('AAPL');
    expect(result.overallScore).toBe(85);
    expect(mockKpiEngine.calculate).toHaveBeenCalled();
  });

  it('should run screener and return sorted results', async () => {
    const results = await service.runScreener({ limit: 10 });
    expect(results.length).toBeGreaterThan(0);
    expect(results[0]).toHaveProperty('ticker');
    expect(results[0]).toHaveProperty('score');
  });
});
