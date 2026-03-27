// Volatility Analytics DTOs

export interface VolatilityConePoint {
  daysToExpiry: number;
  p10: number; // 10th percentile historical vol
  p25: number; // 25th percentile
  p50: number; // Median (50th percentile)
  p75: number; // 75th percentile
  p90: number; // 90th percentile
  currentIV?: number; // Current implied volatility (if available)
  currentRV: number; // Current realized volatility
}

export class VolatilityConeResponseDto {
  ticker: string;
  underlyingPrice: number;
  coneData: VolatilityConePoint[];
  timestamp: Date;
}

export class VolatilityHeatmapResponseDto {
  ticker: string;
  strikes: number[];
  maturities: number[]; // Days to expiry
  ivMatrix: number[][]; // 2D array: ivMatrix[maturityIndex][strikeIndex]
  underlyingPrice: number;
  timestamp: Date;
}

export interface RealizedVsImpliedPoint {
  date: Date;
  realizedVol: number;
  impliedVol: number;
  spread: number; // IV - RV
}

export class RealizedVsImpliedResponseDto {
  ticker: string;
  timeSeries: RealizedVsImpliedPoint[];
  current: {
    realized30d: number;
    implied30d: number;
    spread: number;
    percentile: number; // Where current IV ranks historically (0-100)
  };
  timestamp: Date;
}

export class VolatilityStatsDto {
  ticker: string;
  period: string; // e.g., "30d", "90d", "1y"
  realized: number;
  implied?: number;
  hvRank: number; // Historical volatility rank (0-100)
  ivRank?: number; // Implied volatility rank (0-100)
}
