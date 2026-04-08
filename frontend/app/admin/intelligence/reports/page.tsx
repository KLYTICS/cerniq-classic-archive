'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { ArrowLeft, Download, FileSpreadsheet, Sparkles } from 'lucide-react';

const REPORT_TYPES = [
  'WEEKLY_BRIEF',
  'COMPETITOR_TEAR_SHEET',
  'BUYER_DOSSIER',
  'ACTION_EXPORT',
  'HANDOFF_REPORT',
] as const;

interface AccountSummary {
  id: string;
  name: string;
  kind: string;
}

interface ArtifactSummary {
  id: string;
  title: string;
  type: string;
  createdAt: string;
}

export default function IntelligenceReportsPage() {
  const [accounts, setAccounts] = useState<AccountSummary[]>([]);
  const [artifacts, setArtifacts] = useState<ArtifactSummary[]>([]);
  const [selectedAccount, setSelectedAccount] = useState('');
  const [type, setType] = useState<(typeof REPORT_TYPES)[number]>('WEEKLY_BRIEF');
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const [overview, accountList] = await Promise.all([
        apiClient.getIntelligenceOverview(),
        apiClient.getIntelligenceAccounts(),
      ]);
      setArtifacts(overview.recentArtifacts || []);
      setAccounts(accountList || []);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const generate = async () => {
    setGenerating(true);
    try {
      const artifact = await apiClient.generateIntelligenceReport({
        type,
        title: title || undefined,
        accountIds: selectedAccount ? [selectedAccount] : undefined,
      });
      await apiClient.downloadIntelligenceArtifact(artifact.id, 'csv');
      await load();
    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-6xl px-6 py-8">
        <Link href="/admin/intelligence" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
          <ArrowLeft className="h-4 w-4" />
          Back to intelligence
        </Link>

        <div className="mt-4 grid gap-6 xl:grid-cols-[0.9fr_1.1fr]">
          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <p className="text-xs uppercase tracking-[0.26em] text-cyan-300">Report center</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Generate briefs, dossiers, and CSV exports.</h1>
            <p className="mt-3 text-sm leading-7 text-slate-400">
              Every report is saved as a durable intelligence artifact so the next session starts from the last institutional snapshot, not from scratch.
            </p>

            <div className="mt-6 space-y-4">
              <label className="block">
                <span className="text-sm text-slate-300">Report type</span>
                <select value={type} onChange={(event) => setType(event.target.value as (typeof REPORT_TYPES)[number])} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/30">
                  {REPORT_TYPES.map((reportType) => (
                    <option key={reportType} value={reportType}>
                      {reportType.replace(/_/g, ' ')}
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-slate-300">Specific account</span>
                <select value={selectedAccount} onChange={(event) => setSelectedAccount(event.target.value)} className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/30">
                  <option value="">All tracked accounts</option>
                  {accounts.map((account) => (
                    <option key={account.id} value={account.id}>
                      {account.name} ({account.kind})
                    </option>
                  ))}
                </select>
              </label>

              <label className="block">
                <span className="text-sm text-slate-300">Custom title</span>
                <input
                  value={title}
                  onChange={(event) => setTitle(event.target.value)}
                  placeholder="Optional custom title"
                  className="mt-2 w-full rounded-2xl border border-white/10 bg-slate-950 px-4 py-3 text-sm text-white outline-none focus:border-cyan-400/30"
                />
              </label>

              <button
                onClick={generate}
                disabled={generating}
                className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-50"
              >
                <Sparkles className="h-4 w-4" />
                {generating ? 'Generating...' : 'Generate and download CSV'}
              </button>
            </div>
          </section>

          <section className="rounded-3xl border border-white/10 bg-slate-900/70 p-6">
            <div className="flex items-center gap-3">
              <FileSpreadsheet className="h-5 w-5 text-cyan-300" />
              <h2 className="text-2xl font-semibold text-white">Recent artifacts</h2>
            </div>
            <div className="mt-5 space-y-3">
              {loading ? (
                Array.from({ length: 4 }).map((_, index) => (
                  <div key={index} className="h-24 animate-pulse rounded-2xl border border-white/10 bg-slate-950/60" />
                ))
              ) : artifacts.map((artifact) => (
                <div key={artifact.id} className="flex items-center justify-between rounded-2xl border border-white/10 bg-slate-950/60 p-4">
                  <div>
                    <p className="text-sm font-semibold text-white">{artifact.title}</p>
                    <p className="mt-1 text-xs text-slate-500">{artifact.type} • {new Date(artifact.createdAt).toLocaleString()}</p>
                  </div>
                  <div className="flex gap-2">
                    <button
                      onClick={() => apiClient.downloadIntelligenceArtifact(artifact.id, 'csv')}
                      className="inline-flex items-center gap-2 rounded-full border border-cyan-400/30 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/10"
                    >
                      <Download className="h-3.5 w-3.5" />
                      CSV
                    </button>
                    <button
                      onClick={() => apiClient.downloadIntelligenceArtifact(artifact.id, 'json')}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 px-3 py-1.5 text-xs font-semibold text-slate-200 transition hover:bg-white/5"
                    >
                      JSON
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
