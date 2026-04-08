'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import type { LucideIcon } from 'lucide-react';
import { ArrowLeft, BarChart3, DollarSign, TrendingUp, Users } from 'lucide-react';

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

function getErrorMessage(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: number } }).response?.status === 'number'
  ) {
    return (error as { response?: { status?: number } }).response?.status === 401
      ? 'Invalid admin key'
      : 'Failed to load exit metrics';
  }
  return 'Failed to load exit metrics';
}

export default function ExitDashboardPage() {
  const [data, setData] = useState<ExitMetricsData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        setData(await apiClient.getExitMetrics());
        setError(null);
      } catch (err: unknown) {
        setData(null);
        setError(getErrorMessage(err));
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  if (loading) {
    return (
      <div className="flex flex-1 items-center justify-center p-6">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  if (!data) {
    return (
      <div className="mx-auto max-w-4xl p-6">
        <Link href="/admin" className="mb-6 inline-flex items-center gap-2 text-sm text-slate-500 transition hover:text-slate-800">
          <ArrowLeft className="h-4 w-4" />
          Back to admin
        </Link>
        <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center">
          <h1 className="text-lg font-semibold text-slate-950">Exit metrics unavailable</h1>
          <p className="mt-2 text-sm text-slate-600">{error || 'No exit metrics were returned.'}</p>
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-[1400px] space-y-5 p-6">
      <div className="mb-6 flex items-center gap-3">
        <Link href="/admin" className="inline-flex h-9 w-9 items-center justify-center rounded-lg border border-slate-200 bg-white text-slate-500 transition hover:text-slate-950">
          <ArrowLeft className="h-4 w-4" />
        </Link>
        <div className="flex h-9 w-9 items-center justify-center rounded-lg border border-slate-700 bg-slate-900">
          <BarChart3 className="h-4 w-4 text-white" />
        </div>
        <div className="flex-1">
          <h1 className="text-lg font-bold text-slate-950">Exit Metrics Dashboard</h1>
          <p className="text-xs text-slate-500">Live SaaS KPIs for internal diligence and strategic planning</p>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile icon={DollarSign} label="MRR" value={`$${data.mrr.toLocaleString()}`} accent />
        <Tile icon={TrendingUp} label="ARR" value={`$${data.arr.toLocaleString()}`} />
        <Tile icon={Users} label="Institutions" value={data.activeInstitutions} />
        <Tile icon={DollarSign} label="ARPU" value={`$${data.averageRevenuePerInstitution.toLocaleString()}`} />
      </div>

      <div className="grid grid-cols-2 gap-3 md:grid-cols-4">
        <Tile label="NRR" value={`${(data.netRevenueRetention * 100).toFixed(0)}%`} good={data.netRevenueRetention >= 1.1} />
        <Tile label="Churn" value={`${(data.churnRate * 100).toFixed(1)}%`} good={data.churnRate < 0.05} />
        <Tile label="LTV" value={`$${data.lifetimeValue.toLocaleString()}`} />
        <Tile label="LTV/CAC" value={`${data.ltvCacRatio}×`} good={data.ltvCacRatio >= 3} />
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Implied Valuation</p>
        <div className="grid grid-cols-3 gap-4 text-center">
          <div>
            <p className="text-xs text-slate-400">8× ARR</p>
            <p className="text-2xl font-bold tabular-nums text-slate-700">${(data.impliedValuation.at8x / 1000000).toFixed(1)}M</p>
          </div>
          <div className="rounded-xl border border-emerald-200 bg-emerald-50 p-3">
            <p className="text-xs text-emerald-600">10× ARR</p>
            <p className="text-2xl font-bold tabular-nums text-emerald-700">${(data.impliedValuation.at10x / 1000000).toFixed(1)}M</p>
          </div>
          <div>
            <p className="text-xs text-slate-400">12× ARR</p>
            <p className="text-2xl font-bold tabular-nums text-slate-700">${(data.impliedValuation.at12x / 1000000).toFixed(1)}M</p>
          </div>
        </div>
      </div>

      <div className="rounded-xl border border-slate-200 bg-white p-5">
        <p className="mb-4 text-[11px] font-semibold uppercase tracking-wider text-slate-500">Acquirer Scenarios</p>
        <div className="space-y-2">
          {data.acquirerScenarios.map((scenario, index) => (
            <div key={index} className="flex items-center gap-3 rounded-lg border border-slate-100 p-3">
              <span className="w-28 text-sm font-bold text-slate-800">{scenario.acquirer}</span>
              <span className="flex-1 text-xs text-slate-600">{scenario.thesis}</span>
              <span className="shrink-0 text-xs font-bold text-emerald-700">{scenario.valuationRange}</span>
            </div>
          ))}
        </div>
      </div>

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
      <div className="mb-1 flex items-center gap-1.5">
        {Icon ? <Icon className="h-3.5 w-3.5 text-slate-400" /> : null}
        <p className="text-[10px] font-medium uppercase text-slate-400">{label}</p>
      </div>
      <p className={`text-xl font-bold tabular-nums ${accent ? 'text-emerald-700' : good ? 'text-emerald-700' : good === false ? 'text-rose-700' : 'text-slate-950'}`}>
        {value}
      </p>
    </div>
  );
}
