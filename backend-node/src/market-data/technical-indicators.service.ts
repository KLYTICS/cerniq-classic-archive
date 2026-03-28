import { Injectable } from '@nestjs/common';

/** Array with an optional warning attached (serialises in JSON responses). */
export type IndicatorResult = number[] & { warning?: string };

/**
 * Technical Indicators Service
 * Implements common technical analysis indicators
 */
@Injectable()
export class TechnicalIndicatorsService {
  /** Attach a warning to an empty array without changing the array type. */
  private emptyWithWarning(message: string): IndicatorResult {
    const arr: IndicatorResult = [] as unknown as IndicatorResult;
    arr.warning = message;
    return arr;
  }

  /**
   * Simple Moving Average (SMA)
   */
  calculateSMA(prices: number[], period: number): IndicatorResult {
    if (prices.length < period) {
      return this.emptyWithWarning(
        `Insufficient data for SMA: need ${period} data points, got ${prices.length}`,
      );
    }

    const sma: number[] = [];
    for (let i = period - 1; i < prices.length; i++) {
      const sum = prices
        .slice(i - period + 1, i + 1)
        .reduce((a, b) => a + b, 0);
      sma.push(sum / period);
    }

    // Pad beginning with nulls to match price array length
    return [...Array(period - 1).fill(null), ...sma] as IndicatorResult;
  }

  /**
   * Exponential Moving Average (EMA)
   */
  calculateEMA(prices: number[], period: number): IndicatorResult {
    if (prices.length < period) {
      return this.emptyWithWarning(
        `Insufficient data for EMA: need ${period} data points, got ${prices.length}`,
      );
    }

    const ema: number[] = [];
    const multiplier = 2 / (period + 1);

    // Start with SMA for first value
    const firstSMA =
      prices.slice(0, period).reduce((a, b) => a + b, 0) / period;
    ema.push(firstSMA);

    // Calculate EMA
    for (let i = period; i < prices.length; i++) {
      const currentEMA =
        (prices[i] - ema[ema.length - 1]) * multiplier + ema[ema.length - 1];
      ema.push(currentEMA);
    }

    // Pad beginning
    return [...Array(period - 1).fill(null), ...ema] as IndicatorResult;
  }

  /**
   * Relative Strength Index (RSI)
   */
  calculateRSI(prices: number[], period: number = 14): IndicatorResult {
    if (prices.length < period + 1) {
      return this.emptyWithWarning(
        `Insufficient data for RSI: need ${period + 1} data points, got ${prices.length}`,
      );
    }

    const rsi: number[] = [];
    const gains: number[] = [];
    const losses: number[] = [];

    // Calculate price changes
    for (let i = 1; i < prices.length; i++) {
      const change = prices[i] - prices[i - 1];
      gains.push(change > 0 ? change : 0);
      losses.push(change < 0 ? -change : 0);
    }

    // First RSI uses average
    let avgGain = gains.slice(0, period).reduce((a, b) => a + b, 0) / period;
    let avgLoss = losses.slice(0, period).reduce((a, b) => a + b, 0) / period;

    if (avgLoss === 0) {
      rsi.push(100);
    } else {
      const rs = avgGain / avgLoss;
      rsi.push(100 - 100 / (1 + rs));
    }

    // Subsequent RSI values use smoothing
    for (let i = period; i < gains.length; i++) {
      avgGain = (avgGain * (period - 1) + gains[i]) / period;
      avgLoss = (avgLoss * (period - 1) + losses[i]) / period;

      if (avgLoss === 0) {
        rsi.push(100);
      } else {
        const rs = avgGain / avgLoss;
        rsi.push(100 - 100 / (1 + rs));
      }
    }

    // Pad beginning (period + 1 because we start from index 1)
    return [...Array(period).fill(null), ...rsi] as IndicatorResult;
  }

  /**
   * MACD (Moving Average Convergence Divergence)
   */
  calculateMACD(
    prices: number[],
    fastPeriod: number = 12,
    slowPeriod: number = 26,
    signalPeriod: number = 9,
  ): {
    macd: (number | null)[];
    signal: (number | null)[];
    histogram: (number | null)[];
  } {
    const fastEMA = this.calculateEMA(prices, fastPeriod);
    const slowEMA = this.calculateEMA(prices, slowPeriod);

    // MACD line = fast EMA - slow EMA
    const macdLine: (number | null)[] = [];
    for (let i = 0; i < prices.length; i++) {
      if (fastEMA[i] !== null && slowEMA[i] !== null) {
        macdLine.push(fastEMA[i] - slowEMA[i]);
      } else {
        macdLine.push(null);
      }
    }

    // Signal line = EMA of MACD line
    const validMacd = macdLine.filter((v) => v !== null);
    const signalEMA = this.calculateEMA(validMacd, signalPeriod);

    // Pad signal line to match length
    const paddingLength =
      macdLine.findIndex((v) => v !== null) + signalPeriod - 1;
    const signalLine = [...Array(paddingLength).fill(null), ...signalEMA];

    // Histogram = MACD - Signal
    const histogram: (number | null)[] = [];
    for (let i = 0; i < macdLine.length; i++) {
      if (macdLine[i] !== null && signalLine[i] !== null) {
        histogram.push(macdLine[i]! - signalLine[i]!);
      } else {
        histogram.push(null);
      }
    }

    return {
      macd: macdLine,
      signal: signalLine,
      histogram,
    };
  }

  /**
   * Bollinger Bands
   */
  calculateBollingerBands(
    prices: number[],
    period: number = 20,
    stdDevMultiplier: number = 2,
  ): {
    upper: number[];
    middle: number[];
    lower: number[];
  } {
    const middle = this.calculateSMA(prices, period);
    const upper: number[] = [];
    const lower: number[] = [];

    for (let i = period - 1; i < prices.length; i++) {
      const slice = prices.slice(i - period + 1, i + 1);
      const mean = slice.reduce((a, b) => a + b, 0) / period;
      const variance =
        slice.reduce((sum, price) => sum + Math.pow(price - mean, 2), 0) /
        period;
      const stdDev = Math.sqrt(variance);

      upper.push(mean + stdDevMultiplier * stdDev);
      lower.push(mean - stdDevMultiplier * stdDev);
    }

    return {
      upper: [...Array(period - 1).fill(null), ...upper],
      middle,
      lower: [...Array(period - 1).fill(null), ...lower],
    };
  }

  /**
   * Volume Weighted Average Price (VWAP)
   */
  calculateVWAP(prices: number[], volumes: number[]): number[] {
    const vwap: number[] = [];
    let cumulativePV = 0;
    let cumulativeVolume = 0;

    for (let i = 0; i < prices.length; i++) {
      cumulativePV += prices[i] * volumes[i];
      cumulativeVolume += volumes[i];
      vwap.push(cumulativeVolume > 0 ? cumulativePV / cumulativeVolume : 0);
    }

    return vwap;
  }

  /**
   * Average True Range (ATR) - Volatility indicator
   */
  calculateATR(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): number[] {
    const trueRanges: number[] = [];

    for (let i = 1; i < closes.length; i++) {
      const high = highs[i];
      const low = lows[i];
      const prevClose = closes[i - 1];

      const tr = Math.max(
        high - low,
        Math.abs(high - prevClose),
        Math.abs(low - prevClose),
      );
      trueRanges.push(tr);
    }

    // Calculate ATR using EMA of true ranges
    const atrValues = this.calculateEMA(trueRanges, period);

    // Pad to match original length
    return [0, ...atrValues];
  }

  /**
   * Stochastic Oscillator
   */
  calculateStochastic(
    highs: number[],
    lows: number[],
    closes: number[],
    period: number = 14,
  ): {
    k: number[];
    d: number[];
  } {
    const kValues: number[] = [];

    for (let i = period - 1; i < closes.length; i++) {
      const slice = {
        high: highs.slice(i - period + 1, i + 1),
        low: lows.slice(i - period + 1, i + 1),
      };
      const highest = Math.max(...slice.high);
      const lowest = Math.min(...slice.low);

      const k = ((closes[i] - lowest) / (highest - lowest)) * 100;
      kValues.push(k);
    }

    // %D is 3-period SMA of %K
    const dValues = this.calculateSMA(kValues, 3);

    return {
      k: [...Array(period - 1).fill(null), ...kValues],
      d: [
        ...Array(period + 1).fill(null),
        ...dValues.filter((v) => v !== null),
      ],
    };
  }
}
