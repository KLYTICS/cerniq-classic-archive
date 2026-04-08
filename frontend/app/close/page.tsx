'use client';

/**
 * Close Cockpit — month-end close workspace overview.
 *
 * The bridge from raw GL noise to a sign-off-ready binder. Density-first:
 * one MetricStrip at the top, one DataTable of cycles below, sign-off CTA
 * gated on task + reconciliation completeness in the backend.
 */

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { Plus, Inbox, Building2, Database } from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';
import {
  MetricStrip,
  DataTable,
  type DataTableColumn,
  ErrorBanner,
  SkeletonLoader,
  EmptyState,
} from '@/components/ui/cerniq';
import { OpenCycleModal } from '@/components/close/OpenCycleModal';
import { GlUploadModal } from '@/components/close/GlUploadModal';
import { closeApi, type CloseCycleSummary, type CloseCycleStatus } from '@/lib/close-api';
import { useCurrentOrg } from '@/hooks/useCurrentOrg';
import { useToast } from '@/components/ui/Toast';

type Lang = 'en' | 'es';

const COPY = {
  en: {
    kicker: 'Finance Operations',
    title: 'Close Cockpit',
    description:
      'One workspace from cutoff to sign-off. Cycles, tie-outs, journal entries, flux narrative and audit binder — bilingual, deterministic, examiner-ready.',
    open: 'Open new cycle',
    cyclesHeader: 'Close cycles',
    period: 'Period',
    status: 'Status',
    target: 'Target close',
    tasks: 'Tasks',
    recs: 'Recs',
    jes: 'JEs',
    materiality: 'Materiality',
    daysOpen: 'Days open',
    metric_open: 'Open cycles',
    metric_in_review: 'In review',
    metric_signed_off: 'Signed off (12mo)',
    metric_avg_days: 'Avg days to close',
    empty_title: 'No cycles yet',
    empty_msg: 'Open the first month-end cycle to start tracking close work.',
  },
  es: {
    kicker: 'Operaciones Financieras',
    title: 'Cabina de Cierre',
    description:
      'Un solo espacio desde el corte hasta la aprobación. Ciclos, conciliaciones, asientos, narrativa de flujo y carpeta de auditoría — bilingüe, determinista, listo para examinadores.',
    open: 'Abrir ciclo nuevo',
    cyclesHeader: 'Ciclos de cierre',
    period: 'Período',
    status: 'Estado',
    target: 'Cierre objetivo',
    tasks: 'Tareas',
    recs: 'Concil.',
    jes: 'Asientos',
    materiality: 'Materialidad',
    daysOpen: 'Días abierto',
    metric_open: 'Ciclos abiertos',
    metric_in_review: 'En revisión',
    metric_signed_off: 'Cerrados (12m)',
    metric_avg_days: 'Días prom. al cierre',
    empty_title: 'Sin ciclos aún',
    empty_msg: 'Abra el primer ciclo mensual para comenzar a rastrear el trabajo de cierre.',
  },
} as const;

const STATUS_TONE: Record<CloseCycleStatus, 'good' | 'info' | 'warn' | 'neutral'> = {
  OPEN: 'info',
  IN_REVIEW: 'warn',
  SIGNED_OFF: 'good',
  REOPENED: 'neutral',
};

function fmtPeriod(year: number, month: number): string {
  return `${year}-${String(month).padStart(2, '0')}`;
}

function fmtUsd(n: number | string): string {
  const v = typeof n === 'string' ? Number(n) : n;
  return new Intl.NumberFormat('en-US', {
    style: 'currency',
    currency: 'USD',
    maximumFractionDigits: 0,
  }).format(v);
}

function daysSince(iso: string): number {
  return Math.max(0, Math.floor((Date.now() - new Date(iso).getTime()) / 86_400_000));
}

export default function CloseCockpitPage() {
  const [lang, setLang] = useState<Lang>('en');
  const [cycles, setCycles] = useState<CloseCycleSummary[] | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [openModal, setOpenModal] = useState(false);
  const [uploadOpen, setUploadOpen] = useState(false);
  const {
    orgs,
    orgId,
    setOrgId,
    loading: orgLoading,
    error: orgError,
  } = useCurrentOrg();
  const { toast } = useToast();
  const t = COPY[lang];

  const load = useCallback(async () => {
    if (!orgId) {
      setCycles([]);
      setLoading(false);
      return;
    }
    setLoading(true);
    setError(null);
    try {
      const data = await closeApi.listCycles(orgId);
      setCycles(data);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Failed to load cycles');
      setCycles([]);
    } finally {
      setLoading(false);
    }
  }, [orgId]);

  useEffect(() => {
    load();
  }, [load]);

  const metrics = useMemo(() => {
    const list = cycles ?? [];
    const open = list.filter((c) => c.status === 'OPEN').length;
    const inReview = list.filter((c) => c.status === 'IN_REVIEW').length;
    const last12 = list.filter(
      (c) =>
        c.status === 'SIGNED_OFF' &&
        c.closedAt &&
        Date.now() - new Date(c.closedAt).getTime() <= 365 * 86_400_000,
    );
    const closeDurations = last12
      .map((c) => {
        if (!c.closedAt) return null;
        return (new Date(c.closedAt).getTime() - new Date(c.openedAt).getTime()) / 86_400_000;
      })
      .filter((n): n is number => n != null);
    const avgDays =
      closeDurations.length === 0
        ? 0
        : closeDurations.reduce((a, b) => a + b, 0) / closeDurations.length;

    return [
      { label: t.metric_open, value: open },
      { label: t.metric_in_review, value: inReview },
      { label: t.metric_signed_off, value: last12.length },
      { label: t.metric_avg_days, value: avgDays.toFixed(1) },
    ];
  }, [cycles, t]);

  const columns: DataTableColumn<CloseCycleSummary>[] = useMemo(
    () => [
      {
        key: 'period',
        header: t.period,
        cell: (r) => (
          <Link
            href={`/close/${r.id}`}
            className="font-mono text-blue-700 hover:underline"
          >
            {fmtPeriod(r.periodYear, r.periodMonth)}
          </Link>
        ),
        sortValue: (r) => r.periodYear * 100 + r.periodMonth,
        width: '120px',
      },
      {
        key: 'status',
        header: t.status,
        cell: (r) => (
          <span
            className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${
              STATUS_TONE[r.status] === 'good'
                ? 'border-emerald-200 bg-emerald-50 text-emerald-700'
                : STATUS_TONE[r.status] === 'warn'
                  ? 'border-amber-200 bg-amber-50 text-amber-800'
                  : STATUS_TONE[r.status] === 'info'
                    ? 'border-blue-200 bg-blue-50 text-blue-700'
                    : 'border-slate-200 bg-slate-50 text-slate-600'
            }`}
          >
            {r.status}
          </span>
        ),
        sortValue: (r) => r.status,
      },
      {
        key: 'target',
        header: t.target,
        cell: (r) => (r.targetCloseAt ? new Date(r.targetCloseAt).toLocaleDateString() : '—'),
        sortValue: (r) => r.targetCloseAt ?? '',
        hideOnMobile: true,
      },
      {
        key: 'tasks',
        header: t.tasks,
        cell: (r) => r._count?.tasks ?? 0,
        sortValue: (r) => r._count?.tasks ?? 0,
        align: 'right',
        numeric: true,
        width: '80px',
      },
      {
        key: 'recs',
        header: t.recs,
        cell: (r) => r._count?.reconciliations ?? 0,
        sortValue: (r) => r._count?.reconciliations ?? 0,
        align: 'right',
        numeric: true,
        width: '80px',
      },
      {
        key: 'jes',
        header: t.jes,
        cell: (r) => r._count?.journalEntries ?? 0,
        sortValue: (r) => r._count?.journalEntries ?? 0,
        align: 'right',
        numeric: true,
        width: '80px',
      },
      {
        key: 'materiality',
        header: t.materiality,
        cell: (r) => fmtUsd(r.materialityAbs),
        sortValue: (r) => Number(r.materialityAbs),
        align: 'right',
        numeric: true,
        hideOnMobile: true,
      },
      {
        key: 'daysOpen',
        header: t.daysOpen,
        cell: (r) => (r.closedAt ? '—' : daysSince(r.openedAt)),
        sortValue: (r) => (r.closedAt ? -1 : daysSince(r.openedAt)),
        align: 'right',
        numeric: true,
        hideOnMobile: true,
      },
    ],
    [t],
  );

  return (
    <PlatformPage
      kicker={t.kicker}
      title={t.title}
      description={t.description}
      meta={
        <div className="flex flex-wrap items-center gap-2">
          {orgs.length > 1 ? (
            <label className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white pl-3 pr-1 text-xs font-semibold text-slate-600">
              <span className="uppercase tracking-wider text-slate-400">
                {lang === 'en' ? 'Org' : 'Organización'}
              </span>
              <select
                value={orgId ?? ''}
                onChange={(e) => setOrgId(e.target.value)}
                className="rounded-full bg-transparent py-1 pr-2 text-xs font-semibold text-slate-700 focus:outline-none"
                aria-label={lang === 'en' ? 'Select organization' : 'Seleccionar organización'}
              >
                {orgs.map((o) => (
                  <option key={o.id} value={o.id}>
                    {o.name}
                  </option>
                ))}
              </select>
            </label>
          ) : orgId ? (
            <span className="inline-flex items-center rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600">
              {orgs[0]?.name ?? orgId}
            </span>
          ) : null}
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'EN · ES' : 'ES · EN'}
          </button>
        </div>
      }
      actions={
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setUploadOpen(true)}
            disabled={!orgId}
            className="inline-flex items-center gap-2 rounded-full border border-slate-200 bg-white px-4 py-2 text-sm font-semibold text-slate-700 shadow-sm hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              !orgId
                ? lang === 'en'
                  ? 'Select an organization first'
                  : 'Seleccione una organización primero'
                : undefined
            }
          >
            <Database className="h-4 w-4" />
            {lang === 'en' ? 'Upload GL CSV' : 'Cargar CSV del GL'}
          </button>
          <button
            type="button"
            onClick={() => setOpenModal(true)}
            disabled={!orgId}
            className="inline-flex items-center gap-2 rounded-full bg-slate-900 px-4 py-2 text-sm font-semibold text-white shadow hover:bg-slate-800 disabled:cursor-not-allowed disabled:opacity-50"
            title={
              !orgId
                ? lang === 'en'
                  ? 'Select an organization first'
                  : 'Seleccione una organización primero'
                : undefined
            }
          >
            <Plus className="h-4 w-4" />
            {t.open}
          </button>
        </div>
      }
    >
      {/* Bloomberg-density KPI strip */}
      <MetricStrip items={metrics} density="comfortable" />

      {orgError ? <ErrorBanner error={orgError} /> : null}
      {error ? <ErrorBanner error={error} onRetry={load} /> : null}

      {orgLoading ? (
        <SkeletonLoader variant="table" />
      ) : !orgId ? (
        <EmptyState
          icon={Building2}
          title={lang === 'en' ? 'No organization' : 'Sin organización'}
          description={
            lang === 'en'
              ? 'You are not a member of any organization yet. Create one from Settings → Organizations to start running close cycles.'
              : 'Aún no es miembro de ninguna organización. Cree una en Configuración → Organizaciones para iniciar ciclos de cierre.'
          }
        />
      ) : loading ? (
        <SkeletonLoader variant="table" />
      ) : (cycles ?? []).length === 0 ? (
        <EmptyState
          icon={Inbox}
          title={t.empty_title}
          description={t.empty_msg}
          actionLabel={t.open}
          onAction={() => setOpenModal(true)}
        />
      ) : (
        <DataTable
          columns={columns}
          rows={cycles ?? []}
          rowKey={(r) => r.id}
          caption={t.cyclesHeader}
        />
      )}

      {orgId ? (
        <OpenCycleModal
          open={openModal}
          onClose={() => setOpenModal(false)}
          orgId={orgId}
          lang={lang}
          onCycleCreated={(created) => {
            // Optimistic prepend so the new row appears without re-fetching.
            setCycles((prev) => (prev ? [created, ...prev] : [created]));
          }}
        />
      ) : null}

      {orgId ? (
        <GlUploadModal
          open={uploadOpen}
          onClose={() => setUploadOpen(false)}
          orgId={orgId}
          lang={lang}
          onUploaded={(res) => {
            const msg =
              lang === 'en'
                ? `GL upload: ${res.inserted} inserted, ${res.updated} updated${
                    res.errored > 0 ? `, ${res.errored} errors` : ''
                  }`
                : `Carga GL: ${res.inserted} insertadas, ${res.updated} actualizadas${
                    res.errored > 0 ? `, ${res.errored} errores` : ''
                  }`;
            toast(msg, res.errored === 0 ? 'success' : 'warning');
          }}
        />
      ) : null}
    </PlatformPage>
  );
}

