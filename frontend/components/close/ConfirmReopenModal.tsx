'use client';

/**
 * ConfirmReopenModal — destructive-action confirmation for reopening a
 * previously signed-off close cycle.
 *
 * Customer journey moment: Maria discovers a miscoded JE in the March
 * close that was signed off last week. She opens the frozen cycle,
 * clicks "Reopen", types a reason ("AP accrual posted to wrong
 * account — correcting per CFO approval"), and confirms. The cycle
 * transitions back to REOPENED and becomes editable. The reason is
 * stored on the CloseActivity row forever — auditors see it in the
 * binder next close.
 *
 * Why a reason is required: reopens are the one place where the audit
 * trail can look sketchy. A reopen with a good reason ("Found bug in
 * bank rec import, re-running tie-out") is fine. A reopen with no
 * reason looks like tampering. The 10-character minimum prevents
 * "typo" from being an acceptable explanation.
 */

import { useState } from 'react';
import { AlertTriangle, Loader2, Unlock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { CloseCycleDetail } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface ConfirmReopenModalProps {
  open: boolean;
  cycle: CloseCycleDetail;
  lang: Lang;
  onCancel: () => void;
  onConfirm: (reason: string) => void;
  submitting?: boolean;
}

const MIN_REASON_LENGTH = 10;

export function ConfirmReopenModal({
  open,
  cycle,
  lang,
  onCancel,
  onConfirm,
  submitting = false,
}: ConfirmReopenModalProps) {
  const [reason, setReason] = useState('');

  const trimmed = reason.trim();
  const valid = trimmed.length >= MIN_REASON_LENGTH;
  const period = `${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}`;

  return (
    <Modal
      key={open ? `reopen-${cycle.id}` : 'reopen-closed'}
      open={open}
      onClose={submitting ? () => undefined : onCancel}
      title={lang === 'en' ? 'Reopen signed-off period?' : '¿Reabrir período aprobado?'}
      maxWidth="max-w-lg"
    >
      <div role="alertdialog" aria-live="assertive">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-snug text-amber-800">
            {lang === 'en'
              ? `Period ${period} was signed off. Reopening makes it editable again — the reason below is stored on the audit trail permanently and will appear on next close's binder.`
              : `El período ${period} fue aprobado. Reabrirlo lo hace editable de nuevo — el motivo de abajo se almacena permanentemente en el historial y aparecerá en la carpeta del próximo cierre.`}
          </p>
        </div>

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
                ? 'AP accrual posted to wrong account — correcting per CFO approval.'
                : 'Acumulado AP registrado en cuenta equivocada — corrigiendo con aprobación del CFO.'
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
                {lang === 'en' ? 'Keep going — the audit binder deserves context.' : 'Siga — la carpeta de auditoría merece contexto.'}
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
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Unlock className="h-4 w-4" />}
            {lang === 'en' ? 'Reopen period' : 'Reabrir período'}
          </button>
        </div>
      </div>
    </Modal>
  );
}
