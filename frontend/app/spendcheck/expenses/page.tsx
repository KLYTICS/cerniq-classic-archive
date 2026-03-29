'use client';

import { Suspense, useState, useEffect, useCallback } from 'react';
import Image, { type ImageLoaderProps } from 'next/image';
import Link from 'next/link';
import { useSearchParams } from 'next/navigation';

interface Expense {
    id: string;
    merchantName: string;
    amount: number;
    currency: string;
    category?: string;
    description?: string;
    transactionDate: string;
    receiptUrl?: string;
    status: 'DRAFT' | 'SUBMITTED' | 'APPROVED' | 'REJECTED' | 'REIMBURSED';
    aiExtracted: boolean;
    aiConfidence?: number;
    createdAt: string;
    user: { id: string; name?: string; email: string; avatarUrl?: string };
}

const API_URL = (
    process.env.NEXT_PUBLIC_NODE_API_URL ||
    process.env.NEXT_PUBLIC_API_URL ||
    ''
).trim().replace(/\/+$/, '');

const statusConfig: Record<string, { label: string; color: string; bg: string }> = {
    DRAFT: { label: 'Draft', color: 'text-gray-400', bg: 'bg-gray-500/20 border-gray-500/30' },
    SUBMITTED: { label: 'Pending', color: 'text-yellow-400', bg: 'bg-yellow-500/20 border-yellow-500/30' },
    APPROVED: { label: 'Approved', color: 'text-emerald-400', bg: 'bg-emerald-500/20 border-emerald-500/30' },
    REJECTED: { label: 'Rejected', color: 'text-red-400', bg: 'bg-red-500/20 border-red-500/30' },
    REIMBURSED: { label: 'Reimbursed', color: 'text-cyan-400', bg: 'bg-cyan-500/20 border-cyan-500/30' },
};

const categoryIcons: Record<string, string> = {
    'Meals & Entertainment': '🍽️',
    'Transportation': '🚗',
    'Office Supplies': '📎',
    'Software & Subscriptions': '💻',
    'Travel & Lodging': '✈️',
    'Marketing & Advertising': '📣',
    'Professional Services': '💼',
    'Equipment': '🖥️',
    'Utilities': '⚡',
    'Other': '📋',
};

function passthroughImageLoader({ src }: ImageLoaderProps): string {
    return src;
}

function ExpensesListContent() {
    const searchParams = useSearchParams();
    const orgId = searchParams.get('org') || 'default-org';

    const [expenses, setExpenses] = useState<Expense[]>([]);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState<string>('all');
    const [selectedExpense, setSelectedExpense] = useState<Expense | null>(null);
    const [actionLoading, setActionLoading] = useState<string | null>(null);

    const fetchExpenses = useCallback(async () => {
        setLoading(true);
        try {
            const statusParam = activeTab !== 'all' ? `?status=${activeTab}` : '';
            const res = await fetch(`${API_URL}/api/expenses${statusParam}`, {
                headers: {
                    'x-organization-id': orgId,
                    'x-user-id': localStorage.getItem('userId') || 'demo-user',
                },
            });
            const data = await res.json();
            setExpenses(Array.isArray(data) ? data : []);
        } catch (err) {
            console.error('Failed to load expenses:', err);
        } finally {
            setLoading(false);
        }
    }, [activeTab, orgId]);

    useEffect(() => {
        fetchExpenses();
    }, [fetchExpenses]);

    async function performAction(expenseId: string, action: 'submit' | 'approve' | 'reject') {
        setActionLoading(expenseId);
        try {
            await fetch(`${API_URL}/api/expenses/${expenseId}/${action}`, {
                method: 'POST',
                headers: {
                    'x-organization-id': orgId,
                    'x-user-id': localStorage.getItem('userId') || 'demo-user',
                },
            });
            fetchExpenses();
        } catch (err) {
            console.error(`Failed to ${action}:`, err);
        } finally {
            setActionLoading(null);
        }
    }

    async function deleteExpense(expenseId: string) {
        if (!confirm('Delete this expense?')) return;
        try {
            await fetch(`${API_URL}/api/expenses/${expenseId}`, {
                method: 'DELETE',
                headers: {
                    'x-organization-id': orgId,
                    'x-user-id': localStorage.getItem('userId') || 'demo-user',
                },
            });
            fetchExpenses();
            if (selectedExpense?.id === expenseId) setSelectedExpense(null);
        } catch (err) {
            console.error('Failed to delete:', err);
        }
    }

    const formatCurrency = (amount: number, currency: string = 'USD') =>
        new Intl.NumberFormat('en-US', { style: 'currency', currency }).format(amount);

    const formatDate = (date: string) =>
        new Date(date).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

    const tabs = [
        { key: 'all', label: 'All', count: expenses.length },
        { key: 'DRAFT', label: 'Drafts' },
        { key: 'SUBMITTED', label: 'Pending' },
        { key: 'APPROVED', label: 'Approved' },
        { key: 'REJECTED', label: 'Rejected' },
        { key: 'REIMBURSED', label: 'Reimbursed' },
    ];

    const totalAmount = expenses.reduce((sum, e) => sum + Number(e.amount), 0);

    return (
        <div className="min-h-screen bg-gray-950 text-white">
            {/* Header */}
            <div className="border-b border-gray-800 bg-gray-900/50 backdrop-blur-sm">
                <div className="max-w-7xl mx-auto px-6 py-4 flex items-center justify-between">
                    <div className="flex items-center gap-4">
                        <Link href="/spendcheck" className="text-gray-400 hover:text-white transition">← Back</Link>
                        <h1 className="text-2xl font-bold bg-gradient-to-r from-emerald-400 to-cyan-400 bg-clip-text text-transparent">
                            Expenses
                        </h1>
                    </div>
                    <div className="flex items-center gap-4">
                        <div className="text-right">
                            <p className="text-xs text-gray-500">Total</p>
                            <p className="text-lg font-bold text-emerald-400">{formatCurrency(totalAmount)}</p>
                        </div>
                        <Link
                            href="/expenses/new"
                            className="bg-emerald-600 hover:bg-emerald-500 px-4 py-2 rounded-lg font-medium transition flex items-center gap-2"
                        >
                            <span>+</span> New Expense
                        </Link>
                    </div>
                </div>
            </div>

            {/* Tabs */}
            <div className="border-b border-gray-800">
                <div className="max-w-7xl mx-auto px-6">
                    <div className="flex gap-1 overflow-x-auto">
                        {tabs.map(tab => (
                            <button
                                key={tab.key}
                                onClick={() => setActiveTab(tab.key)}
                                className={`px-4 py-3 text-sm font-medium border-b-2 transition whitespace-nowrap ${activeTab === tab.key
                                        ? 'border-emerald-500 text-white'
                                        : 'border-transparent text-gray-500 hover:text-gray-300'
                                    }`}
                            >
                                {tab.label}
                            </button>
                        ))}
                    </div>
                </div>
            </div>

            {/* Content */}
            <div className="max-w-7xl mx-auto px-6 py-6">
                {loading ? (
                    <div className="flex items-center justify-center py-20">
                        <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
                    </div>
                ) : expenses.length === 0 ? (
                    <div className="text-center py-20">
                        <div className="text-5xl mb-4">📋</div>
                        <h2 className="text-xl font-bold mb-2">No Expenses Found</h2>
                        <p className="text-gray-400 mb-6">Upload a receipt or create an expense manually.</p>
                        <Link
                            href="/expenses/new"
                            className="inline-block bg-emerald-600 hover:bg-emerald-500 px-6 py-3 rounded-lg font-medium transition"
                        >
                            Add Expense
                        </Link>
                    </div>
                ) : (
                    <div className="flex gap-6">
                        {/* Expense List */}
                        <div className={`flex-1 space-y-2 ${selectedExpense ? 'max-w-2xl' : ''}`}>
                            {expenses.map(expense => {
                                const status = statusConfig[expense.status];
                                return (
                                    <div
                                        key={expense.id}
                                        onClick={() => setSelectedExpense(expense)}
                                        className={`bg-gray-900/50 border rounded-xl p-4 cursor-pointer transition hover:border-gray-600 ${selectedExpense?.id === expense.id ? 'border-emerald-500/50 bg-emerald-500/5' : 'border-gray-800'
                                            }`}
                                    >
                                        <div className="flex items-center justify-between">
                                            <div className="flex items-center gap-3">
                                                <span className="text-2xl">{categoryIcons[expense.category || 'Other'] || '📋'}</span>
                                                <div>
                                                    <h3 className="font-semibold">{expense.merchantName}</h3>
                                                    <div className="flex items-center gap-2 text-sm text-gray-400">
                                                        <span>{formatDate(expense.transactionDate)}</span>
                                                        {expense.category && (
                                                            <>
                                                                <span>·</span>
                                                                <span>{expense.category}</span>
                                                            </>
                                                        )}
                                                        {expense.aiExtracted && (
                                                            <>
                                                                <span>·</span>
                                                                <span className="text-purple-400">🤖 AI</span>
                                                            </>
                                                        )}
                                                    </div>
                                                </div>
                                            </div>
                                            <div className="text-right">
                                                <p className="font-bold text-lg">{formatCurrency(Number(expense.amount), expense.currency)}</p>
                                                <span className={`text-xs px-2 py-0.5 rounded border ${status.bg} ${status.color}`}>
                                                    {status.label}
                                                </span>
                                            </div>
                                        </div>

                                        {/* Quick Actions */}
                                        <div className="flex items-center justify-between mt-3 pt-3 border-t border-gray-800/50">
                                            <div className="flex items-center gap-2">
                                                <div className="w-6 h-6 rounded-full bg-gradient-to-br from-emerald-500 to-cyan-500 flex items-center justify-center text-xs font-bold">
                                                    {(expense.user.name || expense.user.email)[0].toUpperCase()}
                                                </div>
                                                <span className="text-xs text-gray-500">{expense.user.name || expense.user.email}</span>
                                            </div>
                                            <div className="flex gap-2" onClick={e => e.stopPropagation()}>
                                                {expense.status === 'DRAFT' && (
                                                    <button
                                                        onClick={() => performAction(expense.id, 'submit')}
                                                        disabled={actionLoading === expense.id}
                                                        className="text-xs bg-yellow-600/20 text-yellow-400 hover:bg-yellow-600/30 px-3 py-1 rounded-lg transition"
                                                    >
                                                        Submit
                                                    </button>
                                                )}
                                                {expense.status === 'SUBMITTED' && (
                                                    <>
                                                        <button
                                                            onClick={() => performAction(expense.id, 'approve')}
                                                            disabled={actionLoading === expense.id}
                                                            className="text-xs bg-emerald-600/20 text-emerald-400 hover:bg-emerald-600/30 px-3 py-1 rounded-lg transition"
                                                        >
                                                            Approve
                                                        </button>
                                                        <button
                                                            onClick={() => performAction(expense.id, 'reject')}
                                                            disabled={actionLoading === expense.id}
                                                            className="text-xs bg-red-600/20 text-red-400 hover:bg-red-600/30 px-3 py-1 rounded-lg transition"
                                                        >
                                                            Reject
                                                        </button>
                                                    </>
                                                )}
                                                <button
                                                    onClick={() => deleteExpense(expense.id)}
                                                    className="text-xs text-gray-600 hover:text-red-400 px-2 py-1 transition"
                                                >
                                                    🗑
                                                </button>
                                            </div>
                                        </div>
                                    </div>
                                );
                            })}
                        </div>

                        {/* Detail Panel */}
                        {selectedExpense && (
                            <div className="w-96 sticky top-6 self-start">
                                <div className="bg-gray-900/50 border border-gray-800 rounded-xl overflow-hidden">
                                    {/* Receipt Image */}
                                    {selectedExpense.receiptUrl ? (
                                        <div className="relative h-52 bg-gray-800 flex items-center justify-center overflow-hidden">
                                            <Image
                                                src={selectedExpense.receiptUrl}
                                                alt="Receipt"
                                                fill
                                                unoptimized
                                                loader={passthroughImageLoader}
                                                className="object-contain"
                                                sizes="384px"
                                            />
                                        </div>
                                    ) : (
                                        <div className="h-32 bg-gray-800 flex items-center justify-center text-gray-600 text-sm">
                                            No receipt attached
                                        </div>
                                    )}

                                    {/* Details */}
                                    <div className="p-5 space-y-4">
                                        <div className="flex items-center justify-between">
                                            <h3 className="text-lg font-bold">{selectedExpense.merchantName}</h3>
                                            <button onClick={() => setSelectedExpense(null)} className="text-gray-500 hover:text-white transition">✕</button>
                                        </div>

                                        <div className="text-3xl font-bold text-emerald-400">
                                            {formatCurrency(Number(selectedExpense.amount), selectedExpense.currency)}
                                        </div>

                                        <div className="grid grid-cols-2 gap-3 text-sm">
                                            <div>
                                                <p className="text-gray-500 mb-1">Date</p>
                                                <p>{formatDate(selectedExpense.transactionDate)}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 mb-1">Category</p>
                                                <p>{categoryIcons[selectedExpense.category || 'Other']} {selectedExpense.category || 'Uncategorized'}</p>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 mb-1">Status</p>
                                                <span className={`text-xs px-2 py-0.5 rounded border ${statusConfig[selectedExpense.status].bg} ${statusConfig[selectedExpense.status].color}`}>
                                                    {statusConfig[selectedExpense.status].label}
                                                </span>
                                            </div>
                                            <div>
                                                <p className="text-gray-500 mb-1">Submitted by</p>
                                                <p className="text-sm">{selectedExpense.user.name || selectedExpense.user.email}</p>
                                            </div>
                                        </div>

                                        {selectedExpense.description && (
                                            <div>
                                                <p className="text-gray-500 text-sm mb-1">Description</p>
                                                <p className="text-sm">{selectedExpense.description}</p>
                                            </div>
                                        )}

                                        {selectedExpense.aiExtracted && (
                                            <div className="bg-purple-500/10 border border-purple-500/20 rounded-lg p-3">
                                                <div className="flex items-center gap-2 mb-1">
                                                    <span>🤖</span>
                                                    <span className="text-xs font-medium text-purple-400">AI Extracted</span>
                                                </div>
                                                <p className="text-xs text-gray-400">
                                                    Confidence: {((selectedExpense.aiConfidence || 0) * 100).toFixed(0)}%
                                                </p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            </div>
                        )}
                    </div>
                )}
            </div>
        </div>
    );
}

export default function ExpensesListPage() {
    return (
        <Suspense
            fallback={
                <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                    <div className="animate-spin rounded-full h-8 w-8 border-t-2 border-b-2 border-emerald-500" />
                </div>
            }
        >
            <ExpensesListContent />
        </Suspense>
    );
}
