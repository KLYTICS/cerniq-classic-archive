'use client';

import { useState, useEffect } from 'react';
import { motion } from 'framer-motion';
import { apiClient } from '@/lib/api';

interface CorrelationData {
    tickers: string[];
    matrix: number[][];
    computedAt: Date;
}

interface CorrelationHeatmapProps {
    tickers: string[];
}

export function CorrelationHeatmap({ tickers }: CorrelationHeatmapProps) {
    const [data, setData] = useState<CorrelationData | null>(null);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [hoveredCell, setHoveredCell] = useState<{ row: number; col: number } | null>(null);

    useEffect(() => {
        if (!tickers || tickers.length < 2) return;

        const fetchCorrelation = async () => {
            setLoading(true);
            setError(null);

            try {
                let result;
                try {
                    result = await apiClient.getNodeCorrelation(tickers);
                } catch {
                    result = await apiClient.calculateCorrelation(tickers);
                }
                if (!result) throw new Error('Failed to calculate correlation');
                setData(result);
            } catch (err: unknown) {
                setError(err instanceof Error ? err.message : 'Failed to fetch data');
            } finally {
                setLoading(false);
            }
        };

        fetchCorrelation();
    }, [tickers]);

    if (loading) {
        return (
            <div className="cerniq-panel p-6">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 w-1/3 rounded bg-slate-100"></div>
                    <div className="h-64 rounded bg-slate-100"></div>
                </div>
            </div>
        );
    }

    if (error) {
        return (
            <div className="rounded-xl border border-rose-200 bg-rose-50 p-6">
                <p className="text-rose-700">Error: {error}</p>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="cerniq-panel p-6">
                <p className="text-slate-500">Add at least 2 tickers to see the correlation matrix.</p>
            </div>
        );
    }

    // Get color for correlation value
    const getColor = (value: number) => {
        // Scale from -1 (blue) to +1 (red), with 0 as white
        if (value > 0) {
            // Positive correlation: white to red
            const intensity = Math.round(value * 255);
            return `rgb(${Math.min(255, 200 + intensity)}, ${Math.max(0, 200 - intensity)}, ${Math.max(0, 200 - intensity)})`;
        } else {
            // Negative correlation: white to blue
            const intensity = Math.round(Math.abs(value) * 255);
            return `rgb(${Math.max(0, 200 - intensity)}, ${Math.max(0, 200 - intensity)}, ${Math.min(255, 200 + intensity)})`;
        }
    };

    const cellSize = Math.min(80, 600 / data.tickers.length);

    return (
        <motion.div
            className="cerniq-panel p-6 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header */}
            <div className="mb-6">
                <h3 className="text-xl font-bold text-slate-950 mb-1">Correlation Matrix</h3>
                <p className="text-sm text-slate-500">Pairwise correlation between assets.</p>
            </div>

            {/* Heatmap */}
            <div className="overflow-x-auto pb-4">
                <div className="inline-block min-w-full">
                    <table className="border-collapse">
                        <thead>
                            <tr>
                                <th className="p-2"></th>
                                {data.tickers.map((ticker) => (
                                    <th
                                        key={ticker}
                                        className="p-2 text-xs font-semibold text-slate-600"
                                        style={{ width: cellSize, minWidth: cellSize }}
                                    >
                                        <div className="transform -rotate-45 origin-left">{ticker}</div>
                                    </th>
                                ))}
                            </tr>
                        </thead>
                        <tbody>
                            {data.tickers.map((rowTicker, rowIdx) => (
                                <tr key={rowTicker}>
                                    <td className="p-2 text-xs font-semibold text-slate-600 whitespace-nowrap">
                                        {rowTicker}
                                    </td>
                                    {data.tickers.map((colTicker, colIdx) => {
                                        const value = data.matrix[rowIdx][colIdx];
                                        const isHovered =
                                            hoveredCell?.row === rowIdx && hoveredCell?.col === colIdx;
                                        const isDiagonal = rowIdx === colIdx;

                                        return (
                                            <td
                                                key={colTicker}
                                                className="relative cursor-pointer transition-transform hover:scale-110"
                                                style={{
                                                    width: cellSize,
                                                    height: cellSize,
                                                    minWidth: cellSize,
                                                    minHeight: cellSize,
                                                }}
                                                onMouseEnter={() => setHoveredCell({ row: rowIdx, col: colIdx })}
                                                onMouseLeave={() => setHoveredCell(null)}
                                            >
                                                <div
                                                    className={`w-full h-full flex items-center justify-center text-xs font-semibold rounded ${isDiagonal ? 'border-2 border-white' : ''
                                                        }`}
                                                    style={{
                                                        backgroundColor: getColor(value),
                                                        color: Math.abs(value) > 0.5 ? '#fff' : '#0f172a',
                                                    }}
                                                >
                                                    {value.toFixed(2)}
                                                </div>
                                                {isHovered && (
                                                    <div className="absolute z-10 bottom-full left-1/2 mb-2 -translate-x-1/2 whitespace-nowrap rounded border border-slate-200 bg-white px-3 py-2 shadow-lg">
                                                        <div className="text-xs text-slate-950">
                                                            {rowTicker} ↔ {colTicker}
                                                        </div>
                                                        <div className="text-sm font-bold text-slate-950">
                                                            Correlation: {value.toFixed(4)}
                                                        </div>
                                                        <div className="text-xs text-slate-500">
                                                            {value > 0.7
                                                                ? 'Strong positive'
                                                                : value > 0.3
                                                                    ? 'Moderate positive'
                                                                    : value > -0.3
                                                                        ? 'Weak/no correlation'
                                                                        : value > -0.7
                                                                            ? 'Moderate negative'
                                                                            : 'Strong negative'}
                                                        </div>
                                                    </div>
                                                )}
                                            </td>
                                        );
                                    })}
                                </tr>
                            ))}
                        </tbody>
                    </table>
                </div>
            </div>

            {/* Legend */}
            <div className="mt-6 flex items-center justify-center gap-4">
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: getColor(-1) }}></div>
                    <span className="text-xs text-slate-500">-1.0 (Perfect Negative)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded bg-white"></div>
                    <span className="text-xs text-slate-500">0.0 (No Correlation)</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-6 h-6 rounded" style={{ backgroundColor: getColor(1) }}></div>
                    <span className="text-xs text-slate-500">+1.0 (Perfect Positive)</span>
                </div>
            </div>

            {/* Insights */}
            <div className="mt-6 rounded-lg border border-cyan-200 bg-cyan-50/80 p-4">
                <div className="flex items-start gap-3">
                    <div className="text-cyan-700 text-xl">🔗</div>
                    <div>
                        <h5 className="mb-1 text-sm font-semibold text-cyan-700">Diversification Insights</h5>
                        <p className="text-xs text-slate-700">
                            Negative or low correlations (blue/white) indicate good diversification. High positive correlations
                            (red) suggest positions may move together, increasing portfolio risk.
                        </p>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
