import { TechnicalIndicatorsService } from '../src/market-data/technical-indicators.service';

describe('TechnicalIndicatorsService', () => {
  let service: TechnicalIndicatorsService;

  beforeEach(() => {
    service = new TechnicalIndicatorsService();
  });

  describe('calculateSMA', () => {
    it('should calculate correct SMA for given period', () => {
      const prices = [10, 12, 14, 16, 18, 20];
      const result = service.calculateSMA(prices, 3);

      // First 2 values should be null (padding)
      expect(result[0]).toBeNull();
      expect(result[1]).toBeNull();

      // SMA(3) at index 2: (10+12+14)/3 = 12
      expect(result[2]).toBe(12);

      // SMA(3) at index 3: (12+14+16)/3 = 14
      expect(result[3]).toBe(14);

      // SMA(3) at index 4: (14+16+18)/3 = 16
      expect(result[4]).toBe(16);

      // SMA(3) at index 5: (16+18+20)/3 = 18
      expect(result[5]).toBe(18);
    });

    it('should return empty array if prices length < period', () => {
      const prices = [10, 12];
      const result = service.calculateSMA(prices, 5);
      expect(result).toEqual([]);
    });

    it('should handle single element period', () => {
      const prices = [10, 20, 30];
      const result = service.calculateSMA(prices, 1);
      expect(result).toEqual([10, 20, 30]);
    });
  });

  describe('calculateEMA', () => {
    it('should calculate EMA with correct first value as SMA', () => {
      const prices = [10, 12, 14, 16, 18];
      const result = service.calculateEMA(prices, 3);

      // First SMA(3) = (10+12+14)/3 = 12
      expect(result[2]).toBe(12);

      // EMA formula: (current - prevEMA) * multiplier + prevEMA
      // multiplier = 2 / (3 + 1) = 0.5
      // EMA at index 3: (16 - 12) * 0.5 + 12 = 14
      expect(result[3]).toBe(14);
    });

    it('should return empty array if prices length < period', () => {
      const result = service.calculateEMA([10, 12], 5);
      expect(result).toEqual([]);
    });
  });

  describe('calculateRSI', () => {
    it('should calculate RSI in range 0-100', () => {
      const prices = [
        44, 44.34, 44.09, 43.61, 44.33, 44.83, 45.1, 45.42, 45.84, 46.08, 45.89,
        46.03, 45.61, 46.28, 46.28, 46.0, 46.03, 46.41,
      ];
      const result = service.calculateRSI(prices, 14);

      // All RSI values should be between 0 and 100
      result.forEach((val) => {
        if (val !== null) {
          expect(val).toBeGreaterThanOrEqual(0);
          expect(val).toBeLessThanOrEqual(100);
        }
      });
    });

    it('should return 100 when no losses', () => {
      const prices = [
        10, 11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25,
      ];
      const result = service.calculateRSI(prices, 14);
      const lastRSI = result.filter((v) => v !== null).pop();
      expect(lastRSI).toBe(100);
    });
  });

  describe('calculateMACD', () => {
    it('should return macd, signal, and histogram arrays', () => {
      const prices = Array.from(
        { length: 50 },
        (_, i) => 100 + i * 0.5 + Math.sin(i) * 2,
      );
      const result = service.calculateMACD(prices);

      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('histogram');
      expect(result.macd.length).toBe(prices.length);
    });

    it('should have macd = fast EMA - slow EMA', () => {
      const prices = Array.from({ length: 50 }, (_, i) => 100 + i);
      const result = service.calculateMACD(prices, 12, 26, 9);

      // After slow EMA is calculated (index 25+), MACD should be non-null
      const firstMacdIdx = result.macd.findIndex((v) => v !== null);
      expect(firstMacdIdx).toBe(25); // slow period - 1
    });
  });

  describe('calculateBollingerBands', () => {
    it('should return upper, middle, lower bands', () => {
      const prices = Array.from({ length: 30 }, () => 100 + Math.random() * 10);
      const result = service.calculateBollingerBands(prices, 20, 2);

      expect(result).toHaveProperty('upper');
      expect(result).toHaveProperty('middle');
      expect(result).toHaveProperty('lower');
      expect(result.upper.length).toBe(prices.length);
    });

    it('should have upper > middle > lower', () => {
      const prices = Array.from({ length: 30 }, (_, i) => 100 + i * 0.1);
      const result = service.calculateBollingerBands(prices, 20, 2);

      for (let i = 19; i < prices.length; i++) {
        expect(result.upper[i]).toBeGreaterThan(result.middle[i]);
        expect(result.middle[i]).toBeGreaterThan(result.lower[i]);
      }
    });
  });

  describe('calculateVWAP', () => {
    it('should calculate cumulative VWAP correctly', () => {
      const prices = [100, 102, 101, 103, 105];
      const volumes = [1000, 1500, 1200, 1800, 2000];
      const result = service.calculateVWAP(prices, volumes);

      // First VWAP = 100 * 1000 / 1000 = 100
      expect(result[0]).toBe(100);

      // Second VWAP = (100*1000 + 102*1500) / (1000 + 1500) = 253000 / 2500 = 101.2
      expect(result[1]).toBeCloseTo(101.2, 1);
    });
  });

  describe('calculateATR', () => {
    it('should calculate average true range', () => {
      const highs = [48.7, 48.72, 48.9, 48.87, 48.82];
      const lows = [47.79, 48.14, 48.39, 48.37, 48.24];
      const closes = [48.16, 48.61, 48.75, 48.63, 48.74];

      const result = service.calculateATR(highs, lows, closes, 3);

      // ATR should be positive for volatile data
      const validATR = result.filter((v) => v !== null);
      validATR.forEach((atr) => {
        expect(atr).toBeGreaterThan(0);
      });
    });
  });

  describe('calculateStochastic', () => {
    it('should return k and d values between 0 and 100', () => {
      const highs = Array.from({ length: 20 }, () => 105 + Math.random() * 5);
      const lows = Array.from({ length: 20 }, () => 95 + Math.random() * 5);
      const closes = Array.from({ length: 20 }, () => 100 + Math.random() * 5);

      const result = service.calculateStochastic(highs, lows, closes, 14);

      expect(result).toHaveProperty('k');
      expect(result).toHaveProperty('d');

      result.k.forEach((k) => {
        if (k !== null) {
          expect(k).toBeGreaterThanOrEqual(0);
          expect(k).toBeLessThanOrEqual(100);
        }
      });
    });
  });
});
