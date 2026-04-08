'use client';

import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import {
  Upload,
  Download,
  FileText,
  CheckCircle,
  HelpCircle,
  ChevronDown,
  ChevronUp,
  ClipboardList,
  Sparkles,
  AlertTriangle,
  Eye,
} from 'lucide-react';
import {
  SkeletonLoader,
  EmptyState,
  ErrorBanner,
} from '@/components/ui/cerniq';
import { analytics, EVENTS } from '@/lib/analytics';
import { useTranslation } from '@/lib/i18n';
import ProgressTracker from '@/components/portal/ProgressTracker';
import ReportProgressWS from '@/components/portal/ReportProgressWS';
import DocumentExportButtons from '@/components/exports/DocumentExportButtons';
import {
  getBalanceSheetTemplateUrl,
  getPublicApiUrl,
} from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';
import {
  type PortalOverviewJob,
  type PortalValidationSummary,
  isPortalActionRequiredStatus,
  isPortalProcessingStatus,
} from '@/lib/portal-overview';
import { usePortalOverview } from '@/hooks/usePortalOverview';

interface SubmitResponse {
  valid: boolean;
  status: string;
  errors?: Array<{ row?: number | null; field?: string | null; message: string }>;
  warnings?: string[];
  itemsImported?: number;
  warningCount?: number;
  jobId?: string;
  institutionId?: string | null;
  institutionName?: string | null;
  nextHref?: string;
}

function FAQItem({
  questionEn,
  questionEs,
  answerEn,
  answerEs,
}: {
  questionEn: string;
  questionEs: string;
  answerEn: string;
  answerEs: string;
}) {
  const [open, setOpen] = useState(false);
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === 'en' ? en : es);

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="flex w-full items-start gap-2 py-3 text-left"
      >
        <HelpCircle className="mt-0.5 h-4 w-4 shrink-0 text-[#1ABFFF]" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">
            {t(questionEn, questionEs)}
          </p>
        </div>
        {open ? (
          <ChevronUp className="mt-0.5 h-4 w-4 text-slate-400" />
        ) : (
          <ChevronDown className="mt-0.5 h-4 w-4 text-slate-400" />
        )}
      </button>
      {open ? (
        <div className="pb-3 pl-6 text-sm text-slate-600">
          <p>{t(answerEn, answerEs)}</p>
        </div>
      ) : null}
    </div>
  );
}

function CSVPreview({ file }: { file: File }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === 'en' ? en : es);

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (event) => {
      const text = event.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter((line) => line.trim());
      if (lines.length === 0) return;
      const parsed = lines.map((line) =>
        line.split(',').map((cell) => cell.trim().replace(/^"|"$/g, '')),
      );
      setHeaders(parsed[0] || []);
      setRows(parsed.slice(1, 6));
    };
    reader.readAsText(file);
  }, [file]);

  if (headers.length === 0) return null;

  return (
    <div className="mt-4 overflow-hidden rounded-xl border border-slate-200">
      <div className="border-b border-slate-200 bg-slate-50 px-4 py-2">
        <p className="text-xs font-medium text-slate-500">
          {t('Preview (first 5 rows)', 'Vista previa (primeras 5 filas)')}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/60">
              {headers.map((header) => (
                <th
                  key={header}
                  className="whitespace-nowrap px-3 py-2 text-left font-semibold text-slate-500"
                >
                  {header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, rowIndex) => (
              <tr key={rowIndex} className="hover:bg-slate-50/50">
                {row.map((cell, cellIndex) => (
                  <td
                    key={`${rowIndex}-${cellIndex}`}
                    className="whitespace-nowrap px-3 py-2 text-slate-600"
                  >
                    {cell || '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 5 ? (
        <div className="border-t border-slate-200 bg-slate-50 px-4 py-1.5 text-[10px] text-slate-400">
          {t('... and more rows', '... y mas filas')}
        </div>
      ) : null}
    </div>
  );
}

function getCurrentQuarter(): string {
  const now = new Date();
  const quarter = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${quarter}-${now.getFullYear()}`;
}

const PERIOD_OPTIONS = (() => {
  const year = new Date().getFullYear();
  return [
    `Q1-${year}`,
    `Q2-${year}`,
    `Q3-${year}`,
    `Q4-${year}`,
    `Annual-${year}`,
  ];
})();

function trackerForState(state: string) {
  switch (state) {
    case 'needs_report':
      return { currentStep: 2, completedSteps: [1] };
    case 'processing':
      return { currentStep: 4, completedSteps: [1, 2, 3] };
    case 'report_ready':
      return { currentStep: 5, completedSteps: [1, 2, 3, 4, 5] };
    case 'needs_upload':
    case 'validation_failed':
    default:
      return { currentStep: 3, completedSteps: [1, 2] };
  }
}

function ValidationSummaryCard({
  summary,
  uploadErrors,
}: {
  summary: PortalValidationSummary | null;
  uploadErrors: SubmitResponse['errors'];
}) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === 'en' ? en : es);
  const errors =
    uploadErrors && uploadErrors.length > 0
      ? uploadErrors
      : summary?.errors || [];
  const warnings = summary?.warnings || [];

  if (errors.length === 0 && warnings.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 rounded-2xl border border-rose-200 bg-rose-50 p-4">
      <div className="flex items-start gap-3">
        <AlertTriangle className="mt-0.5 h-5 w-5 shrink-0 text-rose-600" />
        <div className="flex-1">
          <p className="text-sm font-semibold text-rose-700">
            {t('Validation needs attention', 'La validacion necesita atencion')}
          </p>
          <ul className="mt-2 space-y-1 text-xs leading-5 text-rose-700">
            {errors.slice(0, 4).map((error, index) => (
              <li key={`${error.message}-${index}`}>
                •{' '}
                {error.row && error.field
                  ? `row ${error.row}, ${error.field}: ${error.message}`
                  : error.message}
              </li>
            ))}
          </ul>
          {warnings.length > 0 ? (
            <p className="mt-3 text-xs text-amber-700">
              {t(
                `${warnings.length} warning(s) were also detected. You can still retry with a corrected file.`,
                `Tambien se detectaron ${warnings.length} advertencia(s). Puede reenviar con un archivo corregido.`,
              )}
            </p>
          ) : null}
        </div>
      </div>
    </div>
  );
}

function ProcessingCard({
  job,
  itemsImported,
  warningCount,
  onComplete,
}: {
  job: PortalOverviewJob;
  itemsImported?: number;
  warningCount?: number;
  onComplete: () => void;
}) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === 'en' ? en : es);

  return (
    <div className="space-y-4">
      <div className="rounded-2xl border border-[#1ABFFF]/20 bg-[#1ABFFF]/5 p-5">
        <div className="flex items-start gap-3">
          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#1ABFFF]/10">
            <Sparkles className="h-5 w-5 text-[#1ABFFF]" />
          </div>
          <div className="flex-1">
            <p className="text-sm font-semibold text-slate-900">
              {t(
                'Submission received. CERNIQ is processing your report now.',
                'Carga recibida. CERNIQ esta procesando su informe ahora.',
              )}
            </p>
            <p className="mt-1 text-sm text-slate-600">
              {job.institutionName}
            </p>
            <div className="mt-3 flex flex-wrap gap-3 text-xs text-slate-500">
              {typeof itemsImported === 'number' ? (
                <span>{t(`${itemsImported} items imported`, `${itemsImported} elementos importados`)}</span>
              ) : null}
              {typeof warningCount === 'number' ? (
                <span>{t(`${warningCount} warnings`, `${warningCount} advertencias`)}</span>
              ) : null}
              {job.analysisPeriod ? <span>{job.analysisPeriod}</span> : null}
            </div>
          </div>
        </div>
      </div>
      <ReportProgressWS
        jobId={job.id}
        institutionName={job.institutionName}
        initialStatus={job.status}
        onComplete={onComplete}
      />
    </div>
  );
}

function ReportReadyCard({ job }: { job: PortalOverviewJob }) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => (locale === 'en' ? en : es);

  return (
    <div className="rounded-2xl border border-[#18C87A]/20 bg-[#18C87A]/5 p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18C87A]/10">
          <CheckCircle className="h-5 w-5 text-[#18C87A]" />
        </div>
        <div className="flex-1">
          <p className="text-sm font-semibold text-slate-900">
            {t(
              'Your report is ready for review and export.',
              'Su informe esta listo para revisar y exportar.',
            )}
          </p>
          <p className="mt-1 text-sm text-slate-600">{job.institutionName}</p>
          <div className="mt-4 flex flex-wrap gap-3">
            <Link
              href={`/portal/reports/${job.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-5 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218]"
            >
              <Eye className="h-4 w-4" />
              {t('Open report', 'Abrir informe')}
            </Link>
            <DocumentExportButtons
              manifestPath={`/api/portal/jobs/${job.id}/exports`}
              kinds={['alm_report', 'alco_pack']}
            />
          </div>
        </div>
      </div>
    </div>
  );
}

export default function PortalSubmit() {
  const { locale } = useTranslation();
  const t = useCallback(
    (en: string, es: string) => (locale === 'en' ? en : es),
    [locale],
  );
  const searchParams = useSearchParams();
  const {
    overview,
    loading,
    error: fetchError,
    loadOverview,
  } = usePortalOverview();

  const [selectedJobId, setSelectedJobId] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysisPeriod, setAnalysisPeriod] = useState<string>(
    getCurrentQuarter(),
  );
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<SubmitResponse | null>(null);
  const [submittedState, setSubmittedState] = useState<SubmitResponse | null>(
    null,
  );
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const jobs = useMemo(() => overview?.jobs || [], [overview?.jobs]);
  const selectedJobFromQuery = searchParams.get('jobId');

  useEffect(() => {
    if (!overview) return;

    if (
      selectedJobFromQuery &&
      jobs.some((job) => job.id === selectedJobFromQuery)
    ) {
      setSelectedJobId(selectedJobFromQuery);
      return;
    }

    if (
      overview.latestActionableJob &&
      isPortalActionRequiredStatus(overview.latestActionableJob.status)
    ) {
      setSelectedJobId(overview.latestActionableJob.id);
      return;
    }

    if (!selectedJobId && overview.latestActionableJob) {
      setSelectedJobId(overview.latestActionableJob.id);
    }
  }, [jobs, overview, selectedJobFromQuery, selectedJobId]);

  const selectedJob =
    jobs.find((job) => job.id === selectedJobId) ||
    overview?.latestActionableJob ||
    null;

  useEffect(() => {
    if (selectedJob?.analysisPeriod) {
      setAnalysisPeriod(selectedJob.analysisPeriod);
    }
  }, [selectedJob?.analysisPeriod]);

  const displayJob =
    submittedState?.valid && submittedState.jobId
      ? {
          ...(selectedJob || overview?.latestActionableJob || {
            id: submittedState.jobId,
            institutionName: submittedState.institutionName || 'CERNIQ',
            status: submittedState.status,
            analysisPeriod,
            previousJobId: null,
            submittedAt: new Date().toISOString(),
            processingStartedAt: null,
            completedAt: null,
            createdAt: new Date().toISOString(),
            reportUrl: null,
            reportUrlEn: null,
            reportLang: 'es',
            errorMessage: null,
            userId: '',
            triggeredBy: 'portal_submit',
          }),
          status: submittedState.status,
          institutionName:
            submittedState.institutionName ||
            selectedJob?.institutionName ||
            'CERNIQ',
          analysisPeriod,
        }
      : selectedJob;

  const displayWorkflowState =
    submittedState?.valid && displayJob
      ? 'processing'
      : displayJob?.status === 'VALIDATION_FAILED'
        ? 'validation_failed'
        : displayJob?.status === 'AWAITING_DATA'
          ? 'needs_upload'
          : displayJob && isPortalProcessingStatus(displayJob.status)
            ? 'processing'
            : displayJob?.status === 'COMPLETE'
              ? 'report_ready'
              : overview?.workflowState || 'needs_report';

  const actionableJobs = jobs.filter((job) =>
    isPortalActionRequiredStatus(job.status),
  );
  const activeValidationSummary =
    result?.valid === false
      ? null
      : displayJob?.id === overview?.latestActionableJob?.id
        ? overview?.validationSummary || null
        : null;
  const tracker = trackerForState(displayWorkflowState);

  const validateFile = (candidate: File): string | null => {
    if (!candidate.name.endsWith('.csv')) {
      return t(
        'Only CSV files are accepted.',
        'Solo archivos CSV son aceptados.',
      );
    }
    if (candidate.size > 2 * 1024 * 1024) {
      return t('File exceeds 2MB limit.', 'El archivo excede 2MB.');
    }
    if (candidate.size === 0) {
      return t('File is empty.', 'El archivo esta vacio.');
    }
    return null;
  };

  const handleFileSelect = (candidate: File | null) => {
    setResult(null);
    if (!candidate) {
      setFile(null);
      return;
    }
    const validationError = validateFile(candidate);
    if (validationError) {
      setResult({
        valid: false,
        status: 'VALIDATION_ERROR',
        errors: [{ message: validationError }],
      });
      setFile(null);
      return;
    }
    setFile(candidate);
  };

  const handleUpload = async () => {
    if (!displayJob?.id || !file) return;

    setUploading(true);
    setResult(null);
    setSubmittedState(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (analysisPeriod) {
        formData.append('analysisPeriod', analysisPeriod);
      }

      const res = await fetch(
        getPublicApiUrl(`/api/portal/jobs/${displayJob.id}/submit`),
        {
          method: 'POST',
          credentials: 'include',
          body: formData,
        },
      );

      const payload = unwrapApiData<SubmitResponse>(
        await res.json().catch(() => ({})),
      );
      setResult(payload);

      if (payload.valid) {
        analytics.track(EVENTS.PORTAL_DATA_SUBMITTED, {
          jobId: displayJob.id,
          items: payload.itemsImported,
        });
        setSubmittedState(payload);
        setFile(null);
        void loadOverview();
      } else {
        analytics.track(EVENTS.PORTAL_DATA_VALIDATION_FAILED, {
          jobId: displayJob.id,
        });
      }
    } catch {
      setResult({
        valid: false,
        status: 'ERROR',
        errors: [
          {
            message: t(
              'Network error. Please try again.',
              'Error de conexion. Intente de nuevo.',
            ),
          },
        ],
      });
    } finally {
      setUploading(false);
    }
  };

  const handleDragOver = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(true);
  };

  const handleDrop = (event: React.DragEvent) => {
    event.preventDefault();
    setDragOver(false);
    handleFileSelect(event.dataTransfer.files?.[0] || null);
  };

  return (
    <div className="space-y-6">
      <section className="cerniq-shell p-6 sm:p-8">
        <div className="cerniq-data-wave" />
        <div className="relative z-10">
          <span className="cerniq-kicker mb-5">
            {t('Submit Data', 'Enviar Datos')}
          </span>
          <h1 className="font-display text-3xl text-slate-950 sm:text-5xl">
            {t(
              'Upload Your Balance-Sheet Data',
              'Cargue Sus Datos de Balance',
            )}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {t(
              'Move from onboarding into a report-ready workflow with one clean upload.',
              'Pase del onboarding a un flujo listo para informe con una sola carga limpia.',
            )}
          </p>
        </div>
      </section>

      <div className="cerniq-panel p-6">
        <ProgressTracker
          currentStep={tracker.currentStep}
          completedSteps={tracker.completedSteps}
        />
      </div>

      <div className="grid grid-cols-1 gap-6 lg:grid-cols-3">
        <div className="space-y-6 lg:col-span-2">
          <div className="cerniq-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">
                1
              </div>
              <div className="flex-1">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  {t('Download Template', 'Descargar Plantilla')}
                </h2>
                <p className="mb-3 text-sm text-slate-500">
                  {t(
                    'Use the official CERNIQ template so upload validation, period linking, and report generation all line up correctly.',
                    'Use la plantilla oficial de CERNIQ para que la validacion, el periodo y la generacion del informe queden alineados.',
                  )}
                </p>
                <a
                  href={getBalanceSheetTemplateUrl('cooperativa')}
                  className="cerniq-button-secondary px-4 py-2 text-sm"
                >
                  <Download className="h-4 w-4" />{' '}
                  {t('Download template', 'Descargar plantilla')}
                </a>
              </div>
            </div>
          </div>

          <div className="cerniq-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">
                2
              </div>
              <div className="flex-1">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  {displayWorkflowState === 'processing'
                    ? t('Processing Status', 'Estado del procesamiento')
                    : displayWorkflowState === 'report_ready'
                      ? t('Latest Delivered Report', 'Ultimo informe entregado')
                      : t('Select Report', 'Seleccionar Informe')}
                </h2>

                {fetchError ? (
                  <ErrorBanner error={fetchError} onRetry={loadOverview} />
                ) : loading ? (
                  <SkeletonLoader variant="card" count={2} />
                ) : displayWorkflowState === 'needs_report' ? (
                  <EmptyState
                    icon={ClipboardList}
                    title={t(
                      'No report cycle is currently open',
                      'No hay un ciclo de informe abierto',
                    )}
                    description={t(
                      'Your account is active, but there is no report cycle awaiting data yet. Open the portal workspace to review next steps.',
                      'Su cuenta esta activa, pero todavia no hay un ciclo de informe esperando datos. Abra el portal para revisar los siguientes pasos.',
                    )}
                    actionLabel={t(
                      overview?.nextAction?.labelEn || 'Open workspace',
                      overview?.nextAction?.labelEs || 'Abrir portal',
                    )}
                    onAction={() => {
                      if (typeof window !== 'undefined') {
                        window.location.href =
                          overview?.nextAction?.href || '/portal';
                      }
                    }}
                  />
                ) : displayWorkflowState === 'processing' && displayJob ? (
                  <ProcessingCard
                    job={displayJob}
                    itemsImported={submittedState?.itemsImported}
                    warningCount={submittedState?.warningCount}
                    onComplete={() => {
                      setSubmittedState(null);
                      void loadOverview();
                    }}
                  />
                ) : displayWorkflowState === 'report_ready' && displayJob ? (
                  <ReportReadyCard job={displayJob} />
                ) : (
                  <div className="space-y-3">
                    <p className="text-sm text-slate-500">
                      {t(
                        'Choose the report cycle you want to complete with this upload.',
                        'Elija el ciclo de informe que quiere completar con esta carga.',
                      )}
                    </p>
                    <div className="space-y-2">
                      {actionableJobs.map((job) => (
                        <button
                          key={job.id}
                          onClick={() => {
                            setSelectedJobId(job.id);
                            setResult(null);
                            setSubmittedState(null);
                          }}
                          className={`w-full rounded-lg border px-4 py-3 text-left text-sm transition ${
                            displayJob?.id === job.id
                              ? 'border-[#1ABFFF]/40 bg-[#1ABFFF]/5 text-[#1B3A6B]'
                              : 'border-slate-200 text-slate-700 hover:border-slate-300'
                          }`}
                        >
                          <span className="font-medium">
                            {job.institutionName}
                          </span>
                          {job.status === 'VALIDATION_FAILED' ? (
                            <span className="ml-2 text-xs text-rose-600">
                              {t(
                                'Validation failed — retry',
                                'Validacion fallida — reintentar',
                              )}
                            </span>
                          ) : null}
                          <span className="mt-0.5 block text-xs text-slate-400">
                            {job.status.replace(/_/g, ' ')} •{' '}
                            {new Date(job.createdAt).toLocaleDateString()}
                          </span>
                        </button>
                      ))}
                    </div>
                    {displayWorkflowState === 'validation_failed' ? (
                      <ValidationSummaryCard
                        summary={activeValidationSummary}
                        uploadErrors={result?.errors}
                      />
                    ) : null}
                  </div>
                )}
              </div>
            </div>
          </div>

          {(displayWorkflowState === 'needs_upload' ||
            displayWorkflowState === 'validation_failed') &&
          displayJob ? (
            <>
              <div className="cerniq-panel p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">
                    3
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-1 text-sm font-semibold text-slate-900">
                      {t('Select Period', 'Seleccionar Periodo')}
                    </h2>
                    <p className="mb-3 text-sm text-slate-500">
                      {t(
                        'Tag the upload to the right reporting period so CERNIQ can link trends across jobs and timelines.',
                        'Etiquete la carga al periodo correcto para que CERNIQ pueda enlazar tendencias y cronologias.',
                      )}
                    </p>
                    <select
                      value={analysisPeriod}
                      onChange={(event) => setAnalysisPeriod(event.target.value)}
                      className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#1ABFFF] focus:outline-none focus:ring-1 focus:ring-[#1ABFFF]/30"
                    >
                      {PERIOD_OPTIONS.map((period) => (
                        <option key={period} value={period}>
                          {period}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>
              </div>

              <div className="cerniq-panel p-6">
                <div className="flex items-start gap-4">
                  <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">
                    4
                  </div>
                  <div className="flex-1">
                    <h2 className="mb-1 text-sm font-semibold text-slate-900">
                      {t('Upload Your Data', 'Cargar Sus Datos')}
                    </h2>
                    <p className="mb-3 text-sm text-slate-500">
                      {t(
                        'Upload the completed CSV file. Max file size: 2MB.',
                        'Cargue el archivo CSV completado. Tamano maximo: 2MB.',
                      )}
                    </p>
                    <p className="mb-3 text-xs text-slate-400">
                      {displayJob.institutionName} • {analysisPeriod}
                    </p>

                    <input
                      ref={fileRef}
                      type="file"
                      accept=".csv"
                      className="hidden"
                      onChange={(event) =>
                        handleFileSelect(event.target.files?.[0] || null)
                      }
                    />

                    <div
                      onClick={() => fileRef.current?.click()}
                      onDragOver={handleDragOver}
                      onDragLeave={() => setDragOver(false)}
                      onDrop={handleDrop}
                      className={`cursor-pointer rounded-xl border-2 border-dashed p-8 text-center transition-all duration-200 ${
                        dragOver
                          ? 'border-[#1ABFFF] bg-[#1ABFFF]/5 scale-[1.01]'
                          : file
                            ? 'border-[#18C87A]/40 bg-[#18C87A]/5'
                            : 'border-[#1B3A6B]/20 hover:border-[#1ABFFF]/40 hover:bg-[#1ABFFF]/[0.02]'
                      }`}
                    >
                      {file ? (
                        <div className="flex items-center justify-center gap-3">
                          <div className="flex h-10 w-10 items-center justify-center rounded-full bg-[#18C87A]/10">
                            <FileText className="h-5 w-5 text-[#18C87A]" />
                          </div>
                          <div className="text-left">
                            <p className="text-sm font-medium text-slate-700">
                              {file.name}
                            </p>
                            <p className="text-xs text-slate-400">
                              {(file.size / 1024).toFixed(1)} KB
                            </p>
                          </div>
                          <button
                            onClick={(event) => {
                              event.stopPropagation();
                              setFile(null);
                              setResult(null);
                            }}
                            className="ml-3 text-xs text-slate-400 underline hover:text-rose-500"
                          >
                            {t('Change', 'Cambiar')}
                          </button>
                        </div>
                      ) : (
                        <div>
                          <Upload className="mx-auto mb-3 h-10 w-10 text-[#1B3A6B]/20" />
                          <p className="text-sm font-medium text-slate-600">
                            {t(
                              'Drag and drop your CSV file here or click to select',
                              'Arrastre su archivo CSV aqui o haga clic para seleccionar',
                            )}
                          </p>
                        </div>
                      )}
                    </div>

                    {file && !result ? <CSVPreview file={file} /> : null}

                    {result?.valid === false ? (
                      result.status === 'ERROR' ? (
                        <div className="mt-4">
                          <ErrorBanner
                            error={t(
                              'Network error. Please try again.',
                              'Error de conexion. Intente de nuevo.',
                            )}
                            onRetry={handleUpload}
                            onDismiss={() => setResult(null)}
                          />
                        </div>
                      ) : (
                        <div className="mt-4">
                          <ErrorBanner
                            error={t(
                              `Validation failed${result.errors?.length ? `: ${result.errors
                                .map((error) => error.message)
                                .join('; ')}` : ''}`,
                              `Validacion fallida${result.errors?.length ? `: ${result.errors
                                .map((error) => error.message)
                                .join('; ')}` : ''}`,
                            )}
                            onRetry={() => {
                              setResult(null);
                              setFile(null);
                            }}
                            onDismiss={() => setResult(null)}
                          />
                        </div>
                      )
                    ) : null}

                    <button
                      onClick={handleUpload}
                      disabled={!displayJob.id || !file || uploading}
                      className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg transition-colors hover:bg-[#d19218] disabled:cursor-not-allowed disabled:opacity-50"
                    >
                      {uploading ? (
                        <>
                          <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                          {t(
                            'Uploading & Validating...',
                            'Cargando y validando...',
                          )}
                        </>
                      ) : (
                        <>
                          <Upload className="h-4 w-4" />
                          {t('Submit Data', 'Enviar Datos')}
                        </>
                      )}
                    </button>
                  </div>
                </div>
              </div>
            </>
          ) : null}
        </div>

        <div className="lg:col-span-1">
          <div className="sticky top-6 cerniq-panel p-5">
            <div className="mb-4 flex items-center gap-2">
              <HelpCircle className="h-5 w-5 text-[#1ABFFF]" />
              <h3 className="text-sm font-semibold text-slate-900">
                {t('Need help?', 'Necesita ayuda?')}
              </h3>
            </div>

            <FAQItem
              questionEn="What format should the CSV file be?"
              questionEs="Que formato debe tener el archivo CSV?"
              answerEn="Use the CERNIQ balance-sheet schema exactly: category, subcategory, name, balance, rate, duration, rateType, repriceDate, maturityDate."
              answerEs="Use exactamente el esquema de CERNIQ: category, subcategory, name, balance, rate, duration, rateType, repriceDate, maturityDate."
            />

            <FAQItem
              questionEn="What data do I need to include?"
              questionEs="Que datos necesito incluir?"
              answerEn="Include the institution's asset and liability rows with rates, durations, and reprice or maturity dates wherever they apply."
              answerEs="Incluya las filas de activos y pasivos de la institucion con tasas, duraciones y fechas de reprecio o vencimiento cuando correspondan."
            />

            <FAQItem
              questionEn="What happens after I submit?"
              questionEs="Que pasa despues de enviar?"
              answerEn="CERNIQ validates the file, imports the balance sheet, links the reporting period, and moves the report into processing. The portal will update as soon as the report is ready."
              answerEs="CERNIQ valida el archivo, importa el balance, enlaza el periodo y mueve el informe a procesamiento. El portal se actualizara cuando el informe este listo."
            />

            <div className="mt-4 border-t border-slate-100 pt-4">
              <p className="text-xs text-slate-500">
                {t('Issues?', 'Problemas?')}
              </p>
              <a
                href="mailto:soporte@cerniq.io"
                className="mt-1 inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline"
              >
                {t('Contact support', 'Contactar soporte')}
              </a>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
