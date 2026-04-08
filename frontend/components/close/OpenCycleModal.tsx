'use client';

/**
 * OpenCycleModal — bilingual form to open a new month-end close cycle.
 *
 * Customer journey moment: First of the month, Maria opens the cockpit and
 * needs to start a new cycle. She wants to do it in 3 fields and a hotkey:
 * year, month, target close. The default values prefill to the current
 * period and "today + 7 days" so the median click count is 2.
 */

import { useEffect, useMemo, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal } from '@/components/ui/Modal';
import { closeApi, type CloseCycleDetail } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface OpenCycleModalProps {
  open: boolean;
  onClose: () => void;
  orgId: string;
  lang: Lang;
  onCycleCreated: (cycle: CloseCycleDetail) => void;
}

const MONTHS_EN = [
  'January', 'February', 'March', 'April', 'May', 'June',
  'July', 'August', 'September', 'October', 'November', 'December',
];
const MONTHS_ES = [
  'Enero', 'Febrero', 'Marzo', 'Abril', 'Mayo', 'Junio',
  'Julio', 'Agosto', 'Septiembre', 'Octubre', 'Noviembre', 'Diciembre',
];

function defaultTarget(): string {
  const d = new Date();
  d.setDate(d.getDate() + 7);
  return d.toISOString().slice(0, 10);
}

export function OpenCycleModal({ open, onClose, orgId, lang, onCycleCreated }: OpenCycleModalProps) {
  const now = useMemo(() => new Date(), []);
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [targetCloseAt, setTargetCloseAt] = useState(defaultTarget());
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Reset form whenever the modal opens. Avoids showing stale values from
  // a previous attempt the user dismissed.
  useEffect(() => {
    if (open) {
      setYear(now.getFullYear());
      setMonth(now.getMonth() + 1);
      setTargetCloseAt(defaultTarget());
      setError(null);
    }
  }, [open, now]);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    setSubmitting(true);
    setError(null);
    try {
      const created = await closeApi.createCycle(
        orgId,
        year,
        month,
        targetCloseAt ? new Date(targetCloseAt).toISOString() : undefined,
      );
      onCycleCreated(created);
      onClose();
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to open cycle');
    } finally {
      setSubmitting(false);
    }
  }

  const months = lang === 'en' ? MONTHS_EN : MONTHS_ES;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={lang === 'en' ? 'Open new close cycle' : 'Abrir ciclo nuevo'}
      maxWidth="max-w-md"
    >
      <form onSubmit={submit} className="space-y-4">
        <p className="text-sm text-slate-600">
          {lang === 'en'
            ? 'Pick the period and the target close date. Materiality is locked the moment the cycle opens.'
            : 'Elija el período y la fecha objetivo de cierre. La materialidad se congela al abrir el ciclo.'}
        </p>

        <div className="grid grid-cols-2 gap-3">
          <Field label={lang === 'en' ? 'Year' : 'Año'}>
            <input
              type="number"
              min={2000}
              max={2100}
              value={year}
              onChange={(e) => setYear(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 font-mono text-sm tabular-nums focus:border-slate-500 focus:outline-none"
            />
          </Field>
          <Field label={lang === 'en' ? 'Month' : 'Mes'}>
            <select
              value={month}
              onChange={(e) => setMonth(Number(e.target.value))}
              className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
            >
              {months.map((m, i) => (
                <option key={m} value={i + 1}>
                  {m}
                </option>
              ))}
            </select>
          </Field>
        </div>

        <Field label={lang === 'en' ? 'Target close date' : 'Fecha objetivo de cierre'}>
          <input
            type="date"
            value={targetCloseAt}
            onChange={(e) => setTargetCloseAt(e.target.value)}
            className="w-full rounded-md border border-slate-300 px-3 py-2 text-sm focus:border-slate-500 focus:outline-none"
          />
        </Field>

        {error ? <p className="text-xs text-rose-600">{error}</p> : null}

        <div className="flex justify-end gap-2 pt-2">
          <button
            type="button"
            onClick={onClose}
            className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
          >
            {lang === 'en' ? 'Cancel' : 'Cancelar'}
          </button>
          <button
            type="submit"
            disabled={submitting}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-5 py-1.5 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
            {lang === 'en' ? 'Open cycle' : 'Abrir ciclo'}
          </button>
        </div>
      </form>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
