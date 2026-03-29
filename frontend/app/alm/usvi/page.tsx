'use client';

import { useState, useEffect } from 'react';
import { useTranslation } from '@/lib/i18n';
import { Globe, Check } from 'lucide-react';

type USVIPeerBenchmarkKey = 'nim' | 'lcr' | 'nwr' | 'loanToShare';

interface USVIDifference {
  area: string;
  pr: string;
  usvi: string;
}

interface USVIComplianceEvent {
  event: string;
  eventEs: string;
  frequency: string;
  nextDueDate: string;
  regulatoryRef: string;
}

interface USVIBenchmarkStats {
  p25: number;
  p50: number;
  p75: number;
}

interface USVIEconomicParams {
  tourismSeasonalityPeak: number[];
  dominantSector: string;
  populationEstimate: number;
  creditUnionCount: number;
  avgHurricaneCPRSpike: number;
}

interface USVIFrameworkData {
  jurisdiction: string;
  regulator: string;
  complianceCalendar: USVIComplianceEvent[];
  economicParams: USVIEconomicParams;
  peerBenchmarks: Record<USVIPeerBenchmarkKey, USVIBenchmarkStats>;
  differences: USVIDifference[];
}

export default function USVIPage() {
  const { locale } = useTranslation();
  const [data, setData] = useState<USVIFrameworkData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/usvi/framework`);
        if (res.ok) setData(await res.json() as USVIFrameworkData);
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50">
          <Globe className="h-4 w-4 text-sky-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Expansión USVI — Marco Regulatorio FSC' : 'USVI Expansion — FSC Regulatory Framework'}</h1>
          <p className="text-xs text-slate-500">{data.regulator}</p>
        </div>
      </div>

      {/* PR ↔ USVI Differences */}
      <div className="rounded-xl border border-slate-200 bg-white overflow-hidden">
        <div className="px-5 py-3 border-b border-slate-100">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">{locale === 'es' ? 'Diferencias PR ↔ USVI' : 'PR ↔ USVI Differences'}</p>
        </div>
        <table className="w-full text-sm">
          <thead><tr className="border-b border-slate-50 bg-slate-50/50">
            {[locale === 'es' ? 'Área' : 'Area', 'Puerto Rico', 'USVI'].map(h => <th key={h} className="px-4 py-2 text-left text-[10px] font-medium text-slate-500">{h}</th>)}
          </tr></thead>
          <tbody>{data.differences.map((difference, i) => (
            <tr key={i} className="border-b border-slate-50 last:border-0">
              <td className="px-4 py-2.5 text-xs font-medium text-slate-700">{difference.area}</td>
              <td className="px-4 py-2.5 text-xs text-slate-600">{difference.pr}</td>
              <td className="px-4 py-2.5 text-xs text-sky-700 font-medium">{difference.usvi}</td>
            </tr>
          ))}</tbody>
        </table>
      </div>

      {/* Compliance Calendar */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">{locale === 'es' ? 'Calendario de Cumplimiento FSC' : 'FSC Compliance Calendar'}</p>
        {data.complianceCalendar.map((event, i) => (
          <div key={i} className="flex items-center gap-3 py-2 border-b border-slate-50 last:border-0">
            <Check className="h-3.5 w-3.5 text-sky-500" />
            <span className="text-xs text-slate-700 flex-1">{locale === 'es' ? event.eventEs : event.event}</span>
            <span className="text-[10px] text-slate-500">{event.frequency}</span>
            <span className="text-[10px] tabular-nums text-slate-400">{event.nextDueDate}</span>
          </div>
        ))}
      </div>

      {/* USVI Peer Benchmarks */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">{locale === 'es' ? 'Benchmarks Pares USVI' : 'USVI Peer Benchmarks'}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
          {(Object.entries(data.peerBenchmarks) as Array<[USVIPeerBenchmarkKey, USVIBenchmarkStats]>).map(([key, stats]) => (
            <div key={key} className="rounded-lg border border-slate-100 p-3 text-center">
              <p className="text-[10px] font-medium uppercase text-slate-400">{key.toUpperCase()}</p>
              <p className="text-sm font-bold tabular-nums text-slate-950">{stats.p50}{key === 'nim' || key === 'nwr' ? '%' : key === 'lcr' || key === 'loanToShare' ? '%' : ''}</p>
              <p className="text-[9px] text-slate-400">p25: {stats.p25} | p75: {stats.p75}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Economic Parameters */}
      <div className="rounded-xl border border-amber-200 bg-amber-50/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-amber-700 mb-2">{locale === 'es' ? 'Parámetros Económicos USVI' : 'USVI Economic Parameters'}</p>
        <div className="grid grid-cols-2 md:grid-cols-4 gap-3 text-xs text-amber-800">
          <div>{locale === 'es' ? 'Sector Dominante' : 'Dominant Sector'}: <strong>{data.economicParams.dominantSector}</strong></div>
          <div>{locale === 'es' ? 'Cooperativas' : 'Credit Unions'}: <strong>{data.economicParams.creditUnionCount}</strong></div>
          <div>Hurricane CPR: <strong>+{(data.economicParams.avgHurricaneCPRSpike * 100).toFixed(0)}%</strong></div>
          <div>{locale === 'es' ? 'Población' : 'Population'}: <strong>{data.economicParams.populationEstimate.toLocaleString()}</strong></div>
        </div>
      </div>
    </div>
  );
}

function getDemoData(): USVIFrameworkData {
  return {
    jurisdiction: 'USVI', regulator: 'USVI Financial Services Commission (FSC)',
    complianceCalendar: [
      { event: 'FSC Annual Examination', eventEs: 'Examen Anual FSC', frequency: 'annual', nextDueDate: '2027-03-31', regulatoryRef: 'USVI FSC §4-201' },
      { event: 'NCUA 5300 Call Report', eventEs: 'Informe 5300 NCUA', frequency: 'quarterly', nextDueDate: '2026-05-15', regulatoryRef: 'NCUA §741.6' },
      { event: 'BSA/AML Review', eventEs: 'Revisión BSA/AML', frequency: 'annual', nextDueDate: '2027-03-31', regulatoryRef: 'FinCEN' },
    ],
    economicParams: { tourismSeasonalityPeak: [11, 12, 1, 2, 3], dominantSector: 'tourism', populationEstimate: 87146, creditUnionCount: 6, avgHurricaneCPRSpike: 0.35 },
    peerBenchmarks: { nim: { p25: 2.6, p50: 3.2, p75: 3.8 }, lcr: { p25: 95, p50: 112, p75: 135 }, nwr: { p25: 7.5, p50: 9.0, p75: 11.2 }, loanToShare: { p25: 55, p50: 65, p75: 78 } },
    differences: [
      { area: 'Primary Regulator', pr: 'COSSEC', usvi: 'USVI FSC' },
      { area: 'Federal Supervisor', pr: 'NCUA (all)', usvi: 'NCUA (federal) / FSC (state)' },
      { area: 'Primary Language', pr: 'Spanish', usvi: 'English' },
      { area: 'Economic Driver', pr: 'Pharma + tourism + gov', usvi: 'Tourism (dominant)' },
      { area: 'Hurricane Exposure', pr: 'High', usvi: 'Very High' },
      { area: 'Credit Union Count', pr: '94 cooperativas', usvi: '~6 credit unions' },
    ],
  };
}
