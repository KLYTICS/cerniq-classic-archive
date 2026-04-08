import { describe, it, expect } from 'vitest';
import { computeTotals, parseLine, JE_BALANCE_TOLERANCE } from './journalEntryMath';

describe('parseLine', () => {
  it('treats empty strings as zero', () => {
    expect(parseLine({ account: 'x', debit: '', credit: '' })).toEqual({ debit: 0, credit: 0 });
  });
  it('parses valid numbers', () => {
    expect(parseLine({ account: 'x', debit: '123.45', credit: '0' })).toEqual({
      debit: 123.45,
      credit: 0,
    });
  });
  it('returns null for non-numeric inputs', () => {
    expect(parseLine({ account: 'x', debit: 'abc', credit: '0' })).toEqual({
      debit: null,
      credit: 0,
    });
  });
});

describe('computeTotals', () => {
  it('balances a simple two-line JE', () => {
    const totals = computeTotals([
      { account: '5400 SaaS', debit: '500', credit: '' },
      { account: '2100 Accrued Liabilities', debit: '', credit: '500' },
    ]);
    expect(totals.totalDebit).toBe(500);
    expect(totals.totalCredit).toBe(500);
    expect(totals.difference).toBe(0);
    expect(totals.balanced).toBe(true);
    expect(totals.firstInvalidLineIndex).toBeNull();
  });

  it('reports the difference when unbalanced', () => {
    const totals = computeTotals([
      { account: 'a', debit: '100', credit: '' },
      { account: 'b', debit: '', credit: '90' },
    ]);
    expect(totals.difference).toBe(10);
    expect(totals.balanced).toBe(false);
  });

  it('flags any line with a missing account', () => {
    const totals = computeTotals([
      { account: '', debit: '100', credit: '' },
      { account: 'b', debit: '', credit: '100' },
    ]);
    expect(totals.firstInvalidLineIndex).toBe(0);
    expect(totals.balanced).toBe(false);
  });

  it('flags lines with NaN inputs', () => {
    const totals = computeTotals([
      { account: 'a', debit: 'oops', credit: '' },
      { account: 'b', debit: '', credit: '100' },
    ]);
    expect(totals.firstInvalidLineIndex).toBe(0);
    expect(totals.balanced).toBe(false);
  });

  it('rejects empty JEs (totalDebit must be > 0)', () => {
    const totals = computeTotals([
      { account: 'a', debit: '0', credit: '' },
      { account: 'b', debit: '', credit: '0' },
    ]);
    expect(totals.totalDebit).toBe(0);
    expect(totals.balanced).toBe(false);
  });

  it('tolerates sub-penny floating point noise', () => {
    // 0.1 + 0.2 = 0.30000000000000004 in IEEE 754 — within tolerance.
    const totals = computeTotals([
      { account: 'a', debit: '0.1', credit: '' },
      { account: 'b', debit: '0.2', credit: '' },
      { account: 'c', debit: '', credit: '0.3' },
    ]);
    expect(Math.abs(totals.difference)).toBeLessThanOrEqual(JE_BALANCE_TOLERANCE);
    expect(totals.balanced).toBe(true);
  });

  it('handles multi-line JEs (3 debits → 2 credits)', () => {
    const totals = computeTotals([
      { account: 'a', debit: '100', credit: '' },
      { account: 'b', debit: '50', credit: '' },
      { account: 'c', debit: '25', credit: '' },
      { account: 'd', debit: '', credit: '125' },
      { account: 'e', debit: '', credit: '50' },
    ]);
    expect(totals.totalDebit).toBe(175);
    expect(totals.totalCredit).toBe(175);
    expect(totals.balanced).toBe(true);
  });
});
