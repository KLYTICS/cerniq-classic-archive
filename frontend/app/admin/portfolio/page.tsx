'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  clearStoredAdminKey,
  hasStoredAdminKey,
  persistAdminKey,
} from '@/lib/admin-session';
import { MetricStrip, type MetricStripItem } from '@/components/ui/cerniq/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/ui/cerniq/DataTable';
import {
  ArrowLeft,
  Building2,
  Copy,
  Download,
  Mail,
  RefreshCw,
  Send,
  Sparkles,
  Target,
} from 'lucide-react';

type IcpFilter = 'all' | 'tier1' | 'tier2' | 'tier3';
type OutreachFilter = 'all' | 'not_started' | 'sent' | 'replied' | 'meeting_set';

interface PortfolioProspect {
  id: string;
  name: string;
  institutionType: string;
  location: string | null;
  region: string | null;
  icpTier: string | null;
  estimatedAssets: number | string | null;
  memberCount: number | null;
  employeeCount: number | null;
  publicDataIdentifier: string | null;
  outreachStatus: string;
  contactRole: string | null;
  contactName: string | null;
  contactEmail: string | null;
}

interface PortfolioSummary {
  total: number;
  cooperativas: number;
  withEmail: number;
  withoutEmail: number;
  byTier: Record<string, number>;
  byOutreach: Record<string, number>;
  totalAssetsUsd: number;
  mission: string;
}

interface OutreachDraft {
  subject: string;
  body: string;
  prospect: { name: string; assets: string; location: string | null };
}

function formatAssets(value: number | string | null): string {
  const n = Number(value ?? 0);
  if (!Number.isFinite(n) || n <= 0) return '—';
  if (n >= 1_000_000_000) return `$${(n / 1_000_000_000).toFixed(2)}B`;
  if (n >= 1_000_000) return `$${(n / 1_000_000).toFixed(1)}M`;
  return `$${n.toLocaleString()}`;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: number } }).response?.status ===
      'number'
  ) {
    return (error as { response?: { status?: number } }).response?.status ===
      401
      ? 'Invalid admin key'
      : fallback;
  }
  return fallback;
}

function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError(null);
    try {
      persistAdminKey(password);
      await apiClient.getPortfolioSummary();
      onAuth();
    } catch (err) {
      clearStoredAdminKey();
      setError(getApiErrorMessage(err, 'Auth failed'));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-slate-100">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-md rounded-2xl border border-white/10 bg-slate-900/80 p-8 shadow-2xl"
      >
        <p className="text-xs uppercase tracking-[0.24em] text-cyan-300">
          Portfolio suite
        </p>
        <h1 className="mt-2 text-2xl font-semibold">CERNIQ Coop Portfolio</h1>
        <p className="mt-2 text-sm text-slate-400">
          Manage outreach across all COSSEC-insured cooperativas — bilingual ALM
          wedge today, balance-sheet OS tomorrow.
        </p>
        <input
          type="password"
          value={password}
          onChange={(e) => setPassword(e.target.value)}
          placeholder="Admin key"
          className="mt-6 w-full rounded-lg border border-white/10 bg-black/40 px-3 py-2 text-sm"
        />
        {error && <p className="mt-2 text-sm text-red-300">{error}</p>}
        <button
          type="submit"
          disabled={checking || !password}
          className="mt-4 w-full rounded-lg bg-cyan-500 px-4 py-2 text-sm font-semibold text-slate-950 disabled:opacity-50"
        >
          {checking ? 'Checking…' : 'Enter portfolio'}
        </button>
      </form>
    </div>
  );
}

export default function AdminPortfolioPage() {
  const [authed, setAuthed] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [summary, setSummary] = useState<PortfolioSummary | null>(null);
  const [rows, setRows] = useState<PortfolioProspect[]>([]);
  const [icpFilter, setIcpFilter] = useState<IcpFilter>('all');
  const [outreachFilter, setOutreachFilter] = useState<OutreachFilter>('all');
  const [lang, setLang] = useState<'es' | 'en'>('es');
  const [seedBusy, setSeedBusy] = useState(false);
  const [draftBusy, setDraftBusy] = useState(false);
  const [selectedDraft, setSelectedDraft] = useState<{
    id: string;
    name: string;
    draft: OutreachDraft;
  } | null>(null);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  useEffect(() => {
    if (hasStoredAdminKey()) setAuthed(true);
  }, []);

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [sum, prospects] = await Promise.all([
        apiClient.getPortfolioSummary(),
        apiClient.getProspects({
          icpTier: icpFilter === 'all' ? undefined : icpFilter,
          outreachStatus:
            outreachFilter === 'all' ? undefined : outreachFilter,
        }),
      ]);
      setSummary(sum);
      setRows(Array.isArray(prospects) ? prospects : []);
    } catch (err) {
      setError(getApiErrorMessage(err, 'Failed to load portfolio'));
    } finally {
      setLoading(false);
    }
  }, [icpFilter, outreachFilter]);

  useEffect(() => {
    if (authed) void load();
  }, [authed, load]);

  const metrics: MetricStripItem[] = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: 'Universe',
        value: String(summary.total),
        tooltip: 'COSSEC registry',
      },
      {
        label: 'Tier 1 ≥$100M',
        value: String(summary.byTier.tier1 ?? 0),
        tooltip: 'Primary ICP',
      },
      {
        label: 'Tier 2',
        value: String(summary.byTier.tier2 ?? 0),
        tooltip: '$50–100M',
      },
      {
        label: 'With email',
        value: String(summary.withEmail),
        tooltip: `${summary.withoutEmail} need contacts`,
      },
      {
        label: 'System assets',
        value: formatAssets(summary.totalAssetsUsd),
        tooltip: 'Sum of registry',
      },
    ];
  }, [summary]);

  const openDraft = useCallback(
    async (row: PortfolioProspect) => {
      setDraftBusy(true);
      setStatusMsg(null);
      try {
        const draft = await apiClient.getOutreachDraft(row.id, lang);
        setSelectedDraft({ id: row.id, name: row.name, draft });
      } catch (err) {
        setStatusMsg(getApiErrorMessage(err, 'Could not generate draft'));
      } finally {
        setDraftBusy(false);
      }
    },
    [lang],
  );

  const columns: DataTableColumn<PortfolioProspect>[] = useMemo(
    () => [
      {
        key: 'name',
        header: 'Cooperativa',
        sortValue: (r) => r.name,
        cell: (r) => (
          <div>
            <div className="font-medium text-slate-100">{r.name}</div>
            <div className="text-xs text-slate-500">
              CS {r.publicDataIdentifier ?? '—'} · {r.location ?? 'PR'}
            </div>
          </div>
        ),
      },
      {
        key: 'tier',
        header: 'ICP',
        sortValue: (r) => r.icpTier ?? '',
        cell: (r) => (
          <span className="rounded border border-white/10 bg-white/5 px-2 py-0.5 text-xs uppercase tracking-wide text-cyan-200">
            {r.icpTier ?? '—'}
          </span>
        ),
      },
      {
        key: 'assets',
        header: 'Assets',
        numeric: true,
        align: 'right',
        sortValue: (r) => Number(r.estimatedAssets ?? 0),
        cell: (r) => (
          <span className="font-mono text-sm">
            {formatAssets(r.estimatedAssets)}
          </span>
        ),
      },
      {
        key: 'members',
        header: 'Members',
        numeric: true,
        align: 'right',
        hideOnMobile: true,
        sortValue: (r) => r.memberCount ?? 0,
        cell: (r) => (
          <span className="font-mono text-sm">
            {r.memberCount?.toLocaleString() ?? '—'}
          </span>
        ),
      },
      {
        key: 'outreach',
        header: 'Outreach',
        sortValue: (r) => r.outreachStatus,
        cell: (r) => (
          <span className="text-xs text-slate-300">
            {r.outreachStatus.replace(/_/g, ' ')}
          </span>
        ),
      },
      {
        key: 'email',
        header: 'Contact',
        hideOnMobile: true,
        cell: (r) =>
          r.contactEmail ? (
            <span className="text-xs text-emerald-300">{r.contactEmail}</span>
          ) : (
            <span className="text-xs text-amber-300/80">
              {r.contactRole ?? 'CFO'} — no email
            </span>
          ),
      },
      {
        key: 'actions',
        header: '',
        cell: (r) => (
          <button
            type="button"
            onClick={(e) => {
              e.stopPropagation();
              void openDraft(r);
            }}
            className="inline-flex items-center gap-1 rounded border border-cyan-500/30 bg-cyan-500/10 px-2 py-1 text-xs font-semibold text-cyan-200 hover:bg-cyan-500/20"
          >
            <Mail className="h-3 w-3" />
            Draft
          </button>
        ),
      },
    ],
    [openDraft],
  );

  async function handleSeed() {
    setSeedBusy(true);
    setStatusMsg(null);
    try {
      const result = await apiClient.seedProspects();
      setStatusMsg(
        `Registry seeded: created ${result.created ?? 0}, updated ${result.updated ?? 0}, total ${result.total ?? 91}`,
      );
      await load();
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Seed failed'));
    } finally {
      setSeedBusy(false);
    }
  }

  async function handleDraftPack() {
    setDraftBusy(true);
    setStatusMsg(null);
    try {
      const pack = await apiClient.getOutreachDraftPack({
        lang,
        icpTier: icpFilter === 'all' ? undefined : icpFilter,
        limit: 91,
      });
      const text = pack.drafts
        .map(
          (d) =>
            `=== ${d.name} (${d.icpTier ?? 'n/a'}) ===\nTo: ${d.contactEmail ?? '(add email)'}\nSubject: ${d.subject}\n\n${d.body}\n`,
        )
        .join('\n');
      await navigator.clipboard.writeText(text);
      setStatusMsg(
        `Copied ${pack.count} outreach drafts (${pack.withEmail} with email) to clipboard — ${lang.toUpperCase()}`,
      );
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Draft pack failed'));
    } finally {
      setDraftBusy(false);
    }
  }

  async function handleSendSelected() {
    if (!selectedDraft) return;
    setDraftBusy(true);
    try {
      const result = await apiClient.sendProspectOutreach(
        selectedDraft.id,
        lang,
      );
      setStatusMsg(
        result.sent
          ? `Sent to ${selectedDraft.name}`
          : `Not sent: ${result.error ?? 'unknown'}`,
      );
      if (result.sent) await load();
    } catch (err) {
      setStatusMsg(getApiErrorMessage(err, 'Send failed'));
    } finally {
      setDraftBusy(false);
    }
  }

  async function copySelectedDraft() {
    if (!selectedDraft) return;
    const text = `Subject: ${selectedDraft.draft.subject}\n\n${selectedDraft.draft.body}`;
    await navigator.clipboard.writeText(text);
    setStatusMsg(`Copied draft for ${selectedDraft.name}`);
  }

  if (!authed) {
    return <AdminAuth onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100">
      <header className="border-b border-white/10 bg-slate-950/90">
        <div className="mx-auto flex max-w-7xl flex-wrap items-center justify-between gap-4 px-6 py-5">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-cyan-300"
            >
              <ArrowLeft className="h-3 w-3" /> Control Tower
            </Link>
            <p className="mt-2 text-xs uppercase tracking-[0.28em] text-cyan-300">
              Portfolio suite manager
            </p>
            <h1 className="mt-1 text-2xl font-semibold md:text-3xl">
              All COSSEC cooperativas — reach & run
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              {summary?.mission ??
                'Bilingual ALM reporting wedge today; operating system for institutional balance-sheet intelligence across the cooperativa portfolio.'}
            </p>
          </div>
          <div className="flex flex-wrap gap-2">
            <button
              type="button"
              onClick={() => void load()}
              className="inline-flex items-center gap-2 rounded-lg border border-white/10 px-3 py-2 text-xs font-semibold text-slate-200 hover:bg-white/5"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              Refresh
            </button>
            <button
              type="button"
              onClick={() => void handleSeed()}
              disabled={seedBusy}
              className="inline-flex items-center gap-2 rounded-lg border border-amber-500/30 bg-amber-500/10 px-3 py-2 text-xs font-semibold text-amber-100 disabled:opacity-50"
            >
              <Sparkles className="h-3.5 w-3.5" />
              {seedBusy ? 'Seeding…' : 'Seed 91 registry'}
            </button>
          </div>
        </div>
      </header>

      <main className="mx-auto max-w-7xl space-y-6 px-6 py-6">
        {error && (
          <div className="rounded-lg border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        )}
        {statusMsg && (
          <div className="rounded-lg border border-cyan-500/30 bg-cyan-500/10 px-4 py-3 text-sm text-cyan-100">
            {statusMsg}
          </div>
        )}

        {summary && <MetricStrip items={metrics} />}

        <section className="rounded-xl border border-white/10 bg-slate-900/50 p-4">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <div className="flex flex-wrap items-center gap-2">
              <Target className="h-4 w-4 text-cyan-300" />
              <span className="text-xs uppercase tracking-wider text-slate-500">
                ICP filter
              </span>
              {(
                [
                  ['all', 'All'],
                  ['tier1', 'Tier 1'],
                  ['tier2', 'Tier 2'],
                  ['tier3', 'Tier 3'],
                ] as const
              ).map(([key, label]) => (
                <button
                  key={key}
                  type="button"
                  onClick={() => setIcpFilter(key)}
                  className={`rounded-full border px-3 py-1 text-xs font-semibold ${
                    icpFilter === key
                      ? 'border-cyan-400/40 bg-cyan-500/15 text-cyan-100'
                      : 'border-white/10 text-slate-400 hover:bg-white/5'
                  }`}
                >
                  {label}
                </button>
              ))}
            </div>
            <div className="flex flex-wrap items-center gap-2">
              <select
                value={outreachFilter}
                onChange={(e) =>
                  setOutreachFilter(e.target.value as OutreachFilter)
                }
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              >
                <option value="all">All outreach</option>
                <option value="not_started">Not started</option>
                <option value="sent">Sent</option>
                <option value="replied">Replied</option>
                <option value="meeting_set">Meeting set</option>
              </select>
              <select
                value={lang}
                onChange={(e) => setLang(e.target.value as 'es' | 'en')}
                className="rounded-lg border border-white/10 bg-black/40 px-2 py-1.5 text-xs"
              >
                <option value="es">Español</option>
                <option value="en">English</option>
              </select>
              <button
                type="button"
                onClick={() =>
                  apiClient.downloadPortfolioCsv({
                    icpTier: icpFilter === 'all' ? undefined : icpFilter,
                    outreachStatus:
                      outreachFilter === 'all' ? undefined : outreachFilter,
                  })
                }
                className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
              >
                <Download className="h-3.5 w-3.5" />
                Export CSV
              </button>
              <button
                type="button"
                onClick={() => void handleDraftPack()}
                disabled={draftBusy}
                className="inline-flex items-center gap-1 rounded-lg border border-emerald-500/30 bg-emerald-500/10 px-3 py-1.5 text-xs font-semibold text-emerald-100 disabled:opacity-50"
              >
                <Copy className="h-3.5 w-3.5" />
                Copy all drafts
              </button>
            </div>
          </div>
          <p className="mt-3 text-xs text-slate-500">
            Most registry rows do not yet have contact emails. Use{' '}
            <strong className="font-medium text-slate-300">Copy all drafts</strong>{' '}
            or per-row Draft → clipboard / mailto. Send only works when{' '}
            <code className="text-slate-400">contact_email</code> is set.
          </p>
        </section>

        <section>
          <div className="mb-3 flex items-center gap-2 text-sm text-slate-400">
            <Building2 className="h-4 w-4" />
            Showing {rows.length} cooperativa
            {rows.length === 1 ? '' : 's'}
            {loading ? ' · loading…' : ''}
          </div>
          <DataTable
            columns={columns}
            rows={rows}
            rowKey={(r) => r.id}
            emptyMessage="No prospects — click Seed 91 registry first."
            caption="COSSEC Anejo 9 portfolio — sorted by assets by default"
          />
        </section>

        {selectedDraft && (
          <section className="rounded-xl border border-cyan-500/20 bg-slate-900/80 p-5">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-xs uppercase tracking-wider text-cyan-300">
                  Outreach draft · {lang.toUpperCase()}
                </p>
                <h2 className="mt-1 text-lg font-semibold">
                  {selectedDraft.name}
                </h2>
                <p className="mt-1 text-sm text-slate-400">
                  {selectedDraft.draft.subject}
                </p>
              </div>
              <div className="flex flex-wrap gap-2">
                <button
                  type="button"
                  onClick={() => void copySelectedDraft()}
                  className="inline-flex items-center gap-1 rounded-lg border border-white/10 px-3 py-1.5 text-xs font-semibold hover:bg-white/5"
                >
                  <Copy className="h-3.5 w-3.5" />
                  Copy
                </button>
                <button
                  type="button"
                  onClick={() => void handleSendSelected()}
                  disabled={draftBusy}
                  className="inline-flex items-center gap-1 rounded-lg border border-cyan-500/40 bg-cyan-500/15 px-3 py-1.5 text-xs font-semibold text-cyan-100 disabled:opacity-50"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send (if email on file)
                </button>
                <button
                  type="button"
                  onClick={() => setSelectedDraft(null)}
                  className="rounded-lg border border-white/10 px-3 py-1.5 text-xs text-slate-400"
                >
                  Close
                </button>
              </div>
            </div>
            <pre className="mt-4 max-h-80 overflow-auto whitespace-pre-wrap rounded-lg border border-white/5 bg-black/40 p-4 text-xs leading-relaxed text-slate-300">
              {selectedDraft.draft.body}
            </pre>
          </section>
        )}

        <p className="pb-8 text-center text-xs text-slate-600">
          Mission: upload balance sheet → bilingual ALM report. Vision: OS for
          institutional balance-sheet intelligence across this portfolio.
        </p>
      </main>
    </div>
  );
}
