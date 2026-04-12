"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Link from "next/link";
import { apiClient } from "@/lib/api";
import {
  type ControlTowerSummary,
  type OperatorActionKey,
  type OperatorActionResult,
  formatStatusTone,
  formatUsd,
} from "@/lib/control-tower";
import {
  clearStoredAdminKey,
  hasStoredAdminKey,
  persistAdminKey,
} from "@/lib/admin-session";
import { MetricStrip } from "@/components/ui/cerniq/MetricStrip";
import {
  Activity,
  AlertTriangle,
  ArrowRight,
  BrainCircuit,
  CheckCircle2,
  ExternalLink,
  FileText,
  GitBranch,
  Landmark,
  RefreshCw,
  Server,
  Sparkles,
  Workflow,
  Wrench,
} from "lucide-react";

const LIVE_URL =
  typeof window !== "undefined" ? window.location.origin : "https://cerniq.io";

function getErrorMessage(
  error: unknown,
  fallback = "Failed to load control tower",
) {
  if (
    typeof error === "object" &&
    error !== null &&
    "response" in error &&
    typeof (error as { response?: { status?: number } }).response?.status ===
      "number"
  ) {
    return (error as { response?: { status?: number } }).response?.status ===
      401
      ? "Invalid admin key"
      : fallback;
  }

  if (
    typeof error === "object" &&
    error !== null &&
    "message" in error &&
    typeof (error as { message?: unknown }).message === "string"
  ) {
    return (error as { message: string }).message;
  }

  return fallback;
}

function StatusChip({
  label,
  tone,
}: {
  label: string;
  tone: "emerald" | "amber" | "slate";
}) {
  const classes =
    tone === "emerald"
      ? "border-emerald-500/25 bg-emerald-500/10 text-emerald-200"
      : tone === "amber"
        ? "border-amber-500/25 bg-amber-500/10 text-amber-200"
        : "border-white/10 bg-white/5 text-slate-300";

  return (
    <span
      className={`inline-flex items-center rounded-full border px-3 py-1 text-xs font-semibold ${classes}`}
    >
      {label}
    </span>
  );
}

function StatCard({
  label,
  value,
  detail,
  icon,
}: {
  label: string;
  value: string;
  detail: string;
  icon: React.ReactNode;
}) {
  return (
    <div className="rounded-3xl border border-white/10 bg-slate-900/75 p-5">
      <div className="text-cyan-300">{icon}</div>
      <p className="mt-4 text-xs uppercase tracking-[0.22em] text-slate-500">
        {label}
      </p>
      <p className="mt-3 text-3xl font-semibold text-white">{value}</p>
      <p className="mt-2 text-sm text-slate-400">{detail}</p>
    </div>
  );
}

function formatFreshness(iso: string | null) {
  if (!iso) return "unknown";
  const diffHours = Math.round(
    (Date.now() - new Date(iso).getTime()) / (1000 * 60 * 60),
  );
  if (diffHours < 1) return "fresh";
  if (diffHours < 24) return `${diffHours}h ago`;
  const diffDays = Math.round(diffHours / 24);
  return `${diffDays}d ago`;
}

function isStaleContinuity(iso: string | null) {
  if (!iso) return true;
  return Date.now() - new Date(iso).getTime() > 48 * 60 * 60 * 1000;
}

function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState("");
  const [checking, setChecking] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setChecking(true);
    setError(null);

    try {
      persistAdminKey(password);
      await apiClient.getAdminControlTowerSummary();
      onAuth();
    } catch (err) {
      clearStoredAdminKey();
      setError(getErrorMessage(err, "Invalid admin key"));
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 p-6 text-white">
      <form
        onSubmit={handleSubmit}
        className="w-full max-w-sm rounded-3xl border border-white/10 bg-slate-900/90 p-8 shadow-2xl"
      >
        <div className="mb-6 flex items-center gap-3">
          <Landmark className="h-5 w-5 text-amber-400" />
          <div>
            <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
              Operator access
            </p>
            <h1 className="mt-1 text-xl font-semibold">CERNIQ Control Tower</h1>
          </div>
        </div>
        <input
          type="password"
          value={password}
          onChange={(e) => {
            setPassword(e.target.value);
            setError(null);
          }}
          placeholder="Enter admin key"
          className="mb-4 w-full rounded-2xl border border-white/10 bg-white/5 px-4 py-3 text-white placeholder:text-slate-500 focus:outline-none focus:ring-2 focus:ring-amber-500"
          autoFocus
        />
        {error ? <p className="mb-4 text-sm text-red-300">{error}</p> : null}
        <button
          type="submit"
          disabled={checking}
          className="w-full rounded-2xl bg-amber-400 px-4 py-3 font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
        >
          {checking ? "Verifying..." : "Enter control tower"}
        </button>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [summary, setSummary] = useState<ControlTowerSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [busyAction, setBusyAction] = useState<OperatorActionKey | null>(null);
  const [actionResult, setActionResult] = useState<OperatorActionResult | null>(
    null,
  );

  useEffect(() => {
    if (hasStoredAdminKey()) {
      setAuthed(true);
    } else {
      setLoading(false);
    }
  }, []);

  const loadSummary = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const nextSummary = await apiClient.getAdminControlTowerSummary();
      setSummary(nextSummary);
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (!authed) return;
    void loadSummary();
  }, [authed, loadSummary]);

  const runAction = useCallback(
    async (
      action: OperatorActionKey,
      target?: { userId?: string; jobId?: string },
    ) => {
      setBusyAction(action);
      setActionResult(null);
      setError(null);
      try {
        const result = await apiClient.runAdminControlTowerAction({
          action,
          userId: target?.userId,
          jobId: target?.jobId,
        });
        setActionResult(result);
        await loadSummary();
      } catch (err) {
        setError(getErrorMessage(err, "Operator action failed"));
      } finally {
        setBusyAction(null);
      }
    },
    [loadSummary],
  );

  const topMetrics = useMemo(() => {
    if (!summary) return [];
    return [
      {
        label: "MRR",
        value: formatUsd(summary.revenue.mrr),
        detail: `${summary.revenue.activeSubscriptions} active subscriptions`,
        icon: <Landmark className="h-5 w-5" />,
      },
      {
        label: "Report pipeline",
        value: String(summary.pipeline.counts.processing),
        detail: `${summary.pipeline.counts.awaitingData} awaiting • ${summary.pipeline.counts.failed} blocked`,
        icon: <Workflow className="h-5 w-5" />,
      },
      {
        label: "Intelligence",
        value: String(summary.intelligence.stats.totalAccounts),
        detail: `${summary.intelligence.stats.staleAccounts} stale • ${summary.intelligence.stats.overdueActions} overdue`,
        icon: <BrainCircuit className="h-5 w-5" />,
      },
      {
        label: "Exports",
        value: String(summary.exports.readyManifestCount),
        detail: `${summary.exports.onDemandFallbackJobs} on-demand fallback job(s)`,
        icon: <Sparkles className="h-5 w-5" />,
      },
    ];
  }, [summary]);

  if (!authed) {
    return (
      <AdminAuth
        onAuth={() => {
          setAuthed(true);
          setLoading(true);
        }}
      />
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/85">
        <div className="mx-auto flex max-w-7xl items-center justify-between gap-4 px-6 py-5">
          <div>
            <p className="text-xs uppercase tracking-[0.28em] text-cyan-300">
              Operator Control Tower
            </p>
            <h1 className="mt-2 text-3xl font-semibold">
              Run CERNIQ like one connected operating system.
            </h1>
            <p className="mt-2 max-w-3xl text-sm text-slate-400">
              One internal surface for pipeline health, portal activation,
              intelligence freshness, demo-seat flow, and cross-session
              coordination.
            </p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <a
              href={LIVE_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm text-slate-300 transition hover:bg-white/10"
            >
              <ExternalLink className="h-4 w-4" />
              Live site
            </a>
            <button
              onClick={() => loadSummary()}
              disabled={loading}
              className="inline-flex items-center gap-2 rounded-full bg-amber-400 px-4 py-2 text-sm font-semibold text-slate-950 transition hover:bg-amber-300 disabled:opacity-60"
            >
              <RefreshCw
                className={`h-4 w-4 ${loading ? "animate-spin" : ""}`}
              />
              Refresh
            </button>
          </div>
        </div>
      </div>

      <div className="mx-auto max-w-7xl px-6 py-8">
        {error ? (
          <div className="mb-6 rounded-2xl border border-red-500/30 bg-red-500/10 p-4 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {actionResult ? (
          <div className="mb-6 rounded-2xl border border-cyan-500/30 bg-cyan-500/10 p-4 text-sm text-cyan-100">
            <span className="font-semibold">{actionResult.summary}</span>
          </div>
        ) : null}

        {loading && !summary ? (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
            {Array.from({ length: 4 }).map((_, index) => (
              <div
                key={index}
                className="h-40 animate-pulse rounded-3xl border border-white/10 bg-slate-900/70"
              />
            ))}
          </div>
        ) : summary ? (
          <div className="space-y-8">
            <div className="flex flex-wrap items-center gap-3">
              <StatusChip
                label={`API ${summary.pipeline.counts.failed > 0 ? "attention" : "healthy"}`}
                tone={summary.pipeline.counts.failed > 0 ? "amber" : "emerald"}
              />
              <StatusChip
                label={`Branch ${summary.sessionContinuity.activeBranch || "unknown"}`}
                tone="slate"
              />
              <StatusChip
                label={`${summary.sessionContinuity.activeModes.length} active mode(s)`}
                tone={
                  summary.sessionContinuity.activeModes.length > 0
                    ? "amber"
                    : "slate"
                }
              />
              <StatusChip
                label={`${summary.demoSeats.expiringSoon} demo seats expiring soon`}
                tone={summary.demoSeats.expiringSoon > 0 ? "amber" : "emerald"}
              />
            </div>

            <MetricStrip
              density="comfortable"
              items={topMetrics.map((m) => ({
                label: m.label,
                value: m.value,
                tooltip: m.detail,
              }))}
            />

            <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Priority queue
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      What needs attention now
                    </h2>
                  </div>
                  <AlertTriangle className="h-5 w-5 text-amber-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {summary.nextActions.length === 0 ? (
                    <div className="rounded-2xl border border-emerald-500/20 bg-emerald-500/10 p-4 text-sm text-emerald-100">
                      No critical blockers surfaced in the current control-plane
                      snapshot.
                    </div>
                  ) : (
                    summary.nextActions.map((item) => (
                      <div
                        key={item.id}
                        className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div>
                            <div className="flex items-center gap-2">
                              <StatusChip
                                label={item.severity}
                                tone={
                                  item.severity === "high" ? "amber" : "slate"
                                }
                              />
                              <p className="font-semibold text-white">
                                {item.title}
                              </p>
                            </div>
                            <p className="mt-3 text-sm leading-6 text-slate-400">
                              {item.domain}
                            </p>
                          </div>
                          <div className="flex items-center gap-2">
                            {item.action ? (
                              <button
                                onClick={() =>
                                  runAction(item.action as OperatorActionKey)
                                }
                                disabled={busyAction === item.action}
                                className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-4 py-2 text-sm font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                              >
                                {busyAction === item.action
                                  ? "Running..."
                                  : "Run action"}
                              </button>
                            ) : null}
                            {item.href ? (
                              <Link
                                href={item.href}
                                className="inline-flex items-center gap-2 rounded-full border border-white/10 bg-white/5 px-4 py-2 text-sm font-semibold text-slate-200 transition hover:bg-white/10"
                              >
                                Open
                                <ArrowRight className="h-4 w-4" />
                              </Link>
                            ) : null}
                          </div>
                        </div>
                      </div>
                    ))
                  )}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Safe actions
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      Operator actions
                    </h2>
                  </div>
                  <Wrench className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {summary.safeActions.map((action) => (
                    <button
                      key={action.action}
                      onClick={() =>
                        runAction(action.action as OperatorActionKey)
                      }
                      disabled={busyAction === action.action}
                      className="w-full rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 text-left transition hover:bg-white/[0.06] disabled:opacity-60"
                    >
                      <div className="flex items-center justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {action.label}
                          </p>
                          <p className="mt-1 text-sm text-slate-400">
                            {action.description}
                          </p>
                        </div>
                        <ArrowRight className="h-4 w-4 text-slate-500" />
                      </div>
                    </button>
                  ))}
                </div>
              </section>
            </div>

            <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
              <div className="flex items-center justify-between gap-3">
                <div>
                  <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                    Feature bridge
                  </p>
                  <h2 className="mt-2 text-2xl font-semibold">
                    Every CERNIQ lane, connected
                  </h2>
                </div>
                <Server className="h-5 w-5 text-cyan-300" />
              </div>
              <div className="mt-5 grid gap-4 md:grid-cols-2 xl:grid-cols-4">
                {summary.featureBridge.map((feature) => (
                  <Link
                    key={feature.id}
                    href={feature.href}
                    className="group rounded-3xl border border-white/10 bg-white/[0.03] p-5 transition hover:border-cyan-400/30 hover:bg-white/[0.05]"
                  >
                    <div className="flex items-center justify-between gap-3">
                      <StatusChip
                        label={feature.status}
                        tone={formatStatusTone(feature.status)}
                      />
                      <ArrowRight className="h-4 w-4 text-slate-500 transition group-hover:translate-x-0.5" />
                    </div>
                    <h3 className="mt-4 text-xl font-semibold text-white">
                      {feature.label}
                    </h3>
                    <p className="mt-2 text-sm leading-6 text-slate-400">
                      {feature.detail}
                    </p>
                  </Link>
                ))}
              </div>
            </section>

            <div className="grid gap-6 xl:grid-cols-[1.05fr_0.95fr]">
              <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Session continuity
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      Between terminals and sessions
                    </h2>
                  </div>
                  <GitBranch className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 grid gap-4 md:grid-cols-2">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Latest session summary
                    </p>
                    <ul className="mt-3 space-y-2 text-sm text-slate-300">
                      {summary.sessionContinuity.latestStatusSummary.map(
                        (line) => (
                          <li key={line}>• {line}</li>
                        ),
                      )}
                    </ul>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Next recommended commands
                    </p>
                    <div className="mt-3 space-y-2">
                      {summary.sessionContinuity.recommendedCommands.map(
                        (command) => (
                          <code
                            key={command}
                            className="block rounded-xl bg-black/30 px-3 py-2 text-xs text-cyan-100"
                          >
                            {command}
                          </code>
                        ),
                      )}
                    </div>
                  </div>
                </div>
                <div className="mt-4 grid gap-4 md:grid-cols-3">
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Branch
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      {summary.sessionContinuity.activeBranch || "unknown"}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      {summary.sessionContinuity.activeModes[0] ||
                        "No active mode"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Turn metrics
                    </p>
                    <p className="mt-3 text-lg font-semibold text-white">
                      {summary.sessionContinuity.metrics?.turnCount || 0}
                    </p>
                    <p className="mt-1 text-sm text-slate-400">
                      Last HUD title:{" "}
                      {summary.sessionContinuity.lastAgentOutputTitle || "—"}
                    </p>
                  </div>
                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Workspace root
                    </p>
                    <p className="mt-3 break-all text-sm text-slate-300">
                      {summary.sessionContinuity.workspaceRoot}
                    </p>
                    {isStaleContinuity(
                      summary.sessionContinuity.latestStatusUpdatedAt,
                    ) ? (
                      <p className="mt-2 text-xs font-medium text-amber-300">
                        Continuity snapshot may be stale.
                      </p>
                    ) : null}
                    <p className="mt-2 text-xs text-slate-500">
                      Status updated{" "}
                      {formatFreshness(
                        summary.sessionContinuity.latestStatusUpdatedAt,
                      )}
                    </p>
                    <p className="mt-1 text-xs text-slate-500">
                      Handoff updated{" "}
                      {formatFreshness(
                        summary.sessionContinuity.handoffUpdatedAt,
                      )}
                    </p>
                  </div>
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Subordinate workspaces
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      Open the specialist consoles
                    </h2>
                  </div>
                  <CheckCircle2 className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 grid gap-3">
                  {[
                    ["Pipeline", "/admin/pipeline"],
                    ["Prospects", "/admin/prospects"],
                    ["Demo Seats", "/admin/demo-seats"],
                    ["Intelligence", "/admin/intelligence"],
                    ["Ops", "/admin/ops"],
                    ["Metrics", "/admin/metrics"],
                    ["Audit", "/admin/audit"],
                  ].map(([label, href]) => (
                    <Link
                      key={href}
                      href={href}
                      className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.06]"
                    >
                      <span className="font-medium text-white">{label}</span>
                      <ArrowRight className="h-4 w-4 text-slate-500" />
                    </Link>
                  ))}
                  <div className="rounded-2xl border border-dashed border-white/10 bg-white/[0.02] px-4 py-4">
                    <p className="text-xs uppercase tracking-[0.22em] text-slate-500">
                      Secondary internal tools
                    </p>
                    <div className="mt-3 grid gap-3">
                      {[
                        ["Checklist", "/admin/checklist"],
                        ["Exit Metrics", "/admin/exit"],
                      ].map(([label, href]) => (
                        <Link
                          key={href}
                          href={href}
                          className="flex items-center justify-between rounded-2xl border border-white/10 bg-white/[0.03] px-4 py-4 transition hover:bg-white/[0.06]"
                        >
                          <div>
                            <span className="font-medium text-white">
                              {label}
                            </span>
                            <p className="mt-1 text-sm text-slate-500">
                              Internal reference surface, not a primary operator
                              lane.
                            </p>
                          </div>
                          <ArrowRight className="h-4 w-4 text-slate-500" />
                        </Link>
                      ))}
                    </div>
                  </div>
                </div>
              </section>
            </div>

            <div className="grid gap-6 xl:grid-cols-2">
              <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Recent pipeline jobs
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      Queue visibility
                    </h2>
                  </div>
                  <Activity className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {summary.pipeline.recentJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {job.institutionName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {job.user?.email || "Unknown client"}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusChip
                            label={job.status}
                            tone={
                              ["FAILED", "VALIDATION_FAILED"].includes(
                                job.status,
                              )
                                ? "amber"
                                : [
                                      "PROCESSING",
                                      "QUEUED",
                                      "UPLOADING",
                                      "VALIDATING",
                                      "GENERATING_PDF",
                                    ].includes(job.status)
                                  ? "emerald"
                                  : "slate"
                            }
                          />
                          {["FAILED", "VALIDATION_FAILED"].includes(
                            job.status,
                          ) ? (
                            <button
                              onClick={() =>
                                runAction("retry_pipeline_job", {
                                  jobId: job.id,
                                })
                              }
                              disabled={busyAction === "retry_pipeline_job"}
                              className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                            >
                              {busyAction === "retry_pipeline_job"
                                ? "Retrying..."
                                : "Retry"}
                            </button>
                          ) : null}
                        </div>
                      </div>
                      {job.errorMessage ? (
                        <p className="mt-3 text-sm text-amber-200">
                          {job.errorMessage}
                        </p>
                      ) : null}
                    </div>
                  ))}
                </div>
              </section>

              <section className="rounded-3xl border border-white/10 bg-slate-900/75 p-6">
                <div className="flex items-center justify-between gap-3">
                  <div>
                    <p className="text-xs uppercase tracking-[0.24em] text-slate-500">
                      Portal & demo-seat lane
                    </p>
                    <h2 className="mt-2 text-2xl font-semibold">
                      Activation and conversion
                    </h2>
                  </div>
                  <FileText className="h-5 w-5 text-cyan-300" />
                </div>
                <div className="mt-5 space-y-3">
                  {summary.portal.stalledJobs.map((job) => (
                    <div
                      key={job.id}
                      className="rounded-2xl border border-white/10 bg-white/[0.03] p-4"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <div>
                          <p className="font-semibold text-white">
                            {job.institutionName}
                          </p>
                          <p className="mt-1 text-xs text-slate-500">
                            {job.userId}
                          </p>
                        </div>
                        <div className="flex items-center gap-2">
                          <StatusChip label={job.status} tone="amber" />
                          <button
                            onClick={() =>
                              runAction("open_portal_cycle", {
                                userId: job.userId,
                              })
                            }
                            disabled={busyAction === "open_portal_cycle"}
                            className="rounded-full border border-cyan-500/30 bg-cyan-500/10 px-3 py-1.5 text-xs font-semibold text-cyan-200 transition hover:bg-cyan-500/20 disabled:opacity-60"
                          >
                            {busyAction === "open_portal_cycle"
                              ? "Opening..."
                              : "Open cycle"}
                          </button>
                        </div>
                      </div>
                      {job.errorMessage ? (
                        <p className="mt-3 text-sm text-amber-200">
                          {job.errorMessage}
                        </p>
                      ) : null}
                    </div>
                  ))}

                  <div className="rounded-2xl border border-white/10 bg-white/[0.03] p-4">
                    <p className="text-sm text-slate-300">
                      Demo seats: {summary.demoSeats.active} active,{" "}
                      {summary.demoSeats.expired} expired,{" "}
                      {summary.demoSeats.expiringSoon} expiring soon.
                    </p>
                    <p className="mt-2 text-sm text-slate-400">
                      Intelligence handoff:{" "}
                      {summary.intelligence.handoff.summary}
                    </p>
                  </div>
                </div>
              </section>
            </div>
          </div>
        ) : null}
      </div>
    </div>
  );
}
