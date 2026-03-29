'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { CloudLightning, AlertTriangle } from 'lucide-react';

interface ClimateScenario {
  category: string;
  probability: number;
  portfolioLoss: number;
  nwrImpact: number;
}

interface ClimateRiskData {
  totalREExposure: number;
  hurricaneAAL: number;
  hurricaneAALPct: number;
  floodZoneExposure: number;
  cat3ScenarioLoss: number;
  cat3NWRImpact: number;
  cat5ScenarioLoss: number;
  riskLevel: 'LOW' | 'MEDIUM' | 'HIGH';
  mitigationScore: number;
  scenarios: ClimateScenario[];
  narrativeEs: string;
  narrativeEn: string;
}

export default function ClimateRiskPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<ClimateRiskData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/climate-risk`);
        if (res.ok) setData(await res.json() as ClimateRiskData);
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-orange-200 bg-orange-50">
          <CloudLightning className="h-4 w-4 text-orange-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Riesgo Climático — Huracanes PR' : 'Climate Risk — PR Hurricanes'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'AAL por huracanes, zonas FEMA, escenarios Cat 3-5' : 'Hurricane AAL, FEMA zones, Cat 3-5 scenarios'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        <KPI label={locale === 'es' ? 'Exposición RE' : 'RE Exposure'} value={`$${data.totalREExposure}M`} />
        <KPI label={locale === 'es' ? 'AAL Huracán' : 'Hurricane AAL'} value={`$${data.hurricaneAAL}M`} warn={data.hurricaneAALPct > 0.5} />
        <KPI label={locale === 'es' ? 'Pérdida Cat 3' : 'Cat 3 Loss'} value={`$${data.cat3ScenarioLoss}M`} warn />
        <KPI label={locale === 'es' ? 'Impacto NWR Cat 3' : 'Cat 3 NWR Impact'} value={`-${data.cat3NWRImpact}pp`} warn={data.cat3NWRImpact > 2} />
        <KPI label={locale === 'es' ? 'Nivel Riesgo' : 'Risk Level'} value={data.riskLevel} accent={data.riskLevel === 'LOW'} warn={data.riskLevel === 'HIGH'} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">{locale === 'es' ? 'Pérdida por Categoría de Huracán' : 'Loss by Hurricane Category'}</p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={data.scenarios}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="category" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} />
            <Bar dataKey="portfolioLoss" name={locale === 'es' ? 'Pérdida ($M)' : 'Loss ($M)'} radius={[4, 4, 0, 0]}>
              {data.scenarios.map((_, i) => <Cell key={i} fill={['#f59e0b', '#ea580c', '#dc2626', '#991b1b', '#450a0a'][i]} />)}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">{locale === 'es' ? 'Análisis' : 'Analysis'}</p>
        <p className="text-sm text-slate-700 leading-relaxed">{locale === 'es' ? data.narrativeEs : data.narrativeEn}</p>
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

function getDemoData(): ClimateRiskData {
  return {
    totalREExposure: 215, hurricaneAAL: 3.8, hurricaneAALPct: 0.85, floodZoneExposure: 26,
    cat3ScenarioLoss: 38.7, cat3NWRImpact: 8.7, cat5ScenarioLoss: 129, riskLevel: 'HIGH', mitigationScore: 45,
    scenarios: [
      { category: 'Cat 1', probability: 0.12, portfolioLoss: 6.5, nwrImpact: 1.5 },
      { category: 'Cat 2', probability: 0.06, portfolioLoss: 17.2, nwrImpact: 3.9 },
      { category: 'Cat 3', probability: 0.03, portfolioLoss: 38.7, nwrImpact: 8.7 },
      { category: 'Cat 4', probability: 0.01, portfolioLoss: 75.3, nwrImpact: 16.9 },
      { category: 'Cat 5', probability: 0.005, portfolioLoss: 129.0, nwrImpact: 29.0 },
    ],
    narrativeEs: 'La AAL por huracanes es $3.8M (0.85% activos). Bajo Cat 3 (María), pérdida de $38.7M (-8.7pp NWR). Nivel: ALTO.',
    narrativeEn: 'Hurricane AAL is $3.8M (0.85% assets). Under Cat 3 (Maria), loss of $38.7M (-8.7pp NWR). Level: HIGH.',
  };
}
