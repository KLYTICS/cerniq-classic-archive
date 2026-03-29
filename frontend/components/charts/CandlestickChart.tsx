'use client';

import { useState, useEffect, useCallback } from 'react';
import { motion } from 'framer-motion';
import {
    ComposedChart,
    Bar,
    Line,
    XAxis,
    YAxis,
    CartesianGrid,
    Tooltip,
    ResponsiveContainer,
    Area,
} from 'recharts';
import { apiClient } from '@/lib/api';

interface CandlestickData {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
}

interface TechnicalData {
    ohlcv: CandlestickData[];
    indicators: {
        sma20?: number[];
        sma50?: number[];
        sma200?: number[];
        ema12?: number[];
        ema26?: number[];
        rsi?: number[];
        macd?: {
            macd: number[];
            signal: number[];
            histogram: number[];
        };
        bollingerBands?: {
            upper: number[];
            middle: number[];
            lower: number[];
        };
    };
}

interface CandlestickChartProps {
    ticker: string;
    initialTimeframe?: '1D' | '1W' | '1M' | '3M' | '1Y' | 'ALL';
}

type Timeframe = NonNullable<CandlestickChartProps['initialTimeframe']>;
type IndicatorId = 'sma20' | 'sma50' | 'sma200' | 'bollinger';

interface ChartPoint {
    date: string;
    open: number;
    high: number;
    low: number;
    close: number;
    volume: number;
    candleColor: string;
    sma20?: number;
    sma50?: number;
    sma200?: number;
    bbUpper?: number;
    bbMiddle?: number;
    bbLower?: number;
}

export function CandlestickChart({ ticker, initialTimeframe = '1M' }: CandlestickChartProps) {
    const [data, setData] = useState<TechnicalData | null>(null);
    const [loading, setLoading] = useState(false);
    const [timeframe, setTimeframe] = useState<Timeframe>(initialTimeframe);
    const [activeIndicators, setActiveIndicators] = useState<IndicatorId[]>(['sma20', 'sma50']);
    const [chartType, setChartType] = useState<'candlestick' | 'line' | 'area'>('candlestick');

    const fetchChartData = useCallback(async () => {
        setLoading(true);
        try {
            const indicators = ['sma20', 'sma50', 'bollinger', ...activeIndicators].join(',');
            const result = await apiClient.getTechnicalChart(ticker, timeframe, indicators);

            if (!result) throw new Error('Failed to fetch chart data');

            setData(result);
        } catch (error) {
            console.error('Error fetching chart data:', error);
        } finally {
            setLoading(false);
        }
    }, [activeIndicators, ticker, timeframe]);

    useEffect(() => {
        fetchChartData();
    }, [fetchChartData]);

    if (loading) {
        return (
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
                <div className="animate-pulse space-y-4">
                    <div className="h-6 bg-slate-700 rounded w-1/4"></div>
                    <div className="h-96 bg-slate-700 rounded"></div>
                </div>
            </div>
        );
    }

    if (!data || !data.ohlcv || data.ohlcv.length === 0) {
        return (
            <div className="p-6 bg-slate-900 rounded-xl border border-slate-700">
                <p className="text-slate-400">No chart data available</p>
            </div>
        );
    }

    // Prepare chart data
    const chartData: ChartPoint[] = data.ohlcv.map((candle, idx) => {
        const item: ChartPoint = {
            date: new Date(candle.date).toLocaleDateString(),
            open: candle.open,
            high: candle.high,
            low: candle.low,
            close: candle.close,
            volume: candle.volume,
            candleColor: candle.close >= candle.open ? '#10b981' : '#ef4444',
        };

        // Add indicators
        if (data.indicators.sma20 && data.indicators.sma20[idx]) {
            item.sma20 = data.indicators.sma20[idx];
        }
        if (data.indicators.sma50 && data.indicators.sma50[idx]) {
            item.sma50 = data.indicators.sma50[idx];
        }
        if (data.indicators.sma200 && data.indicators.sma200[idx]) {
            item.sma200 = data.indicators.sma200[idx];
        }
        if (data.indicators.bollingerBands) {
            item.bbUpper = data.indicators.bollingerBands.upper[idx];
            item.bbMiddle = data.indicators.bollingerBands.middle[idx];
            item.bbLower = data.indicators.bollingerBands.lower[idx];
        }

        return item;
    });

    const timeframes: Timeframe[] = ['1D', '1W', '1M', '3M', '1Y', 'ALL'];
    const indicatorOptions: Array<{ id: IndicatorId; label: string; color: string }> = [
        { id: 'sma20', label: 'SMA 20', color: '#3b82f6' },
        { id: 'sma50', label: 'SMA 50', color: '#f59e0b' },
        { id: 'sma200', label: 'SMA 200', color: '#8b5cf6' },
        { id: 'bollinger', label: 'Bollinger Bands', color: '#06b6d4' },
    ];

    const toggleIndicator = (id: IndicatorId) => {
        setActiveIndicators((prev) =>
            prev.includes(id) ? prev.filter((i) => i !== id) : [...prev, id],
        );
    };

    return (
        <motion.div
            className="p-6 bg-gradient-to-br from-slate-900 to-slate-800 rounded-xl border border-slate-700 shadow-lg"
            initial={{ opacity: 0, y: 20 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5 }}
        >
            {/* Header Controls */}
            <div className="mb-6">
                <div className="flex items-center justify-between mb-4">
                    <h3 className="text-xl font-bold text-white">{ticker} Chart</h3>

                    {/* Chart Type Selector */}
                    <div className="flex gap-2">
                        {(['candlestick', 'line', 'area'] as const).map((type) => (
                            <button
                                key={type}
                                onClick={() => setChartType(type)}
                                className={`px-3 py-1 rounded text-sm font-medium transition-colors ${chartType === type
                                    ? 'bg-blue-500 text-white'
                                    : 'bg-slate-700 text-slate-300 hover:bg-slate-600'
                                    }`}
                            >
                                {type.charAt(0).toUpperCase() + type.slice(1)}
                            </button>
                        ))}
                    </div>
                </div>

                {/* Timeframe Selector */}
                <div className="flex gap-2 mb-4">
                    {timeframes.map((tf) => (
                        <button
                            key={tf}
                            onClick={() => setTimeframe(tf)}
                            className={`px-4 py-2 rounded-lg text-sm font-semibold transition-colors ${timeframe === tf
                                ? 'bg-purple-500 text-white'
                                : 'bg-slate-800 text-slate-300 hover:bg-slate-700'
                                }`}
                        >
                            {tf}
                        </button>
                    ))}
                </div>

                {/* Indicator Toggles */}
                <div className="flex flex-wrap gap-2">
                    {indicatorOptions.map((indicator) => (
                        <button
                            key={indicator.id}
                            onClick={() => toggleIndicator(indicator.id)}
                            className={`px-3 py-1 rounded-lg text-sm font-medium transition-colors border ${activeIndicators.includes(indicator.id)
                                ? 'bg-slate-700 border-slate-500 text-white'
                                : 'bg-slate-900 border-slate-700 text-slate-400'
                                }`}
                            style={{
                                borderColor: activeIndicators.includes(indicator.id)
                                    ? indicator.color
                                    : undefined,
                            }}
                        >
                            <span
                                className="inline-block w-3 h-3 rounded-full mr-2"
                                style={{ backgroundColor: indicator.color }}
                            ></span>
                            {indicator.label}
                        </button>
                    ))}
                </div>
            </div>

            {/* Price Chart */}
            <div className="h-96 mb-4">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" stroke="#94a3b8" angle={-45} textAnchor="end" height={80} />
                        <YAxis stroke="#94a3b8" domain={['auto', 'auto']} />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                            }}
                            labelStyle={{ color: '#f1f5f9' }}
                        />

                        {/* Bollinger Bands */}
                        {activeIndicators.includes('bollinger') && (
                            <>
                                <Area
                                    type="monotone"
                                    dataKey="bbUpper"
                                    stroke="#06b6d4"
                                    fill="#06b6d4"
                                    fillOpacity={0.1}
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                                <Area
                                    type="monotone"
                                    dataKey="bbLower"
                                    stroke="#06b6d4"
                                    fill="transparent"
                                    strokeWidth={1}
                                    strokeDasharray="5 5"
                                    dot={false}
                                />
                            </>
                        )}

                        {/* Price visualization based on chart type */}
                        {chartType === 'line' && (
                            <Line type="monotone" dataKey="close" stroke="#10b981" strokeWidth={2} dot={false} />
                        )}
                        {chartType === 'area' && (
                            <Area
                                type="monotone"
                                dataKey="close"
                                stroke="#10b981"
                                fill="#10b981"
                                fillOpacity={0.3}
                                strokeWidth={2}
                            />
                        )}
                        {chartType === 'candlestick' && (
                            <Bar dataKey="close" fill="#10b981" radius={[2, 2, 0, 0]} />
                        )}

                        {/* Moving Averages */}
                        {activeIndicators.includes('sma20') && (
                            <Line type="monotone" dataKey="sma20" stroke="#3b82f6" strokeWidth={2} dot={false} />
                        )}
                        {activeIndicators.includes('sma50') && (
                            <Line type="monotone" dataKey="sma50" stroke="#f59e0b" strokeWidth={2} dot={false} />
                        )}
                        {activeIndicators.includes('sma200') && (
                            <Line type="monotone" dataKey="sma200" stroke="#8b5cf6" strokeWidth={2} dot={false} />
                        )}
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Volume Chart */}
            <div className="h-24">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={chartData} margin={{ top: 0, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid strokeDasharray="3 3" stroke="#334155" />
                        <XAxis dataKey="date" hide />
                        <YAxis stroke="#94a3b8" />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: '#1e293b',
                                border: '1px solid #475569',
                                borderRadius: '8px',
                            }}
                        />
                        <Bar dataKey="volume" fill="#6366f1" fillOpacity={0.6} radius={[2, 2, 0, 0]} />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            {/* Chart Info */}
            <div className="mt-4 p-3 bg-slate-800/50 rounded-lg border border-slate-700">
                <div className="grid grid-cols-5 gap-4 text-sm">
                    <div>
                        <div className="text-slate-400 text-xs">Open</div>
                        <div className="text-white font-semibold">${chartData[chartData.length - 1]?.open.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">High</div>
                        <div className="text-white font-semibold">${chartData[chartData.length - 1]?.high.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">Low</div>
                        <div className="text-white font-semibold">${chartData[chartData.length - 1]?.low.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">Close</div>
                        <div className="text-white font-semibold">${chartData[chartData.length - 1]?.close.toFixed(2)}</div>
                    </div>
                    <div>
                        <div className="text-slate-400 text-xs">Volume</div>
                        <div className="text-white font-semibold">
                            {(chartData[chartData.length - 1]?.volume / 1000000).toFixed(2)}M
                        </div>
                    </div>
                </div>
            </div>
        </motion.div>
    );
}
