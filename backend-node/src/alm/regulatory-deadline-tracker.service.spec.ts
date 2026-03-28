import { RegulatoryDeadlineTrackerService } from './regulatory-deadline-tracker.service';

describe('RegulatoryDeadlineTrackerService', () => {
  let service: RegulatoryDeadlineTrackerService;

  beforeEach(() => {
    service = new RegulatoryDeadlineTrackerService();
  });

  // ── getUpcomingDeadlines ───────────────────────────────────────────────

  it('returns deadlines within lookAhead window', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01',
      lookAheadDays: 60,
    });
    // 60-day window from Jan 1 => up to Mar 2. Should include Feb 14 COSSEC, Jan 30 NCUA,
    // Jan & Feb ALCO meetings, Feb board report — but NOT May 15 COSSEC.
    const dueDates = result.deadlines.map((d) => d.dueDate);
    expect(dueDates.some((d) => d === '2026-02-14')).toBe(true);
    expect(
      dueDates.every(
        (d) =>
          d <= '2026-03-02' ||
          result.deadlines.find((dl) => dl.dueDate === d)!.status === 'OVERDUE',
      ),
    ).toBe(true);
  });

  it('COSSEC quarterly deadlines present for cooperativa', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01',
      lookAheadDays: 365,
    });
    const cossec = result.deadlines.filter((d) => d.regulator === 'COSSEC');
    expect(cossec.length).toBeGreaterThanOrEqual(4);
    const dueDates = cossec.map((d) => d.dueDate);
    expect(dueDates).toContain('2026-02-14');
    expect(dueDates).toContain('2026-05-15');
    expect(dueDates).toContain('2026-08-14');
    expect(dueDates).toContain('2026-11-14');
  });

  it('NCUA call report deadlines present', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01',
      lookAheadDays: 365,
    });
    const ncua = result.deadlines.filter((d) => d.regulator === 'NCUA');
    expect(ncua.length).toBeGreaterThanOrEqual(4);
    expect(ncua[0].requirements).toContain('NCUA 5300 form');
  });

  it('status correctly classified — OVERDUE', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-02-20', // Feb 14 COSSEC already passed
      lookAheadDays: 90,
    });
    const cossecFeb = result.deadlines.find(
      (d) => d.dueDate === '2026-02-14' && d.regulator === 'COSSEC',
    );
    expect(cossecFeb).toBeDefined();
    expect(cossecFeb!.status).toBe('OVERDUE');
    expect(cossecFeb!.daysRemaining).toBeLessThan(0);
  });

  it('status correctly classified — URGENT (<=7 days)', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-02-10', // 4 days before Feb 14 COSSEC
      lookAheadDays: 90,
    });
    const cossecFeb = result.deadlines.find(
      (d) => d.dueDate === '2026-02-14' && d.regulator === 'COSSEC',
    );
    expect(cossecFeb).toBeDefined();
    expect(cossecFeb!.status).toBe('URGENT');
  });

  it('status correctly classified — APPROACHING (8-30 days)', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-20', // 25 days before Feb 14 COSSEC
      lookAheadDays: 90,
    });
    const cossecFeb = result.deadlines.find(
      (d) => d.dueDate === '2026-02-14' && d.regulator === 'COSSEC',
    );
    expect(cossecFeb).toBeDefined();
    expect(cossecFeb!.status).toBe('APPROACHING');
  });

  it('status correctly classified — ON_TRACK (>30 days)', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01', // 44 days before Feb 14 COSSEC
      lookAheadDays: 90,
    });
    const cossecFeb = result.deadlines.find(
      (d) => d.dueDate === '2026-02-14' && d.regulator === 'COSSEC',
    );
    expect(cossecFeb).toBeDefined();
    expect(cossecFeb!.status).toBe('ON_TRACK');
  });

  it('summary counts match deadline statuses', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-02-12',
      lookAheadDays: 90,
    });
    const { summary, deadlines } = result;
    expect(summary.total).toBe(deadlines.length);
    expect(summary.overdue).toBe(
      deadlines.filter((d) => d.status === 'OVERDUE').length,
    );
    expect(summary.urgent).toBe(
      deadlines.filter((d) => d.status === 'URGENT').length,
    );
    expect(summary.approaching).toBe(
      deadlines.filter((d) => d.status === 'APPROACHING').length,
    );
    expect(summary.onTrack).toBe(
      deadlines.filter((d) => d.status === 'ON_TRACK').length,
    );
    expect(
      summary.overdue + summary.urgent + summary.approaching + summary.onTrack,
    ).toBe(summary.total);
  });

  it('next critical deadline identified', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01',
      lookAheadDays: 90,
    });
    expect(result.nextCritical).not.toBeNull();
    expect(result.nextCritical!.daysRemaining).toBeGreaterThanOrEqual(0);
    expect(result.nextCritical!.name).toBeDefined();
    expect(result.nextCritical!.dueDate).toBeDefined();
  });

  it('bilingual names present on all deadlines', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01',
      lookAheadDays: 365,
    });
    for (const dl of result.deadlines) {
      expect(dl.name.length).toBeGreaterThan(0);
      expect(dl.nameEs.length).toBeGreaterThan(0);
      expect(dl.requirements.length).toBeGreaterThan(0);
      expect(dl.requirementsEs.length).toBeGreaterThan(0);
      expect(dl.requirementsEs.length).toBe(dl.requirements.length);
    }
  });

  it('internal ALCO meetings appear monthly', () => {
    const result = service.getUpcomingDeadlines({
      institutionType: 'cooperativa',
      currentDate: '2026-01-01',
      lookAheadDays: 365,
    });
    const alco = result.deadlines.filter((d) => d.category === 'alco_meeting');
    // Should have 12 monthly meetings
    expect(alco.length).toBeGreaterThanOrEqual(12);
    // All on 3rd Wednesday
    for (const mtg of alco) {
      const date = new Date(mtg.dueDate + 'T12:00:00'); // noon to avoid TZ edge
      expect(date.getDay()).toBe(3); // Wednesday
      // 3rd Wednesday falls between 15th and 21st
      expect(date.getDate()).toBeGreaterThanOrEqual(15);
      expect(date.getDate()).toBeLessThanOrEqual(21);
    }
  });

  // ── generateComplianceCalendar ─────────────────────────────────────────

  it('annual calendar has 12 months', () => {
    const result = service.generateComplianceCalendar({
      year: 2026,
      institutionType: 'cooperativa',
    });
    expect(result.months).toHaveLength(12);
    expect(result.months[0].monthName).toBe('January');
    expect(result.months[11].monthName).toBe('December');
    expect(result.months[0].month).toBe(1);
    expect(result.months[11].month).toBe(12);
  });

  it('calendar contains deadlines in correct months', () => {
    const result = service.generateComplianceCalendar({
      year: 2026,
      institutionType: 'cooperativa',
    });
    // COSSEC Q1 due May 15 => month 5 (index 4)
    const may = result.months[4];
    expect(may.deadlines.some((d) => d.regulator === 'COSSEC')).toBe(true);
    // ALCO in every month
    for (const m of result.months) {
      expect(m.deadlines.some((d) => d.category === 'alco_meeting')).toBe(true);
    }
  });

  it('bank institution gets FDIC instead of COSSEC/NCUA', () => {
    const result = service.generateComplianceCalendar({
      year: 2026,
      institutionType: 'bank',
    });
    const allDeadlines = result.months.flatMap((m) => m.deadlines);
    expect(allDeadlines.some((d) => d.regulator === 'FDIC')).toBe(true);
    expect(allDeadlines.some((d) => d.regulator === 'COSSEC')).toBe(false);
    expect(allDeadlines.some((d) => d.regulator === 'NCUA')).toBe(false);
  });

  // ── checkCompliance ────────────────────────────────────────────────────

  it('compliance check identifies missed deadlines', () => {
    const result = service.checkCompliance({
      institutionType: 'cooperativa',
      currentDate: '2026-06-01',
      completedFilings: [], // nothing filed!
    });
    expect(result.compliant).toBe(false);
    expect(result.missedDeadlines.length).toBeGreaterThan(0);
  });

  it('late filing detected with correct days late', () => {
    const result = service.checkCompliance({
      institutionType: 'cooperativa',
      currentDate: '2026-06-01',
      completedFilings: [
        // COSSEC Q4 due Feb 14, filed Feb 24 => 10 days late
        { deadlineId: 'cossec-quarterly-2026-02', filedDate: '2026-02-24' },
      ],
    });
    const lateFiling = result.lateFilings.find(
      (lf) => lf.deadline.id === 'cossec-quarterly-2026-02',
    );
    expect(lateFiling).toBeDefined();
    expect(lateFiling!.daysLate).toBe(10);
    expect(lateFiling!.filedDate).toBe('2026-02-24');
  });

  it('compliance check returns compliant when all filings on time', () => {
    // Only check against a narrow window
    const result = service.checkCompliance({
      institutionType: 'bank',
      currentDate: '2026-02-01',
      completedFilings: [
        // FDIC Q4 due Jan 30
        { deadlineId: 'fdic-call-report-2026-01', filedDate: '2026-01-28' },
        // ALCO Jan meeting — 3rd Wed of Jan 2026 = Jan 21
        { deadlineId: 'alco-meeting-2026-01', filedDate: '2026-01-21' },
        // Board report — Mar 16 is future, not due yet
        // Annual audit — Mar 31 is future, not due yet
        // FDIC Q4 prior year
        { deadlineId: 'fdic-call-report-2025-01', filedDate: '2025-01-28' },
        { deadlineId: 'fdic-call-report-2025-04', filedDate: '2025-04-28' },
        { deadlineId: 'fdic-call-report-2025-07', filedDate: '2025-07-28' },
        { deadlineId: 'fdic-call-report-2025-10', filedDate: '2025-10-28' },
        // All 2025 ALCO meetings
        { deadlineId: 'alco-meeting-2025-01', filedDate: '2025-01-15' },
        { deadlineId: 'alco-meeting-2025-02', filedDate: '2025-02-19' },
        { deadlineId: 'alco-meeting-2025-03', filedDate: '2025-03-19' },
        { deadlineId: 'alco-meeting-2025-04', filedDate: '2025-04-16' },
        { deadlineId: 'alco-meeting-2025-05', filedDate: '2025-05-21' },
        { deadlineId: 'alco-meeting-2025-06', filedDate: '2025-06-18' },
        { deadlineId: 'alco-meeting-2025-07', filedDate: '2025-07-16' },
        { deadlineId: 'alco-meeting-2025-08', filedDate: '2025-08-20' },
        { deadlineId: 'alco-meeting-2025-09', filedDate: '2025-09-17' },
        { deadlineId: 'alco-meeting-2025-10', filedDate: '2025-10-15' },
        { deadlineId: 'alco-meeting-2025-11', filedDate: '2025-11-19' },
        { deadlineId: 'alco-meeting-2025-12', filedDate: '2025-12-17' },
        // 2025 board reports
        { deadlineId: 'board-report-2025-03', filedDate: '2025-03-15' },
        { deadlineId: 'board-report-2025-06', filedDate: '2025-06-14' },
        { deadlineId: 'board-report-2025-09', filedDate: '2025-09-14' },
        { deadlineId: 'board-report-2025-12', filedDate: '2025-12-15' },
        // 2025 annual audit
        { deadlineId: 'annual-audit-2025-03', filedDate: '2025-03-28' },
      ],
    });
    expect(result.compliant).toBe(true);
    expect(result.missedDeadlines).toHaveLength(0);
    expect(result.lateFilings).toHaveLength(0);
  });
});
