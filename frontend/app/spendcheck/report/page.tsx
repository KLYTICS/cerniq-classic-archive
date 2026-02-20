'use client';

import { useEffect, useState, Suspense } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';
import { spendcheckApi, Workspace, Finding } from '@/lib/spendcheck-api';

function ReportContent() {
    const searchParams = useSearchParams();
    const workspaceId = searchParams.get('workspace');

    const [workspace, setWorkspace] = useState<Workspace | null>(null);
    const [findings, setFindings] = useState<Finding[]>([]);
    const [loading, setLoading] = useState(true);
    const [copied, setCopied] = useState(false);

    useEffect(() => {
        if (workspaceId) {
            loadData(workspaceId);
        }
    }, [workspaceId]);

    async function loadData(id: string) {
        try {
            const [ws, findingsData] = await Promise.all([
                spendcheckApi.getWorkspace(id),
                spendcheckApi.listFindings({ workspace_id: id, limit: 1000 }), // Get all for report
            ]);
            setWorkspace(ws);
            setFindings(findingsData.findings);
        } catch (error) {
            console.error('Failed to load data:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (amount: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const totalSavings = findings.reduce((sum, f) => sum + (f.potential_savings || 0), 0);
    const duplications = findings.filter(f => f.finding_type === 'duplicate_payment');
    const drifts = findings.filter(f => f.finding_type === 'subscription_drift');
    const spikes = findings.filter(f => f.finding_type === 'spend_spike');

    const copyToClipboard = () => {
        const text = `
Spend Analysis Report: ${workspace?.name}
Date: ${new Date().toLocaleDateString()}
Total Potential Savings: ${formatCurrency(totalSavings)}

Summary:
- Duplicate Payments: ${duplications.length}
- Subscription Drifts: ${drifts.length}
- Spend Spikes: ${spikes.length}

Top Findings:
${findings
                .slice(0, 5)
                .map(f => `- ${f.title}: ${formatCurrency(f.potential_savings || 0)} (${f.finding_type})`)
                .join('\n')}
    `.trim();

        navigator.clipboard.writeText(text);
        setCopied(true);
        setTimeout(() => setCopied(false), 2000);
    };

    if (!workspaceId) return <div className="p-12 text-center text-gray-500">No workspace selected</div>;

    return (
        <div className="min-h-screen bg-gray-50 text-gray-900">
            {/* Header (Print-friendly) */}
            <div className="bg-white border-b border-gray-200 print:border-none">
                <div className="max-w-4xl mx-auto px-8 py-6 flex items-center justify-between">
                    <div>
                        <div className="flex items-center gap-3 text-gray-500 text-sm mb-1 print:hidden">
                            <Link href="/spendcheck" className="hover:text-gray-900">
                                ← Back to Dashboard
                            </Link>
                        </div>
                        <h1 className="text-3xl font-bold text-gray-900">Spend Analysis Report</h1>
                        <p className="text-gray-500 mt-1">
                            Generated for <span className="font-semibold text-gray-900">{workspace?.name}</span> • {new Date().toLocaleDateString()}
                        </p>
                    </div>
                    <div className="flex gap-3 print:hidden">
                        <button
                            onClick={copyToClipboard}
                            className="px-4 py-2 bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            {copied ? '✅ Copied' : '📋 Copy Summary'}
                        </button>
                        <button
                            onClick={() => window.print()}
                            className="px-4 py-2 bg-gray-900 hover:bg-gray-800 text-white rounded-lg font-medium transition flex items-center gap-2"
                        >
                            🖨️ Print / PDF
                        </button>
                    </div>
                </div>
            </div>

            <div className="max-w-4xl mx-auto px-8 py-12 print:py-6">
                {loading ? (
                    <div className="flex justify-center py-20">
                        <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div>
                    </div>
                ) : (
                    <div className="space-y-8">
                        {/* Executive Summary */}
                        <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 print:shadow-none print:border-black print:p-0">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span className="text-2xl">💰</span> Executive Summary
                            </h2>
                            <div className="grid grid-cols-3 gap-8">
                                <div>
                                    <div className="text-gray-500 text-sm uppercase tracking-wider mb-1">Total Leaks</div>
                                    <div className="text-4xl font-bold text-gray-900">{findings.length}</div>
                                </div>
                                <div className="col-span-2">
                                    <div className="text-gray-500 text-sm uppercase tracking-wider mb-1">Potential Savings</div>
                                    <div className="text-4xl font-bold text-emerald-600">
                                        {formatCurrency(totalSavings)}
                                    </div>
                                </div>
                            </div>
                        </section>

                        {/* Findings Inventory */}
                        <section className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden print:shadow-none print:border-black">
                            <div className="px-8 py-6 border-b border-gray-100">
                                <h2 className="text-xl font-bold flex items-center gap-2">
                                    <span className="text-2xl">📋</span> Leak Inventory
                                </h2>
                            </div>
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="px-8 py-3 font-semibold text-gray-600">Finding</th>
                                        <th className="px-8 py-3 font-semibold text-gray-600">Type</th>
                                        <th className="px-8 py-3 font-semibold text-gray-600 text-right">Potential Savings</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-100">
                                    {findings.map(finding => (
                                        <tr key={finding.id} className="hover:bg-gray-50/50">
                                            <td className="px-8 py-4">
                                                <div className="font-medium text-gray-900">{finding.title}</div>
                                                <div className="text-gray-500 text-xs mt-1">{finding.entity_name}</div>
                                            </td>
                                            <td className="px-8 py-4">
                                                <span className="inline-flex items-center px-2 py-1 rounded-full text-xs font-medium bg-gray-100 text-gray-600 capitalize">
                                                    {finding.finding_type.replace(/_/g, ' ')}
                                                </span>
                                            </td>
                                            <td className="px-8 py-4 text-right font-medium text-emerald-600">
                                                {formatCurrency(finding.potential_savings || 0)}
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </section>

                        {/* Recommendations */}
                        <section className="bg-white rounded-2xl p-8 shadow-sm border border-gray-100 print:shadow-none print:border-black print:break-inside-avoid">
                            <h2 className="text-xl font-bold mb-6 flex items-center gap-2">
                                <span className="text-2xl">✅</span> Recommendations
                            </h2>
                            <ul className="space-y-4">
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">1</span>
                                    <p className="text-gray-700">
                                        Recover <span className="font-bold">{formatCurrency(duplications.reduce((s, f) => s + (f.potential_savings || 0), 0))}</span> from duplicate payments by contacting identified vendors for refunds.
                                    </p>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">2</span>
                                    <p className="text-gray-700">
                                        Review {drifts.length} subscriptions with price drift greater than 10% to negotiate better rates or switch plans.
                                    </p>
                                </li>
                                <li className="flex gap-3">
                                    <span className="w-6 h-6 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center flex-shrink-0 text-sm font-bold">3</span>
                                    <p className="text-gray-700">
                                        Investigate {spikes.length} anomalous spend spikes to ensure they are legitimate one-time expenses.
                                    </p>
                                </li>
                            </ul>
                        </section>
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ReportPage() {
    return (
        <Suspense fallback={<div className="min-h-screen bg-white flex items-center justify-center"><div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-gray-900"></div></div>}>
            <ReportContent />
        </Suspense>
    );
}
