'use client';

import { useCallback, useEffect, useMemo, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  ArrowLeft,
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Copy,
  ExternalLink,
  Flame,
  RefreshCw,
  Send,
  ShieldAlert,
  Sparkles,
  Target,
  Users,
  X,
} from 'lucide-react';

interface BuyerAccount {
  id: string;
  name: string;
  domain?: string | null;
  currentSummary?: string | null;
  freshnessScore: number;
  opportunityScore: number;
  actionScore: number;
  linkedLeadId?: string | null;
  linkedProspectId?: string | null;
  lastRefreshedAt?: string | null;
}

interface ProvisionResult {
  prospectId: string;
  institutionName: string;
  contactEmail: string;
  magicLinkUrl: string;
  expiresAt: string;
  reportPortalUrl: string;
  asOfQuarter: string | null;
  disclosure: string;
  reused: boolean;
  source: string;
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

function deriveStage(score: number): string {
  if (score >= 80) return 'DEMO_SCHEDULED';
  if (score >= 60) return 'ENGAGED';
  if (score >= 40) return 'PROPOSAL';
  if (score >= 20) return 'OUTBOUND';
  return 'CHURNED';
}

function tone(score: number) {
  if (score >= 75) return 'text-emerald-300 bg-emerald-500/15 border-emerald-500/20';
  if (score >= 45) return 'text-amber-200 bg-amber-500/15 border-amber-500/20';
  return 'text-red-200 bg-red-500/15 border-red-500/20';
}

export default function ProspectsDashboard() {
  const [accounts, setAccounts] = useState<BuyerAccount[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [provisioning, setProvisioning] = useState<string | null>(null);
  const [provisionResult, setProvisionResult] = useState<ProvisionResult | null>(null);
  const [provisionError, setProvisionError] = useState<string | null>(null);
  const [copyState, setCopyState] = useState<'idle' | 'copied'>('idle');

  const load = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const result = await apiClient.getIntelligenceAccounts({ kind: 'BUYER' });
      setAccounts(Array.isArray(result) ? result : []);
    } catch (err: unknown) {
      setError(getApiErrorMessage(err, 'Failed to load buyer intelligence'));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    load();
  }, [load]);

  const handleProvision = useCallback(
    async (prospectId: string, accountName: string) => {
      setProvisionError(null);
      setProvisionResult(null);
      setProvisioning(prospectId);
      try {
        const result = await apiClient.provisionDemoPortal(prospectId, {
          ttlDays: 14,
          sendEmail: false,
        });
        setProvisionResult({
          prospectId: result.prospectId,
          institutionName: accountName,
          contactEmail: result.contactEmail,
          magicLinkUrl: result.magicLinkUrl,
          expiresAt: result.expiresAt,
          reportPortalUrl: result.reportPortalUrl,
          asOfQuarter: result.asOfQuarter,
          disclosure: result.disclosure,
          reused: result.reused,
          source: result.source,
        });
      } catch (err: unknown) {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data?.message ||
          getApiErrorMessage(err, 'Failed to provision portal');
        setProvisionError(message);
      } finally {
        setProvisioning(null);
      }
    },
    [],
  );

  const closeModal = useCallback(() => {
    setProvisionResult(null);
    setProvisionError(null);
    setCopyState('idle');
  }, []);

  const copyMagicLink = useCallback(async (link: string) => {
    try {
      await navigator.clipboard.writeText(link);
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2000);
    } catch {
      // Fallback: select the text input
      const input = document.getElementById('magic-link-input') as HTMLInputElement | null;
      input?.select();
    }
  }, []);

  const handleSendEmail = useCallback(async () => {
    if (!provisionResult) return;
    setProvisionError(null);
    try {
      await apiClient.provisionDemoPortal(provisionResult.prospectId, {
        ttlDays: 14,
        sendEmail: true,
      });
      setCopyState('copied');
      window.setTimeout(() => setCopyState('idle'), 2500);
    } catch (err: unknown) {
      setProvisionError(
        getApiErrorMessage(err, 'Failed to send portal-ready email'),
      );
    }
  }, [provisionResult]);

  const staleCount = useMemo(
    () => accounts.filter((account) => account.freshnessScore < 40).length,
    [accounts],
  );
  const avgOpportunity = useMemo(
    () =>
      accounts.length
        ? Math.round(
            accounts.reduce((sum, account) => sum + account.opportunityScore, 0) /
              accounts.length,
          )
        : 0,
    [accounts],
  );

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-6 py-8">
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div>
            <Link href="/admin" className="inline-flex items-center gap-2 text-sm text-slate-400 transition hover:text-white">
              <ArrowLeft className="h-4 w-4" />
              Back to admin
            </Link>
            <p className="mt-4 text-xs uppercase tracking-[0.26em] text-cyan-300">Buyer intelligence</p>
            <h1 className="mt-2 text-4xl font-semibold text-white">Target institutions ranked by live opportunity and actionability.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-7 text-slate-400">
              This page is now sourced from the canonical Intelligence OS. Every buyer account here is synced with the shared market graph, refresh history, and CRM links between sessions.
            </p>
          </div>
          <button
            onClick={load}
            className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            Refresh view
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">{error}</div>
        ) : null}

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Users className="h-5 w-5 text-cyan-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Tracked buyers</p>
            <p className="mt-3 text-3xl font-semibold text-white">{accounts.length}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Flame className="h-5 w-5 text-amber-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Average opportunity</p>
            <p className="mt-3 text-3xl font-semibold text-amber-200">{avgOpportunity}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Clock3 className="h-5 w-5 text-red-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">Stale buyers</p>
            <p className="mt-3 text-3xl font-semibold text-red-200">{staleCount}</p>
          </div>
          <div className="rounded-2xl border border-white/10 bg-slate-900/70 p-5">
            <Target className="h-5 w-5 text-emerald-300" />
            <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">CRM-linked</p>
            <p className="mt-3 text-3xl font-semibold text-emerald-200">
              {accounts.filter((account) => account.linkedLeadId || account.linkedProspectId).length}
            </p>
          </div>
        </div>

        <div className="mt-8 rounded-3xl border border-white/10 bg-slate-900/70 p-6">
          <div className="flex items-center justify-between gap-3">
            <div>
              <p className="text-xs uppercase tracking-[0.24em] text-slate-500">Buyer accounts</p>
              <h2 className="mt-2 text-2xl font-semibold text-white">Action-ready targets</h2>
            </div>
            <Link href="/admin/intelligence" className="inline-flex items-center gap-2 text-sm font-medium text-cyan-300 transition hover:text-cyan-200">
              Open Intelligence OS
              <ArrowRight className="h-4 w-4" />
            </Link>
          </div>

          <div className="mt-5 overflow-x-auto">
            <table className="w-full min-w-[900px] text-sm">
              <thead>
                <tr className="border-b border-white/10 text-left text-xs uppercase tracking-[0.18em] text-slate-500">
                  <th className="px-4 py-3">Institution</th>
                  <th className="px-4 py-3">Stage</th>
                  <th className="px-4 py-3">Opportunity</th>
                  <th className="px-4 py-3">Action</th>
                  <th className="px-4 py-3">Freshness</th>
                  <th className="px-4 py-3">Summary</th>
                  <th className="px-4 py-3">Demo portal</th>
                  <th className="px-4 py-3">Links</th>
                </tr>
              </thead>
              <tbody>
                {loading
                  ? Array.from({ length: 5 }).map((_, index) => (
                      <tr key={index} className="border-b border-white/5">
                        <td colSpan={8} className="px-4 py-6">
                          <div className="h-6 animate-pulse rounded bg-white/5" />
                        </td>
                      </tr>
                    ))
                  : null}
                {!loading && accounts.map((account) => (
                  <tr key={account.id} className="border-b border-white/5 align-top">
                    <td className="px-4 py-4">
                      <div className="flex items-start gap-3">
                        <div className="rounded-xl bg-cyan-500/10 p-2">
                          <Building2 className="h-4 w-4 text-cyan-300" />
                        </div>
                        <div>
                          <p className="font-semibold text-white">{account.name}</p>
                          <p className="mt-1 text-xs text-slate-500">{account.domain || 'No domain captured'}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-4 py-4">
                      <span className="rounded-full border border-white/10 px-3 py-1 text-xs text-slate-300">
                        {deriveStage(account.opportunityScore).replace(/_/g, ' ')}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone(account.opportunityScore)}`}>
                        {account.opportunityScore}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <span className={`rounded-full border px-3 py-1 text-xs font-semibold ${tone(account.actionScore)}`}>
                        {account.actionScore}
                      </span>
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex items-center gap-2">
                        <div className="h-2 w-24 overflow-hidden rounded-full bg-white/8">
                          <div
                            className={`h-full rounded-full ${
                              account.freshnessScore >= 70
                                ? 'bg-emerald-400'
                                : account.freshnessScore >= 40
                                  ? 'bg-amber-400'
                                  : 'bg-red-400'
                            }`}
                            style={{ width: `${account.freshnessScore}%` }}
                          />
                        </div>
                        <span className="text-xs text-slate-300">{account.freshnessScore}</span>
                      </div>
                    </td>
                    <td className="px-4 py-4 text-sm leading-6 text-slate-400">
                      {account.currentSummary || 'No summary yet.'}
                    </td>
                    <td className="px-4 py-4">
                      {account.linkedProspectId ? (
                        <button
                          type="button"
                          onClick={() => handleProvision(account.linkedProspectId!, account.name)}
                          disabled={provisioning === account.linkedProspectId}
                          className="inline-flex items-center gap-2 rounded-full border border-amber-400/40 bg-amber-400/10 px-3 py-1.5 text-[11px] font-semibold text-amber-200 transition hover:bg-amber-400/20 disabled:cursor-not-allowed disabled:opacity-50"
                        >
                          {provisioning === account.linkedProspectId ? (
                            <>
                              <div className="h-3 w-3 animate-spin rounded-full border-2 border-amber-200/40 border-t-amber-200" />
                              Provisioning…
                            </>
                          ) : (
                            <>
                              <Sparkles className="h-3.5 w-3.5" />
                              Provision portal
                            </>
                          )}
                        </button>
                      ) : (
                        <span className="text-[11px] text-slate-500">Link a prospect first</span>
                      )}
                    </td>
                    <td className="px-4 py-4">
                      <div className="flex flex-col items-start gap-2">
                        <Link href={`/admin/intelligence/${account.id}`} className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200">
                          View account
                          <ArrowRight className="h-3.5 w-3.5" />
                        </Link>
                        {account.linkedLeadId || account.linkedProspectId ? (
                          <span className="inline-flex items-center gap-2 rounded-full border border-emerald-500/20 bg-emerald-500/10 px-3 py-1 text-[11px] font-semibold text-emerald-200">
                            <ShieldAlert className="h-3.5 w-3.5" />
                            CRM linked
                          </span>
                        ) : (
                          <span className="text-[11px] text-slate-500">No CRM sync yet</span>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          {provisionError && !provisionResult && (
            <div className="mt-4 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
              {provisionError}
            </div>
          )}
        </div>
      </div>

      {/* Provision result modal */}
      {provisionResult && (
        <div
          className="fixed inset-0 z-50 flex items-center justify-center bg-slate-950/80 px-4 py-6 backdrop-blur-sm"
          role="dialog"
          aria-modal="true"
          aria-labelledby="provision-modal-title"
        >
          <div className="w-full max-w-2xl overflow-hidden rounded-3xl border border-cyan-300/20 bg-gradient-to-br from-slate-950 via-slate-900 to-slate-950 shadow-[0_30px_120px_rgba(8,47,95,0.5)]">
            <div className="flex items-start justify-between gap-4 border-b border-white/10 p-6">
              <div>
                <div className="inline-flex items-center gap-2 rounded-full border border-emerald-400/30 bg-emerald-400/10 px-3 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-emerald-200">
                  <CheckCircle2 className="h-3 w-3" />
                  {provisionResult.reused ? 'Refreshed' : 'Provisioned'}
                </div>
                <h3 id="provision-modal-title" className="mt-3 text-2xl font-semibold text-white">
                  {provisionResult.institutionName}
                </h3>
                <p className="mt-1 text-xs text-slate-400">
                  Source: {provisionResult.source.replace(/_/g, ' ')} ·{' '}
                  {provisionResult.asOfQuarter || 'latest available'}
                </p>
              </div>
              <button
                type="button"
                onClick={closeModal}
                className="rounded-full border border-white/10 p-1.5 text-slate-400 transition hover:bg-white/5 hover:text-white"
                aria-label="Close"
              >
                <X className="h-4 w-4" />
              </button>
            </div>

            <div className="space-y-5 p-6">
              <div>
                <label
                  htmlFor="magic-link-input"
                  className="text-[10px] font-semibold uppercase tracking-[0.22em] text-cyan-300/80"
                >
                  Magic link
                </label>
                <div className="mt-2 flex items-stretch gap-2">
                  <input
                    id="magic-link-input"
                    readOnly
                    value={provisionResult.magicLinkUrl}
                    className="flex-1 rounded-xl border border-white/10 bg-white/5 px-3 py-2.5 text-xs text-slate-200 focus:border-cyan-300/40 focus:outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => copyMagicLink(provisionResult.magicLinkUrl)}
                    className="inline-flex items-center gap-2 rounded-xl bg-cyan-400 px-4 py-2 text-xs font-semibold text-slate-950 transition hover:bg-cyan-300"
                  >
                    {copyState === 'copied' ? (
                      <>
                        <CheckCircle2 className="h-3.5 w-3.5" />
                        Copied
                      </>
                    ) : (
                      <>
                        <Copy className="h-3.5 w-3.5" />
                        Copy
                      </>
                    )}
                  </button>
                </div>
              </div>

              <div className="grid gap-3 text-xs sm:grid-cols-2">
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Contact email
                  </p>
                  <p className="mt-1 text-sm text-white">{provisionResult.contactEmail}</p>
                </div>
                <div className="rounded-xl border border-white/10 bg-white/5 px-4 py-3">
                  <p className="text-[10px] uppercase tracking-[0.18em] text-slate-500">
                    Expires
                  </p>
                  <p className="mt-1 text-sm text-white">
                    {new Date(provisionResult.expiresAt).toLocaleDateString('en-US', {
                      year: 'numeric',
                      month: 'short',
                      day: 'numeric',
                    })}
                  </p>
                </div>
              </div>

              <p className="rounded-xl border border-amber-400/20 bg-amber-400/5 p-3 text-[11px] leading-5 text-amber-100/80">
                {provisionResult.disclosure}
              </p>

              {provisionError && (
                <div className="rounded-xl border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-200">
                  {provisionError}
                </div>
              )}

              <div className="flex flex-wrap items-center justify-between gap-3 pt-2">
                <a
                  href={provisionResult.reportPortalUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-2 text-xs font-semibold text-cyan-300 hover:text-cyan-200"
                >
                  Open report in portal
                  <ExternalLink className="h-3.5 w-3.5" />
                </a>
                <button
                  type="button"
                  onClick={handleSendEmail}
                  className="inline-flex items-center gap-2 rounded-xl border border-amber-400/40 bg-amber-400/10 px-4 py-2 text-xs font-semibold text-amber-200 transition hover:bg-amber-400/20"
                >
                  <Send className="h-3.5 w-3.5" />
                  Send portal-ready email
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
