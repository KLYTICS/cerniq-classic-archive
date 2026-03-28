import { isWeekend, isPRHoliday, isBusinessDay, addBusinessDays, countBusinessDays } from './date.util';

describe('date.util', () => {
  describe('isWeekend', () => {
    it('returns true for Saturday', () => {
      expect(isWeekend(new Date('2026-03-28'))).toBe(true); // Saturday
    });

    it('returns true for Sunday', () => {
      expect(isWeekend(new Date('2026-03-29'))).toBe(true); // Sunday
    });

    it('returns false for Monday', () => {
      expect(isWeekend(new Date('2026-03-30'))).toBe(false); // Monday
    });
  });

  describe('isPRHoliday', () => {
    it('recognizes New Year\'s Day', () => {
      expect(isPRHoliday(new Date('2026-01-01'))).toBe(true);
    });

    it('recognizes Christmas Day', () => {
      expect(isPRHoliday(new Date('2026-12-25'))).toBe(true);
    });

    it('returns false for regular days', () => {
      expect(isPRHoliday(new Date('2026-03-15'))).toBe(false);
    });
  });

  describe('isBusinessDay', () => {
    it('returns true for a regular weekday', () => {
      expect(isBusinessDay(new Date('2026-03-25'))).toBe(true); // Wednesday
    });

    it('returns false for weekends', () => {
      expect(isBusinessDay(new Date('2026-03-28'))).toBe(false); // Saturday
    });

    it('returns false for holidays', () => {
      expect(isBusinessDay(new Date('2026-07-04'))).toBe(false); // Independence Day (Saturday in 2026)
    });
  });

  describe('addBusinessDays', () => {
    it('adds business days skipping weekends', () => {
      const friday = new Date('2026-03-27'); // Friday
      const result = addBusinessDays(friday, 1);
      expect(result.getDay()).toBe(1); // Monday
    });
  });

  describe('countBusinessDays', () => {
    it('counts business days in a week', () => {
      const monday = new Date('2026-03-23');
      const friday = new Date('2026-03-27');
      expect(countBusinessDays(monday, friday)).toBe(4);
    });
  });
});
