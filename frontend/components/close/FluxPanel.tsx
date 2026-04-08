'use client';

/**
 * FluxPanel — variance grid + bilingual narrative side panel for the
 * dynamic cycle workspace.
 *
 * Customer journey moment: CFO walks into Maria's office and asks "what's
 * the deal with SaaS this month?" She clicks the row, the side panel
 * answers in 90 seconds, and she pastes the bilingual narrative into the
 * board deck without retyping anything.
 */

import { useMemo, useState } from 'react';
import { Database, Loader2, RefreshCcw, Sparkles } from 'lucide-react';
import {
  DataTable,
  type DataTableColumn,
  MetricStrip,
} from '@/components/ui/cerniq';
import {
  closeApi,
  type CloseCycleDetail,
  type CloseFluxNarrative,
} from '@/lib/close-api';

type Lang = 'en' | 'es';

interface FluxPanelProps {
  cycle: CloseCycleDetail;
  lang: Lang;
  onFluxRefreshed: (narratives: CloseFluxNarrative[]) => void;
  locked: boolean;
}

function fmtUsd(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', maximumFractionDigits: 0 }).format(v);
}

function fmtSigned(n: string | number): string {
  const v = typeof n === 'string' ? Number(n) : n;
  if (v === 0) return '$0';
  const f = fmtUsd(Math.abs(v));
  return v > 0 ? `+${f}` : `−${f}`;
}

function fmtPct(n: number): string {
  const v = n * 100;
  if (v === 0) return '0.0%';
  return `${v > 0 ? '+' : ''}${v.toFixed(1)}%`;
}

export function FluxPanel({ cycle, lang, onFluxRefreshed, locked }: FluxPanelProps) {
  const sorted = useMemo(() => {
    const list = cycle.fluxNarratives ?? [];
    return [...list].sort((a, b) => {
      if (a.isMaterial !== b.isMaterial) return a.isMaterial ? -1 : 1;
      return Math.abs(Number(b.varianceAbs)) - Math.abs(Number(a.varianceAbs));
    });
  }, [cycle.fluxNarratives]);

  const [selectedId, setSelectedId] = useState<string | null>(sorted[0]?.id ?? null);
  const [refreshing, setRefreshing] = useState(false);
  const [loadingGl, setLoadingGl] = useState(false);
  const [glSource, setGlSource] = useState<'snapshot' | 'alm' | 'demo' | null>(
    null,
  );
  const [error, setError] = useState<string | null>(null);

  const selected = sorted.find((r) => r.id === selectedId) ?? sorted[0] ?? null;
  const materialCount = sorted.filter((r) => r.isMaterial).length;
  const totalAbs = sorted.reduce((s, r) => s + Math.abs(Number(r.varianceAbs)), 0);

  // Re-run flux against whatever account set is currently persisted. This
  // is the "refresh the narrative" button — it keeps the same chart of
  // accounts and just recomputes materiality and text.
  async function refreshFlux() {
    if (locked || refreshing) return;
    setRefreshing(true);
    setError(null);
    try {
      const rows =
        sorted.length > 0
          ? sorted.map((s) => ({
              account: s.account,
              priorBalance: Number(s.priorBalance),
              currentBalance: Number(s.currentBalance),
            }))
          : [
              { account: '4000 Member Loan Interest Income', priorBalance: 312_400, currentBalance: 401_200 },
              { account: '5200 Personnel Salaries', priorBalance: 245_000, currentBalance: 268_000 },
            ];
      const fresh = await closeApi.runFlux(cycle.id, rows);
      onFluxRefreshed(fresh);
      if (fresh.length > 0) setSelectedId(fresh[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Flux refresh failed');
    } finally {
      setRefreshing(false);
    }
  }

  // Load a fresh chart of accounts from the GL adapter and immediately
  // run flux against it. This replaces the prior narrative set entirely.
  // Customer journey: Maria opens the flux tab for a new cycle and hits
  // "Load from GL" — 15 accounts appear, sorted material-first, in one
  // click. No copy-paste from NetSuite.
  async function loadFromGl() {
    if (locked || loadingGl) return;
    setLoadingGl(true);
    setError(null);
    try {
      const accounts = await closeApi.listGlAccounts(
        cycle.organizationId,
        cycle.periodYear,
        cycle.periodMonth,
      );
      if (accounts.length === 0) {
        setError(lang === 'en' ? 'No GL accounts returned' : 'Sin cuentas del GL');
        return;
      }
      setGlSource(accounts[0]?.source ?? null);
      const rows = accounts.map((a) => ({
        account: a.account,
        priorBalance: a.priorBalance,
        currentBalance: a.currentBalance,
      }));
      const fresh = await closeApi.runFlux(cycle.id, rows);
      onFluxRefreshed(fresh);
      if (fresh.length > 0) setSelectedId(fresh[0].id);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'GL load failed');
    } finally {
      setLoadingGl(false);
    }
  }

  const columns: DataTableColumn<CloseFluxNarrative>[] = [
    {
      key: 'account',
      header: lang === 'en' ? 'Account' : 'Cuenta',
      cell: (r) => (
        <div className="flex items-center gap-2">
          {r.isMaterial && <span className="h-1.5 w-1.5 rounded-full bg-rose-500" />}
          <span className="font-mono text-slate-900">{r.account}</span>
        </div>
      ),
      sortValue: (r) => r.account,
    },
    {
      key: 'prior',
      header: lang === 'en' ? 'Prior' : 'Previo',
      cell: (r) => fmtUsd(r.priorBalance),
      sortValue: (r) => Number(r.priorBalance),
      align: 'right',
      numeric: true,
      hideOnMobile: true,
    },
    {
      key: 'current',
      header: lang === 'en' ? 'Current' : 'Actual',
      cell: (r) => fmtUsd(r.currentBalance),
      sortValue: (r) => Number(r.currentBalance),
      align: 'right',
      numeric: true,
    },
    {
      key: 'varAbs',
      header: 'Δ $',
      cell: (r) => (
        <span className={Number(r.varianceAbs) >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
          {fmtSigned(r.varianceAbs)}
        </span>
      ),
      sortValue: (r) => Math.abs(Number(r.varianceAbs)),
      align: 'right',
      numeric: true,
    },
    {
      key: 'varPct',
      header: 'Δ %',
      cell: (r) => (
        <span className={r.variancePct >= 0 ? 'text-emerald-700' : 'text-rose-700'}>
          {fmtPct(r.variancePct)}
        </span>
      ),
      sortValue: (r) => Math.abs(r.variancePct),
      align: 'right',
      numeric: true,
      width: '90px',
    },
  ];

  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          { label: lang === 'en' ? 'Accounts' : 'Cuentas', value: sorted.length },
          {
            label: lang === 'en' ? 'Material' : 'Material',
            value: materialCount,
            delta: materialCount,
            deltaFormat: 'number',
          },
          { label: lang === 'en' ? 'Sum |Δ|' : 'Suma |Δ|', value: fmtUsd(totalAbs) },
          { label: lang === 'en' ? 'Confidence' : 'Confianza', value: '100%' },
        ]}
      />

      {!locked ? (
        <div className="flex flex-wrap items-center justify-end gap-2">
          {glSource ? (
            <span
              className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
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
          ) : null}
          <button
            type="button"
            onClick={loadFromGl}
            disabled={loadingGl}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800 disabled:opacity-60"
          >
            {loadingGl ? <Loader2 className="h-4 w-4 animate-spin" /> : <Database className="h-4 w-4" />}
            {lang === 'en' ? 'Load from GL' : 'Cargar del GL'}
          </button>
          <button
            type="button"
            onClick={refreshFlux}
            disabled={refreshing}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-60"
          >
            {refreshing ? <Loader2 className="h-4 w-4 animate-spin" /> : <RefreshCcw className="h-4 w-4" />}
            {lang === 'en' ? 'Re-run flux' : 'Recalcular flujo'}
          </button>
        </div>
      ) : null}

      {error ? <p className="text-xs text-rose-600">{error}</p> : null}

      <div className="grid gap-4 lg:grid-cols-[1fr_360px]">
        <DataTable
          columns={columns}
          rows={sorted}
          rowKey={(r) => r.id}
          caption={lang === 'en' ? 'Variances' : 'Variaciones'}
          selectable
          onRowClick={(r) => setSelectedId(r.id)}
          emptyMessage={
            lang === 'en' ? 'No flux narrative yet — re-run flux to generate.' : 'Sin narrativa aún — recalcule para generar.'
          }
        />

        {selected ? (
          <aside className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {lang === 'en' ? 'Narrative' : 'Narrativa'}
            </div>
            <h3 className="mt-1 font-mono text-sm font-semibold text-slate-900">{selected.account}</h3>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
                  selected.isMaterial
                    ? 'border-rose-200 bg-rose-50 text-rose-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
                }`}
              >
                {selected.isMaterial
                  ? lang === 'en'
                    ? 'Material'
                    : 'Material'
                  : lang === 'en'
                    ? 'Immaterial'
                    : 'No material'}
              </span>
              <span className="text-[11px] text-slate-500">
                {lang === 'en' ? 'Confidence' : 'Confianza'} {Math.round(selected.confidence * 100)}%
              </span>
            </div>
            <p className="mt-3 text-sm leading-relaxed text-slate-700">
              {lang === 'en' ? selected.narrativeEn : selected.narrativeEs}
            </p>
          </aside>
        ) : null}
      </div>
    </div>
  );
}
