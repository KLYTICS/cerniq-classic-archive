'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { AreaChart, Area, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { Layers, AlertTriangle } from 'lucide-react';

interface PCAResult {
  varianceExplained: number[];
  cumulativeVariance: number[];
  factorLoadings: Array<{ tenor: string; pc1: number; pc2: number; pc3: number }>;
  interpretation: { pc1: string; pc2: string; pc3: string };
  niiSensitivity: { pc1Impact: number; pc2Impact: number; pc3Impact: number };
}

export default function PCAYieldCurvePage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<PCAResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/pca-yield-curve`);
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-teal-200 bg-teal-50">
          <Layers className="h-4 w-4 text-teal-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'PCA Curva de Rendimiento — 3 Factores' : 'PCA Yield Curve — 3 Factors'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Nivel, pendiente y curvatura vía análisis de componentes principales' : 'Level, slope & curvature via principal component analysis'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label="PC1 (Level)" value={`${(data.varianceExplained[0] * 100).toFixed(1)}%`} accent />
        <KPI label="PC2 (Slope)" value={`${(data.varianceExplained[1] * 100).toFixed(1)}%`} />
        <KPI label="PC3 (Curvature)" value={`${(data.varianceExplained[2] * 100).toFixed(1)}%`} />
        <KPI label={locale === 'es' ? 'Varianza Acum.' : 'Cumulative Var.'} value={`${(data.cumulativeVariance[2] * 100).toFixed(1)}%`} accent />
        <KPI label={locale === 'es' ? 'Impacto NII PC1' : 'NII Impact PC1'} value={`$${data.niiSensitivity.pc1Impact.toFixed(1)}M`} warn={Math.abs(data.niiSensitivity.pc1Impact) > 3} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Cargas Factoriales por Tenor' : 'Factor Loadings by Tenor'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <AreaChart data={data.factorLoadings}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="tenor" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => v.toFixed(4)} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Area type="monotone" dataKey="pc1" name="PC1 — Level" stroke="#0d9488" fill="#0d9488" fillOpacity={0.15} strokeWidth={2} />
            <Area type="monotone" dataKey="pc2" name="PC2 — Slope" stroke="#f59e0b" fill="#f59e0b" fillOpacity={0.1} strokeWidth={2} />
            <Area type="monotone" dataKey="pc3" name="PC3 — Curvature" stroke="#8b5cf6" fill="#8b5cf6" fillOpacity={0.1} strokeWidth={2} />
          </AreaChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
        {[
          { pc: 'PC1', name: locale === 'es' ? 'Nivel' : 'Level', desc: data.interpretation.pc1, color: 'teal' },
          { pc: 'PC2', name: locale === 'es' ? 'Pendiente' : 'Slope', desc: data.interpretation.pc2, color: 'amber' },
          { pc: 'PC3', name: locale === 'es' ? 'Curvatura' : 'Curvature', desc: data.interpretation.pc3, color: 'violet' },
        ].map(f => (
          <div key={f.pc} className={`rounded-xl border border-${f.color}-200 bg-${f.color}-50/50 p-4`}>
            <p className="text-xs font-bold text-slate-800">{f.pc} — {f.name}</p>
            <p className="mt-1 text-[11px] text-slate-600 leading-relaxed">{f.desc}</p>
          </div>
        ))}
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

function getDemo(): PCAResult {
  const tenors = ['3M', '6M', '1Y', '2Y', '3Y', '5Y', '7Y', '10Y', '20Y', '30Y'];
  return {
    varianceExplained: [0.852, 0.112, 0.028],
    cumulativeVariance: [0.852, 0.964, 0.992],
    factorLoadings: tenors.map((tenor, i) => ({
      tenor,
      pc1: 0.30 + Math.sin(i * 0.15) * 0.02,
      pc2: 0.40 - i * 0.08,
      pc3: -0.3 + Math.abs(i - 5) * 0.08,
    })),
    interpretation: {
      pc1: 'Parallel shift: all tenors move together. Explains 85.2% of variance. A 1σ shock shifts the entire curve ~45bp.',
      pc2: 'Slope change: short rates move opposite to long rates. Bear flattening or bull steepening. Explains 11.2%.',
      pc3: 'Butterfly: belly of the curve moves opposite to wings. Affects 5Y-7Y most. Explains 2.8%.',
    },
    niiSensitivity: { pc1Impact: -4.2, pc2Impact: 1.8, pc3Impact: -0.3 },
  };
}
