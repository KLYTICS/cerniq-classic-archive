'use client';

/**
 * ActivityDrawer — full activity history for a cycle.
 *
 * Customer journey moment: Maria's CFO walks in and asks "what happened
 * during last month's close?" She opens the cycle, clicks "Show all
 * activity" in the strip, the drawer slides in showing every event in
 * the cycle grouped by day, with kind filter chips so she can isolate
 * just the JE postings or just the cascades. She scrolls through 200
 * entries in 30 seconds.
 *
 * Why a separate component from ActivityStrip:
 *   - Strip is a top-of-page glance (6 entries max, no filter)
 *   - Drawer is the deep dive (up to 500 entries, filterable, grouped)
 *   - Different UX targets, different code paths, no shared state
 *
 * The drawer fetches its own activity list (with a higher limit than
 * the strip) on open so it always reflects the latest state.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  CheckCircle2,
  CircleSlash,
  ClipboardCheck,
  Database,
  FilePlus2,
  FileText,
  Lock,
  LockOpen,
  Play,
  TrendingUp,
  Unlock,
  X,
  Zap,
} from 'lucide-react';
import { closeApi, type CloseActivity, type CloseActivityKind } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface ActivityDrawerProps {
  cycleId: string;
  lang: Lang;
  open: boolean;
  onClose: () => void;
}

const ICON: Record<CloseActivityKind, React.ComponentType<{ className?: string }>> = {
  CYCLE_OPENED: Play,
  CYCLE_SIGNED_OFF: Lock,
  CYCLE_REOPENED: LockOpen,
  TASK_UPDATED: FileText,
  TASK_COMPLETED: CheckCircle2,
  TASK_WAIVED: CircleSlash,
  TASK_CASCADED_UNBLOCK: Unlock,
  TIE_OUT_RUN: Zap,
  JE_POSTED: FilePlus2,
  JE_REVERSED: CircleSlash,
  FLUX_REFRESHED: TrendingUp,
  GL_UPLOADED: Database,
  RECON_REVIEWED: ClipboardCheck,
};

const TONE: Record<CloseActivityKind, string> = {
  CYCLE_OPENED: 'text-blue-600',
  CYCLE_SIGNED_OFF: 'text-emerald-600',
  CYCLE_REOPENED: 'text-amber-600',
  TASK_UPDATED: 'text-slate-500',
  TASK_COMPLETED: 'text-emerald-600',
  TASK_WAIVED: 'text-slate-400',
  TASK_CASCADED_UNBLOCK: 'text-amber-600',
  TIE_OUT_RUN: 'text-blue-600',
  JE_POSTED: 'text-indigo-600',
  JE_REVERSED: 'text-amber-700',
  FLUX_REFRESHED: 'text-purple-600',
  GL_UPLOADED: 'text-teal-600',
  RECON_REVIEWED: 'text-blue-600',
};

const KIND_LABEL: Record<CloseActivityKind, { en: string; es: string }> = {
  CYCLE_OPENED: { en: 'Opened', es: 'Abierto' },
  CYCLE_SIGNED_OFF: { en: 'Signed off', es: 'Aprobado' },
  CYCLE_REOPENED: { en: 'Reopened', es: 'Reabierto' },
  TASK_UPDATED: { en: 'Task edit', es: 'Edición' },
  TASK_COMPLETED: { en: 'Task done', es: 'Tarea lista' },
  TASK_WAIVED: { en: 'Task waived', es: 'Renunciada' },
  TASK_CASCADED_UNBLOCK: { en: 'Cascade', es: 'Cascada' },
  TIE_OUT_RUN: { en: 'Tie-out', es: 'Conciliación' },
  JE_POSTED: { en: 'JE posted', es: 'Asiento' },
  JE_REVERSED: { en: 'JE reversed', es: 'Asiento reversado' },
  FLUX_REFRESHED: { en: 'Flux', es: 'Flujo' },
  GL_UPLOADED: { en: 'GL upload', es: 'Carga GL' },
  RECON_REVIEWED: { en: 'Recon review', es: 'Revisión' },
};

function fmtDay(iso: string, lang: Lang): string {
  const d = new Date(iso);
  return d.toLocaleDateString(lang === 'en' ? 'en-US' : 'es-ES', {
    weekday: 'long',
    month: 'short',
    day: 'numeric',
  });
}

function fmtTime(iso: string): string {
  return new Date(iso).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

export function ActivityDrawer({ cycleId, lang, open, onClose }: ActivityDrawerProps) {
  const [activity, setActivity] = useState<CloseActivity[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<CloseActivityKind | 'all'>('all');

  // Body scroll lock + Escape close
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

  // Fetch the deep history every time the drawer opens.
  useEffect(() => {
    if (!open || !cycleId) return;
    let cancelled = false;
    void Promise.resolve().then(async () => {
      if (cancelled) return;
      setLoading(true);
      setError(null);
      try {
        const rows = await closeApi.listActivity(cycleId, 500);
        if (!cancelled) setActivity(rows);
      } catch (e) {
        if (!cancelled) {
          setError(e instanceof Error ? e.message : 'Failed to load activity');
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    });
    return () => {
      cancelled = true;
    };
  }, [open, cycleId]);

  // Compute kind counts for filter chips so users see what's available
  // before they click. Showing 0-count kinds is noise.
  const kindCounts = useMemo(() => {
    const counts = new Map<CloseActivityKind, number>();
    activity.forEach((a) => counts.set(a.kind, (counts.get(a.kind) ?? 0) + 1));
    return counts;
  }, [activity]);

  const filtered = useMemo(
    () => (filter === 'all' ? activity : activity.filter((a) => a.kind === filter)),
    [activity, filter],
  );

  // Group by calendar day for the visual hierarchy.
  const grouped = useMemo(() => {
    const groups = new Map<string, CloseActivity[]>();
    for (const a of filtered) {
      const day = a.createdAt.slice(0, 10);
      const list = groups.get(day) ?? [];
      list.push(a);
      groups.set(day, list);
    }
    return Array.from(groups.entries()).sort((a, b) => (a[0] < b[0] ? 1 : -1));
  }, [filtered]);

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
        aria-label={lang === 'en' ? 'Full activity' : 'Actividad completa'}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-lg flex-col overflow-y-auto bg-white shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div>
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {lang === 'en' ? 'Activity feed' : 'Historial'}
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {lang === 'en' ? 'All activity' : 'Toda la actividad'}{' '}
                <span className="ml-1 font-mono text-sm font-normal text-slate-400">
                  {filtered.length}
                </span>
              </h2>
            </div>
            <button
              type="button"
              onClick={onClose}
              className="rounded-lg p-1.5 text-slate-400 hover:bg-slate-100 hover:text-slate-600"
              aria-label={lang === 'en' ? 'Close' : 'Cerrar'}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Filter chips */}
          {activity.length > 0 ? (
            <div className="mt-3 flex flex-wrap gap-1">
              <FilterChip
                active={filter === 'all'}
                onClick={() => setFilter('all')}
                label={lang === 'en' ? 'All' : 'Todo'}
                count={activity.length}
              />
              {Array.from(kindCounts.entries())
                .sort((a, b) => b[1] - a[1])
                .map(([kind, count]) => (
                  <FilterChip
                    key={kind}
                    active={filter === kind}
                    onClick={() => setFilter(kind)}
                    label={KIND_LABEL[kind][lang]}
                    count={count}
                  />
                ))}
            </div>
          ) : null}
        </header>

        <div className="flex-1 px-5 py-5">
          {error ? (
            <p className="text-sm text-rose-600">{error}</p>
          ) : loading ? (
            <p className="text-sm text-slate-500">{lang === 'en' ? 'Loading…' : 'Cargando…'}</p>
          ) : filtered.length === 0 ? (
            <p className="text-sm text-slate-500">
              {lang === 'en' ? 'No activity to show.' : 'Sin actividad para mostrar.'}
            </p>
          ) : (
            <div className="space-y-5">
              {grouped.map(([day, entries]) => (
                <section key={day}>
                  <h3 className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                    {fmtDay(entries[0].createdAt, lang)}
                  </h3>
                  <ul className="space-y-1.5">
                    {entries.map((a) => {
                      const Icon = ICON[a.kind] ?? FileText;
                      const tone = TONE[a.kind] ?? 'text-slate-500';
                      return (
                        <li
                          key={a.id}
                          className="flex items-start gap-3 rounded-md border border-slate-100 bg-slate-50/60 px-3 py-2 text-sm"
                        >
                          <Icon className={`mt-0.5 h-4 w-4 shrink-0 ${tone}`} aria-hidden />
                          <div className="min-w-0 flex-1">
                            <div className="text-slate-700">
                              {lang === 'en' ? a.summaryEn : a.summaryEs}
                            </div>
                          </div>
                          <time
                            dateTime={a.createdAt}
                            className="shrink-0 font-mono text-[10px] tabular-nums text-slate-400"
                            title={new Date(a.createdAt).toLocaleString()}
                          >
                            {fmtTime(a.createdAt)}
                          </time>
                        </li>
                      );
                    })}
                  </ul>
                </section>
              ))}
            </div>
          )}
        </div>
      </aside>
    </>
  );
}

function FilterChip({
  active,
  onClick,
  label,
  count,
}: {
  active: boolean;
  onClick: () => void;
  label: string;
  count: number;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-semibold transition ${
        active
          ? 'bg-slate-900 text-white'
          : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
      }`}
    >
      {label}
      <span className={`font-mono tabular-nums ${active ? 'text-white/60' : 'text-slate-400'}`}>
        {count}
      </span>
    </button>
  );
}
