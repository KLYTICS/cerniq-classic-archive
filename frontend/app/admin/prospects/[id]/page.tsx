'use client';

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { useParams } from 'next/navigation';
import { apiClient, type ProspectDossierDetail } from '@/lib/api';
import {
  ArrowLeft,
  CalendarClock,
  CheckCircle2,
  Download,
  ExternalLink,
  FileSpreadsheet,
  RefreshCw,
  ShieldAlert,
  Sparkles,
  Target,
} from 'lucide-react';
import { ErrorBanner } from '@/components/ui/cerniq';

function prettyDate(value?: string | null) {
  if (!value) return '—';
  return new Date(value).toLocaleString();
}

function severityTone(value?: string | null) {
  if (value === 'HIGH') return 'bg-red-500/15 text-red-300 border-red-500/30';
  if (value === 'MEDIUM') return 'bg-amber-500/15 text-amber-300 border-amber-500/30';
  return 'bg-emerald-500/15 text-emerald-300 border-emerald-500/30';
}

export default function ProspectDossierPage() {
  const params = useParams<{ id: string }>();
  const dossierId = params?.id;
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [dossier, setDossier] = useState<ProspectDossierDetail | null>(null);

  const load = useCallback(async () => {
    if (!dossierId) return;
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getProspectDossier(dossierId);
      setDossier(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load dossier');
    } finally {
      setLoading(false);
    }
  }, [dossierId]);

  useEffect(() => {
    void load();
  }, [load]);

  const refresh = async () => {
    if (!dossierId) return;
    setRefreshing(true);
    setError(null);
    try {
      const data = await apiClient.refreshProspectDossier(dossierId);
      setDossier(data);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to refresh dossier');
    } finally {
      setRefreshing(false);
    }
  };

  const exportCsv = async () => {
    if (!dossierId) return;
    try {
      await apiClient.downloadProspectDossierCsv(dossierId);
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to export dossier CSV');
    }
  };

  const generateSample = async () => {
    if (!dossierId) return;
    try {
      await apiClient.downloadProspectSampleReport(dossierId, 'es');
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to generate sample report');
    }
  };

  const completeAction = async (actionId: string) => {
    try {
      await apiClient.completeIntelligenceAction(actionId);
      await load();
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to complete action');
    }
  };

  const latestFacts =
    (dossier?.latestSnapshot?.factsJson as Record<string, unknown> | undefined) || {};
  const prospectRecord = dossier?.prospect as Record<string, unknown> | null;
  const qualification = latestFacts.qualification as Record<string, unknown> | undefined;
  const leadScore = latestFacts.leadScore as Record<string, unknown> | undefined;
  const outreach = latestFacts.outreach as Record<string, unknown> | undefined;

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="mx-auto max-w-7xl px-4 py-8 sm:px-6">
        <div className="mb-8 flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
          <div className="flex items-start gap-3">
            <Link href="/admin/prospects" className="mt-1 text-slate-500 transition hover:text-white">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <div className="flex items-center gap-2 text-[11px] font-semibold uppercase tracking-[0.24em] text-cyan-300/70">
                <Sparkles className="h-4 w-4" />
                Prospect Dossier
              </div>
              <h1 className="mt-2 text-2xl font-semibold text-white">
                {dossier?.account.name || 'Loading dossier...'}
              </h1>
              <p className="mt-2 max-w-3xl text-sm leading-7 text-slate-400">
                Persistent institutional intelligence, scored findings, action queue,
                source history, and exported artifacts for one target institution.
              </p>
            </div>
          </div>

          <div className="flex flex-wrap gap-2">
            <button
              onClick={refresh}
              disabled={refreshing}
              className="inline-flex items-center gap-2 rounded-xl bg-amber-500 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-400 disabled:opacity-60"
            >
              <RefreshCw className={`h-4 w-4 ${refreshing ? 'animate-spin' : ''}`} />
              {refreshing ? 'Refreshing...' : 'Refresh'}
            </button>
            <button
              onClick={exportCsv}
              className="inline-flex items-center gap-2 rounded-xl border border-white/10 px-4 py-2 text-sm text-slate-200 transition hover:bg-white/[0.05]"
            >
              <Download className="h-4 w-4" />
              Export CSV
            </button>
            <button
              onClick={generateSample}
              className="inline-flex items-center gap-2 rounded-xl border border-cyan-400/30 bg-cyan-500/10 px-4 py-2 text-sm text-cyan-200 transition hover:bg-cyan-500/20"
            >
              <FileSpreadsheet className="h-4 w-4" />
              Sample Report
            </button>
          </div>
        </div>

        {error && (
          <div className="mb-6">
            <ErrorBanner
              titleEs="Failed to load dossier"
              error={error}
              onRetry={load}
              onDismiss={() => setError(null)}
            />
          </div>
        )}

        {loading || !dossier ? (
          <div className="grid gap-4 lg:grid-cols-3">
            {Array.from({ length: 6 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-2xl border border-white/10 bg-white/5"
              />
            ))}
          </div>
        ) : (
          <div className="space-y-6">
            <div className="grid gap-4 lg:grid-cols-4">
              <MetricTile
                label="Opportunity"
                value={String(dossier.account.opportunityScore)}
                hint="Composite buyer fit + urgency"
                icon={<Target className="h-4 w-4 text-emerald-300" />}
              />
              <MetricTile
                label="Action Score"
                value={String(dossier.account.actionScore)}
                hint="How actionable the dossier is right now"
                icon={<ShieldAlert className="h-4 w-4 text-amber-300" />}
              />
              <MetricTile
                label="Threat Score"
                value={String(dossier.account.threatScore)}
                hint="Risk / urgency signal intensity"
                icon={<Sparkles className="h-4 w-4 text-rose-300" />}
              />
              <MetricTile
                label="Freshness"
                value={String(dossier.account.freshnessScore)}
                hint={`Next refresh ${prettyDate(dossier.account.nextRefreshAt)}`}
                icon={<CalendarClock className="h-4 w-4 text-cyan-300" />}
              />
            </div>

            <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
              <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Overview
                </p>
                <h2 className="mt-3 text-xl font-semibold text-white">
                  Institutional summary
                </h2>
                <p className="mt-3 text-sm leading-7 text-slate-300">
                  {dossier.account.currentSummary || 'No summary generated yet.'}
                </p>

                <div className="mt-5 grid gap-3 sm:grid-cols-2">
                  <KeyValue label="Institution Type" value={dossier.account.institutionalType || '—'} />
                  <KeyValue label="Source of Truth" value={dossier.account.sourceOfTruth || '—'} />
                  <KeyValue label="Location" value={String(prospectRecord?.location || latestFacts.location || '—')} />
                  <KeyValue label="Estimated Assets" value={String((latestFacts.estimatedAssets as number | null) || prospectRecord?.estimatedAssets || '—')} />
                  <KeyValue label="Qualification Grade" value={String(qualification?.grade || '—')} />
                  <KeyValue label="Lead Tier" value={String(leadScore?.tier || '—')} />
                  <KeyValue label="Outreach Status" value={String(prospectRecord?.outreachStatus || outreach?.status || '—')} />
                  <KeyValue label="Last Refreshed" value={prettyDate(dossier.account.lastRefreshedAt)} />
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Linked Records
                </p>
                <div className="mt-4 space-y-4 text-sm text-slate-300">
                  <div>
                    <div className="font-medium text-white">Prospect</div>
                    <div className="mt-1 text-slate-400">
                      {String(prospectRecord?.name || '—')}
                    </div>
                  </div>
                  <div>
                    <div className="font-medium text-white">Lead Records</div>
                    <div className="mt-2 space-y-2">
                      {dossier.linkedLeads.length === 0 ? (
                        <div className="text-slate-500">No linked leads yet.</div>
                      ) : (
                        dossier.linkedLeads.map((lead: Record<string, unknown>) => (
                          <div
                            key={String(lead.id)}
                            className="rounded-xl border border-white/10 bg-white/[0.03] px-3 py-2"
                          >
                            <div className="font-medium text-white">{String(lead.name || '—')}</div>
                            <div className="text-xs text-slate-400">
                              {String(lead.email || '—')} • {String(lead.status || '—')}
                            </div>
                          </div>
                        ))
                      )}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-6 lg:grid-cols-3">
              <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Findings
                </p>
                <div className="mt-4 space-y-3">
                  {dossier.insights.length === 0 ? (
                    <div className="text-sm text-slate-500">No findings captured yet.</div>
                  ) : (
                    dossier.insights.map((insight: Record<string, unknown>) => (
                      <div
                        key={String(insight.id)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <span
                          className={`inline-flex rounded-full border px-2 py-1 text-[11px] font-medium ${severityTone(
                            String(insight.severity || 'LOW'),
                          )}`}
                        >
                          {String(insight.severity || 'LOW')}
                        </span>
                        <div className="mt-2 font-medium text-white">{String(insight.title || 'Untitled')}</div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">
                          {String(insight.description || '—')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Action Queue
                </p>
                <div className="mt-4 space-y-3">
                  {dossier.actions.length === 0 ? (
                    <div className="text-sm text-slate-500">No actions queued.</div>
                  ) : (
                    dossier.actions.map((action: Record<string, unknown>) => (
                      <div
                        key={String(action.id)}
                        className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="font-medium text-white">{String(action.title || 'Untitled action')}</div>
                            <div className="mt-1 text-xs text-slate-500">
                              {String(action.type || 'ACTION')} • score {String(action.actionScore || '0')}
                            </div>
                          </div>
                          <button
                            onClick={() => void completeAction(String(action.id))}
                            disabled={String(action.status) === 'DONE'}
                            className="inline-flex items-center gap-1 rounded-lg border border-emerald-400/20 bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-200 transition hover:bg-emerald-500/20 disabled:opacity-60"
                          >
                            <CheckCircle2 className="h-3.5 w-3.5" />
                            Done
                          </button>
                        </div>
                        <div className="mt-2 text-sm leading-6 text-slate-400">
                          {String(action.description || '—')}
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-2xl border border-white/10 bg-slate-900/50 p-6">
                <p className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
                  Sources & Artifacts
                </p>
                <div className="mt-4 space-y-3">
                  {dossier.sources.map((source: Record<string, unknown>) => (
                    <div
                      key={String(source.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="font-medium text-white">{String(source.label || source.sourceType || 'Source')}</div>
                      <a
                        href={String(source.url || '#')}
                        target="_blank"
                        rel="noreferrer"
                        className="mt-2 inline-flex items-center gap-1 text-xs text-cyan-300 transition hover:text-cyan-200"
                      >
                        Open source
                        <ExternalLink className="h-3.5 w-3.5" />
                      </a>
                    </div>
                  ))}
                  {dossier.artifacts.map((artifact: Record<string, unknown>) => (
                    <div
                      key={String(artifact.id)}
                      className="rounded-xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="font-medium text-white">{String(artifact.title || 'Artifact')}</div>
                      <div className="mt-1 text-sm text-slate-400">{String(artifact.summary || 'Generated artifact')}</div>
                    </div>
                  ))}
                </div>
              </section>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function MetricTile({
  label,
  value,
  hint,
  icon,
}: {
  label: string;
  value: string;
  hint: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-2xl border border-white/10 bg-slate-900/50 p-5">
      <div className="flex items-center gap-2 text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {icon}
        {label}
      </div>
      <div className="mt-3 text-3xl font-semibold text-white">{value}</div>
      <div className="mt-1 text-xs text-slate-500">{hint}</div>
    </div>
  );
}

function KeyValue({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-xl border border-white/10 bg-white/[0.03] px-4 py-3">
      <div className="text-[11px] uppercase tracking-[0.22em] text-slate-500">
        {label}
      </div>
      <div className="mt-2 text-sm text-slate-200">{value}</div>
    </div>
  );
}
