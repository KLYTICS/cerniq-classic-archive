'use client';

import { useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { apiClient } from '@/lib/api';
import { getAdminAccessKey, setAdminAccessKey } from '@/lib/auth-session';
import { Landmark, RefreshCw, Copy, Check, Trash2, ExternalLink, Users, Building2, FileText, ClipboardCheck, UserSearch, Activity } from 'lucide-react';

const VERCEL_URL = typeof window !== 'undefined' ? window.location.origin : '';

interface DemoRequest {
  id: string;
  email: string;
  name: string | null;
  institutionName: string | null;
  institutionType: string | null;
  totalAssets: string | null;
  message: string | null;
  createdAt: string;
}

interface Stats {
  demoRequests: number;
  institutions: number;
  users: number;
  recentUsers: number;
  prospects: number;
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
      : 'Failed to load data';
  }

  return 'Failed to load data';
}

function AdminAuth({ onAuth }: { onAuth: () => void }) {
  const [password, setPassword] = useState('');
  const [error, setError] = useState(false);
  const [checking, setChecking] = useState(false);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setChecking(true);
    try {
      // Validate key against the server
      const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
      const res = await fetch(`${NODE_API_URL}/api/admin/stats`, {
        headers: { 'x-admin-key': password },
      });
      if (res.ok) {
        setAdminAccessKey(password);
        onAuth();
      } else {
        setError(true);
      }
    } catch {
      setError(true);
    } finally {
      setChecking(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 flex items-center justify-center">
      <form onSubmit={handleSubmit} className="bg-slate-900 border border-white/10 p-8 rounded-2xl w-full max-w-sm">
        <h1 className="text-xl font-bold text-white mb-6 text-center">Admin Access</h1>
        <input
          type="password"
          value={password}
          onChange={(e) => { setPassword(e.target.value); setError(false); }}
          placeholder="Enter admin key"
          className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-3 text-white mb-4 focus:outline-none focus:ring-2 focus:ring-amber-500"
          autoFocus
        />
        {error && <p className="text-red-400 text-sm mb-4">Invalid admin key</p>}
        <button type="submit" disabled={checking} className="w-full bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold py-3 rounded-lg transition disabled:opacity-50">
          {checking ? 'Verifying...' : 'Enter'}
        </button>
      </form>
    </div>
  );
}

export default function AdminPage() {
  const [authed, setAuthed] = useState(false);
  const [tab, setTab] = useState<'requests' | 'outreach'>('requests');
  const [requests, setRequests] = useState<DemoRequest[]>([]);
  const [stats, setStats] = useState<Stats | null>(null);
  const [loading, setLoading] = useState(true);
  const [healthStatus, setHealthStatus] = useState<string>('checking...');
  const [copied, setCopied] = useState<string | null>(null);

  // Outreach state
  const [contactName, setContactName] = useState('');
  const [outreachInstitution, setOutreachInstitution] = useState('');
  const [outreachAssets, setOutreachAssets] = useState('');
  const [outreachLang, setOutreachLang] = useState<'EN' | 'ES'>('EN');
  const [outreachResult, setOutreachResult] = useState('');
  const [outreachLoading, setOutreachLoading] = useState(false);
  const [fetchError, setFetchError] = useState<string | null>(null);

  useEffect(() => {
    if (getAdminAccessKey()) {
      setAuthed(true);
    }
  }, []);

  const fetchData = useCallback(async () => {
    setLoading(true);
    try {
      const [reqs, st] = await Promise.all([
        apiClient.getDemoRequests(),
        apiClient.getAdminStats(),
      ]);
      setRequests(reqs);
      setStats(st);
    } catch (err: unknown) {
      setFetchError(getErrorMessage(err));
    } finally {
      setLoading(false);
    }
  }, []);

  const checkHealth = useCallback(async () => {
    try {
      const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');
      const res = await fetch(`${NODE_API_URL}/health`);
      const data = await res.json();
      setHealthStatus(data.status === 'healthy' ? 'Healthy' : 'Degraded');
    } catch {
      setHealthStatus('Unreachable');
    }
  }, []);

  useEffect(() => {
    if (authed) {
      fetchData();
      checkHealth();
    }
  }, [authed, fetchData, checkHealth]);

  const copyToClipboard = (text: string, id: string) => {
    navigator.clipboard.writeText(text);
    setCopied(id);
    setTimeout(() => setCopied(null), 2000);
  };

  const generateDemoMessage = (req: DemoRequest) => {
    const name = req.name || 'there';
    return `Hi ${name}, here's your personalized CERNIQ demo: ${VERCEL_URL}/demo?type=bank — I've pre-loaded it with a $1.2B Puerto Rico community bank profile. Takes 2 min to register. Let me know when you're ready to walk through it together. — Erwin`;
  };

  const handleResetDemo = async () => {
    if (!confirm('Delete all institution data? This cannot be undone.')) return;
    await apiClient.resetDemoData();
    fetchData();
  };

  const generateOutreach = () => {
    setOutreachLoading(true);
    const templates = {
      EN: `Hi ${contactName}, I'm Erwin from KLYTICS in San Juan. We built CERNIQ — a platform that replaces Excel-based ALM with automated duration gap analysis, NII sensitivity, and stress testing. Built specifically for ${outreachInstitution}-sized institutions (${outreachAssets}) preparing for OCIF exams. Would you have 15 minutes this week for a quick walkthrough? Happy to pre-load your institution's profile so you can see real outputs.`,
      ES: `Hola ${contactName}, soy Erwin de KLYTICS en San Juan. Desarrollamos CERNIQ — una plataforma que reemplaza el ALM basado en Excel con analisis automatizado de duration gap, sensibilidad NII y pruebas de estres. Disenado especificamente para instituciones como ${outreachInstitution} (${outreachAssets}) preparandose para examenes OCIF. Tendrias 15 minutos esta semana para una demostracion rapida? Puedo pre-cargar el perfil de tu institucion para que veas resultados reales.`,
    };
    setTimeout(() => {
      setOutreachResult(templates[outreachLang]);
      setOutreachLoading(false);
    }, 500);
  };

  if (!authed) {
    return <AdminAuth onAuth={() => setAuthed(true)} />;
  }

  return (
    <div className="min-h-screen bg-slate-950 text-white">
      {/* Header */}
      <div className="border-b border-white/10 bg-slate-900/80">
        <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <Landmark className="h-5 w-5 text-amber-400" />
            <h1 className="text-lg font-bold">CERNIQ Admin</h1>
          </div>
          <div className="flex items-center gap-4 text-sm">
            <a href={VERCEL_URL} target="_blank" rel="noopener noreferrer" className="flex items-center gap-1 text-slate-400 hover:text-white transition">
              <ExternalLink className="h-3.5 w-3.5" /> Live Site
            </a>
            <span className={`px-2 py-1 rounded text-xs font-medium ${healthStatus === 'Healthy' ? 'bg-emerald-500/20 text-emerald-300' : healthStatus === 'Degraded' ? 'bg-amber-500/20 text-amber-300' : 'bg-red-500/20 text-red-300'}`}>
              Backend: {healthStatus}
            </span>
            {stats && (
              <span className="px-2 py-1 rounded bg-blue-500/20 text-blue-300 text-xs font-medium">
                {stats.demoRequests} requests
              </span>
            )}
          </div>
        </div>
      </div>

      {fetchError && (
        <div className="max-w-7xl mx-auto px-6 pt-4">
          <div className="bg-red-500/10 border border-red-500/20 rounded-lg px-4 py-3 flex items-center gap-2">
            <span className="text-red-400 text-sm">{fetchError}</span>
            <button onClick={() => { setFetchError(null); fetchData(); }} className="text-xs text-red-300 hover:text-white ml-auto underline">Retry</button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        {/* Stats */}
        {stats && (
          <div className="grid grid-cols-2 md:grid-cols-5 gap-4">
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><FileText className="h-3.5 w-3.5" /> Demo Requests</div>
              <div className="text-2xl font-bold">{stats.demoRequests}</div>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Building2 className="h-3.5 w-3.5" /> Institutions</div>
              <div className="text-2xl font-bold">{stats.institutions}</div>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Users className="h-3.5 w-3.5" /> Total Users</div>
              <div className="text-2xl font-bold">{stats.users}</div>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><Users className="h-3.5 w-3.5" /> Last 7 Days</div>
              <div className="text-2xl font-bold">{stats.recentUsers}</div>
            </div>
            <div className="bg-slate-900/60 border border-white/10 rounded-xl p-4">
              <div className="flex items-center gap-2 text-slate-400 text-xs mb-1"><UserSearch className="h-3.5 w-3.5" /> Prospects</div>
              <div className="text-2xl font-bold">{stats.prospects}</div>
            </div>
          </div>
        )}

        {/* Quick Links */}
        <div className="flex gap-3 flex-wrap">
          <Link href="/admin/leads" className="flex items-center gap-2 bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/20 text-emerald-300 px-4 py-2.5 rounded-xl text-sm font-medium transition">
            <Users className="h-4 w-4" /> Lead Pipeline
          </Link>
          <Link href="/admin/prospects" className="flex items-center gap-2 bg-amber-500/10 hover:bg-amber-500/20 border border-amber-500/20 text-amber-300 px-4 py-2.5 rounded-xl text-sm font-medium transition">
            <UserSearch className="h-4 w-4" /> Prospect Pipeline
          </Link>
          <Link href="/admin/checklist" className="flex items-center gap-2 bg-white/[0.04] hover:bg-white/[0.08] border border-white/[0.08] text-slate-300 px-4 py-2.5 rounded-xl text-sm font-medium transition">
            <ClipboardCheck className="h-4 w-4" /> Pre-Demo Checklist
          </Link>
          <Link href="/admin/ops" className="flex items-center gap-2 bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 text-blue-300 px-4 py-2.5 rounded-xl text-sm font-medium transition">
            <Activity className="h-4 w-4" /> Ops Dashboard
          </Link>
          <Link href="/admin/audit" className="flex items-center gap-2 bg-purple-500/10 hover:bg-purple-500/20 border border-purple-500/20 text-purple-300 px-4 py-2.5 rounded-xl text-sm font-medium transition">
            <FileText className="h-4 w-4" /> Audit Trail
          </Link>
        </div>

        {/* Platform Metrics */}
        <div className="bg-slate-900/60 border border-white/10 rounded-xl p-5">
          <h3 className="text-xs font-semibold uppercase tracking-wider text-slate-400 mb-4">Platform Metrics</h3>
          <div className="grid grid-cols-3 md:grid-cols-6 gap-4">
            {[
              { label: 'Frontend Pages', value: '122', color: 'text-cyan-300' },
              { label: 'ALM Modules', value: '62', color: 'text-indigo-300' },
              { label: 'Backend Services', value: '142', color: 'text-emerald-300' },
              { label: 'API Endpoints', value: '142', color: 'text-amber-300' },
              { label: 'Prisma Models', value: '54', color: 'text-purple-300' },
              { label: 'Quant Models', value: '34', color: 'text-rose-300' },
            ].map((m) => (
              <div key={m.label} className="text-center">
                <p className={`text-2xl font-bold tabular-nums ${m.color}`}>{m.value}</p>
                <p className="text-[10px] text-slate-500 mt-0.5">{m.label}</p>
              </div>
            ))}
          </div>
          <div className="mt-4 grid grid-cols-2 md:grid-cols-4 gap-3">
            {[
              { label: 'Sidebar Entries', value: '54' },
              { label: 'i18n Keys', value: '240+' },
              { label: 'Total Commits', value: '63' },
              { label: 'Bibles Executed', value: 'V1-V12' },
            ].map((m) => (
              <div key={m.label} className="flex items-center justify-between bg-white/[0.03] rounded-lg px-3 py-2">
                <span className="text-[10px] text-slate-500">{m.label}</span>
                <span className="text-xs font-bold text-white tabular-nums">{m.value}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Tabs */}
        <div className="flex gap-2 border-b border-white/10 pb-2">
          <button onClick={() => setTab('requests')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'requests' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'}`}>
            Demo Requests
          </button>
          <button onClick={() => setTab('outreach')} className={`px-4 py-2 rounded-lg text-sm font-medium transition ${tab === 'outreach' ? 'bg-amber-500/20 text-amber-300' : 'text-slate-400 hover:text-white'}`}>
            Outreach
          </button>
        </div>

        {tab === 'requests' && (
          <>
            {/* Quick Actions */}
            <div className="flex gap-3">
              <button onClick={fetchData} disabled={loading} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm transition">
                <RefreshCw className={`h-3.5 w-3.5 ${loading ? 'animate-spin' : ''}`} /> Refresh
              </button>
              <button onClick={() => copyToClipboard(`${VERCEL_URL}/demo?type=bank`, 'demo-url')} className="flex items-center gap-2 bg-white/5 hover:bg-white/10 px-4 py-2 rounded-lg text-sm transition">
                {copied === 'demo-url' ? <Check className="h-3.5 w-3.5 text-emerald-400" /> : <Copy className="h-3.5 w-3.5" />} Copy Demo URL
              </button>
              <button onClick={handleResetDemo} className="flex items-center gap-2 bg-red-500/10 hover:bg-red-500/20 text-red-300 px-4 py-2 rounded-lg text-sm transition">
                <Trash2 className="h-3.5 w-3.5" /> Reset Demo Data
              </button>
            </div>

            {/* Table */}
            <div className="bg-slate-900/60 border border-white/10 rounded-xl overflow-hidden">
              <table className="w-full text-sm">
                <thead>
                  <tr className="border-b border-white/10 text-left text-slate-400">
                    <th className="px-4 py-3 font-medium">Date</th>
                    <th className="px-4 py-3 font-medium">Name</th>
                    <th className="px-4 py-3 font-medium">Email</th>
                    <th className="px-4 py-3 font-medium">Institution</th>
                    <th className="px-4 py-3 font-medium">Type</th>
                    <th className="px-4 py-3 font-medium">Assets</th>
                    <th className="px-4 py-3 font-medium">Actions</th>
                  </tr>
                </thead>
                <tbody>
                  {requests.length === 0 ? (
                    <tr>
                      <td colSpan={7} className="px-4 py-8 text-center text-slate-500">
                        No demo requests yet
                      </td>
                    </tr>
                  ) : (
                    requests.map((req) => (
                      <tr key={req.id} className="border-b border-white/5 hover:bg-white/5">
                        <td className="px-4 py-3 text-slate-400">
                          {new Date(req.createdAt).toLocaleDateString()}
                        </td>
                        <td className="px-4 py-3">{req.name || '—'}</td>
                        <td className="px-4 py-3 text-amber-300">{req.email}</td>
                        <td className="px-4 py-3">{req.institutionName || '—'}</td>
                        <td className="px-4 py-3 capitalize">{req.institutionType?.replace('_', ' ') || '—'}</td>
                        <td className="px-4 py-3">{req.totalAssets || '—'}</td>
                        <td className="px-4 py-3">
                          <div className="flex gap-2">
                            <button
                              onClick={() => copyToClipboard(generateDemoMessage(req), req.id)}
                              className="text-xs bg-amber-500/20 hover:bg-amber-500/30 text-amber-300 px-2 py-1 rounded transition"
                            >
                              {copied === req.id ? 'Copied!' : 'Send Demo Link'}
                            </button>
                            <button
                              onClick={() => copyToClipboard(req.email, `email-${req.id}`)}
                              className="text-xs bg-white/5 hover:bg-white/10 px-2 py-1 rounded transition"
                            >
                              {copied === `email-${req.id}` ? 'Copied!' : 'Copy Email'}
                            </button>
                          </div>
                        </td>
                      </tr>
                    ))
                  )}
                </tbody>
              </table>
            </div>
          </>
        )}

        {tab === 'outreach' && (
          <div className="bg-slate-900/60 border border-white/10 rounded-xl p-6 max-w-2xl">
            <h3 className="text-lg font-bold mb-4">Generate Outreach Message</h3>
            <div className="space-y-4">
              <div>
                <label className="block text-sm text-slate-400 mb-1">Contact Name</label>
                <input
                  type="text"
                  value={contactName}
                  onChange={(e) => setContactName(e.target.value)}
                  placeholder="Jose Pablo"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div>
                <label className="block text-sm text-slate-400 mb-1">Institution Name</label>
                <input
                  type="text"
                  value={outreachInstitution}
                  onChange={(e) => setOutreachInstitution(e.target.value)}
                  placeholder="Banco Popular"
                  className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                />
              </div>
              <div className="grid grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Asset Size</label>
                  <select
                    value={outreachAssets}
                    onChange={(e) => setOutreachAssets(e.target.value)}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="">Select</option>
                    <option value="$100M-$500M">$100M-$500M</option>
                    <option value="$500M-$1B">$500M-$1B</option>
                    <option value="$1B-$5B">$1B-$5B</option>
                    <option value="$5B+">$5B+</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm text-slate-400 mb-1">Language</label>
                  <select
                    value={outreachLang}
                    onChange={(e) => setOutreachLang(e.target.value as 'EN' | 'ES')}
                    className="w-full bg-white/5 border border-white/10 rounded-lg px-4 py-2 text-white focus:outline-none focus:ring-2 focus:ring-amber-500"
                  >
                    <option value="EN">English</option>
                    <option value="ES">Spanish</option>
                  </select>
                </div>
              </div>
              <button
                onClick={generateOutreach}
                disabled={!contactName || !outreachInstitution || outreachLoading}
                className="bg-amber-500 hover:bg-amber-400 text-slate-900 font-semibold px-6 py-2 rounded-lg transition disabled:opacity-50"
              >
                {outreachLoading ? 'Generating...' : 'Generate'}
              </button>

              {outreachResult && (
                <div className="mt-4">
                  <div className="bg-slate-800 border border-white/10 rounded-lg p-4 text-sm text-slate-200 leading-relaxed">
                    {outreachResult}
                  </div>
                  <button
                    onClick={() => copyToClipboard(outreachResult, 'outreach')}
                    className="mt-2 flex items-center gap-2 text-sm text-amber-300 hover:text-amber-200 transition"
                  >
                    {copied === 'outreach' ? <Check className="h-3.5 w-3.5" /> : <Copy className="h-3.5 w-3.5" />}
                    {copied === 'outreach' ? 'Copied!' : 'Copy to Clipboard'}
                  </button>
                </div>
              )}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
