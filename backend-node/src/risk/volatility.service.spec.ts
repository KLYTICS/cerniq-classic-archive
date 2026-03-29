import { VolatilityService } from './volatility.service';

describe('VolatilityService', () => {
  let service: VolatilityService;
  const mockHistoricalData = Array.from({ length: 400 }, (_, i) => ({
    date: new Date(2024, 0, i + 1),
    close: 100 + Math.sin(i / 20) * 10 + i * 0.05,
    open: 99,
    high: 102,
    low: 98,
    volume: 1000000,
  }));

  const mockMarketDataService = {
    getHistoricalPrices: jest.fn().mockResolvedValue(mockHistoricalData),
  };

  beforeEach(() => {
    service = new VolatilityService(mockMarketDataService as any);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('getVolatilityCone returns cone data for multiple horizons', async () => {
    const result = await service.getVolatilityCone('AAPL');
    expect(result.ticker).toBe('AAPL');
    expect(result.coneData.length).toBeGreaterThan(0);
    const point = result.coneData[0];
    expect(point).toHaveProperty('daysToExpiry');
    expect(point).toHaveProperty('p10');
    expect(point).toHaveProperty('p50');
    expect(point).toHaveProperty('p90');
    expect(point).toHaveProperty('currentRV');
  });

  it('getVolatilityHeatmap returns IV matrix with strikes and maturities', async () => {
    const result = await service.getVolatilityHeatmap('AAPL');
    expect(result.ticker).toBe('AAPL');
    expect(result.strikes.length).toBe(11);
    expect(result.maturities).toEqual([7, 14, 30, 60, 90, 180]);
    expect(result.ivMatrix.length).toBe(6);
    expect(result.ivMatrix[0].length).toBe(11);
  });

  it('getVolatilityStats returns realized vol and HV rank', async () => {
    const result = await service.getVolatilityStats('AAPL', '30d');
    expect(result.ticker).toBe('AAPL');
    expect(result.period).toBe('30d');
    expect(typeof result.realized).toBe('number');
    expect(result.realized).toBeGreaterThan(0);
    expect(typeof result.hvRank).toBe('number');
  });

  it('getVolatilityCone throws on insufficient data', async () => {
    mockMarketDataService.getHistoricalPrices.mockResolvedValueOnce(
      Array.from({ length: 5 }, (_, i) => ({
        date: new Date(2025, 0, i + 1),
        close: 100,
      })),
    );
    await expect(service.getVolatilityCone('XYZ')).rejects.toThrow(
      'Insufficient historical data',
    );
  });
});
