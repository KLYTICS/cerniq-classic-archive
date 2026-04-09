"use client";

import { useState, useEffect, useCallback } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import {
  FileText,
  Download,
  ArrowLeft,
  AlertTriangle,
  Globe,
} from "lucide-react";
import { analytics, EVENTS } from "@/lib/analytics";
import { getPublicApiUrl } from "@/lib/api-base";
import { unwrapApiData } from "@/lib/api-response";
import { useDocumentExports } from "@/hooks/useDocumentExports";
import ReportProgressWS from "@/components/portal/ReportProgressWS";
import type { PortalExportSummary } from "@/lib/portal-overview";

interface JobDetail {
  id: string;
  institutionName: string;
  institutionId?: string | null;
  status: string;
  analysisPeriod?: string | null;
  previousJobId?: string | null;
  submittedAt?: string | null;
  processingStartedAt?: string | null;
  completedAt: string | null;
  createdAt: string;
  reportUrl?: string | null;
  reportUrlEn?: string | null;
  reportLang?: string;
  triggeredBy?: string | null;
  errorMessage: string | null;
  exportSummary?: PortalExportSummary | null;
}

function formatDate(value?: string | null) {
  if (!value) {
    return "—";
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return "—";
  }

  return parsed.toLocaleString();
}

function formatStatusLabel(status: string) {
  return status.replace(/_/g, " ");
}

function statusTone(status: string) {
  if (status === "COMPLETE") {
    return "bg-emerald-100 text-emerald-800";
  }
  if (status === "FAILED" || status === "VALIDATION_FAILED") {
    return "bg-rose-100 text-rose-800";
  }
  if (
    [
      "QUEUED",
      "PROCESSING",
      "GENERATING_PDF",
      "UPLOADING",
      "VALIDATING",
    ].includes(status)
  ) {
    return "bg-amber-100 text-amber-800";
  }
  return "bg-slate-100 text-slate-700";
}

export default function ReportViewer() {
  const params = useParams();
  const [job, setJob] = useState<JobDetail | null>(null);
  const [loading, setLoading] = useState(true);
  const [pdfLang, setPdfLang] = useState<"es" | "en">("es");
  const jobId =
    typeof params.id === "string"
      ? params.id
      : Array.isArray(params.id)
        ? params.id[0]
        : undefined;
  const {
    manifests,
    readyManifests,
    error: exportError,
    loading: exportsLoading,
    downloadingId,
    download,
    refresh,
  } = useDocumentExports(
    jobId ? `/api/portal/jobs/${jobId}/exports` : undefined,
    { enabled: Boolean(jobId) },
  );

  const loadJob = useCallback(
    async (trackView = false) => {
      if (!jobId) {
        setJob(null);
        setLoading(false);
        return null;
      }

      setLoading(true);
      try {
        const res = await fetch(getPublicApiUrl(`/api/portal/jobs/${jobId}`), {
          credentials: "include",
        });
        if (!res.ok) {
          setJob(null);
          return null;
        }

        const data = unwrapApiData<JobDetail | null>(
          await res.json().catch(() => null),
        );
        if (!data) {
          setJob(null);
          return null;
        }

        setJob(data);
        if (trackView) {
          analytics.track(EVENTS.PORTAL_REPORT_VIEWED, {
            jobId: data.id,
            status: data.status,
          });
        }
        return data;
      } catch {
        setJob(null);
        return null;
      } finally {
        setLoading(false);
      }
    },
    [jobId],
  );

  const handleRefreshDeliveryState = useCallback(async () => {
    await refresh();
    await loadJob();
  }, [loadJob, refresh]);

  useEffect(() => {
    void loadJob(true);
  }, [loadJob]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-full min-h-[400px]">
        <div className="w-8 h-8 border-2 border-[#1B3A6B] border-t-transparent rounded-full animate-spin" />
      </div>
    );
  }

  if (!job) {
    return (
      <div className="max-w-2xl mx-auto p-8 text-center">
        <AlertTriangle className="h-10 w-10 text-gray-300 mx-auto mb-3" />
        <p className="text-gray-500 mb-4">Report not found.</p>
        <Link href="/portal" className="text-sm text-[#1B3A6B] hover:underline">
          Back to dashboard
        </Link>
      </div>
    );
  }

  const reportManifests = readyManifests.filter(
    (manifest) => manifest.kind === "alm_report",
  );
  const currentManifest =
    reportManifests.find((manifest) => manifest.language === pdfLang) ||
    reportManifests[0] ||
    null;
  const boardPackManifest =
    readyManifests.find(
      (manifest) =>
        manifest.kind === "alco_pack" && manifest.language === pdfLang,
    ) ||
    readyManifests.find((manifest) => manifest.kind === "alco_pack") ||
    null;
  const currentUrl = currentManifest?.downloadUrl || null;
  const exportLanguages =
    reportManifests
      .map((manifest) => manifest.language.toUpperCase())
      .join(" / ") || "—";
  const exportCount = readyManifests.length;
  const isProcessing = [
    "QUEUED",
    "PROCESSING",
    "GENERATING_PDF",
    "UPLOADING",
    "VALIDATING",
  ].includes(job.status);
  const isExportDegraded =
    job.status === "COMPLETE" &&
    job.exportSummary &&
    job.exportSummary.status !== "ready";

  return (
    <div className="h-full flex flex-col">
      {/* Header */}
      <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between shrink-0">
        <div className="flex items-center gap-3">
          <Link href="/portal" className="text-gray-400 hover:text-gray-600">
            <ArrowLeft className="h-5 w-5" />
          </Link>
          <div>
            <h1 className="text-sm font-semibold text-gray-900">
              {job.institutionName}
            </h1>
            <p className="text-xs text-gray-400">
              {job.completedAt
                ? `Generated ${new Date(job.completedAt).toLocaleDateString()}`
                : `Status: ${formatStatusLabel(job.status)}`}
            </p>
          </div>
        </div>

        {job.status === "COMPLETE" && (
          <div className="flex items-center gap-2">
            {/* Language toggle */}
            {reportManifests.length > 1 && (
              <div className="flex items-center gap-1 bg-gray-100 rounded-lg p-1">
                <button
                  onClick={() => setPdfLang("es")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${pdfLang === "es" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                >
                  <Globe className="h-3 w-3" /> ES
                </button>
                <button
                  onClick={() => setPdfLang("en")}
                  className={`flex items-center gap-1 px-2.5 py-1 rounded text-xs font-medium transition ${pdfLang === "en" ? "bg-white shadow-sm text-gray-900" : "text-gray-500"}`}
                >
                  <Globe className="h-3 w-3" /> EN
                </button>
              </div>
            )}
            {currentManifest && (
              <button
                onClick={() => void download(currentManifest)}
                disabled={downloadingId === currentManifest.id}
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2 rounded-lg text-sm font-medium hover:bg-[#15305a] transition disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloadingId === currentManifest.id
                  ? "Preparing..."
                  : "Download report"}
              </button>
            )}
            {boardPackManifest && (
              <button
                onClick={() => void download(boardPackManifest)}
                disabled={downloadingId === boardPackManifest.id}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {downloadingId === boardPackManifest.id
                  ? "Preparing..."
                  : "Board package"}
              </button>
            )}
          </div>
        )}
      </div>

      {exportError && (
        <div className="border-b border-rose-100 bg-rose-50 px-6 py-2 text-xs text-rose-700">
          {exportError}
        </div>
      )}

      {/* Content */}
      <div className="flex-1 overflow-auto">
        <div className="grid gap-3 border-b border-slate-200 bg-slate-50 px-6 py-4 sm:grid-cols-2 xl:grid-cols-4">
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Status
            </p>
            <div className="mt-3 flex items-center gap-2">
              <span
                className={`rounded-full px-2.5 py-1 text-xs font-semibold ${statusTone(job.status)}`}
              >
                {formatStatusLabel(job.status)}
              </span>
              <span className="text-xs text-slate-500">
                {job.reportLang?.toUpperCase() || "ES"}
              </span>
            </div>
            <p className="mt-3 text-xs text-slate-500">
              Triggered by {job.triggeredBy || "payment"}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Reporting period
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {job.analysisPeriod || "Current cycle"}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              Created {formatDate(job.createdAt)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Processing timeline
            </p>
            <p className="mt-3 text-xs text-slate-600">
              Submitted: {formatDate(job.submittedAt)}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Started: {formatDate(job.processingStartedAt)}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Completed: {formatDate(job.completedAt)}
            </p>
          </div>

          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[11px] font-semibold uppercase tracking-[0.22em] text-slate-400">
              Exports
            </p>
            <p className="mt-3 text-sm font-semibold text-slate-900">
              {exportCount} ready artifact{exportCount === 1 ? "" : "s"}
            </p>
            <p className="mt-2 text-xs text-slate-600">
              Languages: {exportLanguages}
            </p>
            <p className="mt-2 text-xs text-slate-500">
              {job.exportSummary?.status === "ready"
                ? "Full manifest-backed delivery is available"
                : job.exportSummary?.status === "partial"
                  ? "Partial export package available — recovery still in progress"
                  : job.exportSummary?.status === "missing"
                    ? "No ready export package yet — manifest recovery required"
                    : "Using manifest/on-demand delivery"}
            </p>
          </div>
        </div>

        {job.status === "COMPLETE" && currentUrl ? (
          <iframe
            src={currentUrl}
            className="w-full h-full min-h-[800px]"
            title={`ALM Report — ${job.institutionName}`}
          />
        ) : isExportDegraded ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-lg">
              <AlertTriangle className="h-12 w-12 text-amber-400 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Export package still needs recovery
              </h2>
              <p className="text-sm text-gray-500 mb-3">
                CERNIQ completed the report job, but the full export package is
                not ready yet.
              </p>
              {job.exportSummary ? (
                <p className="text-xs text-slate-400 mb-4">
                  {job.exportSummary.readyCount} of{" "}
                  {job.exportSummary.totalCount} export artifacts are currently
                  ready.
                </p>
              ) : null}
              {readyManifests.length > 0 ? (
                <div className="mb-4 flex flex-wrap justify-center gap-2">
                  {readyManifests
                    .filter(
                      (manifest) =>
                        manifest.kind === "alm_report" ||
                        manifest.kind === "alco_pack",
                    )
                    .map((manifest) => (
                      <button
                        key={manifest.id}
                        onClick={() => void download(manifest)}
                        disabled={downloadingId === manifest.id}
                        className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
                      >
                        <Download className="h-4 w-4" />
                        {manifest.kind === "alm_report"
                          ? `Download report (${manifest.language.toUpperCase()})`
                          : `Board package (${manifest.language.toUpperCase()})`}
                      </button>
                    ))}
                </div>
              ) : null}
              <button
                onClick={() => void handleRefreshDeliveryState()}
                disabled={exportsLoading}
                className="inline-flex items-center gap-2 rounded-lg border border-slate-200 bg-white px-4 py-2 text-sm font-medium text-slate-700 hover:bg-slate-50 disabled:opacity-60"
              >
                <Download className="h-4 w-4" />
                {exportsLoading ? "Checking exports..." : "Retry export check"}
              </button>
              {exportError ? (
                <p className="mt-3 text-xs text-rose-600">{exportError}</p>
              ) : null}
              {!exportsLoading && manifests.length === 0 ? (
                <p className="mt-3 text-xs text-slate-500">
                  No export manifests are currently available for this completed
                  job.
                </p>
              ) : null}
            </div>
          </div>
        ) : isProcessing ? (
          <div className="p-6">
            <ReportProgressWS
              jobId={job.id}
              institutionName={job.institutionName}
              initialStatus={job.status}
              onComplete={handleRefreshDeliveryState}
            />
          </div>
        ) : job.status === "FAILED" ? (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-sm">
              <AlertTriangle className="h-12 w-12 text-red-300 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Generation Failed
              </h2>
              <p className="text-sm text-gray-500 mb-2">
                There was an issue generating this report. Our team has been
                notified.
              </p>
              {job.errorMessage && (
                <p className="text-xs text-red-500 bg-red-50 p-3 rounded-lg">
                  {job.errorMessage}
                </p>
              )}
            </div>
          </div>
        ) : (
          <div className="flex items-center justify-center h-full min-h-[400px]">
            <div className="text-center max-w-sm">
              <FileText className="h-12 w-12 text-gray-200 mx-auto mb-4" />
              <h2 className="text-lg font-semibold text-gray-900 mb-2">
                Awaiting Data
              </h2>
              <p className="text-sm text-gray-500 mb-4">
                Submit your balance sheet data to start generating this report.
              </p>
              <div className="mb-4 rounded-lg border border-slate-200 bg-white px-4 py-3 text-left text-xs text-slate-600">
                <p>Reporting period: {job.analysisPeriod || "Current cycle"}</p>
                <p className="mt-1">
                  Previous cycle: {job.previousJobId || "—"}
                </p>
              </div>
              <Link
                href={`/portal/submit?jobId=${job.id}`}
                className="inline-flex items-center gap-2 bg-[#1B3A6B] text-white px-4 py-2.5 rounded-lg text-sm font-medium hover:bg-[#15305a] transition"
              >
                Submit Data
              </Link>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
