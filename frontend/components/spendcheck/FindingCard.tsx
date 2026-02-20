'use client';

import { useState } from 'react';
import { Finding, spendcheckApi } from '@/lib/spendcheck-api';
import FindingStatusBadge from './FindingStatusBadge';

interface FindingCardProps {
    finding: Finding;
    onUpdate: (id: string, newStatus: string) => void;
}

export default function FindingCard({ finding, onUpdate }: FindingCardProps) {
    const [expanded, setExpanded] = useState(false);
    const [loading, setLoading] = useState(false);

    async function handleStatusChange(newStatus: string) {
        setLoading(true);
        try {
            await spendcheckApi.updateFinding(finding.id, newStatus);
            onUpdate(finding.id, newStatus);
        } catch (error) {
            console.error('Failed to update status:', error);
        } finally {
            setLoading(false);
        }
    }

    const formatCurrency = (amount?: number) => {
        if (amount === undefined) return '-';
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
        }).format(amount);
    };

    const getSeverityColor = (severity: number) => {
        if (severity >= 80) return 'text-red-400';
        if (severity >= 50) return 'text-orange-400';
        return 'text-yellow-400';
    };

    return (
        <div className={`bg-gray-900 border ${finding.status === 'resolved' ? 'border-emerald-900/50 opacity-75' : 'border-gray-800'} rounded-xl p-6 transition hover:border-gray-700`}>
            <div className="flex items-start justify-between mb-4">
                <div className="flex-1">
                    <div className="flex items-center gap-3 mb-2">
                        <FindingStatusBadge status={finding.status} />
                        <span className={`text-sm font-bold ${getSeverityColor(finding.severity)}`}>
                            Score: {finding.severity}
                        </span>
                        <span className="text-gray-500 text-sm">
                            {new Date(finding.created_at).toLocaleDateString()}
                        </span>
                    </div>
                    <h3 className="text-lg font-bold text-white mb-1">{finding.title}</h3>
                    <p className="text-gray-400 text-sm line-clamp-2">{finding.explanation}</p>
                </div>
                <div className="text-right ml-4">
                    <div className="text-gray-500 text-xs uppercase tracking-wider mb-1">Potential Savings</div>
                    <div className="text-xl font-bold text-emerald-400">
                        {formatCurrency(finding.potential_savings)}
                    </div>
                </div>
            </div>

            {/* Expanded Details */}
            {expanded && (
                <div className="border-t border-gray-800 pt-4 mt-4 animate-in slide-in-from-top-2">
                    <div className="grid grid-cols-2 gap-4 mb-4">
                        <div>
                            <div className="text-gray-500 text-xs uppercase mb-1">Entity</div>
                            <div className="text-white">{finding.entity_name || 'N/A'}</div>
                        </div>
                        <div>
                            <div className="text-gray-500 text-xs uppercase mb-1">Type</div>
                            <div className="text-white capitalize">{finding.finding_type.replace(/_/g, ' ')}</div>
                        </div>
                    </div>

                    <div className="mb-6">
                        <div className="text-gray-500 text-xs uppercase mb-2">Recommended Action</div>
                        <div className="bg-gray-800/50 rounded-lg p-3 text-sm text-gray-300">
                            {finding.recommended_action || 'Review transaction details.'}
                        </div>
                    </div>

                    <div className="flex justify-end gap-3">
                        {finding.status !== 'resolved' && (
                            <button
                                onClick={() => handleStatusChange('resolved')}
                                disabled={loading}
                                className="bg-emerald-600 hover:bg-emerald-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Mark Resolved
                            </button>
                        )}
                        {finding.status !== 'ignored' && (
                            <button
                                onClick={() => handleStatusChange('ignored')}
                                disabled={loading}
                                className="bg-gray-800 hover:bg-gray-700 text-gray-300 px-4 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Ignore
                            </button>
                        )}
                        {finding.status === 'new' && (
                            <button
                                onClick={() => handleStatusChange('investigating')}
                                disabled={loading}
                                className="bg-blue-600 hover:bg-blue-500 text-white px-4 py-2 rounded-lg text-sm font-medium transition"
                            >
                                Investigate
                            </button>
                        )}
                    </div>
                </div>
            )}

            <button
                onClick={() => setExpanded(!expanded)}
                className="w-full text-center text-gray-600 hover:text-gray-400 text-xs uppercase tracking-wider mt-2 transition"
            >
                {expanded ? 'Show Less' : 'Show Details'}
            </button>
        </div>
    );
}
