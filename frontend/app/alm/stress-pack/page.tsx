'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Shield, AlertTriangle, Check, X, CloudLightning, Droplets, Calendar, Users, Flame } from 'lucide-react';

interface StressPackResult {
  scenarioId: string;
  scenarioName: string;
  scenarioNameEs: string;
  daysOfLiquidity: number;
  lcr: number;
  hqlaCoverage: number;
  availableLiquid: number;
  netOutflow: number;
  surplus: number;
  regulatoryStatus: 'PASS' | 'WATCH' | 'FAIL';
  narrative: string;
  narrativeEs: string;
}

const SCENARIO_ICONS: Record<string, React.ElementType> = {
  'SCEN-1': CloudLightning, 'SCEN-2': Droplets, 'SCEN-3': Calendar, 'SCEN-4': Users, 'SCEN-5': Flame,
};

const STATUS_STYLES = {
  PASS: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', bar: '#10b981' },
  WATCH: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', bar: '#f59e0b' },
  FAIL: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', bar: '#ef4444' },
};

export default function StressPackPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [results, setResults] = useState<StressPackResult[]>([]);
  const [loading, setLoading] = useState(true);
  const [selected, setSelected] = useState<string | null>(null);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const data = await apiClient.getStressPack(selectedId);
        setResults(Array.isArray(data) ? data : []);
      } catch { setResults(getDemoResults()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const chartData = results.map(r => ({
    name: r.scenarioId,
    days: r.daysOfLiquidity,
    status: r.regulatoryStatus,
  }));

  const detail = selected ? results.find(r => r.scenarioId === selected) : null;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-rose-200 bg-rose-50">
          <Shield className="h-4 w-4 text-rose-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">
            {locale === 'es' ? 'Paquete de Estrés COSSEC — 5 Escenarios' : 'COSSEC Stress Pack — 5 Scenarios'}
          </h1>
          <p className="text-xs text-slate-500">
            {locale === 'es' ? 'Escenarios prescritos para examen regulatorio' : 'Prescribed scenarios for regulatory examination'}
          </p>
        </div>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-1 sm:grid-cols-5 gap-3">
        {results.map(r => {
          const style = STATUS_STYLES[r.regulatoryStatus];
          const Icon = SCENARIO_ICONS[r.scenarioId] || Shield;
          return (
            <button
              key={r.scenarioId}
              onClick={() => setSelected(r.scenarioId === selected ? null : r.scenarioId)}
              className={`rounded-xl border p-4 text-left transition ${
                selected === r.scenarioId ? `ring-2 ring-offset-1 ${style.border} ${style.bg}` : `border-slate-200 bg-white hover:${style.bg}`
              }`}
            >
              <div className="flex items-center gap-2 mb-2">
                <Icon className="h-4 w-4 text-slate-500" />
                <span className="text-[10px] font-bold text-slate-400">{r.scenarioId}</span>
              </div>
              <p className="text-xs font-semibold text-slate-800 mb-1">{locale === 'es' ? r.scenarioNameEs : r.scenarioName}</p>
              <p className="text-2xl font-bold tabular-nums text-slate-950">{r.daysOfLiquidity}<span className="text-xs font-normal text-slate-500 ml-1">{locale === 'es' ? 'días' : 'days'}</span></p>
              <span className={`mt-2 inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>
                {r.regulatoryStatus === 'PASS' && <Check className="h-2.5 w-2.5" />}
                {r.regulatoryStatus === 'WATCH' && <AlertTriangle className="h-2.5 w-2.5" />}
                {r.regulatoryStatus === 'FAIL' && <X className="h-2.5 w-2.5" />}
                {r.regulatoryStatus}
              </span>
            </button>
          );
        })}
      </div>

      {/* Days of Liquidity Chart */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Días de Liquidez por Escenario' : 'Days of Liquidity by Scenario'}
        </p>
        <ResponsiveContainer width="100%" height={250}>
          <BarChart data={chartData}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tick={{ fontSize: 11 }} label={{ value: locale === 'es' ? 'Días' : 'Days', angle: -90, position: 'insideLeft', style: { fontSize: 11 } }} />
            <Tooltip contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }} />
            <Bar dataKey="days" radius={[4, 4, 0, 0]}>
              {chartData.map((entry, i) => (
                <Cell key={i} fill={STATUS_STYLES[entry.status as keyof typeof STATUS_STYLES].bar} />
              ))}
            </Bar>
          </BarChart>
        </ResponsiveContainer>
      </div>

      {/* Detail Panel */}
      {detail && (
        <div className={`rounded-xl border p-5 ${STATUS_STYLES[detail.regulatoryStatus].bg} ${STATUS_STYLES[detail.regulatoryStatus].border}`}>
          <p className="text-sm font-bold text-slate-950 mb-3">{locale === 'es' ? detail.scenarioNameEs : detail.scenarioName}</p>
          <div className="grid grid-cols-2 md:grid-cols-5 gap-3 mb-4">
            {[
              { l: locale === 'es' ? 'Días Liquidez' : 'Days Liquidity', v: `${detail.daysOfLiquidity}` },
              { l: 'LCR', v: `${detail.lcr}%` },
              { l: locale === 'es' ? 'HQLA Disponible' : 'Available HQLA', v: `$${detail.availableLiquid}M` },
              { l: locale === 'es' ? 'Salida Neta' : 'Net Outflow', v: `$${detail.netOutflow}M` },
              { l: locale === 'es' ? 'Excedente' : 'Surplus', v: `$${detail.surplus}M` },
            ].map(({ l, v }) => (
              <div key={l} className="text-center">
                <p className="text-[10px] text-slate-500">{l}</p>
                <p className="text-sm font-bold tabular-nums text-slate-800">{v}</p>
              </div>
            ))}
          </div>
          <p className="text-sm text-slate-700 leading-relaxed">{locale === 'es' ? detail.narrativeEs : detail.narrative}</p>
        </div>
      )}

      {/* COSSEC Table Format */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {locale === 'es' ? 'Tabla COSSEC — Formato de Examen' : 'COSSEC Table — Examination Format'}
          </p>
        </div>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-50 bg-slate-50/50">
              {[locale === 'es' ? 'Escenario' : 'Scenario', locale === 'es' ? 'Días Liq.' : 'Days Liq.', 'LCR %',
                locale === 'es' ? 'HQLA Disp.' : 'Avail. HQLA', locale === 'es' ? 'Salida Neta' : 'Net Outflow',
                locale === 'es' ? 'Excedente' : 'Surplus', locale === 'es' ? 'Estado' : 'Status'].map(h => (
                <th key={h} className="px-4 py-2.5 text-left text-[11px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {results.map(r => {
              const style = STATUS_STYLES[r.regulatoryStatus];
              return (
                <tr key={r.scenarioId} className="border-b border-slate-50 last:border-0">
                  <td className="px-4 py-3 font-medium text-slate-700">{r.scenarioId}: {locale === 'es' ? r.scenarioNameEs : r.scenarioName}</td>
                  <td className="px-4 py-3 tabular-nums font-bold text-slate-800">{r.daysOfLiquidity}</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">{r.lcr}%</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">${r.availableLiquid}M</td>
                  <td className="px-4 py-3 tabular-nums text-slate-600">${r.netOutflow}M</td>
                  <td className={`px-4 py-3 tabular-nums font-semibold ${r.surplus >= 0 ? 'text-emerald-700' : 'text-rose-700'}`}>${r.surplus}M</td>
                  <td className="px-4 py-3"><span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold ${style.bg} ${style.text} ${style.border}`}>{r.regulatoryStatus}</span></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

function getDemoResults(): StressPackResult[] {
  return [
    { scenarioId: 'SCEN-1', scenarioName: '72-Hour Acute Stress', scenarioNameEs: 'Estrés Agudo 72 Horas', daysOfLiquidity: 8, lcr: 62, hqlaCoverage: 62, availableLiquid: 45, netOutflow: 72, surplus: -27, regulatoryStatus: 'FAIL', narrative: 'Under 72-hour acute stress, 8 days of liquidity.', narrativeEs: 'Bajo estrés agudo 72 horas, 8 días de liquidez.' },
    { scenarioId: 'SCEN-2', scenarioName: '30-Day Prolonged Stress', scenarioNameEs: 'Estrés Prolongado 30 Días', daysOfLiquidity: 42, lcr: 85, hqlaCoverage: 85, availableLiquid: 52, netOutflow: 61, surplus: -9, regulatoryStatus: 'WATCH', narrative: 'Under 30-day prolonged stress, 42 days of liquidity.', narrativeEs: 'Bajo estrés prolongado 30 días, 42 días de liquidez.' },
    { scenarioId: 'SCEN-3', scenarioName: 'Seasonal Outflow', scenarioNameEs: 'Salida Estacional', daysOfLiquidity: 65, lcr: 135, hqlaCoverage: 135, availableLiquid: 52, netOutflow: 38.5, surplus: 13.5, regulatoryStatus: 'PASS', narrative: 'Under seasonal outflow, 65 days of liquidity.', narrativeEs: 'Bajo salida estacional, 65 días de liquidez.' },
    { scenarioId: 'SCEN-4', scenarioName: 'Member Concentration', scenarioNameEs: 'Concentración de Socios', daysOfLiquidity: 3, lcr: 28, hqlaCoverage: 28, availableLiquid: 20, netOutflow: 72, surplus: -52, regulatoryStatus: 'FAIL', narrative: 'Under member concentration, 3 days of liquidity.', narrativeEs: 'Bajo concentración de socios, 3 días de liquidez.' },
    { scenarioId: 'SCEN-5', scenarioName: 'Hurricane/Disaster', scenarioNameEs: 'Huracán/Desastre', daysOfLiquidity: 12, lcr: 48, hqlaCoverage: 48, availableLiquid: 35, netOutflow: 72, surplus: -37, regulatoryStatus: 'FAIL', narrative: 'Under hurricane scenario, 12 days of liquidity.', narrativeEs: 'Bajo escenario de huracán, 12 días de liquidez.' },
  ];
}
