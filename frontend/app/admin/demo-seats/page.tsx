'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  ArrowLeft,
  Building2,
  CheckCircle2,
  Clock,
  Copy,
  Eye,
  EyeOff,
  ExternalLink,
  Filter,
  RefreshCw,
  Sparkles,
} from 'lucide-react';

type Filter = 'all' | 'active' | 'expired';

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

  useEffect(() => {
    load(filter);
  }, [load, filter]);

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
