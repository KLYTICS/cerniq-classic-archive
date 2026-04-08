'use client';

import { useMemo } from 'react';
import {
  PieChart, Pie, Cell, RadialBarChart, RadialBar,
  ResponsiveContainer, PolarAngleAxis, Tooltip,
  BarChart, Bar, XAxis, YAxis, CartesianGrid, ReferenceLine,
} from 'recharts';

import { useTranslation } from '@/lib/i18n';
import { AlmPage } from '@/components/alm/AlmPage';
import { MetricStrip, type MetricStripItem } from '@/components/density/MetricStrip';

/**
 * Liquidity — migrated to the AlmPage shell.
 *
 * Primary LCR / HQLA / Net Outflows panel. The original dark-themed page
 * was inconsistent with the rest of the post-density modules; this version
 * matches the white-background palette used by var/cecl/stress-v2.
 */

// ─── Domain types ────────────────────────────────────────────────────────────

interface LiquidityPosition {
  readonly lcr: number;
  readonly hqla: number;
  readonly netOutflows: number;
  readonly status: 'compliant' | 'warning' | 'breach';
  readonly buffer: number;
}

// ─── Validation + demo ──────────────────────────────────────────────────────

function validateLiquidity(raw: unknown): LiquidityPosition {
  if (!raw || typeof raw !== 'object') throw new Error('Liquidity response must be an object');
  const r = raw as Record<string, unknown>;
  if (typeof r.lcr !== 'number') throw new Error('Liquidity: missing lcr');
  if (typeof r.hqla !== 'number') throw new Error('Liquidity: missing hqla');
  if (typeof r.netOutflows !== 'number') throw new Error('Liquidity: missing netOutflows');
  return r as unknown as LiquidityPosition;
}

function getDemo(): LiquidityPosition {
  return { lcr: 142.3, hqla: 87.5, netOutflows: 61.4, status: 'compliant', buffer: 42.3 };
}

// ─── Custom panels ───────────────────────────────────────────────────────────

interface LCRGaugeProps {
  readonly lcr: number;
}

function LCRGauge({ lcr }: LCRGaugeProps) {
  const cappedLcr = Math.min(lcr, 200);
  const color = lcr >= 100 ? '#059669' : lcr >= 90 ? '#d97706' : '#dc2626';
  const data = [{ value: cappedLcr, fill: color }];

  return (
    <div className="flex flex-col items-center">
      <div className="relative" style={{ width: 200, height: 200 }}>
        <ResponsiveContainer width="100%" height="100%">
          <RadialBarChart cx="50%" cy="50%" innerRadius="70%" outerRadius="100%" barSize={14} data={data} startAngle={180} endAngle={0}>
            <PolarAngleAxis type="number" domain={[0, 200]} angleAxisId={0} tick={false} />
            <RadialBar background={{ fill: '#f1f5f9' }} dataKey="value" cornerRadius={8} angleAxisId={0} />
          </RadialBarChart>
        </ResponsiveContainer>
        <div className="absolute inset-0 flex flex-col items-center justify-center" style={{ paddingTop: 16 }}>
          <span className="text-3xl font-bold tabular-nums text-slate-950">{lcr.toFixed(1)}%</span>
          <span className="mt-0.5 text-[10px] uppercase tracking-wider text-slate-500">LCR</span>
        </div>
      </div>
    </div>
  );
}

interface HQLAProps {
  readonly hqla: number;
  readonly netOutflows: number;
  readonly locale: 'en' | 'es';
}

function HQLAComposition({ hqla, netOutflows, locale }: HQLAProps) {
  const data = [
    { name: 'Level 1',  desc: locale === 'es' ? 'Efectivo + Bonos Gov' : 'Cash + Govt Bonds', value: +(hqla * 0.70).toFixed(2), color: '#059669' },
    { name: 'Level 2A', desc: locale === 'es' ? 'Agency MBS / Corp'    : 'Agency MBS / Corp',  value: +(hqla * 0.20).toFixed(2), color: '#2563eb' },
    { name: 'Level 2B', desc: locale === 'es' ? 'Corporativo Bajo'     : 'Lower-Rated Corp',   value: +(hqla * 0.10).toFixed(2), color: '#7c3aed' },
  ];

  return (
    <div>
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {locale === 'es' ? 'Composición HQLA' : 'HQLA Composition'}
      </h3>
      <div className="flex items-center gap-6">
        <ResponsiveContainer width={150} height={150}>
          <PieChart>
            <Pie data={data} cx="50%" cy="50%" innerRadius={42} outerRadius={68} paddingAngle={3} dataKey="value">
              {data.map((e, i) => <Cell key={i} fill={e.color} />)}
            </Pie>
            <Tooltip
              contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
              formatter={(value) => [`$${Number(value ?? 0).toFixed(1)}M`, '']}
            />
          </PieChart>
        </ResponsiveContainer>
        <div className="flex-1 space-y-2">
          {data.map((item) => (
            <div key={item.name} className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: item.color }} aria-hidden />
                <div>
                  <p className="text-xs font-medium text-slate-800">{item.name}</p>
                  <p className="text-[10px] text-slate-500">{item.desc}</p>
                </div>
              </div>
              <span className="font-mono text-xs tabular-nums text-slate-700">${item.value.toFixed(1)}M</span>
            </div>
          ))}
        </div>
      </div>
      <div className="mt-4 space-y-1.5 border-t border-slate-100 pt-3">
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">{locale === 'es' ? 'HQLA Total' : 'Total HQLA'}</span>
          <span className="font-medium tabular-nums text-slate-800">${hqla.toFixed(1)}M</span>
        </div>
        <div className="flex justify-between text-[11px]">
          <span className="text-slate-500">{locale === 'es' ? 'Salidas Netas (30d)' : 'Net Outflows (30d)'}</span>
          <span className="font-medium tabular-nums text-slate-800">${netOutflows.toFixed(1)}M</span>
        </div>
      </div>
    </div>
  );
}

interface WaterfallProps {
  readonly hqla: number;
  readonly netOutflows: number;
  readonly locale: 'en' | 'es';
}

function CashFlowWaterfall({ hqla, netOutflows, locale }: WaterfallProps) {
  const weeks = [
    { name: 'W1', inflow: +(hqla * 0.08).toFixed(2), outflow: +(-netOutflows * 0.30).toFixed(2) },
    { name: 'W2', inflow: +(hqla * 0.06).toFixed(2), outflow: +(-netOutflows * 0.25).toFixed(2) },
    { name: 'W3', inflow: +(hqla * 0.05).toFixed(2), outflow: +(-netOutflows * 0.25).toFixed(2) },
    { name: 'W4', inflow: +(hqla * 0.04).toFixed(2), outflow: +(-netOutflows * 0.20).toFixed(2) },
  ];

  return (
    <div>
      <h3 className="mb-3 text-[10px] font-semibold uppercase tracking-[0.18em] text-slate-500">
        {locale === 'es' ? 'Proyección Flujo 30 Días' : '30-Day Cash Flow Projection'}
      </h3>
      <ResponsiveContainer width="100%" height={220}>
        <BarChart data={weeks} margin={{ top: 5, right: 5, left: 5, bottom: 5 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
          <XAxis dataKey="name" tick={{ fontSize: 11 }} />
          <YAxis tick={{ fontSize: 11 }} tickFormatter={(v) => `$${v}M`} />
          <Tooltip
            contentStyle={{ backgroundColor: '#fff', border: '1px solid #e2e8f0', borderRadius: 8, fontSize: 12 }}
            formatter={(value, name) => [`$${Number(value ?? 0).toFixed(1)}M`, name === 'inflow' ? (locale === 'es' ? 'Entradas' : 'Inflows') : (locale === 'es' ? 'Salidas' : 'Outflows')]}
          />
          <ReferenceLine y={0} stroke="#cbd5e1" />
          <Bar dataKey="inflow"  fill="#059669" fillOpacity={0.7} radius={[3, 3, 0, 0]} name="inflow" />
          <Bar dataKey="outflow" fill="#dc2626" fillOpacity={0.7} radius={[3, 3, 0, 0]} name="outflow" />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}

// ─── Content ─────────────────────────────────────────────────────────────────

function LiquidityContent({ data }: { data: LiquidityPosition }) {
  const { locale } = useTranslation();

  const stripItems = useMemo<readonly MetricStripItem[]>(() => [
    { key: 'lcr',          value: data.lcr,         unit: '%' },
    { key: 'hqla',         value: data.hqla,        unit: 'USD_M' },
    { key: 'net_outflows', label: locale === 'es' ? 'Salidas Netas' : 'Net Outflows', value: data.netOutflows, unit: 'USD_M' },
    { key: 'buffer',       label: locale === 'es' ? 'Búfer sobre Mín.' : 'Buffer over Min', value: data.buffer, unit: '%' },
  ], [data, locale]);

  const statusTone =
    data.status === 'compliant' ? { bg: 'bg-emerald-50', border: 'border-emerald-200', text: 'text-emerald-700', label: locale === 'es' ? 'Cumple' : 'Compliant' } :
    data.status === 'warning'   ? { bg: 'bg-amber-50',   border: 'border-amber-200',   text: 'text-amber-700',   label: locale === 'es' ? 'Advertencia' : 'Warning' } :
                                  { bg: 'bg-rose-50',    border: 'border-rose-200',    text: 'text-rose-700',    label: locale === 'es' ? 'Incumple' : 'Breach' };

  return (
    <>
      <MetricStrip items={stripItems} locale={locale} density="compact" />

      {/* Basel III compliance banner */}
      <section className={`flex items-center gap-3 rounded-xl border p-3.5 ${statusTone.bg} ${statusTone.border}`}>
        <span className={`rounded-full border px-3 py-1 text-xs font-bold ${statusTone.bg} ${statusTone.text} ${statusTone.border}`}>
          {statusTone.label}
        </span>
        <div className="text-[11px] text-slate-600">
          LCR {data.lcr.toFixed(1)}% (min 100%) · {locale === 'es' ? 'búfer' : 'buffer'} {data.buffer > 0 ? '+' : ''}{data.buffer.toFixed(1)}%
        </div>
      </section>

      {/* Main grid: gauge + HQLA + metrics */}
      <div className="grid grid-cols-1 gap-4 lg:grid-cols-2">
        <section className="flex items-center justify-center rounded-xl border border-slate-200 bg-white p-5">
          <LCRGauge lcr={data.lcr} />
        </section>
        <section className="rounded-xl border border-slate-200 bg-white p-5">
          <HQLAComposition hqla={data.hqla} netOutflows={data.netOutflows} locale={locale} />
        </section>
      </div>

      {/* Cash flow waterfall */}
      <section className="rounded-xl border border-slate-200 bg-white p-5">
        <CashFlowWaterfall hqla={data.hqla} netOutflows={data.netOutflows} locale={locale} />
      </section>
    </>
  );
}

// ─── Page ────────────────────────────────────────────────────────────────────

export default function LiquidityPage() {
  return (
    <AlmPage<LiquidityPosition>
      slug="liquidity"
      iconTint="emerald"
      validate={validateLiquidity}
      getDemo={getDemo}
    >
      {(data) => <LiquidityContent data={data} />}
    </AlmPage>
  );
}
