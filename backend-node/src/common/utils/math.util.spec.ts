import {
  clamp,
  lerp,
  percentile,
  safeDiv,
  roundTo,
  sum,
  mean,
} from './math.util';

describe('math.util', () => {
  describe('clamp', () => {
    it('returns value when within range', () => {
      expect(clamp(5, 0, 10)).toBe(5);
    });

    it('clamps to min', () => {
      expect(clamp(-5, 0, 10)).toBe(0);
    });

    it('clamps to max', () => {
      expect(clamp(15, 0, 10)).toBe(10);
    });
  });

  describe('lerp', () => {
    it('interpolates between start and end', () => {
      expect(lerp(0, 100, 0.5)).toBe(50);
    });

    it('clamps t to [0, 1]', () => {
      expect(lerp(0, 100, 2)).toBe(100);
      expect(lerp(0, 100, -1)).toBe(0);
    });
  });

  describe('percentile', () => {
    it('calculates median (50th percentile)', () => {
      expect(percentile([1, 2, 3, 4, 5], 50)).toBe(3);
    });

    it('returns 0 for empty array', () => {
      expect(percentile([], 50)).toBe(0);
    });
  });

  describe('safeDiv', () => {
    it('returns correct division result', () => {
      expect(safeDiv(10, 2)).toBe(5);
    });

    it('returns default for division by zero', () => {
      expect(safeDiv(10, 0)).toBe(0);
      expect(safeDiv(10, 0, -1)).toBe(-1);
    });
  });

  describe('roundTo', () => {
    it('rounds to specified decimal places', () => {
      expect(roundTo(3.14159, 2)).toBe(3.14);
    });
  });

  describe('sum / mean', () => {
    it('calculates sum', () => {
      expect(sum([1, 2, 3])).toBe(6);
    });

    it('calculates mean', () => {
      expect(mean([2, 4, 6])).toBe(4);
    });

    it('returns 0 for empty array mean', () => {
      expect(mean([])).toBe(0);
    });
  });
});
