'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { apiClient } from '@/lib/api';
import { useTranslation } from '@/lib/i18n';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  Building2,
  Calendar,
  Clock,
  CreditCard,
  FileText,
  Landmark,
  LineChart,
  LogOut,
  Shield,
  TrendingUp,
  Upload,
  Users,
} from 'lucide-react';
import { EmptyState } from '@/components/ui/cerniq';

/* --- Helpers --- */

function statusColor(status: 'green' | 'amber' | 'red'): string {
  switch (status) {
    case 'green':
      return 'bg-[#18C87A]';
    case 'amber':
      return 'bg-[#E8A020]';
    case 'red':
      return 'bg-red-500';
  }
}

function scoreColor(score: number): string {
  if (score >= 80) return '#18C87A';
  if (score >= 50) return '#E8A020';
  return '#ef4444';
}

/* --- Static Data --- */

const RATE_ENVIRONMENT = [
  { label: 'Fed Funds Rate', value: '4.50%', impactEn: 'Base rate for loan pricing', impactEs: 'Tasa base para precios de prestamos' },
  { label: 'SOFR', value: '4.32%', impactEn: 'Variable rate benchmark', impactEs: 'Referencia de tasa variable' },
  { label: '10Y Treasury', value: '4.25%', impactEn: 'Mortgage/bond yield driver', impactEs: 'Impulsor de rendimiento hipotecario/bonos' },
  { label: 'PR Prime', value: '8.50%', impactEn: 'Local commercial lending', impactEs: 'Prestamos comerciales locales' },
];

const ALM_STATUS_ROWS: {
  labelEn: string;
  labelEs: string;
  value: string;
  status: 'green' | 'amber' | 'red';
}[] = [
  { labelEn: 'Liquidity Coverage', labelEs: 'LCR', value: '115.5%', status: 'green' },
  { labelEn: 'Capital Adequacy', labelEs: 'Adecuacion de Capital', value: '12.8%', status: 'green' },
  { labelEn: 'Loan-to-Deposit', labelEs: 'Prestamos/Depositos', value: '82.4%', status: 'amber' },
  { labelEn: 'Net Interest Margin', labelEs: 'NIM', value: '3.15%', status: 'green' },
];

const MODULE_CARDS = [
  {
    titleEn: 'ALM Intelligence',
    titleEs: 'Inteligencia ALM',
    descEn: 'Duration gap, NII sensitivity, balance sheet analysis.',
    descEs: 'Brecha de duracion, sensibilidad NII, analisis de balance.',
    href: '/alm',
    icon: Landmark,
    accentEn: 'ALM',
    accentEs: 'ALM',
  },
  {
    titleEn: 'COSSEC Compliance',
    titleEs: 'Cumplimiento COSSEC',
    descEn: 'Regulatory readiness, exam prep, and benchmarks.',
    descEs: 'Preparacion regulatoria, examenes y benchmarks.',
    href: '/alm',
    icon: Shield,
    accentEn: 'Regulatory',
    accentEs: 'Regulatorio',
  },
  {
    titleEn: 'Stress Testing',
    titleEs: 'Pruebas de Estres',
    descEn: 'Monte Carlo, rate shocks, and scenario analysis.',
    descEs: 'Monte Carlo, choques de tasas y escenarios.',
    href: '/alm',
    icon: BarChart3,
    accentEn: 'Stress',
    accentEs: 'Estres',
  },
  {
    titleEn: 'Portfolio Risk',
    titleEs: 'Riesgo de Portafolio',
    descEn: 'VaR, scenarios, volatility, and exposure.',
    descEs: 'VaR, escenarios, volatilidad y exposicion.',
    href: '/risk-analytics',
    icon: TrendingUp,
    accentEn: 'Risk',
    accentEs: 'Riesgo',
    badge: 'Beta',
  },
  {
    titleEn: 'SpendCheck',
    titleEs: 'SpendCheck',
    descEn: 'Receipt parsing, AP controls, and recovery.',
    descEs: 'Analisis de recibos, controles AP y recuperacion.',
    href: '/spendcheck',
    icon: CreditCard,
    accentEn: 'Spend',
    accentEs: 'Gastos',
  },
  {
    titleEn: 'Rate Environment',
    titleEs: 'Entorno de Tasas',
    descEn: 'Reference rates, yield curves, and rate impact.',
    descEs: 'Tasas de referencia, curvas de rendimiento e impacto de tasas.',
    href: '/live-data',
    icon: LineChart,
    accentEn: 'Rates',
    accentEs: 'Tasas',
  },
];

/* --- Compliance Calendar Types + Helpers --- */

interface CalendarDeadline {
  id: string;
  titleEn: string;
  titleEs: string;
  deadlineDate: string;
  category: 'exam' | 'report' | 'meeting' | 'tax' | 'internal';
  urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERDUE';
  descriptionEn: string;
  descriptionEs: string;
  relatedModule: string;
}

function normalizeCalendarDeadlines(
  deadlines: Array<Record<string, unknown>>,
): CalendarDeadline[] {
  return deadlines.map((deadline, index) => ({
    id: String(deadline.id ?? `deadline-${index}`),
    titleEn: String(deadline.titleEn ?? deadline.title ?? ''),
    titleEs: String(deadline.titleEs ?? deadline.title ?? ''),
    deadlineDate: String(deadline.deadlineDate ?? ''),
    category: (deadline.category as CalendarDeadline['category']) ?? 'report',
    urgency: (deadline.urgency as CalendarDeadline['urgency']) ?? 'MEDIUM',
    descriptionEn: String(deadline.descriptionEn ?? deadline.description ?? ''),
    descriptionEs: String(deadline.descriptionEs ?? deadline.description ?? ''),
    relatedModule: String(deadline.relatedModule ?? ''),
  }));
}

function urgencyDotColor(urgency: string): string {
  switch (urgency) {
    case 'OVERDUE':
    case 'CRITICAL':
      return 'bg-red-500';
    case 'HIGH':
      return 'bg-[#E8A020]';
    case 'MEDIUM':
      return 'bg-[#1ABFFF]';
    default:
      return 'bg-slate-400';
  }
}

function urgencyRowBg(urgency: string): string {
  if (urgency === 'CRITICAL' || urgency === 'OVERDUE') return 'bg-red-50/60';
  return '';
}

function daysUntil(dateStr: string): number {
  return Math.floor(
    (new Date(dateStr).getTime() - Date.now()) / 86_400_000,
  );
}

function formatDeadlineDate(dateStr: string): string {
  const d = new Date(dateStr);
  return d.toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

/** Generate demo calendar deadlines relative to today */
function generateDemoDeadlines(): CalendarDeadline[] {
  const now = new Date();
  const addDays = (d: Date, days: number) => {
    const r = new Date(d);
    r.setDate(r.getDate() + days);
    return r.toISOString();
  };

  // Quarterly COSSEC report deadlines
  const quarterlyDeadlines = [
    { month: 0, day: 15, quarter: 'Q4' },
    { month: 3, day: 15, quarter: 'Q1' },
    { month: 6, day: 15, quarter: 'Q2' },
    { month: 9, day: 15, quarter: 'Q3' },
  ];

  const deadlines: CalendarDeadline[] = [];

  // Next ALCO meeting in ~12 days
  deadlines.push({
    id: 'alco-meeting-1',
    titleEn: 'ALCO Meeting',
    titleEs: 'Reunion ALCO',
    deadlineDate: addDays(now, 12),
    category: 'meeting',
    urgency: 'CRITICAL',
    descriptionEn: 'Monthly ALCO committee meeting',
    descriptionEs: 'Reunion mensual del comite ALCO',
    relatedModule: '/alm',
  });

  // COSSEC exam in ~65 days
  deadlines.push({
    id: 'cossec-exam',
    titleEn: 'COSSEC Examination',
    titleEs: 'Examen COSSEC',
    deadlineDate: addDays(now, 65),
    category: 'exam',
    urgency: 'MEDIUM',
    descriptionEn: 'Annual COSSEC regulatory examination',
    descriptionEs: 'Examen regulatorio anual de COSSEC',
    relatedModule: '/alm',
  });

  // Next quarterly report
  const yr = now.getFullYear();
  for (const qd of quarterlyDeadlines) {
    const d = new Date(yr, qd.month, qd.day);
    if (d > now) {
      const days = Math.floor((d.getTime() - now.getTime()) / 86_400_000);
      deadlines.push({
        id: `cossec-report-${qd.quarter}-${yr}`,
        titleEn: `COSSEC ${qd.quarter} ${yr} Report`,
        titleEs: `Informe COSSEC ${qd.quarter} ${yr}`,
        deadlineDate: d.toISOString(),
        category: 'report',
        urgency: days <= 14 ? 'CRITICAL' : days <= 30 ? 'HIGH' : days <= 90 ? 'MEDIUM' : 'LOW',
        descriptionEn: `Quarterly COSSEC regulatory report`,
        descriptionEs: `Informe regulatorio trimestral COSSEC`,
        relatedModule: '/alm',
      });
      break; // Only next one
    }
  }

  // Next ALCO #2 in ~42 days
  deadlines.push({
    id: 'alco-meeting-2',
    titleEn: 'ALCO Meeting #2',
    titleEs: 'Reunion ALCO #2',
    deadlineDate: addDays(now, 42),
    category: 'meeting',
    urgency: 'MEDIUM',
    descriptionEn: 'Monthly ALCO committee meeting',
    descriptionEs: 'Reunion mensual del comite ALCO',
    relatedModule: '/alm',
  });

  // Fiscal year-end report in ~120 days
  deadlines.push({
    id: 'fiscal-year-end',
    titleEn: 'Fiscal Year-End Report',
    titleEs: 'Informe de Cierre Fiscal',
    deadlineDate: addDays(now, 120),
    category: 'report',
    urgency: 'LOW',
    descriptionEn: 'Annual fiscal year-end regulatory filing',
    descriptionEs: 'Informe regulatorio de cierre fiscal anual',
    relatedModule: '/alm',
  });

  // Internal audit in ~25 days
  deadlines.push({
    id: 'internal-audit',
    titleEn: 'Internal Audit Review',
    titleEs: 'Revision de Auditoria Interna',
    deadlineDate: addDays(now, 25),
    category: 'internal',
    urgency: 'HIGH',
    descriptionEn: 'Quarterly internal audit compliance review',
    descriptionEs: 'Revision trimestral de cumplimiento de auditoria interna',
    relatedModule: '/alm',
  });

  return deadlines.sort(
    (a, b) => new Date(a.deadlineDate).getTime() - new Date(b.deadlineDate).getTime(),
  );
}

/* --- COSSEC Readiness Gauge (CSS-only) --- */

function COSSECGauge({ score }: { score: number }) {
  const color = scoreColor(score);
  const circumference = 2 * Math.PI * 54; // r=54
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="flex flex-col items-center">
      <div className="relative h-36 w-36">
        <svg viewBox="0 0 120 120" className="h-full w-full -rotate-90">
          {/* Background track */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke="#e2e8f0"
            strokeWidth="8"
          />
          {/* Progress arc */}
          <circle
            cx="60"
            cy="60"
            r="54"
            fill="none"
            stroke={color}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={offset}
            style={{ transition: 'stroke-dashoffset 0.8s ease' }}
          />
        </svg>
        {/* Center label */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-3xl font-bold" style={{ color }}>
            {score}
          </span>
          <span className="text-[11px] uppercase tracking-widest text-slate-500">/100</span>
        </div>
      </div>
    </div>
  );
}

/* --- Language Toggle --- */

function DashboardLangToggle() {
  const { locale, setLocale } = useTranslation();

  return (
    <div className="flex items-center gap-0.5 rounded-full border border-slate-200 bg-white/80 p-0.5">
      <button
        onClick={() => setLocale('en')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          locale === 'en'
            ? 'bg-[#1B3A6B] text-white'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        EN
      </button>
      <button
        onClick={() => setLocale('es')}
        className={`rounded-full px-3 py-1 text-xs font-semibold transition ${
          locale === 'es'
            ? 'bg-[#1B3A6B] text-white'
            : 'text-slate-500 hover:text-slate-900'
        }`}
      >
        ES
      </button>
    </div>
  );
}

/* --- Main Page --- */

export default function DashboardPage() {
  const {
    initialized,
    isAuthenticated,
    onboardingComplete,
    user,
    logout,
    hydrateFromStorage,
  } = useAuthStore();
  const router = useRouter();
  const { locale } = useTranslation();

  // Inline bilingual helper driven by the global locale
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  // Greeting based on time of day
  const greeting = locale === 'en' ? 'Welcome back' : 'Bienvenido';

  // Mock COSSEC score -- will be replaced with real API data when available
  const cossecScore = 72;
  const lastAnalysisDate: string | null = null; // null = no analysis yet

  // Compliance Calendar state
  const [calendarDeadlines, setCalendarDeadlines] = useState<CalendarDeadline[]>([]);
  const [calendarLoading, setCalendarLoading] = useState(true);

  const displayName = user?.name || user?.email?.split('@')[0] || '';
  const isDemoMode = !isAuthenticated || !onboardingComplete;

  // Derive exam countdown from calendar deadlines
  const examDeadline = calendarDeadlines.find(
    (d) => d.category === 'exam',
  );
  const daysToExam = examDeadline
    ? daysUntil(examDeadline.deadlineDate)
    : null;

  useEffect(() => {
    if (!initialized) {
      void hydrateFromStorage();
    }
  }, [initialized, hydrateFromStorage]);

  // Load compliance calendar deadlines
  useEffect(() => {
    if (!initialized) return;
    let cancelled = false;

    async function loadCalendar() {
      try {
        // Try real API first (demo-bank-id as fallback for demo mode)
        const data = await apiClient.getComplianceCalendar('demo-bank-id');
        if (!cancelled && data && data.length > 0) {
          setCalendarDeadlines(
            normalizeCalendarDeadlines(
              data as Array<Record<string, unknown>>,
            ),
          );
          setCalendarLoading(false);
          return;
        }
      } catch {
        // API not available -- use demo data
      }
      if (!cancelled) {
        setCalendarDeadlines(generateDemoDeadlines());
        setCalendarLoading(false);
      }
    }

    loadCalendar();
    return () => { cancelled = true; };
  }, [initialized]);

  return (
    <div className="cerniq-dashboard-theme cerniq-dashboard-page min-h-screen overflow-x-clip px-4 py-4 text-slate-950 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* -- Top Nav -- */}
        <nav className="cerniq-panel px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="font-display text-xl uppercase tracking-[0.24em] text-[#1B3A6B]">
                Cerniq
              </div>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                {t('Institutional Risk Intelligence', 'Inteligencia de Riesgo Institucional')}
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <DashboardLangToggle />
              {isDemoMode ? (
                <span className="rounded-full border border-amber-200 bg-amber-50 px-4 py-2 text-sm font-medium text-amber-800">
                  {t('Demo mode', 'Modo demo')}
                </span>
              ) : (
                <span className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm text-slate-600">
                  {user?.email}
                </span>
              )}
              <button
                onClick={() => router.push('/live-data')}
                className="cerniq-button-secondary px-4 py-2 text-sm"
              >
                {t('Live Data', 'Datos en Vivo')}
              </button>
              {isDemoMode ? (
                <button
                  onClick={() => router.push('/login')}
                  className="rounded-full bg-[#1B3A6B] px-4 py-2 text-sm font-semibold text-white transition hover:bg-[#163258]"
                >
                  {t('Sign in', 'Iniciar sesion')}
                </button>
              ) : (
                <button
                  onClick={async () => {
                    await logout();
                    router.push('/login');
                  }}
                  className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition hover:border-red-300"
                >
                  <LogOut className="h-3.5 w-3.5" />
                  {t('Logout', 'Salir')}
                </button>
              )}
            </div>
          </div>
        </nav>

        {isDemoMode ? (
          <div className="flex flex-col gap-3 rounded-2xl border border-cyan-200 bg-cyan-50/85 px-5 py-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="text-xs font-semibold uppercase tracking-[0.22em] text-cyan-700">
                {t('Dashboard access', 'Acceso al dashboard')}
              </p>
              <p className="mt-1 text-sm text-slate-700">
                {t(
                  'You are viewing the live demo experience. Sign in to save workspaces, billing access, and institution-specific data.',
                  'Esta viendo la experiencia demo en vivo. Inicie sesion para guardar workspaces, acceso de facturacion y datos especificos de su institucion.',
                )}
              </p>
            </div>
            <button
              onClick={() => router.push('/login')}
              className="rounded-full bg-cyan-700 px-5 py-2.5 text-sm font-semibold text-white transition hover:bg-cyan-800"
            >
              {t('Unlock full access', 'Desbloquear acceso total')}
            </button>
          </div>
        ) : null}

        {/* -- Exam Countdown Banner -- */}
        {daysToExam !== null && daysToExam <= 90 && daysToExam >= 0 && (
          <div
            className="flex flex-col gap-2 rounded-2xl border border-amber-300 bg-gradient-to-r from-amber-50 to-orange-50 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 flex-none items-center justify-center rounded-full bg-amber-100">
                <AlertTriangle className="h-5 w-5 text-[#E8A020]" />
              </div>
              <div>
                <p className="text-sm font-semibold text-amber-900">
                  {t(
                    `COSSEC Exam in ${daysToExam} days`,
                    `Examen COSSEC en ${daysToExam} dias`,
                  )}
                </p>
                <p className="text-xs text-amber-700">
                  {t('Readiness', 'Preparacion')}: {cossecScore}/100 &mdash; {
                    cossecScore >= 80
                      ? t('Well prepared', 'Bien preparado')
                      : cossecScore >= 50
                        ? t('Attention required', 'Atencion requerida')
                        : t('Immediate action needed', 'Accion inmediata')
                  }
                </p>
              </div>
            </div>
            <button
              onClick={() => router.push('/alm')}
              className="flex items-center gap-2 rounded-full bg-[#E8A020] px-5 py-2 text-sm font-bold text-white shadow transition hover:-translate-y-0.5 hover:bg-[#d4911c]"
            >
              {t('Prepare for exam', 'Preparar examen')}
              <ArrowRight className="h-4 w-4" />
            </button>
          </div>
        )}

        {/* -- Hero Section -- */}
        <section className="grid gap-4 lg:grid-cols-[1fr_380px]">

          {/* Left: Welcome + Quick Stats */}
          <div className="space-y-4">
            <div className="cerniq-panel p-5 sm:p-6">
              <div className="cerniq-data-wave" />
              <div className="relative z-10">
                <p className="text-sm text-slate-500">
                  {greeting}
                </p>
                <h1 className="font-display mt-1 text-2xl text-slate-950 sm:text-3xl">
                  {displayName || t('Dashboard', 'Panel de Control')}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {lastAnalysisDate
                    ? `${t('Last analysis', 'Ultimo analisis')}: ${lastAnalysisDate}`
                    : t(
                        'No analysis available -- upload your balance sheet to start.',
                        'No hay analisis disponible -- cargue su balance para comenzar.',
                      )}
                </p>

                {/* Quick Stats Row */}
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Duration Gap */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {t('Duration Gap', 'Brecha de Duracion')}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-[#1B3A6B]">
                      2.1 <span className="text-sm font-normal text-slate-500">{t('years', 'anos')}</span>
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#E8A020]">
                      Asset-sensitive
                    </span>
                  </div>

                  {/* COSSEC Readiness (compact) */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {t('COSSEC Readiness', 'Preparacion COSSEC')}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold" style={{ color: scoreColor(cossecScore) }}>
                      {cossecScore}<span className="text-sm font-normal text-slate-500">/100</span>
                    </p>
                    <span
                      className="mt-1 inline-block rounded-full px-2 py-0.5 text-[10px] font-semibold uppercase"
                      style={{
                        color: scoreColor(cossecScore),
                        backgroundColor: cossecScore >= 80 ? '#ecfdf5' : cossecScore >= 50 ? '#fffbeb' : '#fef2f2',
                      }}
                    >
                      {cossecScore >= 80
                        ? t('Strong', 'Fuerte')
                        : cossecScore >= 50
                          ? t('Moderate', 'Moderado')
                          : t('At risk', 'En riesgo')}
                    </span>
                  </div>

                  {/* NII Risk Rating */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      {t('NII Risk Rating', 'Clasificacion NII')}
                    </p>
                    <p className="mt-2 font-display text-2xl font-bold text-[#E8A020]">
                      {t('Moderate', 'Moderado')}
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#E8A020]">
                      +/-12.5% {t('sensitivity', 'sensibilidad')}
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ALM Status Panel */}
            <div className="cerniq-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="cerniq-section-label">{t('ALM Status', 'Estado ALM')}</p>
                <Building2 className="h-5 w-5 text-[#1ABFFF]" />
              </div>
              <div className="space-y-0">
                {ALM_STATUS_ROWS.map((row, i) => (
                  <div
                    key={row.labelEn}
                    className={`flex items-center justify-between py-3 ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 flex-none rounded-full ${statusColor(row.status)}`} />
                      <span className="text-sm font-medium text-slate-700">
                        {t(row.labelEn, row.labelEs)}
                      </span>
                    </div>
                    <span className="font-display text-sm font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-[10px] text-slate-400">
                {t('Demo data -- upload balance sheet for real data', 'Datos de demostracion -- cargue balance para datos reales')}
              </p>
            </div>
          </div>

          {/* Right: COSSEC Gauge + Rate Environment */}
          <div className="space-y-4">
            {/* COSSEC Readiness Gauge */}
            <div className="cerniq-panel p-5">
              <div className="mb-4 text-center">
                <p className="cerniq-section-label">{t('COSSEC Readiness', 'Preparacion COSSEC')}</p>
              </div>
              <COSSECGauge score={cossecScore} />
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {cossecScore >= 80
                    ? t('Institution well prepared', 'Institucion bien preparada')
                    : cossecScore >= 50
                      ? t('Attention required in some areas', 'Atencion requerida en algunas areas')
                      : t('Immediate action required', 'Accion inmediata requerida')}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {daysToExam !== null
                    ? t(`Next exam: ${daysToExam} days`, `Proximo examen: ${daysToExam} dias`)
                    : t('Exam date: to be determined', 'Fecha de examen: por determinar')}
                </p>
              </div>
            </div>

            {/* Rate Environment */}
            <div className="cerniq-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <p className="cerniq-section-label">{t('Rate Environment', 'Entorno de Tasas')}</p>
                <TrendingUp className="h-5 w-5 text-[#1ABFFF]" />
              </div>
              <div className="space-y-0">
                {RATE_ENVIRONMENT.map((rate, i) => (
                  <div
                    key={rate.label}
                    className={`flex items-center justify-between py-3 ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div>
                      <p className="text-sm font-medium text-slate-700">{rate.label}</p>
                      <p className="text-[11px] text-slate-400">{t(rate.impactEn, rate.impactEs)}</p>
                    </div>
                    <span className="font-display text-sm font-bold text-[#1B3A6B]">{rate.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-[10px] text-slate-400">
                {t('Reference rates -- updated periodically', 'Tasas de referencia -- actualizadas periodicamente')}
              </p>
            </div>
          </div>
        </section>

        {/* -- Module Cards Grid -- */}
        <section className="cerniq-panel p-5 sm:p-6">
          <div className="mb-5">
            <p className="cerniq-section-label">{t('Modules', 'Modulos')}</p>
            <h2 className="mt-2 font-display text-2xl text-slate-950">
              {t('Available Tools', 'Herramientas Disponibles')}
            </h2>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MODULE_CARDS.map((card) => (
              <button
                key={card.href + card.titleEn}
                onClick={() => router.push(card.href)}
                className="group rounded-2xl border-l-4 border-l-[#1B3A6B] border-t border-r border-b border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(27,58,107,0.10)]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <div className="flex items-center gap-2">
                    <span className="rounded-full border border-[#1ABFFF]/30 bg-[#1ABFFF]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1B3A6B]">
                      {t(card.accentEn, card.accentEs)}
                    </span>
                    {'badge' in card && card.badge && (
                      <span className="rounded-full border border-amber-300 bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-[0.18em] text-amber-700">
                        {card.badge}
                      </span>
                    )}
                  </div>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 transition group-hover:border-[#1ABFFF]/40 group-hover:bg-[#1ABFFF]/10">
                    <card.icon className="h-4 w-4 text-[#1ABFFF]" />
                  </div>
                </div>
                <h3 className="font-display text-lg text-slate-950">{t(card.titleEn, card.titleEs)}</h3>
                <p className="mt-2 text-sm leading-6 text-slate-600">{t(card.descEn, card.descEs)}</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[#1ABFFF]">
                  {t('Open module', 'Abrir modulo')}
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* -- Regulatory Calendar -- */}
        <section className="cerniq-panel p-5 sm:p-6">
          <div className="mb-5 flex items-center justify-between">
            <p className="cerniq-section-label">{t('Regulatory Calendar', 'Calendario Regulatorio')}</p>
            <Calendar className="h-5 w-5 text-[#1ABFFF]" />
          </div>

          {calendarLoading ? (
            <div className="py-6 text-center text-sm text-slate-400">
              {t('Loading calendar deadlines...', 'Cargando fechas regulatorias...')}
            </div>
          ) : calendarDeadlines.length === 0 ? (
            <p className="py-6 text-center text-sm text-slate-400">
              {t('No upcoming deadlines', 'No hay fechas limite proximas')}
            </p>
          ) : (
            <div className="space-y-0">
              {calendarDeadlines.slice(0, 6).map((deadline, i) => {
                const days = daysUntil(deadline.deadlineDate);
                const daysLabel =
                  days < 0
                    ? t(`Overdue (${Math.abs(days)}d)`, `Vencido (${Math.abs(days)}d)`)
                    : days === 0
                      ? t('Today', 'Hoy')
                      : `${days}d`;
                return (
                  <button
                    key={deadline.id}
                    onClick={() => router.push(deadline.relatedModule)}
                    className={`flex w-full items-center justify-between rounded-xl px-3 py-3 text-left transition hover:bg-slate-50 ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    } ${urgencyRowBg(deadline.urgency)}`}
                  >
                    <div className="flex items-center gap-3">
                      <span
                        className={`h-2.5 w-2.5 flex-none rounded-full ${urgencyDotColor(
                          deadline.urgency,
                        )}`}
                      />
                      <p className="text-sm font-medium text-slate-700 truncate">
                        {t(deadline.titleEn, deadline.titleEs)}
                      </p>
                    </div>
                    <div className="flex flex-none items-center gap-3 pl-3">
                      <div className="text-right">
                        <p className="text-xs text-slate-500">
                          {formatDeadlineDate(deadline.deadlineDate)}
                        </p>
                        <p
                          className={`text-xs font-semibold ${
                            deadline.urgency === 'CRITICAL' || deadline.urgency === 'OVERDUE'
                              ? 'text-red-600'
                              : deadline.urgency === 'HIGH'
                                ? 'text-amber-600'
                                : 'text-slate-500'
                          }`}
                        >
                          <Clock className="mr-1 inline-block h-3 w-3" />
                          {daysLabel}
                        </p>
                      </div>
                      <ArrowRight className="h-3.5 w-3.5 text-slate-300" />
                    </div>
                  </button>
                );
              })}
            </div>
          )}

          <p className="mt-3 text-right text-[10px] text-slate-400">
            {t('Demo data -- connect your institution for real data', 'Datos de demostracion -- conecte su institucion para datos reales')}
          </p>
        </section>

        {/* -- Empty State: No analysis available -- */}
        {!lastAnalysisDate && (
          <section>
            <EmptyState
              icon={BarChart3}
              title={t('No analysis available', 'No hay analisis disponible')}
              description={t(
                'Upload your balance sheet to start your first ALM analysis. Our team will generate your report in less than 24 hours.',
                'Cargue su hoja de balance para comenzar su primer analisis ALM. Nuestro equipo generara su informe en menos de 24 horas.',
              )}
              actionLabel={t('Upload balance sheet', 'Cargar balance')}
              onAction={() => router.push('/dashboard/upload')}
            />
          </section>
        )}

        {/* -- Quick Actions Bar -- */}
        <section className="cerniq-panel p-5 sm:p-6">
          <div className="mb-4">
            <p className="cerniq-section-label">{t('Quick Actions', 'Acciones Rapidas')}</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => router.push('/dashboard/upload')}
              className="flex items-center justify-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
            >
              <FileText className="h-4 w-4" />
              {t('Generate ALM Report', 'Generar Informe ALM')}
            </button>
            <button
              onClick={() => router.push('/dashboard/upload')}
              className="flex items-center justify-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
            >
              <Upload className="h-4 w-4" />
              {t('Update Balance Sheet', 'Actualizar Balance Sheet')}
            </button>
            <button
              onClick={() => router.push('/alm')}
              className="flex items-center justify-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
            >
              <Users className="h-4 w-4" />
              {t('Prepare ALCO', 'Preparar ALCO')}
            </button>
          </div>
        </section>

      </div>
    </div>
  );
}
