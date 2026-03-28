import { Injectable } from '@nestjs/common';

// ── Types ────────────────────────────────────────────────────────────────────

export type InstitutionType = 'cooperativa' | 'credit_union' | 'bank';
export type Regulator = 'COSSEC' | 'NCUA' | 'FDIC' | 'INTERNAL';
export type DeadlineStatus = 'ON_TRACK' | 'APPROACHING' | 'URGENT' | 'OVERDUE';
export type DeadlineCategory =
  | 'quarterly_filing'
  | 'annual_report'
  | 'stress_test'
  | 'board_report'
  | 'alco_meeting'
  | 'audit';

export interface RegulatoryDeadline {
  id: string;
  name: string;
  nameEs: string;
  regulator: Regulator;
  dueDate: string;
  daysRemaining: number;
  status: DeadlineStatus;
  category: DeadlineCategory;
  requirements: string[];
  requirementsEs: string[];
  penalty: string;
}

export interface DeadlineSummary {
  total: number;
  overdue: number;
  urgent: number;
  approaching: number;
  onTrack: number;
}

export interface UpcomingDeadlinesResult {
  deadlines: RegulatoryDeadline[];
  summary: DeadlineSummary;
  nextCritical: { name: string; dueDate: string; daysRemaining: number } | null;
}

export interface ComplianceCalendarMonth {
  month: number;
  monthName: string;
  deadlines: RegulatoryDeadline[];
}

export interface ComplianceCalendarResult {
  months: ComplianceCalendarMonth[];
}

export interface ComplianceCheckResult {
  compliant: boolean;
  missedDeadlines: RegulatoryDeadline[];
  lateFilings: {
    deadline: RegulatoryDeadline;
    filedDate: string;
    daysLate: number;
  }[];
}

// ── Internal deadline template ───────────────────────────────────────────────

interface DeadlineTemplate {
  idPrefix: string;
  name: string;
  nameEs: string;
  regulator: Regulator;
  category: DeadlineCategory;
  requirements: string[];
  requirementsEs: string[];
  penalty: string;
  /** Returns all due dates for the given year */
  dueDates: (year: number) => Date[];
}

// ── Service ──────────────────────────────────────────────────────────────────

/** Regulatory Deadline Tracker — Quant Model #TBD.
 *  Tracks every COSSEC, NCUA, and internal deadline for PR cooperativas.
 *  Missing a regulatory filing deadline is career-ending. This service
 *  ensures nobody forgets. */
@Injectable()
export class RegulatoryDeadlineTrackerService {
  // ── 1. Upcoming Deadlines ────────────────────────────────────────────────

  getUpcomingDeadlines(params: {
    institutionType: InstitutionType;
    currentDate?: string;
    lookAheadDays?: number;
  }): UpcomingDeadlinesResult {
    const now = params.currentDate ? new Date(params.currentDate) : new Date();
    const lookAhead = params.lookAheadDays ?? 90;
    const horizon = new Date(now);
    horizon.setDate(horizon.getDate() + lookAhead);

    const templates = this.getTemplatesForInstitution(params.institutionType);
    const deadlines: RegulatoryDeadline[] = [];

    // Scan current year and next year to catch cross-year boundaries
    for (const year of [
      now.getFullYear() - 1,
      now.getFullYear(),
      now.getFullYear() + 1,
    ]) {
      for (const tpl of templates) {
        for (const dueDate of tpl.dueDates(year)) {
          const daysRemaining = this.diffDays(now, dueDate);
          // Include if within look-ahead window OR overdue (up to 90 days past)
          if (dueDate <= horizon && daysRemaining >= -90) {
            const status = this.classifyStatus(daysRemaining);
            // For upcoming: include if within window; for overdue: always include
            if (
              dueDate <= horizon &&
              (daysRemaining < 0 || dueDate >= now || dueDate <= horizon)
            ) {
              deadlines.push({
                id: `${tpl.idPrefix}-${year}-${(dueDate.getMonth() + 1).toString().padStart(2, '0')}`,
                name: tpl.name,
                nameEs: tpl.nameEs,
                regulator: tpl.regulator,
                dueDate: this.formatDate(dueDate),
                daysRemaining,
                status,
                category: tpl.category,
                requirements: tpl.requirements,
                requirementsEs: tpl.requirementsEs,
                penalty: tpl.penalty,
              });
            }
          }
        }
      }
    }

    // Deduplicate by id
    const seen = new Set<string>();
    const unique = deadlines.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    // Sort by due date ascending
    unique.sort((a, b) => a.dueDate.localeCompare(b.dueDate));

    const summary = this.buildSummary(unique);
    const nextCritical = this.findNextCritical(unique);

    return { deadlines: unique, summary, nextCritical };
  }

  // ── 2. Compliance Calendar ───────────────────────────────────────────────

  generateComplianceCalendar(params: {
    year: number;
    institutionType: InstitutionType;
  }): ComplianceCalendarResult {
    const templates = this.getTemplatesForInstitution(params.institutionType);
    const monthNames = [
      'January',
      'February',
      'March',
      'April',
      'May',
      'June',
      'July',
      'August',
      'September',
      'October',
      'November',
      'December',
    ];

    const months: ComplianceCalendarMonth[] = monthNames.map((name, idx) => ({
      month: idx + 1,
      monthName: name,
      deadlines: [],
    }));

    const refDate = new Date(params.year, 0, 1);

    for (const tpl of templates) {
      for (const dueDate of tpl.dueDates(params.year)) {
        const daysRemaining = this.diffDays(refDate, dueDate);
        const status = this.classifyStatus(daysRemaining);
        const monthIdx = dueDate.getMonth();
        months[monthIdx].deadlines.push({
          id: `${tpl.idPrefix}-${params.year}-${(monthIdx + 1).toString().padStart(2, '0')}`,
          name: tpl.name,
          nameEs: tpl.nameEs,
          regulator: tpl.regulator,
          dueDate: this.formatDate(dueDate),
          daysRemaining,
          status,
          category: tpl.category,
          requirements: tpl.requirements,
          requirementsEs: tpl.requirementsEs,
          penalty: tpl.penalty,
        });
      }
    }

    // Sort deadlines within each month by date
    for (const m of months) {
      m.deadlines.sort((a, b) => a.dueDate.localeCompare(b.dueDate));
    }

    return { months };
  }

  // ── 3. Compliance Check ──────────────────────────────────────────────────

  checkCompliance(params: {
    institutionType: InstitutionType;
    currentDate?: string;
    completedFilings: { deadlineId: string; filedDate: string }[];
  }): ComplianceCheckResult {
    const now = params.currentDate ? new Date(params.currentDate) : new Date();
    const year = now.getFullYear();
    const templates = this.getTemplatesForInstitution(params.institutionType);

    // Build all deadlines that should have been filed by now
    const pastDue: RegulatoryDeadline[] = [];
    for (const yr of [year - 1, year]) {
      for (const tpl of templates) {
        for (const dueDate of tpl.dueDates(yr)) {
          if (dueDate <= now) {
            const daysRemaining = this.diffDays(now, dueDate);
            pastDue.push({
              id: `${tpl.idPrefix}-${yr}-${(dueDate.getMonth() + 1).toString().padStart(2, '0')}`,
              name: tpl.name,
              nameEs: tpl.nameEs,
              regulator: tpl.regulator,
              dueDate: this.formatDate(dueDate),
              daysRemaining,
              status: 'OVERDUE',
              category: tpl.category,
              requirements: tpl.requirements,
              requirementsEs: tpl.requirementsEs,
              penalty: tpl.penalty,
            });
          }
        }
      }
    }

    // Deduplicate
    const seen = new Set<string>();
    const uniquePastDue = pastDue.filter((d) => {
      if (seen.has(d.id)) return false;
      seen.add(d.id);
      return true;
    });

    const filedMap = new Map(
      params.completedFilings.map((f) => [f.deadlineId, f.filedDate]),
    );

    const missedDeadlines: RegulatoryDeadline[] = [];
    const lateFilings: ComplianceCheckResult['lateFilings'] = [];

    for (const dl of uniquePastDue) {
      const filedDate = filedMap.get(dl.id);
      if (!filedDate) {
        missedDeadlines.push(dl);
      } else {
        const filed = new Date(filedDate);
        const due = new Date(dl.dueDate);
        const daysLate = this.diffDays(due, filed);
        if (daysLate > 0) {
          lateFilings.push({ deadline: dl, filedDate, daysLate });
        }
      }
    }

    return {
      compliant: missedDeadlines.length === 0 && lateFilings.length === 0,
      missedDeadlines,
      lateFilings,
    };
  }

  // ── Private helpers ──────────────────────────────────────────────────────

  private classifyStatus(daysRemaining: number): DeadlineStatus {
    if (daysRemaining < 0) return 'OVERDUE';
    if (daysRemaining <= 7) return 'URGENT';
    if (daysRemaining <= 30) return 'APPROACHING';
    return 'ON_TRACK';
  }

  private diffDays(from: Date, to: Date): number {
    const msPerDay = 86_400_000;
    // Strip time components for clean day diff
    const f = Date.UTC(from.getFullYear(), from.getMonth(), from.getDate());
    const t = Date.UTC(to.getFullYear(), to.getMonth(), to.getDate());
    return Math.round((t - f) / msPerDay);
  }

  private formatDate(d: Date): string {
    return `${d.getFullYear()}-${(d.getMonth() + 1).toString().padStart(2, '0')}-${d.getDate().toString().padStart(2, '0')}`;
  }

  private buildSummary(deadlines: RegulatoryDeadline[]): DeadlineSummary {
    return {
      total: deadlines.length,
      overdue: deadlines.filter((d) => d.status === 'OVERDUE').length,
      urgent: deadlines.filter((d) => d.status === 'URGENT').length,
      approaching: deadlines.filter((d) => d.status === 'APPROACHING').length,
      onTrack: deadlines.filter((d) => d.status === 'ON_TRACK').length,
    };
  }

  private findNextCritical(
    deadlines: RegulatoryDeadline[],
  ): { name: string; dueDate: string; daysRemaining: number } | null {
    // Next critical = first non-overdue deadline (earliest upcoming)
    const upcoming = deadlines.filter((d) => d.daysRemaining >= 0);
    if (upcoming.length === 0) return null;
    upcoming.sort((a, b) => a.daysRemaining - b.daysRemaining);
    const c = upcoming[0];
    return { name: c.name, dueDate: c.dueDate, daysRemaining: c.daysRemaining };
  }

  /** 3rd Wednesday of the given month/year */
  private thirdWednesday(year: number, month: number): Date {
    // month is 0-indexed
    const first = new Date(year, month, 1);
    // Day of week for the 1st: 0=Sun..6=Sat
    const dow = first.getDay();
    // First Wednesday: if dow <= 3, then day = 1 + (3 - dow), else day = 1 + (10 - dow)
    const firstWed = dow <= 3 ? 1 + (3 - dow) : 1 + (10 - dow);
    // Third Wednesday = firstWed + 14
    return new Date(year, month, firstWed + 14);
  }

  // ── Deadline Templates ─────────────────────────────────────────────────

  private getTemplatesForInstitution(
    institutionType: InstitutionType,
  ): DeadlineTemplate[] {
    const templates: DeadlineTemplate[] = [];

    if (
      institutionType === 'cooperativa' ||
      institutionType === 'credit_union'
    ) {
      // COSSEC Quarterly Filings (Q+45 days)
      templates.push({
        idPrefix: 'cossec-quarterly',
        name: 'COSSEC Quarterly Filing',
        nameEs: 'Informe Trimestral COSSEC',
        regulator: 'COSSEC',
        category: 'quarterly_filing',
        requirements: [
          'NII sensitivity analysis',
          'EVE analysis',
          'Liquidity Coverage Ratio (LCR)',
          'Duration gap report',
          'Capital adequacy assessment',
        ],
        requirementsEs: [
          'Analisis de sensibilidad NII',
          'Analisis EVE',
          'Ratio de Cobertura de Liquidez (LCR)',
          'Informe de brecha de duracion',
          'Evaluacion de adecuacion de capital',
        ],
        penalty:
          'Regulatory sanctions, potential conservatorship, civil money penalties up to $25,000/day',
        dueDates: (year: number) => [
          new Date(year, 1, 14), // Q4 prior year: Feb 14
          new Date(year, 4, 15), // Q1: May 15
          new Date(year, 7, 14), // Q2: Aug 14
          new Date(year, 10, 14), // Q3: Nov 14
        ],
      });

      // NCUA Call Report (Q+30 days)
      templates.push({
        idPrefix: 'ncua-call-report',
        name: 'NCUA Call Report (5300)',
        nameEs: 'Informe de Llamada NCUA (5300)',
        regulator: 'NCUA',
        category: 'quarterly_filing',
        requirements: [
          'NCUA 5300 form',
          'Financial statements',
          'Delinquency report',
        ],
        requirementsEs: [
          'Formulario NCUA 5300',
          'Estados financieros',
          'Informe de morosidad',
        ],
        penalty:
          'Federal regulatory action, potential loss of share insurance, fines up to $10,000/day',
        dueDates: (year: number) => [
          new Date(year, 0, 30), // Q4 prior year: Jan 30
          new Date(year, 3, 30), // Q1: Apr 30
          new Date(year, 6, 30), // Q2: Jul 30
          new Date(year, 9, 30), // Q3: Oct 30
        ],
      });
    }

    if (institutionType === 'bank') {
      // FDIC Call Report
      templates.push({
        idPrefix: 'fdic-call-report',
        name: 'FDIC Call Report',
        nameEs: 'Informe de Llamada FDIC',
        regulator: 'FDIC',
        category: 'quarterly_filing',
        requirements: [
          'FFIEC 031/041 form',
          'Financial statements',
          'Risk-weighted assets',
        ],
        requirementsEs: [
          'Formulario FFIEC 031/041',
          'Estados financieros',
          'Activos ponderados por riesgo',
        ],
        penalty: 'Federal regulatory action, civil money penalties',
        dueDates: (year: number) => [
          new Date(year, 0, 30),
          new Date(year, 3, 30),
          new Date(year, 6, 30),
          new Date(year, 9, 30),
        ],
      });
    }

    // Internal ALCO Meeting — 3rd Wednesday of each month (all institution types)
    templates.push({
      idPrefix: 'alco-meeting',
      name: 'Internal ALCO Meeting',
      nameEs: 'Reunion Interna ALCO',
      regulator: 'INTERNAL',
      category: 'alco_meeting',
      requirements: [
        'Rate risk dashboard',
        'Liquidity report',
        'Policy limit review',
      ],
      requirementsEs: [
        'Dashboard de riesgo de tasa',
        'Informe de liquidez',
        'Revision de limites de politica',
      ],
      penalty:
        'Internal policy violation, potential regulatory finding on governance',
      dueDates: (year: number) => {
        const dates: Date[] = [];
        for (let m = 0; m < 12; m++) {
          dates.push(this.thirdWednesday(year, m));
        }
        return dates;
      },
    });

    // Board Report — Quarterly, 15 days before quarter end
    templates.push({
      idPrefix: 'board-report',
      name: 'Board Report',
      nameEs: 'Informe a la Junta',
      regulator: 'INTERNAL',
      category: 'board_report',
      requirements: [
        'CAMEL scorecard',
        'Peer comparison analysis',
        'Regulatory compliance summary',
      ],
      requirementsEs: [
        'Cuadro de mando CAMEL',
        'Analisis comparativo con pares',
        'Resumen de cumplimiento regulatorio',
      ],
      penalty:
        'Board governance failure, regulatory criticism in exam findings',
      dueDates: (year: number) => [
        new Date(year, 2, 16), // 15 days before Mar 31
        new Date(year, 5, 15), // 15 days before Jun 30
        new Date(year, 8, 15), // 15 days before Sep 30
        new Date(year, 11, 16), // 15 days before Dec 31
      ],
    });

    // Annual Audit — Due March 31
    templates.push({
      idPrefix: 'annual-audit',
      name: 'Annual Audit',
      nameEs: 'Auditoria Anual',
      regulator: 'INTERNAL',
      category: 'audit',
      requirements: [
        'Audited financial statements',
        'Internal controls assessment',
        'BSA/AML compliance review',
      ],
      requirementsEs: [
        'Estados financieros auditados',
        'Evaluacion de controles internos',
        'Revision de cumplimiento BSA/AML',
      ],
      penalty:
        'Regulatory enforcement action, potential consent order, reputational damage',
      dueDates: (year: number) => [new Date(year, 2, 31)],
    });

    return templates;
  }
}
