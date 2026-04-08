'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ArrowLeft, Clock3, Filter, ListTodo } from 'lucide-react';

interface ActionRecord {
  id: string;
  type: string;
  status: string;
  title: string;
  description: string;
  actionScore: number;
  dueAt?: string | null;
}

export default function IntelligenceActionsPage() {
  const [actions, setActions] = useState<ActionRecord[]>([]);
  const [status, setStatus] = useState('');
  const [kind, setKind] = useState('');
  const [loading, setLoading] = useState(true);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const result = await apiClient.getIntelligenceActions({
        status: status || undefined,
        kind: kind || undefined,
      });
      setActions(result);
    } finally {
      setLoading(false);
    }
  }, [kind, status]);

  useEffect(() => {
    load();
  }, [load]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/admin/intelligence" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to intelligence
        </Link>
        <div className="mt-4 flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between">
          <div>
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Action inbox</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Work the highest-value next step.</h1>
          </div>
          <div className="flex flex-wrap gap-3">
            <label className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
              <span className="mr-2 text-slate-500">Status</span>
              <select value={status} onChange={(event) => setStatus(event.target.value)} className="bg-transparent outline-none">
                <option value="">All</option>
                <option value="OPEN">Open</option>
                <option value="IN_PROGRESS">In progress</option>
                <option value="DONE">Done</option>
              </select>
            </label>
            <label className="rounded-full border border-white/10 bg-slate-900/70 px-4 py-2 text-sm text-slate-300">
              <span className="mr-2 text-slate-500">Kind</span>
              <select value={kind} onChange={(event) => setKind(event.target.value)} className="bg-transparent outline-none">
                <option value="">All</option>
                <option value="BUYER">Buyer</option>
                <option value="COMPETITOR">Competitor</option>
              </select>
            </label>
          </div>
        </div>

        <div className="mt-8 grid gap-4">
          {loading ? (
            Array.from({ length: 5 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70" />
            ))
          ) : actions.map((action) => (
            <div key={action.id} className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
              <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                <div>
                  <div className="flex items-center gap-2">
                    <ListTodo className="h-4 w-4 text-cyan-300" />
                    <p className="text-lg font-semibold text-white">{action.title}</p>
                  </div>
                  <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{action.description}</p>
                </div>
                <div className="text-right">
                  <p className="text-2xl font-semibold text-cyan-300">{action.actionScore}</p>
                  <p className="text-xs uppercase tracking-[0.2em] text-slate-500">score</p>
                </div>
              </div>
              <div className="mt-4 flex flex-wrap items-center gap-3 text-xs text-slate-500">
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">{action.type}</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">{action.status}</span>
                <span className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1">
                  <Clock3 className="h-3.5 w-3.5" />
                  {action.dueAt ? new Date(action.dueAt).toLocaleDateString() : 'No due date'}
                </span>
              </div>
            </div>
          ))}
          {!loading && actions.length === 0 ? (
            <div className="rounded-2xl border border-dashed border-white/10 bg-slate-900/40 p-12 text-center text-sm text-slate-500">
              <Filter className="mx-auto mb-3 h-5 w-5" />
              No actions match the current filters.
            </div>
          ) : null}
        </div>
      </div>
    </div>
  );
}
