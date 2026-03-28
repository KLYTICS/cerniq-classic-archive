import { isWeekend, isPRHoliday, isBusinessDay, addBusinessDays, countBusinessDays } from './date.util';

// Use T16:00:00Z (noon AST = UTC-4) to ensure consistent day-of-week across all timezones
function noon(dateStr: string): Date {
  return new Date(`${dateStr}T16:00:00Z`);
}

describe('date.util', () => {
  describe('isWeekend', () => {
    it('returns true for Saturday', () => {
      expect(isWeekend(noon('2026-03-28'))).toBe(true);
    });

    it('returns true for Sunday', () => {
      expect(isWeekend(noon('2026-03-29'))).toBe(true);
    });

    it('returns false for Monday', () => {
      expect(isWeekend(noon('2026-03-30'))).toBe(false);
    });
  });

  describe('isPRHoliday', () => {
    it('recognizes New Year\'s Day', () => {
      expect(isPRHoliday(noon('2026-01-01'))).toBe(true);
    });

    it('recognizes Christmas Day', () => {
      expect(isPRHoliday(noon('2026-12-25'))).toBe(true);
    });

    it('returns false for regular days', () => {
      expect(isPRHoliday(noon('2026-03-15'))).toBe(false);
    });
  });

  describe('isBusinessDay', () => {
    it('returns true for a regular weekday', () => {
      expect(isBusinessDay(noon('2026-03-25'))).toBe(true); // Wednesday
    });

    it('returns false for weekends', () => {
      expect(isBusinessDay(noon('2026-03-28'))).toBe(false); // Saturday
    });

    it('returns false for holidays', () => {
      expect(isBusinessDay(noon('2026-07-04'))).toBe(false); // Independence Day (Saturday in 2026)
    });
  });

  describe('addBusinessDays', () => {
    it('adds business days skipping weekends', () => {
      const friday = noon('2026-03-27');
      const result = addBusinessDays(friday, 1);
      expect(result.getDay()).toBe(1); // Monday
    });
  });

  describe('countBusinessDays', () => {
    it('counts business days in a week', () => {
      const monday = noon('2026-03-23');
      const friday = noon('2026-03-27');
      expect(countBusinessDays(monday, friday)).toBe(4);
    });
  });
});
