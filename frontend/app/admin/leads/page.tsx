'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  Users, DollarSign, TrendingUp, Clock, RefreshCw,
  Pencil, FileText, Check, ArrowLeft, Sparkles,
} from 'lucide-react';

interface Lead {
  id: string;
  name: string;
  email: string;
  phone?: string;
  role: string;
  institutionName: string;
  institutionType: string;
  status: string;
  priority: string;
  notes?: string;
  nextFollowUp?: string;
  revenueAmount?: number;
  dealType?: string;
  reportSentAt?: string;
  createdAt: string;
  intelligenceAccount?: {
    id: string;
    kind: string;
    freshnessScore: number;
    opportunityScore: number;
    threatScore: number;
    actionScore: number;
    lastRefreshedAt?: string | null;
  } | null;
}

interface Metrics {
  totalLeads: number;
  monthLeads: number;
  statusCounts: Record<string, number>;
  conversionRate: string;
  avgCloseTimeDays: number | null;
  monthRevenue: number;
  totalRevenue: number;
  pipelineValue: number;
}

function getLeadPipelineError(error: unknown): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'message' in error &&
    (error as { message?: string }).message === 'Unauthorized'
  ) {
    return 'Invalid admin key';
  }

  return 'Failed to load pipeline data';
}

const STATUSES = ['NEW', 'CONTACTED', 'DEMO_SCHEDULED', 'DEMO_COMPLETED', 'PROPOSAL_SENT', 'NEGOTIATING', 'CLOSED_WON', 'CLOSED_LOST', 'UNQUALIFIED'];

const STATUS_COLORS: Record<string, string> = {
  NEW: 'bg-blue-500/20 text-blue-300',
  CONTACTED: 'bg-cyan-500/20 text-cyan-300',
  DEMO_SCHEDULED: 'bg-purple-500/20 text-purple-300',
  DEMO_COMPLETED: 'bg-indigo-500/20 text-indigo-300',
  PROPOSAL_SENT: 'bg-amber-500/20 text-amber-300',
  NEGOTIATING: 'bg-orange-500/20 text-orange-300',
  CLOSED_WON: 'bg-emerald-500/20 text-emerald-300',
  CLOSED_LOST: 'bg-red-500/20 text-red-300',
  UNQUALIFIED: 'bg-slate-500/20 text-slate-400',
};

const PRIORITY_COLORS: Record<string, string> = {
  HIGH: 'text-red-400',
  MEDIUM: 'text-amber-400',
  LOW: 'text-slate-500',
};

export default function LeadsPipelinePage() {
  const [leads, setLeads] = useState<Lead[]>([]);
  const [metrics, setMetrics] = useState<Metrics | null>(null);
  const [loading, setLoading] = useState(false);
  const [statusFilter, setStatusFilter] = useState('');
  const [editingLead, setEditingLead] = useState<string | null>(null);
  const [noteText, setNoteText] = useState('');
  const [fetchError, setFetchError] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [leadData, metricData] = await Promise.all([
        apiClient.getAdminLeads(statusFilter || undefined),
        apiClient.getAdminLeadMetrics(),
      ]);
      setLeads(leadData);
      setMetrics(metricData);
      setFetchError(null);
    } catch (err: unknown) {
      setFetchError(getLeadPipelineError(err));
    } finally {
      setLoading(false);
    }
  }, [statusFilter]);

  useEffect(() => {
    void fetchData();
  }, [fetchData]);

  const updateStatus = async (id: string, status: string) => {
    await apiClient.updateAdminLead(id, { status });
    void fetchData();
  };

  const addNote = async (id: string) => {
    if (!noteText.trim()) return;
    await apiClient.addAdminLeadNote(id, noteText);
    setNoteText('');
    setEditingLead(null);
    void fetchData();
  };

  const markReportSent = async (id: string) => {
    await apiClient.markAdminReportSent(id);
    void fetchData();
  };

  const convertToWon = async (id: string) => {
    const amount = prompt('Revenue amount ($):');
    if (!amount) return;
    const dealType = prompt('Deal type (one_time / monthly / partner / enterprise):') || 'one_time';
    await apiClient.updateAdminLead(id, {
      status: 'CLOSED_WON',
      revenueAmount: parseFloat(amount),
      dealType,
    });
    void fetchData();
  };

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/[0.06] px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <Link href="/admin" className="text-slate-400 hover:text-white transition">
            <ArrowLeft className="h-4 w-4" />
          </Link>
          <div className="w-8 h-8 bg-gradient-to-br from-amber-400 to-orange-500 rounded-lg flex items-center justify-center">
            <span className="text-slate-900 font-bold text-sm">C</span>
          </div>
          <span className="font-bold">Lead Pipeline</span>
        </div>
        <button onClick={fetchData} disabled={loading} className="text-slate-400 hover:text-white transition">
          <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
        </button>
      </div>

      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Error banner */}
        {fetchError && (
          <div className="mb-6 bg-red-500/10 border border-red-500/30 rounded-xl px-5 py-4 flex items-center justify-between">
            <span className="text-red-300 text-sm">{fetchError}</span>
            <button onClick={() => { setFetchError(null); fetchData(); }} className="text-red-400 hover:text-red-200 text-xs font-medium ml-4">
              Retry
            </button>
          </div>
        )}

        {/* Metrics */}
        {metrics && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4 mb-8">
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Users className="h-4 w-4 text-blue-400" />
                <span className="text-xs text-slate-500">Total Leads</span>
              </div>
              <span className="text-2xl font-bold">{metrics.totalLeads}</span>
              <span className="text-xs text-slate-500 ml-2">({metrics.monthLeads} this month)</span>
            </div>
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <TrendingUp className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-slate-500">Conversion</span>
              </div>
              <span className="text-2xl font-bold text-emerald-400">{metrics.conversionRate}</span>
            </div>
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-amber-400" />
                <span className="text-xs text-slate-500">Revenue (Month)</span>
              </div>
              <span className="text-2xl font-bold text-amber-400">${metrics.monthRevenue.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <DollarSign className="h-4 w-4 text-emerald-400" />
                <span className="text-xs text-slate-500">Revenue (All)</span>
              </div>
              <span className="text-2xl font-bold">${metrics.totalRevenue.toLocaleString()}</span>
            </div>
            <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <Clock className="h-4 w-4 text-purple-400" />
                <span className="text-xs text-slate-500">Pipeline Value</span>
              </div>
              <span className="text-2xl font-bold text-purple-400">${metrics.pipelineValue.toLocaleString()}</span>
            </div>
          </div>
        )}

        {/* Status filters */}
        {metrics && (
          <div className="flex flex-wrap gap-2 mb-6">
            <button
              onClick={() => setStatusFilter('')}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!statusFilter ? 'bg-amber-500 text-slate-900' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}
            >
              ALL ({metrics.totalLeads})
            </button>
            {STATUSES.map(s => (
              <button
                key={s}
                onClick={() => setStatusFilter(s)}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${statusFilter === s ? 'bg-amber-500 text-slate-900' : 'bg-white/[0.04] text-slate-400 hover:text-white'}`}
              >
                {s.replace(/_/g, ' ')} ({metrics.statusCounts[s] || 0})
              </button>
            ))}
          </div>
        )}

        {/* Lead Table */}
        <div className="bg-slate-900/40 border border-white/[0.06] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.06] text-xs text-slate-500 uppercase">
                <th className="px-4 py-3 text-left">Priority</th>
                <th className="px-4 py-3 text-left">Contact</th>
                <th className="px-4 py-3 text-left">Institution</th>
                <th className="px-4 py-3 text-left">Intelligence</th>
                <th className="px-4 py-3 text-left">Status</th>
                <th className="px-4 py-3 text-left">Submitted</th>
                <th className="px-4 py-3 text-left">Follow-Up</th>
                <th className="px-4 py-3 text-left">Actions</th>
              </tr>
            </thead>
            <tbody>
              {leads.map(lead => (
                <tr key={lead.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition">
                  <td className="px-4 py-3">
                    <span className={`text-xs font-bold ${PRIORITY_COLORS[lead.priority] || ''}`}>
                      {lead.priority}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <p className="font-medium text-white">{lead.name}</p>
                    <p className="text-xs text-slate-500">{lead.email}</p>
                    {lead.role && <p className="text-xs text-slate-600">{lead.role}</p>}
                  </td>
                  <td className="px-4 py-3">
                    <p className="text-white">{lead.institutionName}</p>
                    <p className="text-xs text-slate-500">{lead.institutionType}</p>
                  </td>
                  <td className="px-4 py-3">
                    {lead.intelligenceAccount ? (
                      <div className="space-y-2">
                        <Link
                          href={`/admin/intelligence/${lead.intelligenceAccount.id}`}
                          className="inline-flex items-center gap-1.5 text-xs font-semibold text-cyan-300 transition hover:text-cyan-200"
                        >
                          <Sparkles className="h-3.5 w-3.5" />
                          Open account
                        </Link>
                        <div className="flex flex-wrap gap-1.5 text-[10px]">
                          <span className="rounded-full bg-cyan-500/10 px-2 py-1 text-cyan-200">
                            action {lead.intelligenceAccount.actionScore}
                          </span>
                          <span className="rounded-full bg-emerald-500/10 px-2 py-1 text-emerald-200">
                            opp {lead.intelligenceAccount.opportunityScore}
                          </span>
                          <span className="rounded-full bg-amber-500/10 px-2 py-1 text-amber-200">
                            fresh {lead.intelligenceAccount.freshnessScore}
                          </span>
                        </div>
                      </div>
                    ) : (
                      <span className="text-xs text-slate-600">No intelligence link</span>
                    )}
                  </td>
                  <td className="px-4 py-3">
                    <select
                      value={lead.status}
                      onChange={(e) => updateStatus(lead.id, e.target.value)}
                      className={`text-xs font-medium px-2 py-1 rounded-md border-0 appearance-none cursor-pointer ${STATUS_COLORS[lead.status] || 'bg-slate-700 text-slate-300'}`}
                    >
                      {STATUSES.map(s => (
                        <option key={s} value={s} className="bg-slate-800 text-white">{s.replace(/_/g, ' ')}</option>
                      ))}
                    </select>
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {new Date(lead.createdAt).toLocaleDateString()}
                  </td>
                  <td className="px-4 py-3 text-xs text-slate-400">
                    {lead.nextFollowUp ? new Date(lead.nextFollowUp).toLocaleDateString() : '\u2014'}
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex items-center gap-1.5">
                      <button
                        onClick={() => setEditingLead(editingLead === lead.id ? null : lead.id)}
                        className="p-1.5 rounded-md text-slate-500 hover:text-white hover:bg-white/[0.05] transition"
                        title="Add note"
                      >
                        <Pencil className="h-3.5 w-3.5" />
                      </button>
                      {!lead.reportSentAt ? (
                        <button
                          onClick={() => markReportSent(lead.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-amber-400 hover:bg-amber-500/10 transition"
                          title="Mark report sent"
                        >
                          <FileText className="h-3.5 w-3.5" />
                        </button>
                      ) : (
                        <span className="text-[10px] text-emerald-400 flex items-center gap-0.5">
                          <Check className="h-3 w-3" /> Sent
                        </span>
                      )}
                      {lead.status !== 'CLOSED_WON' && lead.status !== 'CLOSED_LOST' && (
                        <button
                          onClick={() => convertToWon(lead.id)}
                          className="p-1.5 rounded-md text-slate-500 hover:text-emerald-400 hover:bg-emerald-500/10 transition"
                          title="Convert to won"
                        >
                          <DollarSign className="h-3.5 w-3.5" />
                        </button>
                      )}
                    </div>
                    {editingLead === lead.id && (
                      <div className="mt-2 flex gap-2">
                        <input
                          type="text"
                          value={noteText}
                          onChange={(e) => setNoteText(e.target.value)}
                          onKeyDown={(e) => e.key === 'Enter' && addNote(lead.id)}
                          placeholder="Add note..."
                          className="flex-1 bg-white/[0.04] border border-white/[0.08] rounded px-2 py-1 text-xs text-white focus:outline-none"
                          autoFocus
                        />
                        <button onClick={() => addNote(lead.id)} className="text-amber-400 text-xs font-medium">Save</button>
                      </div>
                    )}
                    {lead.notes && (
                      <p className="mt-1 text-[10px] text-slate-600 whitespace-pre-line max-h-12 overflow-y-auto">{lead.notes}</p>
                    )}
                  </td>
                </tr>
              ))}
              {leads.length === 0 && (
                <tr>
                  <td colSpan={8} className="px-4 py-12 text-center text-slate-600">
                    No leads yet. They&apos;ll appear when prospects submit the contact form.
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
