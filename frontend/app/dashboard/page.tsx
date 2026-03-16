'use client';

import { useEffect, useMemo } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import {
  ArrowRight,
  BarChart3,
  Building2,
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
import { SkeletonLoader, EmptyState, ErrorBanner } from '@/components/ui/cerniq';

/* ─── Helpers ─── */

function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return 'Buenos dias';
  if (h < 18) return 'Buenas tardes';
  return 'Buenas noches';
}

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

/* ─── Static Data ─── */

const RATE_ENVIRONMENT = [
  { label: 'Fed Funds Rate', value: '4.50%', impact: 'Base rate for loan pricing' },
  { label: 'SOFR', value: '4.32%', impact: 'Variable rate benchmark' },
  { label: '10Y Treasury', value: '4.25%', impact: 'Mortgage/bond yield driver' },
  { label: 'PR Prime', value: '8.50%', impact: 'Local commercial lending' },
];

const ALM_STATUS_ROWS: {
  label: string;
  labelEn: string;
  value: string;
  status: 'green' | 'amber' | 'red';
}[] = [
  { label: 'LCR', labelEn: 'Liquidity Coverage', value: '115.5%', status: 'green' },
  { label: 'Adecuacion de Capital', labelEn: 'Capital Adequacy', value: '12.8%', status: 'green' },
  { label: 'Prestamos/Depositos', labelEn: 'Loan-to-Deposit', value: '82.4%', status: 'amber' },
  { label: 'NIM', labelEn: 'Net Interest Margin', value: '3.15%', status: 'green' },
];

const MODULE_CARDS = [
  {
    title: 'ALM Intelligence',
    titleEs: 'Inteligencia ALM',
    description: 'Duration gap, NII sensitivity, balance sheet analysis.',
    descEs: 'Brecha de duracion, sensibilidad NII, analisis de balance.',
    href: '/alm',
    icon: Landmark,
    accent: 'ALM',
  },
  {
    title: 'COSSEC Compliance',
    titleEs: 'Cumplimiento COSSEC',
    description: 'Regulatory readiness, exam prep, and benchmarks.',
    descEs: 'Preparacion regulatoria, examenes y benchmarks.',
    href: '/alm',
    icon: Shield,
    accent: 'Regulatorio',
  },
  {
    title: 'Stress Testing',
    titleEs: 'Pruebas de Estres',
    description: 'Monte Carlo, rate shocks, and scenario analysis.',
    descEs: 'Monte Carlo, choques de tasas y escenarios.',
    href: '/alm',
    icon: BarChart3,
    accent: 'Estres',
  },
  {
    title: 'Portfolio Risk',
    titleEs: 'Riesgo de Portafolio',
    description: 'VaR, scenarios, volatility, and exposure.',
    descEs: 'VaR, escenarios, volatilidad y exposicion.',
    href: '/risk-analytics',
    icon: TrendingUp,
    accent: 'Riesgo',
  },
  {
    title: 'SpendCheck',
    titleEs: 'Control de Gastos',
    description: 'Receipt parsing, AP controls, and recovery.',
    descEs: 'Analisis de recibos, controles AP y recuperacion.',
    href: '/spendcheck',
    icon: CreditCard,
    accent: 'Gastos',
  },
  {
    title: 'Market Data',
    titleEs: 'Datos de Mercado',
    description: 'Live quotes, research views, and screening.',
    descEs: 'Cotizaciones en vivo, investigacion y screening.',
    href: '/live-data',
    icon: LineChart,
    accent: 'Mercado',
  },
];

/* ─── COSSEC Readiness Gauge (CSS-only) ─── */

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

/* ─── Main Page ─── */

export default function DashboardPage() {
  const { initialized, isAuthenticated, onboardingComplete, user, logout } = useAuthStore();
  const router = useRouter();

  // Mock COSSEC score — will be replaced with real API data when available
  const cossecScore = 72;
  const lastAnalysisDate: string | null = null; // null = no analysis yet
  const daysToExam: number | null = null; // null = unknown

  const greeting = useMemo(() => getGreeting(), []);
  const displayName = user?.name || user?.email?.split('@')[0] || '';

  useEffect(() => {
    if (!initialized) return;
    if (!isAuthenticated) {
      router.push('/login');
      return;
    }
    if (!onboardingComplete) {
      router.push('/onboarding');
    }
  }, [initialized, isAuthenticated, onboardingComplete, router]);

  if (!initialized) {
    return (
      <div className="min-h-screen overflow-x-clip px-4 py-4 text-slate-950 sm:px-5 lg:px-6">
        <div className="mx-auto max-w-7xl space-y-4">
          {/* Skeleton nav */}
          <div className="cerniq-panel px-4 py-3 sm:px-5">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-3">
                <div className="h-6 w-20 rounded-lg" style={{ background: 'linear-gradient(90deg, #CBD5E1 25%, #F8FAFC 50%, #CBD5E1 75%)', backgroundSize: '200% 100%', animation: 'cerniq-shimmer 1.5s infinite ease-in-out' }} />
                <div className="h-4 w-28 rounded-full" style={{ background: 'linear-gradient(90deg, #CBD5E1 25%, #F8FAFC 50%, #CBD5E1 75%)', backgroundSize: '200% 100%', animation: 'cerniq-shimmer 1.5s infinite ease-in-out' }} />
              </div>
            </div>
          </div>
          {/* Skeleton quick stats */}
          <div className="cerniq-panel p-5 sm:p-6">
            <SkeletonLoader variant="text" count={1} />
            <div className="mt-6">
              <SkeletonLoader variant="metric" count={3} />
            </div>
          </div>
          {/* Skeleton module cards */}
          <div className="cerniq-panel p-5 sm:p-6">
            <SkeletonLoader variant="card" count={6} />
          </div>
        </div>
        <style>{`@keyframes cerniq-shimmer { 0% { background-position: 200% 0; } 100% { background-position: -200% 0; } }`}</style>
      </div>
    );
  }

  if (!isAuthenticated || !onboardingComplete) {
    return null;
  }

  return (
    <div className="min-h-screen overflow-x-clip px-4 py-4 text-slate-950 sm:px-5 lg:px-6">
      <div className="mx-auto max-w-7xl space-y-4">

        {/* ── Top Nav ── */}
        <nav className="cerniq-panel px-4 py-3 sm:px-5">
          <div className="flex flex-col gap-4 lg:flex-row lg:items-center lg:justify-between">
            <div className="flex items-center gap-3">
              <div className="font-display text-xl uppercase tracking-[0.24em] text-[#1B3A6B]">
                Cerniq
              </div>
              <span className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                Risk Intelligence
              </span>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              <span className="rounded-full border border-slate-200 bg-white/85 px-4 py-2 text-sm text-slate-600">
                {user?.email}
              </span>
              <button
                onClick={() => router.push('/live-data')}
                className="cerniq-button-secondary px-4 py-2 text-sm"
              >
                Live Data
              </button>
              <button
                onClick={async () => {
                  await logout();
                  router.push('/login');
                }}
                className="flex items-center gap-2 rounded-full border border-red-200 bg-red-50 px-4 py-2 text-sm text-red-700 transition hover:border-red-300"
              >
                <LogOut className="h-3.5 w-3.5" />
                Salir
              </button>
            </div>
          </div>
        </nav>

        {/* ── Hero Section ── */}
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
                  {displayName ? `${displayName}` : 'Panel de Control'}
                </h1>
                <p className="mt-2 text-sm text-slate-500">
                  {lastAnalysisDate
                    ? `Ultimo analisis: ${lastAnalysisDate}`
                    : 'No hay analisis disponible — cargue su balance para comenzar.'}
                  <span className="ml-1 text-xs text-slate-400">
                    {lastAnalysisDate
                      ? '(Last analysis)'
                      : '(No analysis available — upload your balance sheet to start)'}
                  </span>
                </p>

                {/* Quick Stats Row */}
                <div className="mt-6 grid grid-cols-1 gap-3 sm:grid-cols-3">
                  {/* Duration Gap */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Brecha de Duracion
                    </p>
                    <p className="text-xs text-slate-400">(Duration Gap)</p>
                    <p className="mt-2 font-display text-2xl font-bold text-[#1B3A6B]">
                      2.1 <span className="text-sm font-normal text-slate-500">anos</span>
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#E8A020]">
                      Asset-sensitive
                    </span>
                  </div>

                  {/* COSSEC Readiness (compact) */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Preparacion COSSEC
                    </p>
                    <p className="text-xs text-slate-400">(COSSEC Readiness)</p>
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
                      {cossecScore >= 80 ? 'Fuerte' : cossecScore >= 50 ? 'Moderado' : 'En riesgo'}
                    </span>
                  </div>

                  {/* NII Risk Rating */}
                  <div className="rounded-2xl border border-slate-200 bg-white px-4 py-3">
                    <p className="text-[11px] uppercase tracking-[0.18em] text-slate-400">
                      Riesgo NII
                    </p>
                    <p className="text-xs text-slate-400">(NII Risk Rating)</p>
                    <p className="mt-2 font-display text-2xl font-bold text-[#E8A020]">
                      Moderado
                    </p>
                    <span className="mt-1 inline-block rounded-full bg-amber-50 px-2 py-0.5 text-[10px] font-semibold uppercase text-[#E8A020]">
                      +/-12.5% sensibilidad
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* ALM Status Panel */}
            <div className="cerniq-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="cerniq-section-label">Estado ALM</p>
                  <p className="mt-0.5 text-xs text-slate-400">(ALM Status)</p>
                </div>
                <Building2 className="h-5 w-5 text-[#1ABFFF]" />
              </div>
              <div className="space-y-0">
                {ALM_STATUS_ROWS.map((row, i) => (
                  <div
                    key={row.label}
                    className={`flex items-center justify-between py-3 ${
                      i > 0 ? 'border-t border-slate-100' : ''
                    }`}
                  >
                    <div className="flex items-center gap-3">
                      <span className={`h-2.5 w-2.5 flex-none rounded-full ${statusColor(row.status)}`} />
                      <div>
                        <span className="text-sm font-medium text-slate-700">{row.label}</span>
                        <span className="ml-2 text-xs text-slate-400">({row.labelEn})</span>
                      </div>
                    </div>
                    <span className="font-display text-sm font-bold text-slate-900">{row.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-[10px] text-slate-400">
                Datos de demostracion — cargue balance para datos reales
              </p>
            </div>
          </div>

          {/* Right: COSSEC Gauge + Rate Environment */}
          <div className="space-y-4">
            {/* COSSEC Readiness Gauge */}
            <div className="cerniq-panel p-5">
              <div className="mb-4 text-center">
                <p className="cerniq-section-label">Preparacion COSSEC</p>
                <p className="mt-0.5 text-xs text-slate-400">(COSSEC Readiness Score)</p>
              </div>
              <COSSECGauge score={cossecScore} />
              <div className="mt-4 text-center">
                <p className="text-sm font-medium text-slate-700">
                  {cossecScore >= 80
                    ? 'Institucion bien preparada'
                    : cossecScore >= 50
                      ? 'Atencion requerida en algunas areas'
                      : 'Accion inmediata requerida'}
                </p>
                <p className="mt-1 text-xs text-slate-400">
                  {cossecScore >= 80
                    ? '(Institution well prepared)'
                    : cossecScore >= 50
                      ? '(Attention required in some areas)'
                      : '(Immediate action required)'}
                </p>
                <p className="mt-3 text-sm text-slate-600">
                  {daysToExam !== null
                    ? `Proximo examen: ${daysToExam} dias`
                    : 'Fecha de examen: por determinar'}
                </p>
                <p className="text-xs text-slate-400">
                  {daysToExam !== null
                    ? `(Next exam: ${daysToExam} days)`
                    : '(Exam date: to be determined)'}
                </p>
              </div>
            </div>

            {/* Rate Environment */}
            <div className="cerniq-panel p-5">
              <div className="mb-4 flex items-center justify-between">
                <div>
                  <p className="cerniq-section-label">Entorno de Tasas</p>
                  <p className="mt-0.5 text-xs text-slate-400">(Rate Environment)</p>
                </div>
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
                      <p className="text-[11px] text-slate-400">{rate.impact}</p>
                    </div>
                    <span className="font-display text-sm font-bold text-[#1B3A6B]">{rate.value}</span>
                  </div>
                ))}
              </div>
              <p className="mt-3 text-right text-[10px] text-slate-400">
                Tasas de referencia — actualizadas periodicamente
              </p>
            </div>
          </div>
        </section>

        {/* ── Module Cards Grid ── */}
        <section className="cerniq-panel p-5 sm:p-6">
          <div className="mb-5">
            <p className="cerniq-section-label">Modulos</p>
            <h2 className="mt-2 font-display text-2xl text-slate-950">
              Herramientas Disponibles
            </h2>
            <p className="mt-1 text-xs text-slate-400">(Available Tools)</p>
          </div>

          <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
            {MODULE_CARDS.map((card) => (
              <button
                key={card.href + card.title}
                onClick={() => router.push(card.href)}
                className="group rounded-2xl border-l-4 border-l-[#1B3A6B] border-t border-r border-b border-t-slate-200 border-r-slate-200 border-b-slate-200 bg-white px-4 py-4 text-left transition hover:-translate-y-0.5 hover:shadow-[0_18px_38px_rgba(27,58,107,0.10)]"
              >
                <div className="mb-3 flex items-start justify-between gap-3">
                  <span className="rounded-full border border-[#1ABFFF]/30 bg-[#1ABFFF]/10 px-2.5 py-1 text-[10px] font-semibold uppercase tracking-[0.22em] text-[#1B3A6B]">
                    {card.accent}
                  </span>
                  <div className="flex h-10 w-10 items-center justify-center rounded-2xl border border-slate-200 bg-slate-50 transition group-hover:border-[#1ABFFF]/40 group-hover:bg-[#1ABFFF]/10">
                    <card.icon className="h-4 w-4 text-[#1ABFFF]" />
                  </div>
                </div>
                <h3 className="font-display text-lg text-slate-950">{card.titleEs}</h3>
                <p className="text-xs text-slate-400">({card.title})</p>
                <p className="mt-2 text-sm leading-6 text-slate-600">{card.descEs}</p>
                <div className="mt-3 flex items-center gap-2 text-sm font-medium text-[#1ABFFF]">
                  Abrir modulo
                  <ArrowRight className="h-4 w-4" />
                </div>
              </button>
            ))}
          </div>
        </section>

        {/* ── Empty State: No analysis available ── */}
        {!lastAnalysisDate && (
          <section>
            <EmptyState
              icon={BarChart3}
              titleEs="No hay analisis disponible"
              title="No analysis available"
              descriptionEs="Cargue su hoja de balance para comenzar su primer analisis ALM. Nuestro equipo generara su informe en menos de 24 horas."
              description="Upload your balance sheet to start your first ALM analysis. Our team will generate your report in less than 24 hours."
              actionLabelEs="Cargar balance"
              actionLabel="Upload balance sheet"
              onAction={() => router.push('/portal/submit')}
            />
          </section>
        )}

        {/* ── Quick Actions Bar ── */}
        <section className="cerniq-panel p-5 sm:p-6">
          <div className="mb-4">
            <p className="cerniq-section-label">Acciones Rapidas</p>
            <p className="mt-0.5 text-xs text-slate-400">(Quick Actions)</p>
          </div>
          <div className="flex flex-col gap-3 sm:flex-row sm:flex-wrap">
            <button
              onClick={() => router.push('/portal/submit')}
              className="flex items-center justify-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
            >
              <FileText className="h-4 w-4" />
              Generar Informe ALM
            </button>
            <button
              onClick={() => router.push('/portal/submit')}
              className="flex items-center justify-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
            >
              <Upload className="h-4 w-4" />
              Actualizar Balance Sheet
            </button>
            <button
              onClick={() => router.push('/portal/submit')}
              className="flex items-center justify-center gap-2 rounded-full bg-[#E8A020] px-6 py-3 text-sm font-bold text-white shadow-md transition hover:-translate-y-0.5 hover:bg-[#d4911c] hover:shadow-lg"
            >
              <Users className="h-4 w-4" />
              Preparar ALCO
            </button>
          </div>
          <p className="mt-3 text-xs text-slate-400">
            (Generate ALM Report &bull; Update Balance Sheet &bull; Prepare ALCO Meeting)
          </p>
        </section>

      </div>
    </div>
  );
}
