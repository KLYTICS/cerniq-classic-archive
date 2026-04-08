'use client';

/**
 * GlSnapshotPanel — inspector for the org's GL balance snapshot rows
 * scoped to the active cycle's period.
 *
 * Customer journey moment: Maria uploaded march.csv this morning. She
 * opens the cycle workspace, switches to the GL Snapshot tab, and sees
 * every account that's now in the snapshot table for March 2026 with
 * the source CSV name and the upload timestamp. She spots a typo in
 * "1010 Operating Cash" — clicks delete, gets a confirm, the row is
 * gone, then re-uploads the corrected CSV. The "Pull from GL" button
 * everywhere else in the cockpit instantly reflects the fix.
 *
 * UX choices:
 *   - Bloomberg-density DataTable with monospace numerics
 *   - Per-row delete with confirm (window.confirm — not a modal — because
 *     deleting a single GL row is a small action and a full modal is
 *     overkill compared to the destructive sign-off confirm)
 *   - Empty state explains the upload flow without leaving the page
 *   - "Upload GL CSV" button at the top opens the existing GlUploadModal
 *   - Reload-after-mutation pattern keeps the snapshot fresh
 */

import { useCallback, useEffect, useState } from 'react';
import { Database, Loader2, RefreshCcw, Trash2, Upload } from 'lucide-react';
import {
  DataTable,
  type DataTableColumn,
  EmptyState,
  ErrorBanner,
  MetricStrip,
  SkeletonLoader,
} from '@/components/ui/cerniq';
import { closeApi, type CloseCycleDetail, type GlSnapshotRow } from '@/lib/close-api';
import { GlUploadModal } from './GlUploadModal';

type Lang = 'en' | 'es';

interface GlSnapshotPanelProps {
  cycle: CloseCycleDetail;
  lang: Lang;
  locked: boolean;
  onToast?: (message: string, variant: 'success' | 'error' | 'warning') => void;
  /** Called after a successful upload so the parent can refetch the cycle. */
  onUploaded?: () => void;
}

function fmtUsd(n: number): string {
  return new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(n);
}

function fmtRelative(iso: string, now: Date, lang: Lang): string {
  const diffSec = Math.max(0, Math.round((now.getTime() - new Date(iso).getTime()) / 1000));
  if (lang === 'en') {
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    if (diffSec < 86400) return `${Math.floor(diffSec / 3600)}h ago`;
    return `${Math.floor(diffSec / 86400)}d ago`;
  }
  if (diffSec < 60) return `hace ${diffSec}s`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  if (diffSec < 86400) return `hace ${Math.floor(diffSec / 3600)}h`;
  return `hace ${Math.floor(diffSec / 86400)}d`;
}

export function GlSnapshotPanel({ cycle, lang, locked, onToast, onUploaded }: GlSnapshotPanelProps) {
  const [rows, setRows] = useState<GlSnapshotRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [uploadOpen, setUploadOpen] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const now = new Date();

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const data = await closeApi.listGlSnapshots(
        cycle.organizationId,
        cycle.periodYear,
        cycle.periodMonth,
      );
      setRows(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load GL snapshots');
    } finally {
      setLoading(false);
    }
  }, [cycle.organizationId, cycle.periodYear, cycle.periodMonth]);

  useEffect(() => {
    load();
  }, [load]);

  async function handleDelete(row: GlSnapshotRow) {
    if (locked || deletingId) return;
    const confirmed =
      typeof window !== 'undefined'
        ? window.confirm(
            lang === 'en'
              ? `Delete GL snapshot for "${row.account}"? You can re-upload from your CSV.`
              : `¿Eliminar snapshot del GL para "${row.account}"? Puede recargarlo desde su CSV.`,
          )
        : true;
    if (!confirmed) return;
    setDeletingId(row.id);
    // Optimistic remove + rollback on error.
    const prevRows = rows;
    setRows((rs) => rs.filter((r) => r.id !== row.id));
    try {
      await closeApi.deleteGlSnapshot(cycle.organizationId, row.id);
      onToast?.(
        lang === 'en' ? `Deleted ${row.account}` : `Eliminado ${row.account}`,
        'success',
      );
    } catch (err) {
      setRows(prevRows);
      onToast?.(err instanceof Error ? err.message : 'Delete failed', 'error');
    } finally {
      setDeletingId(null);
    }
  }

  const totalBalance = rows.reduce((s, r) => s + r.balance, 0);
  const distinctSources = new Set(rows.map((r) => r.sourceLabel ?? 'manual')).size;
  const period = `${cycle.periodYear}-${String(cycle.periodMonth).padStart(2, '0')}`;

  const columns: DataTableColumn<GlSnapshotRow>[] = [
    {
      key: 'account',
      header: lang === 'en' ? 'Account' : 'Cuenta',
      cell: (r) => <span className="font-mono text-slate-900">{r.account}</span>,
      sortValue: (r) => r.account,
    },
    {
      key: 'balance',
      header: lang === 'en' ? 'Balance' : 'Saldo',
      cell: (r) => fmtUsd(r.balance),
      sortValue: (r) => r.balance,
      align: 'right',
      numeric: true,
      width: '160px',
    },
    {
      key: 'source',
      header: lang === 'en' ? 'Source' : 'Origen',
      cell: (r) => (
        <span className="font-mono text-[11px] text-slate-500">
          {(r.sourceLabel ?? 'manual').replace(/^upload:/, '')}
        </span>
      ),
      sortValue: (r) => r.sourceLabel ?? '',
      width: '180px',
      hideOnMobile: true,
    },
    {
      key: 'updated',
      header: lang === 'en' ? 'Updated' : 'Actualizado',
      cell: (r) => (
        <span className="font-mono text-[11px] tabular-nums text-slate-500">
          {fmtRelative(r.updatedAt, now, lang)}
        </span>
      ),
      sortValue: (r) => r.updatedAt,
      align: 'right',
      width: '110px',
      hideOnMobile: true,
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => {
        if (locked) return null;
        const isDeleting = deletingId === r.id;
        return (
          <div className="flex justify-end">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                handleDelete(r);
              }}
              disabled={isDeleting}
              className="rounded-md p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600 disabled:opacity-50"
              aria-label={lang === 'en' ? `Delete ${r.account}` : `Eliminar ${r.account}`}
            >
              {isDeleting ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Trash2 className="h-3.5 w-3.5" />}
            </button>
          </div>
        );
      },
      align: 'right',
      width: '60px',
    },
  ];

  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          { label: lang === 'en' ? 'Accounts' : 'Cuentas', value: rows.length },
          { label: lang === 'en' ? 'Total balance' : 'Saldo total', value: fmtUsd(totalBalance) },
          { label: lang === 'en' ? 'Sources' : 'Orígenes', value: distinctSources },
          { label: lang === 'en' ? 'Period' : 'Período', value: period },
        ]}
      />

      <div className="flex flex-wrap items-center justify-end gap-2">
        <button
          type="button"
          onClick={load}
          disabled={loading}
          className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
        >
          {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <RefreshCcw className="h-3 w-3" />}
          {lang === 'en' ? 'Refresh' : 'Actualizar'}
        </button>
        {!locked ? (
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white hover:bg-slate-800"
          >
            <Upload className="h-4 w-4" />
            {lang === 'en' ? 'Upload GL CSV' : 'Cargar CSV del GL'}
          </button>
        ) : null}
      </div>

      {error ? <ErrorBanner error={error} onRetry={load} /> : null}

      {loading ? (
        <SkeletonLoader variant="table" />
      ) : rows.length === 0 ? (
        <EmptyState
          icon={Database}
          title={lang === 'en' ? 'No GL snapshot for this period' : 'Sin snapshot del GL para este período'}
          description={
            lang === 'en'
              ? `Upload a CSV with account, period_year (${cycle.periodYear}), period_month (${cycle.periodMonth}), and balance columns to populate this period\u2019s GL snapshot.`
              : `Cargue un CSV con columnas account, period_year (${cycle.periodYear}), period_month (${cycle.periodMonth}) y balance para llenar el snapshot del GL de este período.`
          }
          actionLabel={lang === 'en' ? 'Upload now' : 'Cargar ahora'}
          onAction={() => setUploadOpen(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={rows}
          rowKey={(r) => r.id}
          caption={lang === 'en' ? `GL snapshot · ${period}` : `Snapshot del GL · ${period}`}
        />
      )}

      <GlUploadModal
        open={uploadOpen}
        orgId={cycle.organizationId}
        lang={lang}
        onClose={() => setUploadOpen(false)}
        onUploaded={(res) => {
          // Reload the snapshot after a successful upload so the new rows
          // are visible immediately. Also bubble up to the parent so the
          // cycle's recent-activity strip can refresh.
          load();
          onUploaded?.();
          onToast?.(
            lang === 'en'
              ? `GL upload: ${res.inserted} inserted, ${res.updated} updated${
                  res.errored > 0 ? `, ${res.errored} errors` : ''
                }`
              : `Carga GL: ${res.inserted} insertadas, ${res.updated} actualizadas${
                  res.errored > 0 ? `, ${res.errored} errores` : ''
                }`,
            res.errored === 0 ? 'success' : 'warning',
          );
        }}
      />
    </div>
  );
}
