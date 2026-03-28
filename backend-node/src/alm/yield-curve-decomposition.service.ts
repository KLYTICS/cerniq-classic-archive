import { Injectable } from '@nestjs/common';

/**
 * Yield Curve Decomposition — Quant Model #68
 *
 * Decomposes yield curve changes into:
 * - Level shift (parallel movement)
 * - Slope change (steepening/flattening)
 * - Curvature change (butterfly)
 *
 * Based on principal component analysis of rate changes.
 * Level typically explains ~85%, slope ~10%, curvature ~5%.
 */
@Injectable()
export class YieldCurveDecompositionService {
  decompose(prevCurve: Array<{ tenor: number; rate: number }>, currCurve: Array<{ tenor: number; rate: number }>): {
    levelShift: number; slopeChange: number; curvatureChange: number;
    tenorChanges: Array<{ tenor: number; prevRate: number; currRate: number; changeBps: number }>;
    dominantFactor: string; dominantFactorEs: string;
    interpretation: string; interpretationEs: string;
  } {
    const changes = prevCurve.map((p, i) => {
      const c = currCurve[i] || p;
      return { tenor: p.tenor, prevRate: p.rate, currRate: c.rate, changeBps: +((c.rate - p.rate) * 10000).toFixed(1) };
    });

    const avgChange = changes.reduce((s, c) => s + c.changeBps, 0) / changes.length;
    const shortChange = changes.filter(c => c.tenor <= 2).reduce((s, c) => s + c.changeBps, 0) / changes.filter(c => c.tenor <= 2).length;
    const longChange = changes.filter(c => c.tenor >= 10).reduce((s, c) => s + c.changeBps, 0) / changes.filter(c => c.tenor >= 10).length;
    const midChange = changes.filter(c => c.tenor >= 3 && c.tenor <= 7).reduce((s, c) => s + c.changeBps, 0) / Math.max(1, changes.filter(c => c.tenor >= 3 && c.tenor <= 7).length);

    const levelShift = +avgChange.toFixed(1);
    const slopeChange = +(longChange - shortChange).toFixed(1);
    const curvatureChange = +(midChange - (shortChange + longChange) / 2).toFixed(1);

    const absLevel = Math.abs(levelShift);
    const absSlope = Math.abs(slopeChange);
    const absCurv = Math.abs(curvatureChange);
    const dominant = absLevel >= absSlope && absLevel >= absCurv ? 'level' : absSlope >= absCurv ? 'slope' : 'curvature';

    return {
      levelShift, slopeChange, curvatureChange, tenorChanges: changes,
      dominantFactor: dominant === 'level' ? 'Parallel shift' : dominant === 'slope' ? 'Slope change' : 'Curvature change',
      dominantFactorEs: dominant === 'level' ? 'Desplazamiento paralelo' : dominant === 'slope' ? 'Cambio pendiente' : 'Cambio curvatura',
      interpretation: `Level: ${levelShift > 0 ? '+' : ''}${levelShift}bps. Slope: ${slopeChange > 0 ? '+' : ''}${slopeChange}bps (${slopeChange > 0 ? 'steepening' : 'flattening'}). Curvature: ${curvatureChange > 0 ? '+' : ''}${curvatureChange}bps. Dominant: ${dominant}.`,
      interpretationEs: `Nivel: ${levelShift > 0 ? '+' : ''}${levelShift}pbs. Pendiente: ${slopeChange > 0 ? '+' : ''}${slopeChange}pbs (${slopeChange > 0 ? 'empinamiento' : 'aplanamiento'}). Curvatura: ${curvatureChange > 0 ? '+' : ''}${curvatureChange}pbs. Dominante: ${dominant === 'level' ? 'nivel' : dominant === 'slope' ? 'pendiente' : 'curvatura'}.`,
    };
  }
}
