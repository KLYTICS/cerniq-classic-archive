'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { spendcheckApi, Finding, Workspace } from '@/lib/spendcheck-api';
import FindingCard from '@/components/spendcheck/FindingCard';

function FindingsContent() {
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get('workspace');

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const [filterType, setFilterType] = useState<string>('all');
    const [filterStatus, setFilterStatus] = useState<string>('all');

    useEffect(() => {
        if (workspaceId) {
            loadData(workspaceId);
        }
    }, [workspaceId]);

    async function loadData(id: string) {
        try {
            const [ws, findingsData] = await Promise.all([
                spendcheckApi.getWorkspace(id),
                spendcheckApi.listFindings({ workspace_id: id, limit: 100 }),
            ]);
            setWorkspace(ws);
            setFindings(findingsData.findings);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }

    const handleUpdateFinding = (id: string, newStatus: string) => {
        setFindings(findings.map(f =>
            f.id === id ? { ...f, status: newStatus } : f
        ));
    };

    const filteredFindings = findings.filter(f => {
        if (filterType !== 'all' && f.finding_type !== filterType) return false;
        if (filterStatus !== 'all' && f.status !== filterStatus) return false;
        return true;
    });

    const totalSavings = filteredFindings.reduce((sum, f) => sum + (f.potential_savings || 0), 0);

    if (!workspaceId) return <div className="p-12 text-center text-gray-500">No workspace selected</div>;

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="sticky top-0 z-10 border-b border-gray-800 bg-gray-900/80 backdrop-blur">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/spendcheck" className="text-gray-400 hover:text-white transition">
                            ← Back
                        </Link>
                        <h1 className="text-2xl font-bold">Findings</h1>
                        {workspace && (
                            <span className="bg-gray-800 text-gray-300 px-3 py-1 rounded-full text-sm">
                                {workspace.name}
                            </span>
                        )}
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <div className="text-xs text-gray-400 uppercase">Visible Savings</div>
                            <div className="text-xl font-bold text-emerald-400">
                                {new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD' }).format(totalSavings)}
                            </div>
                        </div>
                        <Link
                            href={`/spendcheck/report?workspace=${workspaceId}`}
                            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium transition"
                        >
                            Generate Report
                        </Link>
                    </div>
                </div>

                {/* Filters Toolbar */}
                <div className="border-t border-gray-800 px-6 py-3 bg-gray-900/50">
                    <div className="max-w-7xl mx-auto flex gap-4">
                        <select
                            value={filterType}
                            onChange={(e) => setFilterType(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        >
                            <option value="all">All Types</option>
                            <option value="duplicate_payment">Duplicate Payments</option>
                            <option value="subscription_drift">Subscription Drift</option>
                            <option value="spend_spike">Spend Spikes</option>
                            <option value="vendor_anomaly">Vendor Anomalies</option>
                        </select>
                        <select
                            value={filterStatus}
                            onChange={(e) => setFilterStatus(e.target.value)}
                            className="bg-gray-800 border border-gray-700 rounded-lg px-3 py-1.5 text-sm focus:ring-1 focus:ring-emerald-500 focus:outline-none"
                        >
                            <option value="all">All Statuses</option>
                            <option value="new">New</option>
                            <option value="investigating">Investigating</option>
                            <option value="resolved">Resolved</option>
                            <option value="ignored">Ignored</option>
                        </select>
                    </div>
                </div>
            </div>

            <div className="max-w-7xl mx-auto px-6 py-8">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div>
                    </div>
                ) : filteredFindings.length === 0 ? (
                    <div className="text-center py-20 bg-gray-900/30 rounded-2xl border border-gray-800 border-dashed">
                        <div className="text-4xl mb-4">🔍</div>
                        <h3 className="text-xl font-bold mb-2">No findings found</h3>
                        <p className="text-gray-400">Try adjusting your filters or upload more data.</p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                        {filteredFindings.map(finding => (
                            <FindingCard
                                key={finding.id}
                                finding={finding}
                                onUpdate={handleUpdateFinding}
                            />
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function FindingsPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-gray-950 flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-emerald-500"></div></div>}>
            <FindingsContent />
        </Suspense>
    );
}
