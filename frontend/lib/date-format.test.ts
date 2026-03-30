import { afterEach, describe, it, expect, vi } from 'vitest';
import { formatRelativeTime, formatShortDate, toISODateString } from './date-format';

describe('date-format', () => {
  afterEach(() => {
    vi.useRealTimers();
  });

  describe('formatShortDate', () => {
    it('formats a Date object', () => {
      const result = formatShortDate(new Date('2026-03-28T12:00:00Z'));
      expect(result).toContain('Mar');
      expect(result).toContain('2026');
    });

    it('formats a date string', () => {
      const result = formatShortDate('2026-01-15');
      expect(result).toContain('Jan');
      expect(result).toContain('2026');
    });
  });

  describe('formatRelativeTime', () => {
    it('formats future dates in days', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));

      expect(formatRelativeTime(new Date('2026-03-31T12:00:00Z'))).toBe('in 3 days');
    });

    it('formats past dates in hours', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));

      expect(formatRelativeTime(new Date('2026-03-28T09:00:00Z'))).toBe('3 hours ago');
    });

    it('formats short minute and second moves from strings', () => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-03-28T12:00:00Z'));

      expect(formatRelativeTime('2026-03-28T11:45:00Z')).toBe('15 minutes ago');
      expect(formatRelativeTime('2026-03-28T12:00:30Z')).toBe('in 30 seconds');
    });
  });

  describe('toISODateString', () => {
    it('returns YYYY-MM-DD format', () => {
      expect(toISODateString(new Date('2026-03-28T12:00:00Z'))).toBe('2026-03-28');
    });
  });
});
