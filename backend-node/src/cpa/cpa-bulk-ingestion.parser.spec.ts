import { parseCpaFinancialField } from './cpa-bulk-ingestion.service';

// D21: parseCpaFinancialField replaces `parseFloat` + `isNaN`
// validation on CPA bulk-CSV uploads. Three defects in the old
// code let corrupted values reach the DB:
//
//   1. parseFloat silently accepted trailing garbage:
//      parseFloat('1234abc') → 1234
//   2. parseFloat(+/-Infinity on exponential overflow):
//      parseFloat('1e400') → Infinity, isNaN(Infinity) === false
//   3. No bounds — negative balances, rates > 100%, durations > 50y
//      all passed.
//
// Each case below is named after the real-world CSV row it would
// have mis-accepted before the fix.
describe('parseCpaFinancialField', () => {
  describe('strict numeric parsing (D21 core)', () => {
    it('accepts a clean integer', () => {
      expect(parseCpaFinancialField('100', { min: 0, max: 1000 })).toBe(100);
    });

    it('accepts a clean decimal', () => {
      expect(parseCpaFinancialField('123.45', { min: 0, max: 1000 })).toBe(
        123.45,
      );
    });

    it('accepts explicit negative when bounds allow', () => {
      expect(parseCpaFinancialField('-0.25', { min: -1, max: 100 })).toBe(
        -0.25,
      );
    });

    it('rejects trailing garbage (core parseFloat bug)', () => {
      expect(parseCpaFinancialField('1234abc', { min: 0, max: 1e15 })).toBe(
        null,
      );
      // Variant — alphabetic prefix must also fail
      expect(parseCpaFinancialField('abc1234', { min: 0, max: 1e15 })).toBe(
        null,
      );
    });

    it('rejects Infinity (exponential overflow)', () => {
      // `1e400` overflows IEEE-754 double to +Infinity. `isNaN(Infinity)`
      // returns false, so the old code happily let it through.
      expect(parseCpaFinancialField('1e400', { min: 0, max: 1e15 })).toBe(null);
      expect(parseCpaFinancialField('-1e400', { min: -1e15, max: 1e15 })).toBe(
        null,
      );
    });

    it('rejects the literal strings "Infinity" and "-Infinity"', () => {
      expect(parseCpaFinancialField('Infinity', { min: 0, max: 1e15 })).toBe(
        null,
      );
      expect(
        parseCpaFinancialField('-Infinity', { min: -1e15, max: 1e15 }),
      ).toBe(null);
    });

    it('rejects "NaN"', () => {
      expect(parseCpaFinancialField('NaN', { min: 0, max: 1e15 })).toBe(null);
    });

    it('rejects empty strings and whitespace-only', () => {
      expect(parseCpaFinancialField('', { min: 0, max: 1000 })).toBe(null);
      expect(parseCpaFinancialField('   ', { min: 0, max: 1000 })).toBe(null);
      expect(parseCpaFinancialField('\t\n', { min: 0, max: 1000 })).toBe(null);
    });

    it('rejects null and undefined', () => {
      expect(parseCpaFinancialField(null, { min: 0, max: 1000 })).toBe(null);
      expect(parseCpaFinancialField(undefined, { min: 0, max: 1000 })).toBe(
        null,
      );
    });

    it('trims leading/trailing whitespace before parsing', () => {
      expect(parseCpaFinancialField('  42  ', { min: 0, max: 100 })).toBe(42);
    });
  });

  describe('bounds enforcement', () => {
    it('rejects values below min', () => {
      expect(parseCpaFinancialField('-5', { min: 0, max: 100 })).toBe(null);
    });

    it('rejects values above max', () => {
      expect(parseCpaFinancialField('101', { min: 0, max: 100 })).toBe(null);
    });

    it('accepts the min boundary', () => {
      expect(parseCpaFinancialField('0', { min: 0, max: 100 })).toBe(0);
    });

    it('accepts the max boundary', () => {
      expect(parseCpaFinancialField('100', { min: 0, max: 100 })).toBe(100);
    });
  });

  describe('realistic CPA CSV scenarios', () => {
    it('balance: accepts a $250M cooperativa total asset line', () => {
      expect(parseCpaFinancialField('250000000', { min: 0, max: 1e15 })).toBe(
        250_000_000,
      );
    });

    it("balance: rejects a negative balance (asset can't be negative)", () => {
      expect(parseCpaFinancialField('-1000', { min: 0, max: 1e15 })).toBe(null);
    });

    it('rate: accepts a 4.75% mortgage rate', () => {
      expect(parseCpaFinancialField('4.75', { min: -1, max: 100 })).toBe(4.75);
    });

    it('rate: rejects a 200% rate (operator typo — missed decimal)', () => {
      expect(parseCpaFinancialField('200', { min: -1, max: 100 })).toBe(null);
    });

    it('duration: accepts a 30-year treasury duration (27.5y Macaulay)', () => {
      expect(parseCpaFinancialField('27.5', { min: 0, max: 50 })).toBe(27.5);
    });

    it('duration: rejects a 100-year duration (operator typo — wrong col)', () => {
      expect(parseCpaFinancialField('100', { min: 0, max: 50 })).toBe(null);
    });
  });
});
