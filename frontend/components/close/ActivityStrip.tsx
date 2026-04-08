'use client';

/**
 * ActivityStrip — compact "recent activity" list for the cycle workspace.
 *
 * Customer journey moment: Maria opens the cockpit at 7:45am. Before
 * diving into the pulse banner she glances at this strip: "Jose posted JE
 * 2026-04-012 · 6 min ago / Bank Rec Operating marked done · 14 min ago".
 * She instantly knows what happened overnight and where to start.
 *
 * Visual goals: vertical list, tight rows, monospace timestamps, icons
 * that convey the activity kind at a glance. Bilingual prose via the
 * denormalized summaryEn/summaryEs fields on each row.
 */

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
  Zap,
} from 'lucide-react';
import type { CloseActivity, CloseActivityKind } from '@/lib/close-api';

type Lang = 'en' | 'es';

interface ActivityStripProps {
  activity: CloseActivity[];
  lang: Lang;
  now?: Date;
  /** Optional callback for the "Show all" link → opens the ActivityDrawer. */
  onShowAll?: () => void;
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

function relative(from: Date, now: Date, lang: Lang): string {
  const diffSec = Math.max(0, Math.round((now.getTime() - from.getTime()) / 1000));
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

export function ActivityStrip({ activity, lang, now = new Date(), onShowAll }: ActivityStripProps) {
  if (activity.length === 0) {
    return null;
  }

  // Show the 6 most recent entries inline; the rest are reachable via
  // "Show all" → ActivityDrawer.
  const recent = activity.slice(0, 6);
  const hasMore = activity.length > recent.length;

  return (
    <section
      className="rounded-xl border border-slate-200 bg-white"
      aria-label={lang === 'en' ? 'Recent activity' : 'Actividad reciente'}
    >
      <div className="flex items-center justify-between border-b border-slate-100 px-4 py-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        <span>{lang === 'en' ? 'Recent activity' : 'Actividad reciente'}</span>
        {onShowAll ? (
          <button
            type="button"
            onClick={onShowAll}
            className="rounded-full px-2 py-0.5 text-[10px] font-semibold text-slate-500 hover:bg-slate-100 hover:text-slate-700"
          >
            {lang === 'en' ? 'Show all' : 'Ver todo'}
            {hasMore ? <span className="ml-1 font-mono text-slate-400">+{activity.length - recent.length}</span> : null}
          </button>
        ) : null}
      </div>
      <ul className="divide-y divide-slate-100" role="list">
        {recent.map((a) => {
          const Icon = ICON[a.kind] ?? FileText;
          const tone = TONE[a.kind] ?? 'text-slate-500';
          const summary = lang === 'en' ? a.summaryEn : a.summaryEs;
          return (
            <li key={a.id} className="flex items-center gap-3 px-4 py-2 text-sm" role="listitem">
              <Icon className={`h-4 w-4 shrink-0 ${tone}`} aria-hidden />
              <span className="min-w-0 flex-1 truncate text-slate-700">{summary}</span>
              <time
                className="shrink-0 font-mono text-[11px] tabular-nums text-slate-400"
                dateTime={a.createdAt}
                title={new Date(a.createdAt).toLocaleString()}
              >
                {relative(new Date(a.createdAt), now, lang)}
              </time>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
