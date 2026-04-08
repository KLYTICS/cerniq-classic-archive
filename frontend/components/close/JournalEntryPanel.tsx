'use client';

/**
 * JournalEntryPanel — list + form for posting balanced journal entries.
 *
 * Customer journey moment: Jose needs to record an accrual for SaaS.
 * He clicks "New JE", types 2 lines (debit expense, credit accrued
 * liability), and the balance indicator at the bottom turns green
 * exactly when the debits equal the credits. He hits Post. The JE
 * appears in the list above with a green POSTED pill, and the
 * activity strip on the cycle workspace updates within 30 seconds.
 *
 * Key design choices:
 *   - Live balance check — running totals under the form, color-coded
 *   - Post button disabled until balanced (no round-trip needed to know)
 *   - Memo fields bilingual EN/ES so the audit binder reads cleanly
 *   - Empty "add line" row always visible at the bottom so the keyboard
 *     flow (tab → tab → tab) never stalls
 */

import { useMemo, useState } from 'react';
import { Link2, Loader2, Plus, Trash2 } from 'lucide-react';
import {
  DataTable,
  type DataTableColumn,
  MetricStrip,
} from '@/components/ui/cerniq';
import { closeApi, type CloseCycleDetail, type CloseJournalEntry } from '@/lib/close-api';
import { computeTotals, type JeLineDraft } from './journalEntryMath';
import { JournalEntryDetailDrawer } from './JournalEntryDetailDrawer';

type Lang = 'en' | 'es';

interface JournalEntryPanelProps {
  cycle: CloseCycleDetail;
  lang: Lang;
  onJournalEntryPosted: (je: CloseJournalEntry) => void;
  locked: boolean;
  onToast?: (message: string, variant: 'success' | 'error') => void;
}

function emptyLine(): JeLineDraft {
  return { account: '', debit: '', credit: '' };
}

function defaultReference(cycle: CloseCycleDetail, existingCount: number): string {
  const seq = String(existingCount + 1).padStart(3, '0');
  return `JE-${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}-${seq}`;
}

function fmtUsd(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(v);
}

export function JournalEntryPanel({
  cycle,
  lang,
  onJournalEntryPosted,
  locked,
  onToast,
}: JournalEntryPanelProps) {
  const jes = cycle.journalEntries ?? [];
  const [showForm, setShowForm] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [reference, setReference] = useState('');
  const [memoEn, setMemoEn] = useState('');
  const [memoEs, setMemoEs] = useState('');
  const [lines, setLines] = useState<JeLineDraft[]>([emptyLine(), emptyLine()]);
  const [evidenceUrls, setEvidenceUrls] = useState<string[]>([]);
  const [evidenceInput, setEvidenceInput] = useState('');
  const [drillEntryId, setDrillEntryId] = useState<string | null>(null);
  const drillEntry = drillEntryId ? jes.find((j) => j.id === drillEntryId) ?? null : null;

  const totals = useMemo(() => computeTotals(lines), [lines]);

  function openForm() {
    setReference(defaultReference(cycle, jes.length));
    setMemoEn('');
    setMemoEs('');
    setLines([emptyLine(), emptyLine()]);
    setEvidenceUrls([]);
    setEvidenceInput('');
    setError(null);
    setShowForm(true);
  }

  function addEvidence() {
    const url = evidenceInput.trim();
    if (!url) return;
    setEvidenceUrls((prev) => [...prev, url]);
    setEvidenceInput('');
  }

  function removeEvidence(idx: number) {
    setEvidenceUrls((prev) => prev.filter((_, i) => i !== idx));
  }

  function closeForm() {
    setShowForm(false);
    setError(null);
  }

  function updateLine(idx: number, patch: Partial<JeLineDraft>) {
    setLines((prev) => prev.map((l, i) => (i === idx ? { ...l, ...patch } : l)));
  }

  function removeLine(idx: number) {
    setLines((prev) => (prev.length > 2 ? prev.filter((_, i) => i !== idx) : prev));
  }

  function addLine() {
    setLines((prev) => [...prev, emptyLine()]);
  }

  async function submit(e: React.FormEvent) {
    e.preventDefault();
    if (submitting) return;
    if (!reference.trim()) {
      setError(lang === 'en' ? 'Reference is required' : 'La referencia es requerida');
      return;
    }
    if (!memoEn.trim() || !memoEs.trim()) {
      setError(lang === 'en' ? 'Both EN and ES memos are required' : 'Se requieren memos en inglés y español');
      return;
    }
    if (!totals.balanced) {
      setError(lang === 'en' ? 'JE is not balanced' : 'El asiento no está cuadrado');
      return;
    }
    setSubmitting(true);
    setError(null);
    try {
      const created = await closeApi.postJournalEntry(cycle.id, {
        reference: reference.trim(),
        memoEn: memoEn.trim(),
        memoEs: memoEs.trim(),
        lines: lines.map((l) => ({
          account: l.account.trim(),
          debit: Number(l.debit) || 0,
          credit: Number(l.credit) || 0,
          dimension: l.dimension?.trim() || undefined,
        })),
        evidenceUrls: evidenceUrls.length > 0 ? evidenceUrls : undefined,
      });
      onJournalEntryPosted(created);
      onToast?.(
        lang === 'en' ? `JE ${reference} posted` : `Asiento ${reference} registrado`,
        'success',
      );
      closeForm();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'Post failed';
      setError(msg);
      onToast?.(msg, 'error');
    } finally {
      setSubmitting(false);
    }
  }

  const totalAmount = jes.reduce((s, j) => s + Number(j.totalDebit), 0);
  const postedCount = jes.filter((j) => j.status === 'POSTED').length;

  const columns: DataTableColumn<CloseJournalEntry>[] = [
    {
      key: 'reference',
      header: lang === 'en' ? 'Reference' : 'Referencia',
      cell: (r) => <span className="font-mono text-slate-900">{r.reference}</span>,
      sortValue: (r) => r.reference,
      width: '180px',
    },
    {
      key: 'memo',
      header: lang === 'en' ? 'Memo' : 'Memo',
      cell: (r) => (
        <span className="text-slate-700">{lang === 'en' ? r.memoEn : r.memoEs}</span>
      ),
      sortValue: (r) => (lang === 'en' ? r.memoEn : r.memoEs),
    },
    {
      key: 'amount',
      header: lang === 'en' ? 'Amount' : 'Monto',
      cell: (r) => fmtUsd(r.totalDebit),
      sortValue: (r) => Number(r.totalDebit),
      align: 'right',
      numeric: true,
      width: '140px',
    },
    {
      key: 'status',
      header: lang === 'en' ? 'Status' : 'Estado',
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
            r.status === 'POSTED'
              ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
              : 'border-slate-200 bg-slate-50 text-slate-600'
          }`}
        >
          {r.status}
        </span>
      ),
      sortValue: (r) => r.status,
      width: '110px',
    },
  ];

  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          { label: lang === 'en' ? 'Posted' : 'Registrados', value: postedCount },
          { label: lang === 'en' ? 'Total' : 'Total', value: jes.length },
          { label: lang === 'en' ? 'Amount' : 'Monto', value: fmtUsd(totalAmount) },
          {
            label: lang === 'en' ? 'Period' : 'Período',
            value: `${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}`,
          },
        ]}
      />

      {!locked ? (
        <div className="flex justify-end">
          <button
            type="button"
            onClick={showForm ? closeForm : openForm}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Plus className="h-4 w-4" />
            {showForm ? (lang === 'en' ? 'Cancel' : 'Cancelar') : lang === 'en' ? 'New JE' : 'Asiento nuevo'}
          </button>
        </div>
      ) : null}

      {showForm ? (
        <form
          onSubmit={submit}
          className="space-y-4 rounded-xl border border-slate-200 bg-white p-4 shadow-sm"
        >
          <div className="grid gap-3 sm:grid-cols-3">
            <Field label={lang === 'en' ? 'Reference' : 'Referencia'}>
              <input
                type="text"
                value={reference}
                onChange={(e) => setReference(e.target.value)}
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
            <Field label={lang === 'en' ? 'Memo (EN)' : 'Memo (EN)'}>
              <input
                type="text"
                value={memoEn}
                onChange={(e) => setMemoEn(e.target.value)}
                placeholder="Accrue monthly SaaS…"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
            <Field label={lang === 'en' ? 'Memo (ES)' : 'Memo (ES)'}>
              <input
                type="text"
                value={memoEs}
                onChange={(e) => setMemoEs(e.target.value)}
                placeholder="Acumular SaaS mensual…"
                className="w-full rounded-md border border-slate-300 px-2 py-1.5 text-sm focus:border-slate-500 focus:outline-none"
              />
            </Field>
          </div>

          {/* Lines table */}
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
                  <th className="border-b border-slate-200 w-8" />
                </tr>
              </thead>
              <tbody>
                {lines.map((line, i) => (
                  <tr key={i} className="border-b border-slate-100 last:border-b-0">
                    <td className="px-2 py-1">
                      <input
                        type="text"
                        value={line.account}
                        onChange={(e) => updateLine(i, { account: e.target.value })}
                        placeholder="5400 Technology / SaaS"
                        className="w-full rounded border border-transparent px-2 py-1 text-sm focus:border-slate-300 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={line.debit}
                        onChange={(e) => updateLine(i, { debit: e.target.value })}
                        className="w-full rounded border border-transparent px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-slate-300 focus:outline-none"
                      />
                    </td>
                    <td className="px-2 py-1 text-right">
                      <input
                        type="number"
                        step="0.01"
                        value={line.credit}
                        onChange={(e) => updateLine(i, { credit: e.target.value })}
                        className="w-full rounded border border-transparent px-2 py-1 text-right font-mono text-sm tabular-nums focus:border-slate-300 focus:outline-none"
                      />
                    </td>
                    <td className="px-1">
                      <button
                        type="button"
                        onClick={() => removeLine(i)}
                        disabled={lines.length <= 2}
                        className="rounded p-1 text-slate-300 hover:bg-rose-50 hover:text-rose-600 disabled:cursor-not-allowed disabled:opacity-40"
                        aria-label={lang === 'en' ? 'Remove line' : 'Eliminar línea'}
                      >
                        <Trash2 className="h-3.5 w-3.5" />
                      </button>
                    </td>
                  </tr>
                ))}
              </tbody>
              <tfoot className="bg-slate-50">
                <tr>
                  <td className="px-2 py-1.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {lang === 'en' ? 'Totals' : 'Totales'}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm tabular-nums text-slate-900">
                    {fmtUsd(totals.totalDebit)}
                  </td>
                  <td className="px-2 py-1.5 text-right font-mono text-sm tabular-nums text-slate-900">
                    {fmtUsd(totals.totalCredit)}
                  </td>
                  <td />
                </tr>
              </tfoot>
            </table>
          </div>

          {/* Evidence URL list */}
          <div>
            <div className="mb-1.5 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'Evidence' : 'Evidencia'}
            </div>
            {evidenceUrls.length > 0 ? (
              <ul className="mb-2 space-y-1">
                {evidenceUrls.map((url, i) => (
                  <li
                    key={`${url}-${i}`}
                    className="flex items-center justify-between gap-2 rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                  >
                    <a
                      href={url}
                      target="_blank"
                      rel="noreferrer"
                      className="flex min-w-0 items-center gap-1.5 truncate text-blue-700 hover:underline"
                    >
                      <Link2 className="h-3 w-3 shrink-0" />
                      <span className="truncate">{url}</span>
                    </a>
                    <button
                      type="button"
                      onClick={() => removeEvidence(i)}
                      className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                      aria-label={lang === 'en' ? 'Remove' : 'Quitar'}
                    >
                      <Trash2 className="h-3 w-3" />
                    </button>
                  </li>
                ))}
              </ul>
            ) : null}
            <div className="flex gap-1.5">
              <input
                type="url"
                value={evidenceInput}
                placeholder="https://…"
                onChange={(e) => setEvidenceInput(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    addEvidence();
                  }
                }}
                className="flex-1 rounded-md border border-slate-300 px-2 py-1.5 text-xs focus:border-slate-500 focus:outline-none"
              />
              <button
                type="button"
                onClick={addEvidence}
                disabled={!evidenceInput.trim()}
                className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2.5 py-1.5 text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50"
              >
                <Plus className="h-3 w-3" />
                {lang === 'en' ? 'Attach' : 'Adjuntar'}
              </button>
            </div>
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2">
            <button
              type="button"
              onClick={addLine}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            >
              <Plus className="h-3 w-3" />
              {lang === 'en' ? 'Add line' : 'Agregar línea'}
            </button>

            <div className="flex items-center gap-3">
              {/* Live balance indicator */}
              <div
                className={`inline-flex items-center gap-2 rounded-full border px-3 py-1 text-xs font-semibold ${
                  totals.balanced
                    ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                    : 'border-rose-200 bg-rose-50 text-rose-700'
                }`}
                aria-live="polite"
              >
                <span
                  className={`h-2 w-2 rounded-full ${totals.balanced ? 'bg-emerald-500' : 'bg-rose-500'}`}
                />
                {totals.balanced
                  ? lang === 'en'
                    ? 'Balanced'
                    : 'Cuadrado'
                  : lang === 'en'
                    ? `Δ ${fmtUsd(totals.difference)}`
                    : `Δ ${fmtUsd(totals.difference)}`}
              </div>

              <button
                type="submit"
                disabled={submitting || !totals.balanced}
                className="inline-flex items-center gap-2 rounded-full bg-emerald-600 px-5 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                {submitting ? <Loader2 className="h-4 w-4 animate-spin" /> : null}
                {lang === 'en' ? 'Post JE' : 'Registrar asiento'}
              </button>
            </div>
          </div>

          {error ? <p className="text-xs text-rose-600">{error}</p> : null}
        </form>
      ) : null}

      <DataTable
        columns={columns}
        rows={jes}
        rowKey={(r) => r.id}
        caption={lang === 'en' ? 'Journal entries' : 'Asientos'}
        emptyMessage={
          lang === 'en' ? 'No JEs posted yet — click "New JE" to add one.' : 'Sin asientos aún — haga clic en "Asiento nuevo".'
        }
        selectable
        onRowClick={(r) => setDrillEntryId(r.id)}
      />

      <JournalEntryDetailDrawer
        entry={drillEntry}
        cycleId={cycle.id}
        lang={lang}
        locked={locked}
        open={drillEntryId !== null}
        onClose={() => setDrillEntryId(null)}
      />
    </div>
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
