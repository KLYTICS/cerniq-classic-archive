import { TechnicalIndicatorsService } from './technical-indicators.service';

describe('TechnicalIndicatorsService', () => {
  let service: TechnicalIndicatorsService;
  const prices = [
    44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
    46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41, 46.22, 45.64, 46.21, 46.25,
    45.71, 46.45, 45.78, 45.35, 44.03, 44.18, 44.22, 44.57,
  ];

  beforeEach(() => {
    service = new TechnicalIndicatorsService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('calculateSMA returns correct moving average', () => {
    const sma = service.calculateSMA(prices, 5);
    expect(sma).toHaveLength(prices.length);
    // First 4 values should be null (padding)
    expect(sma[0]).toBeNull();
    expect(sma[3]).toBeNull();
    // 5th value should be the avg of first 5 prices
    const expected = (44 + 44.34 + 44.09 + 43.61 + 44.33) / 5;
    expect(sma[4]).toBeCloseTo(expected, 2);
  });

  it('calculateSMA returns warning on insufficient data', () => {
    const sma = service.calculateSMA([1, 2], 5);
    expect(sma).toHaveLength(0);
    expect((sma as any).warning).toBeDefined();
  });

  it('calculateEMA returns exponential moving average', () => {
    const ema = service.calculateEMA(prices, 10);
    expect(ema).toHaveLength(prices.length);
    // First 9 values should be null
    expect(ema[8]).toBeNull();
    // 10th value should be the SMA of first 10 prices
    expect(ema[9]).not.toBeNull();
    expect(typeof ema[9]).toBe('number');
  });

  it('calculateRSI returns values between 0 and 100', () => {
    const rsi = service.calculateRSI(prices, 14);
    const validValues = rsi.filter((v) => v !== null);
    expect(validValues.length).toBeGreaterThan(0);
    for (const v of validValues) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(100);
    }
  });

  it('calculateVWAP accumulates volume-weighted price', () => {
    const p = [100, 102, 101, 103, 104];
    const v = [1000, 2000, 1500, 3000, 2500];
    const vwap = service.calculateVWAP(p, v);
    expect(vwap).toHaveLength(5);
    // First VWAP = price[0] (only one data point)
    expect(vwap[0]).toBe(100);
    // VWAP should be a weighted average, between min and max price
    for (const val of vwap) {
      expect(val).toBeGreaterThanOrEqual(100);
      expect(val).toBeLessThanOrEqual(104);
    }
  });
});
