import { Injectable, Logger } from '@nestjs/common';

/**
 * Daily P&L Attribution Service
 *
 * Decomposes daily Net Interest Income changes into rate, volume, mix,
 * and spread effects using standard DuPont-style decomposition.
 *
 * Every morning the CFO asks: "Where did we make or lose money yesterday?"
 * This service answers that question before the 7am ALCO meeting.
 *
 * Math (per instrument):
 *   ΔIncome = (B₁×R₁) − (B₀×R₀)
 *   Rate Effect   = B₀ × (R₁ − R₀) × period_fraction
 *   Volume Effect = R₀ × (B₁ − B₀) × period_fraction
 *   Mix Effect    = (B₁ − B₀) × (R₁ − R₀) × period_fraction  (interaction term)
 *   Spread Effect = B₀ × (Δspread_current − Δspread_prior) × period_fraction
 */

// ─── Types ───────────────────────────────────────────────────

export interface BalanceSheetPosition {
  name: string;
  balance: number;
  rate: number;
  category: string;
}

export interface PeriodSnapshot {
  assets: BalanceSheetPosition[];
  liabilities: BalanceSheetPosition[];
  benchmarkRate: number;
}

export interface DailyPnLAttributionParams {
  prior: PeriodSnapshot;
  current: PeriodSnapshot;
  period: 'daily' | 'monthly' | 'quarterly';
}

export interface CategoryBreakdown {
  category: string;
  priorBalance: number;
  currentBalance: number;
  priorRate: number;
  currentRate: number;
  priorIncome: number;
  currentIncome: number;
  change: number;
  rateContribution: number;
  volumeContribution: number;
}

export interface TopDriver {
  name: string;
  impact: number;
  driver: 'rate' | 'volume' | 'mix';
  direction: 'positive' | 'negative';
}

export interface PnLAttribution {
  rateEffect: number;
  volumeEffect: number;
  mixEffect: number;
  spreadEffect: number;
}

export interface DailyPnLAttributionResult {
  totalNIIChange: number;
  priorNII: number;
  currentNII: number;
  attribution: PnLAttribution;
  byCategory: CategoryBreakdown[];
  topDrivers: TopDriver[];
  summary: string;
}

export interface DailySummaryResult {
  en: string;
  es: string;
  materialChanges: { category: string; pctChange: number }[];
}

// ─── Period Fraction Constants ───────────────────────────────

const PERIOD_FRACTION: Record<string, number> = {
  daily: 1 / 365,
  monthly: 1 / 12,
  quarterly: 1 / 4,
};

// ─── Service ─────────────────────────────────────────────────

@Injectable()
export class DailyPnLAttributionService {
  private readonly logger = new Logger(DailyPnLAttributionService.name);

  /**
   * Decompose P&L change into rate, volume, mix, and spread effects.
   */
  attributePnL(params: DailyPnLAttributionParams): DailyPnLAttributionResult {
    const { prior, current, period } = params;
    const pf = PERIOD_FRACTION[period] ?? PERIOD_FRACTION.daily;

    // ── Compute NII for each period ────────────────────────
    const priorNII = this.computeNII(prior);
    const currentNII = this.computeNII(current);
    const totalNIIChange = currentNII - priorNII;

    // ── Instrument-level decomposition ─────────────────────
    // Merge all instruments (assets contribute positive income, liabilities negative)
    const priorInstruments = this.normalizeInstruments(prior);
    const currentInstruments = this.normalizeInstruments(current);

    // Build a universe of all instrument names
    const allNames = new Set([
      ...priorInstruments.map((i) => i.name),
      ...currentInstruments.map((i) => i.name),
    ]);

    let totalRateEffect = 0;
    let totalVolumeEffect = 0;
    let totalMixEffect = 0;
    let totalSpreadEffect = 0;

    const instrumentDrivers: {
      name: string;
      rateEffect: number;
      volumeEffect: number;
      mixEffect: number;
      category: string;
    }[] = [];

    for (const name of allNames) {
      const p = priorInstruments.find((i) => i.name === name);
      const c = currentInstruments.find((i) => i.name === name);

      const b0 = p?.balance ?? 0;
      const r0 = p?.rate ?? 0;
      const b1 = c?.balance ?? 0;
      const r1 = c?.rate ?? 0;
      const sign = (p?.sign ?? c?.sign) as number;

      const deltaRate = r1 - r0;
      const deltaBalance = b1 - b0;

      const rateEff = b0 * deltaRate * pf * sign;
      const volEff = r0 * deltaBalance * pf * sign;
      const mixEff = deltaBalance * deltaRate * pf * sign;

      totalRateEffect += rateEff;
      totalVolumeEffect += volEff;
      totalMixEffect += mixEff;

      instrumentDrivers.push({
        name,
        rateEffect: rateEff,
        volumeEffect: volEff,
        mixEffect: mixEff,
        category: (p?.category ?? c?.category) as string,
      });
    }

    // ── Spread effect (benchmark-relative) ─────────────────
    // For each asset: spread = asset_rate - benchmark
    // Spread effect = Σ B₀ × (spread_current - spread_prior) × pf
    for (const name of allNames) {
      const p = priorInstruments.find((i) => i.name === name);
      const c = currentInstruments.find((i) => i.name === name);

      if (!p || !c) continue; // need both periods for spread comparison

      const priorSpread = p.rate - prior.benchmarkRate;
      const currentSpread = c.rate - current.benchmarkRate;
      const spreadChange = (currentSpread - priorSpread) * p.balance * pf * p.sign;
      totalSpreadEffect += spreadChange;
    }

    // ── Category breakdown ─────────────────────────────────
    const categoryMap = new Map<
      string,
      {
        priorBalance: number;
        currentBalance: number;
        priorWeightedRate: number;
        currentWeightedRate: number;
        priorIncome: number;
        currentIncome: number;
        rateContribution: number;
        volumeContribution: number;
      }
    >();

    for (const d of instrumentDrivers) {
      const p = priorInstruments.find((i) => i.name === d.name);
      const c = currentInstruments.find((i) => i.name === d.name);

      const cat = d.category;
      if (!categoryMap.has(cat)) {
        categoryMap.set(cat, {
          priorBalance: 0,
          currentBalance: 0,
          priorWeightedRate: 0,
          currentWeightedRate: 0,
          priorIncome: 0,
          currentIncome: 0,
          rateContribution: 0,
          volumeContribution: 0,
        });
      }

      const entry = categoryMap.get(cat)!;
      const b0 = p?.balance ?? 0;
      const r0 = p?.rate ?? 0;
      const b1 = c?.balance ?? 0;
      const r1 = c?.rate ?? 0;
      const sign = (p?.sign ?? c?.sign) as number;

      entry.priorBalance += b0;
      entry.currentBalance += b1;
      entry.priorWeightedRate += b0 * r0;
      entry.currentWeightedRate += b1 * r1;
      entry.priorIncome += b0 * r0 * pf * sign;
      entry.currentIncome += b1 * r1 * pf * sign;
      entry.rateContribution += d.rateEffect;
      entry.volumeContribution += d.volumeEffect;
    }

    const byCategory: CategoryBreakdown[] = [];
    for (const [category, v] of categoryMap) {
      const priorRate =
        v.priorBalance > 0 ? v.priorWeightedRate / v.priorBalance : 0;
      const currentRate =
        v.currentBalance > 0 ? v.currentWeightedRate / v.currentBalance : 0;
      byCategory.push({
        category,
        priorBalance: v.priorBalance,
        currentBalance: v.currentBalance,
        priorRate: +priorRate.toFixed(6),
        currentRate: +currentRate.toFixed(6),
        priorIncome: +v.priorIncome.toFixed(2),
        currentIncome: +v.currentIncome.toFixed(2),
        change: +(v.currentIncome - v.priorIncome).toFixed(2),
        rateContribution: +v.rateContribution.toFixed(2),
        volumeContribution: +v.volumeContribution.toFixed(2),
      });
    }

    // ── Top drivers (sorted by |impact|) ───────────────────
    const topDrivers: TopDriver[] = instrumentDrivers
      .flatMap((d) => {
        const drivers: TopDriver[] = [];
        if (Math.abs(d.rateEffect) > 1e-10) {
          drivers.push({
            name: d.name,
            impact: +d.rateEffect.toFixed(2),
            driver: 'rate' as const,
            direction: d.rateEffect >= 0 ? 'positive' : 'negative',
          });
        }
        if (Math.abs(d.volumeEffect) > 1e-10) {
          drivers.push({
            name: d.name,
            impact: +d.volumeEffect.toFixed(2),
            driver: 'volume' as const,
            direction: d.volumeEffect >= 0 ? 'positive' : 'negative',
          });
        }
        if (Math.abs(d.mixEffect) > 1e-10) {
          drivers.push({
            name: d.name,
            impact: +d.mixEffect.toFixed(2),
            driver: 'mix' as const,
            direction: d.mixEffect >= 0 ? 'positive' : 'negative',
          });
        }
        return drivers;
      })
      .sort((a, b) => Math.abs(b.impact) - Math.abs(a.impact));

    // ── Summary narrative ──────────────────────────────────
    const summary = this.buildSummary(totalNIIChange, topDrivers);

    return {
      totalNIIChange: +totalNIIChange.toFixed(2),
      priorNII: +priorNII.toFixed(2),
      currentNII: +currentNII.toFixed(2),
      attribution: {
        rateEffect: +totalRateEffect.toFixed(2),
        volumeEffect: +totalVolumeEffect.toFixed(2),
        mixEffect: +totalMixEffect.toFixed(2),
        spreadEffect: +totalSpreadEffect.toFixed(2),
      },
      byCategory,
      topDrivers,
      summary,
    };
  }

  /**
   * Generate a bilingual (EN/ES) executive summary for the CFO.
   */
  generateDailySummary(params: DailyPnLAttributionParams): DailySummaryResult {
    const result = this.attributePnL(params);
    const top3 = result.topDrivers.slice(0, 3);

    // ── Detect material changes (>10% income change) ──────
    const materialChanges: { category: string; pctChange: number }[] = [];
    for (const cat of result.byCategory) {
      if (cat.priorIncome === 0) {
        if (cat.currentIncome !== 0) {
          materialChanges.push({ category: cat.category, pctChange: 100 });
        }
        continue;
      }
      const pctChange = Math.abs(cat.change / cat.priorIncome) * 100;
      if (pctChange > 10) {
        materialChanges.push({
          category: cat.category,
          pctChange: +pctChange.toFixed(1),
        });
      }
    }

    // ── English summary ───────────────────────────────────
    const direction = result.totalNIIChange >= 0 ? 'increased' : 'decreased';
    const amount = this.formatDollars(Math.abs(result.totalNIIChange));

    let en = `Daily P&L Summary: NII ${direction} ${amount}.`;
    if (top3.length > 0) {
      en += ' Top drivers:';
      for (const d of top3) {
        const sign = d.direction === 'positive' ? '+' : '-';
        en += ` ${d.name} (${d.driver}, ${sign}${this.formatDollars(Math.abs(d.impact))});`;
      }
    }
    if (materialChanges.length > 0) {
      en += ' MATERIAL CHANGES:';
      for (const m of materialChanges) {
        en += ` ${m.category} (${m.pctChange.toFixed(1)}% change);`;
      }
    }

    // ── Spanish summary ───────────────────────────────────
    const directionEs =
      result.totalNIIChange >= 0 ? 'aumentó' : 'disminuyó';
    let es = `Resumen Diario de P&L: El ingreso neto por intereses ${directionEs} ${amount}.`;
    if (top3.length > 0) {
      es += ' Principales factores:';
      const driverEs: Record<string, string> = {
        rate: 'tasa',
        volume: 'volumen',
        mix: 'mezcla',
      };
      for (const d of top3) {
        const sign = d.direction === 'positive' ? '+' : '-';
        es += ` ${d.name} (${driverEs[d.driver] ?? d.driver}, ${sign}${this.formatDollars(Math.abs(d.impact))});`;
      }
    }
    if (materialChanges.length > 0) {
      es += ' CAMBIOS MATERIALES:';
      for (const m of materialChanges) {
        es += ` ${m.category} (${m.pctChange.toFixed(1)}% cambio);`;
      }
    }

    return { en, es, materialChanges };
  }

  // ─── Private Helpers ─────────────────────────────────────

  private computeNII(snapshot: PeriodSnapshot): number {
    const assetIncome = snapshot.assets.reduce(
      (sum, a) => sum + a.balance * a.rate,
      0,
    );
    const liabilityCost = snapshot.liabilities.reduce(
      (sum, l) => sum + l.balance * l.rate,
      0,
    );
    return assetIncome - liabilityCost;
  }

  private normalizeInstruments(
    snapshot: PeriodSnapshot,
  ): (BalanceSheetPosition & { sign: number })[] {
    const assets = snapshot.assets.map((a) => ({ ...a, sign: 1 }));
    const liabilities = snapshot.liabilities.map((l) => ({ ...l, sign: -1 }));
    return [...assets, ...liabilities];
  }

  private buildSummary(totalNIIChange: number, drivers: TopDriver[]): string {
    const direction = totalNIIChange >= 0 ? 'increased' : 'decreased';
    const amount = this.formatDollars(Math.abs(totalNIIChange));

    if (drivers.length === 0) {
      return `NII ${direction} ${amount} with no significant individual drivers.`;
    }

    const top = drivers.slice(0, 3);
    const positiveDrivers = top.filter((d) => d.direction === 'positive');
    const negativeDrivers = top.filter((d) => d.direction === 'negative');

    let summary = `NII ${direction} ${amount}`;

    if (positiveDrivers.length > 0) {
      const posDesc = positiveDrivers
        .map(
          (d) =>
            `${d.driver} ${d.driver === 'rate' ? 'increases' : d.driver === 'volume' ? 'growth' : 'shifts'} on ${d.name} (+${this.formatDollars(Math.abs(d.impact))})`,
        )
        .join(', ');
      summary += ` driven primarily by ${posDesc}`;
    }

    if (negativeDrivers.length > 0) {
      const negDesc = negativeDrivers
        .map(
          (d) =>
            `${d.name} ${d.driver} (-${this.formatDollars(Math.abs(d.impact))})`,
        )
        .join(', ');
      summary += positiveDrivers.length > 0
        ? `, partially offset by ${negDesc}`
        : ` driven by ${negDesc}`;
    }

    return summary;
  }

  private formatDollars(value: number): string {
    if (value >= 1_000_000) {
      return `$${(value / 1_000_000).toFixed(1)}M`;
    }
    if (value >= 1_000) {
      return `$${(value / 1_000).toFixed(0)}K`;
    }
    return `$${value.toFixed(2)}`;
  }
}
