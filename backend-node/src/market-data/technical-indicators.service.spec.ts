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

  // ── SMA ────────────────────────────────────────────────────────────

  describe('calculateSMA', () => {
    it('returns correct moving average', () => {
      const sma = service.calculateSMA(prices, 5);
      expect(sma).toHaveLength(prices.length);
      // First 4 values should be null (padding)
      expect(sma[0]).toBeNull();
      expect(sma[3]).toBeNull();
      // 5th value should be the avg of first 5 prices
      const expected = (44 + 44.34 + 44.09 + 43.61 + 44.33) / 5;
      expect(sma[4]).toBeCloseTo(expected, 2);
    });

    it('returns warning on insufficient data', () => {
      const sma = service.calculateSMA([1, 2], 5);
      expect(sma).toHaveLength(0);
      expect((sma as any).warning).toBeDefined();
      expect((sma as any).warning).toContain('Insufficient data');
    });

    it('handles period of 1', () => {
      const sma = service.calculateSMA([10, 20, 30], 1);
      expect(sma).toEqual([10, 20, 30]);
    });

    it('handles period equal to data length', () => {
      const data = [10, 20, 30];
      const sma = service.calculateSMA(data, 3);
      expect(sma).toHaveLength(3);
      expect(sma[0]).toBeNull();
      expect(sma[1]).toBeNull();
      expect(sma[2]).toBeCloseTo(20, 2);
    });

    it('returns correct values for known data', () => {
      const data = [2, 4, 6, 8, 10];
      const sma = service.calculateSMA(data, 3);
      // Padding: [null, null, 4, 6, 8]
      expect(sma[2]).toBeCloseTo(4, 2);
      expect(sma[3]).toBeCloseTo(6, 2);
      expect(sma[4]).toBeCloseTo(8, 2);
    });
  });

  // ── EMA ────────────────────────────────────────────────────────────

  describe('calculateEMA', () => {
    it('returns exponential moving average', () => {
      const ema = service.calculateEMA(prices, 10);
      expect(ema).toHaveLength(prices.length);
      // First 9 values should be null
      expect(ema[8]).toBeNull();
      // 10th value should be the SMA of first 10 prices
      expect(ema[9]).not.toBeNull();
      expect(typeof ema[9]).toBe('number');
    });

    it('returns warning on insufficient data', () => {
      const ema = service.calculateEMA([1, 2, 3], 10);
      expect(ema).toHaveLength(0);
      expect((ema as any).warning).toBeDefined();
    });

    it('first EMA value equals SMA', () => {
      const data = [2, 4, 6, 8, 10];
      const ema = service.calculateEMA(data, 3);
      // First valid EMA value (at index 2) should equal SMA of first 3
      const sma3 = (2 + 4 + 6) / 3;
      expect(ema[2]).toBeCloseTo(sma3, 2);
    });

    it('subsequent EMA values use smoothing factor', () => {
      const data = [2, 4, 6, 8, 10];
      const ema = service.calculateEMA(data, 3);
      const multiplier = 2 / (3 + 1);
      const sma3 = (2 + 4 + 6) / 3;
      const expectedEma3 = (8 - sma3) * multiplier + sma3;
      expect(ema[3]).toBeCloseTo(expectedEma3, 6);
    });

    it('EMA reacts faster to recent price changes', () => {
      const data = [10, 10, 10, 10, 10, 20]; // Sharp jump
      const sma = service.calculateSMA(data, 3);
      const ema = service.calculateEMA(data, 3);
      // EMA should react faster to the jump, so the last EMA value > last SMA value
      // (since EMA weights recent data more heavily)
      const lastSma = sma[sma.length - 1] as number;
      const lastEma = ema[ema.length - 1] as number;
      expect(lastEma).toBeGreaterThan(lastSma);
    });
  });

  // ── RSI ────────────────────────────────────────────────────────────

  describe('calculateRSI', () => {
    it('returns values between 0 and 100', () => {
      const rsi = service.calculateRSI(prices, 14);
      const validValues = rsi.filter((v) => v !== null);
      expect(validValues.length).toBeGreaterThan(0);
      for (const v of validValues) {
        expect(v).toBeGreaterThanOrEqual(0);
        expect(v).toBeLessThanOrEqual(100);
      }
    });

    it('returns warning on insufficient data', () => {
      const rsi = service.calculateRSI([1, 2], 14);
      expect(rsi).toHaveLength(0);
      expect((rsi as any).warning).toBeDefined();
    });

    it('returns RSI of 100 when there are only gains', () => {
      const ascending = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12, 13, 14, 15, 16];
      const rsi = service.calculateRSI(ascending, 14);
      const validValues = rsi.filter((v) => v !== null);
      // First RSI value: all gains, no losses -> RS = inf -> RSI = 100
      expect(validValues[0]).toBe(100);
    });

    it('uses default period of 14', () => {
      const rsi = service.calculateRSI(prices);
      const validValues = rsi.filter((v) => v !== null);
      // With period=14, need 15+ data points. We have 30, so there should be values.
      expect(validValues.length).toBeGreaterThan(0);
    });

    it('pads beginning with nulls', () => {
      const rsi = service.calculateRSI(prices, 14);
      // First 14 values should be null (period padding)
      for (let i = 0; i < 14; i++) {
        expect(rsi[i]).toBeNull();
      }
    });

    it('handles custom period', () => {
      const rsi = service.calculateRSI(prices, 5);
      // With period 5, first 5 values should be null
      for (let i = 0; i < 5; i++) {
        expect(rsi[i]).toBeNull();
      }
      // Rest should be valid numbers
      const validValues = rsi.filter((v) => v !== null);
      expect(validValues.length).toBe(prices.length - 5);
    });
  });

  // ── MACD ───────────────────────────────────────────────────────────

  describe('calculateMACD', () => {
    it('returns macd, signal, and histogram arrays', () => {
      const result = service.calculateMACD(prices);
      expect(result).toHaveProperty('macd');
      expect(result).toHaveProperty('signal');
      expect(result).toHaveProperty('histogram');
      expect(result.macd).toHaveLength(prices.length);
    });

    it('macd line has null padding then numeric values', () => {
      const result = service.calculateMACD(prices);
      // First slowPeriod-1 values should be null
      for (let i = 0; i < 25; i++) {
        expect(result.macd[i]).toBeNull();
      }
      // After that, at least some values should be non-null
      const validMacd = result.macd.filter((v) => v !== null);
      expect(validMacd.length).toBeGreaterThan(0);
    });

    it('histogram = macd - signal where both are non-null', () => {
      const result = service.calculateMACD(prices);
      for (let i = 0; i < result.histogram.length; i++) {
        if (result.macd[i] !== null && result.signal[i] !== null) {
          expect(result.histogram[i]).toBeCloseTo(
            result.macd[i]! - result.signal[i]!,
            10,
          );
        }
      }
    });

    it('accepts custom periods', () => {
      const result = service.calculateMACD(prices, 5, 10, 3);
      // With shorter periods, we should get more non-null MACD values
      const validMacd = result.macd.filter((v) => v !== null);
      expect(validMacd.length).toBeGreaterThan(0);
    });

    it('uses default periods 12, 26, 9', () => {
      const result = service.calculateMACD(prices);
      // With 30 data points and slow period 26, we should have some MACD values
      const validMacd = result.macd.filter((v) => v !== null);
      expect(validMacd.length).toBeGreaterThanOrEqual(1);
    });
  });

  // ── Bollinger Bands ────────────────────────────────────────────────

  describe('calculateBollingerBands', () => {
    it('returns upper, middle, and lower bands', () => {
      const result = service.calculateBollingerBands(prices, 10);
      expect(result).toHaveProperty('upper');
      expect(result).toHaveProperty('middle');
      expect(result).toHaveProperty('lower');
    });

    it('upper band > middle > lower band', () => {
      const result = service.calculateBollingerBands(prices, 10);
      for (let i = 9; i < prices.length; i++) {
        const upper = result.upper[i] as number;
        const middle = result.middle[i] as number;
        const lower = result.lower[i] as number;
        if (upper !== null && middle !== null && lower !== null) {
          expect(upper).toBeGreaterThanOrEqual(middle);
          expect(middle).toBeGreaterThanOrEqual(lower);
        }
      }
    });

    it('middle band equals SMA', () => {
      const period = 10;
      const result = service.calculateBollingerBands(prices, period);
      const sma = service.calculateSMA(prices, period);
      for (let i = period - 1; i < prices.length; i++) {
        expect(result.middle[i]).toBeCloseTo(sma[i] as number, 8);
      }
    });

    it('pads beginning with nulls', () => {
      const period = 10;
      const result = service.calculateBollingerBands(prices, period);
      for (let i = 0; i < period - 1; i++) {
        expect(result.upper[i]).toBeNull();
        expect(result.lower[i]).toBeNull();
      }
    });

    it('band width increases with higher stdDev multiplier', () => {
      const narrow = service.calculateBollingerBands(prices, 10, 1);
      const wide = service.calculateBollingerBands(prices, 10, 3);
      // At each valid index, the width (upper - lower) should be wider for multiplier 3
      for (let i = 9; i < prices.length; i++) {
        const narrowWidth = (narrow.upper[i] as number) - (narrow.lower[i] as number);
        const wideWidth = (wide.upper[i] as number) - (wide.lower[i] as number);
        expect(wideWidth).toBeGreaterThan(narrowWidth);
      }
    });

    it('uses default period 20 and multiplier 2', () => {
      const result = service.calculateBollingerBands(prices);
      expect(result.upper).toHaveLength(prices.length);
      // With default period 20 and 30 data points, there should be 11 valid values
      const validUpper = result.upper.filter((v) => v !== null);
      expect(validUpper).toHaveLength(11);
    });
  });

  // ── VWAP ───────────────────────────────────────────────────────────

  describe('calculateVWAP', () => {
    it('accumulates volume-weighted price', () => {
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

    it('returns 0 when cumulative volume is 0', () => {
      const p = [100, 200];
      const v = [0, 0];
      const vwap = service.calculateVWAP(p, v);
      expect(vwap).toEqual([0, 0]);
    });

    it('equals price when only one data point', () => {
      const vwap = service.calculateVWAP([150], [1000]);
      expect(vwap).toEqual([150]);
    });

    it('equals constant price when all prices are the same', () => {
      const p = [50, 50, 50, 50];
      const v = [100, 200, 300, 400];
      const vwap = service.calculateVWAP(p, v);
      for (const val of vwap) {
        expect(val).toBeCloseTo(50, 8);
      }
    });
  });

  // ── ATR ────────────────────────────────────────────────────────────

  describe('calculateATR', () => {
    const highs = [48, 48, 48.5, 48.2, 48.8, 49, 49.5, 49.2, 49.8, 50, 50.3, 50.1, 50.5, 50.8, 51, 51.2];
    const lows = [46, 46.2, 46.5, 46, 46.5, 47, 47.5, 47, 47.5, 48, 48.3, 48, 48.5, 48.8, 49, 49.2];
    const closes = [47, 47.5, 47.8, 47, 47.5, 48, 48.5, 48, 48.5, 49, 49.3, 49, 49.5, 49.8, 50, 50.2];

    it('returns array matching original length', () => {
      const atr = service.calculateATR(highs, lows, closes, 5);
      expect(atr).toHaveLength(closes.length);
    });

    it('first value is 0 (pad)', () => {
      const atr = service.calculateATR(highs, lows, closes, 5);
      expect(atr[0]).toBe(0);
    });

    it('ATR values are non-negative', () => {
      const atr = service.calculateATR(highs, lows, closes, 5);
      for (const val of atr) {
        if (val !== null) {
          expect(val).toBeGreaterThanOrEqual(0);
        }
      }
    });
  });

  // ── Stochastic ─────────────────────────────────────────────────────

  describe('calculateStochastic', () => {
    const highs = [48, 48, 48.5, 48.2, 48.8, 49, 49.5, 49.2, 49.8, 50, 50.3, 50.1, 50.5, 50.8, 51, 51.2];
    const lows = [46, 46.2, 46.5, 46, 46.5, 47, 47.5, 47, 47.5, 48, 48.3, 48, 48.5, 48.8, 49, 49.2];
    const closes = [47, 47.5, 47.8, 47, 47.5, 48, 48.5, 48, 48.5, 49, 49.3, 49, 49.5, 49.8, 50, 50.2];

    it('returns k and d arrays', () => {
      const result = service.calculateStochastic(highs, lows, closes, 5);
      expect(result).toHaveProperty('k');
      expect(result).toHaveProperty('d');
    });

    it('k values are between 0 and 100', () => {
      const result = service.calculateStochastic(highs, lows, closes, 5);
      const validK = result.k.filter((v) => v !== null);
      for (const val of validK) {
        expect(val).toBeGreaterThanOrEqual(0);
        expect(val).toBeLessThanOrEqual(100);
      }
    });

    it('k array has null padding at beginning', () => {
      const period = 5;
      const result = service.calculateStochastic(highs, lows, closes, period);
      for (let i = 0; i < period - 1; i++) {
        expect(result.k[i]).toBeNull();
      }
    });

    it('uses default period of 14', () => {
      const result = service.calculateStochastic(highs, lows, closes);
      // With 16 data points and period 14, should have 3 valid K values
      const validK = result.k.filter((v) => v !== null);
      expect(validK).toHaveLength(3);
    });
  });
});
