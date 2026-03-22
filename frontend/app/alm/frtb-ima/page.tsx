'use client';

import { useState, useEffect } from 'react';
import { useALM } from '@/components/alm/ALMProvider';
import { useTranslation } from '@/lib/i18n';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, Legend } from 'recharts';
import { ShieldCheck, AlertTriangle } from 'lucide-react';

interface FRTBResult {
  imcc: number;
  ses: number;
  drc: number;
  totalCapital: number;
  riskClasses: Array<{ name: string; imcc: number; ses: number; total: number }>;
  liquidityHorizons: Array<{ horizon: string; days: number; capital: number }>;
  backTestPnL: Array<{ date: string; pnl: number; var97: number }>;
}

export default function FRTBIMAPage() {
  const { selectedId } = useALM();
  const { locale } = useTranslation();
  const [data, setData] = useState<FRTBResult | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!selectedId) return;
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE}/api/alm/${selectedId}/frtb-capital`);
        if (res.ok) setData(await res.json());
        else setData(getDemo());
      } catch { setData(getDemo()); }
      finally { setLoading(false); }
    })();
  }, [selectedId]);

  if (!selectedId) return <div className="flex-1 flex items-center justify-center p-6"><AlertTriangle className="h-12 w-12 text-amber-500" /></div>;
  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-sky-200 bg-sky-50">
          <ShieldCheck className="h-4 w-4 text-sky-700" />
        </div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">{locale === 'es' ? 'FRTB-IMA — Expected Shortfall Basel III.1' : 'FRTB-IMA — Expected Shortfall Basel III.1'}</h1>
          <p className="text-xs text-slate-500">{locale === 'es' ? 'Capital de mercado: IMCC + SES + DRC con horizontes de liquidez' : 'Market capital: IMCC + SES + DRC with liquidity horizons'}</p>
        </div>
      </div>

      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <KPI label="IMCC" value={`$${data.imcc.toFixed(1)}M`} />
        <KPI label="SES" value={`$${data.ses.toFixed(1)}M`} />
        <KPI label="DRC" value={`$${data.drc.toFixed(1)}M`} />
        <KPI label={locale === 'es' ? 'Capital Total' : 'Total Capital'} value={`$${data.totalCapital.toFixed(1)}M`} warn={data.totalCapital > 20} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">
          {locale === 'es' ? 'Capital por Clase de Riesgo (IMCC + SES)' : 'Capital by Risk Class (IMCC + SES)'}
        </p>
        <ResponsiveContainer width="100%" height={300}>
          <BarChart data={data.riskClasses}>
            <CartesianGrid strokeDasharray="3 3" stroke="#f1f5f9" />
            <XAxis dataKey="name" tick={{ fontSize: 11 }} />
            <YAxis tickFormatter={v => `$${v}M`} tick={{ fontSize: 11 }} />
            <Tooltip contentStyle={{ borderRadius: 12, fontSize: 12 }} formatter={(v: number) => `$${v.toFixed(2)}M`} />
            <Legend wrapperStyle={{ fontSize: 11 }} />
            <Bar dataKey="imcc" name="IMCC" stackId="a" fill="#0ea5e9" radius={[0, 0, 0, 0]} />
            <Bar dataKey="ses" name="SES" stackId="a" fill="#f97316" radius={[4, 4, 0, 0]} />
          </BarChart>
        </ResponsiveContainer>
      </div>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {locale === 'es' ? 'Horizontes de Liquidez' : 'Liquidity Horizons'}
          </p>
          <div className="space-y-2">
            {data.liquidityHorizons.map((lh, i) => (
              <div key={i} className="flex items-center justify-between rounded-lg bg-slate-50 px-3 py-2">
                <div>
                  <span className="text-sm font-medium text-slate-800">{lh.horizon}</span>
                  <span className="ml-2 text-[10px] text-slate-400">{lh.days}d</span>
                </div>
                <span className="text-xs font-bold tabular-nums text-sky-700">${lh.capital.toFixed(2)}M</span>
              </div>
            ))}
          </div>
        </div>
        <div className="rounded-xl border border-slate-200 bg-white p-4">
          <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
            {locale === 'es' ? 'Descomposición Basel III.1' : 'Basel III.1 Decomposition'}
          </p>
          <div className="space-y-3">
            {[
              { label: 'IMCC (Internal Models)', pct: data.imcc / data.totalCapital, value: data.imcc, color: '#0ea5e9' },
              { label: 'SES (Stressed ES)', pct: data.ses / data.totalCapital, value: data.ses, color: '#f97316' },
              { label: 'DRC (Default Risk)', pct: data.drc / data.totalCapital, value: data.drc, color: '#8b5cf6' },
            ].map((c, i) => (
              <div key={i}>
                <div className="flex justify-between text-xs text-slate-600 mb-1">
                  <span>{c.label}</span>
                  <span className="font-mono">${c.value.toFixed(1)}M ({(c.pct * 100).toFixed(0)}%)</span>
                </div>
                <div className="h-2 bg-slate-100 rounded-full">
                  <div className="h-full rounded-full" style={{ width: `${c.pct * 100}%`, backgroundColor: c.color }} />
                </div>
              </div>
            ))}
          </div>
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

function getDemo(): FRTBResult {
  return {
    imcc: 8.4, ses: 5.2, drc: 3.1, totalCapital: 16.7,
    riskClasses: [
      { name: 'GIRR', imcc: 3.8, ses: 2.1, total: 5.9 },
      { name: 'CSR', imcc: 2.4, ses: 1.8, total: 4.2 },
      { name: 'Equity', imcc: 1.2, ses: 0.8, total: 2.0 },
      { name: 'FX', imcc: 0.7, ses: 0.3, total: 1.0 },
      { name: 'Commodity', imcc: 0.3, ses: 0.2, total: 0.5 },
    ],
    liquidityHorizons: [
      { horizon: 'LH 10d (Rates)', days: 10, capital: 3.2 },
      { horizon: 'LH 20d (Credit IG)', days: 20, capital: 4.1 },
      { horizon: 'LH 40d (Credit HY)', days: 40, capital: 2.8 },
      { horizon: 'LH 60d (Equity Large)', days: 60, capital: 1.9 },
      { horizon: 'LH 120d (Equity Small)', days: 120, capital: 0.6 },
    ],
    backTestPnL: [],
  };
}
