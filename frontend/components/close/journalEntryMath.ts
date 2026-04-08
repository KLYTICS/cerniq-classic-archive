/**
 * Pure journal-entry math.
 *
 * Extracted from JournalEntryPanel so the balance logic is unit-testable
 * without spinning up React. Every function here is referentially
 * transparent — no Date.now(), no network, no DOM.
 */

export interface JeLineDraft {
  account: string;
  debit: string; // string because the input is a text field
  credit: string;
  dimension?: string;
}

export interface JeTotals {
  totalDebit: number;
  totalCredit: number;
  balanced: boolean;
  difference: number;
  firstInvalidLineIndex: number | null;
}

/** Pennies tolerance for balance comparison — matches the backend. */
export const JE_BALANCE_TOLERANCE = 0.01;

/**
 * Parse a draft line's numeric fields safely. Empty string reads as 0.
 * NaN reads as null (invalid) so callers can flag the line.
 */
export function parseLine(draft: JeLineDraft): { debit: number | null; credit: number | null } {
  const debit = draft.debit.trim() === '' ? 0 : Number(draft.debit);
  const credit = draft.credit.trim() === '' ? 0 : Number(draft.credit);
  return {
    debit: Number.isFinite(debit) ? debit : null,
    credit: Number.isFinite(credit) ? credit : null,
  };
}

/**
 * Compute running totals and balance state across all draft lines. A
 * valid JE has:
 *   - every line has an account
 *   - every line has valid numeric debit/credit
 *   - sum(debit) === sum(credit) within tolerance
 *   - total > 0 (no empty JEs)
 */
export function computeTotals(lines: JeLineDraft[]): JeTotals {
  let totalDebit = 0;
  let totalCredit = 0;
  let firstInvalidLineIndex: number | null = null;

  lines.forEach((line, i) => {
    const parsed = parseLine(line);
    if (parsed.debit === null || parsed.credit === null || !line.account.trim()) {
      if (firstInvalidLineIndex === null) firstInvalidLineIndex = i;
      return;
    }
    totalDebit += parsed.debit;
    totalCredit += parsed.credit;
  });

  totalDebit = +totalDebit.toFixed(2);
  totalCredit = +totalCredit.toFixed(2);
  const difference = +(totalDebit - totalCredit).toFixed(2);
  const balanced =
    firstInvalidLineIndex === null &&
    totalDebit > 0 &&
    Math.abs(difference) <= JE_BALANCE_TOLERANCE;

  return { totalDebit, totalCredit, balanced, difference, firstInvalidLineIndex };
}
