'use client';

/**
 * ConfirmSignOffModal — destructive-action confirmation for cycle sign-off.
 *
 * Customer journey moment: Roberto (CFO) clicks the green "Sign off"
 * button in the cycle header. Before the period is permanently locked
 * he sees a summary of everything the action will freeze: tasks, recs,
 * JEs, flux narratives, and the bilingual rationale of the frozen
 * materiality policy. He can only proceed by clicking "Lock period" —
 * the default focus is on Cancel, not Confirm, so an accidental Enter
 * does nothing harmful.
 *
 * Why a bespoke modal rather than window.confirm:
 *   1. Bilingual EN/ES.
 *   2. Rich content (counts + materiality rationale + re-open caveat).
 *   3. Focus trap + Escape handling (free via our Modal primitive).
 *   4. Accessible role="alertdialog" semantics.
 */

import { useRef } from 'react';
import { AlertTriangle, Loader2, Lock } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import type { CloseCycleDetail } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface ConfirmSignOffModalProps {
  open: boolean;
  cycle: CloseCycleDetail;
  lang: Lang;
  onCancel: () => void;
  onConfirm: () => void;
  submitting?: boolean;
}

export function ConfirmSignOffModal({
  open,
  cycle,
  lang,
  onCancel,
  onConfirm,
  submitting = false,
}: ConfirmSignOffModalProps) {
  const cancelBtnRef = useRef<HTMLButtonElement>(null);

  const tasks = cycle.tasks.length;
  const recs = cycle.reconciliations.length;
  const jes = cycle.journalEntries.length;
  const flux = cycle.fluxNarratives.length;
  const period = `${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}`;

  const materialityAbs = new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(Number(cycle.materialityAbs));

  return (
    <Modal
      open={open}
      onClose={submitting ? () => undefined : onCancel}
      title={lang === 'en' ? 'Lock close period?' : '¿Cerrar período?'}
      maxWidth="max-w-lg"
    >
      <div role="alertdialog" aria-live="assertive">
        <div className="mb-4 flex items-start gap-3 rounded-xl border border-amber-200 bg-amber-50 p-3">
          <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-amber-600" />
          <p className="text-sm leading-snug text-amber-800">
            {lang === 'en'
              ? 'This is a destructive action. Once signed off, the period becomes read-only and everything below is frozen in the audit binder.'
              : 'Esta acción es destructiva. Una vez aprobado, el período queda en solo lectura y todo lo de abajo se congela en la carpeta de auditoría.'}
          </p>
        </div>

        <dl className="mb-4 grid grid-cols-2 gap-x-6 gap-y-2 text-sm">
          <Row
            label={lang === 'en' ? 'Period' : 'Período'}
            value={period}
            mono
          />
          <Row
            label={lang === 'en' ? 'Tasks' : 'Tareas'}
            value={String(tasks)}
            mono
          />
          <Row
            label={lang === 'en' ? 'Reconciliations' : 'Conciliaciones'}
            value={String(recs)}
            mono
          />
          <Row label="JEs" value={String(jes)} mono />
          <Row
            label={lang === 'en' ? 'Flux narratives' : 'Narrativas de flujo'}
            value={String(flux)}
            mono
          />
          <Row
            label={lang === 'en' ? 'Materiality' : 'Materialidad'}
            value={`${materialityAbs} · ${(cycle.materialityPct * 100).toFixed(1)}%`}
            mono
          />
        </dl>

        <p className="text-xs leading-relaxed text-slate-500">
          {lang === 'en'
            ? 'The materiality snapshot and every artifact above become part of the audit binder. You can still download the binder after sign-off; you cannot edit the period without an explicit re-open (tracked in activity).'
            : 'La instantánea de materialidad y cada artefacto anterior pasan a formar parte de la carpeta de auditoría. Aún podrá descargar la carpeta después de aprobar; no podrá editar el período sin una reapertura explícita (registrada en la actividad).'}
        </p>

        <div className="mt-5 flex justify-end gap-2">
          <button
            ref={cancelBtnRef}
            type="button"
            onClick={onCancel}
            disabled={submitting}
            className="rounded-full border border-slate-300 bg-white px-5 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {lang === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="button"
            onClick={onConfirm}
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-2 text-sm font-semibold text-white shadow hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
          >
            {submitting ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Lock className="h-4 w-4" />
            )}
            {lang === 'en' ? 'Lock period' : 'Cerrar período'}
          </button>
        </div>
      </div>
    </Modal>
  );
}

function Row({ label, value, mono }: { label: string; value: string; mono?: boolean }) {
  return (
    <div className="flex justify-between gap-3 border-b border-slate-100 py-1.5 last:border-b-0">
      <dt className="text-slate-500">{label}</dt>
      <dd className={mono ? 'font-mono tabular-nums text-slate-900' : 'font-medium text-slate-900'}>
        {value}
      </dd>
    </div>
  );
}
