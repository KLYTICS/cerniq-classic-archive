'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { Shield, AlertTriangle, Check, X, Bell } from 'lucide-react';

interface PolicyCheck {
  limitType: string;
  scenario: string;
  actualValue: number;
  watchPct: number;
  warningPct: number;
  breachPct: number;
  level: 'COMPLIANT' | 'WATCH' | 'WARNING' | 'BREACH';
  utilizationPct: number;
  regulatoryRef: string;
}

interface PolicyDashboard {
  checks: PolicyCheck[];
  breachCount: number;
  warningCount: number;
  watchCount: number;
  overallStatus: 'GREEN' | 'AMBER' | 'RED';
  lastChecked: string;
}

const LEVEL_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  COMPLIANT: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200' },
  WATCH: { bg: 'bg-sky-50', text: 'text-sky-700', border: 'border-sky-200' },
  WARNING: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
  BREACH: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
};

const STATUS_BANNER: Record<string, { bg: string; text: string; icon: React.ElementType }> = {
  GREEN: { bg: 'bg-emerald-50 border-emerald-200', text: 'text-emerald-700', icon: Check },
  AMBER: { bg: 'bg-amber-50 border-amber-200', text: 'text-amber-700', icon: AlertTriangle },
  RED: { bg: 'bg-rose-50 border-rose-200', text: 'text-rose-700', icon: X },
};

export default function IRRPolicyPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [dashboard, setDashboard] = useState<PolicyDashboard | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await apiClient.getIRRPolicyDashboard(selectedId);
        setDashboard(data);
      } catch { setDashboard(getDemoDashboard()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !dashboard) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const banner = STATUS_BANNER[dashboard.overallStatus];
  const BannerIcon = banner.icon;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-amber-200 bg-amber-50">
          <Bell className="h-4 w-4 text-amber-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Monitor de Política IRR' : 'IRR Policy Monitor'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? 'Límites EVE/NII/Duración — vigilancia continua' : 'EVE/NII/Duration limits — continuous monitoring'}
          </p>
        </div>
      </div>

      {/* Status Banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${banner.bg}`}>
        <BannerIcon className={`h-6 w-6 ${banner.text}`} />
        <div>
          <p className={`text-sm font-bold ${banner.text}`}>
            {dashboard.overallStatus === 'GREEN' ? (locale === 'es' ? 'Todas las Políticas Cumplidas' : 'All Policies Compliant') :
             dashboard.overallStatus === 'AMBER' ? (locale === 'es' ? 'Advertencias Activas' : 'Active Warnings') :
             locale === 'es' ? 'Incumplimientos de Política Detectados' : 'Policy Breaches Detected'}
          </p>
          <p className="text-xs text-slate-600">
            {dashboard.breachCount} {locale === 'es' ? 'incumplimientos' : 'breaches'} · {dashboard.warningCount} {locale === 'es' ? 'advertencias' : 'warnings'} · {dashboard.watchCount} {locale === 'es' ? 'vigilancia' : 'watches'}
          </p>
        </div>
      </div>

      {/* Limit Status Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3">
        {dashboard.checks.map((check, i) => {
          const style = LEVEL_STYLES[check.level];
          return (
            <div key={i} className={`rounded-xl border p-4 ${style.bg} ${style.border}`}>
              <div className="flex items-start justify-between mb-2">
                <div>
                  <p className="text-xs font-bold text-slate-800">{check.limitType.replace(/_/g, ' ')}</p>
                  <p className="text-[10px] text-slate-500">{check.scenario}</p>
                </div>
                <span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>
                  {check.level}
                </span>
              </div>
              <div className="mt-3">
                <div className="flex justify-between text-[10px] text-slate-500 mb-1">
                  <span>{locale === 'es' ? 'Actual' : 'Actual'}: {check.actualValue.toFixed(1)}%</span>
                  <span>{locale === 'es' ? 'Límite' : 'Limit'}: {check.breachPct}%</span>
                </div>
                <div className="h-2 rounded-full bg-white/60 overflow-hidden">
                  <div
                    className={`h-full rounded-full transition-all ${
                      check.level === 'BREACH' ? 'bg-rose-500' :
                      check.level === 'WARNING' ? 'bg-amber-500' :
                      check.level === 'WATCH' ? 'bg-sky-500' : 'bg-emerald-500'
                    }`}
                    style={{ width: `${Math.min(check.utilizationPct, 100)}%` }}
                  />
                </div>
                <p className="text-[9px] text-slate-400 mt-1.5">{check.regulatoryRef}</p>
              </div>
            </div>
          );
        })}
      </div>

      {/* Full Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100 bg-slate-50/50">
              {[locale === 'es' ? 'Tipo' : 'Type', locale === 'es' ? 'Escenario' : 'Scenario', locale === 'es' ? 'Actual' : 'Actual',
                locale === 'es' ? 'Vigilancia' : 'Watch', locale === 'es' ? 'Advertencia' : 'Warning', locale === 'es' ? 'Incumplimiento' : 'Breach',
                locale === 'es' ? 'Utilización' : 'Utilization', locale === 'es' ? 'Estado' : 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {dashboard.checks.map((c, i) => {
              const style = LEVEL_STYLES[c.level];
              return (
                <tr key={i} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-slate-700 text-xs">{c.limitType.replace(/_/g, ' ')}</td>
                  <td className="px-3 py-2.5 text-xs text-slate-500">{c.scenario}</td>
                  <td className="px-3 py-2.5 tabular-nums font-semibold text-slate-800">{c.actualValue.toFixed(1)}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-slate-400">{c.watchPct}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-slate-400">{c.warningPct}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-slate-400">{c.breachPct}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs">{c.utilizationPct.toFixed(0)}%</td>
                  <td className="px-3 py-2.5"><span className={`rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>{c.level}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getDemoDashboard(): PolicyDashboard {
  return {
    checks: [
      { limitType: 'EVE_PCT', scenario: '+200bps', actualValue: 15.2, watchPct: 12, warningPct: 18, breachPct: 25, level: 'WARNING', utilizationPct: 60.8, regulatoryRef: 'Basel IRRBB — EVE outlier test' },
      { limitType: 'EVE_PCT', scenario: '-200bps', actualValue: 12.8, watchPct: 12, warningPct: 18, breachPct: 25, level: 'WATCH', utilizationPct: 51.2, regulatoryRef: 'Basel IRRBB — EVE outlier test' },
      { limitType: 'NII_AT_RISK', scenario: '+200bps', actualValue: 11.5, watchPct: 10, warningPct: 15, breachPct: 20, level: 'WATCH', utilizationPct: 57.5, regulatoryRef: 'OCIF CC-2022-03 §IV.A' },
      { limitType: 'NII_AT_RISK', scenario: '-100bps', actualValue: 8.2, watchPct: 8, warningPct: 12, breachPct: 15, level: 'WATCH', utilizationPct: 54.7, regulatoryRef: 'OCIF CC-2022-03 §IV.A' },
      { limitType: 'DURATION_GAP', scenario: 'base', actualValue: 2.1, watchPct: 2.5, warningPct: 3.5, breachPct: 5.0, level: 'COMPLIANT', utilizationPct: 42, regulatoryRef: 'COSSEC Examen Art. 7.3' },
      { limitType: 'REPRICING_GAP', scenario: '0-90d', actualValue: 12.5, watchPct: 15, warningPct: 20, breachPct: 25, level: 'COMPLIANT', utilizationPct: 50, regulatoryRef: 'OCIF CC-2022-03 §IV.B' },
    ],
    breachCount: 0, warningCount: 1, watchCount: 3, overallStatus: 'AMBER',
    lastChecked: new Date().toISOString(),
  };
}
