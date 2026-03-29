'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface AnalyticsSummary {
    totalSpend: number;
    totalExpenses: number;
    avgExpenseAmount: number;
    approvalRate: number;
    topCategory: string;
    monthOverMonthChange: number;
}

interface SpendingTrend {
    period: string;
    totalAmount: number;
    expenseCount: number;
    avgAmount: number;
}

interface CategoryBreakdown {
    category: string;
    totalAmount: number;
    expenseCount: number;
    percentage: number;
}

interface TeamMemberSpend {
    userId: string;
    userName: string;
    userEmail: string;
    totalAmount: number;
    expenseCount: number;
    approvedCount: number;
    rejectedCount: number;
}

const API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
).trim().replace(/\/+$/, '');

const categoryColors: Record<string, string> = {
    'Meals & Entertainment': '#f59e0b',
    'Transportation': '#3b82f6',
    'Office Supplies': '#8b5cf6',
    'Software & Subscriptions': '#06b6d4',
    'Travel & Lodging': '#ec4899',
    'Marketing & Advertising': '#f97316',
    'Professional Services': '#14b8a6',
    'Equipment': '#6366f1',
    'Utilities': '#84cc16',
    'Other': '#6b7280',
};

function AnalyticsDashboardContent() {
    const searchParams = useSearchParams();
    const orgId = searchParams.get('org') || 'default-org';

    const [summary, setSummary] = useState<AnalyticsSummary | null>(null);
    const [trends, setTrends] = useState<SpendingTrend[]>([]);
    const [categories, setCategories] = useState<CategoryBreakdown[]>([]);
    const [team, setTeam] = useState<TeamMemberSpend[]>([]);
    const [dateRange, setDateRange] = useState('12m');
    const [loading, setLoading] = useState(true);

    const fetchAll = useCallback(async () => {
        setLoading(true);
        const headers: Record<string, string> = {
            'x-organization-id': orgId,
            'x-user-id': localStorage.getItem('userId') || 'demo-user',
        };
        const end = new Date();
        const start = new Date();
        switch (dateRange) {
            case '1m': start.setMonth(start.getMonth() - 1); break;
            case '3m': start.setMonth(start.getMonth() - 3); break;
            case '6m': start.setMonth(start.getMonth() - 6); break;
            case '12m': start.setFullYear(start.getFullYear() - 1); break;
        }
        const range = { startDate: start.toISOString(), endDate: end.toISOString() };

        try {
            const [summaryRes, trendsRes, catsRes, teamRes] = await Promise.all([
                fetch(`${API_URL}/api/analytics/summary`, { headers }),
                fetch(`${API_URL}/api/analytics/trends?startDate=${range.startDate}&endDate=${range.endDate}`, { headers }),
                fetch(`${API_URL}/api/analytics/categories?startDate=${range.startDate}&endDate=${range.endDate}`, { headers }),
                fetch(`${API_URL}/api/analytics/team?startDate=${range.startDate}&endDate=${range.endDate}`, { headers }),
            ]);

            setSummary(await summaryRes.json());
            setTrends(await trendsRes.json());
            setCategories(await catsRes.json());
            setTeam(await teamRes.json());
        } catch (err) {
            console.error('Failed to load analytics:', err);
        } finally {
            setLoading(false);
        }
    }, [dateRange, orgId]);

    useEffect(() => {
        fetchAll();
    }, [fetchAll]);

    const formatCurrency = (amount: number) =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency: 'USD', minimumFractionDigits: 0 }).format(amount);

    const exportRange = (() => {
        const end = new Date();
        const start = new Date();
        switch (dateRange) {
            case '1m': start.setMonth(start.getMonth() - 1); break;
            case '3m': start.setMonth(start.getMonth() - 3); break;
            case '6m': start.setMonth(start.getMonth() - 6); break;
            case '12m': start.setFullYear(start.getFullYear() - 1); break;
        }
        return { startDate: start.toISOString(), endDate: end.toISOString() };
    })();

    const maxTrend = Math.max(...trends.map(t => t.totalAmount), 1);
    const maxTeamSpend = Math.max(...team.map(t => t.totalAmount), 1);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/spendcheck" className="text-gray-400 hover:text-white transition">← Back</Link>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Analytics
                        </h1>
                    </div>
                    <div className="flex items-center gap-2">
                        {['1m', '3m', '6m', '12m'].map(r => (
                            <button
                                key={r}
                                onClick={() => setDateRange(r)}
                                className={`px-3 py-1.5 text-sm rounded-lg transition ${dateRange === r
                                        ? 'bg-emerald-600 text-white'
                                        : 'bg-gray-800 text-gray-400 hover:text-white'
                                    }`}
                            >
                                {r}
                            </button>
                        ))}
                        <a
                            href={`${API_URL}/api/analytics/export?format=csv&startDate=${exportRange.startDate}&endDate=${exportRange.endDate}`}
                            className="bg-gray-800 hover:bg-gray-700 px-3 py-1.5 text-sm rounded-lg transition ml-2"
                        >
                            📥 Export CSV
                        </a>
                    </div>
                </div>
            </div>

            {loading ? (
                <div className="flex items-center justify-center py-20">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
                </div>
            ) : (
                <div className="max-w-7xl mx-auto px-6 py-8 space-y-8">
                    {/* Summary Cards */}
                    {summary && (
                        <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-6 gap-4">
                            <SummaryCard title="Total Spend" value={formatCurrency(summary.totalSpend)} icon="💰" />
                            <SummaryCard title="Expenses" value={String(summary.totalExpenses)} icon="📋" />
                            <SummaryCard title="Avg Expense" value={formatCurrency(summary.avgExpenseAmount)} icon="📊" />
                            <SummaryCard title="Approval Rate" value={`${summary.approvalRate.toFixed(0)}%`} icon="✅" />
                            <SummaryCard title="Top Category" value={summary.topCategory} icon="🏷️" />
                            <SummaryCard
                                title="MoM Change"
                                value={`${summary.monthOverMonthChange > 0 ? '+' : ''}${summary.monthOverMonthChange}%`}
                                icon={summary.monthOverMonthChange > 0 ? '📈' : '📉'}
                                highlight={summary.monthOverMonthChange > 0 ? 'red' : 'green'}
                            />
                        </div>
                    )}

                    {/* Spending Trends Chart */}
                    <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                        <h3 className="text-lg font-semibold mb-6">Spending Trends</h3>
                        {trends.length > 0 ? (
                            <div className="space-y-2">
                                {trends.map(t => (
                                    <div key={t.period} className="flex items-center gap-4">
                                        <span className="text-sm text-gray-400 w-20 font-mono">{t.period}</span>
                                        <div className="flex-1 h-8 bg-gray-800 rounded overflow-hidden relative">
                                            <div
                                                className="h-full bg-gradient-to-r from-emerald-500 to-cyan-500 rounded transition-all"
                                                style={{ width: `${(t.totalAmount / maxTrend) * 100}%` }}
                                            />
                                            <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-medium">
                                                {formatCurrency(t.totalAmount)}
                                            </span>
                                        </div>
                                        <span className="text-xs text-gray-500 w-16 text-right">{t.expenseCount} txns</span>
                                    </div>
                                ))}
                            </div>
                        ) : (
                            <p className="text-gray-500 text-center py-8">No data for selected period</p>
                        )}
                    </div>

                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
                        {/* Category Breakdown */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">By Category</h3>
                            {categories.length > 0 ? (
                                <div className="space-y-3">
                                    {categories.map(cat => (
                                        <div key={cat.category}>
                                            <div className="flex items-center justify-between mb-1">
                                                <span className="text-sm font-medium">{cat.category}</span>
                                                <div className="flex items-center gap-2">
                                                    <span className="text-sm text-emerald-400">{formatCurrency(cat.totalAmount)}</span>
                                                    <span className="text-xs text-gray-500">({cat.percentage}%)</span>
                                                </div>
                                            </div>
                                            <div className="h-2 bg-gray-800 rounded-full overflow-hidden">
                                                <div
                                                    className="h-full rounded-full transition-all"
                                                    style={{
                                                        width: `${cat.percentage}%`,
                                                        backgroundColor: categoryColors[cat.category] || '#6b7280',
                                                    }}
                                                />
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No categories to display</p>
                            )}
                        </div>

                        {/* Team Comparison */}
                        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-6">
                            <h3 className="text-lg font-semibold mb-6">By Team Member</h3>
                            {team.length > 0 ? (
                                <div className="space-y-4">
                                    {team.map((member) => (
                                        <div key={member.userId} className="flex items-center gap-4">
                                            <div className="w-8 h-8 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-sm font-bold shrink-0">
                                                {(member.userName || member.userEmail)[0].toUpperCase()}
                                            </div>
                                            <div className="flex-1 min-w-0">
                                                <div className="flex items-center justify-between mb-1">
                                                    <span className="text-sm font-medium truncate">{member.userName || member.userEmail}</span>
                                                    <span className="text-sm text-emerald-400 ml-2">{formatCurrency(member.totalAmount)}</span>
                                                </div>
                                                <div className="h-1.5 bg-gray-800 rounded-full overflow-hidden">
                                                    <div
                                                        className="h-full bg-emerald-500 rounded-full transition-all"
                                                        style={{ width: `${(member.totalAmount / maxTeamSpend) * 100}%` }}
                                                    />
                                                </div>
                                                <div className="flex gap-3 mt-1 text-xs text-gray-500">
                                                    <span>{member.expenseCount} expenses</span>
                                                    <span className="text-emerald-500">{member.approvedCount} approved</span>
                                                    {member.rejectedCount > 0 && (
                                                        <span className="text-red-500">{member.rejectedCount} rejected</span>
                                                    )}
                                                </div>
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            ) : (
                                <p className="text-gray-500 text-center py-8">No team data to display</p>
                            )}
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}

export default function AnalyticsDashboard() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
                </div>
            }
        >
            <AnalyticsDashboardContent />
        </Suspense>
    );
}

function SummaryCard({ title, value, icon, highlight }: {
    title: string;
    value: string;
    icon: string;
    highlight?: 'green' | 'red';
}) {
    return (
        <div className="bg-gray-900/50 border border-gray-800 rounded-xl p-4">
            <div className="flex items-center gap-2 mb-1">
                <span>{icon}</span>
                <span className="text-xs text-gray-500">{title}</span>
            </div>
            <p className={`text-lg font-bold ${highlight === 'green' ? 'text-emerald-400' :
                    highlight === 'red' ? 'text-red-400' : ''
                }`}>
                {value}
            </p>
        </div>
    );
}
