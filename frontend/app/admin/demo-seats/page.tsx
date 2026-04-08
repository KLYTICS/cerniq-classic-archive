'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient, type DemoSeatAnalytics } from '@/lib/api';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  DollarSign,
  Eye,
  EyeOff,
  ExternalLink,
  Filter,
  RefreshCw,
  Sparkles,
  TrendingUp,
  Zap,
} from 'lucide-react';

type Filter = 'all' | 'active' | 'expired';

function formatUsd(value: number): string {
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(2)}M`;
  if (value >= 10_000) return `$${(value / 1000).toFixed(0)}K`;
  if (value >= 1000) return `$${(value / 1000).toFixed(1)}K`;
  return `$${value.toFixed(0)}`;
}

function formatPct(value: number): string {
  return `${value.toFixed(1)}%`;
}

interface DemoSeat {
  prospectId: string;
  institutionName: string;
  contactEmail: string | null;
  contactName: string | null;
  institutionType: string;
  location: string | null;
  publicDataSource: string | null;
  demoUserId: string | null;
  reportJobId: string | null;
  provisionedAt: string | null;
  expiresAt: string | null;
  lastViewedAt: string | null;
  magicLinkUrl: string | null;
  outreachStatus: string;
  daysRemaining: number | null;
  status: 'active' | 'expired';
  hasBeenViewed: boolean;
}

function getApiErrorMessage(error: unknown, fallback: string): string {
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

function formatDate(iso: string | null): string {
  if (!iso) return '—';
  try {
    return new Date(iso).toLocaleDateString('en-US', {
      month: 'short',
      day: 'numeric',
      year: 'numeric',
    });
  } catch {
    return iso;
  }
}

function relativeTime(iso: string | null): string {
  if (!iso) return 'never';
  const diffMs = Date.now() - new Date(iso).getTime();
  const diffMin = Math.round(diffMs / 60_000);
  if (diffMin < 1) return 'just now';
  if (diffMin < 60) return `${diffMin}m ago`;
  const diffHr = Math.round(diffMin / 60);
  if (diffHr < 24) return `${diffHr}h ago`;
  const diffDay = Math.round(diffHr / 24);
  return `${diffDay}d ago`;
}

function statusPillClasses(status: 'active' | 'expired', daysRemaining: number | null): string {
  if (status === 'expired') {
    return 'border-red-500/30 bg-red-500/10 text-red-200';
  }
  if (daysRemaining !== null && daysRemaining <= 3) {
    return 'border-amber-500/30 bg-amber-500/10 text-amber-200';
  }
  return 'border-emerald-500/30 bg-emerald-500/10 text-emerald-200';
}

export default function DemoSeatsDashboard() {
  const [seats, setSeats] = useState<DemoSeat[]>([]);
  const [analytics, setAnalytics] = useState<DemoSeatAnalytics | null>(null);
  const [analyticsError, setAnalyticsError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [filter, setFilter] = useState<Filter>('all');
  const [copiedId, setCopiedId] = useState<string | null>(null);
  const [sweeping, setSweeping] = useState(false);
  const [sweepResult, setSweepResult] = useState<string | null>(null);

  const load = useCallback(
    async (next: Filter = filter) => {
      setLoading(true);
      setError(null);
      try {
        const result = await apiClient.listDemoSeats(next);
        setSeats(Array.isArray(result) ? result : []);
      } catch (err: unknown) {
        setError(getApiErrorMessage(err, 'Failed to load demo seats'));
      } finally {
        setLoading(false);
      }
    },
    [filter],
  );

  const loadAnalytics = useCallback(async () => {
    setAnalyticsError(null);
    try {
      const result = await apiClient.getDemoSeatAnalytics();
      setAnalytics(result);
    } catch (err: unknown) {
      // Non-fatal — the page still renders without the funnel strip
      setAnalyticsError(getApiErrorMessage(err, 'Failed to load analytics'));
      setAnalytics(null);
    }
  }, []);

  useEffect(() => {
    load(filter);
  }, [load, filter]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const metrics = useMemo(() => {
    const active = seats.filter((s) => s.status === 'active').length;
    const expired = seats.filter((s) => s.status === 'expired').length;
    const viewed = seats.filter((s) => s.hasBeenViewed).length;
    const unviewed = seats.filter((s) => s.status === 'active' && !s.hasBeenViewed).length;
    return { active, expired, viewed, unviewed };
  }, [seats]);

  const copyMagicLink = useCallback(async (seat: DemoSeat) => {
    if (!seat.magicLinkUrl) return;
    try {
      await navigator.clipboard.writeText(seat.magicLinkUrl);
      setCopiedId(seat.prospectId);
      window.setTimeout(() => setCopiedId(null), 2000);
    } catch {
      // ignore
    }
  }, []);

  const [extendingId, setExtendingId] = useState<string | null>(null);
  const [extendResult, setExtendResult] = useState<string | null>(null);

  const extendDemo = useCallback(
    async (seat: DemoSeat) => {
      setExtendingId(seat.prospectId);
      setExtendResult(null);
      try {
        const result = await apiClient.provisionDemoPortal(seat.prospectId, {
          ttlDays: 14,
          sendEmail: false,
        });
        setExtendResult(
          `Extended ${seat.institutionName} by 14 days (new expiry ${new Date(result.expiresAt).toLocaleDateString('en-US', { month: 'short', day: 'numeric' })})`,
        );
        await Promise.all([load(filter), loadAnalytics()]);
      } catch (err: unknown) {
        setExtendResult(getApiErrorMessage(err, 'Extend failed'));
      } finally {
        setExtendingId(null);
      }
    },
    [filter, load, loadAnalytics],
  );

  const handleSweep = useCallback(async () => {
    setSweeping(true);
    setSweepResult(null);
    try {
      const result = await apiClient.sweepDemoSeats();
      setSweepResult(`Sweep complete: ${result.expired} seat(s) expired out of ${result.scanned} scanned.`);
      await load(filter);
    } catch (err: unknown) {
      setSweepResult(getApiErrorMessage(err, 'Sweep failed'));
    } finally {
      setSweeping(false);
    }
  }, [filter, load]);

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link
              href="/admin"
              className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white"
            >
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.26em] text-cyan-300">
              Demo seat provisioning
            </p>
            <h1 className="mt-2 text-4xl font-semibold text-white">
              Active CERNIQ portals built from public filings
            </h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              Every seat here was provisioned via the sales-tooling pipeline (<code className="rounded bg-white/5 px-1.5 py-0.5 text-[11px] text-cyan-200">pnpm demo:provision</code> or the
              Provision Portal button on the prospects page). You can copy the magic link,
              open the report as the master CEO, or run the expiry sweeper on demand.
            </p>
          </div>
          <div className="flex flex-col gap-2 sm:items-end">
            <button
              onClick={() => load(filter)}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
            >
              <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
              Refresh view
            </button>
            <button
              onClick={handleSweep}
              disabled={sweeping}
              className="inline-flex items-center gap-2 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-4 py-2 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-400/20 disabled:opacity-50"
            >
              <Clock className={`h-3.5 w-3.5 ${sweeping ? 'animate-spin' : ''}`} />
              {sweeping ? 'Sweeping…' : 'Run expiry sweep'}
            </button>
          </div>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {sweepResult ? (
          <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            {sweepResult}
          </div>
        ) : null}

        {extendResult ? (
          <div className="mb-6 rounded-2xl border border-amber-500/30 bg-amber-500/10 p-4 text-sm text-amber-100">
            {extendResult}
          </div>
        ) : null}

        {/* ─── Funnel strip — the strategic metric that matters ─── */}
        {analytics && !analyticsError ? (
          <section
            aria-labelledby="funnel-headline"
            className="mb-8 rounded-3xl border border-fuchsia-400/20 bg-gradient-to-br from-slate-950 via-slate-900 to-[#1a0e2e] p-6 shadow-[0_24px_80px_rgba(139,92,246,0.15)]"
          >
            <div className="mb-5 flex items-start justify-between gap-4">
              <div>
                <p className="text-[10px] font-semibold uppercase tracking-[0.26em] text-fuchsia-300">
                  Conversion funnel
                </p>
                <h2
                  id="funnel-headline"
                  className="mt-2 text-xl font-semibold text-white"
                >
                  Demo → Paid pipeline performance
                </h2>
              </div>
              {analytics.revenue.thisMonthUsd > 0 ? (
                <div className="rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  {formatUsd(analytics.revenue.thisMonthUsd)} MTD
                </div>
              ) : null}
            </div>

            <div className="grid gap-3 md:grid-cols-3 xl:grid-cols-6">
              <FunnelCell
                icon={Sparkles}
                color="cyan"
                label="Provisioned"
                value={analytics.totals.provisioned}
                footnote={`+${analytics.velocity.provisionedLast7Days} in 7d`}
              />
              <FunnelCell
                icon={Eye}
                color="emerald"
                label="Viewed"
                value={analytics.totals.viewedAtLeastOnce}
                footnote={`${formatPct(analytics.rates.viewRatePct)} view rate`}
              />
              <FunnelCell
                icon={CheckCircle2}
                color="fuchsia"
                label="Converted"
                value={analytics.totals.converted}
                footnote={`+${analytics.velocity.convertedLast7Days} in 7d`}
              />
              <FunnelCell
                icon={TrendingUp}
                color="amber"
                label="Conversion rate"
                value={formatPct(analytics.rates.conversionRatePct)}
                footnote={
                  analytics.rates.conversionRatePct > 15
                    ? 'Above benchmark'
                    : 'Below benchmark'
                }
              />
              <FunnelCell
                icon={DollarSign}
                color="emerald"
                label="Revenue attributed"
                value={formatUsd(analytics.revenue.allTimeUsd)}
                footnote="All-time"
              />
              <FunnelCell
                icon={Zap}
                color="cyan"
                label="Avg days to convert"
                value={
                  analytics.velocity.avgDaysToConvert !== null
                    ? `${analytics.velocity.avgDaysToConvert}d`
                    : '—'
                }
                footnote="Provision → paid"
              />
            </div>

            {analytics.topConvertingSnapshots.length > 0 ? (
              <div className="mt-6 border-t border-white/5 pt-5">
                <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.22em] text-slate-500">
                  Top converting snapshots
                </p>
                <div className="flex flex-wrap gap-2">
                  {analytics.topConvertingSnapshots.map((snap) => (
                    <div
                      key={`${snap.source}-${snap.identifier}`}
                      className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-3 py-1.5 text-xs"
                    >
                      <span className="text-fuchsia-200">{snap.identifier}</span>
                      <span className="text-slate-500">·</span>
                      <span className="text-slate-400">
                        {snap.converted} deal{snap.converted === 1 ? '' : 's'}
                      </span>
                      <span className="text-slate-500">·</span>
                      <span className="text-emerald-300">
                        {formatUsd(snap.revenueUsd)}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            ) : null}
          </section>
        ) : null}

        {analyticsError ? (
          <div className="mb-6 rounded-2xl border border-amber-500/20 bg-amber-500/5 p-3 text-xs text-amber-200">
            Analytics unavailable: {analyticsError}. Metrics below still reflect
            the current page view.
          </div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Sparkles className="h-5 w-5 text-cyan-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Active demo seats</p>
            <p className="mt-3 text-3xl font-semibold text-white">{metrics.active}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Clock className="h-5 w-5 text-amber-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Expired</p>
            <p className="mt-3 text-3xl font-semibold text-amber-200">{metrics.expired}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Eye className="h-5 w-5 text-emerald-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Viewed by prospect</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-200">{metrics.viewed}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <EyeOff className="h-5 w-5 text-red-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Not yet opened</p>
            <p className="mt-3 text-3xl font-semibold text-red-200">{metrics.unviewed}</p>
          </div>
        </div>

        {/* Filter tabs */}
        <div className="mt-8 flex items-center gap-2">
          <Filter className="h-4 w-4 text-slate-500" />
          {(['all', 'active', 'expired'] as const).map((value) => (
            <button
              key={value}
              onClick={() => setFilter(value)}
              className={`rounded-full border px-4 py-1.5 text-xs font-semibold capitalize transition ${
                filter === value
                  ? 'border-cyan-400/40 bg-cyan-400/10 text-cyan-100'
                  : 'border-white/10 bg-transparent text-slate-400 hover:bg-white/5'
              }`}
            >
              {value}
            </button>
          ))}
        </div>

        {/* Seats table */}
        <div className="mt-5 overflow-hidden rounded-3xl border border-white/10 bg-slate-900/70">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">Contact</th>
                  <th className="px-4 py-3">Status</th>
                  <th className="px-4 py-3">Provisioned</th>
                  <th className="px-4 py-3">Expires</th>
                  <th className="px-4 py-3">Last viewed</th>
                  <th className="px-4 py-3 text-right">Actions</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 4 }).map((_, index) => (
                      <tr key={`skeleton-${index}`} className="border-b border-white/5">
                        <td colSpan={7} className="px-4 py-6">
                          <div className="h-6 animate-pulse rounded bg-white/5" />
                        </td>
                      </tr>
                    ))
                  : seats.length === 0
                    ? (
                      <tr>
                        <td colSpan={7} className="px-4 py-12 text-center text-sm text-slate-500">
                          No {filter === 'all' ? '' : filter} demo seats yet. Provision one from the{' '}
                          <Link href="/admin/prospects" className="text-cyan-300 hover:underline">
                            prospects page
                          </Link>
                          {' '}or the CLI.
                        </td>
                      </tr>
                    )
                    : seats.map((seat) => (
                      <tr key={seat.prospectId} className="border-b border-white/5 align-top">
                        <td className="px-4 py-4">
                          <div className="flex items-start gap-3">
                            <div className="rounded-xl bg-cyan-500/10 p-2">
                              <Building2 className="h-4 w-4 text-cyan-300" />
                            </div>
                            <div>
                              <p className="font-semibold text-white">{seat.institutionName}</p>
                              <p className="mt-1 text-xs text-slate-500">
                                {seat.location || '—'} · {seat.publicDataSource || 'unknown source'}
                              </p>
                            </div>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <p className="text-sm text-white">{seat.contactName || '—'}</p>
                          <p className="mt-1 text-xs text-slate-500">
                            {seat.contactEmail || 'no email'}
                          </p>
                        </td>
                        <td className="px-4 py-4">
                          <span
                            className={`inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-[11px] font-semibold ${statusPillClasses(seat.status, seat.daysRemaining)}`}
                          >
                            {seat.status === 'active' ? (
                              <>
                                <CheckCircle2 className="h-3 w-3" />
                                {seat.daysRemaining !== null && seat.daysRemaining <= 1
                                  ? 'Less than 1d left'
                                  : `${seat.daysRemaining ?? '—'}d left`}
                              </>
                            ) : (
                              <>
                                <Clock className="h-3 w-3" />
                                expired
                              </>
                            )}
                          </span>
                        </td>
                        <td className="px-4 py-4 text-xs text-slate-400">{formatDate(seat.provisionedAt)}</td>
                        <td className="px-4 py-4 text-xs text-slate-400">{formatDate(seat.expiresAt)}</td>
                        <td className="px-4 py-4">
                          <div className="flex items-center gap-2 text-xs">
                            {seat.hasBeenViewed ? (
                              <Eye className="h-3.5 w-3.5 text-emerald-300" />
                            ) : (
                              <EyeOff className="h-3.5 w-3.5 text-slate-500" />
                            )}
                            <span className={seat.hasBeenViewed ? 'text-emerald-200' : 'text-slate-500'}>
                              {relativeTime(seat.lastViewedAt)}
                            </span>
                          </div>
                        </td>
                        <td className="px-4 py-4">
                          <div className="flex flex-col items-end gap-2">
                            {seat.magicLinkUrl ? (
                              <button
                                onClick={() => copyMagicLink(seat)}
                                className="inline-flex items-center gap-1.5 rounded-full border border-cyan-400/40 bg-cyan-400/10 px-3 py-1.5 text-[11px] font-semibold text-cyan-200 transition hover:bg-cyan-400/20"
                              >
                                {copiedId === seat.prospectId ? (
                                  <>
                                    <CheckCircle2 className="h-3 w-3" />
                                    Copied
                                  </>
                                ) : (
                                  <>
                                    <Copy className="h-3 w-3" />
                                    Copy magic link
                                  </>
                                )}
                              </button>
                            ) : null}
                            {/* Extend +14d — calls the same idempotent
                                provisioner as the prospects page. Safe for
                                both active (days_remaining extended) and
                                expired (re-activated) seats. */}
                            <button
                              onClick={() => extendDemo(seat)}
                              disabled={extendingId === seat.prospectId}
                              className="inline-flex items-center gap-1.5 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                            >
                              {extendingId === seat.prospectId ? (
                                <>
                                  <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200/40 border-t-amber-200" />
                                  Extending…
                                </>
                              ) : (
                                <>
                                  <Clock className="h-3 w-3" />
                                  Extend +14d
                                </>
                              )}
                            </button>
                            {seat.reportJobId ? (
                              <a
                                href={`/portal/reports/${seat.reportJobId}`}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="inline-flex items-center gap-1.5 text-[11px] font-semibold text-slate-300 transition hover:text-white"
                              >
                                Open as master CEO
                                <ExternalLink className="h-3 w-3" />
                              </a>
                            ) : null}
                          </div>
                        </td>
                      </tr>
                    ))}
              </tbody>
            </table>
          </div>
        </div>

        <p className="mt-6 text-[11px] leading-5 text-slate-500">
          &quot;Open as master CEO&quot; routes the report view through the master bypass in{' '}
          <code className="rounded bg-white/5 px-1 py-0.5 text-cyan-200">portal.controller.ts</code>.
          You&apos;ll see the prospect&apos;s ALM report without leaving your own session. Every
          bypass is audit-logged with <code className="rounded bg-white/5 px-1 py-0.5 text-cyan-200">masterCeoBypass: true</code>.
        </p>
      </div>
    </div>
  );
}

// ─── Funnel cell ──────────────────────────────────────
//
// A tight metric cell used only inside the "Conversion funnel" strip.
// Dark glassmorphism card with an icon in the accent color and a
// footnote that gives context (7-day delta, view rate, benchmark, etc.)
// without needing a second row of cells.

type FunnelCellColor = 'cyan' | 'emerald' | 'fuchsia' | 'amber' | 'red';

interface FunnelCellProps {
  readonly icon: React.ComponentType<{ className?: string }>;
  readonly color: FunnelCellColor;
  readonly label: string;
  readonly value: string | number;
  readonly footnote?: string;
}

function FunnelCell({ icon: Icon, color, label, value, footnote }: FunnelCellProps) {
  const toneByColor: Record<FunnelCellColor, { icon: string; value: string }> = {
    cyan: { icon: 'text-cyan-300', value: 'text-white' },
    emerald: { icon: 'text-emerald-300', value: 'text-emerald-100' },
    fuchsia: { icon: 'text-fuchsia-300', value: 'text-fuchsia-100' },
    amber: { icon: 'text-amber-300', value: 'text-amber-100' },
    red: { icon: 'text-red-300', value: 'text-red-100' },
  };
  const tone = toneByColor[color];
  return (
    <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
      <Icon className={`h-4 w-4 ${tone.icon}`} />
      <p className="mt-3 text-[10px] font-semibold uppercase tracking-[0.2em] text-slate-500">
        {label}
      </p>
      <p className={`mt-2 text-2xl font-semibold ${tone.value}`}>{value}</p>
      {footnote ? (
        <p className="mt-1 text-[10px] text-slate-500">{footnote}</p>
      ) : null}
    </div>
  );
}
