'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  Activity,
  AlertTriangle,
  ArrowLeft,
  ArrowRight,
  BrainCircuit,
  FileSpreadsheet,
  RefreshCw,
  ShieldAlert,
  Users,
} from 'lucide-react';

interface IntelligenceOverview {
  workspace: { id: string; name: string };
  stats: {
    totalAccounts: number;
    buyers: number;
    competitors: number;
    staleAccounts: number;
    overdueActions: number;
  };
  hotChanges: Array<{
    id: string;
    accountId: string;
    accountName: string;
    title: string;
    severity: string;
    createdAt: string;
  }>;
  staleAccounts: Array<{
    id: string;
    name: string;
    kind: string;
    freshnessScore: number;
    nextRefreshAt?: string | null;
  }>;
  actions: Array<{
    id: string;
    type: string;
    title: string;
    description: string;
    status: string;
    actionScore: number;
    dueAt?: string | null;
  }>;
  recentRuns: Array<{
    id: string;
    status: string;
    startedAt: string;
    accountCount: number;
    snapshotCount: number;
    insightCount: number;
  }>;
  recentArtifacts: Array<{
    id: string;
    title: string;
    type: string;
    createdAt: string;
  }>;
  handoff: {
    summary: string;
    pinnedEntries: Array<{ id: string; title: string; body: string; type: string }>;
  };
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

const seedAccounts = [
  {
    kind: 'COMPETITOR',
    name: 'ALCO Advisory Partners',
    websiteUrl: 'https://example.com/alco-advisory',
    sourceOfTruth: 'manual_seed',
    currentSummary:
      'Regional competitor focused on outsourced ALM committee support and quarterly board packs.',
    sources: [
      {
        label: 'Competitor website',
        url: 'https://example.com/alco-advisory',
        sourceType: 'PUBLIC_WEBSITE',
        fetchPolicy: 'WEEKLY',
      },
      {
        label: 'Pricing page',
        url: 'https://example.com/alco-advisory/pricing',
        sourceType: 'PRICING_PAGE',
        fetchPolicy: 'WEEKLY',
      },
    ],
  },
  {
    kind: 'BUYER',
    name: 'Cooperativa Horizonte',
    websiteUrl: 'https://example.com/coop-horizonte',
    institutionalType: 'cooperativa',
    sourceOfTruth: 'manual_seed',
    currentSummary:
      'Target institution with manual reporting workflow, active executive team, and a likely near-term ALM modernization need.',
    metadata: { estimatedAssets: 245000000 },
    contacts: [
      { fullName: 'Ana Rivera', title: 'CFO', email: 'ana@example.com' },
    ],
    sources: [
      {
        label: 'Institution site',
        url: 'https://example.com/coop-horizonte',
        sourceType: 'OFFICIAL_REGISTRY',
        fetchPolicy: 'MONTHLY',
      },
    ],
  },
];

function statCard(
  title: string,
  value: number,
  icon: React.ReactNode,
  tone: string,
) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
      <div className={`mb-3 inline-flex rounded-xl p-2 ${tone}`}>{icon}</div>
      <p className="text-xs uppercase tracking-[0.24em] text-slate-500">{title}</p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
    </div>
  );
}

export default function IntelligenceOverviewPage() {
  const [data, setData] = useState<IntelligenceOverview | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState<'refresh' | 'seed' | null>(null);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getIntelligenceOverview();
      setData(result);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load intelligence overview'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const refreshStale = async () => {
    setBusy('refresh');
    try {
      await apiClient.refreshIntelligence({ staleOnly: true, trigger: 'admin_overview_refresh' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const seed = async () => {
    setBusy('seed');
    try {
      await apiClient.importIntelligenceAccounts({ accounts: seedAccounts });
      await apiClient.refreshIntelligence({ trigger: 'seed_bootstrap' });
      await load();
    } finally {
      setBusy(null);
    }
  };

  const hotChanges = useMemo(() => data?.hotChanges || [], [data]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="mb-4 inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">Cerniq Intelligence OS</p>
            <h1 className="mt-2 text-4xl font-semibold tracking-tight text-white">Run competitors, buyers, and actions from one shared operating surface.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Shared handoff memory, explainable live-source refreshes, CRM sync, and export-ready institutional reporting for every tracked account.
            </p>
          </div>
          <div className="flex flex-wrap gap-3">
            <button
              onClick={seed}
              disabled={busy !== null}
              className="rounded-full border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-50"
            >
              {busy === 'seed' ? 'Seeding...' : 'Seed sample accounts'}
            </button>
            <button
              onClick={refreshStale}
              disabled={busy !== null}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
            >
              <RefreshCw className={`h-4 w-4 ${busy === 'refresh' ? 'animate-spin' : ''}`} />
              Refresh stale accounts
            </button>
          </div>
        </div>

        {error ? (
          <div className="rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {loading ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div key={index} className="h-36 animate-pulse rounded-2xl border border-white/10 bg-slate-900/70" />
            ))}
          </div>
        ) : data ? (
          <>
            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              {statCard('Tracked Accounts', data.stats.totalAccounts, <BrainCircuit className="h-5 w-5 text-cyan-200" />, 'bg-cyan-500/15')}
              {statCard('Buyer Accounts', data.stats.buyers, <Users className="h-5 w-5 text-emerald-200" />, 'bg-emerald-500/15')}
              {statCard('Competitors', data.stats.competitors, <ShieldAlert className="h-5 w-5 text-amber-200" />, 'bg-amber-500/15')}
              {statCard('Overdue Actions', data.stats.overdueActions, <AlertTriangle className="h-5 w-5 text-red-200" />, 'bg-red-500/15')}
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Cross-session handoff</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">{data.workspace.name}</h2>
                  </div>
                  <Link href="/admin/intelligence/actions" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
                    Open action inbox
                    <ArrowRight className="h-4 w-4" />
                  </Link>
                </div>
                <div className="mt-5 rounded-2xl border border-cyan-500/20 bg-cyan-500/5 p-5">
                  <p className="text-sm leading-7 text-slate-200">{data.handoff.summary}</p>
                </div>
                <div className="mt-5 grid gap-3">
                  {data.handoff.pinnedEntries.map((entry) => (
                    <div key={entry.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <p className="text-xs uppercase tracking-[0.22em] text-slate-500">{entry.type}</p>
                      <p className="mt-2 text-sm font-semibold text-white">{entry.title}</p>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{entry.body}</p>
                    </div>
                  ))}
                  {data.handoff.pinnedEntries.length === 0 ? (
                    <p className="text-sm text-slate-500">No pinned handoff entries yet. Generate a handoff report or add memory from an account page.</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Recent runs</p>
                <div className="mt-4 space-y-3">
                  {data.recentRuns.map((run) => (
                    <div key={run.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{run.status}</p>
                        <p className="text-xs text-slate-500">{new Date(run.startedAt).toLocaleString()}</p>
                      </div>
                      <p className="mt-2 text-xs text-slate-400">
                        {run.accountCount} accounts, {run.snapshotCount} snapshots, {run.insightCount} insights
                      </p>
                    </div>
                  ))}
                </div>
              </section>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Hot changes</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">What changed across the tracked market</h2>
                  </div>
                  <Link href="/admin/intelligence/reports" className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
                    Reports
                  </Link>
                </div>
                <div className="mt-5 space-y-3">
                  {hotChanges.map((change) => (
                    <Link
                      key={change.id}
                      href={`/admin/intelligence/${change.accountId}`}
                      className="block rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-cyan-400/30"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{change.title}</p>
                        <span className={`rounded-full px-2 py-1 text-[10px] font-semibold ${
                          change.severity === 'HIGH'
                            ? 'bg-red-500/20 text-red-200'
                            : change.severity === 'MEDIUM'
                              ? 'bg-amber-500/20 text-amber-200'
                              : 'bg-slate-500/20 text-slate-200'
                        }`}>
                          {change.severity}
                        </span>
                      </div>
                      <p className="mt-2 text-sm text-slate-400">{change.accountName}</p>
                      <p className="mt-2 text-xs text-slate-500">{new Date(change.createdAt).toLocaleString()}</p>
                    </Link>
                  ))}
                  {hotChanges.length === 0 ? (
                    <p className="text-sm text-slate-500">Run a refresh to populate the hot-change feed.</p>
                  ) : null}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Stale accounts</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Where data is losing trust</h2>
                  </div>
                  <Activity className="h-5 w-5 text-amber-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {data.staleAccounts.map((account) => (
                    <Link
                      key={account.id}
                      href={`/admin/intelligence/${account.id}`}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4 transition hover:border-amber-400/30"
                    >
                      <div>
                        <p className="text-sm font-semibold text-white">{account.name}</p>
                        <p className="mt-1 text-xs text-slate-500">{account.kind}</p>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-amber-200">{account.freshnessScore}</p>
                        <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">Freshness</p>
                      </div>
                    </Link>
                  ))}
                  {data.staleAccounts.length === 0 ? (
                    <p className="text-sm text-slate-500">No stale accounts right now.</p>
                  ) : null}
                </div>
              </section>
            </div>

            <div className="mt-8 grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Action inbox</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Next-best actions</h2>
                  </div>
                  <Link href="/admin/intelligence/actions" className="text-sm font-medium text-cyan-300 transition hover:text-cyan-200">Open all</Link>
                </div>
                <div className="mt-5 space-y-3">
                  {data.actions.slice(0, 8).map((action) => (
                    <div key={action.id} className="rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div className="flex items-center justify-between gap-3">
                        <p className="text-sm font-semibold text-white">{action.title}</p>
                        <span className="text-xs font-semibold text-cyan-300">{action.actionScore}</span>
                      </div>
                      <p className="mt-2 text-sm leading-6 text-slate-400">{action.description}</p>
                      <p className="mt-3 text-xs text-slate-500">
                        {action.dueAt ? `Due ${new Date(action.dueAt).toLocaleDateString()}` : 'No due date'}
                      </p>
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Artifacts</p>
                    <h2 className="mt-2 text-2xl font-semibold text-white">Reports and exports</h2>
                  </div>
                  <FileSpreadsheet className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {data.recentArtifacts.map((artifact) => (
                    <div key={artifact.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                      <div>
                        <p className="text-sm font-semibold text-white">{artifact.title}</p>
                        <p className="mt-1 text-xs text-slate-500">{artifact.type} • {new Date(artifact.createdAt).toLocaleString()}</p>
                      </div>
                      <button
                        onClick={() => apiClient.downloadIntelligenceArtifact(artifact.id, 'csv')}
                        className="rounded-full border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
                      >
                        CSV
                      </button>
                    </div>
                  ))}
                  {data.recentArtifacts.length === 0 ? (
                    <p className="text-sm text-slate-500">Generate a report from the report center to create durable artifacts.</p>
                  ) : null}
                </div>
              </section>
            </div>
          </>
        ) : null}
      </div>
    </div>
  );
}
