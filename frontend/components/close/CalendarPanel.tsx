'use client';

/**
 * CalendarPanel — task board for the active cycle, inside the dynamic
 * /close/[cycleId] workspace.
 *
 * Customer journey moment: Maria opens this tab, scans her tasks, hits
 * "Done" on the bank rec, and the AP-tie task that was BLOCKED on it
 * cascades to PENDING in the same paint without a refresh. That cascade is
 * the difference between "yet another to-do app" and "knows how I work."
 */

import { useMemo, useState } from 'react';
import { Check, Filter, Loader2 } from 'lucide-react';
import {
  DataTable,
  type DataTableColumn,
  MetricStrip,
} from '@/components/ui/cerniq';
import { closeApi, type CloseTask, type CloseTaskStatus, type CloseCycleDetail } from '@/lib/close-api';

type Lang = 'en' | 'es';

const STATUS_LABEL: Record<CloseTaskStatus, { en: string; es: string }> = {
  PENDING: { en: 'Pending', es: 'Pendiente' },
  IN_PROGRESS: { en: 'In progress', es: 'En curso' },
  BLOCKED: { en: 'Blocked', es: 'Bloqueado' },
  REVIEW: { en: 'Review', es: 'Revisión' },
  DONE: { en: 'Done', es: 'Listo' },
  WAIVED: { en: 'Waived', es: 'Renunciado' },
};

const STATUS_COLOR: Record<CloseTaskStatus, string> = {
  PENDING: 'border-slate-200 bg-slate-50 text-slate-600',
  IN_PROGRESS: 'border-blue-200 bg-blue-50 text-blue-700',
  BLOCKED: 'border-rose-200 bg-rose-50 text-rose-700',
  REVIEW: 'border-amber-200 bg-amber-50 text-amber-800',
  DONE: 'border-emerald-200 bg-emerald-50 text-emerald-700',
  WAIVED: 'border-slate-200 bg-slate-50 text-slate-500 line-through',
};

interface CalendarPanelProps {
  cycle: CloseCycleDetail;
  lang: Lang;
  /** Called after a task mutation to let the parent re-merge state. */
  onTaskUpdated: (taskId: string, patch: Partial<CloseTask>, cascadedIds: string[]) => void;
  /** Called when a row is clicked — used to open the TaskDetailDrawer. */
  onTaskClicked?: (task: CloseTask) => void;
  locked: boolean;
}

export function CalendarPanel({
  cycle,
  lang,
  onTaskUpdated,
  onTaskClicked,
  locked,
}: CalendarPanelProps) {
  const [filterOwner, setFilterOwner] = useState<string | 'all'>('all');
  const [pendingId, setPendingId] = useState<string | null>(null);

  const owners = useMemo(() => {
    const set = new Set<string>();
    (cycle.tasks ?? []).forEach((t) => {
      if (t.ownerId) set.add(t.ownerId);
    });
    return Array.from(set).sort();
  }, [cycle.tasks]);

  const visibleTasks = useMemo(() => {
    if (filterOwner === 'all') return cycle.tasks ?? [];
    return (cycle.tasks ?? []).filter((t) => t.ownerId === filterOwner);
  }, [cycle.tasks, filterOwner]);

  const counts = useMemo(() => {
    const tasks = cycle.tasks ?? [];
    return {
      done: tasks.filter((t) => t.status === 'DONE' || t.status === 'WAIVED').length,
      inProgress: tasks.filter((t) => t.status === 'IN_PROGRESS').length,
      blocked: tasks.filter((t) => t.status === 'BLOCKED').length,
      pending: tasks.filter((t) => t.status === 'PENDING').length,
    };
  }, [cycle.tasks]);

  async function markDone(task: CloseTask) {
    if (locked || pendingId) return;
    setPendingId(task.id);
    // Optimistic update — paint Done immediately, roll back on error.
    onTaskUpdated(task.id, { status: 'DONE', completedAt: new Date().toISOString() }, []);
    try {
      const res = await closeApi.updateTask(cycle.id, task.id, { status: 'DONE' });
      // Apply the cascade once the server confirms which downstream tasks
      // moved from BLOCKED to PENDING.
      res.cascadedTaskIds.forEach((id) => onTaskUpdated(id, { status: 'PENDING' }, []));
    } catch {
      // Rollback to PENDING if the API call fails.
      onTaskUpdated(task.id, { status: task.status, completedAt: task.completedAt }, []);
    } finally {
      setPendingId(null);
    }
  }

  async function waive(task: CloseTask) {
    if (locked || pendingId) return;
    setPendingId(task.id);
    onTaskUpdated(task.id, { status: 'WAIVED', completedAt: new Date().toISOString() }, []);
    try {
      const res = await closeApi.updateTask(cycle.id, task.id, { status: 'WAIVED' });
      res.cascadedTaskIds.forEach((id) => onTaskUpdated(id, { status: 'PENDING' }, []));
    } catch {
      onTaskUpdated(task.id, { status: task.status, completedAt: task.completedAt }, []);
    } finally {
      setPendingId(null);
    }
  }

  const columns: DataTableColumn<CloseTask>[] = [
    {
      key: 'title',
      header: lang === 'en' ? 'Task' : 'Tarea',
      cell: (r) => (
        <div>
          <div className="font-medium text-slate-900">{lang === 'en' ? r.titleEn : r.titleEs}</div>
          <div className="text-[10px] uppercase tracking-wide text-slate-400">{r.kind}</div>
        </div>
      ),
      sortValue: (r) => r.titleEn,
    },
    {
      key: 'owner',
      header: lang === 'en' ? 'Owner' : 'Responsable',
      cell: (r) => r.ownerId ?? '—',
      sortValue: (r) => r.ownerId ?? '',
      width: '110px',
    },
    {
      key: 'due',
      header: lang === 'en' ? 'Due' : 'Vence',
      cell: (r) => (r.dueAt ? new Date(r.dueAt).toLocaleDateString() : '—'),
      sortValue: (r) => r.dueAt ?? '',
      align: 'right',
      numeric: true,
      width: '110px',
    },
    {
      key: 'blockers',
      header: lang === 'en' ? 'Blockers' : 'Bloqueos',
      cell: (r) =>
        r.blockedByIds.length > 0 ? (
          <span className="font-mono text-xs text-rose-600">{r.blockedByIds.length}</span>
        ) : (
          <span className="text-slate-400">—</span>
        ),
      width: '90px',
      hideOnMobile: true,
    },
    {
      key: 'status',
      header: lang === 'en' ? 'Status' : 'Estado',
      cell: (r) => (
        <span
          className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLOR[r.status]}`}
        >
          {STATUS_LABEL[r.status][lang]}
        </span>
      ),
      sortValue: (r) => r.status,
      width: '120px',
    },
    {
      key: 'actions',
      header: '',
      cell: (r) => {
        const terminal = r.status === 'DONE' || r.status === 'WAIVED';
        if (terminal || locked) return null;
        const isPending = pendingId === r.id;
        return (
          <div className="flex justify-end gap-1.5">
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                markDone(r);
              }}
              disabled={isPending || r.status === 'BLOCKED'}
              className="inline-flex items-center gap-1 rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-semibold text-slate-700 hover:border-emerald-300 hover:bg-emerald-50 hover:text-emerald-700 disabled:cursor-not-allowed disabled:opacity-50"
              aria-label={lang === 'en' ? 'Mark done' : 'Marcar listo'}
            >
              {isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Check className="h-3 w-3" />}
              {lang === 'en' ? 'Done' : 'Listo'}
            </button>
            <button
              type="button"
              onClick={(e) => {
                e.stopPropagation();
                waive(r);
              }}
              disabled={isPending}
              className="rounded-md border border-slate-200 bg-white px-2 py-1 text-[11px] font-medium text-slate-500 hover:bg-slate-50 disabled:cursor-not-allowed disabled:opacity-50"
            >
              {lang === 'en' ? 'Waive' : 'Renunciar'}
            </button>
          </div>
        );
      },
      align: 'right',
      width: '150px',
    },
  ];

  return (
    <div className="space-y-4">
      <MetricStrip
        items={[
          { label: lang === 'en' ? 'Done' : 'Listo', value: counts.done },
          { label: lang === 'en' ? 'In progress' : 'En curso', value: counts.inProgress },
          {
            label: lang === 'en' ? 'Blocked' : 'Bloqueado',
            value: counts.blocked,
            delta: counts.blocked,
            deltaFormat: 'number',
          },
          { label: lang === 'en' ? 'Pending' : 'Pendiente', value: counts.pending },
        ]}
      />

      {owners.length > 0 ? (
        <div className="flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-400" />
          <span className="text-[11px] uppercase tracking-wider text-slate-500">
            {lang === 'en' ? 'Owner' : 'Responsable'}
          </span>
          <button
            type="button"
            onClick={() => setFilterOwner('all')}
            className={`rounded-full px-3 py-1 text-xs font-medium ${
              filterOwner === 'all'
                ? 'bg-slate-900 text-white'
                : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
            }`}
          >
            {lang === 'en' ? 'All' : 'Todos'}
          </button>
          {owners.map((o) => (
            <button
              key={o}
              type="button"
              onClick={() => setFilterOwner(o)}
              className={`rounded-full px-3 py-1 text-xs font-medium ${
                filterOwner === o
                  ? 'bg-slate-900 text-white'
                  : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
              }`}
            >
              {o}
            </button>
          ))}
        </div>
      ) : null}

      <DataTable
        columns={columns}
        rows={visibleTasks}
        rowKey={(r) => r.id}
        caption={lang === 'en' ? 'Close tasks' : 'Tareas de cierre'}
        emptyMessage={lang === 'en' ? 'No tasks match this filter' : 'Ninguna tarea coincide'}
        onRowClick={onTaskClicked}
      />
    </div>
  );
}
