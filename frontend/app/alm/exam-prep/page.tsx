'use client';

import { useState, useEffect } from 'react';
import { apiClient } from '@/lib/api';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { ClipboardCheck, AlertTriangle, Check, X, Clock, FileText, Download, Shield } from 'lucide-react';

interface CAMELComponent { component: string; componentEs: string; score: number; rating: string; ratingEs: string; detail: string; detailEs: string }
interface CAMELResult { components: CAMELComponent[]; composite: number; compositeRating: string; compositeRatingEs: string; examReadiness: string }
interface GovernanceItem { id: string; item: string; itemEs: string; category: string; completed: boolean }
interface Finding { id: string; finding: string; findingEs: string; targetDate: string; status: string }
interface ScheduleStatus { schedule: string; name: string; nameEs: string; available: boolean; dataSource: string }
interface ExamPrepResult {
  camel: CAMELResult;
  governance: { items: GovernanceItem[]; completedCount: number; totalCount: number; completionPct: number; managementScore: number };
  findings: Finding[];
  scheduleStatus: ScheduleStatus[];
}

const CAMEL_COLORS: Record<number, { bg: string; text: string; border: string }> = {
  1: { bg: 'bg-emerald-100', text: 'text-emerald-700', border: 'border-emerald-300' },
  2: { bg: 'bg-cyan-100', text: 'text-cyan-700', border: 'border-cyan-300' },
  3: { bg: 'bg-amber-100', text: 'text-amber-700', border: 'border-amber-300' },
  4: { bg: 'bg-orange-100', text: 'text-orange-700', border: 'border-orange-300' },
  5: { bg: 'bg-rose-100', text: 'text-rose-700', border: 'border-rose-300' },
};

const READINESS_STYLES: Record<string, { bg: string; text: string; border: string; icon: React.ElementType }> = {
  READY: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', icon: Check },
  NEEDS_WORK: { bg: 'bg-amber-50', text: 'text-amber-700', border: 'border-amber-200', icon: Clock },
  AT_RISK: { bg: 'bg-rose-50', text: 'text-rose-700', border: 'border-rose-200', icon: X },
};

export default function ExamPrepPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<ExamPrepResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/alm/${selectedId}/exam-prep`);
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  const readiness = READINESS_STYLES[data.camel.examReadiness] || READINESS_STYLES.NEEDS_WORK;
  const ReadinessIcon = readiness.icon;

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
              {locale === 'es' ? 'Suite de Preparación de Examen COSSEC' : 'COSSEC Exam Preparation Suite'}
            </h1>
            <p className="text-xs text-slate-500">
              {locale === 'es' ? 'CAMEL auto-evaluación, gobernanza, hallazgos, Schedules 1-12' : 'CAMEL self-assessment, governance, findings, Schedules 1-12'}
            </p>
          </div>
        </div>
        <button className="flex items-center gap-1.5 rounded-xl bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700">
          <Download className="h-4 w-4" />
          {locale === 'es' ? 'Descargar Pack Examen' : 'Download Exam Pack'}
        </button>
      </div>

      {/* Exam Readiness Banner */}
      <div className={`flex items-center gap-3 rounded-xl border p-4 ${readiness.bg} ${readiness.border}`}>
        <ReadinessIcon className={`h-6 w-6 ${readiness.text}`} />
        <div>
          <p className={`text-sm font-bold ${readiness.text}`}>
            {data.camel.examReadiness === 'READY' ? (locale === 'es' ? 'Listo para Examen' : 'Exam Ready') :
             data.camel.examReadiness === 'NEEDS_WORK' ? (locale === 'es' ? 'Requiere Trabajo' : 'Needs Work') :
             locale === 'es' ? 'En Riesgo' : 'At Risk'}
          </p>
          <p className="text-xs text-slate-600">
            CAMEL {locale === 'es' ? 'Compuesto' : 'Composite'}: {data.camel.composite} ({locale === 'es' ? data.camel.compositeRatingEs : data.camel.compositeRating})
          </p>
        </div>
      </div>

      {/* CAMEL Scorecard */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Tarjeta CAMEL — Auto-Evaluación' : 'CAMEL Scorecard — Self-Assessment'}
        </p>
        <div className="grid grid-cols-5 gap-3">
          {data.camel.components.map(c => {
            const color = CAMEL_COLORS[c.score] || CAMEL_COLORS[3];
            return (
              <div key={c.component} className={`rounded-xl border p-4 text-center ${color.bg} ${color.border}`}>
                <p className="text-[10px] font-bold uppercase tracking-wider opacity-60">
                  {locale === 'es' ? c.componentEs : c.component}
                </p>
                <p className={`text-4xl font-black mt-1 ${color.text}`}>{c.score}</p>
                <p className={`text-xs font-semibold mt-1 ${color.text}`}>
                  {locale === 'es' ? c.ratingEs : c.rating}
                </p>
                <p className="text-[10px] text-slate-600 mt-2 leading-tight">
                  {locale === 'es' ? c.detailEs : c.detail}
                </p>
              </div>
            );
          })}
        </div>
      </div>

      {/* Governance Checklist */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <div className="flex items-center justify-between mb-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">
            {locale === 'es' ? 'Lista de Verificación de Gobernanza' : 'Governance Checklist'} ({data.governance.completedCount}/{data.governance.totalCount})
          </p>
          <div className="flex items-center gap-2">
            <div className="h-2 w-32 rounded-full bg-slate-100">
              <div className="h-2 rounded-full bg-blue-500" style={{ width: `${data.governance.completionPct}%` }} />
            </div>
            <span className="text-xs font-bold text-slate-700">{data.governance.completionPct}%</span>
          </div>
        </div>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-2">
          {data.governance.items.map(g => (
            <div key={g.id} className={`flex items-center gap-2 rounded-lg border px-3 py-2 ${
              g.completed ? 'border-emerald-100 bg-emerald-50/50' : 'border-rose-100 bg-rose-50/50'
            }`}>
              {g.completed
                ? <Check className="h-3.5 w-3.5 text-emerald-600 shrink-0" />
                : <X className="h-3.5 w-3.5 text-rose-500 shrink-0" />}
              <span className="text-xs text-slate-700">{locale === 'es' ? g.itemEs : g.item}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Prior Findings */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Hallazgos de Examen Previo' : 'Prior Exam Findings'}
        </p>
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-slate-100">
              {[locale === 'es' ? 'Hallazgo' : 'Finding', locale === 'es' ? 'Fecha Límite' : 'Target Date', locale === 'es' ? 'Estado' : 'Status'].map(h => (
                <th key={h} className="px-3 py-2 text-left text-[11px] font-medium text-slate-500">{h}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {data.findings.map(f => (
              <tr key={f.id} className="border-b border-slate-50 last:border-0">
                <td className="px-3 py-2.5 text-xs text-slate-700">{locale === 'es' ? f.findingEs : f.finding}</td>
                <td className="px-3 py-2.5 text-xs tabular-nums text-slate-500">{f.targetDate}</td>
                <td className="px-3 py-2.5">
                  <span className={`inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-bold ${
                    f.status === 'closed' ? 'bg-emerald-50 text-emerald-700 border-emerald-200' :
                    f.status === 'in_progress' ? 'bg-amber-50 text-amber-700 border-amber-200' :
                    'bg-rose-50 text-rose-700 border-rose-200'
                  }`}>
                    {f.status === 'closed' ? <Check className="h-2.5 w-2.5" /> : f.status === 'in_progress' ? <Clock className="h-2.5 w-2.5" /> : <AlertTriangle className="h-2.5 w-2.5" />}
                    {f.status.replace('_', ' ').toUpperCase()}
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Schedules 1-12 Status */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Schedules COSSEC 1-12 — Estado de Datos' : 'COSSEC Schedules 1-12 — Data Status'}
        </p>
        <div className="grid grid-cols-2 md:grid-cols-4 lg:grid-cols-6 gap-2">
          {data.scheduleStatus.map(s => (
            <div key={s.schedule} className={`rounded-lg border p-3 text-center ${s.available ? 'border-emerald-200 bg-emerald-50' : 'border-slate-200 bg-slate-50'}`}>
              <div className="flex items-center justify-center gap-1.5 mb-1">
                <FileText className={`h-3.5 w-3.5 ${s.available ? 'text-emerald-600' : 'text-slate-400'}`} />
                <span className="text-xs font-bold text-slate-800">S-{s.schedule}</span>
              </div>
              <p className="text-[10px] text-slate-600 leading-tight">{locale === 'es' ? s.nameEs : s.name}</p>
              {s.available && <Check className="h-3 w-3 text-emerald-500 mx-auto mt-1" />}
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

function getDemoData(): ExamPrepResult {
  return {
    camel: {
      components: [
        { component: 'Capital', componentEs: 'Capital', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'NWR 9.2% — Adequately capitalized.', detailEs: 'NWR 9.2% — Adecuadamente capitalizada.' },
        { component: 'Asset Quality', componentEs: 'Calidad de Activos', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'NPL: 1.8%, Classified: 3.6%.', detailEs: 'NPL: 1.8%, Clasificados: 3.6%.' },
        { component: 'Management', componentEs: 'Administración', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'Governance: 18/24 items complete.', detailEs: 'Gobernanza: 18/24 ítems completos.' },
        { component: 'Earnings', componentEs: 'Rentabilidad', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'ROA: 0.82%, Expense: 78%.', detailEs: 'ROA: 0.82%, Gastos: 78%.' },
        { component: 'Liquidity', componentEs: 'Liquidez', score: 2, rating: 'Satisfactory', ratingEs: 'Satisfactorio', detail: 'LCR: 115%, NSFR: 108%.', detailEs: 'LCR: 115%, NSFR: 108%.' },
      ],
      composite: 2, compositeRating: 'Satisfactory', compositeRatingEs: 'Satisfactorio', examReadiness: 'READY',
    },
    governance: {
      items: [
        { id: 'board_meetings', item: 'Board meets 10+ times/year', itemEs: 'Junta se reúne 10+ veces/año', category: 'governance', completed: true },
        { id: 'risk_committee', item: 'Risk Committee meets quarterly', itemEs: 'Comité de Riesgo trimestral', category: 'governance', completed: true },
        { id: 'alm_committee', item: 'ALM Committee meets quarterly', itemEs: 'Comité ALM trimestral', category: 'governance', completed: true },
        { id: 'irr_policy', item: 'IRR Policy reviewed', itemEs: 'Política IRR revisada', category: 'policy', completed: true },
        { id: 'investment_policy', item: 'Investment Policy reviewed', itemEs: 'Política Inversiones revisada', category: 'policy', completed: true },
        { id: 'loan_policy', item: 'Loan Policy reviewed', itemEs: 'Política Préstamos revisada', category: 'policy', completed: true },
        { id: 'bsa_policy', item: 'BSA/AML Policy reviewed', itemEs: 'Política BSA/AML revisada', category: 'compliance', completed: true },
        { id: 'alm_audit', item: 'Independent ALM audit', itemEs: 'Auditoría ALM independiente', category: 'audit', completed: true },
        { id: 'stress_board', item: 'Stress results to board', itemEs: 'Resultados estrés a junta', category: 'risk', completed: true },
        { id: 'cecl_doc', item: 'CECL methodology documented', itemEs: 'Metodología CECL documentada', category: 'credit', completed: true },
        { id: 'cfp', item: 'Contingency Funding Plan', itemEs: 'Plan Contingencia Liquidez', category: 'liquidity', completed: true },
        { id: 'deposit_limits', item: 'Deposit limits established', itemEs: 'Límites depósitos establecidos', category: 'risk', completed: true },
        { id: 'lts_limit', item: 'Loan-to-share limit', itemEs: 'Límite préstamos/acciones', category: 'policy', completed: true },
        { id: 'capital_plan', item: 'Capital plan triggers', itemEs: 'Disparadores plan capital', category: 'capital', completed: true },
        { id: 'succession', item: 'Succession plan', itemEs: 'Plan de sucesión', category: 'governance', completed: true },
        { id: 'dr_test', item: 'DR plan tested', itemEs: 'Plan DR probado', category: 'it', completed: true },
        { id: 'cyber_plan', item: 'Cyber response plan', itemEs: 'Plan respuesta ciber', category: 'it', completed: true },
        { id: 'vendor_mgmt', item: 'Vendor management', itemEs: 'Gestión proveedores', category: 'operations', completed: true },
        { id: 'ofac', item: 'OFAC screening', itemEs: 'Verificación OFAC', category: 'compliance', completed: false },
        { id: 'bsa_training', item: 'BSA training complete', itemEs: 'Capacitación BSA completa', category: 'compliance', completed: false },
        { id: 'irr_training', item: 'IRR training complete', itemEs: 'Capacitación IRR completa', category: 'risk', completed: false },
        { id: 'board_training', item: 'Board training', itemEs: 'Capacitación junta', category: 'governance', completed: false },
        { id: 'external_audit', item: 'External audit', itemEs: 'Auditoría externa', category: 'audit', completed: false },
        { id: 'mgmt_letter', item: 'Mgmt letter reviewed', itemEs: 'Carta gerencia revisada', category: 'audit', completed: false },
      ],
      completedCount: 18, totalCount: 24, completionPct: 75, managementScore: 2,
    },
    findings: [
      { id: 'f1', finding: 'CRE concentration limit not documented', findingEs: 'Límite concentración CRE no documentado', targetDate: '2026-06-30', status: 'in_progress' },
      { id: 'f2', finding: 'BSA training records incomplete', findingEs: 'Registros capacitación BSA incompletos', targetDate: '2026-04-15', status: 'open' },
      { id: 'f3', finding: 'IRR model validation overdue', findingEs: 'Validación modelo IRR vencida', targetDate: '2026-03-31', status: 'closed' },
    ],
    scheduleStatus: Array.from({ length: 12 }, (_, i) => ({
      schedule: String(i + 1),
      name: ['Profile & Capital', 'Assets', 'Liabilities', 'Income', 'Loans', 'Investments', 'Repricing Gap', 'IRR', 'Liquidity', 'Capital Adequacy', 'CECL', 'Concentration'][i],
      nameEs: ['Perfil y Capital', 'Activos', 'Pasivos', 'Ingresos', 'Préstamos', 'Inversiones', 'Brecha Repricing', 'Riesgo Tasa', 'Liquidez', 'Suficiencia Capital', 'CECL', 'Concentración'][i],
      available: true, dataSource: 'CERNIQ',
    })),
  };
}
