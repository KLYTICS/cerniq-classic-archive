'use client';

import { useMemo, useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { Check, AlertTriangle, X } from 'lucide-react';

import { useTranslation } from '@/lib/i18n';
import { label } from '@/lib/alm/labels';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';
import { DataTable, type DataTableColumn } from '@/components/density/DataTable';

/**
 * VaR Suite — flagship reference using the AlmPage shell.
 *
 * Module identity, header, loading/error/success states, demo banner,
 * and retry wiring are all handled by <AlmPage>. The only module-specific
 * concerns here are:
 *
 *   - Domain types + runtime shape guard (validate)
 *   - Demo factory (opt-in fallback)
 *   - The content render prop (MetricStrip + DataTable + chart + Kupiec)
 *   - Controls (confidence + horizon selects)
 *
 * To migrate another module, copy this file, swap slug + types + demo, and
 * adjust the content renderer. Total migration is usually <150 LoC.
 */

// ─── Domain types ────────────────────────────────────────────────────────────

interface VaRResult {
  readonly method: 'historical' | 'parametric' | 'montecarlo';
  readonly confidenceLevel: number;
  readonly horizon: number;
  readonly var: number;
  readonly cvar: number;
  readonly varPct: number;
  readonly portfolioValue: number;
}

interface BacktestResult {
  readonly testDays: number;
  readonly exceptions: number;
  readonly exceptionRate: number;
  readonly expectedExceptions: number;
  readonly kupiecLR: number;
  readonly kupiecPValue: number;
  readonly trafficLight: 'GREEN' | 'AMBER' | 'RED';
}

interface VaRSuite {
  readonly historical: VaRResult;
  readonly parametric: VaRResult;
  readonly montecarlo: VaRResult;
  readonly backtestResult: BacktestResult;
}

// ─── Static constants ────────────────────────────────────────────────────────

const METHOD_COLORS: Record<VaRResult['method'], string> = {
  historical: '#06b6d4',
  parametric: '#f59e0b',
  montecarlo: '#8b5cf6',
};

const TRAFFIC_STYLES = {
  GREEN: { bg: 'bg-emerald-50', text: 'text-emerald-700', border: 'border-emerald-200', Icon: Check },
  AMBER: { bg: 'bg-amber-50',   text: 'text-amber-700',   border: 'border-amber-200',   Icon: AlertTriangle },
  RED:   { bg: 'bg-rose-50',    text: 'text-rose-700',    border: 'border-rose-200',    Icon: X },
} as const;

// ─── Runtime validation + demo factory ──────────────────────────────────────

function isVaRResult(v: unknown): v is VaRResult {
  if (!v || typeof v !== 'object') return false;
  const r = v as Record<string, unknown>;
  return (
    typeof r.var === 'number' &&
    typeof r.cvar === 'number' &&
    typeof r.varPct === 'number' &&
    typeof r.portfolioValue === 'number'
  );
}

function validateVaRSuite(raw: unknown): VaRSuite {
  if (!raw || typeof raw !== 'object') throw new Error('VaR response must be an object');
  const r = raw as Record<string, unknown>;
  if (!isVaRResult(r.historical) || !isVaRResult(r.parametric) || !isVaRResult(r.montecarlo)) {
    throw new Error('VaR response missing one of historical/parametric/montecarlo');
  }
  if (!r.backtestResult || typeof r.backtestResult !== 'object') {
    throw new Error('VaR response missing backtestResult');
  }
  return r as unknown as VaRSuite;
}

function makeDemoData(conf: 95 | 99, hor: 1 | 10): VaRSuite {
  const scale = hor === 10 ? 3.16 : 1;
  const cScale = conf === 99 ? 1.4 : 1;
  const round = (n: number) => +n.toFixed(2);
  return {
    historical: { method: 'historical', confidenceLevel: conf / 100, horizon: hor, var: round(9.3 * scale * cScale), cvar: round(12.1 * scale * cScale), varPct: 2.09, portfolioValue: 445 },
    parametric: { method: 'parametric', confidenceLevel: conf / 100, horizon: hor, var: round(8.7 * scale * cScale), cvar: round(10.8 * scale * cScale), varPct: 1.96, portfolioValue: 445 },
    montecarlo: { method: 'montecarlo', confidenceLevel: conf / 100, horizon: hor, var: round(9.5 * scale * cScale), cvar: round(12.8 * scale * cScale), varPct: 2.13, portfolioValue: 445 },
    backtestResult: { testDays: 250, exceptions: 3, exceptionRate: 0.012, expectedExceptions: conf === 99 ? 2.5 : 12.5, kupiecLR: 1.85, kupiecPValue: 0.10, trafficLight: 'GREEN' },
  };
}

// ─── Content component (calls hooks on derived data) ───────────────────────

interface ContentProps {
  readonly data: VaRSuite;
  readonly confidence: 95 | 99;
}

interface MethodRow {
  readonly id: VaRResult['method'];
  readonly label: string;
  readonly result: VaRResult;
}

function VaRContent({ data, confidence }: ContentProps) {
  const { locale } = useTranslation();

  const methodRows = useMemo<readonly MethodRow[]>(
    () => [
      { id: 'historical', label: locale === 'es' ? 'Simulación Histórica' : 'Historical Simulation',     result: data.historical },
      { id: 'parametric', label: locale === 'es' ? 'Delta-Normal'          : 'Parametric (Delta-Normal)', result: data.parametric },
      { id: 'montecarlo', label: 'Monte Carlo',                                                          result: data.montecarlo },
    ],
    [data, locale],
  );

  const stripItems = useMemo<readonly MetricStripItem[]>(() => {
    const winnerVar  = Math.max(data.historical.var,  data.parametric.var,  data.montecarlo.var);
    const winnerCvar = Math.max(data.historical.cvar, data.parametric.cvar, data.montecarlo.cvar);
    return [
      { key: 'portfolio_value',     label: locale === 'es' ? 'Valor Portafolio' : 'Portfolio Value', unit: 'USD_M', value: data.historical.portfolioValue },
      { key: 'var',                 label: `${label('var',  locale)} (max)`, value: winnerVar,  unit: 'USD_M' },
      { key: 'cvar',                label: `${label('cvar', locale)} (max)`, value: winnerCvar, unit: 'USD_M' },
      { key: 'exceptions',          value: data.backtestResult.exceptions,         unit: 'count' },
      { key: 'expected_exceptions', value: data.backtestResult.expectedExceptions, unit: 'count' },
      { key: 'kupiec_lr',           value: data.backtestResult.kupiecLR,           unit: 'x' },
      { key: 'kupiec_p_value',      value: data.backtestResult.kupiecPValue,       unit: 'x' },
    ];
  }, [data, locale]);

  const methodColumns = useMemo<readonly DataTableColumn<MethodRow>[]>(() => [
    {
      id: 'method',
      header: locale === 'es' ? 'Método' : 'Method',
      kind: 'custom',
      accessor: (r) => r.label,
      render: (r) => (
        <span className="inline-flex items-center gap-2 text-xs font-medium text-slate-800">
          <span className="h-2 w-2 rounded-full" style={{ backgroundColor: METHOD_COLORS[r.id] }} aria-hidden />
          {r.label}
        </span>
      ),
    },
    { id: 'var',  headerKey: 'var',  kind: 'number', accessor: (r) => r.result.var,  unit: 'USD_M' },
    { id: 'cvar', headerKey: 'cvar', kind: 'number', accessor: (r) => r.result.cvar, unit: 'USD_M' },
    { id: 'pct',  header: locale === 'es' ? '% Portafolio' : '% Portfolio', kind: 'number', accessor: (r) => r.result.varPct, unit: '%' },
    { id: 'horizon', header: locale === 'es' ? 'Horizonte' : 'Horizon',     kind: 'custom',
      accessor: (r) => r.result.horizon,
      render: (r) => <span className="text-xs text-slate-600">{r.result.horizon}d</span>,
    },
  ], [locale]);

  const compChart = useMemo(
    () => methodRows.map((r) => ({
      method: r.label,
      var: r.result.var,
      cvar: r.result.cvar,
      color: METHOD_COLORS[r.id],
    })),
    [methodRows],
  );

  const bt = data.backtestResult;
  const tl = TRAFFIC_STYLES[bt.trafficLight];
  const TrafficIcon = tl.Icon;

  return (
    <>
      <MetricStrip items={stripItems} locale={locale} density="compact" />

      <section>
        <p className="mb-2 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          {locale === 'es' ? 'Comparación de Métodos' : 'Method Comparison'}
          {' '}
          <span className="text-slate-300">— VaR {confidence}%</span>
        </p>
        <DataTable rows={methodRows} columns={methodColumns} locale={locale} rowKey={(r) => r.id} />
      </section>

      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
          VaR vs. CVaR — {locale === 'es' ? 'Comparación de Métodos' : 'Method Comparison'}
        </p>
        <ResponsiveContainer width="100%" height={240}>
          <BarChart data={compChart}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="method" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={(v) => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip
              contentStyle={{ borderRadius: 12, border: '1px solid #e2e8f0', fontSize: 12 }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(2)}M`, '']}
            />
            <Bar dataKey="var" name={`VaR ${confidence}%`} radius={[4, 4, 0, 0]}>
              {compChart.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Bar>
            <Bar dataKey="cvar" name="CVaR / ES" fill="#ef4444" radius={[4, 4, 0, 0]} opacity={0.6} />
          </BarChart>
        </ResponsiveContainer>
      </section>

      <section className={`rounded-xl border p-4 ${tl.bg} ${tl.border}`}>
        <div className="flex items-center justify-between">
          <div>
            <p className="text-sm font-bold text-slate-950">
              {locale === 'es' ? 'Backtest Kupiec — Semáforo Basel' : 'Kupiec Backtest — Basel Traffic Light'}
            </p>
            <p className="mt-1 text-xs text-slate-600">
              {bt.exceptions} {locale === 'es' ? 'excepciones en' : 'exceptions in'} {bt.testDays} {locale === 'es' ? 'días' : 'days'}
              {' '}({locale === 'es' ? 'esperado' : 'expected'}: {bt.expectedExceptions.toFixed(1)})
              {' | '}LR: {bt.kupiecLR.toFixed(2)}
              {' | '}p: {bt.kupiecPValue}
            </p>
          </div>
          <div className={`flex items-center gap-2 rounded-full border px-4 py-2 text-sm font-bold ${tl.bg} ${tl.text} ${tl.border}`}>
            <TrafficIcon className="h-4 w-4" />
            {bt.trafficLight}
          </div>
        </div>
      </section>
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function VaRPage() {
  const { locale } = useTranslation();
  const [confidence, setConfidence] = useState<95 | 99>(95);
  const [horizon, setHorizon] = useState<1 | 10>(1);

  return (
    <AlmPage<VaRSuite>
      slug="var"
      iconTint="purple"
      validate={validateVaRSuite}
      queryParams={{ confidence, horizon }}
      deps={[confidence, horizon]}
      getDemo={() => makeDemoData(confidence, horizon)}
      controls={
        <>
          <label className="sr-only" htmlFor="var-confidence">
            {locale === 'es' ? 'Nivel de confianza' : 'Confidence level'}
          </label>
          <select
            id="var-confidence"
            value={confidence}
            onChange={(e) => setConfidence(+e.target.value as 95 | 99)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value={95}>95%</option>
            <option value={99}>99%</option>
          </select>
          <label className="sr-only" htmlFor="var-horizon">
            {locale === 'es' ? 'Horizonte temporal' : 'Time horizon'}
          </label>
          <select
            id="var-horizon"
            value={horizon}
            onChange={(e) => setHorizon(+e.target.value as 1 | 10)}
            className="rounded-lg border border-slate-200 px-2 py-1.5 text-xs"
          >
            <option value={1}>1-{locale === 'es' ? 'Día' : 'Day'}</option>
            <option value={10}>10-{locale === 'es' ? 'Días' : 'Day'}</option>
          </select>
        </>
      }
    >
      {(data) => <VaRContent data={data} confidence={confidence} />}
    </AlmPage>
  );
}
