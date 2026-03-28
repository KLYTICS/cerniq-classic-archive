import { Injectable, Logger } from '@nestjs/common';

// ── Interfaces ──────────────────────────────────────────────────────────

export interface BalanceSheetInstrument {
  name: string;
  balance: number;
  rate: number;
  maturityYears: number;
  category: string;
  isFloating: boolean;
  repricingMonths?: number;
}

export interface BalanceSheetInput {
  assets: BalanceSheetInstrument[];
  liabilities: BalanceSheetInstrument[];
  equity: number;
  asOfDate: string;
  institutionName: string;
}

export interface DataQualityIssue {
  severity: 'critical' | 'warning' | 'info';
  field: string;
  instrument: string;
  rule: string;
  message: string;
  messageEs: string;
  suggestion: string;
}

export interface CheckResult {
  score: number;
  issues: string[];
}

export interface DataQualityResult {
  overallScore: number;
  grade: 'A' | 'B' | 'C' | 'D' | 'F';
  passesMinimumQuality: boolean;
  totalIssues: number;
  critical: DataQualityIssue[];
  warnings: DataQualityIssue[];
  info: DataQualityIssue[];
  checks: {
    completeness: CheckResult;
    consistency: CheckResult;
    plausibility: CheckResult;
    timeliness: CheckResult;
  };
}

export interface QuickCheckResult {
  pass: boolean;
  criticalIssues: DataQualityIssue[];
}

// ── Service ─────────────────────────────────────────────────────────────

@Injectable()
export class DataQualityMonitorService {
  private readonly logger = new Logger(DataQualityMonitorService.name);

  /**
   * Full validation of a balance sheet before ALM calculations.
   * Returns a quality score (0-100), grade, and actionable fix list.
   */
  validateBalanceSheet(params: BalanceSheetInput): DataQualityResult {
    const criticals: DataQualityIssue[] = [];
    const warnings: DataQualityIssue[] = [];
    const infos: DataQualityIssue[] = [];

    const completeness = this.checkCompleteness(params, criticals, warnings, infos);
    const consistency = this.checkConsistency(params, criticals, warnings, infos);
    const plausibility = this.checkPlausibility(params, criticals, warnings, infos);
    const timeliness = this.checkTimeliness(params, criticals, warnings, infos);

    const overallScore = Math.round(
      completeness.score * 0.25 +
      consistency.score * 0.25 +
      plausibility.score * 0.25 +
      timeliness.score * 0.25,
    );

    const grade = this.scoreToGrade(overallScore);
    const totalIssues = criticals.length + warnings.length + infos.length;

    this.logger.log(
      `Data quality check for "${params.institutionName}": score=${overallScore} grade=${grade} issues=${totalIssues}`,
    );

    return {
      overallScore,
      grade,
      passesMinimumQuality: overallScore >= 60,
      totalIssues,
      critical: criticals,
      warnings,
      info: infos,
      checks: {
        completeness,
        consistency,
        plausibility,
        timeliness,
      },
    };
  }

  /**
   * Lightweight gate check — returns pass/fail + critical issues only.
   * Use before running ALM calculations.
   */
  quickCheck(params: BalanceSheetInput): QuickCheckResult {
    const criticals: DataQualityIssue[] = [];
    const noop: DataQualityIssue[] = [];

    this.checkCompleteness(params, criticals, noop, noop);
    this.checkConsistency(params, criticals, noop, noop);
    this.checkPlausibility(params, criticals, noop, noop);
    this.checkTimeliness(params, criticals, noop, noop);

    return {
      pass: criticals.length === 0,
      criticalIssues: criticals,
    };
  }

  // ── Completeness (25%) ──────────────────────────────────────────────

  private checkCompleteness(
    params: BalanceSheetInput,
    criticals: DataQualityIssue[],
    warnings: DataQualityIssue[],
    infos: DataQualityIssue[],
  ): CheckResult {
    const issues: string[] = [];
    let deductions = 0;

    // At least 1 asset
    if (!params.assets || params.assets.length === 0) {
      const msg = 'No assets provided';
      issues.push(msg);
      deductions += 30;
      criticals.push(this.issue('critical', 'assets', '', 'MIN_ASSETS',
        msg,
        'No se proporcionaron activos',
        'Add at least one asset instrument to the balance sheet.',
      ));
    }

    // At least 1 liability
    if (!params.liabilities || params.liabilities.length === 0) {
      const msg = 'No liabilities provided';
      issues.push(msg);
      deductions += 30;
      criticals.push(this.issue('critical', 'liabilities', '', 'MIN_LIABILITIES',
        msg,
        'No se proporcionaron pasivos',
        'Add at least one liability instrument to the balance sheet.',
      ));
    }

    // Every instrument must have name, balance, rate, maturity
    const allInstruments = [
      ...(params.assets || []).map((a) => ({ ...a, side: 'asset' })),
      ...(params.liabilities || []).map((l) => ({ ...l, side: 'liability' })),
    ];

    for (const inst of allInstruments) {
      if (!inst.name || inst.name.trim() === '') {
        const msg = `${inst.side} instrument missing name`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'name', inst.name || '(unnamed)', 'MISSING_NAME',
          msg,
          `Instrumento de ${inst.side === 'asset' ? 'activo' : 'pasivo'} sin nombre`,
          'Provide a descriptive name for each instrument.',
        ));
      }
      if (inst.balance === undefined || inst.balance === null) {
        const msg = `${inst.name || '(unnamed)'}: missing balance`;
        issues.push(msg);
        deductions += 10;
        criticals.push(this.issue('critical', 'balance', inst.name || '(unnamed)', 'MISSING_BALANCE',
          msg,
          `${inst.name || '(sin nombre)'}: falta el saldo`,
          'Every instrument must have a balance value.',
        ));
      }
      if (inst.rate === undefined || inst.rate === null) {
        const msg = `${inst.name || '(unnamed)'}: missing rate`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'rate', inst.name || '(unnamed)', 'MISSING_RATE',
          msg,
          `${inst.name || '(sin nombre)'}: falta la tasa`,
          'Provide an interest rate for each instrument.',
        ));
      }
      if (inst.maturityYears === undefined || inst.maturityYears === null) {
        const msg = `${inst.name || '(unnamed)'}: missing maturity`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'maturityYears', inst.name || '(unnamed)', 'MISSING_MATURITY',
          msg,
          `${inst.name || '(sin nombre)'}: falta el vencimiento`,
          'Provide a maturity in years for each instrument.',
        ));
      }
    }

    // Equity provided and non-zero
    if (params.equity === undefined || params.equity === null) {
      const msg = 'Equity not provided';
      issues.push(msg);
      deductions += 20;
      criticals.push(this.issue('critical', 'equity', '', 'MISSING_EQUITY',
        msg,
        'No se proporcionó el capital',
        'Provide the institution equity/capital value.',
      ));
    } else if (params.equity === 0) {
      const msg = 'Equity is zero';
      issues.push(msg);
      deductions += 15;
      criticals.push(this.issue('critical', 'equity', '', 'ZERO_EQUITY',
        msg,
        'El capital es cero',
        'Equity of zero indicates data error or insolvency — verify.',
      ));
    }

    // Balance sheet equation: assets ≈ liabilities + equity (±5%)
    const totalAssets = (params.assets || []).reduce((s, a) => s + (a.balance || 0), 0);
    const totalLiabilities = (params.liabilities || []).reduce((s, l) => s + (l.balance || 0), 0);
    const rightSide = totalLiabilities + (params.equity || 0);

    if (totalAssets > 0 && rightSide > 0) {
      const diff = Math.abs(totalAssets - rightSide);
      const tolerance = totalAssets * 0.05;
      if (diff > tolerance) {
        const pct = ((diff / totalAssets) * 100).toFixed(1);
        const msg = `Balance sheet does not balance: assets=${totalAssets.toLocaleString()}, liabilities+equity=${rightSide.toLocaleString()} (${pct}% gap)`;
        issues.push(msg);
        deductions += 15;
        warnings.push(this.issue('warning', 'balanceEquation', '', 'BS_IMBALANCE',
          msg,
          `El balance general no cuadra: activos=${totalAssets.toLocaleString()}, pasivos+capital=${rightSide.toLocaleString()} (${pct}% diferencia)`,
          'Verify total assets equal total liabilities plus equity within 5%.',
        ));
      }
    }

    return { score: Math.max(0, 100 - deductions), issues };
  }

  // ── Consistency (25%) ───────────────────────────────────────────────

  private checkConsistency(
    params: BalanceSheetInput,
    criticals: DataQualityIssue[],
    warnings: DataQualityIssue[],
    infos: DataQualityIssue[],
  ): CheckResult {
    const issues: string[] = [];
    let deductions = 0;

    const allInstruments = [
      ...(params.assets || []).map((a) => ({ ...a, side: 'asset' as const })),
      ...(params.liabilities || []).map((l) => ({ ...l, side: 'liability' as const })),
    ];

    for (const inst of allInstruments) {
      // No negative balances
      if (inst.balance !== undefined && inst.balance !== null && inst.balance < 0) {
        const msg = `${inst.name}: negative balance (${inst.balance})`;
        issues.push(msg);
        deductions += 15;
        criticals.push(this.issue('critical', 'balance', inst.name, 'NEGATIVE_BALANCE',
          msg,
          `${inst.name}: saldo negativo (${inst.balance})`,
          'Balance values should be positive. Check sign convention.',
        ));
      }

      // No negative rates (except liabilities in negative-rate environments)
      if (inst.rate !== undefined && inst.rate !== null && inst.rate < 0) {
        if (inst.side === 'asset') {
          const msg = `${inst.name}: negative asset rate (${(inst.rate * 100).toFixed(2)}%)`;
          issues.push(msg);
          deductions += 10;
          criticals.push(this.issue('critical', 'rate', inst.name, 'NEGATIVE_ASSET_RATE',
            msg,
            `${inst.name}: tasa de activo negativa (${(inst.rate * 100).toFixed(2)}%)`,
            'Asset rates should not be negative. Verify the rate sign.',
          ));
        } else if (inst.rate < -0.01) {
          // Liabilities below -1% are suspicious even in negative-rate environments
          const msg = `${inst.name}: extremely negative liability rate (${(inst.rate * 100).toFixed(2)}%)`;
          issues.push(msg);
          deductions += 5;
          warnings.push(this.issue('warning', 'rate', inst.name, 'EXTREME_NEGATIVE_RATE',
            msg,
            `${inst.name}: tasa de pasivo extremadamente negativa (${(inst.rate * 100).toFixed(2)}%)`,
            'Verify this rate — even negative-rate environments rarely go below -1%.',
          ));
        }
      }

      // No negative maturities
      if (inst.maturityYears !== undefined && inst.maturityYears !== null && inst.maturityYears < 0) {
        const msg = `${inst.name}: negative maturity (${inst.maturityYears} years)`;
        issues.push(msg);
        deductions += 10;
        criticals.push(this.issue('critical', 'maturityYears', inst.name, 'NEGATIVE_MATURITY',
          msg,
          `${inst.name}: vencimiento negativo (${inst.maturityYears} años)`,
          'Maturity must be zero or positive. Check for data entry errors.',
        ));
      }

      // Floating instruments: repricingMonths between 0 and 60
      if (inst.isFloating && inst.repricingMonths !== undefined && inst.repricingMonths !== null) {
        if (inst.repricingMonths < 0 || inst.repricingMonths > 60) {
          const msg = `${inst.name}: repricing period out of range (${inst.repricingMonths} months)`;
          issues.push(msg);
          deductions += 5;
          warnings.push(this.issue('warning', 'repricingMonths', inst.name, 'REPRICING_OUT_OF_RANGE',
            msg,
            `${inst.name}: periodo de reprecio fuera de rango (${inst.repricingMonths} meses)`,
            'Floating repricing period should be 0-60 months.',
          ));
        }
      }
    }

    // Sum of asset categories > 0
    const totalAssets = (params.assets || []).reduce((s, a) => s + (a.balance || 0), 0);
    if ((params.assets || []).length > 0 && totalAssets <= 0) {
      const msg = 'Total asset balance is zero or negative';
      issues.push(msg);
      deductions += 10;
      criticals.push(this.issue('critical', 'assets.total', '', 'ZERO_TOTAL_ASSETS',
        msg,
        'El saldo total de activos es cero o negativo',
        'Sum of asset balances must be positive.',
      ));
    }

    // Sum of liability categories > 0
    const totalLiabilities = (params.liabilities || []).reduce((s, l) => s + (l.balance || 0), 0);
    if ((params.liabilities || []).length > 0 && totalLiabilities <= 0) {
      const msg = 'Total liability balance is zero or negative';
      issues.push(msg);
      deductions += 10;
      criticals.push(this.issue('critical', 'liabilities.total', '', 'ZERO_TOTAL_LIABILITIES',
        msg,
        'El saldo total de pasivos es cero o negativo',
        'Sum of liability balances must be positive.',
      ));
    }

    return { score: Math.max(0, 100 - deductions), issues };
  }

  // ── Plausibility (25%) ──────────────────────────────────────────────

  private checkPlausibility(
    params: BalanceSheetInput,
    criticals: DataQualityIssue[],
    warnings: DataQualityIssue[],
    infos: DataQualityIssue[],
  ): CheckResult {
    const issues: string[] = [];
    let deductions = 0;

    // Asset rate plausibility: 0-20%
    for (const asset of params.assets || []) {
      if (asset.rate !== undefined && asset.rate !== null && asset.rate > 0.20) {
        const msg = `${asset.name}: asset rate ${(asset.rate * 100).toFixed(2)}% exceeds 20% — likely data error`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'rate', asset.name, 'HIGH_ASSET_RATE',
          msg,
          `${asset.name}: tasa de activo ${(asset.rate * 100).toFixed(2)}% excede 20% — posible error de datos`,
          'Verify this rate. Most bank assets yield between 0% and 20%.',
        ));
      }
    }

    // Liability rate plausibility: -1% to 15%
    for (const liab of params.liabilities || []) {
      if (liab.rate !== undefined && liab.rate !== null && liab.rate > 0.15) {
        const msg = `${liab.name}: liability rate ${(liab.rate * 100).toFixed(2)}% exceeds 15%`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'rate', liab.name, 'HIGH_LIABILITY_RATE',
          msg,
          `${liab.name}: tasa de pasivo ${(liab.rate * 100).toFixed(2)}% excede 15%`,
          'Verify this funding cost. Most liabilities cost less than 15%.',
        ));
      }
    }

    // Maturity plausibility: < 40 years, flag 30+
    const allInstruments = [
      ...(params.assets || []),
      ...(params.liabilities || []),
    ];
    for (const inst of allInstruments) {
      if (inst.maturityYears !== undefined && inst.maturityYears !== null) {
        if (inst.maturityYears > 40) {
          const msg = `${inst.name}: maturity ${inst.maturityYears} years exceeds 40 years`;
          issues.push(msg);
          deductions += 5;
          warnings.push(this.issue('warning', 'maturityYears', inst.name, 'EXTREME_MATURITY',
            msg,
            `${inst.name}: vencimiento de ${inst.maturityYears} años excede 40 años`,
            'Maturities over 40 years are rare. Verify this is correct.',
          ));
        } else if (inst.maturityYears > 30) {
          const msg = `${inst.name}: long maturity of ${inst.maturityYears} years`;
          issues.push(msg);
          infos.push(this.issue('info', 'maturityYears', inst.name, 'LONG_MATURITY',
            msg,
            `${inst.name}: vencimiento largo de ${inst.maturityYears} años`,
            'Maturities over 30 years warrant extra review.',
          ));
        }
      }
    }

    // Duration gap plausibility: |gap| < 10 years
    const assetDuration = this.weightedAvgMaturity(params.assets || []);
    const liabilityDuration = this.weightedAvgMaturity(params.liabilities || []);
    if (assetDuration !== null && liabilityDuration !== null) {
      const durationGap = Math.abs(assetDuration - liabilityDuration);
      if (durationGap > 10) {
        const msg = `Duration gap of ${durationGap.toFixed(2)} years is extreme (|gap| > 10)`;
        issues.push(msg);
        deductions += 10;
        warnings.push(this.issue('warning', 'durationGap', '', 'EXTREME_DURATION_GAP',
          msg,
          `Brecha de duración de ${durationGap.toFixed(2)} años es extrema (|brecha| > 10)`,
          'A duration gap exceeding 10 years indicates significant interest rate risk.',
        ));
      }
    }

    // Total assets between $1M and $100B (cooperativa range)
    const totalAssets = (params.assets || []).reduce((s, a) => s + (a.balance || 0), 0);
    if (totalAssets > 0) {
      if (totalAssets < 1_000_000) {
        const msg = `Total assets $${totalAssets.toLocaleString()} below $1M — unusual for a financial institution`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'totalAssets', '', 'LOW_TOTAL_ASSETS',
          msg,
          `Activos totales $${totalAssets.toLocaleString()} por debajo de $1M — inusual para una institución financiera`,
          'Verify balances are in dollars, not thousands or millions.',
        ));
      } else if (totalAssets > 100_000_000_000) {
        const msg = `Total assets $${totalAssets.toLocaleString()} exceed $100B — verify units`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'totalAssets', '', 'HIGH_TOTAL_ASSETS',
          msg,
          `Activos totales $${totalAssets.toLocaleString()} exceden $100B — verifique las unidades`,
          'Verify balances are in dollars, not cents or some other unit.',
        ));
      }
    }

    // NIM plausibility: 0.5% to 8%
    const totalLiabilities = (params.liabilities || []).reduce((s, l) => s + (l.balance || 0), 0);
    if (totalAssets > 0 && totalLiabilities > 0) {
      const weightedAssetRate = this.weightedAvgRate(params.assets || []);
      const weightedLiabRate = this.weightedAvgRate(params.liabilities || []);
      if (weightedAssetRate !== null && weightedLiabRate !== null) {
        const impliedNIM = weightedAssetRate - weightedLiabRate;
        if (impliedNIM < 0.005) {
          const msg = `Implied NIM of ${(impliedNIM * 100).toFixed(2)}% is below 0.5%`;
          issues.push(msg);
          deductions += 5;
          warnings.push(this.issue('warning', 'nim', '', 'LOW_NIM',
            msg,
            `NIM implícito de ${(impliedNIM * 100).toFixed(2)}% está por debajo de 0.5%`,
            'A NIM below 0.5% is unusual — verify asset yields and funding costs.',
          ));
        } else if (impliedNIM > 0.08) {
          const msg = `Implied NIM of ${(impliedNIM * 100).toFixed(2)}% exceeds 8%`;
          issues.push(msg);
          deductions += 5;
          warnings.push(this.issue('warning', 'nim', '', 'HIGH_NIM',
            msg,
            `NIM implícito de ${(impliedNIM * 100).toFixed(2)}% excede 8%`,
            'A NIM above 8% is unusual — verify rates are entered correctly.',
          ));
        }
      }
    }

    // Leverage ratio (L/A) between 0.5 and 0.98
    if (totalAssets > 0 && totalLiabilities > 0) {
      const leverage = totalLiabilities / totalAssets;
      if (leverage < 0.5) {
        const msg = `Leverage ratio ${(leverage * 100).toFixed(1)}% is below 50% — unusual capital structure`;
        issues.push(msg);
        deductions += 5;
        warnings.push(this.issue('warning', 'leverageRatio', '', 'LOW_LEVERAGE',
          msg,
          `Ratio de apalancamiento ${(leverage * 100).toFixed(1)}% está por debajo de 50% — estructura de capital inusual`,
          'Most financial institutions have leverage ratios between 50% and 98%.',
        ));
      } else if (leverage > 0.98) {
        const msg = `Leverage ratio ${(leverage * 100).toFixed(1)}% exceeds 98% — critically thin capital`;
        issues.push(msg);
        deductions += 10;
        warnings.push(this.issue('warning', 'leverageRatio', '', 'HIGH_LEVERAGE',
          msg,
          `Ratio de apalancamiento ${(leverage * 100).toFixed(1)}% excede 98% — capital críticamente delgado`,
          'Leverage above 98% signals potential capital inadequacy.',
        ));
      }
    }

    return { score: Math.max(0, 100 - deductions), issues };
  }

  // ── Timeliness (25%) ────────────────────────────────────────────────

  private checkTimeliness(
    params: BalanceSheetInput,
    criticals: DataQualityIssue[],
    warnings: DataQualityIssue[],
    infos: DataQualityIssue[],
  ): CheckResult {
    const issues: string[] = [];
    let deductions = 0;

    if (!params.asOfDate) {
      const msg = 'No asOfDate provided';
      issues.push(msg);
      deductions += 30;
      criticals.push(this.issue('critical', 'asOfDate', '', 'MISSING_DATE',
        msg,
        'No se proporcionó la fecha del balance',
        'Provide the as-of date for the balance sheet data.',
      ));
      return { score: Math.max(0, 100 - deductions), issues };
    }

    const asOf = new Date(params.asOfDate);
    const now = new Date();

    if (isNaN(asOf.getTime())) {
      const msg = `Invalid asOfDate: "${params.asOfDate}"`;
      issues.push(msg);
      deductions += 30;
      criticals.push(this.issue('critical', 'asOfDate', '', 'INVALID_DATE',
        msg,
        `Fecha inválida: "${params.asOfDate}"`,
        'Provide a valid date in ISO format (YYYY-MM-DD).',
      ));
      return { score: Math.max(0, 100 - deductions), issues };
    }

    // Future date
    if (asOf > now) {
      const msg = `asOfDate ${params.asOfDate} is in the future`;
      issues.push(msg);
      deductions += 30;
      criticals.push(this.issue('critical', 'asOfDate', '', 'FUTURE_DATE',
        msg,
        `La fecha ${params.asOfDate} está en el futuro`,
        'Balance sheet date should not be in the future.',
      ));
    }

    // Staleness
    const daysDiff = Math.floor((now.getTime() - asOf.getTime()) / (1000 * 60 * 60 * 24));

    if (daysDiff > 90) {
      const msg = `Data is ${daysDiff} days old (>90 days) — stale for regulatory reporting`;
      issues.push(msg);
      deductions += 25;
      criticals.push(this.issue('critical', 'asOfDate', '', 'STALE_DATA_CRITICAL',
        msg,
        `Los datos tienen ${daysDiff} días de antigüedad (>90 días) — obsoletos para reportes regulatorios`,
        'Update balance sheet data to within the last 90 days.',
      ));
    } else if (daysDiff > 60) {
      const msg = `Data is ${daysDiff} days old (>60 days) — approaching staleness`;
      issues.push(msg);
      deductions += 10;
      warnings.push(this.issue('warning', 'asOfDate', '', 'STALE_DATA_WARNING',
        msg,
        `Los datos tienen ${daysDiff} días de antigüedad (>60 días) — próximos a estar obsoletos`,
        'Consider refreshing balance sheet data soon.',
      ));
    }

    return { score: Math.max(0, 100 - deductions), issues };
  }

  // ── Helpers ─────────────────────────────────────────────────────────

  private scoreToGrade(score: number): 'A' | 'B' | 'C' | 'D' | 'F' {
    if (score >= 90) return 'A';
    if (score >= 80) return 'B';
    if (score >= 70) return 'C';
    if (score >= 60) return 'D';
    return 'F';
  }

  private issue(
    severity: DataQualityIssue['severity'],
    field: string,
    instrument: string,
    rule: string,
    message: string,
    messageEs: string,
    suggestion: string,
  ): DataQualityIssue {
    return { severity, field, instrument, rule, message, messageEs, suggestion };
  }

  private weightedAvgMaturity(instruments: BalanceSheetInstrument[]): number | null {
    const totalBalance = instruments.reduce((s, i) => s + (i.balance || 0), 0);
    if (totalBalance <= 0) return null;
    const weighted = instruments.reduce(
      (s, i) => s + (i.balance || 0) * (i.maturityYears || 0),
      0,
    );
    return weighted / totalBalance;
  }

  private weightedAvgRate(instruments: BalanceSheetInstrument[]): number | null {
    const totalBalance = instruments.reduce((s, i) => s + (i.balance || 0), 0);
    if (totalBalance <= 0) return null;
    const weighted = instruments.reduce(
      (s, i) => s + (i.balance || 0) * (i.rate || 0),
      0,
    );
    return weighted / totalBalance;
  }
}
