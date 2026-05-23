"use client";

import React, { useState, useEffect, useCallback } from "react";
import { useTranslation } from "@/lib/i18n";
import { RiskScoreBadge } from "@/components/wave03/risk-score-badge";
import { Modal } from "@/components/ui/Modal";

// ─── Types ──────────────────────────────────────────────────────────────────

interface CPAFirmInfo {
  name: string;
  logo?: string;
  totalClients: number;
  totalAUM: number;
}

interface CPAClient {
  id: string;
  institutionName: string;
  totalAssets: number;
  riskScore: number;
  lastAnalysisDate: string;
  complianceStatus: "compliant" | "warning" | "breach";
}

interface DashboardMetrics {
  totalAssetsUnderAdvisory: number;
  upcomingExams: number;
  recentAlerts: number;
}

// Mirrors backend `DataGap` from `backend-node/src/alm/reports/data-gap.ts`.
// Kept inline (not a shared lib import) because the dashboard only consumes
// the `field` / `reason` / `action` projection; full DataGap type lives on
// the backend and is the source of truth.
interface DataGap {
  field: string;
  reason: string;
  severity: "CRITICAL" | "WARNING";
  action?: string;
}

/**
 * Look up a gap entry by field path. Returns the matching gap or undefined.
 * Used to swap metric numerics for "—" + tooltip when the upstream feed is
 * a typed `UNWIRED_INTEGRATION` gap rather than real data. See KLYTICS Rule 1
 * (no silent zeros) — render absence visibly, never as `0`.
 */
function findGap(
  gaps: DataGap[] | undefined,
  field: string,
): DataGap | undefined {
  return gaps?.find((g) => g.field === field);
}

// ─── Helpers ────────────────────────────────────────────────────────────────

const API = (process.env.NEXT_PUBLIC_NODE_API_URL || "")
  .trim()
  .replace(/\/+$/, "");

function authHeaders(): HeadersInit {
  const token =
    typeof window !== "undefined"
      ? sessionStorage.getItem("capex_access_token")
      : null;
  return token
    ? { Authorization: `Bearer ${token}`, "Content-Type": "application/json" }
    : { "Content-Type": "application/json" };
}

function currencyCompact(value: number): string {
  if (value >= 1_000_000_000) return `$${(value / 1_000_000_000).toFixed(1)}B`;
  if (value >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (value >= 1_000) return `$${(value / 1_000).toFixed(0)}K`;
  return `$${value.toFixed(0)}`;
}

function formatDate(iso: string): string {
  try {
    return new Date(iso).toLocaleDateString("en-US", {
      month: "short",
      day: "numeric",
      year: "numeric",
    });
  } catch {
    return iso;
  }
}

// ─── Demo data ──────────────────────────────────────────────────────────────

const DEMO_FIRM: CPAFirmInfo = {
  name: "Rodriguez & Associates CPA",
  totalClients: 12,
  totalAUM: 8_750_000_000,
};

const DEMO_CLIENTS: CPAClient[] = [
  {
    id: "c1",
    institutionName: "Cooperativa de Ahorro Caguas",
    totalAssets: 2_800_000_000,
    riskScore: 85,
    lastAnalysisDate: "2026-04-14T00:00:00Z",
    complianceStatus: "compliant",
  },
  {
    id: "c2",
    institutionName: "ACACIA Federal Credit Union",
    totalAssets: 1_500_000_000,
    riskScore: 72,
    lastAnalysisDate: "2026-04-13T00:00:00Z",
    complianceStatus: "warning",
  },
  {
    id: "c3",
    institutionName: "Oriental Federal Credit Union",
    totalAssets: 1_200_000_000,
    riskScore: 91,
    lastAnalysisDate: "2026-04-15T00:00:00Z",
    complianceStatus: "compliant",
  },
  {
    id: "c4",
    institutionName: "Cooperativa de Bayamon",
    totalAssets: 950_000_000,
    riskScore: 55,
    lastAnalysisDate: "2026-04-10T00:00:00Z",
    complianceStatus: "breach",
  },
  {
    id: "c5",
    institutionName: "Cooperativa Jesus Obrero",
    totalAssets: 680_000_000,
    riskScore: 78,
    lastAnalysisDate: "2026-04-12T00:00:00Z",
    complianceStatus: "compliant",
  },
  {
    id: "c6",
    institutionName: "Cooperativa de Arecibo",
    totalAssets: 520_000_000,
    riskScore: 63,
    lastAnalysisDate: "2026-04-11T00:00:00Z",
    complianceStatus: "warning",
  },
];

const DEMO_METRICS: DashboardMetrics = {
  totalAssetsUnderAdvisory: 8_750_000_000,
  upcomingExams: 3,
  recentAlerts: 7,
};

// ─── Compliance badge ───────────────────────────────────────────────────────

function ComplianceBadge({
  status,
  locale,
}: {
  status: string;
  locale: "en" | "es";
}) {
  const styles: Record<string, string> = {
    compliant: "bg-emerald-50 text-emerald-700 border-emerald-200",
    warning: "bg-amber-50 text-amber-700 border-amber-200",
    breach: "bg-rose-50 text-rose-700 border-rose-200",
  };
  const labels: Record<string, Record<string, string>> = {
    compliant: { en: "Compliant", es: "Cumple" },
    warning: { en: "Warning", es: "Advertencia" },
    breach: { en: "Breach", es: "Incumple" },
  };
  return (
    <span
      className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-semibold ${styles[status] || styles.warning}`}
    >
      {labels[status]?.[locale] || status}
    </span>
  );
}

// ─── Main Page ──────────────────────────────────────────────────────────────

export default function CPADashboardPage() {
  const { locale } = useTranslation();

  const [firm, setFirm] = useState<CPAFirmInfo>(DEMO_FIRM);
  const [clients, setClients] = useState<CPAClient[]>(DEMO_CLIENTS);
  const [metrics, setMetrics] = useState<DashboardMetrics>(DEMO_METRICS);
  const [gaps, setGaps] = useState<DataGap[]>([]);
  // True when the rendered dashboard reflects demo fallback rather than a
  // live backend response. Surfaced via a banner so a real CPA never mistakes
  // the seed-data placeholder for their actual portfolio. The fallback
  // affordance is preserved (cards still render with familiar shapes during
  // dev / API outages); only the *truthfulness signal* is added.
  const [demoMode, setDemoMode] = useState<boolean>(false);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [addClientOpen, setAddClientOpen] = useState(false);
  const [bulkUploadOpen, setBulkUploadOpen] = useState(false);
  const [searchQuery, setSearchQuery] = useState("");
  const [dragOver, setDragOver] = useState(false);

  // Fetch dashboard data
  useEffect(() => {
    async function fetchData() {
      let dashLive = false;
      let clientsLive = false;
      try {
        const firmId =
          typeof window !== "undefined"
            ? sessionStorage.getItem("cpa_firm_id") || "demo"
            : "demo";
        const [dashRes, clientsRes] = await Promise.all([
          fetch(`${API}/api/cpa/firms/${firmId}/dashboard`, {
            headers: authHeaders(),
          }),
          fetch(`${API}/api/cpa/firms/${firmId}/clients`, {
            headers: authHeaders(),
          }),
        ]);
        if (dashRes.ok) {
          const dashData = await dashRes.json();
          if (dashData.firm) setFirm(dashData.firm);
          if (dashData.metrics) setMetrics(dashData.metrics);
          if (Array.isArray(dashData.gaps)) setGaps(dashData.gaps);
          dashLive = true;
        }
        if (clientsRes.ok) {
          const clientData = await clientsRes.json();
          if (Array.isArray(clientData) && clientData.length > 0)
            setClients(clientData);
          clientsLive = true;
        }
      } catch {
        // Swallowed — demoMode banner makes the fallback visible. Don't
        // suppress the audit-relevant signal that we're on stale data.
      } finally {
        // Either fetch missing → we're showing at least some demo content.
        // Be conservative: surface the banner unless BOTH live.
        setDemoMode(!(dashLive && clientsLive));
        setLoading(false);
      }
    }
    fetchData();
  }, []);

  const retry = useCallback(() => {
    setError(null);
    setLoading(true);
    window.location.reload();
  }, []);

  // Risk distribution
  const highRisk = clients.filter((c) => c.riskScore < 60).length;
  const medRisk = clients.filter(
    (c) => c.riskScore >= 60 && c.riskScore < 80,
  ).length;
  const lowRisk = clients.filter((c) => c.riskScore >= 80).length;

  // ─── Loading skeleton ─────────────────────────────────────────────────

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-50 p-6">
        <div className="mx-auto max-w-[1400px] space-y-6">
          <div className="h-16 animate-pulse rounded-xl bg-slate-200" />
          <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
            {[...Array(3)].map((_, i) => (
              <div
                key={i}
                className="h-28 animate-pulse rounded-xl bg-slate-200"
              />
            ))}
          </div>
          <div className="h-96 animate-pulse rounded-xl bg-slate-200" />
        </div>
      </div>
    );
  }

  // ─── Error state ──────────────────────────────────────────────────────

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-50">
        <div className="max-w-md rounded-xl border border-rose-200 bg-rose-50 p-6 text-center">
          <p className="text-sm font-semibold text-rose-900">{error}</p>
          <button
            onClick={retry}
            className="mt-4 rounded-lg border border-rose-300 bg-white px-4 py-2 text-xs font-semibold text-rose-700 hover:bg-rose-50"
          >
            {locale === "es" ? "Reintentar" : "Retry"}
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 p-6">
      <div className="mx-auto max-w-[1400px] space-y-6">
        {/* Demo-mode banner — visible whenever the dashboard is showing
            placeholder data rather than a live backend response. Mirrors the
            preview-report watermark pattern (preview-report.service.ts).
            Auditor-grade transparency: never silently show seed data. */}
        {demoMode && (
          <div
            role="status"
            aria-live="polite"
            data-testid="demo-mode-banner"
            className="flex items-start gap-3 rounded-xl border border-amber-300 bg-amber-50 p-3 text-sm"
          >
            <span aria-hidden="true" className="text-amber-700">
              ⚠
            </span>
            <div className="flex-1 text-amber-900">
              <p className="font-semibold">
                {locale === "es" ? "Datos de demostración" : "Demo data"}
              </p>
              <p className="mt-0.5 text-xs text-amber-800">
                {locale === "es"
                  ? "El backend no respondió. Los nombres de instituciones, métricas y resúmenes mostrados son placeholders de demostración — no reflejan datos reales de su firma."
                  : "The backend did not respond. Institution names, metrics, and summaries shown are demo placeholders — they do not reflect your firm’s real data."}
              </p>
            </div>
          </div>
        )}

        {/* Top bar: Firm info */}
        <header className="flex items-center justify-between rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center gap-4">
            <div className="flex h-12 w-12 items-center justify-center rounded-xl bg-[#1e3a5f] text-white font-bold text-lg">
              {firm.name.charAt(0)}
            </div>
            <div>
              <h1 className="text-lg font-bold text-[#1e3a5f]">{firm.name}</h1>
              <p className="text-xs text-slate-500">
                {firm.totalClients} {locale === "es" ? "clientes" : "clients"}{" "}
                &middot; {currencyCompact(firm.totalAUM)} AUM
              </p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setAddClientOpen(true)}
              className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-xs font-semibold text-white transition hover:bg-[#2a4f7f]"
            >
              + {locale === "es" ? "Agregar Cliente" : "Add Client"}
            </button>
            <button
              onClick={() => setBulkUploadOpen(true)}
              className="rounded-lg border border-slate-200 bg-white px-4 py-2 text-xs font-semibold text-slate-700 transition hover:bg-slate-50"
            >
              {locale === "es" ? "Carga Masiva" : "Bulk Upload"}
            </button>
          </div>
        </header>

        <div className="grid grid-cols-1 gap-6 lg:grid-cols-4">
          {/* Main content area */}
          <div className="space-y-6 lg:col-span-3">
            {/* Risk distribution cards */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
              <div className="rounded-xl border border-rose-200 bg-rose-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-rose-600">
                  {locale === "es" ? "Alto Riesgo" : "High Risk"}
                </p>
                <p className="mt-1 text-3xl font-bold text-rose-700">
                  {highRisk}
                </p>
                <p className="mt-0.5 text-[11px] text-rose-500">
                  {locale === "es" ? "Puntuacion < 60" : "Score < 60"}
                </p>
              </div>
              <div className="rounded-xl border border-amber-200 bg-amber-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-amber-600">
                  {locale === "es" ? "Riesgo Moderado" : "Medium Risk"}
                </p>
                <p className="mt-1 text-3xl font-bold text-amber-700">
                  {medRisk}
                </p>
                <p className="mt-0.5 text-[11px] text-amber-500">
                  {locale === "es" ? "Puntuacion 60-79" : "Score 60-79"}
                </p>
              </div>
              <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-4">
                <p className="text-xs font-semibold uppercase tracking-wider text-emerald-600">
                  {locale === "es" ? "Bajo Riesgo" : "Low Risk"}
                </p>
                <p className="mt-1 text-3xl font-bold text-emerald-700">
                  {lowRisk}
                </p>
                <p className="mt-0.5 text-[11px] text-emerald-500">
                  {locale === "es" ? "Puntuacion 80+" : "Score 80+"}
                </p>
              </div>
            </div>

            {/* Client table */}
            <div className="overflow-hidden rounded-xl border border-slate-200 bg-white">
              <div className="border-b border-slate-200 px-5 py-3">
                <h2 className="text-sm font-bold text-[#1e3a5f]">
                  {locale === "es" ? "Clientes" : "Clients"}
                </h2>
              </div>
              <div className="overflow-x-auto">
                <table className="w-full">
                  <thead>
                    <tr className="border-b border-slate-100 bg-slate-50">
                      <th className="px-5 py-2.5 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {locale === "es" ? "Institucion" : "Institution"}
                      </th>
                      <th className="px-5 py-2.5 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {locale === "es" ? "Activos Totales" : "Total Assets"}
                      </th>
                      <th className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {locale === "es" ? "Puntuacion" : "Risk Score"}
                      </th>
                      <th className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {locale === "es" ? "Ultimo Analisis" : "Last Analysis"}
                      </th>
                      <th className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {locale === "es" ? "Cumplimiento" : "Compliance"}
                      </th>
                      <th className="px-5 py-2.5 text-center text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                        {locale === "es" ? "Acciones" : "Actions"}
                      </th>
                    </tr>
                  </thead>
                  <tbody>
                    {clients.map((client) => (
                      <tr
                        key={client.id}
                        className="border-b border-slate-50 transition hover:bg-slate-50"
                      >
                        <td className="px-5 py-3">
                          <span className="text-sm font-medium text-slate-800">
                            {client.institutionName}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-right">
                          <span className="font-mono text-sm tabular-nums text-slate-700">
                            {currencyCompact(client.totalAssets)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <RiskScoreBadge score={client.riskScore} size="sm" />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <span className="text-xs text-slate-500">
                            {formatDate(client.lastAnalysisDate)}
                          </span>
                        </td>
                        <td className="px-5 py-3 text-center">
                          <ComplianceBadge
                            status={client.complianceStatus}
                            locale={locale}
                          />
                        </td>
                        <td className="px-5 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <a
                              href={`/portal/reports/${client.id}`}
                              className="rounded-lg border border-slate-200 px-2.5 py-1 text-[11px] font-medium text-slate-600 transition hover:bg-slate-50"
                            >
                              {locale === "es" ? "Ver Reporte" : "View Report"}
                            </a>
                            <button className="rounded-lg border border-[#1e3a5f] px-2.5 py-1 text-[11px] font-medium text-[#1e3a5f] transition hover:bg-blue-50">
                              {locale === "es" ? "Analizar" : "Run Analysis"}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </div>
          </div>

          {/* Right sidebar metrics */}
          <aside className="space-y-4">
            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {locale === "es"
                  ? "Activos Bajo Asesoria"
                  : "Assets Under Advisory"}
              </p>
              <p className="mt-1 text-2xl font-bold text-[#1e3a5f]">
                {currencyCompact(metrics.totalAssetsUnderAdvisory)}
              </p>
            </div>

            {(() => {
              // Render the Upcoming Exams card as gap-aware: when the backend
              // emits an UNWIRED_INTEGRATION gap for `dashboard.upcomingExams`,
              // show `—` with the gap's action as tooltip. Otherwise render the
              // numeric value (live data, or demo when demoMode is active).
              const examGap = findGap(gaps, "dashboard.upcomingExams");
              return (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {locale === "es" ? "Examenes Proximos" : "Upcoming Exams"}
                  </p>
                  {examGap ? (
                    <p
                      className="mt-1 text-2xl font-bold text-slate-400"
                      title={examGap.action ?? examGap.reason}
                      data-testid="upcoming-exams-gap"
                    >
                      —
                    </p>
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-amber-600">
                      {metrics.upcomingExams}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {locale === "es" ? "Proximos 90 dias" : "Next 90 days"}
                  </p>
                </div>
              );
            })()}

            {(() => {
              const alertsGap = findGap(gaps, "dashboard.recentAlerts");
              return (
                <div className="rounded-xl border border-slate-200 bg-white p-4">
                  <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                    {locale === "es" ? "Alertas Recientes" : "Recent Alerts"}
                  </p>
                  {alertsGap ? (
                    <p
                      className="mt-1 text-2xl font-bold text-slate-400"
                      title={alertsGap.action ?? alertsGap.reason}
                      data-testid="recent-alerts-gap"
                    >
                      —
                    </p>
                  ) : (
                    <p className="mt-1 text-2xl font-bold text-rose-600">
                      {metrics.recentAlerts}
                    </p>
                  )}
                  <p className="mt-0.5 text-[11px] text-slate-400">
                    {locale === "es" ? "Ultimos 7 dias" : "Last 7 days"}
                  </p>
                </div>
              );
            })()}

            <div className="rounded-xl border border-slate-200 bg-white p-4">
              <p className="text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
                {locale === "es" ? "Resumen de Riesgo" : "Risk Summary"}
              </p>
              <div className="mt-3 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-rose-500" />
                    {locale === "es" ? "Alto" : "High"}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {highRisk}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-amber-500" />
                    {locale === "es" ? "Moderado" : "Medium"}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {medRisk}
                  </span>
                </div>
                <div className="flex items-center justify-between">
                  <span className="flex items-center gap-1.5 text-xs text-slate-600">
                    <span className="h-2 w-2 rounded-full bg-emerald-500" />
                    {locale === "es" ? "Bajo" : "Low"}
                  </span>
                  <span className="text-xs font-semibold text-slate-700">
                    {lowRisk}
                  </span>
                </div>
              </div>
            </div>
          </aside>
        </div>
      </div>

      {/* Add Client Modal */}
      <Modal
        open={addClientOpen}
        onClose={() => setAddClientOpen(false)}
        title={locale === "es" ? "Agregar Cliente" : "Add Client"}
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div>
            <label className="mb-1 block text-xs font-medium text-slate-600">
              {locale === "es" ? "Buscar institucion" : "Search institution"}
            </label>
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={
                locale === "es"
                  ? "Nombre de cooperativa..."
                  : "Cooperativa name..."
              }
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm text-slate-700 placeholder:text-slate-400 focus:border-[#1e3a5f] focus:outline-none focus:ring-1 focus:ring-[#1e3a5f]"
            />
          </div>
          {searchQuery.length > 2 && (
            <div className="space-y-1 rounded-lg border border-slate-200 p-2">
              {[
                "Cooperativa del Interior",
                "Cooperativa Roosevelt Roads",
                "Cooperativa San Rafael",
              ]
                .filter((n) =>
                  n.toLowerCase().includes(searchQuery.toLowerCase()),
                )
                .map((name) => (
                  <button
                    key={name}
                    className="w-full rounded-lg px-3 py-2 text-left text-sm text-slate-700 transition hover:bg-slate-50"
                    onClick={() => {
                      setAddClientOpen(false);
                      setSearchQuery("");
                    }}
                  >
                    {name}
                  </button>
                ))}
            </div>
          )}
          <div className="flex justify-end gap-2 pt-2">
            <button
              onClick={() => setAddClientOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {locale === "es" ? "Cancelar" : "Cancel"}
            </button>
          </div>
        </div>
      </Modal>

      {/* Bulk Upload Modal */}
      <Modal
        open={bulkUploadOpen}
        onClose={() => setBulkUploadOpen(false)}
        title={
          locale === "es" ? "Carga Masiva de Clientes" : "Bulk Client Upload"
        }
        maxWidth="max-w-md"
      >
        <div className="space-y-4">
          <div
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
            }}
            className={`flex flex-col items-center justify-center rounded-xl border-2 border-dashed p-8 transition ${
              dragOver
                ? "border-[#1e3a5f] bg-blue-50"
                : "border-slate-300 bg-slate-50"
            }`}
          >
            <svg
              className="mb-3 h-10 w-10 text-slate-400"
              fill="none"
              viewBox="0 0 24 24"
              stroke="currentColor"
              strokeWidth={1.5}
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                d="M12 16.5V9.75m0 0l3 3m-3-3l-3 3M6.75 19.5a4.5 4.5 0 01-1.41-8.775 5.25 5.25 0 0110.233-2.33 3 3 0 013.758 3.848A3.752 3.752 0 0118 19.5H6.75z"
              />
            </svg>
            <p className="text-sm font-medium text-slate-600">
              {locale === "es" ? "Arrastre CSV aqui" : "Drag CSV file here"}
            </p>
            <p className="mt-1 text-xs text-slate-400">
              {locale === "es"
                ? "o haga clic para seleccionar"
                : "or click to browse"}
            </p>
            <input
              type="file"
              accept=".csv"
              className="absolute inset-0 cursor-pointer opacity-0"
              aria-label="Upload CSV"
            />
          </div>
          <div className="flex justify-end gap-2">
            <button
              onClick={() => setBulkUploadOpen(false)}
              className="rounded-lg border border-slate-200 px-4 py-2 text-xs font-medium text-slate-600 hover:bg-slate-50"
            >
              {locale === "es" ? "Cancelar" : "Cancel"}
            </button>
            <button className="rounded-lg bg-[#1e3a5f] px-4 py-2 text-xs font-semibold text-white hover:bg-[#2a4f7f]">
              {locale === "es" ? "Subir" : "Upload"}
            </button>
          </div>
        </div>
      </Modal>
    </div>
  );
}
