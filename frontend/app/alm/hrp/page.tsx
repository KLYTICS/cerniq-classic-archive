'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { Treemap, ResponsiveContainer } from 'recharts';
import { GitBranch, AlertTriangle } from 'lucide-react';

interface HRPResult {
  totalAssets: number;
  clusterCount: number;
  diversificationRatio: number;
  maxDrawdown: number;
  clusters: Array<{ name: string; children: Array<{ name: string; weight: number; ret: number }> }>;
  flatWeights: Array<{ asset: string; cluster: string; weight: number }>;
}

interface TreemapContentProps {
  x?: number;
  y?: number;
  width?: number;
  height?: number;
  name?: string | number;
  index?: number;
}

export default function HRPPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<HRPResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/hrp`);
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const treemapData = data.clusters.map(c => ({
    name: c.name,
    children: c.children.map(ch => ({ name: ch.name, size: ch.weight * 1000 })),
  }));

  const COLORS = ['#6366f1', '#8b5cf6', '#a78bfa', '#c4b5fd', '#818cf8', '#4f46e5', '#7c3aed', '#5b21b6'];

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-purple-200 bg-purple-50">
          <GitBranch className="h-4 w-4 text-purple-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'HRP — Paridad de Riesgo Jerárquica' : 'HRP — Hierarchical Risk Parity'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'López de Prado: clustering + bisección inversa de varianza' : 'López de Prado: clustering + inverse-variance bisection'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label={locale === 'es' ? 'Clústeres' : 'Clusters'} value={`${data.clusterCount}`} />
        <KPI label={locale === 'es' ? 'Ratio Diversificación' : 'Diversification Ratio'} value={data.diversificationRatio.toFixed(3)} accent={data.diversificationRatio > 1.5} />
        <KPI label={locale === 'es' ? 'Máx Drawdown' : 'Max Drawdown'} value={`${(data.maxDrawdown * 100).toFixed(1)}%`} warn={data.maxDrawdown > 0.1} />
        <KPI label={locale === 'es' ? 'Activos' : 'Assets'} value={`${data.flatWeights.length}`} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Treemap — Pesos por Clúster' : 'Treemap — Weights by Cluster'}
        </p>
        <ResponsiveContainer width="100%" height={350}>
          <Treemap
            data={treemapData}
            dataKey="size"
            aspectRatio={4 / 3}
            stroke="#fff"
            content={({ x = 0, y = 0, width = 0, height = 0, name, index = 0 }: TreemapContentProps) => (
              <g>
                <rect x={x} y={y} width={width} height={height} fill={COLORS[index % COLORS.length]} rx={4} opacity={0.85} />
                {width > 50 && height > 25 && (
                  <text x={x + width / 2} y={y + height / 2} textAnchor="middle" dominantBaseline="middle"
                    fill="#fff" fontSize={10} fontWeight={600}>{name ?? ''}</text>
                )}
              </g>
            )}
          />
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
          {locale === 'es' ? 'Pesos HRP' : 'HRP Weights'}
        </p>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.flatWeights.map((w, i) => (
            <div key={i} className="flex items-center gap-2 rounded-lg bg-slate-50 px-3 py-2">
              <div className="h-2 w-2 rounded-full" style={{ backgroundColor: COLORS[i % COLORS.length] }} />
              <span className="text-xs text-slate-600 flex-1">{w.asset}</span>
              <span className="text-[10px] text-slate-400">{w.cluster}</span>
              <span className="text-xs font-bold tabular-nums text-slate-800">{(w.weight * 100).toFixed(1)}%</span>
            </div>
          ))}
        </div>
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

function getDemo(): HRPResult {
  return {
    totalAssets: 6, clusterCount: 3, diversificationRatio: 1.72, maxDrawdown: 0.065,
    clusters: [
      { name: 'Rates', children: [{ name: 'UST 5Y', weight: 0.22, ret: 0.041 }, { name: 'UST 10Y', weight: 0.18, ret: 0.044 }] },
      { name: 'Credit', children: [{ name: 'IG Corp', weight: 0.15, ret: 0.055 }, { name: 'Munis', weight: 0.20, ret: 0.038 }] },
      { name: 'Structured', children: [{ name: 'Agency MBS', weight: 0.15, ret: 0.048 }, { name: 'CMBS', weight: 0.10, ret: 0.062 }] },
    ],
    flatWeights: [
      { asset: 'UST 5Y', cluster: 'Rates', weight: 0.22 },
      { asset: 'UST 10Y', cluster: 'Rates', weight: 0.18 },
      { asset: 'IG Corp', cluster: 'Credit', weight: 0.15 },
      { asset: 'Munis', cluster: 'Credit', weight: 0.20 },
      { asset: 'Agency MBS', cluster: 'Structured', weight: 0.15 },
      { asset: 'CMBS', cluster: 'Structured', weight: 0.10 },
    ],
  };
}
