import { AdvancedRiskService } from './advanced-risk.service';

describe('AdvancedRiskService', () => {
  let service: AdvancedRiskService;
  const mockMarketDataService = {
    getHistoricalPrices: jest.fn().mockResolvedValue(
      Array.from({ length: 253 }, (_, i) => ({
        date: new Date(2025, 0, i + 1),
        close: 100 + Math.sin(i / 10) * 5,
      })),
    ),
  };
  const mockCacheService = {
    getOrSet: jest.fn().mockImplementation((_key, fn) => fn()),
  };

  beforeEach(() => {
    service = new AdvancedRiskService(
      mockMarketDataService as any,
      mockCacheService as any,
    );
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculateComponentVaR returns portfolio VaR and components', async () => {
    const dto = {
      positions: [
        { ticker: 'AAPL', quantity: 100, price: 150 },
        { ticker: 'GOOGL', quantity: 50, price: 200 },
      ],
      confidenceLevel: 0.95,
      horizon: 10,
    };
    const result = await service.calculateComponentVaR(dto);
    expect(result.portfolioValue).toBe(25000);
    expect(result.confidenceLevel).toBe(0.95);
    expect(result.horizon).toBe(10);
    expect(result.components).toHaveLength(2);
    expect(result.components[0].ticker).toBe('AAPL');
    expect(typeof result.portfolioVaR).toBe('number');
  });

  it('forecastVolatility returns GARCH forecast', async () => {
    const result = await service.forecastVolatility({
      ticker: 'AAPL',
      horizon: 5,
    });
    expect(result.ticker).toBe('AAPL');
    expect(result.model).toBe('GARCH(1,1)');
    expect(result.forecast).toHaveLength(5);
    expect(result.forecast[0]).toHaveProperty('day');
    expect(result.forecast[0]).toHaveProperty('volatility');
    expect(result.forecast[0]).toHaveProperty('lower95');
    expect(result.forecast[0]).toHaveProperty('upper95');
  });

  it('calculateParametricVaR returns VaR with portfolio volatility', async () => {
    const dto = {
      positions: [{ ticker: 'AAPL', quantity: 100, price: 150 }],
      confidenceLevel: 0.99,
      horizon: 1,
    };
    const result = await service.calculateParametricVaR(dto);
    expect(result.portfolioValue).toBe(15000);
    expect(result.confidenceLevel).toBe(0.99);
    expect(result.method).toBe('Parametric (Normal)');
    expect(typeof result.portfolioVolatility).toBe('number');
  });

  it('forecastVolatility throws on insufficient data', async () => {
    mockMarketDataService.getHistoricalPrices.mockResolvedValueOnce(
      Array.from({ length: 10 }, (_, i) => ({
        date: new Date(2025, 0, i + 1),
        close: 100,
      })),
    );
    await expect(
      service.forecastVolatility({ ticker: 'XYZ', horizon: 30 }),
    ).rejects.toThrow();
  });
});
