'use client';

import { useState, useEffect } from 'react';
import dynamic from 'next/dynamic';
import { motion } from 'framer-motion';

// Dynamic import of Plotly to avoid SSR issues
const Plot = dynamic(() => import('react-plotly.js'), { ssr: false });

interface VolatilitySurface {
    ticker: string;
    strikes: number[];
    maturities: number[];
    ivMatrix: number[][];
    underlyingPrice: number;
    timestamp: Date;
}

export function VolatilitySurface3D() {
    const [ticker, setTicker] = useState('AAPL');
    const [data, setData] = useState<VolatilitySurface | null>(null);
    const [loading, setLoading] = useState(false);
    const [surfaceType, setSurfaceType] = useState<'iv' | 'vega'>('iv');

    const fetchSurface = async () => {
        setLoading(true);
        try {
            const response = await fetch(`http://localhost:3000/api/risk/volatility/heatmap/${ticker}`);
            const result = await response.json();
            setData(result);
        } catch (err) {
            console.error('Failed to fetch volatility surface:', err);
        } finally {
            setLoading(false);
        };
    };

    useEffect(() => {
        fetchSurface();
    }, [ticker]);

    if (!data) {
        return (
            <div className="flex items-center justify-center h-96">
                <div className="text-slate-400">Loading 3D volatility surface...</div>
            </div>
        );
    }

    // Prepare data for Plotly 3D surface
    const plotData: any[] = [{
        type: 'surface',
        x: data.strikes,
        y: data.maturities,
        z: surfaceType === 'iv' ? data.ivMatrix : data.ivMatrix.map(row => row.map(iv => iv * 0.5)), // Mock vega
        colorscale: 'Viridis',
        colorbar: {
            title: surfaceType === 'iv' ? 'Implied Volatility' : 'Vega',
            titleside: 'right',
            titlefont: { color: '#e2e8f0' },
            tickfont: { color: '#cbd5e1' },
        },
        contours: {
            z: {
                show: true,
                usecolormap: true,
                project: { z: true },
            },
        },
        hovertemplate:
            '<b>Strike:</b> $%{x}<br>' +
            '<b>Days to Expiry:</b> %{y}<br>' +
            '<b>' + (surfaceType === 'iv' ? 'IV' : 'Vega') + ':</b> %{z:.2%}<br>' +
            '<extra></extra>',
    }];

    const layout = {
        title: {
            text: `${data.ticker} Volatility Surface`,
            font: { color: '#f1f5f9', size: 24 },
        },
        scene: {
            xaxis: {
                title: 'Strike Price ($)',
                titlefont: { color: '#cbd5e1' },
                tickfont: { color: '#94a3b8' },
                gridcolor: '#334155',
                backgroundcolor: '#1e293b',
            },
            yaxis: {
                title: 'Days to Expiry',
                titlefont: { color: '#cbd5e1' },
                tickfont: { color: '#94a3b8' },
                gridcolor: '#334155',
                backgroundcolor: '#1e293b',
            },
            zaxis: {
                title: surfaceType === 'iv' ? 'Implied Volatility' : 'Vega',
                titlefont: { color: '#cbd5e1' },
                tickfont: { color: '#94a3b8' },
                gridcolor: '#334155',
                backgroundcolor: '#1e293b',
                tickformat: '.1%',
            },
            camera: {
                eye: { x: 1.5, y: 1.5, z: 1.3 },
            },
            bgcolor: '#0f172a',
        },
        paper_bgcolor: '#1e293b',
        plot_bgcolor: '#0f172a',
        margin: { l: 0, r: 0, t: 50, b: 0 },
        autosize: true,
    } as any;

    const config = {
        displayModeBar: true,
        displaylogo: false,
        toImageButtonOptions: {
            format: 'png' as const,
            filename: `${ticker}_volatility_surface`,
            height: 1200,
            width: 1600,
        },
    } as any;

    return (
        <motion.div
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
            className="w-full bg-gradient-to-br from-slate-900 to-slate-800 rounded-2xl shadow-2xl border border-slate-700 p-6"
        >
            {/* Header */}
            <div className="mb-6">
                <h2 className="text-3xl font-bold text-white mb-2 flex items-center gap-3">
                    <span className="text-4xl">📊</span>
                    3D Volatility Surface
                </h2>
                <p className="text-slate-400">
                    Interactive implied volatility surface across strikes and maturities
                </p>
            </div>

            {/* Controls */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mb-6">
                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">Ticker</label>
                    <div className="flex gap-2">
                        <input
                            type="text"
                            value={ticker}
                            onChange={(e) => setTicker(e.target.value.toUpperCase())}
                            className="flex-1 px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                            placeholder="AAPL"
                        />
                        <button
                            onClick={fetchSurface}
                            disabled={loading}
                            className="px-6 py-2 bg-blue-600 hover:bg-blue-700 text-white rounded-lg font-medium transition-colors disabled:opacity-50"
                        >
                            {loading ? 'Loading...' : 'Update'}
                        </button>
                    </div>
                </div>

                <div>
                    <label className="block text-sm font-medium text-slate-300 mb-2">
                        Surface Type
                    </label>
                    <select
                        value={surfaceType}
                        onChange={(e) => setSurfaceType(e.target.value as 'iv' | 'vega')}
                        className="w-full px-4 py-2 bg-slate-800 text-white rounded-lg border border-slate-600 focus:border-blue-500 focus:ring-1 focus:ring-blue-500"
                    >
                        <option value="iv">Implied Volatility</option>
                        <option value="vega">Vega Exposure</option>
                    </select>
                </div>

                <div className="flex items-end">
                    <div className="p-4 bg-slate-800 rounded-lg w-full">
                        <div className="text-xs text-slate-400">Underlying Price</div>
                        <div className="text-2xl font-bold text-white">${data.underlyingPrice.toFixed(2)}</div>
                    </div>
                </div>
            </div>

            {/* 3D Surface Plot */}
            <div className="bg-slate-800 rounded-lg p-2" style={{ height: '600px' }}>
                <Plot
                    data={plotData}
                    layout={layout}
                    config={config}
                    style={{ width: '100%', height: '100%' }}
                    useResizeHandler={true}
                />
            </div>

            {/* Insights */}
            <div className="mt-6 p-4 bg-slate-800/50 border border-slate-700 rounded-lg">
                <h3 className="text-lg font-semibold text-white mb-2">Surface Insights</h3>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-3 text-sm text-slate-300">
                    <div className="flex items-start gap-2">
                        <span className="text-blue-400">•</span>
                        <div><strong>Volatility Smile:</strong> Higher IV at OTM strikes (wings)</div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-purple-400">•</span>
                        <div><strong>Term Structure:</strong> IV increases with time to maturity</div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-pink-400">•</span>
                        <div><strong>Put Skew:</strong> OTM puts have higher IV than calls</div>
                    </div>
                    <div className="flex items-start gap-2">
                        <span className="text-green-400">•</span>
                        <div><strong>ATM Strike:</strong> ${data.underlyingPrice.toFixed(2)} (lowest IV zone)</div>
                    </div>
                </div>
            </div>

            {/* Export Buttons */}
            <div className="mt-4 flex gap-3">
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                    📊 Export Data (CSV)
                </button>
                <button className="px-4 py-2 bg-slate-700 hover:bg-slate-600 text-white rounded-lg text-sm transition-colors">
                    📸 Download Image
                </button>
            </div>
        </motion.div>
    );
}
