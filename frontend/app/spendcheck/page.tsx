'use client';

import { useEffect, useState } from 'react';
import Link from 'next/link';
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
        loadWorkspaces();
    }, []);

    useEffect(() => {
        if (selectedWorkspace) {
            loadStats(selectedWorkspace.id);
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
        if (!newWorkspaceName.trim()) return;
        try {
            const workspace = await spendcheckApi.createWorkspace(newWorkspaceName, newCompanyName);
            setWorkspaces([workspace, ...workspaces]);
            setSelectedWorkspace(workspace);
            setShowCreateModal(false);
            setNewWorkspaceName('');
            setNewCompanyName('');
        } catch (error) {
            console.error('Failed to create workspace:', error);
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 0,
            maximumFractionDigits: 0,
        }).format(amount);
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/" className="text-gray-400 hover:text-white transition">
                            ← Back
                        </Link>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            SpendCheck
                        </h1>
                    </div>

                    {/* Workspace Selector */}
                    <div className="flex items-center gap-4">
                        <select
                            value={selectedWorkspace?.id || ''}
                            onChange={(e) => {
                                const ws = workspaces.find(w => w.id === e.target.value);
                                if (ws) setSelectedWorkspace(ws);
                            }}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                        >
                            {workspaces.map(ws => (
                                <option key={ws.id} value={ws.id}>{ws.name}</option>
                            ))}
                        </select>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium transition"
                        >
                            + New Workspace
                        </button>
                    </div>
                </div>
            </div>

            {/* Main Content */}
            <div className="max-w-7xl mx-auto px-6 py-8">
                {workspaces.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-6xl mb-4">📊</div>
                        <h2 className="text-2xl font-bold mb-2">Welcome to SpendCheck</h2>
                        <p className="text-gray-400 mb-6">
                            Upload your AP export files to detect spend leaks and save money
                        </p>
                        <button
                            onClick={() => setShowCreateModal(true)}
                            className="bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-lg font-medium transition text-lg"
                        >
                            Create Your First Workspace
                        </button>
                    </div>
                ) : (
                    <>
                        {/* Stats Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-4 gap-6 mb-8">
                            <StatCard
                                title="Total Spend Analyzed"
                                value={formatCurrency(selectedWorkspace?.stats?.total_spend_analyzed || 0)}
                                icon="💰"
                                color="emerald"
                            />
                            <StatCard
                                title="Findings Detected"
                                value={String(stats?.total_findings || 0)}
                                icon="🔍"
                                color="yellow"
                            />
                            <StatCard
                                title="Potential Savings"
                                value={formatCurrency(stats?.total_potential_savings || 0)}
                                icon="💸"
                                color="cyan"
                            />
                            <StatCard
                                title="Resolved Savings"
                                value={formatCurrency(stats?.resolved_savings || 0)}
                                icon="✅"
                                color="green"
                            />
                        </div>

                        {/* Actions Grid */}
                        <div className="grid grid-cols-1 md:grid-cols-3 gap-6 mb-8">
                            <ActionCard
                                title="Upload Files"
                                description="Upload AP export CSV files for analysis"
                                icon="📤"
                                href={`/spendcheck/upload?workspace=${selectedWorkspace?.id}`}
                                color="emerald"
                            />
                            <ActionCard
                                title="View Findings"
                                description="Browse and manage detected spend leaks"
                                icon="📋"
                                href={`/spendcheck/findings?workspace=${selectedWorkspace?.id}`}
                                color="yellow"
                            />
                            <ActionCard
                                title="Generate Report"
                                description="Create shareable spend analysis report"
                                icon="📊"
                                href={`/spendcheck/report?workspace=${selectedWorkspace?.id}`}
                                color="cyan"
                            />
                        </div>

                        {/* Findings Breakdown */}
                        {stats && stats.by_type.length > 0 && (
                            <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                                <h3 className="text-lg font-semibold mb-4">Findings by Type</h3>
                                <div className="space-y-3">
                                    {stats.by_type.map((item) => (
                                        <div key={item.finding_type} className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{getFindingTypeIcon(item.finding_type)}</span>
                                                <span className="font-medium">{formatFindingType(item.finding_type)}</span>
                                            </div>
                                            <div className="flex items-center gap-4">
                                                <span className="text-gray-400">{item.count} found</span>
                                                <span className="text-emerald-400 font-semibold">
                                                    {formatCurrency(item.total_amount)}
                                                </span>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            </div>
                        )}
                    </>
                )}
            </div>

            {/* Create Workspace Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 w-full max-w-md">
                        <h2 className="text-xl font-bold mb-4">Create New Workspace</h2>
                        <div className="space-y-4">
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    Workspace Name
                                </label>
                                <input
                                    type="text"
                                    value={newWorkspaceName}
                                    onChange={(e) => setNewWorkspaceName(e.target.value)}
                                    placeholder="e.g., Q1 2024 Analysis"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                            <div>
                                <label className="block text-sm font-medium text-gray-400 mb-1">
                                    Company Name (optional)
                                </label>
                                <input
                                    type="text"
                                    value={newCompanyName}
                                    onChange={(e) => setNewCompanyName(e.target.value)}
                                    placeholder="e.g., Acme Corp"
                                    className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-2 text-white focus:ring-2 focus:ring-emerald-500 focus:outline-none"
                                />
                            </div>
                        </div>
                        <div className="flex justify-end gap-3 mt-6">
                            <button
                                onClick={() => setShowCreateModal(false)}
                                className="px-4 py-2 text-gray-400 hover:text-white transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createWorkspace}
                                disabled={!newWorkspaceName.trim()}
                                className="bg-emerald-600 hover:bg-emerald-500 disabled:bg-gray-700 disabled:cursor-not-allowed px-4 py-2 rounded-lg font-medium transition"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

function StatCard({ title, value, icon, color }: {
    title: string;
    value: string;
    icon: string;
    color: 'emerald' | 'yellow' | 'cyan' | 'green';
}) {
    const colorClasses = {
        emerald: 'from-emerald-500/20 to-emerald-500/5 border-emerald-500/30',
        yellow: 'from-yellow-500/20 to-yellow-500/5 border-yellow-500/30',
        cyan: 'from-cyan-500/20 to-cyan-500/5 border-cyan-500/30',
        green: 'from-green-500/20 to-green-500/5 border-green-500/30',
    };

    return (
        <div className={`bg-gradient-to-br ${colorClasses[color]} border rounded-xl p-6`}>
            <div className="flex items-center gap-3 mb-2">
                <span className="text-2xl">{icon}</span>
                <span className="text-gray-400 text-sm">{title}</span>
            </div>
            <div className="text-2xl font-bold">{value}</div>
        </div>
    );
}

function ActionCard({ title, description, icon, href, color }: {
    title: string;
    description: string;
    icon: string;
    href: string;
    color: 'emerald' | 'yellow' | 'cyan';
}) {
    const colorClasses = {
        emerald: 'hover:border-emerald-500/50 hover:bg-emerald-500/5',
        yellow: 'hover:border-yellow-500/50 hover:bg-yellow-500/5',
        cyan: 'hover:border-cyan-500/50 hover:bg-cyan-500/5',
    };

    return (
        <Link
            href={href}
            className={`bg-gray-900/50 border border-gray-800 rounded-xl p-6 transition ${colorClasses[color]}`}
        >
            <span className="text-4xl mb-4 block">{icon}</span>
            <h3 className="text-lg font-semibold mb-1">{title}</h3>
            <p className="text-gray-400 text-sm">{description}</p>
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
