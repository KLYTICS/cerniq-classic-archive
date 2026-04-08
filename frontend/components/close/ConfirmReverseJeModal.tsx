'use client';

/**
 * ConfirmReverseJeModal — destructive-action confirmation for reversing
 * a posted journal entry.
 *
 * Customer journey moment: External CPA spot-checks the JEs and finds
 * one Maria posted to the wrong account. She opens the JE drawer,
 * clicks "Reverse", types a reason ("AP accrual posted to 5400 instead
 * of 5500 — reversing per CPA"), and confirms. The cockpit posts a new
 * offsetting JE referenced as `JE-2026-04-014-R`, marks the original
 * REVERSED, and writes a `JE_REVERSED` activity row with the full
 * reason. The audit trail is bulletproof — no edit, no delete, just an
 * immutable pair.
 *
 * Why ≥10 chars: same forcing function as cycle reopen. "typo" is not
 * an acceptable explanation in an audit binder.
 */

import { useState } from 'react';
import { AlertTriangle, Loader2, RotateCcw } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { CloseJournalEntry } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface ConfirmReverseJeModalProps {
  open: boolean;
  entry: CloseJournalEntry;
  lang: Lang;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting?: boolean;
}

const MIN_REASON_LENGTH = 10;

function fmtUsd(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export function ConfirmReverseJeModal({
  open,
  entry,
  lang,
  onCancel,
  onConfirm,
  submitting = false,
}: ConfirmReverseJeModalProps) {
  const [reason, setReason] = useState('');

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON_LENGTH;

  return (
    <Modal
      key={open ? `reverse-${entry.id}` : 'reverse-closed'}
      open={open}
      onClose={submitting ? () => undefined : onCancel}
      title={lang === 'en' ? 'Reverse journal entry?' : '¿Reversar asiento?'}
      maxWidth="max-w-lg"
    >
      <div role="alertdialog" aria-live="assertive">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-snug text-amber-800">
            {lang === 'en'
              ? 'A new offsetting JE will be posted (debits and credits swapped) and the original will be marked REVERSED. Both entries stay in the binder forever — auditors see the full pair and your reason.'
              : 'Se registrará un nuevo asiento que compensa (con débitos y créditos invertidos) y el original quedará marcado como REVERSADO. Ambos quedan en la carpeta para siempre — los auditores ven el par completo y el motivo.'}
          </p>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
            <dt className="text-slate-500">{lang === 'en' ? 'Original' : 'Original'}</dt>
            <dd className="font-mono text-slate-900">{entry.reference}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
            <dt className="text-slate-500">{lang === 'en' ? 'Reversal' : 'Reverso'}</dt>
            <dd className="font-mono text-slate-900">{entry.reference}-R</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
            <dt className="text-slate-500">{lang === 'en' ? 'Amount' : 'Monto'}</dt>
            <dd className="font-mono tabular-nums text-slate-900">{fmtUsd(entry.totalDebit)}</dd>
          </div>
          <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5">
            <dt className="text-slate-500">{lang === 'en' ? 'Memo' : 'Memo'}</dt>
            <dd className="truncate text-slate-700">{lang === 'en' ? entry.memoEn : entry.memoEs}</dd>
          </div>
        </dl>

        <label className="block">
          <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
            {lang === 'en' ? 'Reason' : 'Motivo'}
            <span className="ml-1 font-normal lowercase text-slate-400">
              {lang === 'en' ? `· min ${MIN_REASON_LENGTH} chars` : `· mín ${MIN_REASON_LENGTH} car`}
            </span>
          </span>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            rows={3}
            placeholder={
              lang === 'en'
                ? 'AP accrual posted to wrong account — reversing per CFO approval.'
                : 'Acumulado AP registrado en cuenta equivocada — reversando con aprobación del CFO.'
            }
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm leading-relaxed focus:border-slate-500 focus:outline-none"
            aria-invalid={!valid}
          />
          <div className="mt-1 flex justify-between text-[11px]">
            <span className={valid ? 'text-emerald-600' : 'text-slate-400'}>
              {trimmed.length}/{MIN_REASON_LENGTH}+
            </span>
            {!valid && trimmed.length > 0 ? (
              <span className="text-rose-600">
                {lang === 'en'
                  ? 'Keep going — the audit binder deserves context.'
                  : 'Siga — la carpeta de auditoría merece contexto.'}
              </span>
            ) : null}
          </div>
        </label>

        <div className="mt-5 flex justify-end gap-2">
          <button
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {lang === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={() => onConfirm(trimmed)}
            disabled={!valid || submitting}
            className="inline-flex items-center gap-2 rounded-full bg-amber-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-amber-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RotateCcw className="h-4 w-4" />
            )}
            {lang === 'en' ? 'Reverse JE' : 'Reversar asiento'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
