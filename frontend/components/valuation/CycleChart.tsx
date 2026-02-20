'use client';

import { LineChart, Line, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer, ReferenceLine, Area, ComposedChart } from 'recharts';

interface CycleDataPoint {
    date: string;
    revenue: number;
    isPeak?: boolean;
    isTrough?: boolean;
}

interface CycleChartProps {
    data: CycleDataPoint[];
    midCycleRevenue?: number;
}

export default function CycleChart({ data, midCycleRevenue }: CycleChartProps) {
    const formatRevenue = (value: number) => {
        if (value >= 1e9) return `$${(value / 1e9).toFixed(1)}B`;
        if (value >= 1e6) return `$${(value / 1e6).toFixed(0)}M`;
        return `$${value}`;
    };

    const CustomTooltip = ({ active, payload }: any) => {
        if (active && payload && payload.length) {
            const data = payload[0].payload;
            return (
                <div className="bg-slate-800/95 backdrop-blur-md border border-white/20 rounded-lg p-4 shadow-xl">
                    <p className="text-white font-semibold mb-2">{data.date}</p>
                    <p className="text-gray-300">
                        Revenue: <span className="text-white font-bold">{formatRevenue(data.revenue)}</span>
                    </p>
                    {data.isPeak && (
                        <p className="text-green-400 text-sm mt-2">● Peak</p>
                    )}
                    {data.isTrough && (
                        <p className="text-red-400 text-sm mt-2">● Trough</p>
                    )}
                </div>
            );
        }
        return null;
    };

    return (
        <div className="bg-white/10 backdrop-blur-md rounded-2xl p-8 border border-white/20">
            <div className="mb-6">
                <h3 className="text-2xl font-bold text-white mb-2">Revenue Cycle Analysis</h3>
                <p className="text-gray-400">Quarterly revenue with detected peaks and troughs</p>
            </div>

            <div className="h-96">
                <ResponsiveContainer width="100%" height="100%">
                    <ComposedChart data={data} margin={{ top: 10, right: 30, left: 0, bottom: 0 }}>
                        <defs>
                            <linearGradient id="revenueGradient" x1="0" y1="0" x2="0" y2="1">
                                <stop offset="5%" stopColor="#8b5cf6" stopOpacity={0.3} />
                                <stop offset="95%" stopColor="#8b5cf6" stopOpacity={0} />
                            </linearGradient>
                        </defs>

                        <CartesianGrid strokeDasharray="3 3" stroke="#374151" opacity={0.3} />

                        <XAxis
                            dataKey="date"
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            angle={-45}
                            textAnchor="end"
                            height={80}
                        />

                        <YAxis
                            stroke="#9ca3af"
                            tick={{ fill: '#9ca3af', fontSize: 12 }}
                            tickFormatter={formatRevenue}
                        />

                        <Tooltip content={<CustomTooltip />} />

                        {midCycleRevenue && (
                            <ReferenceLine
                                y={midCycleRevenue}
                                stroke="#fbbf24"
                                strokeDasharray="5 5"
                                strokeWidth={2}
                                label={{
                                    value: `Mid-Cycle: ${formatRevenue(midCycleRevenue)}`,
                                    fill: '#fbbf24',
                                    fontSize: 12,
                                    position: 'right',
                                }}
                            />
                        )}

                        <Area
                            type="monotone"
                            dataKey="revenue"
                            stroke="none"
                            fill="url(#revenueGradient)"
                        />

                        <Line
                            type="monotone"
                            dataKey="revenue"
                            stroke="#8b5cf6"
                            strokeWidth={3}
                            dot={(props: any) => {
                                const { cx, cy, payload } = props;
                                if (payload.isPeak) {
                                    return (
                                        <circle cx={cx} cy={cy} r={6} fill="#10b981" stroke="#fff" strokeWidth={2} />
                                    );
                                }
                                if (payload.isTrough) {
                                    return (
                                        <circle cx={cx} cy={cy} r={6} fill="#ef4444" stroke="#fff" strokeWidth={2} />
                                    );
                                }
                                return <circle cx={cx} cy={cy} r={3} fill="#8b5cf6" />;
                            }}
                            activeDot={{ r: 8 }}
                        />
                    </ComposedChart>
                </ResponsiveContainer>
            </div>

            <div className="mt-6 flex items-center justify-center gap-6 text-sm">
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-green-500"></div>
                    <span className="text-gray-300">Peak</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-3 h-3 rounded-full bg-red-500"></div>
                    <span className="text-gray-300">Trough</span>
                </div>
                <div className="flex items-center gap-2">
                    <div className="w-8 h-0.5 bg-yellow-500"></div>
                    <span className="text-gray-300">Mid-Cycle</span>
                </div>
            </div>
        </div>
    );
}
