'use client';

import { useState, useEffect, useMemo } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import {
  ClipboardCheck, AlertTriangle, Check, X, Clock, FileText,
  Download, Shield, ChevronDown, ChevronUp, Target, TrendingUp,
  BookOpen, Lightbulb, Activity,
} from 'lucide-react';

/* ─── Types ─── */
interface CAMELComponent {
  component: string; componentEs: string; score: number;
  rating: string; ratingEs: string; detail: string; detailEs: string;
}
interface CriticalFinding {
  id: string; severity: 'critical' | 'high' | 'medium';
  finding: string; findingEs: string;
  examinerNote: string; examinerNoteEs: string;
  status: 'open' | 'in_progress' | 'closed';
  targetDate: string;
}
interface RecommendedAction {
  id: string; priority: number;
  action: string; actionEs: string;
  impact: string; impactEs: string;
  deadline: string; responsible: string;
}
interface DocumentItem {
  id: string; document: string; documentEs: string;
  category: string; ready: boolean;
  lastUpdated: string | null;
}
interface ExamPrepData {
  camel: {
    components: CAMELComponent[];
    composite: number;
    compositeRating: string;
    compositeRatingEs: string;
    examReadiness: string;
  };
  readinessScore: number;
  criticalFindings: CriticalFinding[];
  recommendedActions: RecommendedAction[];
  documentChecklist: DocumentItem[];
}

/* ─── Color Maps ─── */
const CAMEL_COLORS: Record<number, { bg: string; text: string; border: string; ring: string; gradient: string }> = {
  1: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300', ring: 'stroke-emerald-500', gradient: '#10b981' },
  2: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300', ring: 'stroke-cyan-500', gradient: '#06b6d4' },
  3: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300', ring: 'stroke-amber-500', gradient: '#f59e0b' },
  4: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300', ring: 'stroke-orange-500', gradient: '#f97316' },
  5: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300', ring: 'stroke-rose-500', gradient: '#ef4444' },
};

const SEVERITY_STYLES: Record<string, { bg: string; text: string; border: string }> = {
  critical: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200' },
  high: { bg: 'bg-orange-50', text: 'text-orange-700', border: 'border-orange-200' },
  medium: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200' },
};

/* ─── Visual Gauge Component ─── */
function CAMELGauge({ score, label, size = 80 }: { score: number; label: string; size?: number }) {
  const color = CAMEL_COLORS[score] || CAMEL_COLORS[3];
  const radius = (size - 10) / 2;
  const circumference = 2 * Math.PI * radius;
  const percentage = ((6 - score) / 5) * 100; // 1=best=100%, 5=worst=20%
  const strokeDashoffset = circumference - (percentage / 100) * circumference;

  return (
    <div className="flex flex-col items-center gap-1">
      <div className="relative" style={{ width: size, height: size }}>
        <svg width={size} height={size} className="-rotate-90">
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke="#e2e8f0" strokeWidth={6}
          />
          <circle
            cx={size / 2} cy={size / 2} r={radius}
            fill="none" stroke={color.gradient} strokeWidth={6}
            strokeLinecap="round"
            strokeDasharray={circumference}
            strokeDashoffset={strokeDashoffset}
            className="transition-all duration-1000 ease-out"
          />
        </svg>
        <div className="absolute inset-0 flex items-center justify-center">
          <span className={`text-2xl font-black ${color.text}`}>{score}</span>
        </div>
      </div>
      <span className="text-[10px] font-bold uppercase tracking-wider text-slate-500 text-center leading-tight max-w-[80px]">
        {label}
      </span>
    </div>
  );
}

/* ─── Readiness Gauge ─── */
function ReadinessGauge({ score }: { score: number }) {
  const color = score >= 80 ? '#10b981' : score >= 60 ? '#f59e0b' : '#ef4444';
  const radius = 55;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (score / 100) * circumference;

  return (
    <div className="relative" style={{ width: 130, height: 130 }}>
      <svg width={130} height={130} className="-rotate-90">
        <circle cx={65} cy={65} r={radius} fill="none" stroke="#1e293b" strokeWidth={8} />
        <circle
          cx={65} cy={65} r={radius} fill="none"
          stroke={color} strokeWidth={8} strokeLinecap="round"
          strokeDasharray={circumference} strokeDashoffset={offset}
          className="transition-all duration-1000 ease-out"
        />
      </svg>
      <div className="absolute inset-0 flex flex-col items-center justify-center">
        <span className="text-3xl font-black text-white">{score}%</span>
        <span className="text-[9px] font-bold uppercase tracking-wider text-slate-400">Ready</span>
      </div>
    </div>
  );
}

/* ─── Main Page ─── */
export default function ExamPrepDashboard() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<ExamPrepData | null>(null);
  const [loading, setLoading] = useState(true);
  const [expandedFindings, setExpandedFindings] = useState(false);
  const [docFilter, setDocFilter] = useState<'all' | 'ready' | 'missing'>('all');
  const t = (en: string, es: string) => locale === 'en' ? en : es;

  useEffect(() => {
    if (!selectedId) return;
    let cancelled = false;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/exam-prep`);
        if (!cancelled) {
          if (res.ok) setData(await res.json());
          else setData(getDemoData());
        }
      } catch {
        if (!cancelled) setData(getDemoData());
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [selectedId]);

  const filteredDocs = useMemo(() => {
    if (!data) return [];
    if (docFilter === 'ready') return data.documentChecklist.filter(d => d.ready);
    if (docFilter === 'missing') return data.documentChecklist.filter(d => !d.ready);
    return data.documentChecklist;
  }, [data, docFilter]);

  if (!selectedId) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <AlertTriangle className="h-12 w-12 text-amber-500" />
      </div>
    );
  }
  if (loading || !data) {
    return (
      <div className="flex-1 flex items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  const readyDocs = data.documentChecklist.filter(d => d.ready).length;
  const totalDocs = data.documentChecklist.length;
  const openFindings = data.criticalFindings.filter(f => f.status !== 'closed').length;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-blue-200 bg-blue-50">
            <ClipboardCheck className="h-4 w-4 text-blue-700" />
          </div>
          <div>
            <h1 className="text-lg font-bold text-slate-950">
              {t('COSSEC Exam Prep Dashboard', 'Panel de Preparación Examen COSSEC')}
            </h1>
            <p className="text-xs text-slate-500">
              {t('CAMEL self-assessment, critical findings, readiness tracking', 'Auto-evaluación CAMEL, hallazgos críticos, seguimiento de preparación')}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Download className="h-4 w-4" />
          {t('Download Exam Pack', 'Descargar Pack Examen')}
        </button>
      </div>

      {/* ─── Top Row: Readiness + CAMEL Gauges ─── */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-4">
        {/* Readiness Score Card */}
        <div className="rounded-xl border border-slate-700/50 bg-slate-900 p-6 flex flex-col items-center justify-center gap-3">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-400">
            {t('Exam Readiness', 'Preparación para Examen')}
          </p>
          <ReadinessGauge score={data.readinessScore} />
          <div className="flex items-center gap-2 mt-1">
            <div className={`h-2 w-2 rounded-full ${
              data.readinessScore >= 80 ? 'bg-emerald-400 animate-pulse' :
              data.readinessScore >= 60 ? 'bg-amber-400 animate-pulse' :
              'bg-rose-400 animate-pulse'
            }`} />
            <span className="text-xs font-semibold text-white">
              {data.readinessScore >= 80
                ? t('Exam Ready', 'Listo para Examen')
                : data.readinessScore >= 60
                  ? t('Needs Work', 'Requiere Trabajo')
                  : t('At Risk', 'En Riesgo')}
            </span>
          </div>
          <div className="flex items-center gap-4 mt-2 text-[10px] text-slate-400">
            <span>{t('Findings', 'Hallazgos')}: <b className="text-white">{openFindings}</b></span>
            <span>{t('Docs', 'Docs')}: <b className="text-white">{readyDocs}/{totalDocs}</b></span>
          </div>
        </div>

        {/* CAMEL Score Breakdown */}
        <div className="lg:col-span-2 rounded-xl border border-slate-200 bg-white p-5">
          <div className="flex items-center justify-between mb-5">
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('CAMEL Score Breakdown', 'Desglose Puntuación CAMEL')}
            </p>
            <div className="flex items-center gap-2">
              <span className="text-xs text-slate-500">{t('Composite', 'Compuesto')}:</span>
              <span className={`inline-flex items-center rounded-full px-2.5 py-0.5 text-sm font-black ${
                (CAMEL_COLORS[data.camel.composite] || CAMEL_COLORS[3]).bg
              } ${(CAMEL_COLORS[data.camel.composite] || CAMEL_COLORS[3]).text}`}>
                {data.camel.composite}
              </span>
              <span className="text-xs font-semibold text-slate-700">
                {locale === 'es' ? data.camel.compositeRatingEs : data.camel.compositeRating}
              </span>
            </div>
          </div>

          <div className="flex items-center justify-around">
            {data.camel.components.map(c => (
              <CAMELGauge
                key={c.component}
                score={c.score}
                label={locale === 'es' ? c.componentEs : c.component}
              />
            ))}
          </div>

          {/* Detail rows */}
          <div className="mt-5 grid grid-cols-5 gap-2">
            {data.camel.components.map(c => {
              const color = CAMEL_COLORS[c.score] || CAMEL_COLORS[3];
              return (
                <div key={c.component + '-detail'} className={`rounded-lg border p-2.5 ${color.bg} ${color.border}`}>
                  <p className={`text-[10px] font-bold uppercase tracking-wider ${color.text} opacity-70`}>
                    {locale === 'es' ? c.ratingEs : c.rating}
                  </p>
                  <p className="text-[10px] text-slate-600 mt-1 leading-tight">
                    {locale === 'es' ? c.detailEs : c.detail}
                  </p>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {/* ─── Critical Findings ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <AlertTriangle className="h-4 w-4 text-rose-500" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('Critical Findings — Examiner Would Flag', 'Hallazgos Críticos — Un Examinador Señalaría')}
            </p>
            {openFindings > 0 && (
              <span className="rounded-full bg-rose-100 px-2 py-0.5 text-[10px] font-bold text-rose-700">
                {openFindings} {t('open', 'abiertos')}
              </span>
            )}
          </div>
          <button
            onClick={() => setExpandedFindings(!expandedFindings)}
            className="flex items-center gap-1 text-xs text-slate-500 hover:text-slate-700"
          >
            {expandedFindings ? <ChevronUp className="h-3.5 w-3.5" /> : <ChevronDown className="h-3.5 w-3.5" />}
            {expandedFindings ? t('Collapse', 'Colapsar') : t('Expand', 'Expandir')}
          </button>
        </div>

        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {[
                t('Severity', 'Severidad'),
                t('Finding', 'Hallazgo'),
                t('Examiner Note', 'Nota Examinador'),
                t('Target Date', 'Fecha Límite'),
                t('Status', 'Estado'),
              ].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(expandedFindings ? data.criticalFindings : data.criticalFindings.slice(0, 4)).map(f => {
              const sev = SEVERITY_STYLES[f.severity] || SEVERITY_STYLES.medium;
              return (
                <tr key={f.id} className="border-b border-slate-50 last:border-0">
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex rounded-full border px-2 py-0.5 text-[10px] font-bold uppercase ${sev.bg} ${sev.text} ${sev.border}`}>
                      {f.severity}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-xs text-slate-700 max-w-[200px]">
                    {locale === 'es' ? f.findingEs : f.finding}
                  </td>
                  <td className="px-3 py-2.5 text-[11px] text-slate-500 italic max-w-[200px]">
                    {locale === 'es' ? f.examinerNoteEs : f.examinerNote}
                  </td>
                  <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{f.targetDate}</td>
                  <td className="px-3 py-2.5">
                    <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                      f.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                      f.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                      'bg-rose-50 text-rose-700 border-rose-200'
                    }`}>
                      {f.status === 'closed' ? <Check className="h-2.5 w-2.5" /> :
                       f.status === 'in_progress' ? <Clock className="h-2.5 w-2.5" /> :
                       <AlertTriangle className="h-2.5 w-2.5" />}
                      {f.status.replace('_', ' ').toUpperCase()}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        {!expandedFindings && data.criticalFindings.length > 4 && (
          <p className="text-center text-[11px] text-slate-400 mt-2">
            +{data.criticalFindings.length - 4} {t('more findings', 'hallazgos más')}
          </p>
        )}
      </div>

      {/* ─── Recommended Actions ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center gap-2 mb-4">
          <Lightbulb className="h-4 w-4 text-amber-500" />
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {t('Recommended Actions Before Next Exam', 'Acciones Recomendadas Antes del Próximo Examen')}
          </p>
        </div>
        <div className="space-y-2">
          {data.recommendedActions.map((a, idx) => (
            <div key={a.id} className="flex items-start gap-3 rounded-lg border border-slate-100 bg-slate-50/50 p-3">
              <div className="flex h-6 w-6 shrink-0 items-center justify-center rounded-full bg-blue-100 text-[11px] font-black text-blue-700">
                {idx + 1}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-xs font-semibold text-slate-800">
                  {locale === 'es' ? a.actionEs : a.action}
                </p>
                <p className="text-[11px] text-slate-500 mt-0.5">
                  {t('Impact', 'Impacto')}: {locale === 'es' ? a.impactEs : a.impact}
                </p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[10px] font-medium text-slate-500">{a.deadline}</p>
                <p className="text-[10px] text-slate-400">{a.responsible}</p>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* ─── Document Checklist ─── */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <BookOpen className="h-4 w-4 text-slate-500" />
            <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
              {t('Document Checklist — Exam Preparation', 'Lista de Documentos — Preparación de Examen')}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1.5">
              <div className="h-2 w-24 rounded-full bg-slate-100">
                <div
                  className="h-2 rounded-full bg-blue-500 transition-all duration-500"
                  style={{ width: `${(readyDocs / totalDocs) * 100}%` }}
                />
              </div>
              <span className="text-xs font-bold text-slate-700">{readyDocs}/{totalDocs}</span>
            </div>
            <div className="flex rounded-lg border border-slate-200 overflow-hidden">
              {(['all', 'ready', 'missing'] as const).map(f => (
                <button
                  key={f}
                  onClick={() => setDocFilter(f)}
                  className={`px-2.5 py-1 text-[10px] font-semibold transition ${
                    docFilter === f ? 'bg-slate-900 text-white' : 'text-slate-500 hover:text-slate-700'
                  }`}
                >
                  {f === 'all' ? t('All', 'Todos') : f === 'ready' ? t('Ready', 'Listos') : t('Missing', 'Faltantes')}
                </button>
              ))}
            </div>
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-2">
          {filteredDocs.map(d => (
            <div
              key={d.id}
              className={`flex items-center gap-2.5 rounded-lg border px-3 py-2.5 ${
                d.ready ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'
              }`}
            >
              {d.ready
                ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
              <div className="min-w-0 flex-1">
                <p className="text-xs text-slate-700 truncate">{locale === 'es' ? d.documentEs : d.document}</p>
                <p className="text-[10px] text-slate-400">{d.category}{d.lastUpdated ? ` · ${d.lastUpdated}` : ''}</p>
              </div>
              <FileText className="h-3 w-3 text-slate-300 shrink-0" />
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

/* ─── Demo Data ─── */
function getDemoData(): ExamPrepData {
  return {
    camel: {
      components: [
        { component: 'Capital', componentEs: 'Capital', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'NWR 9.2% — Adequately capitalized.', detailEs: 'NWR 9.2% — Adecuadamente capitalizada.' },
        { component: 'Asset Quality', componentEs: 'Calidad de Activos', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'NPL: 1.8%, Classified: 3.6%.', detailEs: 'NPL: 1.8%, Clasificados: 3.6%.' },
        { component: 'Management', componentEs: 'Administración', score: 3, rating: 'Fair', ratingEs: 'Regular', detail: 'Governance: 18/24 items complete.', detailEs: 'Gobernanza: 18/24 ítems completos.' },
        { component: 'Earnings', componentEs: 'Rentabilidad', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'ROA: 0.82%, Expense: 78%.', detailEs: 'ROA: 0.82%, Gastos: 78%.' },
        { component: 'Liquidity', componentEs: 'Liquidez', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'LCR: 115%, NSFR: 108%.', detailEs: 'LCR: 115%, NSFR: 108%.' },
      ],
      composite: 2,
      compositeRating: 'Satisfactory',
      compositeRatingEs: 'Satisfactorio',
      examReadiness: 'NEEDS_WORK',
    },
    readinessScore: 72,
    criticalFindings: [
      {
        id: 'cf1', severity: 'critical',
        finding: 'CRE concentration exceeds 300% of capital without board-approved limits',
        findingEs: 'Concentración CRE excede 300% del capital sin límites aprobados por junta',
        examinerNote: 'NCUA Letter 10-CU-13 requires documented concentration limits. Examiner will cite as DOR.',
        examinerNoteEs: 'Carta NCUA 10-CU-13 requiere límites de concentración documentados. Examinador citará como DOR.',
        status: 'open', targetDate: '2026-04-30',
      },
      {
        id: 'cf2', severity: 'critical',
        finding: 'IRR model validation overdue by 14 months',
        findingEs: 'Validación del modelo IRR vencida por 14 meses',
        examinerNote: 'NCUA §741.3(b)(5) — Independent validation must be performed at least annually.',
        examinerNoteEs: 'NCUA §741.3(b)(5) — Validación independiente debe realizarse al menos anualmente.',
        status: 'in_progress', targetDate: '2026-05-15',
      },
      {
        id: 'cf3', severity: 'high',
        finding: 'BSA/AML training records incomplete for 4 employees',
        findingEs: 'Registros de capacitación BSA/AML incompletos para 4 empleados',
        examinerNote: 'Bank Secrecy Act requires documented training for all applicable staff.',
        examinerNoteEs: 'Ley de Secreto Bancario requiere capacitación documentada para todo el personal aplicable.',
        status: 'open', targetDate: '2026-04-15',
      },
      {
        id: 'cf4', severity: 'high',
        finding: 'CECL methodology documentation lacks vintage analysis support',
        findingEs: 'Documentación de metodología CECL carece de soporte de análisis vintage',
        examinerNote: 'ASU 2016-13 requires well-documented methodology including data sources and assumptions.',
        examinerNoteEs: 'ASU 2016-13 requiere metodología bien documentada incluyendo fuentes de datos y supuestos.',
        status: 'in_progress', targetDate: '2026-06-30',
      },
      {
        id: 'cf5', severity: 'medium',
        finding: 'Board minutes do not reflect ALM report discussion',
        findingEs: 'Actas de junta no reflejan discusión de informe ALM',
        examinerNote: 'Board oversight of IRR is a key Management rating driver.',
        examinerNoteEs: 'Supervisión de junta sobre IRR es un factor clave en la calificación de Administración.',
        status: 'open', targetDate: '2026-05-30',
      },
      {
        id: 'cf6', severity: 'medium',
        finding: 'Contingency Funding Plan not tested in past 12 months',
        findingEs: 'Plan de Contingencia de Liquidez no probado en los últimos 12 meses',
        examinerNote: 'Liquidity risk management requires periodic CFP testing.',
        examinerNoteEs: 'Gestión del riesgo de liquidez requiere pruebas periódicas del PCL.',
        status: 'closed', targetDate: '2026-03-31',
      },
    ],
    recommendedActions: [
      {
        id: 'ra1', priority: 1,
        action: 'Document and get board approval for CRE concentration limits',
        actionEs: 'Documentar y obtener aprobación de junta para límites de concentración CRE',
        impact: 'Resolves critical finding; prevents DOR citation',
        impactEs: 'Resuelve hallazgo crítico; previene citación DOR',
        deadline: '2026-04-30', responsible: 'CFO',
      },
      {
        id: 'ra2', priority: 2,
        action: 'Engage independent firm for IRR model validation',
        actionEs: 'Contratar firma independiente para validación de modelo IRR',
        impact: 'Addresses 14-month overdue validation; improves Management rating',
        impactEs: 'Aborda validación vencida de 14 meses; mejora calificación Administración',
        deadline: '2026-05-15', responsible: 'ALM Analyst',
      },
      {
        id: 'ra3', priority: 3,
        action: 'Complete BSA training for remaining 4 staff members',
        actionEs: 'Completar capacitación BSA para los 4 empleados restantes',
        impact: 'Eliminates BSA compliance gap before exam',
        impactEs: 'Elimina brecha de cumplimiento BSA antes del examen',
        deadline: '2026-04-15', responsible: 'Compliance Officer',
      },
      {
        id: 'ra4', priority: 4,
        action: 'Update CECL documentation with vintage analysis methodology',
        actionEs: 'Actualizar documentación CECL con metodología de análisis vintage',
        impact: 'Strengthens credit loss model documentation',
        impactEs: 'Fortalece documentación del modelo de pérdidas crediticias',
        deadline: '2026-06-30', responsible: 'Credit Risk Manager',
      },
      {
        id: 'ra5', priority: 5,
        action: 'Add ALM discussion as standing agenda item for board meetings',
        actionEs: 'Agregar discusión ALM como punto permanente en agenda de junta',
        impact: 'Demonstrates active board IRR oversight',
        impactEs: 'Demuestra supervisión activa de la junta sobre IRR',
        deadline: '2026-05-30', responsible: 'Board Secretary',
      },
    ],
    documentChecklist: [
      { id: 'd1', document: 'ALM Policy (current)', documentEs: 'Política ALM (vigente)', category: 'Policy', ready: true, lastUpdated: '2026-01-15' },
      { id: 'd2', document: 'IRR Policy (current)', documentEs: 'Política IRR (vigente)', category: 'Policy', ready: true, lastUpdated: '2026-02-01' },
      { id: 'd3', document: 'Investment Policy (current)', documentEs: 'Política de Inversiones (vigente)', category: 'Policy', ready: true, lastUpdated: '2025-11-20' },
      { id: 'd4', document: 'Loan Policy (current)', documentEs: 'Política de Préstamos (vigente)', category: 'Policy', ready: true, lastUpdated: '2025-12-10' },
      { id: 'd5', document: 'BSA/AML Policy', documentEs: 'Política BSA/AML', category: 'Compliance', ready: true, lastUpdated: '2026-01-05' },
      { id: 'd6', document: 'Contingency Funding Plan', documentEs: 'Plan Contingencia Liquidez', category: 'Liquidity', ready: true, lastUpdated: '2026-03-01' },
      { id: 'd7', document: 'CECL Methodology Documentation', documentEs: 'Documentación Metodología CECL', category: 'Credit', ready: false, lastUpdated: null },
      { id: 'd8', document: 'Board Minutes (12 months)', documentEs: 'Actas Junta (12 meses)', category: 'Governance', ready: true, lastUpdated: '2026-03-15' },
      { id: 'd9', document: 'ALM Committee Minutes (quarterly)', documentEs: 'Actas Comité ALM (trimestral)', category: 'Governance', ready: true, lastUpdated: '2026-03-10' },
      { id: 'd10', document: 'Independent ALM Audit Report', documentEs: 'Informe Auditoría ALM Independiente', category: 'Audit', ready: true, lastUpdated: '2025-09-30' },
      { id: 'd11', document: 'IRR Model Validation Report', documentEs: 'Informe Validación Modelo IRR', category: 'Audit', ready: false, lastUpdated: null },
      { id: 'd12', document: 'Stress Test Results (latest)', documentEs: 'Resultados Pruebas Estrés (últimos)', category: 'Risk', ready: true, lastUpdated: '2026-03-20' },
      { id: 'd13', document: 'Capital Plan with Triggers', documentEs: 'Plan Capital con Disparadores', category: 'Capital', ready: true, lastUpdated: '2026-01-20' },
      { id: 'd14', document: 'CRE Concentration Limit Documentation', documentEs: 'Documentación Límites Concentración CRE', category: 'Credit', ready: false, lastUpdated: null },
      { id: 'd15', document: 'BSA Training Records (all staff)', documentEs: 'Registros Capacitación BSA (todo el personal)', category: 'Compliance', ready: false, lastUpdated: null },
      { id: 'd16', document: 'Succession Plan', documentEs: 'Plan de Sucesión', category: 'Governance', ready: true, lastUpdated: '2025-06-15' },
      { id: 'd17', document: 'Disaster Recovery Plan (tested)', documentEs: 'Plan Recuperación Desastres (probado)', category: 'IT', ready: true, lastUpdated: '2025-10-01' },
      { id: 'd18', document: 'Vendor Management Program', documentEs: 'Programa Gestión Proveedores', category: 'Operations', ready: true, lastUpdated: '2025-12-20' },
    ],
  };
}
