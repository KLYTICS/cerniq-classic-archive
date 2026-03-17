'use client';

import { useState, useEffect, useCallback, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { usePortal } from './layout';
import {
  FileText, Upload, Download, Eye, ArrowRight, Lock, CheckCircle,
  Calendar, ExternalLink, Briefcase,
} from 'lucide-react';
import { SkeletonLoader, EmptyState, ErrorBanner } from '@/components/ui/cerniq';
import { useFeature } from '@/lib/features';
import type { SubscriptionTier } from '@/lib/features';
import ProgressTracker from '@/components/portal/ProgressTracker';
import WorkspaceCommandCenter from '@/components/portal/WorkspaceCommandCenter';
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
const PROCESSING_MESSAGES = [
  { es: 'Validando datos...', en: 'Validating data...' },
  { es: 'Calculando brechas de duracion...', en: 'Calculating duration gaps...' },
  { es: 'Ejecutando simulaciones Monte Carlo...', en: 'Running Monte Carlo simulations...' },
  { es: 'Generando informe PDF...', en: 'Generating PDF report...' },
];

function useRotatingMessage(interval = 3500) {
  const [index, setIndex] = useState(0);
  useEffect(() => {
    const timer = setInterval(() => {
      setIndex((prev) => (prev + 1) % PROCESSING_MESSAGES.length);
    }, interval);
    return () => clearInterval(timer);
  }, [interval]);
  return PROCESSING_MESSAGES[index];
}

/* ---------- Welcome Banner (shown when ?welcome=1) ---------- */
function WelcomeBanner({ latestJob }: { latestJob?: ReportJob }) {
  const searchParams = useSearchParams();
  const isWelcome = searchParams.get('welcome') === '1';
  const { user } = usePortal();

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
          <span className="text-sm font-medium text-[#18C87A]">Payment confirmed / Pago confirmado</span>
        </div>

        <h1 className="font-display text-2xl sm:text-4xl font-bold text-white leading-tight">
          Welcome to CERNIQ{institutionName ? `, ${institutionName}` : ''}!
        </h1>
        <p className="mt-1 text-lg sm:text-xl text-white/70">
          Bienvenido a CERNIQ{institutionName ? `, ${institutionName}` : ''}!
        </p>

        <p className="mt-4 text-sm sm:text-base text-white/60 max-w-xl">
          Your ALM analysis starts here. / Su analisis ALM comienza aqui.
        </p>

        <div className="mt-6">
          {hasJob ? (
            <Link
              href="/portal/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              <Upload className="h-4 w-4" />
              Upload data / Cargar datos
              <ArrowRight className="h-4 w-4" />
            </Link>
          ) : (
            <Link
              href="/portal/submit"
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              Set up institution / Configurar institucion
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
        Processing your ALM analysis...
      </h2>
      <p className="text-sm text-slate-500 mt-1">
        Procesando su analisis ALM...
      </p>

      {/* Rotating status message */}
      <div className="mt-5 min-h-[3rem]">
        <p className="text-sm font-medium text-[#1ABFFF] animate-pulse">
          {msg.en}
        </p>
        <p className="text-xs text-slate-400 mt-0.5">
          {msg.es}
        </p>
      </div>

      {/* Progress bar */}
      <div className="mt-6 max-w-md mx-auto">
        <div className="cerniq-progress-track">
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
          <strong className="text-slate-700">Estimated time / Tiempo estimado:</strong>{' '}
          30-60 minutos
        </p>
        <p className="text-[10px] text-slate-400 mt-1">
          We will email you when it is ready. / Le enviaremos un email cuando este listo.
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
      const token = typeof window !== 'undefined' ? localStorage.getItem('capex_access_token') : null;
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
      // Silently handle — user can retry
    }
    setLoading(false);
  };

  if (compact) {
    return (
      <button
        onClick={handleDownload}
        disabled={loading}
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
      className="inline-flex items-center gap-2 rounded-xl border border-[#1B3A6B]/20 bg-[#1B3A6B]/5 px-6 py-3 text-sm font-medium text-[#1B3A6B] hover:bg-[#1B3A6B]/10 transition-colors disabled:opacity-50"
    >
      <Briefcase className="h-4 w-4" />
      {loading ? 'Generating...' : 'ALCO Pack'}
    </button>
  );
}

/* ---------- Report Ready State ---------- */
function ReportReadyState({ job }: { job: ReportJob }) {
  return (
    <div className="rounded-2xl border-t-4 border-t-[#18C87A] bg-white shadow-sm border border-slate-200/80 p-8">
      <div className="flex items-start gap-4">
        <div className="flex h-12 w-12 shrink-0 items-center justify-center rounded-full bg-[#18C87A]/10">
          <CheckCircle className="h-6 w-6 text-[#18C87A]" />
        </div>
        <div className="flex-1">
          <h2 className="text-xl font-semibold text-slate-900">
            Your ALM Report is Ready
          </h2>
          <p className="text-sm text-slate-500 mt-0.5">
            Su Informe ALM esta listo
          </p>
          <p className="mt-3 text-sm text-slate-600">
            The report for <strong>{job.institutionName}</strong> has been generated successfully.
            <br />
            <span className="text-slate-400">
              El informe para <strong>{job.institutionName}</strong> ha sido generado exitosamente.
            </span>
          </p>

          <div className="mt-6 flex flex-wrap gap-3">
            <Link
              href={`/portal/reports/${job.id}`}
              className="inline-flex items-center gap-2 rounded-xl bg-[#E8A020] px-6 py-3 text-sm font-semibold text-white shadow-lg hover:bg-[#d19218] transition-colors"
            >
              <Eye className="h-4 w-4" />
              View report / Ver informe
            </Link>
            <a
              href={`${NODE_API_URL}/api/portal/jobs/${job.id}/download`}
              className="inline-flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-6 py-3 text-sm font-medium text-slate-700 hover:bg-slate-50 transition-colors"
            >
              <Download className="h-4 w-4" />
              Download PDF / Descargar PDF
            </a>
            <AlcoPackButton jobId={job.id} />
          </div>

          {/* Schedule review */}
          <div className="mt-6 rounded-xl bg-slate-50 border border-slate-100 p-4">
            <div className="flex items-start gap-3">
              <Calendar className="h-5 w-5 text-[#1ABFFF] mt-0.5 shrink-0" />
              <div>
                <p className="text-sm font-medium text-slate-700">
                  Want to review the report together?
                </p>
                <p className="text-xs text-slate-400">
                  Quiere revisar el informe juntos?
                </p>
                <a
                  href="https://calendly.com/erwin-klytics/30min"
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-flex items-center gap-1 text-xs font-medium text-[#1ABFFF] hover:underline"
                >
                  Schedule 30 min with Erwin / Agende 30 min con Erwin
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
  let bg: string;
  let text: string;
  let label: string;
  switch (status) {
    case 'COMPLETE':
      bg = 'bg-[#18C87A]/10';
      text = 'text-[#18C87A]';
      label = 'Complete / Completado';
      break;
    case 'PROCESSING':
    case 'GENERATING_PDF':
    case 'UPLOADING':
      bg = 'bg-[#1ABFFF]/10';
      text = 'text-[#1ABFFF]';
      label = 'Processing / Procesando';
      break;
    case 'QUEUED':
    case 'VALIDATING':
      bg = 'bg-[#E8A020]/10';
      text = 'text-[#E8A020]';
      label = 'Queued / En cola';
      break;
    case 'AWAITING_DATA':
      bg = 'bg-slate-100';
      text = 'text-slate-500';
      label = 'Awaiting data / Esperando datos';
      break;
    case 'FAILED':
    case 'VALIDATION_FAILED':
      bg = 'bg-rose-50';
      text = 'text-rose-600';
      label = 'Failed / Error';
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
        setFetchError('No se pudo cargar los informes. Intente de nuevo.');
      }
    } catch {
      setFetchError('Error de conexion. Verifique su internet e intente de nuevo.');
    }
    setLoading(false);
  }, []);

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
        Welcome back{user?.name ? `, ${user.name}` : ''}
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
          Progress / Progreso
        </h2>
        <ProgressTracker currentStep={currentStep} completedSteps={completed} />
      </div>

      {/* Processing State — immersive spinner */}
      {isProcessing && latestJob && (
        <ProcessingState job={latestJob} />
      )}

      {/* Report Ready State — celebration card */}
      {isComplete && latestJob && (
        <ReportReadyState job={latestJob} />
      )}

      {/* Next Step — only show for non-processing, non-complete states */}
      {!isProcessing && !isComplete && (
        <div className="cerniq-panel p-6">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500 mb-4">
            Next step / Siguiente paso
          </h2>

          {!latestJob && (
            <div>
              <p className="mb-4 text-slate-700">
                Get started by submitting your balance sheet data. / Comience enviando sus datos de balance.
              </p>
              <div className="flex gap-3">
                <Link
                  href="/portal/submit"
                  className="cerniq-button-primary px-4 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" /> Upload data / Cargar datos
                </Link>
              </div>
            </div>
          )}

          {latestJob?.status === 'AWAITING_DATA' && (
            <div>
              <p className="mb-4 text-slate-700">
                Submit your balance sheet to generate the report for <strong>{latestJob.institutionName}</strong>.
                <br />
                <span className="text-slate-400 text-sm">
                  Envie su balance para generar el informe de <strong>{latestJob.institutionName}</strong>.
                </span>
              </p>
              <div className="flex flex-wrap gap-3">
                <a
                  href={`${NODE_API_URL}/api/alm/templates/cooperativa`}
                  className="cerniq-button-secondary px-4 py-2.5 text-sm"
                >
                  <Download className="h-4 w-4" /> Download template / Descargar plantilla
                </a>
                <Link
                  href="/portal/submit"
                  className="cerniq-button-primary px-4 py-2.5 text-sm"
                >
                  <Upload className="h-4 w-4" /> Upload data / Cargar datos
                </Link>
              </div>
            </div>
          )}

          {latestJob?.status === 'FAILED' && (
            <div>
              <p className="mb-4 text-rose-700">
                There was an issue generating your report. Our team has been notified.
                <br />
                <span className="text-rose-400 text-sm">
                  Hubo un problema generando su informe. Nuestro equipo ha sido notificado.
                </span>
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
                Upgrade plan / Mejorar plan <ArrowRight className="inline h-3 w-3" />
              </Link>
            </div>
          </div>
          <h2 className="mb-4 text-xs font-semibold uppercase tracking-wider text-slate-500">
            Quarterly trends / Tendencias trimestrales
          </h2>
          <div className="h-48 rounded-lg bg-slate-100" />
        </div>
      )}

      {/* Error Banner */}
      {fetchError && (
        <ErrorBanner
          titleEs={fetchError}
          error="Could not load reports. Please try again."
          onRetry={loadJobs}
          onDismiss={() => setFetchError(null)}
        />
      )}

      {/* Report History */}
      <div className="cerniq-table-shell overflow-hidden">
        <div className="border-b border-slate-200/80 px-6 py-4">
          <h2 className="text-xs font-semibold uppercase tracking-wider text-slate-500">
            Report history / Historial de informes
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
              titleEs="No hay informes todavia"
              title="No reports yet"
              descriptionEs="Envie sus datos de balance para generar su primer informe ALM."
              description="Submit your balance sheet data to generate your first ALM report."
              actionLabelEs="Cargar datos"
              actionLabel="Upload data"
              onAction={() => {
                if (typeof window !== 'undefined') window.location.href = '/portal/submit';
              }}
            />
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead>
                <tr className="border-b border-slate-100 bg-slate-50/60">
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Institution / Institucion
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Status / Estado
                  </th>
                  <th className="px-6 py-3 text-left text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Date / Fecha
                  </th>
                  <th className="px-6 py-3 text-right text-[11px] font-semibold uppercase tracking-wider text-slate-500">
                    Actions / Acciones
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
                            View / Ver
                          </Link>
                          <AlcoPackButton jobId={job.id} compact />
                        </div>
                      ) : job.status === 'AWAITING_DATA' || job.status === 'VALIDATION_FAILED' ? (
                        <Link
                          href="/portal/submit"
                          className="inline-flex items-center gap-1 text-xs font-medium text-[#E8A020] hover:underline"
                        >
                          <Upload className="h-3 w-3" />
                          Upload / Cargar
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
