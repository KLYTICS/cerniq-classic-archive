'use client';

import { useState } from 'react';
import { Search, TrendingUp, Loader2 } from 'lucide-react';

interface TickerSearchProps {
    onSearch: (ticker: string) => void;
    isLoading?: boolean;
}

const POPULAR_TICKERS = [
    { symbol: 'LRCX', name: 'Lam Research' },
    { symbol: 'AMAT', name: 'Applied Materials' },
    { symbol: 'KLAC', name: 'KLA Corporation' },
    { symbol: 'ASML', name: 'ASML Holding' },
    { symbol: 'NVDA', name: 'NVIDIA' },
    { symbol: 'TSM', name: 'Taiwan Semiconductor' },
];

export default function TickerSearch({ onSearch, isLoading }: TickerSearchProps) {
    const [ticker, setTicker] = useState('');
    const [showSuggestions, setShowSuggestions] = useState(false);

    const filteredTickers = POPULAR_TICKERS.filter(
        (t) =>
            t.symbol.toLowerCase().includes(ticker.toLowerCase()) ||
            t.name.toLowerCase().includes(ticker.toLowerCase())
    );

    const handleSearch = () => {
        if (ticker.trim()) {
            onSearch(ticker.trim().toUpperCase());
            setShowSuggestions(false);
        }
    };

    const handleSelect = (symbol: string) => {
        setTicker(symbol);
        onSearch(symbol);
        setShowSuggestions(false);
    };

    return (
        <div className="relative">
            <div className="flex gap-3">
                <div className="relative flex-1">
                    <Search className="absolute left-4 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                    <input
                        type="text"
                        value={ticker}
                        onChange={(e) => {
                            setTicker(e.target.value);
                            setShowSuggestions(true);
                        }}
                        onFocus={() => setShowSuggestions(true)}
                        onKeyDown={(e) => e.key === 'Enter' && handleSearch()}
                        placeholder="Enter ticker symbol (e.g., LRCX, AMAT, KLAC)"
                        className="w-full pl-12 pr-4 py-4 bg-white/10 backdrop-blur-md border border-white/20 rounded-xl text-white placeholder-gray-400 focus:outline-none focus:border-purple-500/50 focus:ring-2 focus:ring-purple-500/20 transition"
                        disabled={isLoading}
                    />
                </div>
                <button
                    onClick={handleSearch}
                    disabled={isLoading || !ticker.trim()}
                    className="px-8 py-4 bg-gradient-to-r from-purple-600 to-blue-600 hover:from-purple-700 hover:to-blue-700 disabled:from-gray-600 disabled:to-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold transition flex items-center gap-2 shadow-lg hover:shadow-purple-500/50"
                >
                    {isLoading ? (
                        <>
                            <Loader2 className="w-5 h-5 animate-spin" />
                            Analyzing...
                        </>
                    ) : (
                        <>
                            <TrendingUp className="w-5 h-5" />
                            Analyze
                        </>
                    )}
                </button>
            </div>

            {/* Suggestions Dropdown */}
            {showSuggestions && ticker && filteredTickers.length > 0 && !isLoading && (
                <div className="absolute z-10 w-full mt-2 bg-slate-800/95 backdrop-blur-md border border-white/20 rounded-xl overflow-hidden shadow-2xl">
                    {filteredTickers.map((t) => (
                        <button
                            key={t.symbol}
                            onClick={() => handleSelect(t.symbol)}
                            className="w-full px-4 py-3 hover:bg-purple-600/20 transition text-left flex items-center justify-between group"
                        >
                            <div>
                                <div className="text-white font-semibold">{t.symbol}</div>
                                <div className="text-gray-400 text-sm">{t.name}</div>
                            </div>
                            <TrendingUp className="w-4 h-4 text-gray-400 group-hover:text-purple-400 transition" />
                        </button>
                    ))}
                </div>
            )}
        </div>
    );
}
