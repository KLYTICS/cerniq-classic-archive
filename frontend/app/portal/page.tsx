"use client";

import { useEffect, useCallback, Suspense } from "react";
import Link from "next/link";
import { useSearchParams } from "next/navigation";
import { usePortal } from "./layout";
import { useTranslation } from "@/lib/i18n";
import {
  FileText,
  Upload,
  Download,
  Eye,
  ArrowRight,
  Lock,
  CheckCircle,
  Calendar,
  ExternalLink,
  AlertTriangle,
} from "lucide-react";
import {
  SkeletonLoader,
  EmptyState,
  ErrorBanner,
} from "@/components/ui/cerniq";
import { useFeature } from "@/lib/features";
import type { SubscriptionTier } from "@/lib/features";
import ProgressTracker from "@/components/portal/ProgressTracker";
import WorkspaceCommandCenter from "@/components/portal/WorkspaceCommandCenter";
import ReportProgressWS from "@/components/portal/ReportProgressWS";
import DocumentExportButtons from "@/components/exports/DocumentExportButtons";
import DemoSeatBanner from "@/components/portal/DemoSeatBanner";
import { rememberPortalUser } from "@/lib/subscription";
import { getBalanceSheetTemplateUrl } from "@/lib/api-base";
import { isActiveDemo } from "@/lib/access";
import {
  type PortalNextAction,
  type PortalOverviewJob,
  isPortalExportDegraded,
  isPortalProcessingStatus,
  isPortalReportReady,
} from "@/lib/portal-overview";
import { usePortalOverview } from "@/hooks/usePortalOverview";

/* ---------- helper: map job status to progress step ---------- */
function statusToStep(status: string | undefined): number {
  if (!status) return 1;
  switch (status) {
    case "AWAITING_DATA":
      return 2;
    case "VALIDATING":
    case "QUEUED":
    case "PROCESSING":
    case "GENERATING_PDF":
    case "UPLOADING":
      return 4;
    case "COMPLETE":
      return 5;
    default:
      return 1;
  }
}

function completedStepsForStatus(status: string | undefined): number[] {
  const step = statusToStep(status);
  const completed: number[] = [];
  for (let i = 1; i < step; i++) completed.push(i);
  if (step === 5) completed.push(5);
  return completed;
}

/* ---------- Welcome Banner (shown when ?welcome=1) ---------- */
function WelcomeBanner({
  latestJob,
  nextAction,
}: {
  latestJob?: PortalOverviewJob | null;
  nextAction?: PortalNextAction | null;
}) {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get("welcome") === "1";
  const { user } = usePortal();
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === "en" ? en : es);

  useEffect(() => {
    if (isWelcome) {
      rememberPortalUser();
    }
  }, [isWelcome]);

  if (!isWelcome) return null;

  const institutionName = latestJob?.institutionName || user?.name || "";
  const actionHref =
    nextAction?.href ||
    (latestJob ? `/portal/submit?jobId=${latestJob.id}` : "/portal/submit");
  const actionLabel =
    latestJob?.status === "COMPLETE"
      ? t("View report", "Ver informe")
      : latestJob?.status === "VALIDATION_FAILED"
        ? t("Fix validation", "Corregir validacion")
        : latestJob?.status === "AWAITING_DATA"
          ? t("Upload data", "Cargar datos")
          : nextAction
            ? t(nextAction.labelEn, nextAction.labelEs)
            : t("Set up institution", "Configurar institucion");

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1B3A6B] p-8 sm:p-10 mb-6">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1B3A6B] via-[#1B3A6B] to-[#0e2340] opacity-100" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#1ABFFF]/5 rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-6 w-6 text-[#18C87A]" />
          <span className="text-sm font-medium text-[#18C87A]">
            {t("Payment confirmed", "Pago confirmado")}
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight">
          {t(
            `Welcome to CERNIQ${institutionName ? `, ${institutionName}` : ""}!`,
            `Bienvenido a CERNIQ${institutionName ? `, ${institutionName}` : ""}!`,
          )}
        </h1>

        <p className="mt-4 text-sm sm:text-base text-white/60 max-w-xl">
          {t(
            "Your ALM analysis starts here.",
            "Su analisis ALM comienza aqui.",
          )}
        </p>

        <div className="mt-6">
          <Link
            href={actionHref}
            className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
          >
            {latestJob?.status === "COMPLETE" ? (
              <Eye className="h-4 w-4" />
            ) : (
              <Upload className="h-4 w-4" />
            )}
            {actionLabel}
            <ArrowRight className="h-4 w-4" />
          </Link>
        </div>
      </div>
    </div>
  );
}

/* ---------- ALCO Pack Button ---------- */
function AlcoPackButton({
  jobId,
  compact,
}: {
  jobId: string;
  compact?: boolean;
}) {
  return (
    <DocumentExportButtons
      manifestPath={`/api/portal/jobs/${jobId}/exports`}
      kinds={["alco_pack"]}
      compact={compact}
    />
  );
}

/* ---------- Report Ready State ---------- */
function ReportReadyState({ job }: { job: PortalOverviewJob }) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === "en" ? en : es);

  return (
    <div className="rounded-2xl border-t-4 border-t-[#18C87A] bg-white shadow-sm border border-slate-200/80 p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#18C87A]/10">
          <CheckCircle className="h-6 w-6 text-[#18C87A]" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">
            {t("Your ALM Report is Ready", "Su Informe ALM esta Listo")}
          </h2>
          <p className="mt-3 text-sm text-slate-600">
            {t(
              `The report for ${job.institutionName} has been generated successfully.`,
              `El informe para ${job.institutionName} ha sido generado exitosamente.`,
            )}
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/portal/reports/${job.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              <Eye className="h-4 w-4" />
              {t("View report", "Ver informe")}
            </Link>
            <DocumentExportButtons
              manifestPath={`/api/portal/jobs/${job.id}/exports`}
              kinds={["alm_report", "alco_pack"]}
            />
          </div>

          {/* Schedule review */}
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-[#1ABFFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {t(
                    "Want to review the report together?",
                    "Quiere revisar el informe juntos?",
                  )}
                </p>
                <a
                  href="https://calendly.com/erwin-klytics/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline"
                >
                  {t("Schedule 30 min with Erwin", "Agende 30 min con Erwin")}
                  <ExternalLink className="h-3 w-3" />
                </a>
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}

function ExportDegradedState({ job }: { job: PortalOverviewJob }) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === "en" ? en : es);
  const exportSummary = job.exportSummary;
  const statusMessage =
    exportSummary?.status === "missing"
      ? t(
          "The report job completed, but CERNIQ has not recovered a ready export package yet.",
          "El trabajo del informe se completo, pero CERNIQ todavia no ha recuperado un paquete de exportacion listo.",
        )
      : t(
          "The report finished, but part of the export package is still unavailable.",
          "El informe termino, pero parte del paquete de exportacion sigue sin estar disponible.",
        );

  return (
    <div className="rounded-2xl border-t-4 border-t-[#E8A020] bg-white shadow-sm border border-slate-200/80 p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#E8A020]/10">
          <AlertTriangle className="h-6 w-6 text-[#E8A020]" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">
            {t(
              "Export package needs attention",
              "La exportacion necesita atencion",
            )}
          </h2>
          <p className="mt-3 text-sm text-slate-600">{statusMessage}</p>
          {exportSummary ? (
            <p className="mt-2 text-xs text-slate-500">
              {t(
                `${exportSummary.readyCount} of ${exportSummary.totalCount} export artifacts are ready.`,
                `${exportSummary.readyCount} de ${exportSummary.totalCount} artefactos de exportacion estan listos.`,
              )}
            </p>
          ) : null}

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/portal/reports/${job.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              <Eye className="h-4 w-4" />
              {t("Inspect delivery state", "Inspeccionar entrega")}
            </Link>
            {job.exportSummary?.readyCount ? (
              <DocumentExportButtons
                manifestPath={`/api/portal/jobs/${job.id}/exports`}
                kinds={["alm_report", "alco_pack"]}
              />
            ) : null}
          </div>
        </div>
      </div>
    </div>
  );
}

function WorkflowActionCard({
  workflowState,
  nextAction,
  validationSummary,
  job,
}: {
  workflowState: string;
  nextAction: PortalNextAction;
  validationSummary: {
    warningCount: number;
    errorCount: number;
    errors: Array<{ message: string }>;
  } | null;
  job: PortalOverviewJob | null;
}) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === "en" ? en : es);

  const eyebrow =
    workflowState === "validation_failed"
      ? t("Fix and resubmit", "Corregir y reenviar")
      : workflowState === "needs_upload"
        ? t("Action required", "Accion requerida")
        : workflowState === "processing"
          ? t("Pipeline active", "Tuberia activa")
          : workflowState === "export_degraded"
            ? t("Delivery attention", "Atencion de entrega")
            : t("Workspace status", "Estado del portal");

  const headline =
    workflowState === "validation_failed"
      ? t(
          "This report needs corrected data before CERNIQ can continue.",
          "Este informe necesita datos corregidos antes de continuar.",
        )
      : workflowState === "needs_upload"
        ? t(
            "Your next report cycle is ready for upload.",
            "Su proximo ciclo de informe esta listo para cargar.",
          )
        : workflowState === "processing"
          ? t(
              "Submission received. CERNIQ is validating and generating the report now.",
              "Carga recibida. CERNIQ esta validando y generando el informe ahora.",
            )
          : workflowState === "export_degraded"
            ? t(
                "The job is complete, but CERNIQ still needs to recover the full export package.",
                "El trabajo esta completo, pero CERNIQ todavia necesita recuperar el paquete completo de exportacion.",
              )
            : t(
                "Open the next step for this workspace.",
                "Abra el siguiente paso para este portal.",
              );

  return (
    <div className="cerniq-panel p-6">
      <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
        <div className="max-w-3xl">
          <p className="text-[11px] font-semibold uppercase tracking-[0.24em] text-slate-400">
            {eyebrow}
          </p>
          <h2 className="mt-2 font-display text-2xl text-slate-950">
            {headline}
          </h2>
          <p className="mt-3 text-sm leading-6 text-slate-600">
            {t(nextAction.explanationEn, nextAction.explanationEs)}
          </p>
          {job ? (
            <p className="mt-3 text-xs font-medium text-slate-500">
              {job.institutionName} • {job.status.replace(/_/g, " ")}
            </p>
          ) : null}
          {workflowState === "validation_failed" && validationSummary ? (
            <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
              <p className="text-sm font-semibold text-rose-700">
                {t(
                  `${validationSummary.errorCount} validation issues found`,
                  `${validationSummary.errorCount} problemas de validacion encontrados`,
                )}
              </p>
              <ul className="mt-2 space-y-1 text-xs text-rose-700">
                {validationSummary.errors.slice(0, 3).map((error, index) => (
                  <li key={`${error.message}-${index}`}>• {error.message}</li>
                ))}
              </ul>
            </div>
          ) : null}
        </div>
        <div className="flex shrink-0 flex-col gap-3">
          <Link
            href={nextAction.href}
            className="inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
          >
            {t(nextAction.labelEn, nextAction.labelEs)}
            <ArrowRight className="h-4 w-4" />
          </Link>
          {workflowState === "needs_upload" ? (
            <a
              href={getBalanceSheetTemplateUrl("cooperativa")}
              className="inline-flex items-center justify-center gap-2 rounded-xl border border-slate-200 bg-white px-5 py-3 text-sm font-semibold text-slate-700 hover:bg-slate-50"
            >
              <Download className="h-4 w-4" />
              {t("Download template", "Descargar plantilla")}
            </a>
          ) : null}
        </div>
      </div>
    </div>
  );
}

/* ---------- Status Badge ---------- */
function StatusBadge({ status }: { status: string }) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === "en" ? en : es);

  let bg: string;
  let text: string;
  let label: string;
  switch (status) {
    case "COMPLETE":
      bg = "bg-[#18C87A]/10";
      text = "text-[#18C87A]";
      label = t("Complete", "Completado");
      break;
    case "PROCESSING":
    case "GENERATING_PDF":
    case "UPLOADING":
      bg = "bg-[#1ABFFF]/10";
      text = "text-[#1ABFFF]";
      label = t("Processing", "Procesando");
      break;
    case "QUEUED":
    case "VALIDATING":
      bg = "bg-[#E8A020]/10";
      text = "text-[#E8A020]";
      label = t("Queued", "En cola");
      break;
    case "AWAITING_DATA":
      bg = "bg-slate-100";
      text = "text-slate-500";
      label = t("Awaiting data", "Esperando datos");
      break;
    case "FAILED":
    case "VALIDATION_FAILED":
      bg = "bg-rose-50";
      text = "text-rose-600";
      label = t("Failed", "Error");
      break;
    default:
      bg = "bg-slate-100";
      text = "text-slate-500";
      label = status;
  }
  return (
    <span
      className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${bg} ${text}`}
    >
      {label}
    </span>
  );
}

/* ---------- Main Page ---------- */
export default function PortalHome() {
  const { user, subscription, access } = usePortal();
  const { locale } = useTranslation();
  const t = useCallback(
    (en: string, es: string) => (locale === "en" ? en : es),
    [locale],
  );
  const {
    overview,
    loading,
    error: fetchError,
    loadOverview,
  } = usePortalOverview();

  const tier = (subscription?.tier || "free") as SubscriptionTier;
  const trendFeature = useFeature(tier, "trendCharts");
  const isDemoSeat = isActiveDemo(access) || tier === "demo";
  const jobs = overview?.jobs || [];
  const latestJob = overview?.latestActionableJob || jobs[0] || null;
  const completedJobs = jobs.filter((job) => job.status === "COMPLETE");
  const currentStep = statusToStep(latestJob?.status);
  const completed = completedStepsForStatus(latestJob?.status);

  const isProcessing =
    overview?.workflowState === "processing" &&
    isPortalProcessingStatus(latestJob?.status);
  const isComplete =
    overview?.workflowState === "report_ready" &&
    isPortalReportReady(latestJob);
  const isExportDegraded =
    overview?.workflowState === "export_degraded" &&
    isPortalExportDegraded(latestJob);

  // The "demo report job" is the one tied to the demo seat. It is normally
  // the latest job, but a demo prospect could (eventually) have refined it
  // with a real upload — in which case we still want to surface the demo
  // provenance until they fully commit.
  const demoContext = overview?.demoSeat || null;
  const demoJob = demoContext?.seat?.reportJobId
    ? jobs.find((j) => j.id === demoContext.seat?.reportJobId) || null
    : null;
  const demoIsProcessing = demoJob
    ? isPortalProcessingStatus(demoJob.status)
    : false;

  return (
    <div className="space-y-6">
      <h1 className="sr-only">
        {t(
          `Welcome back${user?.name ? `, ${user.name}` : ""}`,
          `Bienvenido${user?.name ? `, ${user.name}` : ""}`,
        )}
      </h1>

      {/* Welcome banner (only when ?welcome=1) */}
      <Suspense fallback={null}>
        <WelcomeBanner
          latestJob={latestJob}
          nextAction={overview?.nextAction || null}
        />
      </Suspense>

      {/* Demo seat banner — only for demo-tier users (provisioned from prospect) */}
      {isDemoSeat && (
        <DemoSeatBanner
          institutionName={
            demoContext?.seat?.institutionName ||
            latestJob?.institutionName ||
            null
          }
          publicDataSource={demoContext?.seat?.publicDataSource || null}
          daysRemaining={
            demoContext?.daysRemaining ?? access?.daysRemaining ?? null
          }
          expiresAt={
            demoContext?.expiresAt ||
            demoContext?.seat?.expiresAt ||
            access?.effectivePeriodEnd ||
            null
          }
          reportJobId={demoContext?.seat?.reportJobId || latestJob?.id || null}
          isProcessing={demoIsProcessing}
        />
      )}

      <WorkspaceCommandCenter
        userName={user?.name}
        tier={tier}
        jobs={jobs.map((job) => ({ id: job.id, status: job.status }))}
        counts={overview?.counts}
        workflowState={overview?.workflowState}
      />

      {overview?.nextAction ? (
        <WorkflowActionCard
          workflowState={overview.workflowState}
          nextAction={overview.nextAction}
          validationSummary={overview.validationSummary}
          job={latestJob}
        />
      ) : null}

      {/* Progress Tracker */}
      <div className="cerniq-panel p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          {t("Progress", "Progreso")}
        </h2>
        <ProgressTracker currentStep={currentStep} completedSteps={completed} />
      </div>

      {/* Processing State -- real-time WebSocket progress (aria-live for dynamic updates) */}
      {isProcessing && latestJob && (
        <ReportProgressWS
          jobId={latestJob.id}
          institutionName={latestJob.institutionName}
          initialStatus={latestJob.status}
          onComplete={loadOverview}
        />
      )}

      {/* Report Ready State -- celebration card */}
      {isComplete && latestJob && <ReportReadyState job={latestJob} />}

      {isExportDegraded && latestJob && <ExportDegradedState job={latestJob} />}

      {/* Next Step -- only show for non-processing, non-complete states.
          Demo seats hide this entirely because the DemoSeatBanner already
          owns the primary CTA (open report or refine with real numbers). */}
      {!isProcessing && !isComplete && !isExportDegraded && !isDemoSeat && (
        <div className="cerniq-panel p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            {t("Next step", "Siguiente paso")}
          </h2>

          {!latestJob && (
            <div>
              <p className="mb-4 text-slate-700">
                {t(
                  "Get started by submitting your balance sheet data.",
                  "Comience enviando sus datos de balance.",
                )}
              </p>
              <div className="flex gap-3">
                <Link
                  href="/portal/submit"
                  className="cerniq-button-primary px-4 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" />{" "}
                  {t("Upload data", "Cargar datos")}
                </Link>
              </div>
            </div>
          )}

          {latestJob?.status === "AWAITING_DATA" && (
            <div>
              <p className="mb-4 text-slate-700">
                {t(
                  `Submit your balance sheet to generate the report for ${latestJob.institutionName}.`,
                  `Envie su balance para generar el informe de ${latestJob.institutionName}.`,
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={getBalanceSheetTemplateUrl("cooperativa")}
                  className="cerniq-button-secondary px-4 py-2.5 text-sm"
                >
                  <Download className="h-4 w-4" />{" "}
                  {t("Download template", "Descargar plantilla")}
                </a>
                <Link
                  href="/portal/submit"
                  className="cerniq-button-primary px-4 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" />{" "}
                  {t("Upload data", "Cargar datos")}
                </Link>
              </div>
            </div>
          )}

          {latestJob?.status === "FAILED" && (
            <div>
              <p className="mb-4 text-rose-700">
                {t(
                  "There was an issue generating your report. Our team has been notified.",
                  "Hubo un problema generando su informe. Nuestro equipo ha sido notificado.",
                )}
              </p>
            </div>
          )}
        </div>
      )}

      {/* Trend Charts gate */}
      {!trendFeature.enabled && completedJobs.length > 0 && (
        <div className="cerniq-panel relative overflow-hidden p-6">
          <div className="absolute inset-0 bg-white/80 backdrop-blur-sm flex items-center justify-center z-10">
            <div className="text-center p-6 max-w-xs">
              <Lock className="mx-auto mb-3 h-8 w-8 text-[#E8A020]" />
              <p className="mb-2 text-sm font-medium text-slate-950">
                {trendFeature.upgradePrompt}
              </p>
              <Link
                href="/portal/billing"
                className="text-xs text-[#E8A020] hover:underline"
              >
                {t("Upgrade plan", "Mejorar plan")}{" "}
                <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("Quarterly trends", "Tendencias trimestrales")}
          </h2>
          <div className="h-48 rounded-lg bg-slate-100" />
        </div>
      )}

      {/* Error Banner */}
      {fetchError && (
        <ErrorBanner
          titleEs={locale === "es" ? fetchError : undefined}
          error={fetchError}
          onRetry={loadOverview}
        />
      )}

      {/* Report History */}
      <div className="cerniq-table-shell overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t("Report history", "Historial de informes")}
          </h2>
        </div>
        {loading ? (
          <div className="p-6">
            <SkeletonLoader variant="table" count={1} />
          </div>
        ) : jobs.length === 0 && !fetchError ? (
          <div className="p-6">
            <EmptyState
              icon={FileText}
              title={t("No reports yet", "No hay informes todavia")}
              description={t(
                "Submit your balance sheet data to generate your first ALM report.",
                "Envie sus datos de balance para generar su primer informe ALM.",
              )}
              actionLabel={t("Upload data", "Cargar datos")}
              onAction={() => {
                if (typeof window !== "undefined") {
                  window.location.href =
                    overview?.nextAction?.href || "/portal/submit";
                }
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table
              className="w-full text-sm"
              aria-label={t("Report history", "Historial de informes")}
            >
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {t("Institution", "Institucion")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {t("Status", "Estado")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {t("Date", "Fecha")}
                  </th>
                  <th
                    scope="col"
                    className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500"
                  >
                    {t("Actions", "Acciones")}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map((job) => (
                  <tr
                    key={job.id}
                    className="hover:bg-slate-50/50 transition-colors"
                  >
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">
                        {job.institutionName}
                      </p>
                    </td>
                    <td className="px-6 py-4">
                      <StatusBadge status={job.status} />
                    </td>
                    <td className="px-6 py-4 text-slate-500">
                      {job.completedAt
                        ? new Date(job.completedAt).toLocaleDateString()
                        : new Date(job.createdAt).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-right">
                      {job.status === "COMPLETE" ? (
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/portal/reports/${job.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline"
                          >
                            <Eye className="h-3 w-3" />
                            {t("View", "Ver")}
                          </Link>
                          <AlcoPackButton jobId={job.id} compact />
                        </div>
                      ) : job.status === "AWAITING_DATA" ||
                        job.status === "VALIDATION_FAILED" ? (
                        <Link
                          href={`/portal/submit?jobId=${job.id}`}
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#E8A020] hover:underline"
                        >
                          <Upload className="h-3 w-3" />
                          {t("Upload", "Cargar")}
                        </Link>
                      ) : (
                        <span className="text-xs text-slate-400">--</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
