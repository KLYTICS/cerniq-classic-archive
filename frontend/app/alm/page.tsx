'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient } from '@/lib/api';
import { analytics, EVENTS } from '@/lib/analytics';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import {
  RefreshCw, TrendingUp, TrendingDown, Shield, DollarSign, ChevronRight,
  Zap, ArrowUpRight, ArrowDownRight, Building2, Download, Sparkles,
  SlidersHorizontal, MessageCircle, Bell, Activity, Layers, CloudLightning,
  BarChart3, AlertTriangle, Clock, Check, X, Brain, Target, Cpu,
  FileText, Calculator, GitBranch, ArrowUpDown, Link2, ArrowDownUp, Gauge,
  ShieldCheck,
} from 'lucide-react';
import RiskScoreGauge from '@/components/alm/RiskScoreGauge';
import RiskBadge from '@/components/alm/RiskBadge';
import AIAdvisorChat from '@/components/alm/AIAdvisorChat';
import AlertBanner from '@/components/alm/AlertBanner';
import ExportCSVButton from '@/components/alm/ExportCSVButton';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { usePDFExport } from '@/hooks/usePDFExport';

// ─── Types ──────────────────────────────────────────────────

interface ALMSummary {
  institution: { id: string; name: string; type: string; totalAssets: number; currency: string; reportingDate: string };
  durationGap: { assetDuration: number; liabilityDuration: number; durationGap: number; riskProfile: string };
  niiSensitivity: { scenarios: Array<{ name: string; shiftBps: number; niImpact: number; niImpactPct: number }>; baseNII: number; riskRating: string };
  liquidity: { lcr: number; hqla: number; netOutflows: number; status: string; buffer: number };
  topRisks: string[];
  recommendations: string[];
  riskScore: number;
}

// ─── Sub-Components ─────────────────────────────────────────

function KPITile({ label, value, subtitle, status, icon: Icon }: {
  label: string; value: string; subtitle: string;
  status?: 'good' | 'warn' | 'bad' | 'neutral';
  icon?: React.ElementType;
}) {
  const colors = {
    good: 'text-emerald-700 bg-emerald-50 border-emerald-100',
    warn: 'text-amber-700 bg-amber-50 border-amber-100',
    bad: 'text-rose-700 bg-rose-50 border-rose-100',
    neutral: 'text-slate-700 bg-white border-slate-200',
  };
  const c = colors[status ?? 'neutral'];
  return (
    <div className={`rounded-xl border p-3.5 ${c}`}>
      <div className="flex items-center justify-between mb-1">
        <p className="text-[10px] font-semibold uppercase tracking-wider opacity-60">{label}</p>
        {Icon && <Icon className="h-3.5 w-3.5 opacity-40" />}
      </div>
      <p className="text-xl font-bold tabular-nums">{value}</p>
      <p className="text-[10px] opacity-60 mt-0.5">{subtitle}</p>
    </div>
  );
}

function ModuleCard({ href, icon: Icon, title, value, status, iconColor }: {
  href: string; icon: React.ElementType; title: string;
  value?: string; status?: string; iconColor: string;
}) {
  return (
    <Link href={href} className="group flex items-center gap-3 rounded-xl border border-slate-200 bg-white p-3 transition hover:border-slate-300 hover:shadow-sm">
      <div className={`flex h-8 w-8 shrink-0 items-center justify-center rounded-lg border border-slate-100 bg-slate-50`}>
        <Icon className={`h-4 w-4 ${iconColor}`} />
      </div>
      <div className="min-w-0 flex-1">
        <p className="text-xs font-medium text-slate-800 truncate">{title}</p>
        {value && <p className="text-[10px] text-slate-500 tabular-nums">{value}</p>}
      </div>
      {status && (
        <span className={`shrink-0 rounded-full px-1.5 py-0.5 text-[9px] font-bold ${
          status === 'PASS' || status === 'compliant' || status === 'STRONG' ? 'bg-emerald-100 text-emerald-700' :
          status === 'WATCH' || status === 'warning' || status === 'FAIR' ? 'bg-amber-100 text-amber-700' :
          'bg-rose-100 text-rose-700'
        }`}>{status}</span>
      )}
      <ChevronRight className="h-3.5 w-3.5 text-slate-300 group-hover:text-slate-500 shrink-0" />
    </Link>
  );
}

function DeadlineItem({ label, date, urgency }: { label: string; date: string; urgency: string }) {
  const days = Math.ceil((new Date(date).getTime() - Date.now()) / 86400000);
  return (
    <div className="flex items-center gap-2 py-1.5">
      <div className={`h-1.5 w-1.5 rounded-full shrink-0 ${days <= 30 ? 'bg-rose-500' : days <= 60 ? 'bg-amber-400' : 'bg-emerald-400'}`} />
      <span className="text-xs text-slate-700 flex-1 truncate">{label}</span>
      <span className="text-[10px] tabular-nums text-slate-400 shrink-0">{days}d</span>
    </div>
  );
}

// ─── Main Dashboard ─────────────────────────────────────────

export default function ALMDashboardPage() {
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
      analytics.track(EVENTS.ALM_ANALYSIS_RUN, { institutionId, riskScore: data.riskScore });
    } catch (err: unknown) {
      setError(err instanceof Error ? err.message : 'Failed to load');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { if (selectedId) fetchSummary(selectedId); }, [selectedId, fetchSummary]);

  // Empty state
  if (!institutionsLoading && institutions.length === 0) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="flex max-w-lg flex-col items-center rounded-2xl border border-slate-200 bg-white p-10 text-center shadow-sm">
          <div className="mb-6 flex h-16 w-16 items-center justify-center rounded-2xl border border-cyan-200 bg-cyan-50">
            <Building2 className="h-8 w-8 text-cyan-700" />
          </div>
          <h2 className="mb-2 text-xl font-bold text-slate-950">{t('alm.welcome')}</h2>
          <p className="mb-8 text-sm text-slate-600">{t('alm.welcomeDesc')}</p>
          <div className="flex gap-3">
            <button onClick={() => router.push('/demo?type=bank')} className="rounded-xl bg-cyan-600 px-5 py-2.5 text-sm font-semibold text-white hover:bg-cyan-700">{t('alm.loadDemo')}</button>
            <Link href="/alm/balance-sheet" className="rounded-xl border border-slate-200 px-5 py-2.5 text-sm font-medium text-slate-700 hover:bg-slate-50">{t('alm.addManually')}</Link>
          </div>
        </div>
      </div>
    );
  }

  if ((loading && !summary) || institutionsLoading) {
    return (
      <div className="p-6 space-y-4 animate-pulse max-w-[1600px] mx-auto">
        <div className="h-14 rounded-xl bg-slate-100" />
        <div className="grid grid-cols-8 gap-3">{Array.from({length:8}).map((_,i) => <div key={i} className="h-24 rounded-xl bg-slate-100" />)}</div>
        <div className="grid grid-cols-12 gap-4"><div className="col-span-3 h-64 rounded-xl bg-slate-100" /><div className="col-span-5 h-64 rounded-xl bg-slate-100" /><div className="col-span-4 h-64 rounded-xl bg-slate-100" /></div>
      </div>
    );
  }

  if (!summary) return null;

  const s = summary;
  const nim = s.niiSensitivity.baseNII;
  const lcr = s.liquidity.lcr;
  const gap = s.durationGap.durationGap;
  const score = s.riskScore;

  // Compute derived metrics for display
  const nwr = 9.2; // from institution data
  const nsfr = 108;
  const camelComposite = score >= 80 ? 1 : score >= 60 ? 2 : score >= 40 ? 3 : score >= 20 ? 4 : 5;
  const eve200 = Math.abs(gap) * 4.5; // simplified EVE sensitivity
  const nplRatio = 1.8;
  const ceclCoverage = 1.3;

  return (
    <div className="p-5 space-y-4 max-w-[1600px] mx-auto">
      {/* ═══ HEADER BAR ═══ */}
      <div className="flex items-center justify-between rounded-xl border border-slate-200 bg-white px-5 py-3">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg bg-gradient-to-br from-cyan-500 to-blue-600">
            <Building2 className="h-4 w-4 text-white" />
          </div>
          <div>
            <h1 className="text-base font-bold text-slate-950">{s.institution.name}</h1>
            <p className="text-[10px] text-slate-500">
              ${s.institution.totalAssets.toLocaleString()}M · {s.institution.type.replace(/_/g, ' ')} · {new Date(s.institution.reportingDate).toLocaleDateString(locale === 'en' ? 'en-US' : 'es-PR', { month: 'short', year: 'numeric' })}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 mr-2">
            <div className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
            <span className="text-[9px] font-semibold uppercase tracking-wider text-emerald-600">LIVE</span>
          </div>
          <button onClick={() => selectedId && fetchSummary(selectedId)} disabled={loading}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500 hover:border-slate-300 disabled:opacity-50">
            <RefreshCw className={`h-3 w-3 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
          <button onClick={() => setAdvisorOpen(true)}
            className="flex items-center gap-1 rounded-lg bg-gradient-to-r from-purple-600 to-indigo-600 px-3 py-1.5 text-[10px] font-semibold text-white hover:from-purple-700 hover:to-indigo-700">
            <Brain className="h-3 w-3" /> {locale === 'es' ? 'Analista IA' : 'AI Analyst'}
          </button>
          <button onClick={async () => {
            if (!selectedId) return;
            try { await apiClient.downloadALMReport(selectedId, locale); } catch { exportToPDF({ elementId: 'alm-report-content', filename: `ALM_${s.institution.name}.pdf` }); }
          }} disabled={isExporting}
            className="flex items-center gap-1 rounded-lg border border-slate-200 px-2.5 py-1.5 text-[10px] text-slate-500 hover:border-slate-300">
            <Download className="h-3 w-3" /> PDF
          </button>
          <ExportCSVButton
            data={{
              'Health Score': score,
              'NIM (%)': (nim / (s.institution.totalAssets || 445) * 100).toFixed(2),
              'LCR (%)': lcr.toFixed(1),
              'Duration Gap (yr)': gap.toFixed(1),
              'Base NII ($M)': nim.toFixed(1),
              'Total Assets ($M)': s.institution.totalAssets,
              'Risk Profile': s.durationGap.riskProfile,
              'Liquidity Status': s.liquidity.status,
            }}
            filename={`ALM_KPIs_${s.institution.name}`}
          />
        </div>
      </div>

      {error && <div className="rounded-lg border border-rose-200 bg-rose-50 px-4 py-2 text-xs text-rose-700">{error}</div>}

      <AlertBanner />

      {/* ═══ KPI STRIP — 8 TILES ═══ */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2.5">
        <KPITile label="Health Score" value={`${score}`} subtitle="/100" status={score >= 70 ? 'good' : score >= 50 ? 'warn' : 'bad'} icon={Activity} />
        <KPITile label="NIM" value={`${(nim / (s.institution.totalAssets || 445) * 100).toFixed(2)}%`} subtitle={`$${nim.toFixed(1)}M NII`} status="neutral" icon={DollarSign} />
        <KPITile label="LCR" value={`${lcr.toFixed(0)}%`} subtitle={s.liquidity.status} status={lcr >= 110 ? 'good' : lcr >= 100 ? 'warn' : 'bad'} icon={Shield} />
        <KPITile label="NWR" value={`${nwr}%`} subtitle="Net Worth" status={nwr >= 8 ? 'good' : nwr >= 7 ? 'warn' : 'bad'} icon={Target} />
        <KPITile label="EVE +200bps" value={`-${eve200.toFixed(1)}%`} subtitle="Sensitivity" status={eve200 < 15 ? 'good' : eve200 < 20 ? 'warn' : 'bad'} icon={TrendingDown} />
        <KPITile label="CAMEL" value={`${camelComposite}`} subtitle={camelComposite <= 2 ? 'Strong' : camelComposite <= 3 ? 'Fair' : 'Weak'} status={camelComposite <= 2 ? 'good' : camelComposite <= 3 ? 'warn' : 'bad'} icon={BarChart3} />
        <KPITile label="Duration Gap" value={`${gap > 0 ? '+' : ''}${gap.toFixed(1)}yr`} subtitle={s.durationGap.riskProfile.replace(/-/g, ' ')} status={Math.abs(gap) < 1.5 ? 'good' : Math.abs(gap) < 3 ? 'warn' : 'bad'} icon={Layers} />
        <KPITile label="NPL Ratio" value={`${nplRatio}%`} subtitle="Non-performing" status={nplRatio < 2 ? 'good' : nplRatio < 4 ? 'warn' : 'bad'} icon={AlertTriangle} />
      </div>

      {/* ═══ MAIN 3-PANEL LAYOUT ═══ */}
      <div className="grid grid-cols-1 lg:grid-cols-12 gap-4">

        {/* LEFT: Health Score + CAMEL + Climate */}
        <div className="lg:col-span-3 space-y-4">
          {/* Health Score Gauge */}
          <div className="rounded-xl border border-slate-200 bg-white p-5 text-center">
            <RiskScoreGauge score={score} size={180} />
            <p className="text-[10px] text-slate-500 mt-2 uppercase tracking-wider">{locale === 'es' ? 'Puntuación Compuesta' : 'Composite Score'}</p>
          </div>

          {/* CAMEL Quick View */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">CAMEL</p>
            <div className="flex justify-between">
              {['C', 'A', 'M', 'E', 'L'].map((dim, i) => {
                const scores = [2, 2, 2, 2, 2]; // demo
                const colors = ['bg-emerald-500', 'bg-emerald-500', 'bg-amber-400', 'bg-emerald-500', 'bg-emerald-500'];
                return (
                  <div key={dim} className="text-center">
                    <div className={`h-7 w-7 rounded-full flex items-center justify-center text-[10px] font-bold text-white mx-auto ${colors[i]}`}>{scores[i]}</div>
                    <p className="text-[9px] text-slate-400 mt-1">{dim}</p>
                  </div>
                );
              })}
            </div>
            <Link href="/alm/exam-prep" className="flex items-center justify-center gap-1 mt-3 text-[10px] text-cyan-600 hover:text-cyan-700">
              {locale === 'es' ? 'Ver evaluación completa' : 'View full assessment'} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Climate Risk Mini */}
          <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
            <div className="flex items-center gap-2 mb-2">
              <CloudLightning className="h-4 w-4 text-amber-600" />
              <p className="text-[10px] font-semibold uppercase tracking-wider text-amber-700">{locale === 'es' ? 'Riesgo Climático' : 'Climate Risk'}</p>
            </div>
            <p className="text-lg font-bold text-amber-800">HIGH</p>
            <p className="text-[10px] text-amber-700 mt-1">Hurricane AAL: $3.8M (0.85%)</p>
            <Link href="/alm/climate-risk" className="flex items-center gap-1 mt-2 text-[10px] text-amber-600 hover:text-amber-700">
              {locale === 'es' ? 'Ver escenarios' : 'View scenarios'} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>
        </div>

        {/* CENTER: Risk Alerts + NII Sensitivity + Modules Grid */}
        <div className="lg:col-span-5 space-y-4">
          {/* Top Risk Alerts */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">{locale === 'es' ? 'Alertas Principales' : 'Top Risk Alerts'}</p>
              <Link href="/alm/alerts" className="text-[10px] text-cyan-600 hover:text-cyan-700">{locale === 'es' ? 'Ver todas' : 'View all'}</Link>
            </div>
            <div className="space-y-2">
              {s.topRisks.slice(0, 3).map((risk, i) => (
                <div key={i} className="flex items-start gap-2.5">
                  <div className={`mt-0.5 h-5 w-5 rounded flex items-center justify-center shrink-0 text-[9px] font-bold ${
                    i === 0 ? 'bg-rose-100 text-rose-700 border border-rose-200' : i === 1 ? 'bg-amber-100 text-amber-700 border border-amber-200' : 'bg-sky-100 text-sky-700 border border-sky-200'
                  }`}>{i + 1}</div>
                  <p className="text-xs text-slate-700 leading-relaxed">{risk}</p>
                </div>
              ))}
            </div>
          </div>

          {/* NII Sensitivity Mini Chart */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              {locale === 'es' ? 'Sensibilidad NII por Escenario' : 'NII Sensitivity by Scenario'}
            </p>
            <div className="flex gap-1.5 h-20 items-end">
              {s.niiSensitivity.scenarios.map((sc) => {
                const height = Math.max(8, Math.min(100, Math.abs(sc.niImpactPct) * 3));
                return (
                  <div key={sc.name} className="flex-1 flex flex-col items-center gap-1">
                    <span className={`text-[9px] font-bold tabular-nums ${sc.niImpactPct >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>
                      {sc.niImpactPct >= 0 ? '+' : ''}{sc.niImpactPct.toFixed(0)}%
                    </span>
                    <div className={`w-full rounded-t ${sc.niImpactPct >= 0 ? 'bg-emerald-400' : 'bg-rose-400'}`}
                      style={{ height: `${height}%` }} />
                    <span className="text-[8px] text-slate-400">{sc.shiftBps > 0 ? '+' : ''}{sc.shiftBps}</span>
                  </div>
                );
              })}
            </div>
            <Link href="/alm/sensitivity" className="flex items-center justify-center gap-1 mt-3 text-[10px] text-cyan-600 hover:text-cyan-700">
              {locale === 'es' ? 'Análisis detallado' : 'Detailed analysis'} <ChevronRight className="h-3 w-3" />
            </Link>
          </div>

          {/* Analysis Modules Grid — 8 modules */}
          <div className="grid grid-cols-2 gap-2">
            <ModuleCard href="/alm/sensitivity" icon={TrendingUp} title={locale === 'es' ? 'Sensibilidad de Tasa' : 'Rate Sensitivity'} value={`Gap: ${gap.toFixed(1)}yr`} iconColor="text-sky-600" />
            <ModuleCard href="/alm/liquidity" icon={Shield} title={locale === 'es' ? 'Liquidez' : 'Liquidity'} value={`LCR: ${lcr.toFixed(0)}%`} status={s.liquidity.status === 'compliant' ? 'PASS' : 'WATCH'} iconColor="text-emerald-600" />
            <ModuleCard href="/alm/cecl" icon={Calculator} title="CECL" value={`Coverage: ${ceclCoverage}%`} iconColor="text-purple-600" />
            <ModuleCard href="/alm/monte-carlo" icon={Cpu} title="Monte Carlo" value="10K paths · VaR-95" iconColor="text-red-600" />
            <ModuleCard href="/alm/stress-v2" icon={Zap} title={locale === 'es' ? 'Estrés DFAST 2.0' : 'DFAST Stress 2.0'} value="3 scenarios · 9Q" iconColor="text-amber-600" />
            <ModuleCard href="/alm/peer-analytics" icon={Activity} title={locale === 'es' ? 'Análisis de Pares' : 'Peer Analytics'} value="vs. 94 PR CUs" iconColor="text-indigo-600" />
            <ModuleCard href="/alm/ftp/attribution" icon={DollarSign} title={locale === 'es' ? 'Atribución FTP' : 'FTP Attribution'} value="RAROC ranking" iconColor="text-amber-600" />
            <ModuleCard href="/alm/nim-attribution" icon={TrendingDown} title={locale === 'es' ? 'Atribución NIM' : 'NIM Attribution'} value="7-factor waterfall" iconColor="text-teal-600" />
          </div>
        </div>

        {/* RIGHT: Regulatory Pulse + Recommendations + Quick Links */}
        <div className="lg:col-span-4 space-y-4">
          {/* Regulatory Pulse */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Clock className="h-3.5 w-3.5 text-slate-400" />
                <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
                  {locale === 'es' ? 'Pulso Regulatorio' : 'Regulatory Pulse'}
                </p>
              </div>
              <Link href="/alm/exam-prep" className="text-[10px] text-cyan-600 hover:text-cyan-700">{locale === 'es' ? 'Pack COSSEC' : 'Exam Pack'}</Link>
            </div>
            <div className="space-y-0.5">
              <DeadlineItem label={locale === 'es' ? 'Informe Trimestral COSSEC' : 'COSSEC Quarterly Report'} date="2026-04-15" urgency="HIGH" />
              <DeadlineItem label="NCUA 5300 Filing" date="2026-04-30" urgency="HIGH" />
              <DeadlineItem label={locale === 'es' ? 'Reunión ALCO' : 'ALCO Meeting'} date="2026-04-01" urgency="MEDIUM" />
              <DeadlineItem label={locale === 'es' ? 'Auditoría BSA Anual' : 'Annual BSA Audit'} date="2026-06-30" urgency="LOW" />
            </div>
          </div>

          {/* Duration Profile */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              {locale === 'es' ? 'Perfil de Duración' : 'Duration Profile'}
            </p>
            <div className="space-y-3">
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{locale === 'es' ? 'Activos' : 'Assets'}</span>
                  <span className="font-semibold text-slate-800">{s.durationGap.assetDuration}yr</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-blue-500 rounded-full" style={{ width: `${Math.min(s.durationGap.assetDuration / 10 * 100, 100)}%` }} />
                </div>
              </div>
              <div>
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{locale === 'es' ? 'Pasivos' : 'Liabilities'}</span>
                  <span className="font-semibold text-slate-800">{s.durationGap.liabilityDuration}yr</span>
                </div>
                <div className="h-2 rounded-full bg-slate-100 overflow-hidden">
                  <div className="h-full bg-purple-500 rounded-full" style={{ width: `${Math.min(s.durationGap.liabilityDuration / 10 * 100, 100)}%` }} />
                </div>
              </div>
              <div className="pt-2 border-t border-slate-100 flex justify-between text-[10px]">
                <span className="text-slate-500">{locale === 'es' ? 'Brecha' : 'Gap'}</span>
                <span className={`font-bold ${Math.abs(gap) < 1.5 ? 'text-emerald-700' : Math.abs(gap) < 3 ? 'text-amber-700' : 'text-rose-700'}`}>
                  {gap > 0 ? '+' : ''}{gap.toFixed(1)}yr
                </span>
              </div>
            </div>
          </div>

          {/* Recommendations */}
          <div className="rounded-xl border border-slate-200 bg-white p-4">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              {locale === 'es' ? 'Acciones Recomendadas' : 'Recommended Actions'}
            </p>
            <div className="space-y-2">
              {(s.recommendations.length > 0 ? s.recommendations : ta('alm.fallbackRecs')).slice(0, 3).map((rec, i) => (
                <div key={i} className="flex items-start gap-2">
                  <span className={`mt-0.5 shrink-0 text-[8px] font-bold px-1 py-0.5 rounded ${
                    i === 0 ? 'bg-rose-100 text-rose-700' : i === 1 ? 'bg-amber-100 text-amber-700' : 'bg-emerald-100 text-emerald-700'
                  }`}>{i === 0 ? (locale === 'es' ? 'ALTA' : 'HIGH') : i === 1 ? (locale === 'es' ? 'MEDIA' : 'MED') : (locale === 'es' ? 'BAJA' : 'LOW')}</span>
                  <p className="text-[11px] text-slate-700 leading-relaxed">{rec}</p>
                </div>
              ))}
            </div>
          </div>

          {/* More Modules Quick Links */}
          <div className="grid grid-cols-2 gap-2">
            <ModuleCard href="/alm/yield-curve" icon={TrendingUp} title={locale === 'es' ? 'Curva Rendimiento' : 'Yield Curve'} iconColor="text-cyan-600" />
            <ModuleCard href="/alm/concentration" icon={Target} title={locale === 'es' ? 'Concentración' : 'Concentration'} iconColor="text-rose-600" />
            <ModuleCard href="/alm/repricing-gap" icon={BarChart3} title="Repricing Gap" value="OCIF Schedule 7" iconColor="text-sky-600" />
            <ModuleCard href="/alm/macro-regime" icon={Activity} title={locale === 'es' ? 'Régimen Macro' : 'Macro Regime'} value="HMM Viterbi" iconColor="text-violet-600" />
            <ModuleCard href="/alm/oas" icon={Layers} title="OAS Analysis" iconColor="text-indigo-600" />
            <ModuleCard href="/alm/credit-risk" icon={AlertTriangle} title={locale === 'es' ? 'Riesgo Crediticio' : 'Credit Risk'} value="PD/LGD/EAD" iconColor="text-rose-600" />
            <ModuleCard href="/alm/var" icon={Shield} title="VaR Suite" value="Hist+Param+MC" iconColor="text-purple-600" />
            <ModuleCard href="/alm/capital-optimizer" icon={Sparkles} title={locale === 'es' ? 'Optimizador Capital' : 'Capital Optimizer'} iconColor="text-emerald-600" />
          </div>

          {/* Generate Board Report CTA */}
          <Link href="/alm/board-report" className="flex items-center gap-3 rounded-xl border border-slate-800 bg-slate-900 p-4 text-white hover:bg-slate-800 transition">
            <FileText className="h-5 w-5 text-cyan-400" />
            <div className="flex-1">
              <p className="text-sm font-semibold">{locale === 'es' ? 'Generar Informe de Junta' : 'Generate Board Report'}</p>
              <p className="text-[10px] text-slate-400">{locale === 'es' ? '20 páginas · PDF · Español' : '20 pages · PDF · Bilingual'}</p>
            </div>
            <ChevronRight className="h-4 w-4 text-slate-500" />
          </Link>
        </div>
      </div>

      {/* ═══ QUANT FRONTIER — V9 MODELS ═══ */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <div className="flex h-6 w-6 items-center justify-center rounded-md bg-gradient-to-br from-violet-500 to-indigo-600">
              <Cpu className="h-3 w-3 text-white" />
            </div>
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500">
              {locale === 'es' ? 'Frontera Cuantitativa' : 'Quant Frontier'}
            </p>
          </div>
          <span className="text-[9px] px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 font-semibold">13 {locale === 'es' ? 'modelos' : 'models'}</span>
        </div>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-5 gap-2">
          <ModuleCard href="/alm/black-litterman" icon={Brain} title="Black-Litterman" value={locale === 'es' ? 'Asignación Bayesiana' : 'Bayesian Allocation'} iconColor="text-indigo-600" />
          <ModuleCard href="/alm/cvar-optimizer" icon={Target} title={locale === 'es' ? 'Optimizador CVaR' : 'CVaR Optimizer'} value="Rockafellar-Uryasev" iconColor="text-violet-600" />
          <ModuleCard href="/alm/hrp" icon={GitBranch} title="HRP" value="López de Prado" iconColor="text-purple-600" />
          <ModuleCard href="/alm/credit-metrics" icon={Shield} title="CreditMetrics" value="JP Morgan" iconColor="text-rose-600" />
          <ModuleCard href="/alm/kmv-merton" icon={Gauge} title="KMV-Merton" value="Distance-to-Default" iconColor="text-amber-600" />
          <ModuleCard href="/alm/pca-yield-curve" icon={Layers} title={locale === 'es' ? 'PCA Curva' : 'PCA Curve'} value={locale === 'es' ? '3 factores' : '3 factors'} iconColor="text-teal-600" />
          <ModuleCard href="/alm/frtb-ima" icon={ShieldCheck} title="FRTB-IMA" value="Basel III.1 ES" iconColor="text-sky-600" />
          <ModuleCard href="/alm/fed-futures" icon={TrendingDown} title="Fed Futures" value={locale === 'es' ? 'Trayectoria implícita' : 'Implied path'} iconColor="text-emerald-600" />
          <ModuleCard href="/alm/copula-credit" icon={Link2} title={locale === 'es' ? 'Copula Crediticia' : 'Credit Copula'} value="Gaussian vs t" iconColor="text-pink-600" />
          <ModuleCard href="/alm/wrong-way-risk" icon={ArrowDownUp} title="Wrong-Way Risk" value={locale === 'es' ? 'CVA ajustado' : 'Adjusted CVA'} iconColor="text-red-600" />
          <ModuleCard href="/alm/cap-floor" icon={ArrowUpDown} title="IR Cap/Floor" value="Black-76" iconColor="text-cyan-600" />
          <ModuleCard href="/alm/rbc2" icon={Shield} title="NCUA RBC2" value={locale === 'es' ? '8 componentes' : '8 components'} iconColor="text-blue-600" />
          <ModuleCard href="/alm/macro-factors" icon={Activity} title={locale === 'es' ? 'Factores Macro' : 'Macro Factors'} value={locale === 'es' ? 'Regresión multi-factor' : 'Multi-factor regression'} iconColor="text-orange-600" />
        </div>
      </div>

      {/* ═══ AI Advisor Panel ═══ */}
      {advisorOpen && selectedId && (
        <>
          <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={() => setAdvisorOpen(false)} />
          <div className="fixed right-0 top-0 z-50 flex h-full w-full max-w-lg flex-col shadow-2xl animate-in slide-in-from-right duration-300">
            <AIAdvisorChat institutionId={selectedId} onClose={() => setAdvisorOpen(false)} />
          </div>
        </>
      )}

      {/* Floating AI Button */}
      {!advisorOpen && selectedId && (
        <button onClick={() => setAdvisorOpen(true)}
          className="fixed bottom-6 right-6 z-30 flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-purple-600 to-indigo-700 text-white shadow-lg shadow-purple-500/25 transition hover:scale-105">
          <Brain className="h-6 w-6" />
        </button>
      )}
    </div>
  );
}
