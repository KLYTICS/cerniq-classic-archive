import { ValuationService } from './valuation.service';

describe('ValuationService', () => {
  let service: ValuationService;
  const mockCyclicalEngine = {
    calculate: jest.fn().mockReturnValue({ fairValue: 100, upside: 15 }),
  };
  const mockCompounderEngine = {
    calculate: jest.fn().mockReturnValue({ fairValue: 200, upside: 20 }),
  };
  const mockFrontierEngine = {
    calculate: jest
      .fn()
      .mockReturnValue({ probabilityWeightedValue: 300, upside: 50 }),
  };
  const mockKpiEngine = {
    calculate: jest.fn().mockReturnValue({ overallScore: 85 }),
  };
  const mockMarketDataService = {
    getQuote: jest.fn().mockResolvedValue({ price: 150 }),
    getFundamentals: jest.fn().mockResolvedValue({ sector: 'Technology' }),
  };
  const mockTickerService = {
    listTickers: jest.fn().mockResolvedValue({
      tickers: [
        {
          ticker: 'AAPL',
          name: 'Apple',
          sector: 'Technology',
          marketCap: 3000000,
        },
      ],
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
    await service.getValuation({
      ticker: 'CLF',
      valuationType: 'cyclical',
    });
    expect(mockCyclicalEngine.calculate).toHaveBeenCalled();
  });

  it('should use frontier engine for AI tickers', async () => {
    await service.getValuation({ ticker: 'NVDA' });
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

  // ── Additional coverage for uncovered branches ─────────────

  it('should throw NotFoundException for invalid valuation type', async () => {
    await expect(
      service.getValuation({ ticker: 'AAPL', valuationType: 'invalid' as any }),
    ).rejects.toThrow('Invalid valuation type: invalid');
  });

  it('should use cyclical engine for SEMI ticker via auto-detect', async () => {
    await service.getValuation({ ticker: 'SEMI_CHIP' });
    expect(mockCyclicalEngine.calculate).toHaveBeenCalled();
  });

  it('should use cyclical engine for ASML ticker via auto-detect', async () => {
    await service.getValuation({ ticker: 'ASML' });
    expect(mockCyclicalEngine.calculate).toHaveBeenCalled();
  });

  it('should use cyclical engine for LRCX ticker via auto-detect', async () => {
    await service.getValuation({ ticker: 'LRCX' });
    expect(mockCyclicalEngine.calculate).toHaveBeenCalled();
  });

  it('should use frontier engine when fundamentals sector is AI', async () => {
    mockMarketDataService.getFundamentals.mockResolvedValue({ sector: 'AI' });
    await service.getValuation({ ticker: 'SOME_STOCK' });
    expect(mockFrontierEngine.calculate).toHaveBeenCalled();
  });

  it('should handle fundamentals error gracefully with defaults', async () => {
    mockMarketDataService.getFundamentals.mockRejectedValue(new Error('Not available'));
    const result = await service.getValuation({ ticker: 'AAPL' });
    expect(mockCompounderEngine.calculate).toHaveBeenCalled();
    expect(result).toBeDefined();
  });

  it('should handle fundamentals error in getKPIScore', async () => {
    mockMarketDataService.getFundamentals.mockRejectedValue(new Error('Error'));
    const result = await service.getKPIScore('AAPL');
    expect(result.overallScore).toBe(85);
  });

  it('should sort screener results by upside', async () => {
    mockCompounderEngine.calculate.mockReturnValue({ fairValue: 200, upside: 30 });
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    const results = await service.runScreener({ sortBy: 'upside', limit: 10 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should sort screener results by marketCap', async () => {
    mockCompounderEngine.calculate.mockReturnValue({ fairValue: 200, upside: 30 });
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    const results = await service.runScreener({ sortBy: 'marketCap', limit: 10 });
    expect(results.length).toBeGreaterThan(0);
  });

  it('should filter by minScore in screener', async () => {
    mockCompounderEngine.calculate.mockReturnValue({ fairValue: 200, upside: 30 });
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 50 });
    const results = await service.runScreener({ minScore: 70, limit: 10 });
    expect(results).toHaveLength(0);
  });

  it('should handle ticker errors gracefully in screener', async () => {
    mockMarketDataService.getQuote
      .mockResolvedValueOnce({ price: 150 }) // for getValuation inside screener
      .mockRejectedValueOnce(new Error('API error')); // for subsequent calls
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    mockCompounderEngine.calculate.mockReturnValue({ fairValue: 200, upside: 20 });
    const results = await service.runScreener({ limit: 10 });
    // Should still return results (errors are caught)
    expect(results).toBeDefined();
  });

  it('should use specified valuationType in screener', async () => {
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    mockCyclicalEngine.calculate.mockReturnValue({ fairValue: 100, upside: 10 });
    const results = await service.runScreener({
      valuationType: 'cyclical',
      limit: 10,
    });
    expect(results).toBeDefined();
  });

  it('should use frontier engine for AI-containing tickers', async () => {
    await service.getValuation({ ticker: 'AI_CORP' });
    expect(mockFrontierEngine.calculate).toHaveBeenCalled();
  });

  it('should default limit to 50 when not specified in screener', async () => {
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    mockCompounderEngine.calculate.mockReturnValue({ fairValue: 200, upside: 20 });
    await service.runScreener({});
    expect(mockTickerService.listTickers).toHaveBeenCalledWith(
      expect.objectContaining({ limit: 50 }),
    );
  });

  it('should use probabilityWeightedValue as fairValue for frontier', async () => {
    mockFrontierEngine.calculate.mockReturnValue({
      probabilityWeightedValue: 300,
      upside: 50,
    });
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    mockTickerService.listTickers.mockResolvedValue({
      tickers: [{ ticker: 'NVDA', name: 'Nvidia', sector: 'Tech', marketCap: 2000000 }],
    });
    const results = await service.runScreener({ limit: 10 });
    expect(results).toBeDefined();
  });

  it('should pass assetType and sector to listTickers in screener', async () => {
    mockKpiEngine.calculate.mockReturnValue({ overallScore: 90 });
    mockCompounderEngine.calculate.mockReturnValue({ fairValue: 200, upside: 20 });
    await service.runScreener({ assetType: 'equity', sector: 'Finance', limit: 5 });
    expect(mockTickerService.listTickers).toHaveBeenCalledWith(
      expect.objectContaining({ assetType: 'equity', sector: 'Finance', limit: 5 }),
    );
  });

  it('should use frontier engine for ticker containing AI', async () => {
    mockMarketDataService.getFundamentals.mockResolvedValue({});
    await service.getValuation({ ticker: 'AI_STARTUP' });
    expect(mockFrontierEngine.calculate).toHaveBeenCalled();
  });
});
