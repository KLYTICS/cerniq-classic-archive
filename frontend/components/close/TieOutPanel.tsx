'use client';

/**
 * TieOutPanel — reconciliation grid + run-tie-out form for the dynamic
 * cycle workspace.
 *
 * Customer journey moment: Maria pastes her bank statement total into the
 * "Run tie-out" form, the engine matches what it can, and any unmatched
 * lines surface immediately as exceptions she can hand to her staff.
 */

import { useState } from 'react';
import { Database, Loader2, Plus, Sparkles } from 'lucide-react';
import {
  DataTable,
  type DataTableColumn,
  MetricStrip,
} from '@/components/ui/cerniq';
import {
  closeApi,
  type CloseCycleDetail,
  type CloseReconciliation,
  type ReconciliationStatus,
  type ReconciliationType,
} from '@/lib/close-api';
import { ReconExceptionDrawer } from './ReconExceptionDrawer';

type Lang = 'en' | 'es';

const STATUS_COLOR: Record<ReconciliationStatus, string> = {
  OPEN: 'border-slate-200 bg-slate-50 text-slate-600',
  TIE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  EXCEPTION: 'border-rose-200 bg-rose-50 text-rose-700',
  REVIEWED: 'border-blue-200 bg-blue-50 text-blue-700',
  SIGNED_OFF: 'border-emerald-200 bg-emerald-50 text-emerald-700',
};

const RECON_TYPES: ReconciliationType[] = [
  'BANK',
  'AP_SUBLEDGER',
  'AR_SUBLEDGER',
  'INTERCOMPANY',
  'PREPAID',
  'ACCRUAL',
  'FIXED_ASSET',
];

interface TieOutPanelProps {
  cycle: CloseCycleDetail;
  lang: Lang;
  onReconAdded: (r: CloseReconciliation) => void;
  /** Called when an existing recon is updated (e.g. status change). */
  onReconUpdated?: (r: CloseReconciliation) => void;
  onToast?: (message: string, variant: 'success' | 'error') => void;
  locked: boolean;
}

function fmtUsd(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

function fmtSigned(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (v === 0) return '$0.00';
  const f = fmtUsd(Math.abs(v));
  return v > 0 ? `+${f}` : `−${f}`;
}

export function TieOutPanel({
  cycle,
  lang,
  onReconAdded,
  onReconUpdated,
  onToast,
  locked,
}: TieOutPanelProps) {
  const recs = cycle.reconciliations ?? [];
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [pullingGl, setPullingGl] = useState(false);
  const [form, setForm] = useState({
    account: '',
    reconType: 'BANK' as ReconciliationType,
    glBalance: '',
    externalBalance: '',
  });
  const [glSource, setGlSource] = useState<'snapshot' | 'alm' | 'demo' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);
  const [drillReconId, setDrillReconId] = useState<string | null>(null);
  const drillRecon = drillReconId ? recs.find((r) => r.id === drillReconId) ?? null : null;

  async function pullFromGl() {
    const account = form.account.trim();
    if (!account) {
      setError(lang === 'en' ? 'Enter an account first' : 'Ingrese una cuenta primero');
      return;
    }
    setError(null);
    setPullingGl(true);
    try {
      const result = await closeApi.getGlBalance(
        cycle.organizationId,
        account,
        cycle.periodYear,
        cycle.periodMonth,
      );
      setForm((prev) => ({ ...prev, glBalance: result.balance.toFixed(2) }));
      setGlSource(result.source);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GL lookup failed');
    } finally {
      setPullingGl(false);
    }
  }

  const tieCount = recs.filter((r) => r.status === 'TIE' || r.status === 'SIGNED_OFF').length;
  const exceptionCount = recs.filter((r) => r.status === 'EXCEPTION').length;
  const totalAbsDiff = recs.reduce((s, r) => s + Math.abs(Number(r.difference)), 0);

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    setError(null);
    if (!form.account.trim()) {
      setError(lang === 'en' ? 'Account is required' : 'La cuenta es requerida');
      return;
    }
    const gl = Number(form.glBalance);
    const ext = Number(form.externalBalance);
    if (Number.isNaN(gl) || Number.isNaN(ext)) {
      setError(lang === 'en' ? 'Balances must be numeric' : 'Los saldos deben ser numéricos');
      return;
    }
    setSubmitting(true);
    try {
      const created = await closeApi.runTieOut(cycle.id, {
        account: form.account.trim(),
        reconType: form.reconType,
        glBalance: gl,
        externalBalance: ext,
        lines: [],
      });
      onReconAdded(created);
      setForm({ account: '', reconType: 'BANK', glBalance: '', externalBalance: '' });
      setShowForm(false);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Tie-out failed');
    } finally {
      setSubmitting(false);
    }
  }

  const columns: DataTableColumn<CloseReconciliation>[] = [
    {
      key: 'account',
      header: lang === 'en' ? 'Account' : 'Cuenta',
      cell: (r) => <span className="font-mono text-slate-900">{r.account}</span>,
      sortValue: (r) => r.account,
    },
    {
      key: 'type',
      header: lang === 'en' ? 'Type' : 'Tipo',
      cell: (r) => <span className="text-xs uppercase tracking-wider text-slate-500">{r.reconType}</span>,
      sortValue: (r) => r.reconType,
      width: '140px',
      hideOnMobile: true,
    },
    {
      key: 'gl',
      header: 'GL',
      cell: (r) => fmtUsd(r.glBalance),
      sortValue: (r) => Number(r.glBalance),
      align: 'right',
      numeric: true,
    },
    {
      key: 'ext',
      header: lang === 'en' ? 'External' : 'Externo',
      cell: (r) => fmtUsd(r.externalBalance),
      sortValue: (r) => Number(r.externalBalance),
      align: 'right',
      numeric: true,
    },
    {
      key: 'diff',
      header: lang === 'en' ? 'Difference' : 'Diferencia',
      cell: (r) => (
        <span className={Number(r.difference) === 0 ? 'text-slate-400' : 'text-rose-600'}>
          {fmtSigned(r.difference)}
        </span>
      ),
      sortValue: (r) => Math.abs(Number(r.difference)),
      align: 'right',
      numeric: true,
    },
    {
      key: 'status',
      header: lang === 'en' ? 'Status' : 'Estado',
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLOR[r.status]}`}
        >
          {r.status}
        </span>
      ),
      sortValue: (r) => r.status,
      width: '120px',
    },
  ];

  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          { label: lang === 'en' ? 'In tie' : 'Cuadrado', value: tieCount },
          {
            label: lang === 'en' ? 'Exceptions' : 'Excepciones',
            value: exceptionCount,
            delta: exceptionCount,
            deltaFormat: 'number',
          },
          { label: lang === 'en' ? 'Sum |Δ|' : 'Suma |Δ|', value: fmtUsd(totalAbsDiff) },
          { label: lang === 'en' ? 'Total accts' : 'Total ctas', value: recs.length },
        ]}
      />

      {!locked ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={() => setShowForm((v) => !v)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {lang === 'en' ? 'Run tie-out' : 'Correr conciliación'}
          </button>
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={submit}
          className="rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-4">
            <FormField label={lang === 'en' ? 'Account' : 'Cuenta'}>
              <input
                type="text"
                value={form.account}
                onChange={(e) => setForm({ ...form, account: e.target.value })}
                placeholder="1010 Operating Cash"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              />
            </FormField>
            <FormField label={lang === 'en' ? 'Type' : 'Tipo'}>
              <select
                value={form.reconType}
                onChange={(e) => setForm({ ...form, reconType: e.target.value as ReconciliationType })}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              >
                {RECON_TYPES.map((t) => (
                  <option key={t} value={t}>
                    {t}
                  </option>
                ))}
              </select>
            </FormField>
            <FormField label="GL">
              <div className="flex gap-1">
                <input
                  type="number"
                  step="0.01"
                  value={form.glBalance}
                  onChange={(e) => {
                    setForm({ ...form, glBalance: e.target.value });
                    setGlSource(null);
                  }}
                  className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:border-slate-500 focus:outline-none"
                />
                <button
                  type="button"
                  onClick={pullFromGl}
                  disabled={pullingGl || !form.account.trim()}
                  title={lang === 'en' ? 'Pull from GL' : 'Traer del GL'}
                  aria-label={lang === 'en' ? 'Pull from GL' : 'Traer del GL'}
                  className="inline-flex shrink-0 items-center justify-center rounded-md border border-slate-300 bg-slate-50 px-2 text-slate-600 hover:border-slate-400 hover:bg-white disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {pullingGl ? (
                    <Loader2 className="h-3.5 w-3.5 animate-spin" />
                  ) : (
                    <Database className="h-3.5 w-3.5" />
                  )}
                </button>
              </div>
              {glSource ? (
                <div className="mt-1 flex items-center gap-1">
                  <span
                    className={`inline-flex items-center gap-1 rounded-full px-1.5 py-0.5 text-[9px] font-semibold uppercase tracking-wide ${
                      glSource === 'snapshot'
                        ? 'bg-emerald-50 text-emerald-700'
                        : glSource === 'alm'
                          ? 'bg-teal-50 text-teal-700'
                          : 'bg-amber-50 text-amber-700'
                    }`}
                  >
                    {glSource === 'snapshot' ? (
                      <>
                        <Database className="h-2.5 w-2.5" /> GL
                      </>
                    ) : glSource === 'alm' ? (
                      <>
                        <Database className="h-2.5 w-2.5" /> ALM
                      </>
                    ) : (
                      <>
                        <Sparkles className="h-2.5 w-2.5" /> DEMO
                      </>
                    )}
                  </span>
                </div>
              ) : null}
            </FormField>
            <FormField label={lang === 'en' ? 'External' : 'Externo'}>
              <input
                type="number"
                step="0.01"
                value={form.externalBalance}
                onChange={(e) => setForm({ ...form, externalBalance: e.target.value })}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-right font-mono text-sm tabular-nums focus:border-slate-500 focus:outline-none"
              />
            </FormField>
          </div>
          {error ? <p className="mt-3 text-xs text-rose-600">{error}</p> : null}
          <div className="mt-4 flex justify-end gap-2">
            <button
              type="button"
              onClick={() => setShowForm(false)}
              className="rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-medium text-slate-600 hover:bg-slate-50"
            >
              {lang === 'en' ? 'Cancel' : 'Cancelar'}
            </button>
            <button
              type="submit"
              disabled={submitting}
              className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:opacity-60"
            >
              {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
              {lang === 'en' ? 'Save' : 'Guardar'}
            </button>
          </div>
        </form>
      ) : null}

      <DataTable
        columns={columns}
        rows={recs}
        rowKey={(r) => r.id}
        caption={lang === 'en' ? 'Reconciliations' : 'Conciliaciones'}
        emptyMessage={lang === 'en' ? 'No reconciliations yet — run your first tie-out.' : 'Sin conciliaciones aún — corra su primera conciliación.'}
        selectable
        onRowClick={(r) => setDrillReconId(r.id)}
      />

      <ReconExceptionDrawer
        recon={drillRecon}
        cycleId={cycle.id}
        lang={lang}
        open={drillReconId !== null}
        locked={locked}
        onClose={() => setDrillReconId(null)}
        onReviewed={(updated) => {
          onReconUpdated?.(updated);
        }}
        onToast={onToast}
      />
    </div>
  );
}

function FormField({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="mb-1 block text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </span>
      {children}
    </label>
  );
}
