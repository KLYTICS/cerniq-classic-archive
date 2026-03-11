
'use client';

import { useState } from 'react';
import { apiClient } from '@/lib/api';

interface StockInsightsPopupProps {
    ticker: string;
    trigger: React.ReactNode;
}

export default function StockInsightsPopup({ ticker, trigger }: StockInsightsPopupProps) {
    const [isOpen, setIsOpen] = useState(false);
    const [insight, setInsight] = useState<string | null>(null);
    const [loading, setLoading] = useState(false);

    const handleOpen = async () => {
        setIsOpen(true);
        if (!insight) {
            setLoading(true);
            try {
                // Fetch insight from API
                const data = await apiClient.getInsights(ticker);
                setInsight(data.insight);
            } catch (error) {
                console.error("Failed to fetch insights", error);
                setInsight("Unable to generate insights at this time. Please try again later.");
            } finally {
                setLoading(false);
            }
        }
    };

    return (
        <div className="relative inline-block">
            <div onClick={handleOpen} className="cursor-pointer">
                {trigger}
            </div>

            {isOpen && (
                <>
                    <div
                        className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm"
                        onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                    />
                    <div className="absolute z-50 left-full top-0 ml-4 w-80 bg-slate-900 border border-amber-500/30 rounded-xl shadow-xl shadow-amber-500/20 p-4 text-white overflow-hidden">
                        <div className="flex justify-between items-center mb-3">
                            <h3 className="font-bold text-amber-300 flex items-center gap-2">
                                ✨ AI Analysis: {ticker}
                            </h3>
                            <button
                                onClick={(e) => { e.stopPropagation(); setIsOpen(false); }}
                                className="text-gray-400 hover:text-white"
                            >
                                ✕
                            </button>
                        </div>

                        <div className="text-sm text-gray-300 max-h-60 overflow-y-auto custom-scrollbar">
                            {loading ? (
                                <div className="space-y-2 animate-pulse">
                                    <div className="h-4 bg-white/10 rounded w-3/4"></div>
                                    <div className="h-4 bg-white/10 rounded w-full"></div>
                                    <div className="h-4 bg-white/10 rounded w-5/6"></div>
                                </div>
                            ) : (
                                <div className="prose prose-invert prose-sm">
                                    {insight}
                                </div>
                            )}
                        </div>

                        <div className="mt-3 pt-3 border-t border-white/10 text-xs text-gray-500 flex justify-between">
                            <span>Powered by GPT-4</span>
                            <span>{new Date().toLocaleTimeString()}</span>
                        </div>
                    </div>
                </>
            )}
        </div>
    );
}
