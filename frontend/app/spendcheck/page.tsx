'use client';

import { useEffect, useState, type ReactNode } from 'react';
import Link from 'next/link';
import { Building2, Plus, Receipt, Search, FileSpreadsheet } from 'lucide-react';
import PlatformPage from '@/components/layout/PlatformPage';
import { spendcheckApi, Workspace, FindingsStats } from '@/lib/spendcheck-api';

export default function SpendCheckPage() {
  const [workspaces, setWorkspaces] = useState<Workspace[]>([]);
  const [selectedWorkspace, setSelectedWorkspace] = useState<Workspace | null>(null);
  const [stats, setStats] = useState<FindingsStats | null>(null);
  const [loading, setLoading] = useState(true);
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newWorkspaceName, setNewWorkspaceName] = useState('');
  const [newCompanyName, setNewCompanyName] = useState('');

  useEffect(() => {
    void loadWorkspaces();
  }, []);

  useEffect(() => {
    if (selectedWorkspace) {
      void loadStats(selectedWorkspace.id);
    }
  }, [selectedWorkspace]);

  async function loadWorkspaces() {
    try {
      const data = await spendcheckApi.listWorkspaces();
      setWorkspaces(data);
      if (data.length > 0) {
        setSelectedWorkspace(data[0]);
      }
    } catch (error) {
      console.error('Failed to load workspaces:', error);
    } finally {
      setLoading(false);
    }
  }

  async function loadStats(workspaceId: string) {
    try {
      const data = await spendcheckApi.getFindingsStats(workspaceId);
      setStats(data);
    } catch (error) {
      console.error('Failed to load stats:', error);
    }
  }

  async function createWorkspace() {
    if (!newWorkspaceName.trim()) {
      return;
    }

    try {
      const workspace = await spendcheckApi.createWorkspace(newWorkspaceName, newCompanyName);
      setWorkspaces((current) => [workspace, ...current]);
      setSelectedWorkspace(workspace);
      setShowCreateModal(false);
      setNewWorkspaceName('');
      setNewCompanyName('');
    } catch (error) {
      console.error('Failed to create workspace:', error);
    }
  }

  const formatCurrency = (amount: number) =>
    new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 0,
      maximumFractionDigits: 0,
    }).format(amount);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-[#f7fbff]">
        <div className="h-12 w-12 animate-spin rounded-full border-2 border-cyan-200 border-t-cyan-600" />
      </div>
    );
  }

  return (
    <>
      <PlatformPage
        kicker="SpendCheck"
        title="Extend CERNIQ into spend intelligence, invoice review, and AP recovery workflows."
        description="SpendCheck keeps the same white-and-blue CERNIQ system while shifting the focus from securities to payable leakage, duplicate payments, and vendor anomalies."
        meta={
          <>
            <span className="cerniq-mini-stat">
              <strong>{workspaces.length}</strong> workspaces
            </span>
            {selectedWorkspace ? (
              <span className="cerniq-mini-stat">
                <strong>{selectedWorkspace.name}</strong>
              </span>
            ) : null}
          </>
        }
        actions={
          <>
            {workspaces.length > 0 ? (
              <div className="relative">
                <select
                  value={selectedWorkspace?.id || ''}
                  onChange={(event) => {
                    const workspace = workspaces.find((item) => item.id === event.target.value);
                    if (workspace) {
                      setSelectedWorkspace(workspace);
                    }
                  }}
                  className="cerniq-field cerniq-select min-w-[240px] py-3 pl-4 pr-10 text-sm"
                >
                  {workspaces.map((workspace) => (
                    <option key={workspace.id} value={workspace.id}>
                      {workspace.name}
                    </option>
                  ))}
                </select>
                <Building2 className="pointer-events-none absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-500" />
              </div>
            ) : null}
            <button onClick={() => setShowCreateModal(true)} className="cerniq-button-primary px-5 py-3 text-sm">
              <Plus className="h-4 w-4" />
              New workspace
            </button>
          </>
        }
      >
        {workspaces.length === 0 ? (
          <section className="cerniq-empty-state">
            <Receipt className="mx-auto h-12 w-12 text-cyan-700/70" />
            <h2 className="mt-5 font-display text-3xl text-slate-950">Welcome to SpendCheck</h2>
            <p className="mt-3 text-sm leading-7 text-slate-600">
              Create a workspace to upload AP exports, detect spend leaks, and turn recovery opportunities into an operating workflow.
            </p>
            <button onClick={() => setShowCreateModal(true)} className="cerniq-button-primary mt-6 px-5 py-3 text-sm">
              Create your first workspace
            </button>
          </section>
        ) : (
          <div className="space-y-6">
            <section className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
              <StatCard title="Spend analyzed" value={formatCurrency(selectedWorkspace?.stats?.total_spend_analyzed || 0)} icon={<FileSpreadsheet className="h-6 w-6 text-cyan-600" />} />
              <StatCard title="Findings detected" value={String(stats?.total_findings || 0)} icon={<Search className="h-6 w-6 text-amber-500" />} />
              <StatCard title="Potential savings" value={formatCurrency(stats?.total_potential_savings || 0)} icon={<Receipt className="h-6 w-6 text-emerald-600" />} />
              <StatCard title="Resolved savings" value={formatCurrency(stats?.resolved_savings || 0)} icon={<Building2 className="h-6 w-6 text-cyan-700" />} />
            </section>

            <section className="grid gap-6 md:grid-cols-3">
              <ActionCard
                title="Upload files"
                description="Send AP export CSVs for analysis and document parsing."
                href={`/spendcheck/upload?workspace=${selectedWorkspace?.id}`}
              />
              <ActionCard
                title="View findings"
                description="Review duplicates, spikes, and vendor anomalies by workspace."
                href={`/spendcheck/findings?workspace=${selectedWorkspace?.id}`}
              />
              <ActionCard
                title="Generate report"
                description="Create the shareable spend analysis package for stakeholders."
                href={`/spendcheck/report?workspace=${selectedWorkspace?.id}`}
              />
            </section>

            {stats && stats.by_type.length > 0 ? (
              <section className="cerniq-panel p-6">
                <p className="cerniq-section-label">Findings breakdown</p>
                <h2 className="mt-2 font-display text-2xl text-slate-950">What the engine is finding</h2>

                <div className="mt-6 space-y-3">
                  {stats.by_type.map((item) => (
                    <div key={item.finding_type} className="flex flex-wrap items-center justify-between gap-4 rounded-[1.25rem] border border-slate-200 bg-white/86 px-5 py-4">
                      <div className="flex items-center gap-3">
                        <span className="text-2xl">{getFindingTypeIcon(item.finding_type)}</span>
                        <div>
                          <p className="font-semibold text-slate-950">{formatFindingType(item.finding_type)}</p>
                          <p className="text-sm text-slate-500">{item.count} findings detected</p>
                        </div>
                      </div>
                      <div className="text-right">
                        <p className="text-lg font-semibold text-emerald-700">{formatCurrency(item.total_amount)}</p>
                        <p className="text-sm text-slate-500">Potential recovery</p>
                      </div>
                    </div>
                  ))}
                </div>
              </section>
            ) : null}
          </div>
        )}
      </PlatformPage>

      {showCreateModal ? (
        <div className="cerniq-modal-backdrop">
          <div className="cerniq-modal">
            <h2 className="font-display text-2xl text-slate-950">Create SpendCheck workspace</h2>
            <p className="mt-2 text-sm leading-6 text-slate-600">Start a new AP review workspace for a client, fund, or internal team.</p>
            <div className="mt-6 space-y-4">
              <input
                type="text"
                value={newWorkspaceName}
                onChange={(event) => setNewWorkspaceName(event.target.value)}
                placeholder="Workspace name"
                className="cerniq-field"
              />
              <input
                type="text"
                value={newCompanyName}
                onChange={(event) => setNewCompanyName(event.target.value)}
                placeholder="Company name (optional)"
                className="cerniq-field"
              />
            </div>
            <div className="mt-6 flex justify-end gap-3">
              <button onClick={() => setShowCreateModal(false)} className="cerniq-button-secondary px-5 py-3 text-sm">
                Cancel
              </button>
              <button onClick={createWorkspace} disabled={!newWorkspaceName.trim()} className="cerniq-button-primary px-5 py-3 text-sm disabled:opacity-60">
                Create
              </button>
            </div>
          </div>
        </div>
      ) : null}
    </>
  );
}

function StatCard({ title, value, icon }: { title: string; value: string; icon: ReactNode }) {
  return (
    <div className="cerniq-stat-card cerniq-stat-card-accent">
      {icon}
      <p className="mt-4 text-sm font-semibold uppercase tracking-[0.18em] text-slate-500">{title}</p>
      <p className="mt-2 text-3xl font-bold text-slate-950">{value}</p>
    </div>
  );
}

function ActionCard({ title, description, href }: { title: string; description: string; href: string }) {
  return (
    <Link href={href} className="cerniq-panel cerniq-card-hover p-6">
      <p className="cerniq-section-label">Workflow</p>
      <h3 className="mt-3 font-display text-2xl text-slate-950">{title}</h3>
      <p className="mt-3 text-sm leading-7 text-slate-600">{description}</p>
    </Link>
  );
}

function getFindingTypeIcon(type: string): string {
  const icons: Record<string, string> = {
    duplicate_payment: '🔄',
    subscription_drift: '📈',
    spend_spike: '⚡',
    zombie_subscription: '🧟',
    new_vendor_risk: '🆕',
    vendor_duplicate: '👥',
    vendor_anomaly: '🏢',
    data_quality: '⚠️',
  };
  return icons[type] || '📋';
}

function formatFindingType(type: string): string {
  const names: Record<string, string> = {
    duplicate_payment: 'Duplicate Payments',
    subscription_drift: 'Subscription Drift',
    spend_spike: 'Spend Spikes',
    zombie_subscription: 'Zombie Subscriptions',
    new_vendor_risk: 'New Vendor Risk',
    vendor_duplicate: 'Vendor Duplicates',
    vendor_anomaly: 'Vendor Anomalies',
    data_quality: 'Data Quality Issues',
  };
  return names[type] || type;
}
