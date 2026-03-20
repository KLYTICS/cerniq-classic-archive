'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer, Cell } from 'recharts';
import { ShieldAlert, AlertTriangle, Check, X } from 'lucide-react';

interface CreditRiskSegment {
  segmentName: string; balance: number; annualPD: number; lifetimePD: number;
  lgd: number; expectedLoss: number; unexpectedLoss: number; economicCapital: number;
  elPct: number; ecPct: number;
}

interface CreditRiskPortfolio {
  segments: CreditRiskSegment[]; totalEAD: number; totalEL: number;
  totalUL: number; totalEC: number; portfolioElPct: number; portfolioEcPct: number;
  capitalAdequacy: { actualCapital: number; requiredEconomicCapital: number; capitalSurplus: number; isAdequate: boolean };
}

const RISK_COLORS = ['#06b6d4', '#f59e0b', '#8b5cf6', '#10b981', '#ef4444', '#ec4899'];

export default function CreditRiskPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<CreditRiskPortfolio | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try { setData(await apiClient.getCreditRisk(selectedId)); }
      catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const chartData = data.segments.map(s => ({
    name: s.segmentName,
    EL: +s.expectedLoss.toFixed(2),
    UL: +s.unexpectedLoss.toFixed(2),
    EC: +s.economicCapital.toFixed(2),
  }));

  const { capitalAdequacy: ca } = data;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
          <ShieldAlert className="h-4 w-4 text-rose-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Motor de Riesgo Crediticio — PD/LGD/EAD' : 'Credit Risk Quant — PD/LGD/EAD'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? 'Regresión logística PD, modelo Vasicek capital económico, Basel II IRB' : 'Logistic PD regression, Vasicek economic capital, Basel II IRB'}
          </p>
        </div>
      </div>

      {/* Capital Adequacy Banner */}
      <div className={`flex items-center justify-between rounded-xl border p-4 ${ca.isAdequate ? 'border-emerald-200 bg-emerald-50' : 'border-rose-200 bg-rose-50'}`}>
        <div className="flex items-center gap-3">
          {ca.isAdequate ? <Check className="h-6 w-6 text-emerald-600" /> : <X className="h-6 w-6 text-rose-600" />}
          <div>
            <p className={`text-sm font-bold ${ca.isAdequate ? 'text-emerald-700' : 'text-rose-700'}`}>
              {ca.isAdequate
                ? (locale === 'es' ? 'Capital Adecuado' : 'Capital Adequate')
                : (locale === 'es' ? 'Capital Insuficiente' : 'Capital Insufficient')}
            </p>
            <p className="text-xs text-slate-600">
              {locale === 'es' ? 'Capital actual' : 'Actual capital'}: ${ca.actualCapital}M | {locale === 'es' ? 'Capital económico requerido' : 'Required economic capital'}: ${ca.requiredEconomicCapital}M | {locale === 'es' ? 'Excedente' : 'Surplus'}: ${ca.capitalSurplus}M
            </p>
          </div>
        </div>
      </div>

      {/* KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI label={locale === 'es' ? 'EAD Total' : 'Total EAD'} value={`$${data.totalEAD.toFixed(0)}M`} />
        <KPI label={locale === 'es' ? 'Pérdida Esperada' : 'Expected Loss'} value={`$${data.totalEL.toFixed(2)}M`} />
        <KPI label={locale === 'es' ? 'Pérdida Inesperada' : 'Unexpected Loss'} value={`$${data.totalUL.toFixed(2)}M`} accent />
        <KPI label={locale === 'es' ? 'Capital Económico' : 'Economic Capital'} value={`$${data.totalEC.toFixed(2)}M`} accent />
        <KPI label="EL %" value={`${data.portfolioElPct}%`} />
        <KPI label="EC %" value={`${data.portfolioEcPct}%`} warn={data.portfolioEcPct > 5} />
      </div>

      {/* EL / UL / EC Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Pérdida Esperada vs. Inesperada vs. Capital Económico' : 'Expected Loss vs. Unexpected Loss vs. Economic Capital'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 10 }} angle={-15} textAnchor="end" height={50} />
            <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} formatter={(v: number) => [`$${v}M`, '']} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="EL" name={locale === 'es' ? 'Pérdida Esperada' : 'Expected Loss'} fill="#f59e0b" stackId="loss" radius={[0, 0, 0, 0]} />
            <Bar dataKey="UL" name={locale === 'es' ? 'Pérdida Inesperada' : 'Unexpected Loss'} fill="#ef4444" stackId="loss" radius={[4, 4, 0, 0]} />
            <Bar dataKey="EC" name={locale === 'es' ? 'Capital Económico' : 'Economic Capital'} fill="#6366f1" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Segment Detail Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-slate-100 bg-slate-50/50">
                {[locale === 'es' ? 'Segmento' : 'Segment', 'EAD ($M)', locale === 'es' ? 'PD Anual' : 'Annual PD',
                  locale === 'es' ? 'PD Vida' : 'Lifetime PD', 'LGD', 'EL ($M)', 'UL ($M)', 'EC ($M)', 'EL %', 'EC %'].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-medium text-slate-500 whitespace-nowrap">{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {data.segments.map((s, i) => (
                <tr key={s.segmentName} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2.5 font-medium text-slate-700 text-xs">{s.segmentName}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs">{s.balance.toFixed(1)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs">{(s.annualPD * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs">{(s.lifetimePD * 100).toFixed(2)}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs">{(s.lgd * 100).toFixed(0)}%</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-amber-700 font-medium">{s.expectedLoss.toFixed(2)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-rose-700 font-medium">{s.unexpectedLoss.toFixed(2)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs text-indigo-700 font-bold">{s.economicCapital.toFixed(2)}</td>
                  <td className="px-3 py-2.5 tabular-nums text-xs">{s.elPct.toFixed(2)}%</td>
                  <td className={`px-3 py-2.5 tabular-nums text-xs ${s.ecPct > 5 ? 'text-rose-700 font-bold' : ''}`}>{s.ecPct.toFixed(2)}%</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : accent ? 'border-indigo-200 bg-indigo-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase tracking-wider text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : accent ? 'text-indigo-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemoData(): CreditRiskPortfolio {
  return {
    segments: [
      { segmentName: 'Consumer Loans', balance: 85, annualPD: 0.0312, lifetimePD: 0.1048, lgd: 0.45, expectedLoss: 4.01, unexpectedLoss: 5.82, economicCapital: 6.98, elPct: 4.72, ecPct: 8.21 },
      { segmentName: 'Auto Loans', balance: 62, annualPD: 0.0198, lifetimePD: 0.0804, lgd: 0.35, expectedLoss: 1.74, unexpectedLoss: 2.95, economicCapital: 3.54, elPct: 2.81, ecPct: 5.71 },
      { segmentName: 'Commercial RE', balance: 120, annualPD: 0.0145, lifetimePD: 0.1035, lgd: 0.40, expectedLoss: 4.97, unexpectedLoss: 8.40, economicCapital: 10.92, elPct: 4.14, ecPct: 9.10 },
      { segmentName: 'Residential Mortgage', balance: 95, annualPD: 0.0082, lifetimePD: 0.1156, lgd: 0.30, expectedLoss: 3.29, unexpectedLoss: 5.70, economicCapital: 7.41, elPct: 3.46, ecPct: 7.80 },
      { segmentName: 'Credit Cards', balance: 28, annualPD: 0.0685, lifetimePD: 0.0988, lgd: 0.85, expectedLoss: 2.35, unexpectedLoss: 1.82, economicCapital: 2.00, elPct: 8.39, ecPct: 7.14 },
      { segmentName: 'C&I Loans', balance: 55, annualPD: 0.0234, lifetimePD: 0.1115, lgd: 0.50, expectedLoss: 3.07, unexpectedLoss: 4.85, economicCapital: 6.31, elPct: 5.58, ecPct: 11.47 },
    ],
    totalEAD: 445, totalEL: 19.43, totalUL: 29.54, totalEC: 37.16, portfolioElPct: 4.37, portfolioEcPct: 8.35,
    capitalAdequacy: { actualCapital: 40.1, requiredEconomicCapital: 37.16, capitalSurplus: 2.94, isAdequate: true },
  };
}
