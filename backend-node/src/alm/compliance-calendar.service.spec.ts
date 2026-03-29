import { ComplianceCalendarService } from './compliance-calendar.service';

function mockPrisma(institution: any = null): any {
  return {
    institution: {
      findUnique: jest.fn().mockResolvedValue(institution),
    },
  };
}

describe('ComplianceCalendarService', () => {
  describe('calculateUrgency', () => {
    let service: ComplianceCalendarService;

    beforeEach(() => {
      service = new ComplianceCalendarService(mockPrisma());
    });

    const now = new Date('2026-03-29T12:00:00');

    it('returns OVERDUE for past dates', () => {
      expect(service.calculateUrgency(new Date('2026-03-28T12:00:00'), now)).toBe('OVERDUE');
      expect(service.calculateUrgency(new Date('2026-01-01T12:00:00'), now)).toBe('OVERDUE');
    });

    it('returns CRITICAL for 0-14 days', () => {
      expect(service.calculateUrgency(new Date('2026-03-29T13:00:00'), now)).toBe('CRITICAL'); // same day
      expect(service.calculateUrgency(new Date('2026-04-05T12:00:00'), now)).toBe('CRITICAL'); // 7 days
      expect(service.calculateUrgency(new Date('2026-04-12T12:00:00'), now)).toBe('CRITICAL'); // 14 days
    });

    it('returns HIGH for 15-30 days', () => {
      expect(service.calculateUrgency(new Date('2026-04-15T12:00:00'), now)).toBe('HIGH'); // 17 days
      expect(service.calculateUrgency(new Date('2026-04-28T12:00:00'), now)).toBe('HIGH'); // 30 days
    });

    it('returns MEDIUM for 31-90 days', () => {
      expect(service.calculateUrgency(new Date('2026-05-15T12:00:00'), now)).toBe('MEDIUM'); // 47 days
      expect(service.calculateUrgency(new Date('2026-06-27T12:00:00'), now)).toBe('MEDIUM'); // 90 days
    });

    it('returns LOW for 91+ days', () => {
      expect(service.calculateUrgency(new Date('2026-07-15T12:00:00'), now)).toBe('LOW');
      expect(service.calculateUrgency(new Date('2027-01-01T12:00:00'), now)).toBe('LOW');
    });
  });

  describe('getUpcomingDeadlines', () => {
    it('returns warning when institution not found', async () => {
      const service = new ComplianceCalendarService(mockPrisma(null));
      const result = await service.getUpcomingDeadlines('nonexistent');
      expect(result.events).toHaveLength(0);
      expect(result.warning).toContain('not found');
    });

    it('generates COSSEC exam deadline from nextExamDate', async () => {
      const service = new ComplianceCalendarService(mockPrisma({
        id: 'inst-1',
        name: 'CoopAhorro',
        type: 'cooperativa',
        nextExamDate: new Date('2026-06-15'),
        alcoMeetingFrequency: 'monthly',
      }));

      const result = await service.getUpcomingDeadlines('inst-1');
      const exam = result.events.find((e) => e.id === 'cossec-exam');
      expect(exam).toBeDefined();
      expect(exam!.title).toBe('COSSEC Examination');
      expect(exam!.titleEs).toBe('Examen COSSEC');
      expect(exam!.category).toBe('exam');
    });

    it('estimates COSSEC exam from lastExamDate + 15 months', async () => {
      const service = new ComplianceCalendarService(mockPrisma({
        id: 'inst-1',
        name: 'CoopAhorro',
        type: 'cooperativa',
        lastExamDate: new Date('2025-06-01'),
        alcoMeetingFrequency: 'monthly',
      }));

      const result = await service.getUpcomingDeadlines('inst-1');
      const exam = result.events.find((e) => e.id === 'cossec-exam-estimated');
      expect(exam).toBeDefined();
      expect(exam!.title).toContain('Estimated');
    });

    it('generates ALCO meeting deadlines', async () => {
      const service = new ComplianceCalendarService(mockPrisma({
        id: 'inst-1',
        name: 'CoopAhorro',
        type: 'cooperativa',
        alcoMeetingFrequency: 'monthly',
        alcoNextDate: new Date('2026-04-15'),
      }));

      const result = await service.getUpcomingDeadlines('inst-1');
      const alcoEvents = result.events.filter((e) => e.category === 'meeting');
      expect(alcoEvents.length).toBeGreaterThanOrEqual(1);
      expect(alcoEvents[0].titleEs).toContain('ALCO');
    });

    it('all events have bilingual fields', async () => {
      const service = new ComplianceCalendarService(mockPrisma({
        id: 'inst-1',
        name: 'CoopAhorro',
        type: 'cooperativa',
        nextExamDate: new Date('2026-09-01'),
        alcoMeetingFrequency: 'quarterly',
        alcoNextDate: new Date('2026-06-01'),
      }));

      const result = await service.getUpcomingDeadlines('inst-1');
      result.events.forEach((e) => {
        expect(e.title.length).toBeGreaterThan(0);
        expect(e.titleEs.length).toBeGreaterThan(0);
        expect(e.description.length).toBeGreaterThan(0);
        expect(e.descriptionEs.length).toBeGreaterThan(0);
      });
    });
  });
});
