'use client';

import { useState, useEffect, useCallback } from 'react';
import { apiClient, type AdminPipelineSnapshot, type AdminRevenueMetrics } from '@/lib/api';
import { FileText, RefreshCw } from 'lucide-react';
import { MetricStrip } from '@/components/ui/cerniq/MetricStrip';

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
            disabled={loading}
            className="inline-flex items-center gap-2 bg-slate-700 text-slate-200 px-4 py-2 rounded-lg text-sm hover:bg-slate-600 transition"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} /> Refresh
          </button>
        </div>

        {error ? (
          <div className="mb-6 rounded-xl border border-red-500/30 bg-red-500/10 px-4 py-3 text-sm text-red-200">
            {error}
          </div>
        ) : null}

        {/* Revenue — dense strip */}
        {revenue && (
          <div className="space-y-4 mb-8">
            <MetricStrip
              density="comfortable"
              items={[
                { label: 'MRR', value: fmt(revenue.mrr) },
                { label: 'ARR', value: fmt(revenue.arr) },
                { label: 'Active Subs', value: String(revenue.activeSubscriptions) },
                { label: 'Revenue (YTD)', value: fmt(revenue.revenueYear) },
              ]}
            />
            <MetricStrip
              items={[
                { label: 'Today', value: fmt(revenue.revenueToday) },
                { label: 'This Month', value: fmt(revenue.revenueMonth) },
                { label: 'Total Subs', value: String(revenue.totalSubscriptions) },
              ]}
            />
          </div>
        )}

        {/* Pipeline Health — dense strip */}
        {pipeline && (
          <div className="mb-8">
            <p className="text-[10px] font-semibold uppercase tracking-wider text-slate-500 mb-2 flex items-center gap-1.5">
              <FileText className="h-3.5 w-3.5" /> Pipeline Health
            </p>
            <MetricStrip
              items={[
                { label: 'Awaiting', value: String(pipeline.awaitingData) },
                { label: 'Processing', value: String(pipeline.processing) },
                { label: 'Complete', value: String(pipeline.complete) },
                { label: 'Failed', value: String(pipeline.failed) },
              ]}
            />
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
