import { Injectable, Logger } from '@nestjs/common';

/**
 * Sector Rotation Analysis Service
 *
 * Compares current sector weights to target allocations and
 * produces a rebalancing action list together with the
 * portfolio-level duration and yield impact of the proposed trades.
 *
 * Key outputs:
 * - Rebalancing actions (buy / sell / hold) per sector
 * - Net duration impact of the rebalance
 * - Net yield impact of the rebalance
 * - Total portfolio turnover
 */

// ─── Types ──────────────────────────────────────────────────────

export interface SectorAllocation {
  name: string;
  currentWeight: number;
  targetWeight: number;
  yield: number;
  duration: number;
}

export interface SectorRotationParams {
  sectors: SectorAllocation[];
}

export interface RebalancingAction {
  sector: string;
  action: 'BUY' | 'SELL' | 'HOLD';
  amount: number;
}

export interface SectorRotationResult {
  rebalancingActions: RebalancingAction[];
  durationImpact: number;
  yieldImpact: number;
  turnover: number;
}

// ─── Service ────────────────────────────────────────────────────

@Injectable()
export class SectorRotationService {
  private readonly logger = new Logger(SectorRotationService.name);

  /**
   * Analyse sector allocation drift and produce rebalancing trades.
   *
   * Weights are expressed as fractions (e.g. 0.25 = 25 %).
   * `amount` on each action is the absolute weight change.
   */
  analyzeSectorRotation(params: SectorRotationParams): SectorRotationResult {
    const { sectors } = params;
    this.logger.log(
      `Analyzing sector rotation across ${sectors.length} sectors`,
    );

    const rebalancingActions: RebalancingAction[] = [];
    let currentDuration = 0;
    let targetDuration = 0;
    let currentYield = 0;
    let targetYield = 0;
    let turnover = 0;

    for (const s of sectors) {
      const diff = round4(s.targetWeight - s.currentWeight);
      const absDiff = Math.abs(diff);

      let action: 'BUY' | 'SELL' | 'HOLD';
      if (diff > 0.001) {
        action = 'BUY';
      } else if (diff < -0.001) {
        action = 'SELL';
      } else {
        action = 'HOLD';
      }

      rebalancingActions.push({
        sector: s.name,
        action,
        amount: round4(absDiff),
      });

      currentDuration += s.currentWeight * s.duration;
      targetDuration += s.targetWeight * s.duration;
      currentYield += s.currentWeight * s.yield;
      targetYield += s.targetWeight * s.yield;
      turnover += absDiff;
    }

    // Turnover counts each side once (half of sum of absolute changes)
    turnover = round4(turnover / 2);

    return {
      rebalancingActions,
      durationImpact: round4(targetDuration - currentDuration),
      yieldImpact: round4(targetYield - currentYield),
      turnover,
    };
  }
}

// ─── Helpers ────────────────────────────────────────────────────

function round4(n: number): number {
  return Math.round(n * 10000) / 10000;
}
