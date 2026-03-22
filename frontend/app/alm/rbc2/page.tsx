'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, AlertTriangle } from 'lucide-react';

interface RBC2Result {
  totalRiskWeightedAssets: number;
  netWorth: number;
  rbc2Ratio: number;
  wellCapitalized: boolean;
  components: Array<{ name: string; code: string; amount: number; riskWeight: number; weighted: number }>;
  thresholds: { wellCapitalized: number; adequately: number; undercapitalized: number };
}

export default function RBC2Page() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<RBC2Result | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/ncua-rbc2`);
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const ratioColor = data.rbc2Ratio >= data.thresholds.wellCapitalized ? '#22c55e' :
    data.rbc2Ratio >= data.thresholds.adequately ? '#eab308' : '#ef4444';
  const COLORS = ['#0ea5e9', '#6366f1', '#f59e0b', '#10b981', '#ef4444', '#8b5cf6', '#ec4899', '#14b8a6'];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50">
          <Shield className="h-4 w-4 text-blue-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'NCUA RBC2 — Capital Basado en Riesgo' : 'NCUA RBC2 — Risk-Based Capital'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Per NCUA Letter 15-CU-02: 8 componentes de riesgo ponderado' : 'Per NCUA Letter 15-CU-02: 8 risk-weighted components'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <div className="rounded-xl border-2 p-3" style={{ borderColor: ratioColor, backgroundColor: `${ratioColor}10` }}>
          <p className="text-[10px] font-medium uppercase text-slate-400">{locale === 'es' ? 'Ratio RBC2' : 'RBC2 Ratio'}</p>
          <p className="text-2xl font-bold tabular-nums" style={{ color: ratioColor }}>{(data.rbc2Ratio * 100).toFixed(2)}%</p>
          <p className="text-[10px] mt-1" style={{ color: ratioColor }}>
            {data.wellCapitalized ? (locale === 'es' ? 'Bien Capitalizado' : 'Well Capitalized') : (locale === 'es' ? 'Sub-Capitalizado' : 'Under-Capitalized')}
          </p>
        </div>
        <KPI label={locale === 'es' ? 'Activos Ponderados' : 'Risk-Weighted Assets'} value={`$${data.totalRiskWeightedAssets.toFixed(1)}M`} />
        <KPI label={locale === 'es' ? 'Patrimonio Neto' : 'Net Worth'} value={`$${data.netWorth.toFixed(1)}M`} />
        <KPI label={locale === 'es' ? 'Umbral Bien Cap.' : 'Well-Cap Threshold'} value={`${(data.thresholds.wellCapitalized * 100).toFixed(0)}%`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? '8 Componentes de Riesgo Ponderado' : '8 Risk-Weighted Components'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <BarChart data={data.components} layout="vertical">
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis type="number" tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <YAxis type="category" dataKey="code" width={60} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }}
              formatter={(v: number, name: string) => [`$${v.toFixed(2)}M`, name]}
              labelFormatter={(label) => data.components.find(c => c.code === label)?.name || label} />
            <Bar dataKey="weighted" name={locale === 'es' ? 'Ponderado' : 'Weighted'} radius={[0, 4, 4, 0]}>
              {data.components.map((_, i) => <Cell key={i} fill={COLORS[i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Detalle de Componentes' : 'Component Detail'}
        </p>
        <table className="w-full text-xs">
          <thead>
            <tr className="border-b border-slate-200">
              <th className="py-2 text-left text-slate-500">{locale === 'es' ? 'Componente' : 'Component'}</th>
              <th className="py-2 text-right text-slate-500">{locale === 'es' ? 'Monto' : 'Amount'}</th>
              <th className="py-2 text-right text-slate-500">{locale === 'es' ? 'Peso' : 'Weight'}</th>
              <th className="py-2 text-right text-slate-500">{locale === 'es' ? 'Ponderado' : 'Weighted'}</th>
            </tr>
          </thead>
          <tbody>
            {data.components.map((c, i) => (
              <tr key={i} className="border-b border-slate-100">
                <td className="py-1.5">
                  <span className="inline-block h-2 w-2 rounded-full mr-2" style={{ backgroundColor: COLORS[i] }} />
                  <span className="text-slate-700">{c.name}</span>
                </td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">${c.amount.toFixed(1)}M</td>
                <td className="py-1.5 text-right tabular-nums text-slate-600">{(c.riskWeight * 100).toFixed(0)}%</td>
                <td className="py-1.5 text-right tabular-nums font-medium text-slate-800">${c.weighted.toFixed(2)}M</td>
              </tr>
            ))}
            <tr className="border-t-2 border-slate-300">
              <td className="py-2 font-bold text-slate-900">{locale === 'es' ? 'Total' : 'Total'}</td>
              <td className="py-2 text-right tabular-nums font-bold text-slate-900">${data.components.reduce((s, c) => s + c.amount, 0).toFixed(1)}M</td>
              <td />
              <td className="py-2 text-right tabular-nums font-bold text-slate-900">${data.totalRiskWeightedAssets.toFixed(1)}M</td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  );
}

function KPI({ label, value, accent, warn }: { label: string; value: string; accent?: boolean; warn?: boolean }) {
  return (
    <div className={`rounded-xl border p-3 ${warn ? 'border-rose-200 bg-rose-50' : accent ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-white'}`}>
      <p className="text-[10px] font-medium uppercase text-slate-400">{label}</p>
      <p className={`text-lg font-bold tabular-nums ${warn ? 'text-rose-700' : accent ? 'text-emerald-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemo(): RBC2Result {
  return {
    totalRiskWeightedAssets: 285.4, netWorth: 32.8, rbc2Ratio: 0.1149, wellCapitalized: true,
    thresholds: { wellCapitalized: 0.10, adequately: 0.08, undercapitalized: 0.06 },
    components: [
      { name: 'Net Amount of Loans', code: 'RC-1', amount: 180, riskWeight: 0.60, weighted: 108.0 },
      { name: 'Investments > 5Y', code: 'RC-2', amount: 65, riskWeight: 0.50, weighted: 32.5 },
      { name: 'Investments 1-5Y', code: 'RC-3', amount: 45, riskWeight: 0.25, weighted: 11.25 },
      { name: 'Real Estate Owned', code: 'RC-4', amount: 3.5, riskWeight: 1.00, weighted: 3.5 },
      { name: 'Delinquent Loans', code: 'RC-5', amount: 8.2, riskWeight: 1.50, weighted: 12.3 },
      { name: 'CUSO Investments', code: 'RC-6', amount: 5.0, riskWeight: 1.00, weighted: 5.0 },
      { name: 'Concentration Risk', code: 'RC-7', amount: 42, riskWeight: 0.75, weighted: 31.5 },
      { name: 'Interest Rate Risk', code: 'RC-8', amount: 162, riskWeight: 0.50, weighted: 81.0 },
    ],
  };
}
