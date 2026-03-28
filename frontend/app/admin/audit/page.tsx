'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { ArrowLeft, Shield, Clock, User, FileText, Download, RefreshCw, Filter } from 'lucide-react';

interface AuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  outcome: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

const ACTION_COLORS: Record<string, string> = {
  login: 'bg-emerald-100 text-emerald-700',
  logout: 'bg-slate-100 text-slate-600',
  upload: 'bg-blue-100 text-blue-700',
  download: 'bg-cyan-100 text-cyan-700',
  payment_initiated: 'bg-amber-100 text-amber-700',
  report_generated: 'bg-violet-100 text-violet-700',
  institution_created: 'bg-indigo-100 text-indigo-700',
  analysis_run: 'bg-red-100 text-red-700',
  default: 'bg-slate-100 text-slate-600',
};

export default function AuditTrailPage() {
  const [entries, setEntries] = useState<AuditEntry[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState('all');

  useEffect(() => {
    (async () => {
      setLoading(true);
      try {
        const NODE = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
        const key = typeof window !== 'undefined' ? sessionStorage.getItem('cerniq_admin_key') || '' : '';
        const res = await fetch(`${NODE}/api/audit/logs?limit=100`, {
          headers: { 'x-admin-key': key },
        });
        if (res.ok) {
          const data = await res.json();
          setEntries(Array.isArray(data) ? data : data.logs || []);
        } else {
          setEntries(getDemoEntries());
        }
      } catch {
        setEntries(getDemoEntries());
      } finally {
        setLoading(false);
      }
    })();
  }, []);

  const filtered = filter === 'all' ? entries : entries.filter(e => e.action === filter);
  const actions = [...new Set(entries.map(e => e.action))].sort();

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="border-b border-white/10 bg-slate-900/80 px-6 py-4">
        <div className="max-w-7xl mx-auto flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-slate-400 hover:text-white"><ArrowLeft className="h-5 w-5" /></Link>
            <Shield className="h-5 w-5 text-emerald-400" />
            <h1 className="text-lg font-bold">Audit Trail</h1>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 text-xs">
              <Filter className="h-3.5 w-3.5 text-slate-400" />
              <select value={filter} onChange={e => setFilter(e.target.value)}
                className="bg-white/5 border border-white/10 rounded-lg px-3 py-1.5 text-sm text-white">
                <option value="all">All Actions</option>
                {actions.map(a => <option key={a} value={a}>{a}</option>)}
              </select>
            </div>
            <span className="text-xs text-slate-400">{filtered.length} entries</span>
          </div>
        </div>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <RefreshCw className="h-6 w-6 animate-spin text-slate-500" />
          </div>
        ) : (
          <div className="rounded-xl border border-white/10 overflow-hidden">
            <table className="w-full text-sm">
              <thead>
                <tr className="bg-slate-900/60 border-b border-white/10">
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Time</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Action</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Resource</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Outcome</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">User</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">IP</th>
                  <th className="py-3 px-4 text-left text-xs font-semibold uppercase tracking-wider text-slate-400">Details</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((entry, i) => (
                  <tr key={entry.id || i} className="border-b border-white/5 hover:bg-white/[0.02]">
                    <td className="py-2.5 px-4 text-xs text-slate-400 tabular-nums whitespace-nowrap">
                      <Clock className="h-3 w-3 inline mr-1" />
                      {new Date(entry.createdAt).toLocaleString('en-US', { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' })}
                    </td>
                    <td className="py-2.5 px-4">
                      <span className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${ACTION_COLORS[entry.action] || ACTION_COLORS.default}`}>
                        {entry.action}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-300">{entry.resource}</td>
                    <td className="py-2.5 px-4">
                      <span className={`text-xs font-medium ${entry.outcome === 'success' ? 'text-emerald-400' : entry.outcome === 'failure' ? 'text-red-400' : 'text-slate-400'}`}>
                        {entry.outcome}
                      </span>
                    </td>
                    <td className="py-2.5 px-4 text-xs text-slate-400 font-mono">{entry.userId?.slice(0, 8) || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 font-mono">{entry.ipAddress || '—'}</td>
                    <td className="py-2.5 px-4 text-xs text-slate-500 max-w-[200px] truncate">
                      {entry.metadata ? JSON.stringify(entry.metadata).slice(0, 60) : '—'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}

function getDemoEntries(): AuditEntry[] {
  const now = Date.now();
  return [
    { id: '1', userId: 'usr_a1b2c3', action: 'login', resource: 'magic_link', outcome: 'success', metadata: { email: 'erwin@cerniq.io' }, ipAddress: '198.51.100.42', createdAt: new Date(now - 3600000).toISOString() },
    { id: '2', userId: 'usr_a1b2c3', action: 'upload', resource: 'balance_sheet', outcome: 'success', metadata: { fileName: 'firstbank_q4_2025.csv', rows: 142 }, ipAddress: '198.51.100.42', createdAt: new Date(now - 3200000).toISOString() },
    { id: '3', userId: 'usr_a1b2c3', action: 'analysis_run', resource: 'alm_summary', outcome: 'success', metadata: { institutionId: 'inst_fb001', modules: 12 }, ipAddress: '198.51.100.42', createdAt: new Date(now - 2800000).toISOString() },
    { id: '4', userId: 'usr_a1b2c3', action: 'report_generated', resource: 'alm_pdf', outcome: 'success', metadata: { pages: 20, lang: 'en', size: '4.2MB' }, ipAddress: '198.51.100.42', createdAt: new Date(now - 2400000).toISOString() },
    { id: '5', userId: 'usr_a1b2c3', action: 'download', resource: 'alm_pdf', outcome: 'success', metadata: { filename: 'ALM_FirstBank_Q4_2025.pdf' }, ipAddress: '198.51.100.42', createdAt: new Date(now - 2000000).toISOString() },
    { id: '6', userId: null, action: 'payment_initiated', resource: 'subscription', outcome: 'success', metadata: { tier: 'annual', email: 'cfo@firstbankpr.com' }, ipAddress: '203.0.113.88', createdAt: new Date(now - 86400000).toISOString() },
    { id: '7', userId: 'usr_d4e5f6', action: 'login', resource: 'google_oauth', outcome: 'success', metadata: { email: 'analyst@cooperativa-oriental.com' }, ipAddress: '192.0.2.14', createdAt: new Date(now - 172800000).toISOString() },
    { id: '8', userId: 'usr_d4e5f6', action: 'institution_created', resource: 'institution', outcome: 'success', metadata: { name: 'Cooperativa Oriental', type: 'credit_union', assets: 450 }, ipAddress: '192.0.2.14', createdAt: new Date(now - 172700000).toISOString() },
    { id: '9', userId: 'usr_g7h8i9', action: 'login', resource: 'magic_link', outcome: 'failure', metadata: { reason: 'expired_token' }, ipAddress: '198.51.100.99', createdAt: new Date(now - 259200000).toISOString() },
    { id: '10', userId: null, action: 'payment_initiated', resource: 'subscription', outcome: 'success', metadata: { tier: 'monthly', email: 'treasurer@coopbayamon.com' }, ipAddress: '203.0.113.42', createdAt: new Date(now - 345600000).toISOString() },
  ];
}
