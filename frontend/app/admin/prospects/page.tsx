'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import {
  ArrowLeft, Plus, X, ChevronDown, Copy, Check, Trash2,
  Users, Building2, Mail, RefreshCw, Sparkles, Database,
} from 'lucide-react';

const STAGES = [
  { value: 'lead', label: 'Lead', color: 'bg-slate-500/20 text-slate-300' },
  { value: 'contacted', label: 'Contacted', color: 'bg-blue-500/20 text-blue-300' },
  { value: 'demo_scheduled', label: 'Demo Scheduled', color: 'bg-purple-500/20 text-purple-300' },
  { value: 'demo_done', label: 'Demo Done', color: 'bg-indigo-500/20 text-indigo-300' },
  { value: 'proposal', label: 'Proposal', color: 'bg-amber-500/20 text-amber-300' },
  { value: 'closed_won', label: 'Closed Won', color: 'bg-emerald-500/20 text-emerald-300' },
  { value: 'closed_lost', label: 'Closed Lost', color: 'bg-red-500/20 text-red-300' },
] as const;

const STAGE_MAP = Object.fromEntries(STAGES.map((s) => [s.value, s]));

interface Prospect {
  id: string;
  name: string;
  email: string | null;
  company: string | null;
  role: string | null;
  stage: string;
  source: string | null;
  notes: string | null;
  createdAt: string;
  updatedAt: string;
}

const OUTREACH_TEMPLATES = {
  EN: (name: string, company: string) =>
    `Hi ${name}, I'm Erwin from KLYTICS in San Juan. We built CapexCycleOS — a platform that replaces Excel-based ALM with automated duration gap analysis, NII sensitivity, and stress testing. Built specifically for ${company}-sized institutions preparing for OCIF exams. Would you have 15 minutes this week for a quick walkthrough? Happy to pre-load your institution's profile so you can see real outputs.`,
  ES: (name: string, company: string) =>
    `Hola ${name}, soy Erwin de KLYTICS en San Juan. Desarrollamos CapexCycleOS — una plataforma que reemplaza el ALM basado en Excel con analisis automatizado de duration gap, sensibilidad NII y pruebas de estres. Disenado especificamente para instituciones como ${company} preparandose para examenes OCIF. Tendrias 15 minutos esta semana para una demostracion rapida? Puedo pre-cargar el perfil de tu institucion para que veas resultados reales.`,
};

export default function ProspectsPage() {
  const [prospects, setProspects] = useState<Prospect[]>([]);
  const [loading, setLoading] = useState(true);
  const [filterStage, setFilterStage] = useState<string>('');
  const [showAddModal, setShowAddModal] = useState(false);
  const [copied, setCopied] = useState<string | null>(null);
  const [editingStage, setEditingStage] = useState<string | null>(null);

  // Add form state
  const [form, setForm] = useState({ name: '', email: '', company: '', role: '', source: 'manual', notes: '' });

  const fetchProspects = useCallback(async () => {
    setLoading(true);
    try {
      const data = await apiClient.getProspects(filterStage || undefined);
      setProspects(data);
    } catch {
      // ignore
    } finally {
      setLoading(false);
    }
  }, [filterStage]);

  useEffect(() => { fetchProspects(); }, [fetchProspects]);

  const handleAdd = async () => {
    if (!form.name) return;
    try {
      await apiClient.createProspect(form);
      setShowAddModal(false);
      setForm({ name: '', email: '', company: '', role: '', source: 'manual', notes: '' });
      fetchProspects();
    } catch {
      // ignore
    }
  };

  const handleStageChange = async (id: string, stage: string) => {
    try {
      await apiClient.updateProspect(id, { stage });
      setProspects((prev) => prev.map((p) => (p.id === id ? { ...p, stage } : p)));
      setEditingStage(null);
    } catch {
      // ignore
    }
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Delete this prospect?')) return;
    try {
      await apiClient.deleteProspect(id);
      setProspects((prev) => prev.filter((p) => p.id !== id));
    } catch {
      // ignore
    }
  };

  const handleSeed = async () => {
    try {
      await apiClient.seedProspects();
      fetchProspects();
    } catch {
      // ignore
    }
  };

  const copyOutreach = (prospect: Prospect, lang: 'EN' | 'ES') => {
    const msg = OUTREACH_TEMPLATES[lang](prospect.name.split(' ')[0], prospect.company || 'your');
    navigator.clipboard.writeText(msg);
    setCopied(`${prospect.id}-${lang}`);
    setTimeout(() => setCopied(null), 2000);
  };

  const stageCounts = prospects.reduce<Record<string, number>>((acc, p) => {
    acc[p.stage] = (acc[p.stage] || 0) + 1;
    return acc;
  }, {});

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      <div className="max-w-7xl mx-auto px-6 py-8">
        {/* Header */}
        <div className="flex items-center justify-between mb-8">
          <div className="flex items-center gap-3">
            <Link href="/admin" className="text-slate-500 hover:text-white transition">
              <ArrowLeft className="h-5 w-5" />
            </Link>
            <div>
              <h1 className="text-lg font-bold flex items-center gap-2">
                <Users className="h-5 w-5 text-amber-400" /> Prospect Pipeline
              </h1>
              <p className="text-xs text-slate-500">{prospects.length} prospects in pipeline</p>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleSeed}
              className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Database className="h-3.5 w-3.5" /> Seed PR Prospects
            </button>
            <button
              onClick={fetchProspects}
              disabled={loading}
              className="flex items-center gap-1.5 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-400 hover:text-slate-200 px-3 py-1.5 rounded-lg text-xs transition"
            >
              <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
            </button>
            <button
              onClick={() => setShowAddModal(true)}
              className="flex items-center gap-1.5 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-3 py-1.5 rounded-lg text-xs transition"
            >
              <Plus className="h-3.5 w-3.5" /> Add Prospect
            </button>
          </div>
        </div>

        {/* Stage Filter Tabs */}
        <div className="flex flex-wrap gap-1.5 mb-6">
          <button
            onClick={() => setFilterStage('')}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${!filterStage ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
          >
            All ({prospects.length})
          </button>
          {STAGES.map((s) => (
            <button
              key={s.value}
              onClick={() => setFilterStage(filterStage === s.value ? '' : s.value)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${filterStage === s.value ? s.color : 'text-slate-400 hover:text-white hover:bg-white/[0.04]'}`}
            >
              {s.label} {stageCounts[s.value] ? `(${stageCounts[s.value]})` : ''}
            </button>
          ))}
        </div>

        {/* Table */}
        <div className="bg-slate-900/60 border border-white/[0.08] rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead>
              <tr className="border-b border-white/[0.08] text-left">
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">Name</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">Company</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">Stage</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">Source</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">Added</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium">Outreach</th>
                <th className="px-4 py-3 text-[11px] uppercase tracking-wider text-slate-500 font-medium w-10"></th>
              </tr>
            </thead>
            <tbody>
              {prospects.length === 0 ? (
                <tr>
                  <td colSpan={7} className="px-4 py-12 text-center">
                    <div className="flex flex-col items-center gap-3">
                      <Users className="h-8 w-8 text-slate-600" />
                      <p className="text-slate-500 text-sm">No prospects yet</p>
                      <button
                        onClick={handleSeed}
                        className="text-xs text-amber-400 hover:text-amber-300 transition"
                      >
                        Seed 5 Puerto Rico prospects
                      </button>
                    </div>
                  </td>
                </tr>
              ) : (
                prospects.map((p) => {
                  const stageInfo = STAGE_MAP[p.stage] || STAGES[0];
                  return (
                    <tr key={p.id} className="border-b border-white/[0.04] hover:bg-white/[0.02] group">
                      <td className="px-4 py-3">
                        <div>
                          <span className="text-white font-medium">{p.name}</span>
                          {p.role && <span className="text-slate-500 text-xs ml-2">{p.role}</span>}
                        </div>
                        {p.email && (
                          <div className="flex items-center gap-1 text-xs text-slate-500 mt-0.5">
                            <Mail className="h-3 w-3" /> {p.email}
                          </div>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5 text-slate-300">
                          <Building2 className="h-3.5 w-3.5 text-slate-500" />
                          {p.company || '—'}
                        </div>
                        {p.notes && (
                          <p className="text-[11px] text-slate-600 mt-0.5 max-w-[200px] truncate">{p.notes}</p>
                        )}
                      </td>
                      <td className="px-4 py-3">
                        {editingStage === p.id ? (
                          <div className="relative">
                            <select
                              value={p.stage}
                              onChange={(e) => handleStageChange(p.id, e.target.value)}
                              onBlur={() => setEditingStage(null)}
                              autoFocus
                              className="appearance-none bg-slate-800 border border-white/[0.1] rounded-lg px-2 py-1 text-xs text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 pr-6"
                            >
                              {STAGES.map((s) => (
                                <option key={s.value} value={s.value}>{s.label}</option>
                              ))}
                            </select>
                            <ChevronDown className="absolute right-1.5 top-1/2 -translate-y-1/2 h-3 w-3 text-slate-500 pointer-events-none" />
                          </div>
                        ) : (
                          <button
                            onClick={() => setEditingStage(p.id)}
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs font-medium transition hover:ring-1 hover:ring-white/20 ${stageInfo.color}`}
                          >
                            {stageInfo.label} <ChevronDown className="h-2.5 w-2.5 opacity-50" />
                          </button>
                        )}
                      </td>
                      <td className="px-4 py-3 text-xs text-slate-500 capitalize">{p.source?.replace('_', ' ') || '—'}</td>
                      <td className="px-4 py-3 text-xs text-slate-500 tabular-nums">
                        {new Date(p.createdAt).toLocaleDateString()}
                      </td>
                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1">
                          <button
                            onClick={() => copyOutreach(p, 'EN')}
                            className="flex items-center gap-1 text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2 py-1 rounded transition"
                            title="Copy English outreach"
                          >
                            {copied === `${p.id}-EN` ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Copy className="h-2.5 w-2.5" />}
                            EN
                          </button>
                          <button
                            onClick={() => copyOutreach(p, 'ES')}
                            className="flex items-center gap-1 text-[10px] bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.06] px-2 py-1 rounded transition"
                            title="Copy Spanish outreach"
                          >
                            {copied === `${p.id}-ES` ? <Check className="h-2.5 w-2.5 text-emerald-400" /> : <Sparkles className="h-2.5 w-2.5" />}
                            ES
                          </button>
                        </div>
                      </td>
                      <td className="px-4 py-3">
                        <button
                          onClick={() => handleDelete(p.id)}
                          className="opacity-0 group-hover:opacity-100 text-slate-600 hover:text-red-400 transition"
                        >
                          <Trash2 className="h-3.5 w-3.5" />
                        </button>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>

      {/* Add Prospect Modal */}
      {showAddModal && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50" onClick={() => setShowAddModal(false)}>
          <div className="bg-slate-900 border border-white/[0.1] rounded-2xl p-6 w-full max-w-md" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between mb-5">
              <h3 className="text-lg font-bold">Add Prospect</h3>
              <button onClick={() => setShowAddModal(false)} className="text-slate-500 hover:text-white transition">
                <X className="h-5 w-5" />
              </button>
            </div>
            <div className="space-y-3">
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Name *</label>
                <input
                  type="text"
                  value={form.name}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  placeholder="Jose Pablo Colon"
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  autoFocus
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Email</label>
                  <input
                    type="email"
                    value={form.email}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    placeholder="jp@bank.com"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Role</label>
                  <input
                    type="text"
                    value={form.role}
                    onChange={(e) => setForm({ ...form, role: e.target.value })}
                    placeholder="CFO"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Company</label>
                  <input
                    type="text"
                    value={form.company}
                    onChange={(e) => setForm({ ...form, company: e.target.value })}
                    placeholder="Banco Popular"
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  />
                </div>
                <div>
                  <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Source</label>
                  <select
                    value={form.source}
                    onChange={(e) => setForm({ ...form, source: e.target.value })}
                    className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50"
                  >
                    <option value="manual" className="bg-slate-800">Manual</option>
                    <option value="referral" className="bg-slate-800">Referral</option>
                    <option value="outbound" className="bg-slate-800">Outbound</option>
                    <option value="demo_request" className="bg-slate-800">Demo Request</option>
                  </select>
                </div>
              </div>
              <div>
                <label className="block text-[11px] uppercase tracking-wider text-slate-500 mb-1">Notes</label>
                <textarea
                  value={form.notes}
                  onChange={(e) => setForm({ ...form, notes: e.target.value })}
                  placeholder="$1.2B assets. Met at OCIF conference..."
                  rows={2}
                  className="w-full bg-white/[0.04] border border-white/[0.08] rounded-lg px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-amber-500/50 resize-none"
                />
              </div>
            </div>
            <div className="flex justify-end gap-2 mt-5">
              <button onClick={() => setShowAddModal(false)} className="px-4 py-2 text-sm text-slate-400 hover:text-white transition">
                Cancel
              </button>
              <button
                onClick={handleAdd}
                disabled={!form.name}
                className="px-4 py-2 bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold text-sm rounded-lg transition disabled:opacity-50"
              >
                Add Prospect
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
