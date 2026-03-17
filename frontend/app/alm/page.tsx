'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  TrendingUp,
  Shield,
  DollarSign,
  ChevronRight,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Building2,
  Download,
  Sparkles,
  SlidersHorizontal,
  X,
  MessageCircle,
} from 'lucide-react';
import RiskScoreGauge from '@/components/alm/RiskScoreGauge';
import RiskBadge from '@/components/alm/RiskBadge';
import AIAdvisorChat from '@/components/alm/AIAdvisorChat';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { usePDFExport } from '@/hooks/usePDFExport';

interface ALMSummary {
  institution: {
    id: string;
    name: string;
    type: string;
    totalAssets: number;
    currency: string;
    reportingDate: string;
  };
  durationGap: {
    assetDuration: number;
    liabilityDuration: number;
    durationGap: number;
    riskProfile: 'asset-sensitive' | 'liability-sensitive' | 'neutral';
  };
  niiSensitivity: {
    scenarios: Array<{
      name: string;
      shiftBps: number;
      niImpact: number;
      niImpactPct: number;
    }>;
    baseNII: number;
    riskRating: 'low' | 'moderate' | 'high' | 'critical';
  };
  liquidity: {
    lcr: number;
    hqla: number;
    netOutflows: number;
    status: 'compliant' | 'warning' | 'breach';
    buffer: number;
  };
  topRisks: string[];
  recommendations: string[];
  riskScore: number;
}

function KPIMetric({
  label,
  value,
  subtitle,
  trend,
  color = 'white',
}: {
  label: string;
  value: string;
  subtitle: string;
  trend?: 'up' | 'down' | 'neutral';
  color?: string;
}) {
  const colorClasses: Record<string, string> = {
    white: 'text-slate-950',
    emerald: 'text-emerald-700',
    amber: 'text-amber-700',
    red: 'text-rose-700',
    cyan: 'text-cyan-700',
    blue: 'text-sky-700',
  };

  return (
    <div className="px-4 py-3">
      <p className="mb-1 text-[11px] font-medium uppercase tracking-wider text-slate-500">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-bold tabular-nums ${colorClasses[color] || colorClasses.white}`}>{value}</span>
        {trend && (
          <span className="flex items-center">
            {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-600" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-rose-600" />}
          </span>
        )}
      </div>
      <p className="text-[11px] text-slate-500 mt-0.5">{subtitle}</p>
    </div>
  );
}

function SectionHeader({ title, action }: { title: string; action?: React.ReactNode }) {
  return (
    <div className="flex items-center justify-between mb-3">
      <h3 className="text-xs font-semibold text-slate-500 uppercase tracking-wider">{title}</h3>
      {action}
    </div>
  );
}

function SkeletonPulse() {
  return (
    <div className="p-6 space-y-6 animate-pulse">
      {/* KPI row */}
      <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 gap-px lg:grid-cols-4">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-white px-4 py-4">
            <div className="mb-3 h-3 w-16 rounded bg-slate-100" />
            <div className="h-6 w-24 rounded bg-slate-100" />
          </div>
        ))}
      </div>
      {/* Main area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-64 rounded-xl border border-slate-200 bg-white" />
        <div className="h-64 rounded-xl border border-slate-200 bg-white lg:col-span-2" />
      </div>
      {/* Nav cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 rounded-xl border border-slate-200 bg-white" />
        ))}
      </div>
    </div>
  );
}

export default function ALMOverviewPage() {
  const router = useRouter();
  const { selectedId, institutions, loading: institutionsLoading } = useALM();
  const { t, ta, locale } = useTranslation();
  const { exportToPDF, isExporting } = usePDFExport();
  const [summary, setSummary] = useState<ALMSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [advisorOpen, setAdvisorOpen] = useState(false);

  const fetchSummary = useCallback(async (institutionId: string) => {
    setLoading(true);
    setError(null);
    try {
      const data = await apiClient.getALMSummary(institutionId);
      setSummary(data);
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, {
        institutionId,
        riskScore: data.riskScore,
        durationGap: data.durationGap.durationGap,
        lcr: data.liquidity.lcr,
      });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : 'Failed to load ALM summary';
      setError(message);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (selectedId) {
      fetchSummary(selectedId);
    }
  }, [selectedId, fetchSummary]);

  // Empty state
  if (!institutionsLoading && institutions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex max-w-lg flex-col items-center rounded-[1.75rem] border border-slate-200 bg-white/90 p-10 text-center shadow-[0_18px_38px_rgba(63,93,132,0.08)]">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
            <Building2 className="h-8 w-8 text-cyan-700" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-950">{t('alm.welcome')}</h2>
          <p className="mb-8 text-sm leading-relaxed text-slate-600">
            {t('alm.welcomeDesc')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/demo?type=bank')}
              className="cerniq-button-primary px-5 py-2.5 text-sm"
            >
              {t('alm.loadDemo')}
            </button>
            <Link
              href="/alm/balance-sheet"
              className="cerniq-button-secondary px-5 py-2.5 text-sm"
            >
              {t('alm.addManually')}
            </Link>
          </div>
          <p className="mt-6 text-[11px] text-slate-500">
            {t('alm.demoDesc')}
          </p>
        </div>
      </div>
    );
  }

  if ((loading && !summary) || institutionsLoading) return <SkeletonPulse />;

  const navCards = [
    { href: '/alm/sensitivity', icon: TrendingUp, title: t('alm.rateSensitivity'), desc: t('alm.rateSensitivityDesc'), accent: 'from-sky-50 to-white border-sky-100 hover:border-sky-200', iconColor: 'text-sky-700' },
    { href: '/alm/liquidity', icon: Shield, title: t('alm.liquidity'), desc: t('alm.liquidityDesc'), accent: 'from-emerald-50 to-white border-emerald-100 hover:border-emerald-200', iconColor: 'text-emerald-700' },
    { href: '/alm/balance-sheet', icon: DollarSign, title: t('alm.balanceSheet'), desc: t('alm.balanceSheetDesc'), accent: 'from-cyan-50 to-white border-cyan-100 hover:border-cyan-200', iconColor: 'text-cyan-700' },
    { href: '/alm/stress-test', icon: Zap, title: t('alm.stressTesting'), desc: t('alm.stressTestingDesc'), accent: 'from-amber-50 to-white border-amber-100 hover:border-amber-200', iconColor: 'text-amber-700' },
    { href: '/alm/scenario-builder', icon: SlidersHorizontal, title: t('sidebar.scenarioBuilder'), desc: 'Custom shock designer', accent: 'from-orange-50 to-white border-orange-100 hover:border-orange-200', iconColor: 'text-orange-700' },
  ];

  const advisorTitle = locale === 'es' ? 'Asesor IA' : 'AI Advisor';
  const advisorDesc = locale === 'es' ? 'Pregunta sobre riesgo' : 'Ask about risk';

  const fallbackRecs = ta('alm.fallbackRecs');

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Institution Header Strip */}
      {summary && (
        <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white/90 px-5 py-3 shadow-[0_18px_38px_rgba(63,93,132,0.08)]">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-cyan-200 bg-cyan-50">
              <Building2 className="h-4 w-4 text-cyan-700" />
            </div>
            <div>
              <h1 className="text-base font-bold text-slate-950">{summary.institution.name}</h1>
              <p className="text-[11px] text-slate-500">
                ${summary.institution.totalAssets.toLocaleString()}M {summary.institution.type.replace(/_/g, ' ')} &middot; {new Date(summary.institution.reportingDate).toLocaleDateString(locale === 'es' ? 'es-PR' : 'en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] font-medium uppercase tracking-wider text-emerald-600">{t('common.liveData')}</span>
            </div>
            <button
              onClick={() => selectedId && fetchSummary(selectedId)}
              disabled={loading}
              className="flex items-center gap-1.5 rounded-full border border-slate-200 bg-white px-3 py-1.5 text-xs text-slate-600 transition hover:border-cyan-300 hover:text-cyan-700 disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-700">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 overflow-hidden rounded-xl border border-slate-200 bg-slate-100 gap-px lg:grid-cols-4">
            <div className="bg-white">
              <KPIMetric
                label={t('alm.durationGap')}
                value={`${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap}yr`}
                subtitle={summary.durationGap.riskProfile.replace(/-/g, ' ')}
                color={Math.abs(summary.durationGap.durationGap) < 1 ? 'emerald' : Math.abs(summary.durationGap.durationGap) < 2 ? 'amber' : 'red'}
              />
            </div>
            <div className="bg-white">
              <KPIMetric
                label={t('alm.baseNII')}
                value={`$${summary.niiSensitivity.baseNII.toFixed(1)}M`}
                subtitle={`Rating: ${summary.niiSensitivity.riskRating}`}
                color={summary.niiSensitivity.riskRating === 'low' ? 'emerald' : summary.niiSensitivity.riskRating === 'moderate' ? 'amber' : 'red'}
              />
            </div>
            <div className="bg-white">
              <KPIMetric
                label={t('alm.lcr')}
                value={`${summary.liquidity.lcr.toFixed(1)}%`}
                subtitle={summary.liquidity.status}
                color={summary.liquidity.status === 'compliant' ? 'emerald' : summary.liquidity.status === 'warning' ? 'amber' : 'red'}
              />
            </div>
            <div className="bg-white">
              <KPIMetric
                label={t('alm.lcrBuffer')}
                value={`${summary.liquidity.buffer > 0 ? '+' : ''}${summary.liquidity.buffer.toFixed(1)}%`}
                subtitle={t('alm.vsMinimum')}
                color={summary.liquidity.buffer >= 20 ? 'cyan' : summary.liquidity.buffer >= 0 ? 'amber' : 'red'}
              />
            </div>
          </div>

          {/* Risk Score + Institution Detail */}
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">
            {/* Risk Score Gauge */}
            <div className="lg:col-span-4 flex flex-col items-center justify-center rounded-xl border border-slate-200 bg-white p-6">
              <RiskScoreGauge score={summary.riskScore} size={220} />
              <p className="text-[11px] text-slate-500 mt-3 uppercase tracking-wider">{t('alm.compositeRisk')}</p>
            </div>

            {/* Top Risks */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title={t('alm.keyRiskFactors')} />
                <RiskBadge status={summary.niiSensitivity.riskRating} size="sm" />
              </div>
              <div className="space-y-2.5">
                {summary.topRisks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-amber-700">{i + 1}</span>
                    </div>
                    <p className="text-sm leading-relaxed text-slate-700">{risk}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Duration & Assets */}
            <div className="lg:col-span-4 rounded-xl border border-slate-200 bg-white p-5">
              <SectionHeader title={t('alm.durationProfile')} />
              <div className="space-y-4 mt-4">
                {/* Duration bar visualization */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>{t('alm.assetDuration')}</span>
                    <span className="font-medium text-slate-950">{summary.durationGap.assetDuration}yr</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-blue-500/60 rounded-full transition-all"
                      style={{ width: `${Math.min((summary.durationGap.assetDuration / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>{t('alm.liabilityDuration')}</span>
                    <span className="font-medium text-slate-950">{summary.durationGap.liabilityDuration}yr</span>
                  </div>
                  <div className="h-2 overflow-hidden rounded-full bg-slate-100">
                    <div
                      className="h-full bg-purple-500/60 rounded-full transition-all"
                      style={{ width: `${Math.min((summary.durationGap.liabilityDuration / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>{t('alm.gap')}</span>
                    <span className={`font-bold ${Math.abs(summary.durationGap.durationGap) < 1 ? 'text-emerald-700' : Math.abs(summary.durationGap.durationGap) < 2 ? 'text-amber-700' : 'text-rose-700'}`}>
                      {summary.durationGap.durationGap > 0 ? '+' : ''}{summary.durationGap.durationGap}yr
                    </span>
                  </div>
                </div>

                <div className="space-y-2 border-t border-slate-200 pt-3">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{t('alm.totalAssets')}</span>
                    <span className="font-medium text-slate-950">${(summary.institution.totalAssets).toLocaleString()}M</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{t('alm.hqla')}</span>
                    <span className="font-medium text-slate-950">${summary.liquidity.hqla.toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{t('alm.netOutflows')}</span>
                    <span className="font-medium text-slate-950">${summary.liquidity.netOutflows.toFixed(1)}M</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <SectionHeader title={t('alm.analysisModules')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
            {navCards.map((item) => (
              <Link
                key={item.href}
                href={`${item.href}?id=${selectedId}`}
                className={`group rounded-xl border bg-gradient-to-br p-4 transition-all ${item.accent}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white">
                      <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-slate-950">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-400 transition group-hover:text-cyan-700" />
                </div>
              </Link>
            ))}
            {/* AI Advisor card */}
            <button
              onClick={() => setAdvisorOpen(true)}
              className="group rounded-xl border bg-gradient-to-br from-amber-50 via-white to-[#1B3A6B]/5 border-amber-200 hover:border-amber-300 p-4 transition-all text-left"
            >
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-gradient-to-br from-amber-100 to-amber-50">
                    <Sparkles className="h-4 w-4 text-amber-600" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-slate-950">{advisorTitle}</p>
                    <p className="text-[11px] text-slate-500">{advisorDesc}</p>
                  </div>
                </div>
                <MessageCircle className="h-4 w-4 text-amber-400 transition group-hover:text-amber-600" />
              </div>
            </button>
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-slate-200 bg-white p-5">
            <SectionHeader title={t('alm.recommendations')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {(summary.recommendations && summary.recommendations.length > 0
                ? summary.recommendations
                : fallbackRecs
              ).map((rec, i) => {
                const priority = i < 1 ? t('common.high') : i < 3 ? t('common.medium') : t('common.low');
                const prioColor = i < 1 ? 'text-rose-700 bg-rose-50 border-rose-200' : i < 3 ? 'text-amber-700 bg-amber-50 border-amber-200' : 'text-emerald-700 bg-emerald-50 border-emerald-200';
                return (
                  <div key={i} className="flex items-start gap-3 rounded-lg bg-slate-50 p-3">
                    <span className={`mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${prioColor}`}>
                      {priority}
                    </span>
                    <p className="text-sm leading-relaxed text-slate-700">{rec}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/alm/sensitivity?id=${selectedId}`}
              className="flex items-center gap-2 rounded-lg border border-sky-200 bg-sky-50 px-4 py-2.5 text-sm font-medium text-sky-700 transition hover:border-sky-300"
            >
              <TrendingUp className="h-4 w-4" /> {t('alm.viewRateSensitivity')}
            </Link>
            <Link
              href={`/alm/stress-test?id=${selectedId}`}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-amber-50 px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:border-amber-300"
            >
              <Zap className="h-4 w-4" /> {t('alm.runStressTest')}
            </Link>
            <button
              onClick={async () => {
                if (!selectedId) return;
                const isDemoInstitution = selectedId.startsWith('demo-');
                analytics.track(EVENTS.ALM_REPORT_DOWNLOADED, { institutionId: selectedId });

                if (!isDemoInstitution) {
                  try {
                    await apiClient.downloadALMReport(selectedId, locale);
                    return;
                  } catch {
                    // Fallback to client-side export below.
                  }
                }

                exportToPDF({
                  elementId: 'alm-report-content',
                  filename: `ALM_Report_${summary?.institution?.name?.replace(/\s+/g, '_') || selectedId}.pdf`,
                });
              }}
              disabled={isExporting}
              className="flex items-center gap-2 rounded-lg border border-cyan-200 bg-cyan-50 px-4 py-2.5 text-sm font-medium text-cyan-700 transition disabled:opacity-50"
            >
              {isExporting ? <RefreshCw className="h-4 w-4 animate-spin" /> : <Download className="h-4 w-4" />}
              {isExporting ? t('common.processing') : t('alm.downloadPdf')}
            </button>
            <button
              onClick={() => setAdvisorOpen(true)}
              className="flex items-center gap-2 rounded-lg border border-amber-200 bg-gradient-to-r from-amber-50 to-white px-4 py-2.5 text-sm font-medium text-amber-700 transition hover:border-amber-300 hover:shadow-sm"
            >
              <Sparkles className="h-4 w-4" />
              {locale === 'es' ? 'Consultar Asesor IA' : 'Ask AI Advisor'}
            </button>
          </div>
        </>
      )}

      {/* ── AI Advisor Slide-Over Panel ── */}
      {advisorOpen && selectedId && (
        <>
          {/* Backdrop */}
          <div
            className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm transition-opacity"
            onClick={() => setAdvisorOpen(false)}
          />
          {/* Panel */}
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <AIAdvisorChat
              institutionId={selectedId}
              onClose={() => setAdvisorOpen(false)}
            />
          </div>
        </>
      )}

      {/* ── Floating AI Advisor Button (visible when panel is closed) ── */}
      {!advisorOpen && selectedId && summary && (
        <button
          onClick={() => setAdvisorOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-[#1B3A6B] to-[#234B82] text-white shadow-lg shadow-[#1B3A6B]/25 transition hover:scale-105 hover:shadow-xl"
          title={locale === 'es' ? 'Asesor IA de Riesgo' : 'AI Risk Advisor'}
        >
          <Sparkles className="h-6 w-6 text-amber-300" />
        </button>
      )}
    </div>
  );
}
