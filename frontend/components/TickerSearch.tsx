'use client';

import { useState, useEffect, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface TickerSearchResult {
    ticker: string;
    name: string;
    assetType: 'stock' | 'etf' | 'crypto' | 'index';
    exchange?: string;
    sector?: string;
}

interface TickerSearchProps {
    onSelect: (ticker: string) => void;
    placeholder?: string;
}

const NODE_API_URL = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim().replace(/\/+$/, '');

export default function TickerSearch({ onSelect, placeholder = 'Search stocks, ETFs, crypto...' }: TickerSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TickerSearchResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [showResults, setShowResults] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);

    // Debounced search
    useEffect(() => {
        if (query.length < 2) {
            setResults([]);
            return;
        }

        const timer = setTimeout(async () => {
            setLoading(true);
            try {
                const response = await fetch(
                    `${NODE_API_URL}/api/market-data/search?q=${encodeURIComponent(query)}`
                );
                if (response.ok) {
                    const data = await response.json();
                    setResults(data);
                    setShowResults(true);
                }
            } catch (error) {
                console.error('Search failed:', error);
            } finally {
                setLoading(false);
            }
        }, 300);

        return () => clearTimeout(timer);
    }, [query]);

    // Close results when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setShowResults(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (ticker: string) => {
        setQuery('');
        setShowResults(false);
        setResults([]);
        onSelect(ticker);
    };

    const getAssetIcon = (assetType: string) => {
        switch (assetType) {
            case 'crypto':
                return '₿';
            case 'etf':
                return '📊';
            case 'stock':
                return '📈';
            default:
                return '💼';
        }
    };

    return (
        <div ref={searchRef} className="relative w-full max-w-2xl">
            <div className="relative">
                <input
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => query.length >= 2 && setShowResults(true)}
                    placeholder={placeholder}
                    className="w-full bg-white/10 backdrop-blur-md border border-white/20 rounded-xl px-6 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
                {loading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            <AnimatePresence>
                {showResults && results.length > 0 && (
                    <motion.div
                        initial={{ opacity: 0, y: -10 }}
                        animate={{ opacity: 1, y: 0 }}
                        exit={{ opacity: 0, y: -10 }}
                        className="absolute w-full mt-2 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-xl overflow-hidden z-50"
                    >
                        {results.map((result, index) => (
                            <motion.button
                                key={`${result.ticker}-${index}`}
                                onClick={() => handleSelect(result.ticker)}
                                className="w-full px-6 py-3 hover:bg-white/10 transition flex items-center justify-between group"
                                whileHover={{ x: 4 }}
                            >
                                <div className="flex items-center gap-3">
                                    <span className="text-2xl">{getAssetIcon(result.assetType)}</span>
                                    <div className="text-left">
                                        <div className="font-semibold text-white group-hover:text-purple-400 transition">
                                            {result.ticker}
                                        </div>
                                        <div className="text-sm text-gray-400">{result.name}</div>
                                    </div>
                                </div>
                                <div className="flex flex-col items-end text-xs text-gray-500">
                                    <span className="capitalize">{result.assetType}</span>
                                    {result.exchange && <span>{result.exchange}</span>}
                                </div>
                            </motion.button>
                        ))}
                    </motion.div>
                )}
            </AnimatePresence>

            {showResults && query.length >= 2 && results.length === 0 && !loading && (
                <div className="absolute w-full mt-2 bg-slate-900/95 backdrop-blur-md border border-white/10 rounded-xl shadow-xl p-6 text-center text-gray-400">
                    No results found for "{query}"
                </div>
            )}
        </div>
    );
}
