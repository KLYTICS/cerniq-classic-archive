import { Injectable, Logger } from '@nestjs/common';
import {
  isMaterial,
  type MaterialityResult,
} from './policy/materiality.policy';

export interface FluxInputRow {
  account: string;
  priorBalance: number;
  currentBalance: number;
}

export interface FluxNarrativeRow {
  account: string;
  priorBalance: number;
  currentBalance: number;
  varianceAbs: number;
  variancePct: number;
  isMaterial: boolean;
  narrativeEn: string;
  narrativeEs: string;
  confidence: number;
}

/**
 * Generates plain-language flux narratives for the close binder.
 *
 * Today this is a deterministic template — it explains the *shape* of each
 * variance (direction, magnitude, materiality) without making up causes. We
 * deliberately do NOT call an LLM here yet because:
 *   1. Auditors must be able to reproduce a narrative byte-for-byte.
 *   2. Hallucinated causes ("AWS bill grew due to GPU usage") can mislead
 *      a reviewer who doesn't fact-check.
 * The LlmModule already exists in this repo — when we want optional AI
 * narratives we'll add a .narrateWithLlm(rows, opts) method that the
 * controller exposes behind a feature flag. For now, deterministic only.
 */
@Injectable()
export class FluxNarratorService {
  private readonly logger = new Logger(FluxNarratorService.name);

  narrate(rows: FluxInputRow[], policy: MaterialityResult): FluxNarrativeRow[] {
    return rows.map((row) => {
      const varianceAbs = +(row.currentBalance - row.priorBalance).toFixed(2);
      const variancePct =
        row.priorBalance === 0
          ? row.currentBalance === 0
            ? 0
            : 1 // treat new balances as 100% movement
          : varianceAbs / Math.abs(row.priorBalance);

      const material = isMaterial(varianceAbs, variancePct, policy);
      const direction =
        varianceAbs > 0
          ? 'increase'
          : varianceAbs < 0
            ? 'decrease'
            : 'no change';
      const directionEs =
        varianceAbs > 0
          ? 'aumento'
          : varianceAbs < 0
            ? 'disminución'
            : 'sin cambio';

      const narrativeEn = material
        ? `${row.account}: material ${direction} of ${fmtUsd(varianceAbs)} (${fmtPct(variancePct)}). Requires controller explanation.`
        : `${row.account}: immaterial ${direction} of ${fmtUsd(varianceAbs)} (${fmtPct(variancePct)}). Within tolerance.`;

      const narrativeEs = material
        ? `${row.account}: ${directionEs} material de ${fmtUsd(varianceAbs)} (${fmtPct(variancePct)}). Requiere explicación del controlador.`
        : `${row.account}: ${directionEs} no material de ${fmtUsd(varianceAbs)} (${fmtPct(variancePct)}). Dentro de tolerancia.`;

      // Confidence is high for the deterministic template; it'll drop when
      // we eventually layer LLM-augmented narratives on top.
      const confidence = 1.0;

      return {
        account: row.account,
        priorBalance: row.priorBalance,
        currentBalance: row.currentBalance,
        varianceAbs,
        variancePct,
        isMaterial: material,
        narrativeEn,
        narrativeEs,
        confidence,
      };
    });
  }
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(n);
}

function fmtPct(n: number): string {
  return `${(n * 100).toFixed(1)}%`;
}
