import { Injectable, Logger } from '@nestjs/common';

/**
 * Intraday Liquidity Simulation Engine — Quant Model
 *
 * Simulates the institution's intraday cash position by processing
 * expected inflows and outflows on a timeline.  Identifies peak usage,
 * minimum/maximum balances, and shortfall risk.
 *
 * Key metrics (BCBS 248 / BCBS 249):
 *   - Peak intraday usage
 *   - Minimum balance (lowest point in the day)
 *   - Maximum balance
 *   - Shortfall risk (periods where balance drops below zero)
 *
 * Designed for cooperativa treasury operations and COSSEC/NCUA
 * liquidity monitoring.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface CashFlow {
  time: string; // HH:MM format
  amount: number;
  description?: string;
}

export interface IntradayLiquidityParams {
  openingBalance: number;
  expectedInflows: CashFlow[];
  expectedOutflows: CashFlow[];
}

// ─── Output Types ───────────────────────────────────────────────────

export interface HourlyPosition {
  time: string;
  balance: number;
  netFlow: number;
  cumulativeInflows: number;
  cumulativeOutflows: number;
}

export interface IntradayLiquidityResult {
  peakUsage: number;
  minimumBalance: number;
  maximumBalance: number;
  hourlyPositions: HourlyPosition[];
  shortfallRisk: boolean;
  shortfallPeriods: string[];
  closingBalance: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class IntradayLiquidityService {
  private readonly logger = new Logger(IntradayLiquidityService.name);

  /**
   * Simulate intraday liquidity positions across the business day.
   *
   * Processes inflows and outflows chronologically, computing the running
   * balance at each hour.  Identifies shortfall periods and peak usage.
   */
  simulateIntradayLiquidity(params: IntradayLiquidityParams): IntradayLiquidityResult {
    const { openingBalance, expectedInflows, expectedOutflows } = params;

    // Build hourly timeline (08:00 through 17:00 business hours)
    const hours = Array.from({ length: 10 }, (_, i) => {
      const h = i + 8;
      return `${h.toString().padStart(2, '0')}:00`;
    });

    let balance = openingBalance;
    let cumulativeInflows = 0;
    let cumulativeOutflows = 0;
    let minimumBalance = openingBalance;
    let maximumBalance = openingBalance;
    let peakUsage = 0;
    const shortfallPeriods: string[] = [];

    const hourlyPositions: HourlyPosition[] = hours.map((time) => {
      const hourInflows = expectedInflows
        .filter((f) => this.matchesHour(f.time, time))
        .reduce((s, f) => s + f.amount, 0);

      const hourOutflows = expectedOutflows
        .filter((f) => this.matchesHour(f.time, time))
        .reduce((s, f) => s + f.amount, 0);

      const netFlow = hourInflows - hourOutflows;
      balance += netFlow;
      cumulativeInflows += hourInflows;
      cumulativeOutflows += hourOutflows;

      if (balance < minimumBalance) minimumBalance = balance;
      if (balance > maximumBalance) maximumBalance = balance;

      // Peak usage = largest drawdown from opening
      const usage = openingBalance - balance;
      if (usage > peakUsage) peakUsage = usage;

      if (balance < 0) {
        shortfallPeriods.push(time);
      }

      return {
        time,
        balance: this.round2(balance),
        netFlow: this.round2(netFlow),
        cumulativeInflows: this.round2(cumulativeInflows),
        cumulativeOutflows: this.round2(cumulativeOutflows),
      };
    });

    this.logger.log(
      `Intraday simulation: peak=${this.round2(peakUsage)}, min=${this.round2(minimumBalance)}, max=${this.round2(maximumBalance)}, shortfalls=${shortfallPeriods.length}`,
    );

    return {
      peakUsage: this.round2(Math.max(0, peakUsage)),
      minimumBalance: this.round2(minimumBalance),
      maximumBalance: this.round2(maximumBalance),
      hourlyPositions,
      shortfallRisk: shortfallPeriods.length > 0,
      shortfallPeriods,
      closingBalance: this.round2(balance),
    };
  }

  /**
   * Stress-test intraday liquidity by scaling outflows and delaying inflows.
   */
  stressTest(
    params: IntradayLiquidityParams,
    outflowMultiplier: number,
    inflowDelayHours: number,
  ): IntradayLiquidityResult {
    const stressedOutflows = params.expectedOutflows.map((f) => ({
      ...f,
      amount: f.amount * outflowMultiplier,
    }));

    const stressedInflows = params.expectedInflows.map((f) => ({
      ...f,
      time: this.delayTime(f.time, inflowDelayHours),
    }));

    return this.simulateIntradayLiquidity({
      openingBalance: params.openingBalance,
      expectedInflows: stressedInflows,
      expectedOutflows: stressedOutflows,
    });
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private matchesHour(flowTime: string, hourTime: string): boolean {
    const flowHour = parseInt(flowTime.split(':')[0], 10);
    const targetHour = parseInt(hourTime.split(':')[0], 10);
    return flowHour === targetHour;
  }

  private delayTime(time: string, delayHours: number): string {
    const [h, m] = time.split(':').map(Number);
    const newH = Math.min(h + delayHours, 17);
    return `${newH.toString().padStart(2, '0')}:${m.toString().padStart(2, '0')}`;
  }

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }
}
