import { Injectable, Logger } from '@nestjs/common';
import { ReconciliationStatus } from '@prisma/client';

export interface TieOutLine {
  description: string;
  amount: number;
  side: 'gl' | 'ext';
}

export interface TieOutResult {
  glBalance: number;
  externalBalance: number;
  difference: number;
  matchedPairs: Array<{ glLine: TieOutLine; extLine: TieOutLine }>;
  unmatched: TieOutLine[];
  status: ReconciliationStatus;
}

/**
 * Auto-matches GL lines against external statement lines (bank/AP/AR).
 *
 * Algorithm: greedy two-pointer over amount-sorted lines, with a small
 * tolerance for floating-point and rounding noise. We match exact amounts
 * first; whatever can't be paired falls into `unmatched` for human review.
 *
 * NOTE: this is intentionally a simple, deterministic matcher — not ML.
 * Auditors hate ML in tie-outs because they can't explain why two lines
 * matched. A boring algorithm with a tolerance is the right primitive.
 */
@Injectable()
export class TieOutService {
  private readonly logger = new Logger(TieOutService.name);
  /** Pennies tolerance for amount matching. */
  private static readonly MATCH_TOLERANCE = 0.01;

  run(
    glBalance: number,
    externalBalance: number,
    lines: TieOutLine[],
  ): TieOutResult {
    const gl = lines
      .filter((l) => l.side === 'gl')
      .sort((a, b) => a.amount - b.amount);
    const ext = lines
      .filter((l) => l.side === 'ext')
      .sort((a, b) => a.amount - b.amount);

    const matchedPairs: TieOutResult['matchedPairs'] = [];
    const consumedExt = new Set<number>();

    for (const glLine of gl) {
      const extIdx = ext.findIndex(
        (e, i) =>
          !consumedExt.has(i) &&
          Math.abs(e.amount - glLine.amount) <= TieOutService.MATCH_TOLERANCE,
      );
      if (extIdx >= 0) {
        consumedExt.add(extIdx);
        matchedPairs.push({ glLine, extLine: ext[extIdx] });
      }
    }

    const unmatched: TieOutLine[] = [
      ...gl.filter((l) => !matchedPairs.some((p) => p.glLine === l)),
      ...ext.filter((_, i) => !consumedExt.has(i)),
    ];

    const difference = +(glBalance - externalBalance).toFixed(2);
    const status: ReconciliationStatus =
      Math.abs(difference) <= TieOutService.MATCH_TOLERANCE &&
      unmatched.length === 0
        ? ReconciliationStatus.TIE
        : ReconciliationStatus.EXCEPTION;

    this.logger.debug(
      `tie-out: gl=${glBalance} ext=${externalBalance} diff=${difference} matched=${matchedPairs.length} unmatched=${unmatched.length} status=${status}`,
    );

    return {
      glBalance,
      externalBalance,
      difference,
      matchedPairs,
      unmatched,
      status,
    };
  }
}
