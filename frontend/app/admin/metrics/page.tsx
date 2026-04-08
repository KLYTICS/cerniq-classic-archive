'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, type AdminPipelineSnapshot, type AdminRevenueMetrics } from '@/lib/api';
import { DollarSign, TrendingUp, Users, FileText, RefreshCw } from 'lucide-react';

interface PipelineHealth {
  awaitingData: number;
  processing: number;
  complete: number;
  failed: number;
}

export default function AdminMetrics() {
  const [revenue, setRevenue] = useState<AdminRevenueMetrics | null>(null);
  const [pipeline, setPipeline] = useState<PipelineHealth | null>(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchMetrics = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const [revenueData, pipelineData]: [AdminRevenueMetrics, AdminPipelineSnapshot] = await Promise.all([
        apiClient.getAdminRevenueMetrics(),
        apiClient.getAdminPipeline(),
      ]);
      setRevenue(revenueData);
      setPipeline(pipelineData.health);
    } catch {
      setError('Failed to load metrics');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void fetchMetrics();
    }, 0);

    return () => {
      window.clearTimeout(timer);
    };
  }, [fetchMetrics]);

  const fmt = (n: number) => n >= 1000 ? `$${(n / 1000).toFixed(1)}k` : `$${n.toFixed(0)}`;

  return (
    <div className="min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900 p-8">
      <div className="max-w-6xl mx-auto">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div>
            <h1 className="text-2xl font-bold text-white">Revenue & Metrics</h1>
            <p className="text-sm text-slate-400">KLYTICS LLC — CERNIQ SaaS</p>
          </div>
          <button
            onClick={() => fetchMetrics()}
            className="inline-flex items-center gap-2 bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm hover:bg-slate-600 transition"
          >
            <RefreshCw className="h-4 w-4" /> Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Revenue Cards */}
        {revenue && (
          <>
            <div className="grid grid-cols-4 gap-4 mb-8">
              <MetricCard icon={<DollarSign className="h-5 w-5" />} label="MRR" value={fmt(revenue.mrr)} color="text-green-400" />
              <MetricCard icon={<TrendingUp className="h-5 w-5" />} label="ARR" value={fmt(revenue.arr)} color="text-emerald-400" />
              <MetricCard icon={<Users className="h-5 w-5" />} label="Active Subs" value={String(revenue.activeSubscriptions)} color="text-blue-400" />
              <MetricCard icon={<DollarSign className="h-5 w-5" />} label="Revenue (YTD)" value={fmt(revenue.revenueYear)} color="text-amber-400" />
            </div>

            <div className="grid grid-cols-3 gap-4 mb-8">
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <p className="text-xs text-slate-500 mb-1">Today</p>
                <p className="text-xl font-bold text-green-400">{fmt(revenue.revenueToday)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <p className="text-xs text-slate-500 mb-1">This Month</p>
                <p className="text-xl font-bold text-blue-400">{fmt(revenue.revenueMonth)}</p>
              </div>
              <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
                <p className="text-xs text-slate-500 mb-1">Total Subscriptions</p>
                <p className="text-xl font-bold text-slate-300">{revenue.totalSubscriptions}</p>
              </div>
            </div>
          </>
        )}

        {/* Pipeline Health */}
        {pipeline && (
          <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-6 mb-8">
            <h2 className="text-sm font-semibold text-slate-400 uppercase tracking-wider mb-4 flex items-center gap-2">
              <FileText className="h-4 w-4" /> Pipeline Health
            </h2>
            <div className="grid grid-cols-4 gap-4">
              <FunnelStep label="Awaiting Data" count={pipeline.awaitingData} color="bg-gray-500" total={pipeline.awaitingData + pipeline.processing + pipeline.complete + pipeline.failed} />
              <FunnelStep label="Processing" count={pipeline.processing} color="bg-blue-500" total={pipeline.awaitingData + pipeline.processing + pipeline.complete + pipeline.failed} />
              <FunnelStep label="Complete" count={pipeline.complete} color="bg-green-500" total={pipeline.awaitingData + pipeline.processing + pipeline.complete + pipeline.failed} />
              <FunnelStep label="Failed" count={pipeline.failed} color="bg-red-500" total={pipeline.awaitingData + pipeline.processing + pipeline.complete + pipeline.failed} />
            </div>
          </div>
        )}

        {/* North Star */}
        <div className="bg-gradient-to-r from-amber-500/10 to-amber-500/5 border border-amber-500/20 rounded-xl p-6">
          <p className="text-amber-400 text-xs font-semibold uppercase tracking-wider mb-2">North Star</p>
          <p className="text-2xl font-bold text-white">
            {revenue ? fmt(revenue.mrr) : '$0'} MRR
          </p>
          <p className="text-sm text-slate-400 mt-1">
            Target: $750/night while sleeping. Current {revenue ? `${revenue.activeSubscriptions} active subscription${revenue.activeSubscriptions !== 1 ? 's' : ''}` : 'loading...'}.
          </p>
          {revenue && revenue.mrr > 0 && (
            <div className="mt-3">
              <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
                <div
                  className="h-2 bg-amber-500 rounded-full transition-all"
                  style={{ width: `${Math.min((revenue.mrr / 750) * 100, 100)}%` }}
                />
              </div>
              <p className="text-xs text-slate-500 mt-1">{((revenue.mrr / 750) * 100).toFixed(0)}% of $750/mo target</p>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

function MetricCard({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string; color: string }) {
  return (
    <div className="bg-slate-800/50 border border-slate-700 rounded-xl p-5">
      <div className={`${color} mb-2`}>{icon}</div>
      <p className="text-xs text-slate-500 mb-1">{label}</p>
      <p className={`text-2xl font-bold ${color}`}>{value}</p>
    </div>
  );
}

function FunnelStep({ label, count, color, total }: { label: string; count: number; color: string; total: number }) {
  const pct = total > 0 ? (count / total) * 100 : 0;
  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <p className="text-xs text-slate-400">{label}</p>
        <p className="text-sm font-bold text-white">{count}</p>
      </div>
      <div className="h-2 bg-slate-700 rounded-full overflow-hidden">
        <div className={`h-2 ${color} rounded-full transition-all`} style={{ width: `${pct}%` }} />
      </div>
    </div>
  );
}
