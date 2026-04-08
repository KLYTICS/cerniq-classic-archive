'use client';

/**
 * JournalEntryDetailDrawer — slide-in drawer showing a posted JE's full
 * shape: header, line-by-line debit/credit table, evidence URLs,
 * posted-by metadata.
 *
 * Customer journey moment: the external CPA sends Maria a list of JE
 * references he wants to spot-check. She opens the cockpit, goes to the
 * JE tab, clicks each reference in sequence. Each click slides the
 * drawer in with every line of the JE visible without leaving the
 * cycle workspace. She tabs through them in under a minute.
 *
 * Mirrors TaskDetailDrawer's sheet pattern: right edge, focus trap via
 * keydown handler, body scroll lock, backdrop click to dismiss.
 */

import { useEffect, useState } from 'react';
import { Link2, RotateCcw, X } from 'lucide-react';
import { closeApi, type CloseJournalEntry } from '@/lib/close-api';
import { ConfirmReverseJeModal } from './ConfirmReverseJeModal';

type Lang = 'en' | 'es';

interface JeLine {
  account?: string;
  debit?: number;
  credit?: number;
  dimension?: string;
}

interface JournalEntryDetailDrawerProps {
  entry: CloseJournalEntry | null;
  cycleId: string;
  lang: Lang;
  open: boolean;
  locked: boolean;
  onClose: () => void;
  onReversed?: (reversalJe: CloseJournalEntry, originalReference: string) => void;
  onToast?: (message: string, variant: 'success' | 'error' | 'warning') => void;
}

function fmtUsd(n: string | number | undefined): string {
  if (n == null) return '—';
  const v = typeof n === 'string' ? Number(n) : n;
  if (!Number.isFinite(v)) return '—';
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export function JournalEntryDetailDrawer({
  entry,
  cycleId,
  lang,
  open,
  locked,
  onClose,
  onReversed,
  onToast,
}: JournalEntryDetailDrawerProps) {
  const [confirmReverseOpen, setConfirmReverseOpen] = useState(false);
  const [reversing, setReversing] = useState(false);

  useEffect(() => {
    if (!open) return;
    function onKey(e: KeyboardEvent) {
      if (e.key === 'Escape') onClose();
    }
    document.addEventListener('keydown', onKey);
    document.body.style.overflow = 'hidden';
    return () => {
      document.removeEventListener('keydown', onKey);
      document.body.style.overflow = '';
    };
  }, [open, onClose]);

  if (!entry) return null;
  // Narrow once so closures see a non-null value.
  const e: CloseJournalEntry = entry;

  const isReversal = e.reversesJeId != null;
  const isAlreadyReversed = e.status === 'REVERSED';
  const canReverse = !locked && e.status === 'POSTED' && !isReversal;

  async function handleConfirmedReverse(reason: string) {
    if (reversing) return;
    setReversing(true);
    try {
      const result = await closeApi.reverseJournalEntry(cycleId, e.id, reason);
      onReversed?.(result.reversalJe, result.originalReference);
      onToast?.(
        lang === 'en'
          ? `Reversed ${result.originalReference} → ${result.reversalJe.reference}`
          : `${result.originalReference} reversado → ${result.reversalJe.reference}`,
        'success',
      );
      setConfirmReverseOpen(false);
      onClose();
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Reversal failed', 'error');
    } finally {
      setReversing(false);
    }
  }

  // `entry.lines` is stored as JSON on the backend; cast defensively.
  const lines: JeLine[] = Array.isArray(entry.lines) ? (entry.lines as JeLine[]) : [];
  const totalDebit = Number(entry.totalDebit);
  const totalCredit = Number(entry.totalCredit);

  return (
    <>
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'en' ? 'Journal entry detail' : 'Detalle de asiento'}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {lang === 'en' ? 'Journal entry' : 'Asiento'}
              </div>
              <h2 className="mt-0.5 font-mono text-lg font-bold text-slate-900">
                {entry.reference}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                    entry.status === 'POSTED'
                      ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                      : 'border-slate-200 bg-slate-50 text-slate-600'
                  }`}
                >
                  {entry.status}
                </span>
                {isReversal ? (
                  <span className="inline-flex items-center rounded-full border border-indigo-200 bg-indigo-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-indigo-700">
                    {lang === 'en' ? 'Reversal entry' : 'Asiento reverso'}
                  </span>
                ) : null}
                {isAlreadyReversed ? (
                  <span className="inline-flex items-center rounded-full border border-slate-200 bg-slate-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-slate-600">
                    {lang === 'en' ? 'Already reversed' : 'Ya reversado'}
                  </span>
                ) : null}
              </div>
            </div>
            <div className="flex items-center gap-2">
              {canReverse ? (
                <button
                  type="button"
                  onClick={() => setConfirmReverseOpen(true)}
                  className="inline-flex items-center gap-1.5 rounded-full border border-amber-200 bg-amber-50 px-3 py-1.5 text-xs font-semibold text-amber-700 hover:bg-amber-100"
                >
                  <RotateCcw className="h-3.5 w-3.5" />
                  {lang === 'en' ? 'Reverse' : 'Reversar'}
                </button>
              ) : null}
              <button
                type="button"
                onClick={onClose}
                className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
                aria-label={lang === 'en' ? 'Close' : 'Cerrar'}
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </header>

        <div className="flex-1 space-y-5 px-5 py-5">
          {/* Memos */}
          <section>
            <div className="mb-1 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'Memo' : 'Memo'}
            </div>
            <p className="text-sm leading-relaxed text-slate-700">
              {lang === 'en' ? entry.memoEn : entry.memoEs}
            </p>
            {/* Show the other language in a subtle trailing note */}
            <p className="mt-1 text-[11px] italic leading-relaxed text-slate-400">
              {lang === 'en' ? entry.memoEs : entry.memoEn}
            </p>
          </section>

          {/* Lines table */}
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? `Lines (${lines.length})` : `Líneas (${lines.length})`}
            </div>
            {lines.length === 0 ? (
              <p className="rounded-lg border border-slate-200 bg-slate-50 px-3 py-2 text-xs text-slate-500">
                {lang === 'en' ? 'This JE has no line items.' : 'Este asiento no tiene partidas.'}
              </p>
            ) : (
              <div className="overflow-hidden rounded-lg border border-slate-200">
                <table className="w-full border-collapse text-sm">
                  <thead className="bg-slate-50">
                    <tr>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-left text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {lang === 'en' ? 'Account' : 'Cuenta'}
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {lang === 'en' ? 'Debit' : 'Débito'}
                      </th>
                      <th className="border-b border-slate-200 px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-600">
                        {lang === 'en' ? 'Credit' : 'Crédito'}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {lines.map((line, i) => (
                      <tr key={i} className="border-b border-slate-100 last:border-b-0">
                        <td className="px-2 py-1.5 font-mono text-xs text-slate-900">
                          {line.account ?? '—'}
                          {line.dimension ? (
                            <span className="ml-1.5 rounded bg-slate-100 px-1 py-0.5 text-[9px] text-slate-500">
                              {line.dimension}
                            </span>
                          ) : null}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-slate-900">
                          {line.debit && line.debit > 0 ? fmtUsd(line.debit) : '—'}
                        </td>
                        <td className="px-2 py-1.5 text-right font-mono text-xs tabular-nums text-slate-900">
                          {line.credit && line.credit > 0 ? fmtUsd(line.credit) : '—'}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                  <tfoot className="bg-slate-50">
                    <tr>
                      <td className="px-2 py-1.5 text-right text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                        {lang === 'en' ? 'Totals' : 'Totales'}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {fmtUsd(totalDebit)}
                      </td>
                      <td className="px-2 py-1.5 text-right font-mono text-xs font-semibold tabular-nums text-slate-900">
                        {fmtUsd(totalCredit)}
                      </td>
                    </tr>
                  </tfoot>
                </table>
              </div>
            )}
          </section>

          {/* Evidence URLs */}
          <section>
            <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'Evidence' : 'Evidencia'}
            </div>
            {entry.evidenceUrls.length === 0 ? (
              <p className="text-sm text-slate-400">
                {lang === 'en' ? 'No evidence attached.' : 'Sin evidencia adjunta.'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {entry.evidenceUrls.map((url, i) => (
                  <li
                    key={`${url}-${i}`}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-1.5 truncate text-xs text-blue-700 hover:underline"
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                  </li>
                ))}
              </ul>
            )}
          </section>
        </div>
      </aside>
      <ConfirmReverseJeModal
        open={confirmReverseOpen}
        entry={e}
        lang={lang}
        onCancel={() => setConfirmReverseOpen(false)}
        onConfirm={handleConfirmedReverse}
        submitting={reversing}
      />
    </>
  );
}
