'use client';

/**
 * TaskDetailDrawer — slide-in panel on task row click.
 *
 * Customer journey moment: Maria clicks a close task in the calendar.
 * The drawer slides in from the right with everything she needs without
 * leaving the page context: owner, due date, evidence URLs, blocker
 * graph (who blocks me, who do I block), completion history, and the
 * same Done/Waive actions as the inline row. Escape closes.
 *
 * Built on the existing Modal primitive's focus-trap/Escape-to-close
 * conventions, but rendered as a right-edge sheet instead of a centered
 * dialog — that's the pattern users know from Gmail, Linear, Notion.
 */

import { useEffect, useMemo, useState } from 'react';
import {
  Check,
  CheckCircle2,
  CircleSlash,
  Link2,
  Loader2,
  Plus,
  Trash2,
  X,
} from 'lucide-react';
import {
  closeApi,
  type CloseCycleDetail,
  type CloseTask,
  type CloseTaskStatus,
} from '@/lib/close-api';

type Lang = 'en' | 'es';

interface TaskDetailDrawerProps {
  task: CloseTask | null;
  cycle: CloseCycleDetail;
  lang: Lang;
  open: boolean;
  onClose: () => void;
  onTaskUpdated: (taskId: string, patch: Partial<CloseTask>, cascadedIds: string[]) => void;
  onToast?: (message: string, variant: 'success' | 'error') => void;
  locked: boolean;
}

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
  WAIVED: 'border-slate-200 bg-slate-50 text-slate-500',
};

export function TaskDetailDrawer({
  task,
  cycle,
  lang,
  open,
  onClose,
  onTaskUpdated,
  onToast,
  locked,
}: TaskDetailDrawerProps) {
  const [savingField, setSavingField] = useState<string | null>(null);
  const [urlInput, setUrlInput] = useState('');

  // Close on Escape, lock body scroll while open.
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

  // Map tasks by id so we can render blocker labels without child lookups.
  const taskById = useMemo(() => {
    const map = new Map<string, CloseTask>();
    cycle.tasks.forEach((t) => map.set(t.id, t));
    return map;
  }, [cycle.tasks]);

  // Tasks that depend on this one (downstream blockers).
  const dependents = useMemo(() => {
    if (!task) return [];
    return cycle.tasks.filter((t) => t.blockedByIds.includes(task.id));
  }, [task, cycle.tasks]);

  if (!task) return null;
  // Narrow task once so every closure below sees a non-null value without
  // TypeScript losing the refinement across function boundaries.
  const t: CloseTask = task;

  async function patch(body: Parameters<typeof closeApi.updateTask>[2], fieldKey: string) {
    if (locked) return;
    setSavingField(fieldKey);
    try {
      const res = await closeApi.updateTask(cycle.id, t.id, body);
      onTaskUpdated(t.id, res.task as Partial<CloseTask>, res.cascadedTaskIds);
      res.cascadedTaskIds.forEach((id) => onTaskUpdated(id, { status: 'PENDING' }, []));
    } catch (err) {
      onToast?.(err instanceof Error ? err.message : 'Update failed', 'error');
    } finally {
      setSavingField(null);
    }
  }

  async function complete() {
    await patch({ status: 'DONE' }, 'status');
    onToast?.(
      lang === 'en' ? `Marked "${t.titleEn}" done` : `"${t.titleEs}" marcada como lista`,
      'success',
    );
  }

  async function waive() {
    await patch({ status: 'WAIVED' }, 'status');
    onToast?.(
      lang === 'en' ? `Waived "${t.titleEn}"` : `"${t.titleEs}" renunciada`,
      'success',
    );
  }

  async function updateOwner(newOwner: string) {
    await patch({ ownerId: newOwner }, 'owner');
  }

  async function updateDue(newDue: string) {
    await patch({ dueAt: newDue }, 'due');
  }

  async function addEvidence() {
    const url = urlInput.trim();
    if (!url) return;
    const urls = [...t.evidenceUrls, url];
    await patch({ evidenceUrls: urls }, 'evidence');
    setUrlInput('');
  }

  async function removeEvidence(idx: number) {
    const urls = t.evidenceUrls.filter((_, i) => i !== idx);
    await patch({ evidenceUrls: urls }, 'evidence');
  }

  const terminal = task.status === 'DONE' || task.status === 'WAIVED';
  const knownOwners = Array.from(
    new Set(cycle.tasks.map((t) => t.ownerId).filter((o): o is string => !!o)),
  );

  return (
    <>
      {/* Backdrop */}
      <div
        className={`fixed inset-0 z-50 bg-black/30 backdrop-blur-sm transition-opacity ${
          open ? 'opacity-100' : 'pointer-events-none opacity-0'
        }`}
        onClick={onClose}
        aria-hidden
      />

      {/* Sheet */}
      <aside
        role="dialog"
        aria-modal="true"
        aria-label={lang === 'en' ? 'Task details' : 'Detalles de tarea'}
        className={`fixed inset-y-0 right-0 z-50 flex w-full max-w-md flex-col overflow-y-auto bg-white shadow-2xl transition-transform ${
          open ? 'translate-x-0' : 'translate-x-full'
        }`}
      >
        <header className="sticky top-0 z-10 border-b border-slate-100 bg-white px-5 py-4">
          <div className="flex items-start justify-between gap-3">
            <div className="min-w-0">
              <div className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                {task.kind}
              </div>
              <h2 className="mt-0.5 text-lg font-bold text-slate-900">
                {lang === 'en' ? task.titleEn : task.titleEs}
              </h2>
              <div className="mt-2 flex items-center gap-2">
                <span
                  className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide ${STATUS_COLOR[task.status]}`}
                >
                  {STATUS_LABEL[task.status][lang]}
                </span>
                {savingField ? (
                  <Loader2 className="h-3 w-3 animate-spin text-slate-400" />
                ) : null}
              </div>
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
        </header>

        <div className="flex-1 space-y-6 px-5 py-5">
          {/* Owner */}
          <Section label={lang === 'en' ? 'Owner' : 'Responsable'}>
            <div className="flex flex-wrap gap-1.5">
              {knownOwners.map((o) => (
                <button
                  key={o}
                  type="button"
                  disabled={locked || terminal}
                  onClick={() => updateOwner(o)}
                  className={`rounded-full px-3 py-1 text-xs font-medium transition ${
                    task.ownerId === o
                      ? 'bg-slate-900 text-white'
                      : 'border border-slate-200 bg-white text-slate-600 hover:bg-slate-50'
                  } disabled:cursor-not-allowed disabled:opacity-50`}
                >
                  {o}
                </button>
              ))}
              {task.ownerId && !knownOwners.includes(task.ownerId) ? (
                <span className="rounded-full bg-slate-900 px-3 py-1 text-xs font-medium text-white">
                  {task.ownerId}
                </span>
              ) : null}
            </div>
          </Section>

          {/* Due date */}
          <Section label={lang === 'en' ? 'Due date' : 'Fecha de vencimiento'}>
            <input
              type="date"
              value={task.dueAt ? task.dueAt.slice(0, 10) : ''}
              disabled={locked || terminal}
              onChange={(e) => updateDue(new Date(e.target.value).toISOString())}
              className="rounded-md border border-slate-300 px-2 py-1.5 font-mono text-sm tabular-nums focus:border-slate-500 focus:outline-none disabled:cursor-not-allowed disabled:bg-slate-50"
            />
          </Section>

          {/* Blockers (upstream) */}
          <Section label={lang === 'en' ? 'Blocked by' : 'Bloqueado por'}>
            {task.blockedByIds.length === 0 ? (
              <p className="text-sm text-slate-400">
                {lang === 'en' ? 'No upstream blockers' : 'Sin bloqueos'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {task.blockedByIds.map((id) => {
                  const blocker = taskById.get(id);
                  if (!blocker) return null;
                  const done = blocker.status === 'DONE' || blocker.status === 'WAIVED';
                  return (
                    <li
                      key={id}
                      className="flex items-center justify-between rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs"
                    >
                      <span className="truncate">
                        {lang === 'en' ? blocker.titleEn : blocker.titleEs}
                      </span>
                      <span
                        className={`inline-flex items-center rounded-full border px-1.5 py-0.5 text-[9px] font-semibold uppercase ${STATUS_COLOR[blocker.status]}`}
                      >
                        {done ? <Check className="mr-0.5 h-2.5 w-2.5" /> : null}
                        {blocker.status}
                      </span>
                    </li>
                  );
                })}
              </ul>
            )}
          </Section>

          {/* Dependents (downstream) */}
          <Section label={lang === 'en' ? 'Blocks' : 'Bloquea'}>
            {dependents.length === 0 ? (
              <p className="text-sm text-slate-400">
                {lang === 'en' ? 'Not blocking anything' : 'No bloquea nada'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {dependents.map((d) => (
                  <li
                    key={d.id}
                    className="rounded-md border border-slate-200 bg-slate-50 px-2.5 py-1.5 text-xs text-slate-700"
                  >
                    {lang === 'en' ? d.titleEn : d.titleEs}
                  </li>
                ))}
              </ul>
            )}
          </Section>

          {/* Evidence URLs */}
          <Section label={lang === 'en' ? 'Evidence' : 'Evidencia'}>
            {task.evidenceUrls.length === 0 ? (
              <p className="text-sm text-slate-400">
                {lang === 'en' ? 'No evidence attached' : 'Sin evidencia adjunta'}
              </p>
            ) : (
              <ul className="space-y-1.5">
                {task.evidenceUrls.map((url, i) => (
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
                    {!locked && !terminal ? (
                      <button
                        type="button"
                        onClick={() => removeEvidence(i)}
                        className="rounded p-1 text-slate-400 hover:bg-rose-50 hover:text-rose-600"
                        aria-label={lang === 'en' ? 'Remove' : 'Quitar'}
                      >
                        <Trash2 className="h-3 w-3" />
                      </button>
                    ) : null}
                  </li>
                ))}
              </ul>
            )}
            {!locked && !terminal ? (
              <div className="mt-2 flex gap-1.5">
                <input
                  type="url"
                  value={urlInput}
                  placeholder="https://…"
                  onChange={(e) => setUrlInput(e.target.value)}
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
                  disabled={!urlInput.trim()}
                  className="inline-flex items-center gap-1 rounded-md bg-slate-900 px-2.5 py-1.5 text-xs font-semibold text-white hover:bg-slate-800 disabled:opacity-50"
                >
                  <Plus className="h-3 w-3" />
                  {lang === 'en' ? 'Add' : 'Añadir'}
                </button>
              </div>
            ) : null}
          </Section>

          {/* Completion history */}
          {task.completedAt ? (
            <Section label={lang === 'en' ? 'History' : 'Historial'}>
              <p className="text-xs text-slate-600">
                {lang === 'en' ? 'Completed' : 'Completada'}{' '}
                <time dateTime={task.completedAt} className="font-mono">
                  {new Date(task.completedAt).toLocaleString()}
                </time>
              </p>
            </Section>
          ) : null}
        </div>

        {/* Sticky footer actions */}
        {!locked && !terminal ? (
          <footer className="sticky bottom-0 border-t border-slate-100 bg-white px-5 py-4">
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={waive}
                disabled={!!savingField}
                className="inline-flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-4 py-1.5 text-sm font-semibold text-slate-600 hover:bg-slate-50 disabled:opacity-60"
              >
                <CircleSlash className="h-3.5 w-3.5" />
                {lang === 'en' ? 'Waive' : 'Renunciar'}
              </button>
              <button
                type="button"
                onClick={complete}
                disabled={!!savingField || task.status === 'BLOCKED'}
                className="inline-flex items-center gap-1.5 rounded-full bg-emerald-600 px-4 py-1.5 text-sm font-semibold text-white hover:bg-emerald-700 disabled:cursor-not-allowed disabled:bg-slate-300"
              >
                <CheckCircle2 className="h-3.5 w-3.5" />
                {lang === 'en' ? 'Mark done' : 'Marcar listo'}
              </button>
            </div>
          </footer>
        ) : null}
      </aside>
    </>
  );
}

function Section({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <section>
      <div className="mb-2 text-[10px] font-semibold uppercase tracking-wider text-slate-500">
        {label}
      </div>
      {children}
    </section>
  );
}
