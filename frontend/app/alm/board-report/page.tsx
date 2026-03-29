'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { FileText, AlertTriangle, Download, Calendar } from 'lucide-react';

interface BoardReportSection {
  title: string;
  titleEs: string;
  pageRange: string;
}

interface BoardReportRegPulseItem {
  deadline: string;
  deadlineEs: string;
  date: string;
  urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface BoardReportData {
  institutionName: string;
  reportMonth: string;
  generatedAt: string;
  camelComposite: number;
  kpis: Record<string, string | number>;
  sections: BoardReportSection[];
  topRisks: string[];
  topRisksEs: string[];
  recommendations: string[];
  recommendationsEs: string[];
  regPulse: BoardReportRegPulseItem[];
}

export default function BoardReportPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<BoardReportData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/board-report`);
        if (res.ok) setData(await res.json() as BoardReportData);
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-slate-50">
            <FileText className="h-4 w-4 text-slate-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'Informe de Junta Mensual' : 'Monthly Board Report'}</h1>
            <p className="text-xs text-slate-500">{data.reportMonth} — {data.institutionName}</p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-xl bg-slate-900 px-4 py-2.5 text-sm font-semibold text-white hover:bg-slate-800">
          <Download className="h-4 w-4" />{locale === 'es' ? 'Exportar PDF' : 'Export PDF'}
        </button>
      </div>

      {/* KPI Grid */}
      <div className="grid grid-cols-4 md:grid-cols-8 gap-2">
        {Object.entries(data.kpis as Record<string, string | number>).map(([key, value]) => {
          const formattedValue =
            typeof value === 'number'
              ? value.toFixed(value < 10 ? 2 : 0)
              : value;
          const suffix =
            key.includes('ratio') || key.includes('nim') || key.includes('roa')
              ? '%'
              : '';

          return (
            <div key={key} className="rounded-xl border border-slate-200 bg-white p-3 text-center">
              <p className="text-[9px] font-medium uppercase tracking-wider text-slate-400">{key}</p>
              <p className="text-lg font-bold tabular-nums text-slate-950">{formattedValue}{suffix}</p>
            </div>
          );
        })}
      </div>

      {/* Report Sections */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        {data.sections.map((section, i) => (
          <div key={i} className="rounded-xl border border-slate-200 bg-white p-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm font-semibold text-slate-800">{locale === 'es' ? section.titleEs : section.title}</p>
              <span className="text-[10px] text-slate-400">p.{section.pageRange}</span>
            </div>
            <div className="h-0.5 w-full bg-slate-100 mb-2" />
            <p className="text-xs text-slate-500">{locale === 'es' ? 'Datos disponibles — incluido en exportación PDF' : 'Data available — included in PDF export'}</p>
          </div>
        ))}
      </div>

      {/* Top Risks */}
      <div className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-rose-600 mb-3">{locale === 'es' ? 'Principales Riesgos' : 'Top Risks'}</p>
        {(locale === 'es' ? data.topRisksEs : data.topRisks).map((r: string, i: number) => (
          <p key={i} className="text-xs text-rose-800 mb-1">• {r}</p>
        ))}
      </div>

      {/* Recommendations */}
      <div className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-emerald-600 mb-3">{locale === 'es' ? 'Acciones Recomendadas' : 'Recommended Actions'}</p>
        {(locale === 'es' ? data.recommendationsEs : data.recommendations).map((r: string, i: number) => (
          <p key={i} className="text-xs text-emerald-800 mb-1">{i + 1}. {r}</p>
        ))}
      </div>

      {/* Regulatory Pulse */}
      <div className="rounded-xl border border-slate-200 bg-white p-4">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">{locale === 'es' ? 'Pulso Regulatorio' : 'Regulatory Pulse'}</p>
        {data.regPulse.map((pulse, i) => (
          <div key={i} className="flex items-center gap-3 py-1.5 border-b border-slate-50 last:border-0">
            <Calendar className="h-3.5 w-3.5 text-slate-400" />
            <span className="text-xs text-slate-700 flex-1">{locale === 'es' ? pulse.deadlineEs : pulse.deadline}</span>
            <span className="text-[10px] tabular-nums text-slate-500">{pulse.date}</span>
            <span className={`text-[10px] font-bold ${pulse.urgency === 'HIGH' ? 'text-rose-600' : 'text-amber-600'}`}>{pulse.urgency}</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function getDemoData(): BoardReportData {
  return {
    institutionName: 'Demo Institution', reportMonth: '2026-03', generatedAt: new Date().toISOString(), camelComposite: 2,
    kpis: { nim: 3.5, lcr: 115, nsfr: 108, nwr: 9.2, eve: 15.2, npl: 1.8, cecl: 1.3, roa: 0.82 },
    sections: [
      { title: 'Executive Summary', titleEs: 'Resumen Ejecutivo', pageRange: '2' },
      { title: 'Key Metrics', titleEs: 'Indicadores Clave', pageRange: '3-4' },
      { title: 'Risk Analysis', titleEs: 'Análisis de Riesgo', pageRange: '5-7' },
      { title: 'Peer Comparison', titleEs: 'Comparación Pares', pageRange: '8-9' },
      { title: 'Forward Projection', titleEs: 'Proyección Forward', pageRange: '10-12' },
      { title: 'Recommendations', titleEs: 'Recomendaciones', pageRange: '13-14' },
    ],
    topRisks: ['EVE sensitivity at +200bps exceeds 15% warning.', 'CRE concentration at 90% of limit.', 'LIBOR exposure of $38.7M remains.'],
    topRisksEs: ['Sensibilidad EVE a +200bps excede advertencia de 15%.', 'Concentración CRE al 90% del límite.', 'Exposición LIBOR de $38.7M permanece.'],
    recommendations: ['Reduce duration gap via CD laddering.', 'Increase HQLA by $15M.', 'Complete SOFR transition.'],
    recommendationsEs: ['Reduzca brecha duración vía escalonamiento CD.', 'Aumente HQLA en $15M.', 'Complete transición SOFR.'],
    regPulse: [
      { deadline: 'COSSEC Quarterly Report', deadlineEs: 'Informe Trimestral COSSEC', date: '2026-04-15', urgency: 'HIGH' },
      { deadline: 'NCUA 5300 Filing', deadlineEs: 'Radicación NCUA 5300', date: '2026-04-30', urgency: 'HIGH' },
    ],
  };
}
