'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Globe, AlertTriangle, Check, X } from 'lucide-react';

export default function NetworkPage() {
  const { locale } = useTranslation();
  const [data, setData] = useState<any>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/network/overview`);
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const agg = data.aggregates;
  const rd = agg.riskDistribution;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
          <Globe className="h-4 w-4 text-white" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Inteligencia de Red — Cooperativas PR' : 'Network Intelligence — PR Cooperativas'}</h1>
          <p className="text-xs text-slate-500">{agg.totalInstitutions} {locale === 'es' ? 'instituciones' : 'institutions'} · ${agg.totalSystemAssets.toLocaleString()}M {locale === 'es' ? 'activos totales' : 'total assets'}</p>
        </div>
      </div>

      {/* Network KPIs */}
      <div className="grid grid-cols-2 md:grid-cols-6 gap-3">
        <KPI label={locale === 'es' ? 'Instituciones' : 'Institutions'} value={agg.totalInstitutions} />
        <KPI label={locale === 'es' ? 'CAMEL Promedio' : 'Avg CAMEL'} value={agg.avgCAMEL.toFixed(1)} />
        <KPI label={locale === 'es' ? 'NIM Promedio' : 'Avg NIM'} value={`${agg.avgNIM}%`} />
        <KPI label={locale === 'es' ? 'LCR Promedio' : 'Avg LCR'} value={`${agg.avgLCR}%`} />
        <KPI label={locale === 'es' ? 'NWR Promedio' : 'Avg NWR'} value={`${agg.avgNWR}%`} />
        <KPI label={locale === 'es' ? 'Riesgo Sistémico' : 'Systemic Risk'} value={`${agg.systemicRiskScore}/100`} warn={agg.systemicRiskScore > 50} />
      </div>

      {/* CAMEL Distribution */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Distribución CAMEL' : 'CAMEL Distribution'}</p>
        <div className="flex gap-2 h-24">
          {[1, 2, 3, 4, 5].map(rating => {
            const count = rd[`rating${rating}` as keyof typeof rd] as number;
            const pct = (count / agg.totalInstitutions) * 100;
            const colors = ['bg-emerald-500', 'bg-cyan-500', 'bg-amber-400', 'bg-orange-500', 'bg-rose-500'];
            return (
              <div key={rating} className="flex-1 flex flex-col items-center justify-end">
                <span className="text-xs font-bold tabular-nums text-slate-700 mb-1">{count}</span>
                <div className={`w-full rounded-t ${colors[rating - 1]}`} style={{ height: `${Math.max(8, pct)}%` }} />
                <span className="text-[10px] text-slate-500 mt-1">R{rating}</span>
              </div>
            );
          })}
        </div>
      </div>

      {/* Institution League Table */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{locale === 'es' ? 'Tabla de Clasificación' : 'League Table'}</p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              {[locale === 'es' ? 'Institución' : 'Institution', locale === 'es' ? 'Activos ($M)' : 'Assets ($M)', 'CAMEL', locale === 'es' ? 'Riesgo' : 'Risk', locale === 'es' ? 'Principal Riesgo' : 'Top Risk'].map(h => (
                <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.institutions.slice(0, 15).map((inst: any) => (
              <tr key={inst.id} className="border-b border-slate-50 last:border-0">
                <td className="px-4 py-2.5 font-medium text-slate-700 text-xs">{inst.name}</td>
                <td className="px-4 py-2.5 tabular-nums text-xs text-slate-600">{inst.totalAssets}</td>
                <td className="px-4 py-2.5"><span className={`inline-flex h-5 w-5 items-center justify-center rounded-full text-[10px] font-bold ${inst.camelComposite <= 2 ? 'bg-emerald-100 text-emerald-700' : inst.camelComposite <= 3 ? 'bg-amber-100 text-amber-700' : 'bg-rose-100 text-rose-700'}`}>{inst.camelComposite ?? '—'}</span></td>
                <td className="px-4 py-2.5"><span className={`text-[10px] font-bold ${inst.riskLevel === 'low' ? 'text-emerald-600' : inst.riskLevel === 'medium' ? 'text-amber-600' : 'text-rose-600'}`}>{inst.riskLevel.toUpperCase()}</span></td>
                <td className="px-4 py-2.5 text-[10px] text-slate-500">{inst.topRisk}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Contagion Risks */}
      {data.contagionRisks.length > 0 && (
        <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-3">{locale === 'es' ? 'Riesgos de Contagio' : 'Contagion Risks'}</p>
          {data.contagionRisks.map((r: any, i: number) => (
            <div key={i} className="flex items-center gap-2 py-1.5">
              <AlertTriangle className={`h-3.5 w-3.5 shrink-0 ${r.severity === 'HIGH' ? 'text-rose-600' : 'text-amber-600'}`} />
              <span className="text-xs text-slate-700 flex-1">{locale === 'es' ? r.riskEs : r.risk}</span>
              <span className="text-[10px] text-slate-500">{r.affectedInstitutions} {locale === 'es' ? 'inst.' : 'inst.'}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function KPI({ label, value, warn }: { label: string; value: any; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-amber-200 bg-amber-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-amber-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemoData() {
  return {
    aggregates: { totalInstitutions: 94, totalSystemAssets: 18500, avgCAMEL: 2.1, avgNIM: 3.6, avgLCR: 118, avgNWR: 9.2, systemicRiskScore: 35, riskDistribution: { rating1: 14, rating2: 42, rating3: 24, rating4: 10, rating5: 4 } },
    institutions: Array.from({ length: 15 }, (_, i) => ({
      id: `d-${i}`, name: ['Coop. Oriental', 'Coop. Bayamón', 'Coop. Caguas', 'Coop. Ponce', 'Coop. Mayagüez', 'Coop. Arecibo', 'Coop. Humacao', 'Coop. Aguadilla', 'Coop. San Juan', 'Coop. Carolina', 'Coop. Guaynabo', 'Coop. Cayey', 'Coop. Fajardo', 'Coop. Isabela', 'Coop. Yauco'][i],
      totalAssets: [450, 380, 320, 280, 250, 220, 190, 170, 160, 145, 130, 110, 95, 80, 65][i],
      camelComposite: [2, 2, 1, 2, 3, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3][i],
      riskLevel: [2, 2, 1, 2, 3, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3][i] <= 2 ? 'low' : [2, 2, 1, 2, 3, 2, 2, 3, 2, 2, 3, 2, 4, 2, 3][i] <= 3 ? 'medium' : 'high',
      topRisk: ['IRR', 'CRE conc.', 'Liquidity', 'IRR', 'Capital', 'IRR', 'Credit', 'Capital', 'IRR', 'Liquidity', 'Credit', 'IRR', 'Capital', 'Liquidity', 'Credit'][i],
    })),
    contagionRisks: [
      { risk: 'PREPA bond exposure across 12 cooperativas', riskEs: 'Exposición bonos PREPA en 12 cooperativas', affectedInstitutions: 12, severity: 'MEDIUM' },
      { risk: 'Top employer deposits concentrated in 3 CUs', riskEs: 'Depósitos empleador concentrados en 3 cooperativas', affectedInstitutions: 3, severity: 'HIGH' },
    ],
  };
}
