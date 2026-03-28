'use client';

import { useState, useEffect } from 'react';
import type { LucideIcon } from 'lucide-react';
import { BarChart3, TrendingUp, DollarSign, Users } from 'lucide-react';

interface AcquirerScenario {
  acquirer: string;
  thesis: string;
  valuationRange: string;
}

interface ExitMetricsData {
  mrr: number;
  arr: number;
  activeInstitutions: number;
  averageRevenuePerInstitution: number;
  netRevenueRetention: number;
  churnRate: number;
  lifetimeValue: number;
  ltvCacRatio: number;
  impliedValuation: {
    at8x: number;
    at10x: number;
    at12x: number;
  };
  acquirerScenarios: AcquirerScenario[];
  totalServices: number;
  totalEndpoints: number;
  totalPages: number;
  totalPrismaModels: number;
}

interface TileProps {
  icon?: LucideIcon;
  label: string;
  value: string | number;
  accent?: boolean;
  good?: boolean;
}

export default function ExitDashboardPage() {
  const [data, setData] = useState<ExitMetricsData | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const res = await fetch(`${NODE_API_URL}/api/admin/exit-metrics`, { headers: { 'x-admin-key': 'admin' } });
        if (res.ok) setData(await res.json());
        else setData(getDemoData());
      } catch { setData(getDemoData()); }
      finally { setLoading(false); }
    })();
  }, []);

  if (loading || !data) return <div className="flex-1 flex items-center justify-center p-6"><div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" /></div>;

  return (
    <div className="p-6 space-y-5 max-w-[1400px] mx-auto">
      <div className="flex items-center gap-3 mb-6">
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900"><BarChart3 className="h-4 w-4 text-white" /></div>
        <div>
          <h1 className="text-lg font-bold text-slate-950">Exit Metrics Dashboard</h1>
          <p className="text-xs text-slate-500">SaaS KPIs for M&A due diligence</p>
        </div>
      </div>

      {/* Revenue */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile icon={DollarSign} label="MRR" value={`$${data.mrr.toLocaleString()}`} accent />
        <Tile icon={TrendingUp} label="ARR" value={`$${data.arr.toLocaleString()}`} />
        <Tile icon={Users} label="Institutions" value={data.activeInstitutions} />
        <Tile icon={DollarSign} label="ARPU" value={`$${data.averageRevenuePerInstitution.toLocaleString()}`} />
      </div>

      {/* Retention + Unit Economics */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-3">
        <Tile label="NRR" value={`${(data.netRevenueRetention * 100).toFixed(0)}%`} good={data.netRevenueRetention >= 1.1} />
        <Tile label="Churn" value={`${(data.churnRate * 100).toFixed(1)}%`} good={data.churnRate < 0.05} />
        <Tile label="LTV" value={`$${data.lifetimeValue.toLocaleString()}`} />
        <Tile label="LTV/CAC" value={`${data.ltvCacRatio}×`} good={data.ltvCacRatio >= 3} />
      </div>

      {/* Valuation */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">Implied Valuation</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div><p className="text-xs text-slate-400">8× ARR</p><p className="text-2xl font-bold tabular-nums text-slate-700">${(data.impliedValuation.at8x / 1000000).toFixed(1)}M</p></div>
          <div className="rounded-xl bg-emerald-50 border border-emerald-200 p-3"><p className="text-xs text-emerald-600">10× ARR</p><p className="text-2xl font-bold tabular-nums text-emerald-700">${(data.impliedValuation.at10x / 1000000).toFixed(1)}M</p></div>
          <div><p className="text-xs text-slate-400">12× ARR</p><p className="text-2xl font-bold tabular-nums text-slate-700">${(data.impliedValuation.at12x / 1000000).toFixed(1)}M</p></div>
        </div>
      </div>

      {/* Acquirer Scenarios */}
      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-4">Acquirer Scenarios</p>
        <div className="space-y-2">
          {data.acquirerScenarios.map((a, i) => (
            <div key={i} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <span className="text-sm font-bold text-slate-800 w-28">{a.acquirer}</span>
              <span className="text-xs text-slate-600 flex-1">{a.thesis}</span>
              <span className="text-xs font-bold text-emerald-700 shrink-0">{a.valuationRange}</span>
            </div>
          ))}
        </div>
      </div>

      {/* Product Stats */}
      <div className="grid grid-cols-4 gap-3">
        <Tile label="Services" value={data.totalServices} />
        <Tile label="Endpoints" value={data.totalEndpoints} />
        <Tile label="Pages" value={data.totalPages} />
        <Tile label="Models" value={data.totalPrismaModels} />
      </div>
    </div>
  );
}

function Tile({ icon: Icon, label, value, accent, good }: TileProps) {
  return (
    <div className={`rounded-xl border p-3 ${accent ? 'border-emerald-200 bg-emerald-50' : good === true ? 'border-emerald-200 bg-emerald-50/50' : good === false ? 'border-rose-200 bg-rose-50/50' : 'border-slate-200 bg-white'}`}>
      <div className="flex items-center gap-1.5 mb-1">{Icon && <Icon className="h-3.5 w-3.5 text-slate-400" />}<p className="text-[10px] font-medium uppercase text-slate-400">{label}</p></div>
      <p className={`text-xl font-bold tabular-nums ${accent ? 'text-emerald-700' : good ? 'text-emerald-700' : good === false ? 'text-rose-700' : 'text-slate-950'}`}>{value}</p>
    </div>
  );
}

function getDemoData(): ExitMetricsData {
  return {
    mrr: 0, arr: 0, activeInstitutions: 0, averageRevenuePerInstitution: 3500,
    netRevenueRetention: 1.12, churnRate: 0.05, lifetimeValue: 70000, ltvCacRatio: 28,
    impliedValuation: { at8x: 0, at10x: 0, at12x: 0 },
    acquirerScenarios: [
      { acquirer: 'Ncontracts', thesis: 'CU ALM module bolt-on to GRC/ERM', valuationRange: '$3M–$8M' },
      { acquirer: 'Finastra', thesis: 'Caribbean expansion via COSSEC/OCIF regulatory IP', valuationRange: '$5M–$15M' },
      { acquirer: 'ProcessUnity', thesis: 'Financial risk intelligence for GRC expansion', valuationRange: '$4M–$10M' },
    ],
    totalServices: 119, totalEndpoints: 123, totalPages: 42, totalPrismaModels: 54,
  };
}
