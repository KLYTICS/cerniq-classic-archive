'use client';

import { useMemo } from 'react';
import { Calendar } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { useALM } from '@/components/alm/ALMProvider';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';
import DocumentExportButtons from '@/components/exports/DocumentExportButtons';

interface BoardReportSection {
  readonly title: string;
  readonly titleEs: string;
  readonly pageRange: string;
}

interface BoardReportRegPulseItem {
  readonly deadline: string;
  readonly deadlineEs: string;
  readonly date: string;
  readonly urgency: 'HIGH' | 'MEDIUM' | 'LOW';
}

interface BoardReportData {
  readonly institutionName: string;
  readonly reportMonth: string;
  readonly generatedAt: string;
  readonly camelComposite: number;
  readonly kpis: Readonly<Record<string, string | number>>;
  readonly sections: readonly BoardReportSection[];
  readonly topRisks: readonly string[];
  readonly topRisksEs: readonly string[];
  readonly recommendations: readonly string[];
  readonly recommendationsEs: readonly string[];
  readonly regPulse: readonly BoardReportRegPulseItem[];
}

function validateBoardReport(raw: unknown): BoardReportData {
  if (!raw || typeof raw !== 'object') throw new Error('Board report must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.institutionName !== 'string') throw new Error('Board report: missing institutionName');
  if (typeof r.reportMonth !== 'string') throw new Error('Board report: missing reportMonth');
  if (typeof r.kpis !== 'object' || !r.kpis) throw new Error('Board report: missing kpis');
  return r as unknown as BoardReportData;
}

function getDemo(): BoardReportData {
  return {
    institutionName: 'Demo Institution',
    reportMonth: '2026-04',
    generatedAt: new Date().toISOString(),
    camelComposite: 2,
    kpis: { nim: 3.5, lcr: 115, nsfr: 108, nwr: 9.2, eve: 15.2, npl: 1.8, cecl: 1.3, roa: 0.82 },
    sections: [
      { title: 'Executive Summary',   titleEs: 'Resumen Ejecutivo',      pageRange: '2' },
      { title: 'Key Metrics',         titleEs: 'Indicadores Clave',      pageRange: '3-4' },
      { title: 'Risk Analysis',       titleEs: 'Análisis de Riesgo',     pageRange: '5-7' },
      { title: 'Peer Comparison',     titleEs: 'Comparación Pares',      pageRange: '8-9' },
      { title: 'Forward Projection',  titleEs: 'Proyección Forward',     pageRange: '10-12' },
      { title: 'Recommendations',     titleEs: 'Recomendaciones',        pageRange: '13-14' },
    ],
    topRisks:          ['EVE sensitivity at +200bps exceeds 15% warning.', 'CRE concentration at 90% of limit.', 'LIBOR exposure of $38.7M remains.'],
    topRisksEs:        ['Sensibilidad EVE a +200bps excede 15%.', 'Concentración CRE al 90% del límite.', 'Exposición LIBOR de $38.7M permanece.'],
    recommendations:   ['Reduce duration gap via CD laddering.', 'Increase HQLA by $15M.', 'Complete SOFR transition.'],
    recommendationsEs: ['Reduzca brecha duración vía escalonamiento CD.', 'Aumente HQLA en $15M.', 'Complete transición SOFR.'],
    regPulse: [
      { deadline: 'COSSEC Quarterly Report', deadlineEs: 'Informe Trimestral COSSEC', date: '2026-04-15', urgency: 'HIGH' },
      { deadline: 'NCUA 5300 Filing',        deadlineEs: 'Radicación NCUA 5300',      date: '2026-04-30', urgency: 'HIGH' },
    ],
  };
}

interface SectionRow extends BoardReportSection {
  readonly index: number;
}

function BoardReportContent({ data }: { data: BoardReportData }) {
  const { locale } = useTranslation();

  const stripItems = useMemo<readonly MetricStripItem[]>(
    () => Object.entries(data.kpis).map(([key, value]) => ({
      key,
      value: typeof value === 'number' ? value : null,
    })),
    [data],
  );

  const sectionRows = useMemo<readonly SectionRow[]>(
    () => data.sections.map((s, index) => ({ ...s, index })),
    [data],
  );

  const sectionColumns = useMemo<readonly DataTableColumn<SectionRow>[]>(() => [
    { id: 'num',   header: '#',                              kind: 'text',   accessor: (r) => String(r.index + 1), width: 'w-10' },
    { id: 'title', header: locale === 'es' ? 'Sección' : 'Section', kind: 'custom',
      accessor: (r) => locale === 'es' ? r.titleEs : r.title,
      render: (r) => <span className="text-xs font-medium text-slate-800">{locale === 'es' ? r.titleEs : r.title}</span>,
      align: 'text-left',
    },
    { id: 'pages', header: locale === 'es' ? 'Páginas' : 'Pages', kind: 'custom',
      accessor: (r) => r.pageRange,
      render: (r) => <span className="font-mono text-xs tabular-nums text-slate-600">p.{r.pageRange}</span>,
    },
  ], [locale]);

  const regPulseColumns = useMemo<readonly DataTableColumn<BoardReportRegPulseItem>[]>(() => [
    { id: 'deadline', header: locale === 'es' ? 'Plazo' : 'Deadline', kind: 'custom',
      accessor: (r) => locale === 'es' ? r.deadlineEs : r.deadline,
      render: (r) => (
        <span className="inline-flex items-center gap-2 text-xs text-slate-700">
          <Calendar className="h-3.5 w-3.5 text-slate-400" aria-hidden />
          {locale === 'es' ? r.deadlineEs : r.deadline}
        </span>
      ),
      align: 'text-left',
    },
    { id: 'date', header: locale === 'es' ? 'Fecha' : 'Date', kind: 'text', accessor: (r) => r.date },
    {
      id: 'urgency',
      header: locale === 'es' ? 'Urgencia' : 'Urgency',
      kind: 'custom',
      accessor: (r) => r.urgency,
      align: 'text-center',
      render: (r) => {
        const tone =
          r.urgency === 'HIGH'   ? 'border-rose-200 bg-rose-50 text-rose-700' :
          r.urgency === 'MEDIUM' ? 'border-amber-200 bg-amber-50 text-amber-700' :
                                   'border-slate-200 bg-slate-50 text-slate-600';
        return <span className={`rounded-full border px-2 py-0.5 text-[9px] font-bold ${tone}`}>{r.urgency}</span>;
      },
    },
  ], [locale]);

  return (
    <>
      <div className="text-[11px] text-slate-500">
        {data.reportMonth} — {data.institutionName}
      </div>

      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Sections table */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Secciones del Informe' : 'Report Sections'}
        </p>
        <DataTable rows={sectionRows} columns={sectionColumns} locale={locale} rowKey={(r) => String(r.index)} />
      </section>

      {/* Top risks + recommendations, side by side */}
      <div className="grid grid-cols-1 gap-4 md:grid-cols-2">
        <section className="rounded-xl border border-rose-200 bg-rose-50/50 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-rose-700">
            {locale === 'es' ? 'Principales Riesgos' : 'Top Risks'}
          </p>
          <ul className="space-y-1.5">
            {(locale === 'es' ? data.topRisksEs : data.topRisks).map((r, i) => (
              <li key={i} className="text-xs text-rose-800">• {r}</li>
            ))}
          </ul>
        </section>
        <section className="rounded-xl border border-emerald-200 bg-emerald-50/50 p-4">
          <p className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-emerald-700">
            {locale === 'es' ? 'Acciones Recomendadas' : 'Recommended Actions'}
          </p>
          <ol className="space-y-1.5">
            {(locale === 'es' ? data.recommendationsEs : data.recommendations).map((r, i) => (
              <li key={i} className="text-xs text-emerald-800">{i + 1}. {r}</li>
            ))}
          </ol>
        </section>
      </div>

      {/* Regulatory pulse */}
      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Pulso Regulatorio' : 'Regulatory Pulse'}
        </p>
        <DataTable rows={data.regPulse} columns={regPulseColumns} locale={locale} rowKey={(r) => r.deadline} />
      </section>
    </>
  );
}

function BoardReportControls() {
  const { selectedId } = useALM();
  if (!selectedId) return null;
  return (
    <DocumentExportButtons
      manifestPath={`/api/alm/${selectedId}/exports`}
      kinds={['alm_report']}
      compact
    />
  );
}

export default function BoardReportPage() {
  return (
    <AlmPage<BoardReportData>
      slug="board-report"
      iconTint="slate"
      validate={validateBoardReport}
      getDemo={getDemo}
      controls={<BoardReportControls />}
    >
      {(data) => <BoardReportContent data={data} />}
    </AlmPage>
  );
}
