'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePortal } from './layout';
import { useTranslation } from '@/lib/i18n';
import {
  FileText, Upload, Download, Eye, ArrowRight, Lock, CheckCircle,
  Calendar, ExternalLink, Briefcase,
} from 'lucide-react';
import { SkeletonLoader, EmptyState, ErrorBanner } from '@/components/ui/cerniq';
import { useFeature } from '@/lib/features';
import type { SubscriptionTier } from '@/lib/features';
import ProgressTracker from '@/components/portal/ProgressTracker';
import WorkspaceCommandCenter from '@/components/portal/WorkspaceCommandCenter';
import ReportProgressWS from '@/components/portal/ReportProgressWS';
import { rememberPortalUser } from '@/lib/subscription';

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

interface ReportJob {
  id: string;
  institutionName: string;
  status: string;
  completedAt?: string;
  createdAt: string;
}

/* ---------- helper: map job status to progress step ---------- */
function statusToStep(status: string | undefined): number {
  if (!status) return 1;
  switch (status) {
    case 'AWAITING_DATA':
      return 2;
    case 'VALIDATING':
    case 'QUEUED':
    case 'PROCESSING':
    case 'GENERATING_PDF':
    case 'UPLOADING':
      return 4;
    case 'COMPLETE':
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

/* ---------- rotating processing messages ---------- */
const PROCESSING_MESSAGES_EN = [
  'Validating data...',
  'Calculating duration gaps...',
  'Running Monte Carlo simulations...',
  'Generating PDF report...',
];

const PROCESSING_MESSAGES_ES = [
  'Validando datos...',
  'Calculando brechas de duracion...',
  'Ejecutando simulaciones Monte Carlo...',
  'Generando informe PDF...',
];

function useRotatingMessage(interval = 3500) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % PROCESSING_MESSAGES_EN.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);
  return { en: PROCESSING_MESSAGES_EN[index], es: PROCESSING_MESSAGES_ES[index] };
}

/* ---------- Welcome Banner (shown when ?welcome=1) ---------- */
function WelcomeBanner({ latestJob }: { latestJob?: ReportJob }) {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const { user } = usePortal();
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  // Mark this user as a portal/billing user so they skip retail onboarding
  if (isWelcome && typeof window !== 'undefined') {
    rememberPortalUser();
  }

  if (!isWelcome) return null;

  const institutionName = latestJob?.institutionName || user?.name || '';
  const hasJob = !!latestJob;

  return (
    <div className="relative overflow-hidden rounded-2xl bg-[#1B3A6B] p-8 sm:p-10 mb-6">
      {/* Subtle gradient overlay */}
      <div className="absolute inset-0 bg-gradient-to-br from-[#1B3A6B] via-[#1B3A6B] to-[#0e2340] opacity-100" />
      <div className="absolute top-0 right-0 w-64 h-64 bg-[#1ABFFF]/5 rounded-full -translate-y-1/2 translate-x-1/2" />

      <div className="relative z-10">
        <div className="flex items-center gap-2 mb-4">
          <CheckCircle className="h-6 w-6 text-[#18C87A]" />
          <span className="text-sm font-medium text-[#18C87A]">
            {t('Payment confirmed', 'Pago confirmado')}
          </span>
        </div>

        <h1 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight">
          {t(
            `Welcome to CERNIQ${institutionName ? `, ${institutionName}` : ''}!`,
            `Bienvenido a CERNIQ${institutionName ? `, ${institutionName}` : ''}!`,
          )}
        </h1>

        <p className="mt-4 text-sm sm:text-base text-white/60 max-w-xl">
          {t(
            'Your ALM analysis starts here.',
            'Su analisis ALM comienza aqui.',
          )}
        </p>

        <div className="mt-6">
          {hasJob ? (
            <Link
              href="/portal/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              <Upload className="h-4 w-4" />
              {t('Upload data', 'Cargar datos')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/portal/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              {t('Set up institution', 'Configurar institucion')}
              <ArrowRight className="h-4 w-4" />
            </Link>
          )}
        </div>
      </div>
    </div>
  );
}

/* ---------- Processing State ---------- */
function ProcessingState({ job }: { job: ReportJob }) {
  const msg = useRotatingMessage();
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  const progressPercent =
    job.status === 'VALIDATING' ? 20
      : job.status === 'QUEUED' ? 30
        : job.status === 'PROCESSING' ? 55
          : job.status === 'GENERATING_PDF' ? 78
            : 92; // UPLOADING

  return (
    <div className="cerniq-panel p-8 text-center">
      {/* Pulsing spinner */}
      <div className="mx-auto mb-6 flex h-20 w-20 items-center justify-center">
        <div className="relative">
          <div className="h-16 w-16 rounded-full border-4 border-[#1ABFFF]/20" />
          <div className="absolute inset-0 h-16 w-16 animate-spin rounded-full border-4 border-transparent border-t-[#1ABFFF]" />
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="h-6 w-6 rounded-full bg-[#1ABFFF]/30 animate-pulse" />
          </div>
        </div>
      </div>

      <h2 className="text-lg font-semibold text-slate-900">
        {t('Processing your ALM analysis...', 'Procesando su analisis ALM...')}
      </h2>

      {/* Rotating status message */}
      <div className="mt-5 min-h-[3rem]" aria-live="polite">
        <p className="text-sm font-medium text-[#1ABFFF] animate-pulse">
          {t(msg.en, msg.es)}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6 max-w-md mx-auto">
        <div className="cerniq-progress-track" role="progressbar" aria-valuenow={progressPercent} aria-valuemin={0} aria-valuemax={100} aria-label={t('Report generation progress', 'Progreso de generacion del informe')}>
          <div
            className="cerniq-progress-bar"
            style={{ width: `${progressPercent}%`, transition: 'width 1s ease' }}
          />
        </div>
        <p className="mt-2 text-xs text-slate-400 capitalize">
          {job.status.replace(/_/g, ' ').toLowerCase()} &middot; {job.institutionName}
        </p>
      </div>

      <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4 max-w-sm mx-auto">
        <p className="text-xs text-slate-500">
          <strong className="text-slate-700">{t('Estimated time', 'Tiempo estimado')}:</strong>{' '}
          {t('30-60 minutes', '30-60 minutos')}
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          {t('We will email you when it is ready.', 'Le enviaremos un email cuando este listo.')}
        </p>
      </div>
    </div>
  );
}

/* ---------- ALCO Pack Button ---------- */
function AlcoPackButton({ jobId, compact }: { jobId: string; compact?: boolean }) {
  const [loading, setLoading] = useState(false);

  const handleDownload = async () => {
    setLoading(true);
    try {
      const token = typeof window !== 'undefined' ? (sessionStorage.getItem('cerniq_access_token') || localStorage.getItem('cerniq_access_token')) : null;
      const res = await fetch(`${NODE_API_URL}/api/portal/jobs/${jobId}/alco-pack?lang=es`, {
        method: 'POST',
        credentials: 'include',
        headers: token ? { Authorization: `Bearer ${token}` } : {},
      });
      if (!res.ok) {
        throw new Error('Failed to generate ALCO pack');
      }
      const blob = await res.blob();
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = res.headers.get('content-disposition')?.match(/filename="(.+)"/)?.[1] || `ALCO_Pack_${jobId}.pdf`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } catch {
      // Silently handle -- user can retry
    }
    setLoading(false);
  };

  if (compact) {
    return (
      <button
        onClick={handleDownload}
        disabled={loading}
        aria-label={loading ? 'Generating ALCO Pack...' : 'Download ALCO Pack'}
        className="inline-flex items-center gap-1 text-xs font-medium text-[#1B3A6B] hover:underline disabled:opacity-50"
      >
        <Briefcase className="h-3 w-3" />
        {loading ? '...' : 'ALCO'}
      </button>
    );
  }

  return (
    <button
      onClick={handleDownload}
      disabled={loading}
      aria-label={loading ? 'Generating ALCO Pack...' : 'Download ALCO Pack'}
      className="inline-flex items-center gap-2 rounded-xl border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 px-6 py-3 text-sm font-medium text-[#1B3A6B] hover:bg-[#1B3A6B]/10 transition-colors disabled:opacity-50"
    >
      <Briefcase className="h-4 w-4" />
      {loading ? 'Generating...' : 'ALCO Pack'}
    </button>
  );
}

/* ---------- Report Ready State ---------- */
function ReportReadyState({ job }: { job: ReportJob }) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  return (
    <div className="rounded-2xl border-t-4 border-t-[#18C87A] bg-white shadow-sm border border-slate-200/80 p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#18C87A]/10">
          <CheckCircle className="h-6 w-6 text-[#18C87A]" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">
            {t('Your ALM Report is Ready', 'Su Informe ALM esta Listo')}
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
              {t('View report', 'Ver informe')}
            </Link>
            <a
              href={`${NODE_API_URL}/api/portal/jobs/${job.id}/download`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              {t('Download PDF', 'Descargar PDF')}
            </a>
            <AlcoPackButton jobId={job.id} />
          </div>

          {/* Schedule review */}
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-[#1ABFFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  {t('Want to review the report together?', 'Quiere revisar el informe juntos?')}
                </p>
                <a
                  href="https://calendly.com/erwin-klytics/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline"
                >
                  {t('Schedule 30 min with Erwin', 'Agende 30 min con Erwin')}
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

/* ---------- Status Badge ---------- */
function StatusBadge({ status }: { status: string }) {
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  let bg: string;
  let text: string;
  let label: string;
  switch (status) {
    case 'COMPLETE':
      bg = 'bg-[#18C87A]/10';
      text = 'text-[#18C87A]';
      label = t('Complete', 'Completado');
      break;
    case 'PROCESSING':
    case 'GENERATING_PDF':
    case 'UPLOADING':
      bg = 'bg-[#1ABFFF]/10';
      text = 'text-[#1ABFFF]';
      label = t('Processing', 'Procesando');
      break;
    case 'QUEUED':
    case 'VALIDATING':
      bg = 'bg-[#E8A020]/10';
      text = 'text-[#E8A020]';
      label = t('Queued', 'En cola');
      break;
    case 'AWAITING_DATA':
      bg = 'bg-slate-100';
      text = 'text-slate-500';
      label = t('Awaiting data', 'Esperando datos');
      break;
    case 'FAILED':
    case 'VALIDATION_FAILED':
      bg = 'bg-rose-50';
      text = 'text-rose-600';
      label = t('Failed', 'Error');
      break;
    default:
      bg = 'bg-slate-100';
      text = 'text-slate-500';
      label = status;
  }
  return (
    <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-[11px] font-medium ${bg} ${text}`}>
      {label}
    </span>
  );
}

/* ---------- Main Page ---------- */
export default function PortalHome() {
  const { user, subscription } = usePortal();
  const { locale } = useTranslation();
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  const [jobs, setJobs] = useState<ReportJob[]>([]);
  const [loading, setLoading] = useState(true);
  const [fetchError, setFetchError] = useState<string | null>(null);

  const tier = (subscription?.tier || 'free') as SubscriptionTier;
  const trendFeature = useFeature(tier, 'trendCharts');

  const loadJobs = useCallback(async () => {
    setLoading(true);
    setFetchError(null);
    try {
      const res = await fetch(`${NODE_API_URL}/api/portal/jobs`, { credentials: 'include' });
      if (res.ok) {
        setJobs(await res.json());
      } else {
        setFetchError(t('Could not load reports. Please try again.', 'No se pudo cargar los informes. Intente de nuevo.'));
      }
    } catch {
      setFetchError(t('Connection error. Check your internet and try again.', 'Error de conexion. Verifique su internet e intente de nuevo.'));
    }
    setLoading(false);
  }, [locale]);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      loadJobs();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [loadJobs]);

  const latestJob = jobs[0];
  const completedJobs = jobs.filter(j => j.status === 'COMPLETE');
  const currentStep = statusToStep(latestJob?.status);
  const completed = completedStepsForStatus(latestJob?.status);

  const isProcessing = latestJob && ['QUEUED', 'PROCESSING', 'GENERATING_PDF', 'UPLOADING', 'VALIDATING'].includes(latestJob.status);
  const isComplete = latestJob?.status === 'COMPLETE';

  return (
    <div className="space-y-6">
      <h1 className="sr-only">
        {t(
          `Welcome back${user?.name ? `, ${user.name}` : ''}`,
          `Bienvenido${user?.name ? `, ${user.name}` : ''}`,
        )}
      </h1>

      {/* Welcome banner (only when ?welcome=1) */}
      <Suspense fallback={null}>
        <WelcomeBanner latestJob={latestJob} />
      </Suspense>

      <WorkspaceCommandCenter
        userName={user?.name}
        tier={tier}
        jobs={jobs.map((job) => ({ id: job.id, status: job.status }))}
      />

      {/* Progress Tracker */}
      <div className="cerniq-panel p-6">
        <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-2">
          {t('Progress', 'Progreso')}
        </h2>
        <ProgressTracker currentStep={currentStep} completedSteps={completed} />
      </div>

      {/* Processing State -- real-time WebSocket progress (aria-live for dynamic updates) */}
      {isProcessing && latestJob && (
        <ReportProgressWS
          jobId={latestJob.id}
          institutionName={latestJob.institutionName}
          initialStatus={latestJob.status}
          onComplete={loadJobs}
        />
      )}

      {/* Report Ready State -- celebration card */}
      {isComplete && latestJob && (
        <ReportReadyState job={latestJob} />
      )}

      {/* Next Step -- only show for non-processing, non-complete states */}
      {!isProcessing && !isComplete && (
        <div className="cerniq-panel p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            {t('Next step', 'Siguiente paso')}
          </h2>

          {!latestJob && (
            <div>
              <p className="mb-4 text-slate-700">
                {t(
                  'Get started by submitting your balance sheet data.',
                  'Comience enviando sus datos de balance.',
                )}
              </p>
              <div className="flex gap-3">
                <Link
                  href="/portal/submit"
                  className="cerniq-button-primary px-4 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" /> {t('Upload data', 'Cargar datos')}
                </Link>
              </div>
            </div>
          )}

          {latestJob?.status === 'AWAITING_DATA' && (
            <div>
              <p className="mb-4 text-slate-700">
                {t(
                  `Submit your balance sheet to generate the report for ${latestJob.institutionName}.`,
                  `Envie su balance para generar el informe de ${latestJob.institutionName}.`,
                )}
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`${NODE_API_URL}/api/alm/templates/cooperativa`}
                  className="cerniq-button-secondary px-4 py-2.5 text-sm"
                >
                  <Download className="h-4 w-4" /> {t('Download template', 'Descargar plantilla')}
                </a>
                <Link
                  href="/portal/submit"
                  className="cerniq-button-primary px-4 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" /> {t('Upload data', 'Cargar datos')}
                </Link>
              </div>
            </div>
          )}

          {latestJob?.status === 'FAILED' && (
            <div>
              <p className="mb-4 text-rose-700">
                {t(
                  'There was an issue generating your report. Our team has been notified.',
                  'Hubo un problema generando su informe. Nuestro equipo ha sido notificado.',
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
              <p className="mb-2 text-sm font-medium text-slate-950">{trendFeature.upgradePrompt}</p>
              <Link href="/portal/billing" className="text-xs text-[#E8A020] hover:underline">
                {t('Upgrade plan', 'Mejorar plan')} <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('Quarterly trends', 'Tendencias trimestrales')}
          </h2>
          <div className="h-48 rounded-lg bg-slate-100" />
        </div>
      )}

      {/* Error Banner */}
      {fetchError && (
        <ErrorBanner
          titleEs={locale === 'es' ? fetchError : undefined}
          error={fetchError}
          onRetry={loadJobs}
          onDismiss={() => setFetchError(null)}
        />
      )}

      {/* Report History */}
      <div className="cerniq-table-shell overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            {t('Report history', 'Historial de informes')}
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
              title={t('No reports yet', 'No hay informes todavia')}
              description={t(
                'Submit your balance sheet data to generate your first ALM report.',
                'Envie sus datos de balance para generar su primer informe ALM.',
              )}
              actionLabel={t('Upload data', 'Cargar datos')}
              onAction={() => {
                if (typeof window !== 'undefined') window.location.href = '/portal/submit';
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm" aria-label={t('Report history', 'Historial de informes')}>
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('Institution', 'Institucion')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('Status', 'Estado')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('Date', 'Fecha')}
                  </th>
                  <th scope="col" className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    {t('Actions', 'Acciones')}
                  </th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {jobs.map(job => (
                  <tr key={job.id} className="hover:bg-slate-50/50 transition-colors">
                    <td className="px-6 py-4">
                      <p className="font-medium text-slate-900">{job.institutionName}</p>
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
                      {job.status === 'COMPLETE' ? (
                        <div className="flex items-center justify-end gap-3">
                          <Link
                            href={`/portal/reports/${job.id}`}
                            className="inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline"
                          >
                            <Eye className="h-3 w-3" />
                            {t('View', 'Ver')}
                          </Link>
                          <AlcoPackButton jobId={job.id} compact />
                        </div>
                      ) : job.status === 'AWAITING_DATA' || job.status === 'VALIDATION_FAILED' ? (
                        <Link
                          href="/portal/submit"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#E8A020] hover:underline"
                        >
                          <Upload className="h-3 w-3" />
                          {t('Upload', 'Cargar')}
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
