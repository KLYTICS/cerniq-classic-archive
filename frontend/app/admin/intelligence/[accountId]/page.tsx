'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient } from '@/lib/api';
import {
  ArrowLeft,
  ClipboardList,
  Globe,
  Link2,
  Mail,
  RefreshCw,
  Shield,
  StickyNote,
} from 'lucide-react';

interface AccountDetail {
  id: string;
  name: string;
  kind: string;
  status: string;
  domain?: string | null;
  websiteUrl?: string | null;
  currentSummary?: string | null;
  freshnessScore: number;
  opportunityScore: number;
  threatScore: number;
  actionScore: number;
  lastRefreshedAt?: string | null;
  contacts: Array<{
    id: string;
    fullName: string;
    title?: string | null;
    email?: string | null;
    phone?: string | null;
    contactScore: number;
  }>;
  sources: Array<{
    id: string;
    label?: string | null;
    url: string;
    sourceType: string;
    trustLevel: string;
    lastFetchedAt?: string | null;
  }>;
  insights: Array<{
    id: string;
    title: string;
    description: string;
    severity: string;
    createdAt: string;
  }>;
  actions: Array<{
    id: string;
    title: string;
    description: string;
    status: string;
    actionScore: number;
    dueAt?: string | null;
  }>;
  memoryEntries: Array<{
    id: string;
    title: string;
    body: string;
    type: string;
    pinned: boolean;
    createdAt: string;
  }>;
  syncedLeads: Array<{ id: string; name: string; email: string; status: string; priority: string }>;
  syncedProspects: Array<{ id: string; name: string; outreachStatus: string; contactEmail?: string | null }>;
}

interface TimelineEntry {
  id: string;
  kind: string;
  title: string;
  description: string;
  timestamp: string;
  severity?: string;
  status?: string;
}

function getApiErrorMessage(error: unknown, fallback: string) {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: number } }).response?.status === 'number'
  ) {
    return (error as { response?: { status?: number } }).response?.status === 401
      ? 'Invalid admin key'
      : fallback;
  }
  return fallback;
}

export default function IntelligenceAccountPage() {
  const params = useParams<{ accountId: string }>();
  const accountId = String(params.accountId);
  const [account, setAccount] = useState<AccountDetail | null>(null);
  const [timeline, setTimeline] = useState<TimelineEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [memoryTitle, setMemoryTitle] = useState('');
  const [memoryBody, setMemoryBody] = useState('');
  const [savingMemory, setSavingMemory] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [detail, events] = await Promise.all([
        apiClient.getIntelligenceAccount(accountId),
        apiClient.getIntelligenceTimeline(accountId),
      ]);
      setAccount(detail);
      setTimeline(events);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load intelligence account'));
    } finally {
      setLoading(false);
    }
  }, [accountId]);

  useEffect(() => {
    load();
  }, [load]);

  const refresh = async () => {
    await apiClient.refreshIntelligence({ accountIds: [accountId], trigger: 'account_detail_refresh' });
    await load();
  };

  const saveMemory = async () => {
    if (!memoryTitle.trim() || !memoryBody.trim() || !account) return;
    setSavingMemory(true);
    try {
      await apiClient.createIntelligenceMemoryEntry({
        accountId: account.id,
        type: 'NOTE',
        title: memoryTitle.trim(),
        body: memoryBody.trim(),
        pinned: false,
      });
      setMemoryTitle('');
      setMemoryBody('');
      await load();
    } finally {
      setSavingMemory(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-start sm:justify-between">
          <div>
            <Link href="/admin/intelligence" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to intelligence
            </Link>
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">{account?.kind || 'ACCOUNT'}</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">{account?.name || 'Loading...'}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">{account?.currentSummary || 'No current summary yet.'}</p>
          </div>
          <button
            onClick={refresh}
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            <RefreshCw className="h-4 w-4" />
            Refresh account
          </button>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-28 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70" />
            ))}
          </div>
        ) : account ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Freshness</p>
                <p className="mt-3 text-3xl font-semibold text-white">{account.freshnessScore}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Opportunity</p>
                <p className="mt-3 text-3xl font-semibold text-emerald-300">{account.opportunityScore}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Threat</p>
                <p className="mt-3 text-3xl font-semibold text-amber-300">{account.threatScore}</p>
              </div>
              <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
                <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Action score</p>
                <p className="mt-3 text-3xl font-semibold text-cyan-300">{account.actionScore}</p>
              </div>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center gap-3">
                  <Globe className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-2xl font-semibold text-white">Sources and contacts</h2>
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Sources</p>
                    <div className="mt-4 space-y-3">
                      {account.sources.map((source) => (
                        <a
                          key={source.id}
                          href={source.url}
                          target="_blank"
                          rel="noreferrer"
                          className="block rounded-2xl border border-white/10 bg-slate-900/60 p-4 transition hover:border-cyan-400/30"
                        >
                          <div className="flex items-center justify-between gap-3">
                            <p className="text-sm font-semibold text-white">{source.label || source.sourceType}</p>
                            <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{source.trustLevel}</span>
                          </div>
                          <p className="mt-2 flex items-center gap-2 text-xs text-slate-400">
                            <Link2 className="h-3.5 w-3.5" />
                            {source.url}
                          </p>
                        </a>
                      ))}
                    </div>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Contacts</p>
                    <div className="mt-4 space-y-3">
                      {account.contacts.map((contact) => (
                        <div key={contact.id} className="rounded-2xl border border-white/10 bg-slate-900/60 p-4">
                          <div className="flex items-center justify-between gap-3">
                            <div>
                              <p className="text-sm font-semibold text-white">{contact.fullName}</p>
                              <p className="mt-1 text-xs text-slate-400">{contact.title || 'No title captured'}</p>
                            </div>
                            <span className="text-xs font-semibold text-cyan-300">{contact.contactScore}</span>
                          </div>
                          {contact.email ? (
                            <p className="mt-3 flex items-center gap-2 text-xs text-slate-400">
                              <Mail className="h-3.5 w-3.5" />
                              {contact.email}
                            </p>
                          ) : null}
                        </div>
                      ))}
                    </div>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center gap-3">
                  <ClipboardList className="h-5 w-5 text-amber-300" />
                  <h2 className="text-2xl font-semibold text-white">Insights and actions</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {account.insights.slice(0, 5).map((insight) => (
                    <div key={insight.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{insight.title}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          insight.severity === 'HIGH'
                            ? 'bg-red-500/20 text-red-200'
                            : insight.severity === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-200'
                              : 'bg-slate-500/20 text-slate-200'
                        }`}>
                          {insight.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{insight.description}</p>
                    </div>
                  ))}
                  {account.actions.map((action) => (
                    <div key={action.id} className="rounded-2xl border border-cyan-500/15 bg-cyan-500/5 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{action.title}</p>
                        <span className="text-xs font-semibold text-cyan-300">{action.actionScore}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{action.description}</p>
                      <p className="mt-3 text-xs text-slate-500">{action.dueAt ? `Due ${new Date(action.dueAt).toLocaleDateString()}` : 'No due date'}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1fr_0.9fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center gap-3">
                  <StickyNote className="h-5 w-5 text-cyan-300" />
                  <h2 className="text-2xl font-semibold text-white">Shared memory</h2>
                </div>
                <div className="mt-5 grid gap-3">
                  {account.memoryEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{entry.title}</p>
                        <span className="text-[10px] uppercase tracking-[0.18em] text-slate-500">{entry.type}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{entry.body}</p>
                    </div>
                  ))}
                </div>
                <div className="mt-5 rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <p className="text-xs uppercase tracking-[0.22em] text-slate-500">Add memory</p>
                  <input
                    value={memoryTitle}
                    onChange={(event) => setMemoryTitle(event.target.value)}
                    placeholder="Short title"
                    className="mt-4 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
                  />
                  <textarea
                    value={memoryBody}
                    onChange={(event) => setMemoryBody(event.target.value)}
                    placeholder="What should the team remember next session?"
                    className="mt-3 min-h-32 w-full rounded-xl border border-white/10 bg-slate-900 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/40"
                  />
                  <button
                    onClick={saveMemory}
                    disabled={savingMemory}
                    className="mt-3 rounded-full bg-cyan-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-cyan-300 disabled:opacity-50"
                  >
                    {savingMemory ? 'Saving...' : 'Save memory'}
                  </button>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center gap-3">
                  <Shield className="h-5 w-5 text-emerald-300" />
                  <h2 className="text-2xl font-semibold text-white">Pipeline links</h2>
                </div>
                <div className="mt-5 space-y-3">
                  {account.syncedLeads.map((lead) => (
                    <div key={lead.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-sm font-semibold text-white">{lead.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{lead.email}</p>
                      <p className="mt-2 text-xs text-slate-500">{lead.status} • {lead.priority}</p>
                    </div>
                  ))}
                  {account.syncedProspects.map((prospect) => (
                    <div key={prospect.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-sm font-semibold text-white">{prospect.name}</p>
                      <p className="mt-1 text-xs text-slate-400">{prospect.contactEmail || 'No email captured'}</p>
                      <p className="mt-2 text-xs text-slate-500">{prospect.outreachStatus}</p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <section className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Timeline</p>
              <div className="mt-5 space-y-3">
                {timeline.map((entry) => (
                  <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                    <div className="flex items-center justify-between gap-3">
                      <p className="text-sm font-semibold text-white">{entry.title}</p>
                      <span className="text-xs text-slate-500">{new Date(entry.timestamp).toLocaleString()}</span>
                    </div>
                    <p className="mt-2 text-sm leading-6 text-slate-400">{entry.description}</p>
                  </div>
                ))}
              </div>
            </section>
          </>
        ) : null}
      </div>
    </div>
  );
}
