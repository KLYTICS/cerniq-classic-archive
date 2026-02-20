'use client';

import React, { useState, useEffect, useRef } from 'react';
import { Search, TrendingUp, DollarSign, Award } from 'lucide-react';
import { apiClient } from '@/lib/api';

interface TickerResult {
    ticker: string;
    name: string;
    sector: string | null;
    industry: string | null;
    asset_type: 'stock' | 'etf' | 'crypto' | 'index';
    exchange: string | null;
}

interface UniversalTickerSearchProps {
    onSelect: (ticker: string) => void;
    placeholder?: string;
    autoFocus?: boolean;
}

const assetTypeIcons = {
    stock: TrendingUp,
    etf: Award,
    crypto: DollarSign,
    index: TrendingUp,
};

const assetTypeColors = {
    stock: 'text-blue-400',
    etf: 'text-purple-400',
    crypto: 'text-amber-400',
    index: 'text-green-400',
};

const assetTypeBadges = {
    stock: 'bg-blue-500/20 text-blue-400',
    etf: 'bg-purple-500/20 text-purple-400',
    crypto: 'bg-amber-500/20 text-amber-400',
    index: 'bg-green-500/20 text-green-400',
};

export default function UniversalTickerSearch({
    onSelect,
    placeholder = "Search any stock, ETF, or crypto...",
    autoFocus = false
}: UniversalTickerSearchProps) {
    const [query, setQuery] = useState('');
    const [results, setResults] = useState<TickerResult[]>([]);
    const [popularTickers, setPopularTickers] = useState<TickerResult[]>([]);
    const [isOpen, setIsOpen] = useState(false);
    const [selectedIndex, setSelectedIndex] = useState(0);
    const [isLoading, setIsLoading] = useState(false);
    const searchRef = useRef<HTMLDivElement>(null);
    const inputRef = useRef<HTMLInputElement>(null);

    // Load popular tickers on mount
    useEffect(() => {
        const loadPopular = async () => {
            try {
                const response = await apiClient.getPopularTickers();
                setPopularTickers(response);
            } catch (error) {
                console.error('Failed to load popular tickers:', error);
            }
        };
        loadPopular();
    }, []);

    // Search tickers as user types
    useEffect(() => {
        if (query.length < 1) {
            setResults([]);
            setSelectedIndex(0);
            return;
        }

        const searchTickers = async () => {
            setIsLoading(true);
            try {
                const response = await apiClient.searchTickers(query);
                setResults(response.results || []);
                setSelectedIndex(0);
            } catch (error) {
                console.error('Search failed:', error);
                setResults([]);
            } finally {
                setIsLoading(false);
            }
        };

        const debounce = setTimeout(searchTickers, 200);
        return () => clearTimeout(debounce);
    }, [query]);

    // Close dropdown when clicking outside
    useEffect(() => {
        const handleClickOutside = (event: MouseEvent) => {
            if (searchRef.current && !searchRef.current.contains(event.target as Node)) {
                setIsOpen(false);
            }
        };

        document.addEventListener('mousedown', handleClickOutside);
        return () => document.removeEventListener('mousedown', handleClickOutside);
    }, []);

    const handleSelect = (ticker: string) => {
        setQuery('');
        setIsOpen(false);
        onSelect(ticker);
    };

    const handleKeyDown = (e: React.KeyboardEvent) => {
        const displayResults = query ? results : popularTickers;

        if (e.key === 'ArrowDown') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev + 1) % displayResults.length);
        } else if (e.key === 'ArrowUp') {
            e.preventDefault();
            setSelectedIndex((prev) => (prev - 1 + displayResults.length) % displayResults.length);
        } else if (e.key === 'Enter') {
            e.preventDefault();
            if (displayResults[selectedIndex]) {
                handleSelect(displayResults[selectedIndex].ticker);
            }
        } else if (e.key === 'Escape') {
            setIsOpen(false);
        }
    };

    const displayResults = query ? results : popularTickers;

    return (
        <div ref={searchRef} className="relative w-full">
            {/* Search Input */}
            <div className="relative">
                <Search className="absolute left-4 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400" />
                <input
                    ref={inputRef}
                    type="text"
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    onFocus={() => setIsOpen(true)}
                    onKeyDown={handleKeyDown}
                    autoFocus={autoFocus}
                    placeholder={placeholder}
                    className="w-full bg-white/5 border border-white/10 rounded-xl pl-12 pr-4 py-4 text-white placeholder-gray-400 focus:outline-none focus:ring-2 focus:ring-purple-500 focus:border-transparent transition"
                />
                {isLoading && (
                    <div className="absolute right-4 top-1/2 -translate-y-1/2">
                        <div className="w-5 h-5 border-2 border-purple-500 border-t-transparent rounded-full animate-spin" />
                    </div>
                )}
            </div>

            {/* Results Dropdown */}
            {isOpen && displayResults.length > 0 && (
                <div className="absolute z-50 w-full mt-2 bg-gray-900/95 backdrop-blur-xl border border-white/10 rounded-xl shadow-2xl overflow-hidden animate-in fade-in slide-in-from-top-2 duration-200">
                    <div className="max-h-96 overflow-y-auto">
                        {!query && (
                            <div className="px-4 py-2 text-xs text-gray-400 font-medium uppercase tracking-wider border-b border-white/5">
                                Popular Tickers
                            </div>
                        )}
                        {displayResults.map((ticker, index) => {
                            const Icon = assetTypeIcons[ticker.asset_type];
                            const iconColor = assetTypeColors[ticker.asset_type];
                            const badgeColor = assetTypeBadges[ticker.asset_type];

                            return (
                                <button
                                    key={ticker.ticker}
                                    onClick={() => handleSelect(ticker.ticker)}
                                    className={`w-full px-4 py-3 flex items-center gap-3 hover:bg-white/5 transition group ${index === selectedIndex ? 'bg-white/10' : ''
                                        }`}
                                >
                                    <Icon className={`w-5 h-5 ${iconColor} group-hover:scale-110 transition`} />
                                    <div className="flex-1 text-left">
                                        <div className="flex items-center gap-2">
                                            <span className="font-bold text-white">{ticker.ticker}</span>
                                            <span className={`text-xs px-2 py-0.5 rounded ${badgeColor} uppercase`}>
                                                {ticker.asset_type}
                                            </span>
                                        </div>
                                        <div className="text-sm text-gray-400 truncate">{ticker.name}</div>
                                        {ticker.sector && (
                                            <div className="text-xs text-gray-500">{ticker.sector} • {ticker.exchange}</div>
                                        )}
                                    </div>
                                </button>
                            );
                        })}
                    </div>

                    {query && results.length === 0 && !isLoading && (
                        <div className="px-4 py-8 text-center text-gray-400">
                            <Search className="w-12 h-12 mx-auto mb-2 opacity-30" />
                            <p>No tickers found for "{query}"</p>
                            <p className="text-sm text-gray-500 mt-1">Try a different search term</p>
                        </div>
                    )}
                </div>
            )}
        </div>
    );
}
