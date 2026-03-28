import { Injectable } from '@nestjs/common';
/** Comprehensive ALM Score — Quant Model #140. Single composite score (0-100) across all ALM dimensions. MILESTONE. */
@Injectable()
export class ComprehensiveALMScoreService {
  calculate(params: { nim: number; lcr: number; nsfr: number; capitalRatio: number; durationGap: number; camelScore: number; earPct: number; concentrationHHI: number }): {
    score: number; grade: 'A' | 'B' | 'C' | 'D' | 'F'; dimensions: Array<{ name: string; nameEs: string; score: number; weight: number }>;
    interpretation: string; interpretationEs: string;
  } {
    const d = [
      { name: 'NIM', nameEs: 'NIM', score: Math.min(100, params.nim / 0.04 * 100), weight: 15 },
      { name: 'LCR', nameEs: 'LCR', score: Math.min(100, params.lcr), weight: 15 },
      { name: 'NSFR', nameEs: 'NSFR', score: Math.min(100, params.nsfr), weight: 10 },
      { name: 'Capital', nameEs: 'Capital', score: Math.min(100, params.capitalRatio / 10 * 100), weight: 20 },
      { name: 'Duration', nameEs: 'Duracion', score: Math.max(0, 100 - Math.abs(params.durationGap) * 20), weight: 15 },
      { name: 'CAMEL', nameEs: 'CAMEL', score: Math.max(0, (6 - params.camelScore) / 5 * 100), weight: 15 },
      { name: 'EaR', nameEs: 'GaR', score: Math.max(0, 100 - params.earPct * 10), weight: 5 },
      { name: 'Diversification', nameEs: 'Diversificacion', score: Math.max(0, 100 - params.concentrationHHI / 100), weight: 5 },
    ];
    const score = Math.round(d.reduce((s, dim) => s + dim.score * dim.weight, 0) / d.reduce((s, dim) => s + dim.weight, 0));
    const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : score >= 40 ? 'D' : 'F';
    return { score, grade, dimensions: d,
      interpretation: `ALM Score: ${score}/100 (Grade ${grade}). ${grade <= 'B' ? 'Strong position.' : 'Improvement needed.'}`,
      interpretationEs: `Puntaje ALM: ${score}/100 (Grado ${grade}). ${grade <= 'B' ? 'Posicion fuerte.' : 'Mejora necesaria.'}` };
  }
}
