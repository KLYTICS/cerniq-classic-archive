'use client';

/**
 * /close/[cycleId] — the unified cycle workspace.
 *
 * Single source of truth for "where are we" in a close. Owns the cycle
 * state via useCycleLive (polling + visibility-aware), dispatches
 * optimistic mutations to children, handles sign-off, threads toast
 * notifications through every mutation, and binds keyboard shortcuts.
 *
 * Keyboard shortcuts (g + key):
 *   g c → Calendar
 *   g t → Tie-out
 *   g j → Journal entries
 *   g f → Flux
 *   g b → Binder
 *   g l → toggle EN/ES
 *   g r → refresh now
 */

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams, useRouter, useSearchParams } from 'next/navigation';
import Link from 'next/link';
import { ArrowLeft, RefreshCcw } from 'lucide-react';
import { CycleHeader } from '@/components/close/CycleHeader';
import { CalendarPanel } from '@/components/close/CalendarPanel';
import { TieOutPanel } from '@/components/close/TieOutPanel';
import { FluxPanel } from '@/components/close/FluxPanel';
import { BinderPanel } from '@/components/close/BinderPanel';
import { JournalEntryPanel } from '@/components/close/JournalEntryPanel';
import { GlSnapshotPanel } from '@/components/close/GlSnapshotPanel';
import { ActivityStrip } from '@/components/close/ActivityStrip';
import { TaskDetailDrawer } from '@/components/close/TaskDetailDrawer';
import { ConfirmSignOffModal } from '@/components/close/ConfirmSignOffModal';
import { ConfirmReopenModal } from '@/components/close/ConfirmReopenModal';
import { ShortcutHelpModal } from '@/components/close/ShortcutHelpModal';
import { ActivityDrawer } from '@/components/close/ActivityDrawer';
import { ErrorBanner, SkeletonLoader } from '@/components/ui/cerniq';
import { useToast } from '@/components/ui/Toast';
import { useCycleLive } from '@/hooks/useCycleLive';
import {
  closeApi,
  type CloseTask,
  type CloseReconciliation,
  type CloseFluxNarrative,
  type CloseJournalEntry,
} from '@/lib/close-api';

type Tab = 'calendar' | 'tieout' | 'je' | 'flux' | 'snapshot' | 'binder';
type Lang = 'en' | 'es';

const TABS: Array<{ key: Tab; en: string; es: string; shortcut: string }> = [
  { key: 'calendar', en: 'Calendar', es: 'Calendario', shortcut: 'c' },
  { key: 'tieout', en: 'Tie-out', es: 'Conciliación', shortcut: 't' },
  { key: 'je', en: 'Journal entries', es: 'Asientos', shortcut: 'j' },
  { key: 'flux', en: 'Flux', es: 'Flujo', shortcut: 'f' },
  { key: 'snapshot', en: 'GL Snapshot', es: 'Snapshot GL', shortcut: 's' },
  { key: 'binder', en: 'Binder', es: 'Carpeta', shortcut: 'b' },
];

function parseTab(value: string | null): Tab {
  const valid = TABS.find((t) => t.key === value);
  return valid ? valid.key : 'calendar';
}

function formatRelative(from: Date | null, now: Date, lang: Lang): string {
  if (!from) return lang === 'en' ? 'never' : 'nunca';
  const diffSec = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
  if (lang === 'en') {
    if (diffSec < 5) return 'just now';
    if (diffSec < 60) return `${diffSec}s ago`;
    if (diffSec < 3600) return `${Math.floor(diffSec / 60)}m ago`;
    return `${Math.floor(diffSec / 3600)}h ago`;
  }
  if (diffSec < 5) return 'ahora';
  if (diffSec < 60) return `hace ${diffSec}s`;
  if (diffSec < 3600) return `hace ${Math.floor(diffSec / 60)}m`;
  return `hace ${Math.floor(diffSec / 3600)}h`;
}

export default function CycleWorkspacePage() {
  const params = useParams<{ cycleId: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const cycleId = params?.cycleId ?? '';

  const { toast } = useToast();
  const {
    cycle,
    activity,
    loading,
    error,
    lastFetchedAt,
    refetch,
    setCycle,
  } = useCycleLive(cycleId);

  // URL-driven tab state so links are shareable.
  const initialTab = parseTab(searchParams?.get('tab') ?? null);
  const [tab, setTabState] = useState<Tab>(initialTab);
  const [lang, setLang] = useState<Lang>('en');
  const [signingOff, setSigningOff] = useState(false);
  const [confirmSignOff, setConfirmSignOff] = useState(false);
  const [confirmReopen, setConfirmReopen] = useState(false);
  const [reopening, setReopening] = useState(false);
  const [helpOpen, setHelpOpen] = useState(false);
  const [activityDrawerOpen, setActivityDrawerOpen] = useState(false);
  const [drawerTaskId, setDrawerTaskId] = useState<string | null>(null);

  const setTab = useCallback(
    (next: Tab) => {
      setTabState(next);
      const params = new URLSearchParams(searchParams?.toString() ?? '');
      params.set('tab', next);
      router.replace(`?${params.toString()}`, { scroll: false });
    },
    [router, searchParams],
  );

  // Tick every 15s so the "last updated" + activity relative-time strings
  // keep moving without refetching.
  const [now, setNow] = useState(() => new Date());
  useEffect(() => {
    const id = setInterval(() => setNow(new Date()), 15_000);
    return () => clearInterval(id);
  }, []);

  // Two-key chord state for `g + x` shortcuts.
  const gPressedAt = useRef<number>(0);

  useEffect(() => {
    function onKey(e: KeyboardEvent) {
      const target = e.target as HTMLElement | null;
      if (target && (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA' || target.tagName === 'SELECT')) {
        return;
      }
      // Single-key shortcut: "?" opens the keyboard help overlay.
      if (e.key === '?' || (e.key === '/' && e.shiftKey)) {
        e.preventDefault();
        setHelpOpen((v) => !v);
        return;
      }
      if (e.key === 'g') {
        gPressedAt.current = Date.now();
        return;
      }
      if (Date.now() - gPressedAt.current < 1200) {
        const matched = TABS.find((tt) => tt.shortcut === e.key);
        if (matched) {
          setTab(matched.key);
          gPressedAt.current = 0;
          return;
        }
        if (e.key === 'l') {
          setLang((l) => (l === 'en' ? 'es' : 'en'));
          gPressedAt.current = 0;
          return;
        }
        if (e.key === 'r') {
          refetch();
          toast(lang === 'en' ? 'Refreshed' : 'Actualizado', 'info');
          gPressedAt.current = 0;
          return;
        }
      }
    }
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [setTab, refetch, toast, lang]);

  // ── Optimistic mutators ───────────────────────────────────────────
  const updateTaskInState = useCallback(
    (taskId: string, patch: Partial<CloseTask>) => {
      setCycle((prev) => {
        if (!prev) return prev;
        return {
          ...prev,
          tasks: prev.tasks.map((t) => (t.id === taskId ? { ...t, ...patch } : t)),
        };
      });
    },
    [setCycle],
  );

  const addReconInState = useCallback(
    (r: CloseReconciliation) => {
      setCycle((prev) => (prev ? { ...prev, reconciliations: [...prev.reconciliations, r] } : prev));
      toast(
        lang === 'en' ? `Tie-out ${r.status}` : `Conciliación ${r.status}`,
        r.status === 'EXCEPTION' ? 'warning' : 'success',
      );
    },
    [setCycle, toast, lang],
  );

  const updateReconInState = useCallback(
    (r: CloseReconciliation) => {
      setCycle((prev) =>
        prev
          ? {
              ...prev,
              reconciliations: prev.reconciliations.map((existing) =>
                existing.id === r.id ? r : existing,
              ),
            }
          : prev,
      );
    },
    [setCycle],
  );

  const replaceFluxInState = useCallback(
    (narratives: CloseFluxNarrative[]) => {
      setCycle((prev) => (prev ? { ...prev, fluxNarratives: narratives } : prev));
      toast(
        lang === 'en' ? `Flux refreshed — ${narratives.filter((n) => n.isMaterial).length} material` : `Flujo actualizado`,
        'success',
      );
    },
    [setCycle, toast, lang],
  );

  const addJournalEntryInState = useCallback(
    (je: CloseJournalEntry) => {
      setCycle((prev) => (prev ? { ...prev, journalEntries: [...prev.journalEntries, je] } : prev));
    },
    [setCycle],
  );

  // ── Sign-off ──────────────────────────────────────────────────────
  const requestSignOff = useCallback(() => {
    if (!cycle) return;
    setConfirmSignOff(true);
  }, [cycle]);

  const handleSignOffConfirmed = useCallback(async () => {
    if (!cycle || signingOff) return;
    setSigningOff(true);
    try {
      await closeApi.signOff(cycle.id);
      await refetch();
      toast(lang === 'en' ? 'Cycle signed off' : 'Ciclo aprobado', 'success');
      setConfirmSignOff(false);
    } catch (e) {
      toast(e instanceof Error ? e.message : 'Sign-off failed', 'error');
    } finally {
      setSigningOff(false);
    }
  }, [cycle, signingOff, refetch, toast, lang]);

  const requestReopen = useCallback(() => {
    if (!cycle) return;
    setConfirmReopen(true);
  }, [cycle]);

  const handleReopenConfirmed = useCallback(
    async (reason: string) => {
      if (!cycle || reopening) return;
      setReopening(true);
      try {
        await closeApi.reopen(cycle.id, reason);
        await refetch();
        toast(lang === 'en' ? 'Cycle reopened' : 'Ciclo reabierto', 'warning');
        setConfirmReopen(false);
      } catch (e) {
        toast(e instanceof Error ? e.message : 'Reopen failed', 'error');
      } finally {
        setReopening(false);
      }
    },
    [cycle, reopening, refetch, toast, lang],
  );

  const drawerTask = useMemo(
    () => (cycle && drawerTaskId ? cycle.tasks.find((t) => t.id === drawerTaskId) ?? null : null),
    [cycle, drawerTaskId],
  );

  const locked = cycle?.status === 'SIGNED_OFF';

  const tabsNode = useMemo(
    () => (
      <nav
        className="flex flex-wrap items-center gap-1 rounded-xl border border-slate-200 bg-white p-1"
        aria-label={lang === 'en' ? 'Cycle tabs' : 'Pestañas del ciclo'}
      >
        {TABS.map((tt) => {
          const active = tab === tt.key;
          return (
            <button
              key={tt.key}
              type="button"
              onClick={() => setTab(tt.key)}
              className={`group inline-flex items-center gap-2 rounded-lg px-3 py-1.5 text-sm font-semibold transition ${
                active ? 'bg-slate-900 text-white' : 'text-slate-600 hover:bg-slate-50 hover:text-slate-900'
              }`}
            >
              {lang === 'en' ? tt.en : tt.es}
              <kbd
                className={`hidden font-mono text-[10px] sm:inline ${
                  active ? 'text-white/60' : 'text-slate-400 group-hover:text-slate-500'
                }`}
              >
                g {tt.shortcut}
              </kbd>
            </button>
          );
        })}
        <div className="ml-auto flex items-center gap-2 pl-2">
          <button
            type="button"
            onClick={() => {
              refetch();
              toast(lang === 'en' ? 'Refreshed' : 'Actualizado', 'info');
            }}
            className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-2.5 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            aria-label={lang === 'en' ? 'Refresh' : 'Actualizar'}
            title={
              lang === 'en'
                ? `Updated ${formatRelative(lastFetchedAt, now, lang)}`
                : `Actualizado ${formatRelative(lastFetchedAt, now, lang)}`
            }
          >
            <RefreshCcw className="h-3 w-3" />
            <span className="font-mono tabular-nums">{formatRelative(lastFetchedAt, now, lang)}</span>
          </button>
          <button
            type="button"
            onClick={() => setLang(lang === 'en' ? 'es' : 'en')}
            className="rounded-full border border-slate-200 bg-white px-3 py-1 text-xs font-semibold text-slate-600 hover:bg-slate-50"
            aria-label="Toggle language"
          >
            {lang === 'en' ? 'EN · ES' : 'ES · EN'}
            <span className="ml-1 hidden font-mono text-[9px] text-slate-400 sm:inline">g l</span>
          </button>
        </div>
      </nav>
    ),
    [tab, lang, setTab, refetch, toast, lastFetchedAt, now],
  );

  return (
    <div className="min-h-screen overflow-x-clip px-4 py-6 text-slate-950 sm:px-6 lg:px-8">
      <div className="mx-auto max-w-7xl space-y-5">
        <Link
          href="/close"
          className="inline-flex items-center gap-1.5 text-sm text-slate-500 hover:text-slate-800"
        >
          <ArrowLeft className="h-4 w-4" />
          {lang === 'en' ? 'All cycles' : 'Todos los ciclos'}
        </Link>

        {error ? <ErrorBanner error={error} onRetry={refetch} /> : null}

        {loading || !cycle ? (
          <>
            <div className="cerniq-shell relative p-6">
              <SkeletonLoader variant="metric" count={5} />
            </div>
            <SkeletonLoader variant="table" />
          </>
        ) : (
          <>
            <CycleHeader
              cycle={cycle}
              lang={lang}
              onSignOff={requestSignOff}
              onReopen={requestReopen}
              signingOff={signingOff}
              now={now}
            />

            <ActivityStrip
              activity={activity}
              lang={lang}
              now={now}
              onShowAll={() => setActivityDrawerOpen(true)}
            />

            {tabsNode}

            {tab === 'calendar' ? (
              <CalendarPanel
                cycle={cycle}
                lang={lang}
                onTaskUpdated={updateTaskInState}
                onTaskClicked={(t) => setDrawerTaskId(t.id)}
                locked={!!locked}
              />
            ) : null}
            {tab === 'tieout' ? (
              <TieOutPanel
                cycle={cycle}
                lang={lang}
                onReconAdded={addReconInState}
                onReconUpdated={updateReconInState}
                onToast={toast}
                locked={!!locked}
              />
            ) : null}
            {tab === 'je' ? (
              <JournalEntryPanel
                cycle={cycle}
                lang={lang}
                onJournalEntryPosted={addJournalEntryInState}
                onToast={toast}
                locked={!!locked}
              />
            ) : null}
            {tab === 'flux' ? (
              <FluxPanel
                cycle={cycle}
                lang={lang}
                onFluxRefreshed={replaceFluxInState}
                locked={!!locked}
              />
            ) : null}
            {tab === 'snapshot' ? (
              <GlSnapshotPanel
                cycle={cycle}
                lang={lang}
                locked={!!locked}
                onToast={toast}
                onUploaded={refetch}
              />
            ) : null}
            {tab === 'binder' ? <BinderPanel cycle={cycle} lang={lang} /> : null}

            <TaskDetailDrawer
              task={drawerTask}
              cycle={cycle}
              lang={lang}
              open={drawerTaskId !== null}
              onClose={() => setDrawerTaskId(null)}
              onTaskUpdated={updateTaskInState}
              onToast={toast}
              locked={!!locked}
            />

            <ConfirmSignOffModal
              open={confirmSignOff}
              cycle={cycle}
              lang={lang}
              onCancel={() => setConfirmSignOff(false)}
              onConfirm={handleSignOffConfirmed}
              submitting={signingOff}
            />

            <ConfirmReopenModal
              open={confirmReopen}
              cycle={cycle}
              lang={lang}
              onCancel={() => setConfirmReopen(false)}
              onConfirm={handleReopenConfirmed}
              submitting={reopening}
            />

            <ShortcutHelpModal open={helpOpen} lang={lang} onClose={() => setHelpOpen(false)} />

            <ActivityDrawer
              cycleId={cycle.id}
              lang={lang}
              open={activityDrawerOpen}
              onClose={() => setActivityDrawerOpen(false)}
            />
          </>
        )}
      </div>
    </div>
  );
}
