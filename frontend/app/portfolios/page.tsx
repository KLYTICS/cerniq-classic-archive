'use client';

import { useState, useEffect } from 'react';
import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { apiClient } from '@/lib/api';
import { useAuthStore } from '@/lib/store';

interface Portfolio {
    id: string;
    name: string;
    description: string | null;
    currency: string;
    initialCash: number;
    currentCash: number;
    totalValue: number;
    totalPnL: number;
    totalPnLPercent: number;
    positions: Position[];
}

interface Position {
    id: string;
    ticker: string;
    quantity: number;
    avgCost: number;
    currentPrice: number;
    marketValue: number;
    unrealizedPnL: number;
    unrealizedPnLPercent: number;
    weight: number;
}

export default function PortfoliosPage() {
    const router = useRouter();
    const { initialized, isAuthenticated, onboardingComplete, user } = useAuthStore();
    const [portfolios, setPortfolios] = useState<Portfolio[]>([]);
    const [selectedPortfolio, setSelectedPortfolio] = useState<Portfolio | null>(null);
    const [showAddModal, setShowAddModal] = useState(false);
    const [showPositionModal, setShowPositionModal] = useState(false);
    const [loading, setLoading] = useState(true);
    const [newPortfolio, setNewPortfolio] = useState({ name: '', description: '', benchmark: 'SPY' });
    const [newPosition, setNewPosition] = useState({ symbol: '', quantity: '', price: '' });
    useEffect(() => {
        if (!initialized) {
            return;
        }

        if (!isAuthenticated) {
            router.push('/login');
            return;
        }

        if (!onboardingComplete) {
            router.push('/onboarding');
            return;
        }

        if (user?.id) {
            fetchPortfolios(user.id);
        }
    }, [initialized, isAuthenticated, onboardingComplete, user, router]);

    const fetchPortfolios = async (uid: string) => {
        setLoading(true);
        try {
            const data = await apiClient.getPortfolios();
            const nextPortfolios: Portfolio[] = Array.isArray(data) ? data : [];

            setPortfolios(nextPortfolios);
            setSelectedPortfolio((current) => {
                if (nextPortfolios.length === 0) {
                    return null;
                }

                if (!current) {
                    return nextPortfolios[0];
                }

                return nextPortfolios.find((p) => p.id === current.id) || nextPortfolios[0];
            });
        } catch (error) {
            console.error('Failed to fetch portfolios:', error);
        } finally {
            setLoading(false);
        }
    };

    const handleCreatePortfolio = async () => {
        if (!newPortfolio.name || !user?.id) return;

        try {
            await apiClient.createPortfolio(user.id, {
                name: newPortfolio.name,
                description: newPortfolio.description,
                currency: 'USD',
                initial_capital: 100000,
                initialCash: 100000 // Backward-compatible for legacy services
            });
            setShowAddModal(false);
            setNewPortfolio({ name: '', description: '', benchmark: 'SPY' });
            fetchPortfolios(user.id);
        } catch (error) {
            console.error('Failed to create portfolio:', error);
        }
    };

    const handleAddPosition = async () => {
        if (!selectedPortfolio || !user?.id || !newPosition.symbol || !newPosition.quantity || !newPosition.price) return;

        try {
            await apiClient.addPosition(selectedPortfolio.id, user.id, {
                symbol: newPosition.symbol.toUpperCase(),
                ticker: newPosition.symbol.toUpperCase(),
                quantity: Number(newPosition.quantity),
                price: Number(newPosition.price)
            });
            setShowPositionModal(false);
            setNewPosition({ symbol: '', quantity: '', price: '' });
            fetchPortfolios(user.id);
        } catch (error) {
            console.error('Failed to add position:', error);
        }
    };

    const selectPortfolio = (portfolio: Portfolio) => {
        setSelectedPortfolio(portfolio);
    };

    const formatCurrency = (value: number) => {
        return new Intl.NumberFormat('en-US', {
            style: 'currency',
            currency: 'USD',
            minimumFractionDigits: 2,
        }).format(value);
    };

    const formatPercent = (value: number) => {
        const sign = value >= 0 ? '+' : '';
        return `${sign}${value.toFixed(2)}%`;
    };

    if (!initialized || !isAuthenticated || !onboardingComplete) {
        return null;
    }

    if (loading && portfolios.length === 0) {
        return (
            <div className="min-h-screen bg-gray-950 text-white flex items-center justify-center">
                <div className="animate-spin rounded-full h-12 w-12 border-t-2 border-b-2 border-blue-500"></div>
            </div>
        );
    }

    return (
        <div className="min-h-screen bg-gray-950 text-white p-8">
            {/* Header */}
            <div className="flex justify-between items-center mb-8">
                <div>
                    <Link href="/dashboard" className="text-blue-400 hover:text-blue-300 text-sm mb-2 block">
                        ← Back to Dashboard
                    </Link>
                    <h1 className="text-3xl font-bold bg-gradient-to-r from-blue-400 to-purple-400 bg-clip-text text-transparent">
                        Portfolio Manager
                    </h1>
                    <p className="text-gray-400 mt-1">Track your investments and analyze performance</p>
                </div>
                <button
                    onClick={() => setShowAddModal(true)}
                    className="px-6 py-3 bg-gradient-to-r from-blue-500 to-purple-500 rounded-lg hover:opacity-90 transition font-medium"
                >
                    + New Portfolio
                </button>
            </div>

            <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
                {/* Portfolio List */}
                <div className="space-y-4">
                    <h2 className="text-xl font-semibold text-gray-200">Your Portfolios</h2>
                    {portfolios.length === 0 && (
                        <div className="text-gray-500 italic">No portfolios created yet.</div>
                    )}
                    {portfolios.map((portfolio) => (
                        <div
                            key={portfolio.id}
                            onClick={() => selectPortfolio(portfolio)}
                            className={`p-5 rounded-xl cursor-pointer transition-all ${selectedPortfolio?.id === portfolio.id
                                ? 'bg-gradient-to-br from-blue-900/50 to-purple-900/50 border border-blue-500/50'
                                : 'bg-gray-900/50 border border-gray-800 hover:border-gray-600'
                                }`}
                        >
                            <div className="flex justify-between items-start mb-3">
                                <div>
                                    <h3 className="font-semibold text-lg">{portfolio.name}</h3>
                                    <p className="text-gray-400 text-sm">{portfolio.description || 'No description'}</p>
                                </div>
                                <span className="text-xs bg-gray-800 px-2 py-1 rounded">
                                    {portfolio.currency}
                                </span>
                            </div>
                            <div className="flex justify-between items-end">
                                <div>
                                    <p className="text-2xl font-bold">{formatCurrency(portfolio.totalValue)}</p>
                                    <p className="text-sm text-gray-400">{portfolio.positions.length} positions</p>
                                </div>
                                <div className="text-right">
                                    <p className={`text-lg font-semibold ${portfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatCurrency(portfolio.totalPnL)}
                                    </p>
                                    <p className={`text-sm ${portfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                        {formatPercent(portfolio.totalPnLPercent)}
                                    </p>
                                </div>
                            </div>
                        </div>
                    ))}
                </div>

                {/* Positions Table */}
                <div className="lg:col-span-2">
                    {selectedPortfolio ? (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 overflow-hidden">
                            <div className="p-5 border-b border-gray-800 flex justify-between items-center">
                                <div>
                                    <h2 className="text-xl font-semibold">{selectedPortfolio.name} Positions</h2>
                                    <p className="text-gray-400 text-sm">
                                        Cash: {formatCurrency(selectedPortfolio.currentCash)}
                                    </p>
                                </div>
                                <button
                                    onClick={() => setShowPositionModal(true)}
                                    className="px-4 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition text-sm"
                                >
                                    + Add Position
                                </button>
                            </div>

                            <div className="overflow-x-auto">
                                <table className="w-full">
                                    <thead className="bg-gray-800/50">
                                        <tr>
                                            <th className="text-left p-4 text-gray-400 font-medium">Symbol</th>
                                            <th className="text-right p-4 text-gray-400 font-medium">Quantity</th>
                                            <th className="text-right p-4 text-gray-400 font-medium">Avg Cost</th>
                                            <th className="text-right p-4 text-gray-400 font-medium">Price</th>
                                            <th className="text-right p-4 text-gray-400 font-medium">Value</th>
                                            <th className="text-right p-4 text-gray-400 font-medium">P&L</th>
                                            <th className="text-right p-4 text-gray-400 font-medium">%</th>
                                        </tr>
                                    </thead>
                                    <tbody>
                                        {selectedPortfolio.positions.length === 0 ? (
                                            <tr>
                                                <td colSpan={7} className="p-8 text-center text-gray-500">
                                                    No positions yet. click "+ Add Position" to start trading.
                                                </td>
                                            </tr>
                                        ) : (
                                            selectedPortfolio.positions.map((position) => (
                                                <tr key={position.id} className="border-t border-gray-800 hover:bg-gray-800/30 transition">
                                                    <td className="p-4">
                                                        <span className="font-semibold text-blue-400">{position.ticker}</span>
                                                    </td>
                                                    <td className="p-4 text-right">{position.quantity}</td>
                                                    <td className="p-4 text-right text-gray-400">{formatCurrency(position.avgCost)}</td>
                                                    <td className="p-4 text-right">{formatCurrency(position.currentPrice)}</td>
                                                    <td className="p-4 text-right font-medium">{formatCurrency(position.marketValue)}</td>
                                                    <td className={`p-4 text-right font-medium ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {formatCurrency(position.unrealizedPnL)}
                                                    </td>
                                                    <td className={`p-4 text-right ${position.unrealizedPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                        {formatPercent(position.unrealizedPnLPercent)}
                                                    </td>
                                                </tr>
                                            ))
                                        )}
                                    </tbody>
                                    <tfoot className="bg-gray-800/50 font-semibold">
                                        <tr>
                                            <td className="p-4">Total Value</td>
                                            <td className="p-4" colSpan={3}></td>
                                            <td className="p-4 text-right">{formatCurrency(selectedPortfolio.totalValue)}</td>
                                            <td className={`p-4 text-right ${selectedPortfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatCurrency(selectedPortfolio.totalPnL)}
                                            </td>
                                            <td className={`p-4 text-right ${selectedPortfolio.totalPnL >= 0 ? 'text-green-400' : 'text-red-400'}`}>
                                                {formatPercent(selectedPortfolio.totalPnLPercent)}
                                            </td>
                                        </tr>
                                    </tfoot>
                                </table>
                            </div>
                        </div>
                    ) : (
                        <div className="bg-gray-900/50 rounded-xl border border-gray-800 p-12 text-center">
                            <div className="text-6xl mb-4">💼</div>
                            <h3 className="text-xl font-semibold mb-2">Select a Portfolio</h3>
                            <p className="text-gray-400">Click on a portfolio to view its positions and performance</p>
                        </div>
                    )}
                </div>
            </div>

            {/* Add Portfolio Modal */}
            {showAddModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-semibold mb-4">Create New Portfolio</h3>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Portfolio Name"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                                value={newPortfolio.name}
                                onChange={(e) => setNewPortfolio({ ...newPortfolio, name: e.target.value })}
                            />
                            <input
                                type="text"
                                placeholder="Description (optional)"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                                value={newPortfolio.description}
                                onChange={(e) => setNewPortfolio({ ...newPortfolio, description: e.target.value })}
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowAddModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleCreatePortfolio}
                                className="flex-1 px-4 py-3 bg-blue-600 rounded-lg hover:bg-blue-500 transition"
                            >
                                Create
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Add Position Modal */}
            {showPositionModal && (
                <div className="fixed inset-0 bg-black/70 flex items-center justify-center z-50">
                    <div className="bg-gray-900 rounded-xl p-6 w-full max-w-md border border-gray-700">
                        <h3 className="text-xl font-semibold mb-4">Add Position</h3>
                        <div className="space-y-4">
                            <input
                                type="text"
                                placeholder="Ticker Symbol (e.g., AAPL)"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none uppercase"
                                value={newPosition.symbol}
                                onChange={(e) => setNewPosition({ ...newPosition, symbol: e.target.value.toUpperCase() })}
                            />
                            <input
                                type="number"
                                placeholder="Quantity"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                                value={newPosition.quantity}
                                onChange={(e) => setNewPosition({ ...newPosition, quantity: e.target.value })}
                            />
                            <input
                                type="number"
                                step="0.01"
                                placeholder="Price per share"
                                className="w-full p-3 bg-gray-800 border border-gray-700 rounded-lg focus:border-blue-500 focus:outline-none"
                                value={newPosition.price}
                                onChange={(e) => setNewPosition({ ...newPosition, price: e.target.value })}
                            />
                        </div>
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => setShowPositionModal(false)}
                                className="flex-1 px-4 py-3 bg-gray-700 rounded-lg hover:bg-gray-600 transition"
                            >
                                Cancel
                            </button>
                            <button
                                onClick={handleAddPosition}
                                className="flex-1 px-4 py-3 bg-green-600 rounded-lg hover:bg-green-500 transition"
                            >
                                Buy
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div>
    );
}
