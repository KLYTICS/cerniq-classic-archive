'use client';

import { useState, useEffect, useRef, useCallback } from 'react';
import Link from 'next/link';
import { Upload, Download, FileText, CheckCircle, ArrowRight, HelpCircle, ChevronDown, ChevronUp, ClipboardList } from 'lucide-react';
import { SkeletonLoader, EmptyState, ErrorBanner } from '@/components/ui/cerniq';
import { analytics, EVENTS } from '@/lib/analytics';
import { useTranslation } from '@/lib/i18n';
import ProgressTracker from '@/components/portal/ProgressTracker';
import { getPublicApiUrl } from '@/lib/api-base';
import { unwrapApiData } from '@/lib/api-response';

interface ReportJob {
  id: string;
  institutionName: string;
  status: string;
  createdAt: string;
}

/* ---------- FAQ Item ---------- */
function FAQItem({ questionEn, questionEs, answerEn, answerEs }: {
  questionEn: string;
  questionEs: string;
  answerEn: string;
  answerEs: string;
}) {
  const [open, setOpen] = useState(false);
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  return (
    <div className="border-b border-slate-100 last:border-b-0">
      <button
        onClick={() => setOpen(!open)}
        className="w-full flex items-start gap-2 py-3 text-left"
      >
        <HelpCircle className="h-4 w-4 text-[#1ABFFF] mt-0.5 shrink-0" />
        <div className="flex-1">
          <p className="text-sm font-medium text-slate-700">{t(questionEn, questionEs)}</p>
        </div>
        {open ? <ChevronUp className="h-4 w-4 text-slate-400 mt-0.5" /> : <ChevronDown className="h-4 w-4 text-slate-400 mt-0.5" />}
      </button>
      {open && (
        <div className="pb-3 pl-6 text-sm text-slate-600">
          <p>{t(answerEn, answerEs)}</p>
        </div>
      )}
    </div>
  );
}

/* ---------- CSV Preview Table ---------- */
function CSVPreview({ file }: { file: File }) {
  const [rows, setRows] = useState<string[][]>([]);
  const [headers, setHeaders] = useState<string[]>([]);
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  useEffect(() => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const text = e.target?.result as string;
      if (!text) return;
      const lines = text.split('\n').filter(l => l.trim());
      if (lines.length === 0) return;
      const parsed = lines.map(line =>
        line.split(',').map(cell => cell.trim().replace(/^"|"$/g, ''))
      );
      setHeaders(parsed[0] || []);
      setRows(parsed.slice(1, 6)); // first 5 data rows
    };
    reader.readAsText(file);
  }, [file]);

  if (headers.length === 0) return null;

  return (
    <div className="mt-4 rounded-xl border border-slate-200 overflow-hidden">
      <div className="px-4 py-2 bg-slate-50 border-b border-slate-200">
        <p className="text-xs font-medium text-slate-500">
          {t('Preview (first 5 rows)', 'Vista previa (primeras 5 filas)')}
        </p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead>
            <tr className="bg-slate-50/60">
              {headers.map((h, i) => (
                <th key={i} className="px-3 py-2 text-left font-semibold text-slate-500 whitespace-nowrap">
                  {h}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((row, ri) => (
              <tr key={ri} className="hover:bg-slate-50/50">
                {row.map((cell, ci) => (
                  <td key={ci} className="px-3 py-2 text-slate-600 whitespace-nowrap">
                    {cell || '--'}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {rows.length === 5 && (
        <div className="px-4 py-1.5 bg-slate-50 border-t border-slate-200 text-[10px] text-slate-400">
          {t('... and more rows', '... y mas filas')}
        </div>
      )}
    </div>
  );
}

/* ---------- Period options ---------- */
function getCurrentQuarter(): string {
  const now = new Date();
  const q = Math.ceil((now.getMonth() + 1) / 3);
  return `Q${q}-${now.getFullYear()}`;
}

const PERIOD_OPTIONS = (() => {
  const now = new Date();
  const year = now.getFullYear();
  return [
    `Q1-${year}`, `Q2-${year}`, `Q3-${year}`, `Q4-${year}`,
    `Annual-${year}`,
  ];
})();

/* ---------- Main Submit Page ---------- */
export default function PortalSubmit() {
  const { locale } = useTranslation();
  const t = useCallback((en: string, es: string) => locale === 'en' ? en : es, [locale]);

  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [selectedJob, setSelectedJob] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analysisPeriod, setAnalysisPeriod] = useState<string>(getCurrentQuarter());
  const [uploading, setUploading] = useState(false);
  const [result, setResult] = useState<{ valid: boolean; status: string; errors?: string[]; itemsImported?: number } | null>(null);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(getPublicApiUrl('/api/portal/jobs'), { credentials: 'include' });
      if (res.ok) {
        const allJobs = unwrapApiData<ReportJob[]>(await res.json().catch(() => []));
        const awaitingJobs = allJobs.filter(j => j.status === 'AWAITING_DATA' || j.status === 'VALIDATION_FAILED');
        setJobs(awaitingJobs);
        if (awaitingJobs.length === 1) setSelectedJob(awaitingJobs[0].id);
      } else {
        setFetchError(t('Could not load jobs. Please try again.', 'No se pudo cargar los trabajos. Intente de nuevo.'));
      }
    } catch {
      setFetchError(t('Connection error. Check your internet and try again.', 'Error de conexion. Verifique su internet e intente de nuevo.'));
    }
    setLoading(false);
  }, [t]);

  useEffect(() => {
    loadJobs();
  }, [loadJobs]);

  /* ---------- file validation ---------- */
  const validateFile = (f: File): string | null => {
    if (!f.name.endsWith('.csv')) {
      return t('Only CSV files are accepted.', 'Solo archivos CSV son aceptados.');
    }
    if (f.size > 2 * 1024 * 1024) {
      return t('File exceeds 2MB limit.', 'El archivo excede 2MB.');
    }
    if (f.size === 0) {
      return t('File is empty.', 'El archivo esta vacio.');
    }
    return null;
  };

  const handleFileSelect = (f: File | null) => {
    setResult(null);
    if (!f) {
      setFile(null);
      return;
    }
    const error = validateFile(f);
    if (error) {
      setResult({ valid: false, status: 'VALIDATION_ERROR', errors: [error] });
      setFile(null);
      return;
    }
    setFile(f);
  };

  const handleUpload = async () => {
    if (!selectedJob || !file) return;
    setUploading(true);
    setResult(null);

    try {
      const formData = new FormData();
      formData.append('file', file);
      if (analysisPeriod) formData.append('analysisPeriod', analysisPeriod);

      const res = await fetch(getPublicApiUrl(`/api/portal/jobs/${selectedJob}/submit`), {
        method: 'POST',
        credentials: 'include',
        body: formData,
      });

      const data = unwrapApiData<{ valid: boolean; status: string; errors?: string[]; itemsImported?: number }>(
        await res.json().catch(() => ({})),
      );
      setResult(data);

      if (data.valid) {
        analytics.track(EVENTS.PORTAL_DATA_SUBMITTED, { jobId: selectedJob, items: data.itemsImported });
        setJobs(prev => prev.filter(j => j.id !== selectedJob));
        setSelectedJob(null);
        setFile(null);
      }
      if (!data.valid) {
        analytics.track(EVENTS.PORTAL_DATA_VALIDATION_FAILED, { jobId: selectedJob });
      }
    } catch {
      setResult({
        valid: false,
        status: 'ERROR',
        errors: [t('Network error. Please try again.', 'Error de conexion. Intente de nuevo.')],
      });
    } finally {
      setUploading(false);
    }
  };

  /* ---------- drag handlers ---------- */
  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(true);
  };
  const handleDragLeave = () => setDragOver(false);
  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const droppedFile = e.dataTransfer.files?.[0] || null;
    handleFileSelect(droppedFile);
  };

  return (
    <div className="space-y-6">
      {/* Hero */}
      <section className="cerniq-shell p-6 sm:p-8">
        <div className="cerniq-data-wave" />
        <div className="relative z-10">
          <span className="cerniq-kicker mb-5">{t('Submit Data', 'Enviar Datos')}</span>
          <h1 className="font-display text-3xl text-slate-950 sm:text-5xl">
            {t('Upload Your Balance-Sheet Data', 'Cargue Sus Datos de Balance')}
          </h1>
          <p className="mt-2 text-sm text-slate-400">
            {t(
              'Upload your balance sheet data to generate your report.',
              'Cargue sus datos de balance para generar su informe.',
            )}
          </p>
        </div>
      </section>

      {/* Progress Tracker */}
      <div className="cerniq-panel p-6">
        <ProgressTracker currentStep={3} completedSteps={[1, 2]} />
      </div>

      {/* Main content: 2-column on lg */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left column: steps */}
        <div className="lg:col-span-2 space-y-6">
          {/* Step 1: Download Template */}
          <div className="cerniq-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">1</div>
              <div className="flex-1">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  {t('Download Template', 'Descargar Plantilla')}
                </h2>
                <p className="mb-3 text-sm text-slate-500">
                  {t(
                    'Fill in your balance sheet data using our template. Includes columns for asset/liability type, amount, rate, and maturity.',
                    'Complete sus datos de balance usando nuestra plantilla. Incluye columnas para tipo de activo/pasivo, monto, tasa y vencimiento.',
                  )}
                </p>
                <a
                  href={getPublicApiUrl('/api/alm/templates/cooperativa')}
                  className="cerniq-button-secondary px-4 py-2 text-sm"
                >
                  <Download className="h-4 w-4" /> {t('Download template', 'Descargar plantilla')}
                </a>
              </div>
            </div>
          </div>

          {/* Step 2: Select Job */}
          <div className="cerniq-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">2</div>
              <div className="flex-1">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  {t('Select Report', 'Seleccionar Informe')}
                </h2>
                {fetchError ? (
                  <ErrorBanner
                    titleEs={locale === 'es' ? fetchError : undefined}
                    error={fetchError}
                    onRetry={loadJobs}
                    onDismiss={() => setFetchError(null)}
                  />
                ) : loading ? (
                  <SkeletonLoader variant="card" count={2} />
                ) : jobs.length === 0 ? (
                  <EmptyState
                    icon={ClipboardList}
                    title={t('No pending jobs', 'No hay trabajos pendientes')}
                    description={t(
                      'No reports awaiting data. All your reports are either in progress or complete.',
                      'No hay informes esperando datos. Todos sus informes estan en progreso o completos.',
                    )}
                    actionLabel={t('View your reports', 'Ver sus informes')}
                    onAction={() => {
                      if (typeof window !== 'undefined') window.location.href = '/portal';
                    }}
                  />
                ) : (
                  <div className="space-y-2">
                    {jobs.map(job => (
                      <button
                        key={job.id}
                        onClick={() => { setSelectedJob(job.id); setResult(null); }}
                        className={`w-full text-left px-4 py-3 rounded-lg border text-sm transition ${
                          selectedJob === job.id
                            ? 'border-[#1ABFFF]/40 bg-[#1ABFFF]/5 text-[#1B3A6B]'
                            : 'border-slate-200 hover:border-slate-300 text-slate-700'
                        }`}
                      >
                        <span className="font-medium">{job.institutionName}</span>
                        {job.status === 'VALIDATION_FAILED' && (
                          <span className="ml-2 text-xs text-rose-600">
                            {t('Validation failed - retry', 'Validacion fallida - reintentar')}
                          </span>
                        )}
                        <span className="mt-0.5 block text-xs text-slate-400">
                          {t('Created', 'Creado')} {new Date(job.createdAt).toLocaleDateString()}
                        </span>
                      </button>
                    ))}
                  </div>
                )}
              </div>
            </div>
          </div>

          {/* Step 3: Analysis Period */}
          <div className="cerniq-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">3</div>
              <div className="flex-1">
                <h2 className="mb-1 text-sm font-semibold text-slate-900">
                  {t('Select Period', 'Seleccionar Periodo')}
                </h2>
                <p className="mb-3 text-sm text-slate-500">
                  {t(
                    'Select the period for this data. This enables trend comparison across periods.',
                    'Seleccione el periodo que corresponde a estos datos. Esto permite comparar tendencias entre periodos.',
                  )}
                </p>
                <select
                  value={analysisPeriod}
                  onChange={(e) => setAnalysisPeriod(e.target.value)}
                  className="w-full max-w-xs rounded-lg border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-700 shadow-sm focus:border-[#1ABFFF] focus:outline-none focus:ring-1 focus:ring-[#1ABFFF]/30"
                >
                  {PERIOD_OPTIONS.map(p => (
                    <option key={p} value={p}>{p}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Step 4: Upload */}
          <div className="cerniq-panel p-6">
            <div className="flex items-start gap-4">
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-[#1B3A6B] text-sm font-bold text-white">4</div>
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

                <input
                  ref={fileRef}
                  type="file"
                  accept=".csv"
                  className="hidden"
                  onChange={(e) => handleFileSelect(e.target.files?.[0] || null)}
                />

                {/* Drag-drop zone */}
                <div
                  onClick={() => fileRef.current?.click()}
                  onDragOver={handleDragOver}
                  onDragLeave={handleDragLeave}
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
                        <p className="text-sm font-medium text-slate-700">{file.name}</p>
                        <p className="text-xs text-slate-400">{(file.size / 1024).toFixed(1)} KB</p>
                      </div>
                      <button
                        onClick={(e) => { e.stopPropagation(); setFile(null); setResult(null); }}
                        className="ml-3 text-xs text-slate-400 hover:text-rose-500 underline"
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

                {/* CSV Preview */}
                {file && !result && <CSVPreview file={file} />}

                {/* Result */}
                {result && (
                  <>
                    {result.valid ? (
                      <div className="mt-4 rounded-xl border border-[#18C87A]/30 bg-[#18C87A]/5 p-4">
                        <div className="flex items-start gap-2">
                          <CheckCircle className="mt-0.5 h-5 w-5 shrink-0 text-[#18C87A]" />
                          <div>
                            <p className="text-sm font-medium text-[#18C87A]">
                              {t('Data submitted successfully', 'Datos enviados exitosamente')}
                            </p>
                            <p className="mt-1 text-xs text-slate-500">
                              {t(
                                `${result.itemsImported} items imported. Your report is now queued for processing.`,
                                `${result.itemsImported} elementos importados. Su informe esta en cola para procesamiento.`,
                              )}
                            </p>
                            <Link href="/portal" className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline">
                              {t('Back to portal', 'Volver al portal')} <ArrowRight className="h-3 w-3" />
                            </Link>
                          </div>
                        </div>
                      </div>
                    ) : result.status === 'ERROR' ? (
                      <div className="mt-4">
                        <ErrorBanner
                          titleEs={locale === 'es' ? t('Connection error. Try again.', 'Error de conexion. Intente de nuevo.') : undefined}
                          error={t('Network error. Please try again.', 'Error de conexion. Intente de nuevo.')}
                          onRetry={handleUpload}
                          onDismiss={() => setResult(null)}
                        />
                      </div>
                    ) : (
                      <div className="mt-4">
                        <ErrorBanner
                          titleEs={locale === 'es' ? `Validacion fallida${result.errors?.length ? `: ${result.errors.join('; ')}` : ''}` : undefined}
                          error={t(
                            `Validation failed${result.errors?.length ? `: ${result.errors.join('; ')}` : ''}`,
                            `Validacion fallida${result.errors?.length ? `: ${result.errors.join('; ')}` : ''}`,
                          )}
                          onRetry={() => { setResult(null); setFile(null); }}
                          onDismiss={() => setResult(null)}
                        />
                      </div>
                    )}
                  </>
                )}

                <button
                  onClick={handleUpload}
                  disabled={!selectedJob || !file || uploading}
                  className="mt-4 w-full inline-flex items-center justify-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors disabled:cursor-not-allowed disabled:opacity-50"
                >
                  {uploading ? (
                    <>
                      <div className="h-4 w-4 animate-spin rounded-full border-2 border-white/30 border-t-white" />
                      {t('Uploading & Validating...', 'Cargando y validando...')}
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
        </div>

        {/* Right sidebar: FAQ */}
        <div className="lg:col-span-1">
          <div className="cerniq-panel p-5 sticky top-6">
            <div className="flex items-center gap-2 mb-4">
              <HelpCircle className="h-5 w-5 text-[#1ABFFF]" />
              <h3 className="text-sm font-semibold text-slate-900">
                {t('Need help?', 'Necesita ayuda?')}
              </h3>
            </div>

            <FAQItem
              questionEn="What format should the CSV file be?"
              questionEs="Que formato debe tener el archivo CSV?"
              answerEn="The file must be CSV (comma-separated) with columns: type, description, amount, rate, maturity. Use the provided template as a guide."
              answerEs="El archivo debe ser CSV (separado por comas) con las columnas: tipo, descripcion, monto, tasa, vencimiento. Use la plantilla proporcionada como guia."
            />

            <FAQItem
              questionEn="What data do I need to include?"
              questionEs="Que datos necesito incluir?"
              answerEn="Include all balance sheet assets and liabilities with their interest rates and maturity dates. Minimum: deposits, loans, investments."
              answerEs="Incluya todos los activos y pasivos del balance general con sus tasas de interes y fechas de vencimiento. Minimo: depositos, prestamos, inversiones."
            />

            <FAQItem
              questionEn="How long does the analysis take?"
              questionEs="Cuanto tiempo tarda el analisis?"
              answerEn="Typical processing takes 30-60 minutes. We will email you when your report is ready to download."
              answerEs="El procesamiento tipico toma 30-60 minutos. Le enviaremos un email cuando su informe este listo para descargar."
            />

            <div className="mt-4 pt-4 border-t border-slate-100">
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
