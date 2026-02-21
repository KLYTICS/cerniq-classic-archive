'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RefreshCw,
  Landmark,
  TrendingUp,
  Shield,
  DollarSign,
  ChevronRight,
  Zap,
  ArrowUpRight,
  ArrowDownRight,
  Activity,
  Building2,
  Download,
} from 'lucide-react';
import RiskScoreGauge from '@/components/alm/RiskScoreGauge';
import RiskBadge from '@/components/alm/RiskBadge';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';

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
    white: 'text-white',
    emerald: 'text-emerald-400',
    amber: 'text-amber-400',
    red: 'text-red-400',
    cyan: 'text-cyan-400',
    blue: 'text-blue-400',
  };

  return (
    <div className="px-4 py-3">
      <p className="text-[11px] font-medium text-slate-500 uppercase tracking-wider mb-1">{label}</p>
      <div className="flex items-baseline gap-2">
        <span className={`text-xl font-bold tabular-nums ${colorClasses[color] || colorClasses.white}`}>{value}</span>
        {trend && (
          <span className="flex items-center">
            {trend === 'up' && <ArrowUpRight className="h-3 w-3 text-emerald-400" />}
            {trend === 'down' && <ArrowDownRight className="h-3 w-3 text-red-400" />}
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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06]">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="bg-slate-900/80 px-4 py-4">
            <div className="h-3 bg-slate-800 rounded w-16 mb-3" />
            <div className="h-6 bg-slate-800 rounded w-24" />
          </div>
        ))}
      </div>
      {/* Main area */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        <div className="h-64 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
        <div className="lg:col-span-2 h-64 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
      </div>
      {/* Nav cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        {[1, 2, 3, 4].map((i) => (
          <div key={i} className="h-20 bg-slate-900/40 rounded-xl border border-white/[0.06]" />
        ))}
      </div>
    </div>
  );
}

export default function ALMOverviewPage() {
  const router = useRouter();
  const { selectedId, institutions, loading: institutionsLoading } = useALM();
  const { t, ta } = useTranslation();
  const [summary, setSummary] = useState<ALMSummary | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

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
        <div className="flex flex-col items-center text-center max-w-lg">
          <div className="w-16 h-16 rounded-2xl bg-gradient-to-br from-amber-500/20 to-orange-500/10 border border-amber-500/20 flex items-center justify-center mb-6">
            <Building2 className="h-8 w-8 text-amber-400" />
          </div>
          <h2 className="text-xl font-bold text-white mb-2">{t('alm.welcome')}</h2>
          <p className="text-sm text-slate-400 mb-8 leading-relaxed">
            {t('alm.welcomeDesc')}
          </p>
          <div className="flex gap-3">
            <button
              onClick={() => router.push('/demo?type=bank')}
              className="px-5 py-2.5 bg-amber-500 hover:bg-amber-400 text-slate-900 text-sm font-semibold rounded-lg transition"
            >
              {t('alm.loadDemo')}
            </button>
            <Link
              href="/alm/balance-sheet"
              className="px-5 py-2.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 text-sm rounded-lg transition"
            >
              {t('alm.addManually')}
            </Link>
          </div>
          <p className="text-[11px] text-slate-600 mt-6">
            {t('alm.demoDesc')}
          </p>
        </div>
      </div>
    );
  }

  if ((loading && !summary) || institutionsLoading) return <SkeletonPulse />;

  const navCards = [
    { href: '/alm/sensitivity', icon: TrendingUp, title: t('alm.rateSensitivity'), desc: t('alm.rateSensitivityDesc'), accent: 'from-blue-500/10 to-blue-600/5 border-blue-500/10 hover:border-blue-500/25', iconColor: 'text-blue-400' },
    { href: '/alm/liquidity', icon: Shield, title: t('alm.liquidity'), desc: t('alm.liquidityDesc'), accent: 'from-emerald-500/10 to-emerald-600/5 border-emerald-500/10 hover:border-emerald-500/25', iconColor: 'text-emerald-400' },
    { href: '/alm/balance-sheet', icon: DollarSign, title: t('alm.balanceSheet'), desc: t('alm.balanceSheetDesc'), accent: 'from-purple-500/10 to-purple-600/5 border-purple-500/10 hover:border-purple-500/25', iconColor: 'text-purple-400' },
    { href: '/alm/stress-test', icon: Zap, title: t('alm.stressTesting'), desc: t('alm.stressTestingDesc'), accent: 'from-orange-500/10 to-orange-600/5 border-orange-500/10 hover:border-orange-500/25', iconColor: 'text-orange-400' },
  ];

  const fallbackRecs = ta('alm.fallbackRecs');

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Institution Header Strip */}
      {summary && (
        <div className="flex items-center justify-between bg-slate-900/60 border border-white/[0.06] rounded-xl px-5 py-3">
          <div className="flex items-center gap-3">
            <div className="w-9 h-9 rounded-lg bg-gradient-to-br from-amber-500/20 to-orange-500/20 border border-amber-500/20 flex items-center justify-center">
              <Building2 className="h-4 w-4 text-amber-400" />
            </div>
            <div>
              <h1 className="text-base font-bold text-white">{summary.institution.name}</h1>
              <p className="text-[11px] text-slate-500">
                ${summary.institution.totalAssets.toLocaleString()}M {summary.institution.type.replace(/_/g, ' ')} &middot; Reporting {new Date(summary.institution.reportingDate).toLocaleDateString('en-US', { month: 'short', year: 'numeric' })}
              </p>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-1.5">
              <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[10px] text-emerald-400 font-medium uppercase tracking-wider">{t('common.liveData')}</span>
            </div>
            <button
              onClick={() => selectedId && fetchSummary(selectedId)}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.07] border border-white/[0.08] text-slate-400 hover:text-white px-3 py-1.5 rounded-lg text-xs transition disabled:opacity-50"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} />
              {t('common.refresh')}
            </button>
          </div>
        </div>
      )}

      {error && (
        <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 text-red-300 text-sm">
          {error}
        </div>
      )}

      {summary && (
        <>
          {/* KPI Strip */}
          <div className="grid grid-cols-2 lg:grid-cols-4 gap-px bg-white/[0.03] rounded-xl overflow-hidden border border-white/[0.06]">
            <div className="bg-slate-900/80">
              <KPIMetric
                label={t('alm.durationGap')}
                value={`${summary.durationGap.durationGap > 0 ? '+' : ''}${summary.durationGap.durationGap}yr`}
                subtitle={summary.durationGap.riskProfile.replace(/-/g, ' ')}
                color={Math.abs(summary.durationGap.durationGap) < 1 ? 'emerald' : Math.abs(summary.durationGap.durationGap) < 2 ? 'amber' : 'red'}
              />
            </div>
            <div className="bg-slate-900/80">
              <KPIMetric
                label={t('alm.baseNII')}
                value={`$${summary.niiSensitivity.baseNII.toFixed(1)}M`}
                subtitle={`Rating: ${summary.niiSensitivity.riskRating}`}
                color={summary.niiSensitivity.riskRating === 'low' ? 'emerald' : summary.niiSensitivity.riskRating === 'moderate' ? 'amber' : 'red'}
              />
            </div>
            <div className="bg-slate-900/80">
              <KPIMetric
                label={t('alm.lcr')}
                value={`${summary.liquidity.lcr.toFixed(1)}%`}
                subtitle={summary.liquidity.status}
                color={summary.liquidity.status === 'compliant' ? 'emerald' : summary.liquidity.status === 'warning' ? 'amber' : 'red'}
              />
            </div>
            <div className="bg-slate-900/80">
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
            <div className="lg:col-span-4 bg-slate-900/40 border border-white/[0.06] rounded-xl p-6 flex flex-col items-center justify-center">
              <RiskScoreGauge score={summary.riskScore} size={220} />
              <p className="text-[11px] text-slate-500 mt-3 uppercase tracking-wider">{t('alm.compositeRisk')}</p>
            </div>

            {/* Top Risks */}
            <div className="lg:col-span-4 bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
              <div className="flex items-center justify-between mb-4">
                <SectionHeader title={t('alm.keyRiskFactors')} />
                <RiskBadge status={summary.niiSensitivity.riskRating} size="sm" />
              </div>
              <div className="space-y-2.5">
                {summary.topRisks.map((risk, i) => (
                  <div key={i} className="flex items-start gap-3">
                    <div className="mt-1 w-5 h-5 rounded bg-amber-500/10 border border-amber-500/20 flex items-center justify-center shrink-0">
                      <span className="text-[10px] font-bold text-amber-400">{i + 1}</span>
                    </div>
                    <p className="text-sm text-slate-300 leading-relaxed">{risk}</p>
                  </div>
                ))}
              </div>
            </div>

            {/* Duration & Assets */}
            <div className="lg:col-span-4 bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
              <SectionHeader title={t('alm.durationProfile')} />
              <div className="space-y-4 mt-4">
                {/* Duration bar visualization */}
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>{t('alm.assetDuration')}</span>
                    <span className="text-white font-medium">{summary.durationGap.assetDuration}yr</span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-blue-500/60 rounded-full transition-all"
                      style={{ width: `${Math.min((summary.durationGap.assetDuration / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div>
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1.5">
                    <span>{t('alm.liabilityDuration')}</span>
                    <span className="text-white font-medium">{summary.durationGap.liabilityDuration}yr</span>
                  </div>
                  <div className="h-2 bg-white/[0.04] rounded-full overflow-hidden">
                    <div
                      className="h-full bg-purple-500/60 rounded-full transition-all"
                      style={{ width: `${Math.min((summary.durationGap.liabilityDuration / 10) * 100, 100)}%` }}
                    />
                  </div>
                </div>
                <div className="pt-3 border-t border-white/[0.06]">
                  <div className="flex justify-between text-[11px] text-slate-500 mb-1">
                    <span>{t('alm.gap')}</span>
                    <span className={`font-bold ${Math.abs(summary.durationGap.durationGap) < 1 ? 'text-emerald-400' : Math.abs(summary.durationGap.durationGap) < 2 ? 'text-amber-400' : 'text-red-400'}`}>
                      {summary.durationGap.durationGap > 0 ? '+' : ''}{summary.durationGap.durationGap}yr
                    </span>
                  </div>
                </div>

                <div className="pt-3 border-t border-white/[0.06] space-y-2">
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{t('alm.totalAssets')}</span>
                    <span className="text-white font-medium">${(summary.institution.totalAssets).toLocaleString()}M</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{t('alm.hqla')}</span>
                    <span className="text-white font-medium">${summary.liquidity.hqla.toFixed(1)}M</span>
                  </div>
                  <div className="flex justify-between text-[11px]">
                    <span className="text-slate-500">{t('alm.netOutflows')}</span>
                    <span className="text-white font-medium">${summary.liquidity.netOutflows.toFixed(1)}M</span>
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Quick Navigation */}
          <SectionHeader title={t('alm.analysisModules')} />
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
            {navCards.map((item) => (
              <Link
                key={item.href}
                href={`${item.href}?id=${selectedId}`}
                className={`bg-gradient-to-br border rounded-xl p-4 transition-all group ${item.accent}`}
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-3">
                    <div className="w-9 h-9 rounded-lg bg-white/[0.03] border border-white/[0.06] flex items-center justify-center">
                      <item.icon className={`h-4 w-4 ${item.iconColor}`} />
                    </div>
                    <div>
                      <p className="text-sm font-medium text-white">{item.title}</p>
                      <p className="text-[11px] text-slate-500">{item.desc}</p>
                    </div>
                  </div>
                  <ChevronRight className="h-4 w-4 text-slate-600 group-hover:text-slate-400 transition" />
                </div>
              </Link>
            ))}
          </div>

          {/* Recommendations */}
          <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl p-5">
            <SectionHeader title={t('alm.recommendations')} />
            <div className="grid grid-cols-1 md:grid-cols-2 gap-3 mt-3">
              {(summary.recommendations && summary.recommendations.length > 0
                ? summary.recommendations
                : fallbackRecs
              ).map((rec, i) => {
                const priority = i < 1 ? t('common.high') : i < 3 ? t('common.medium') : t('common.low');
                const prioColor = i < 1 ? 'text-red-400 bg-red-500/10 border-red-500/20' : i < 3 ? 'text-amber-400 bg-amber-500/10 border-amber-500/20' : 'text-emerald-400 bg-emerald-500/10 border-emerald-500/20';
                return (
                  <div key={i} className="flex items-start gap-3 bg-white/[0.02] rounded-lg p-3">
                    <span className={`mt-0.5 text-[9px] font-bold px-1.5 py-0.5 rounded border shrink-0 ${prioColor}`}>
                      {priority}
                    </span>
                    <p className="text-sm text-slate-300 leading-relaxed">{rec}</p>
                  </div>
                );
              })}
            </div>
          </div>

          {/* Quick Action Buttons */}
          <div className="flex flex-wrap gap-3">
            <Link
              href={`/alm/sensitivity?id=${selectedId}`}
              className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/15 border border-blue-500/20 text-blue-300 px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              <TrendingUp className="h-4 w-4" /> {t('alm.viewRateSensitivity')}
            </Link>
            <Link
              href={`/alm/stress-test?id=${selectedId}`}
              className="flex items-center gap-2 bg-orange-500/10 hover:bg-orange-500/15 border border-orange-500/20 text-orange-300 px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              <Zap className="h-4 w-4" /> {t('alm.runStressTest')}
            </Link>
            <a
              href={apiClient.getALMReportUrl(selectedId)}
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/15 border border-amber-500/20 text-amber-300 px-4 py-2.5 rounded-lg text-sm font-medium transition"
            >
              <Download className="h-4 w-4" /> {t('alm.downloadPdf')}
            </a>
          </div>
        </>
      )}
    </div>
  );
}
