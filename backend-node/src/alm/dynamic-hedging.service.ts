import { Injectable, Logger } from '@nestjs/common';

/**
 * Dynamic Hedging Engine — Quant Model
 *
 * Calculates optimal hedge positions to close duration gaps between a
 * portfolio's current duration and a target duration.  The engine selects
 * from a set of hedge instruments (swaps, futures, bonds) and computes
 * the notional and contract count required for each.
 *
 * Core formula:
 *   Notional = (TargetDuration - PortfolioDuration) × PortfolioValue / HedgeDuration
 *
 * Designed for ALM desks managing interest-rate risk in cooperativa
 * and community-bank balance sheets.
 */

// ─── Input Types ────────────────────────────────────────────────────

export interface HedgeInstrument {
  name: string;
  duration: number;
  price: number;
  /** Contract size — defaults to 100,000 if omitted */
  contractSize?: number;
}

export interface DynamicHedgingParams {
  portfolioDuration: number;
  portfolioValue: number;
  targetDuration: number;
  hedgeInstruments: HedgeInstrument[];
}

// ─── Output Types ───────────────────────────────────────────────────

export interface HedgePosition {
  instrument: string;
  notional: number;
  contracts: number;
  durationContribution: number;
}

export interface DynamicHedgingResult {
  hedgePositions: HedgePosition[];
  residualDuration: number;
  hedgeCost: number;
  durationGap: number;
}

// ─── Service ────────────────────────────────────────────────────────

@Injectable()
export class DynamicHedgingService {
  private readonly logger = new Logger(DynamicHedgingService.name);

  /**
   * Calculate optimal hedge positions to close the duration gap.
   *
   * Allocates the required notional equally across all supplied hedge
   * instruments, then rounds to whole contracts.  The residual duration
   * reflects any rounding error.
   */
  calculateHedge(params: DynamicHedgingParams): DynamicHedgingResult {
    const { portfolioDuration, portfolioValue, targetDuration, hedgeInstruments } = params;

    if (hedgeInstruments.length === 0) {
      throw new Error('At least one hedge instrument is required');
    }
    if (portfolioValue <= 0) {
      throw new Error('portfolioValue must be positive');
    }

    const durationGap = targetDuration - portfolioDuration;
    const totalDollarDurationNeeded = durationGap * portfolioValue;

    // Spread the dollar-duration need equally across instruments
    const perInstrumentDD = totalDollarDurationNeeded / hedgeInstruments.length;

    let achievedDollarDuration = 0;
    let totalCost = 0;

    const hedgePositions: HedgePosition[] = hedgeInstruments.map((inst) => {
      const notional = perInstrumentDD / inst.duration;
      const contractSize = inst.contractSize ?? 100_000;
      const contracts = Math.round(Math.abs(notional) / contractSize) * Math.sign(notional);
      const actualNotional = contracts * contractSize;
      const durationContribution = (actualNotional * inst.duration) / portfolioValue;

      achievedDollarDuration += actualNotional * inst.duration;
      totalCost += Math.abs(actualNotional) * inst.price * 0.0001; // 1 bp transaction cost

      return {
        instrument: inst.name,
        notional: this.round2(actualNotional),
        contracts,
        durationContribution: this.round6(durationContribution),
      };
    });

    const achievedDurationShift = achievedDollarDuration / portfolioValue;
    const residualDuration = this.round6(
      portfolioDuration + achievedDurationShift - targetDuration,
    );

    this.logger.log(
      `Hedge calculated: gap=${this.round6(durationGap)}, residual=${residualDuration}, cost=${this.round2(totalCost)}`,
    );

    return {
      hedgePositions,
      residualDuration,
      hedgeCost: this.round2(totalCost),
      durationGap: this.round6(durationGap),
    };
  }

  /**
   * Evaluate hedge effectiveness as the ratio of hedge P&L to portfolio P&L
   * under a parallel rate shock.
   */
  evaluateEffectiveness(
    params: DynamicHedgingParams,
    shockBps: number,
  ): { effectiveness: number; portfolioPnL: number; hedgePnL: number } {
    const hedgeResult = this.calculateHedge(params);
    const shockDecimal = shockBps / 10_000;

    // Approximate portfolio P&L via duration
    const portfolioPnL = -params.portfolioDuration * params.portfolioValue * shockDecimal;

    // Hedge P&L
    let hedgePnL = 0;
    for (const pos of hedgeResult.hedgePositions) {
      const inst = params.hedgeInstruments.find((i) => i.name === pos.instrument)!;
      hedgePnL += -inst.duration * pos.notional * shockDecimal;
    }

    const effectiveness =
      portfolioPnL !== 0 ? Math.abs((portfolioPnL + hedgePnL) / portfolioPnL) : 0;

    return {
      effectiveness: this.round6(1 - effectiveness),
      portfolioPnL: this.round2(portfolioPnL),
      hedgePnL: this.round2(hedgePnL),
    };
  }

  // ─── Private helpers ──────────────────────────────────────────────

  private round2(n: number): number {
    return Math.round(n * 100) / 100;
  }

  private round6(n: number): number {
    return Math.round(n * 1_000_000) / 1_000_000;
  }
}
