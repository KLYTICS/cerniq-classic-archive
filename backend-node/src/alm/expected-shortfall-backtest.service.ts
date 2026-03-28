import { Injectable, Logger } from '@nestjs/common';

// ─── Types ───────────────────────────────────────────────────

export interface VaRBacktestParams {
  returns: number[];
  varEstimates: number[];
  confidenceLevel: number;
}

export interface VaRBacktestResult {
  exceptions: number;
  totalDays: number;
  exceptionRate: number;
  expectedRate: number;
  kupiecStatistic: number;
  kupiecPValue: number;
  kupiecPass: boolean;
  christoffersenStatistic: number;
  christoffersenPValue: number;
  christoffersenPass: boolean;
  trafficLight: 'GREEN' | 'YELLOW' | 'RED';
  details: Array<{
    date: number;
    return: number;
    var: number;
    exception: boolean;
  }>;
}

export interface ESBacktestParams {
  returns: number[];
  esEstimates: number[];
  varEstimates: number[];
  confidenceLevel: number;
}

export interface ESBacktestResult {
  esRatio: number;
  esPass: boolean;
  averageTailLoss: number;
  averageESEstimate: number;
  tailObservations: number;
}

export interface RollingBacktestParams {
  returns: number[];
  windowSize: number;
  confidenceLevel: number;
  method: 'historical' | 'parametric';
}

export interface RollingBacktestResult {
  periods: Array<{
    date: number;
    var: number;
    actualReturn: number;
    exception: boolean;
  }>;
  summary: {
    totalExceptions: number;
    rate: number;
    kupiecPValue: number;
    trafficLight: 'GREEN' | 'YELLOW' | 'RED';
  };
}

export interface TrafficLightParams {
  exceptions: number;
  observations: number;
  confidenceLevel: number;
}

export interface TrafficLightResult {
  zone: 'GREEN' | 'YELLOW' | 'RED';
  multiplier: number;
  description: string;
}

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class ExpectedShortfallBacktestService {
  private readonly logger = new Logger(ExpectedShortfallBacktestService.name);

  /**
   * Backtest VaR estimates against realized returns.
   *
   * Counts exceptions (days where loss exceeds VaR), computes the
   * Kupiec likelihood-ratio test, Christoffersen independence test,
   * and Basel III traffic-light classification.
   */
  backtestVaR(params: VaRBacktestParams): VaRBacktestResult {
    const { returns, varEstimates, confidenceLevel } = params;

    if (returns.length !== varEstimates.length) {
      throw new Error('returns and varEstimates must have the same length');
    }
    if (returns.length === 0) {
      throw new Error('returns array cannot be empty');
    }

    const n = returns.length;
    const expectedRate = 1 - confidenceLevel;

    const details: VaRBacktestResult['details'] = [];
    const exceptionFlags: boolean[] = [];

    for (let i = 0; i < n; i++) {
      // Loss exceeds VaR when return is more negative than -VaR
      const exception = returns[i] < -varEstimates[i];
      exceptionFlags.push(exception);
      details.push({
        date: i,
        return: returns[i],
        var: varEstimates[i],
        exception,
      });
    }

    const exceptions = exceptionFlags.filter(Boolean).length;
    const exceptionRate = exceptions / n;

    // Kupiec POF (Proportion Of Failures) test
    const kupiec = this.kupiecTest(exceptions, n, expectedRate);

    // Christoffersen independence test
    const christoffersen = this.christoffersenTest(exceptionFlags);

    // Traffic light
    const tl = this.trafficLightClassification({
      exceptions,
      observations: n,
      confidenceLevel,
    });

    return {
      exceptions,
      totalDays: n,
      exceptionRate,
      expectedRate,
      kupiecStatistic: kupiec.statistic,
      kupiecPValue: kupiec.pValue,
      kupiecPass: kupiec.pass,
      christoffersenStatistic: christoffersen.statistic,
      christoffersenPValue: christoffersen.pValue,
      christoffersenPass: christoffersen.pass,
      trafficLight: tl.zone,
      details,
    };
  }

  /**
   * Backtest Expected Shortfall estimates.
   *
   * For days where the realized loss exceeds VaR (exception days),
   * compare the average tail loss to the average ES estimate.
   * An esRatio < 1 indicates the model is conservative.
   */
  backtestES(params: ESBacktestParams): ESBacktestResult {
    const { returns, esEstimates, varEstimates, confidenceLevel } = params;

    if (
      returns.length !== esEstimates.length ||
      returns.length !== varEstimates.length
    ) {
      throw new Error(
        'returns, esEstimates, and varEstimates must have the same length',
      );
    }

    const tailLosses: number[] = [];
    const tailESEstimates: number[] = [];

    for (let i = 0; i < returns.length; i++) {
      // Exception day: actual loss exceeds VaR
      if (returns[i] < -varEstimates[i]) {
        tailLosses.push(-returns[i]); // Convert to positive loss
        tailESEstimates.push(esEstimates[i]);
      }
    }

    const tailObservations = tailLosses.length;

    if (tailObservations === 0) {
      return {
        esRatio: 0,
        esPass: true,
        averageTailLoss: 0,
        averageESEstimate:
          esEstimates.reduce((s, v) => s + v, 0) / esEstimates.length,
        tailObservations: 0,
      };
    }

    const averageTailLoss =
      tailLosses.reduce((s, v) => s + v, 0) / tailObservations;
    const averageESEstimate =
      tailESEstimates.reduce((s, v) => s + v, 0) / tailObservations;

    // ES ratio: average tail loss / average ES estimate
    // < 1 means model is conservative (ES estimate exceeds actual tail losses)
    const esRatio =
      averageESEstimate > 0 ? averageTailLoss / averageESEstimate : Infinity;

    return {
      esRatio,
      esPass: esRatio <= 1,
      averageTailLoss,
      averageESEstimate,
      tailObservations,
    };
  }

  /**
   * Rolling (expanding-window) VaR backtest.
   *
   * For each day after `windowSize`, compute VaR from the trailing
   * window using the specified method, then check if the next-day
   * loss exceeds that VaR.
   */
  rollingBacktest(params: RollingBacktestParams): RollingBacktestResult {
    const { returns, windowSize, confidenceLevel, method } = params;

    if (returns.length <= windowSize) {
      throw new Error('returns array must be longer than windowSize');
    }

    const periods: RollingBacktestResult['periods'] = [];

    for (let i = windowSize; i < returns.length; i++) {
      const window = returns.slice(i - windowSize, i);
      const var_ =
        method === 'historical'
          ? this.historicalVaR(window, confidenceLevel)
          : this.parametricVaR(window, confidenceLevel);

      const actualReturn = returns[i];
      const exception = actualReturn < -var_;

      periods.push({
        date: i,
        var: var_,
        actualReturn,
        exception,
      });
    }

    const totalExceptions = periods.filter((p) => p.exception).length;
    const totalPeriods = periods.length;
    const rate = totalPeriods > 0 ? totalExceptions / totalPeriods : 0;

    const expectedRate = 1 - confidenceLevel;
    const kupiec = this.kupiecTest(totalExceptions, totalPeriods, expectedRate);

    const tl = this.trafficLightClassification({
      exceptions: totalExceptions,
      observations: totalPeriods,
      confidenceLevel,
    });

    return {
      periods,
      summary: {
        totalExceptions,
        rate,
        kupiecPValue: kupiec.pValue,
        trafficLight: tl.zone,
      },
    };
  }

  /**
   * Basel III traffic-light classification.
   *
   * At 99% confidence / 250 observations:
   *   Green:  0-4 exceptions   (multiplier 3.0)
   *   Yellow: 5-9 exceptions   (multiplier 3.4-3.65)
   *   Red:    10+ exceptions   (multiplier 4.0)
   *
   * For other observation counts and confidence levels, thresholds
   * are scaled proportionally.
   */
  trafficLightClassification(params: TrafficLightParams): TrafficLightResult {
    const { exceptions, observations, confidenceLevel } = params;

    // Scale thresholds from the Basel baseline of 250 days at 99%
    const scaleFactor = observations / 250;
    const confidenceScale = (1 - confidenceLevel) / 0.01; // relative to 1% expected rate

    // Basel green/yellow/red boundaries (at 99%/250 days: 4, 9)
    const greenMax = Math.round(4 * scaleFactor * confidenceScale);
    const yellowMax = Math.round(9 * scaleFactor * confidenceScale);

    let zone: TrafficLightResult['zone'];
    let multiplier: number;
    let description: string;

    if (exceptions <= greenMax) {
      zone = 'GREEN';
      multiplier = 3.0;
      description = `Model is accurate. ${exceptions} exception(s) within acceptable range (0-${greenMax}).`;
    } else if (exceptions <= yellowMax) {
      zone = 'YELLOW';
      // Linear interpolation between 3.4 and 3.65
      const yellowRange = yellowMax - greenMax;
      const yellowPos = exceptions - greenMax;
      multiplier =
        yellowRange > 0 ? 3.4 + (0.25 * yellowPos) / yellowRange : 3.4;
      multiplier = Math.round(multiplier * 100) / 100;
      description = `Model requires attention. ${exceptions} exception(s) in warning range (${greenMax + 1}-${yellowMax}).`;
    } else {
      zone = 'RED';
      multiplier = 4.0;
      description = `Model is inaccurate. ${exceptions} exception(s) exceed threshold (>${yellowMax}). Remediation required.`;
    }

    return { zone, multiplier, description };
  }

  // ─── Private helpers ──────────────────────────────────────

  /**
   * Kupiec Proportion-Of-Failures LR test.
   *
   * LR = -2 * ln[ (1-p)^(n-x) * p^x / ((1-x/n)^(n-x) * (x/n)^x) ]
   * Under H0, LR ~ chi-squared(1).
   */
  private kupiecTest(
    x: number,
    n: number,
    p: number,
  ): { statistic: number; pValue: number; pass: boolean } {
    let lr: number;

    if (x === 0) {
      // L1 denominator terms: (1-0)^n * (0)^0 = 1, so ln(L1) = 0
      lr = -2 * n * Math.log(1 - p);
    } else if (x === n) {
      lr = -2 * n * Math.log(p);
    } else {
      lr =
        -2 *
        ((n - x) * Math.log(1 - p) +
          x * Math.log(p) -
          (n - x) * Math.log(1 - x / n) -
          x * Math.log(x / n));
    }

    if (!Number.isFinite(lr)) {
      lr = 0;
    }

    // Approximate chi-squared(1) p-value
    const pValue = this.chiSquaredSurvival(lr, 1);

    return {
      statistic: Math.round(lr * 1e6) / 1e6,
      pValue: Math.round(pValue * 1e6) / 1e6,
      pass: pValue > 0.05, // Do not reject H0 at 5% significance
    };
  }

  /**
   * Christoffersen independence test.
   *
   * Tests whether VaR breaches are independent (not clustered)
   * using a first-order Markov chain model.
   *
   * LR_ind = -2 * ln(L_ind / L_dep)
   * Under H0 (independence), LR_ind ~ chi-squared(1).
   */
  private christoffersenTest(exceptions: boolean[]): {
    statistic: number;
    pValue: number;
    pass: boolean;
  } {
    if (exceptions.length < 2) {
      return { statistic: 0, pValue: 1, pass: true };
    }

    // Count transitions
    let n00 = 0,
      n01 = 0,
      n10 = 0,
      n11 = 0;
    for (let i = 1; i < exceptions.length; i++) {
      const prev = exceptions[i - 1];
      const curr = exceptions[i];
      if (!prev && !curr) n00++;
      else if (!prev && curr) n01++;
      else if (prev && !curr) n10++;
      else n11++;
    }

    const n0 = n00 + n01; // days following a non-exception
    const n1 = n10 + n11; // days following an exception

    // Transition probabilities
    const pi01 = n0 > 0 ? n01 / n0 : 0;
    const pi11 = n1 > 0 ? n11 / n1 : 0;

    // Overall exception probability
    const totalExceptions = n01 + n11;
    const total = n00 + n01 + n10 + n11;
    const pi = total > 0 ? totalExceptions / total : 0;

    // Avoid log(0)
    if (pi === 0 || pi === 1 || total === 0) {
      return { statistic: 0, pValue: 1, pass: true };
    }

    // Log-likelihood under independence (H0)
    let llInd = 0;
    if (n00 + n01 > 0) {
      llInd +=
        (n00 > 0 ? n00 * Math.log(1 - pi) : 0) +
        (n01 > 0 ? n01 * Math.log(pi) : 0);
    }
    if (n10 + n11 > 0) {
      llInd +=
        (n10 > 0 ? n10 * Math.log(1 - pi) : 0) +
        (n11 > 0 ? n11 * Math.log(pi) : 0);
    }

    // Log-likelihood under dependence (H1, Markov model)
    let llDep = 0;
    if (n0 > 0) {
      llDep +=
        (n00 > 0 ? n00 * Math.log(1 - pi01) : 0) +
        (n01 > 0 ? n01 * Math.log(pi01) : 0);
    }
    if (n1 > 0) {
      llDep +=
        (n10 > 0 ? n10 * Math.log(1 - pi11) : 0) +
        (n11 > 0 ? n11 * Math.log(pi11) : 0);
    }

    let lr = -2 * (llInd - llDep);
    if (!Number.isFinite(lr) || lr < 0) {
      lr = 0;
    }

    const pValue = this.chiSquaredSurvival(lr, 1);

    return {
      statistic: Math.round(lr * 1e6) / 1e6,
      pValue: Math.round(pValue * 1e6) / 1e6,
      pass: pValue > 0.05,
    };
  }

  /**
   * Historical VaR: sort returns, pick the (1-confidence) percentile.
   */
  private historicalVaR(returns: number[], confidence: number): number {
    const sorted = [...returns].sort((a, b) => a - b);
    const index = Math.max(0, Math.floor((1 - confidence) * sorted.length) - 1);
    return -sorted[index]; // Positive number representing loss
  }

  /**
   * Parametric (delta-normal) VaR: z * sigma.
   */
  private parametricVaR(returns: number[], confidence: number): number {
    const mean = returns.reduce((s, r) => s + r, 0) / returns.length;
    const variance =
      returns.reduce((s, r) => s + (r - mean) ** 2, 0) / returns.length;
    const sigma = Math.sqrt(variance);

    const z = this.normalInverseCDF(confidence);
    return z * sigma - mean; // VaR as positive loss
  }

  /**
   * Approximate inverse normal CDF (Beasley-Springer-Moro algorithm).
   */
  private normalInverseCDF(p: number): number {
    if (p <= 0) return -Infinity;
    if (p >= 1) return Infinity;

    // Rational approximation for central region
    if (p > 0.5) {
      return -this.normalInverseCDF(1 - p);
    }

    const t = Math.sqrt(-2 * Math.log(p));
    const c0 = 2.515517;
    const c1 = 0.802853;
    const c2 = 0.010328;
    const d1 = 1.432788;
    const d2 = 0.189269;
    const d3 = 0.001308;

    return -(
      t -
      (c0 + c1 * t + c2 * t * t) / (1 + d1 * t + d2 * t * t + d3 * t * t * t)
    );
  }

  /**
   * Approximate survival function (1 - CDF) for chi-squared distribution.
   * Uses the Wilson-Hilferty normal approximation.
   */
  private chiSquaredSurvival(x: number, df: number): number {
    if (x <= 0) return 1;
    if (df <= 0) return 0;

    // Wilson-Hilferty transformation
    const z =
      (Math.pow(x / df, 1 / 3) - (1 - 2 / (9 * df))) / Math.sqrt(2 / (9 * df));

    // Standard normal CDF approximation
    return 1 - this.normalCDF(z);
  }

  /**
   * Approximate standard normal CDF.
   */
  private normalCDF(z: number): number {
    if (z < -8) return 0;
    if (z > 8) return 1;

    const a1 = 0.254829592;
    const a2 = -0.284496736;
    const a3 = 1.421413741;
    const a4 = -1.453152027;
    const a5 = 1.061405429;
    const p = 0.3275911;

    const sign = z < 0 ? -1 : 1;
    const absZ = Math.abs(z);
    const t = 1.0 / (1.0 + p * absZ);
    const y =
      1.0 -
      ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) *
        t *
        Math.exp((-absZ * absZ) / 2);

    return 0.5 * (1.0 + sign * y);
  }
}
