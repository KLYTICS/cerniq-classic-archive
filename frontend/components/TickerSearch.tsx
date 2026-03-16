'use client';

import { useEffect, useRef, useState } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bitcoin, Building2, CandlestickChart, Search } from 'lucide-react';

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

export default function TickerSearch({
  onSelect,
  placeholder = 'Search stocks, ETFs, crypto...',
}: TickerSearchProps) {
  const [query, setQuery] = useState('');
  const [results, setResults] = useState<TickerSearchResult[]>([]);
  const [loading, setLoading] = useState(false);
  const [showResults, setShowResults] = useState(false);
  const searchRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (query.length < 2) {
      setResults([]);
      return;
    }

    const timer = setTimeout(async () => {
      setLoading(true);
      try {
        const response = await fetch(`${NODE_API_URL}/api/market-data/search?q=${encodeURIComponent(query)}`);
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
        return Bitcoin;
      case 'etf':
        return CandlestickChart;
      case 'stock':
        return Building2;
      default:
        return Search;
    }
  };

  return (
    <div ref={searchRef} className="relative w-full max-w-2xl">
      <div className="relative">
        <Search className="pointer-events-none absolute left-5 top-1/2 h-4 w-4 -translate-y-1/2 text-cyan-700/55" />
        <input
          type="text"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onFocus={() => query.length >= 2 && setShowResults(true)}
          placeholder={placeholder}
          className="w-full rounded-[1.2rem] border border-slate-200 bg-white py-4 pr-6 pl-12 text-slate-950 placeholder:text-slate-400 focus:border-transparent focus:outline-none focus:ring-2 focus:ring-cyan-300/25 transition"
        />
        {loading ? (
          <div className="absolute right-4 top-1/2 -translate-y-1/2">
            <div className="h-5 w-5 animate-spin rounded-full border-2 border-cyan-300/30 border-t-cyan-200" />
          </div>
        ) : null}
      </div>

      <AnimatePresence>
        {showResults && results.length > 0 ? (
          <motion.div
            initial={{ opacity: 0, y: -10 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -10 }}
            className="absolute z-50 mt-2 w-full overflow-hidden rounded-[1.2rem] border border-slate-200 bg-white/98 shadow-xl shadow-slate-200/70 backdrop-blur-xl"
          >
            {results.map((result, index) => {
              const Icon = getAssetIcon(result.assetType);
              return (
                <motion.button
                  key={`${result.ticker}-${index}`}
                  onClick={() => handleSelect(result.ticker)}
                  className="group flex w-full items-center justify-between px-6 py-3 transition hover:bg-white/5"
                  whileHover={{ x: 4 }}
                >
                  <div className="flex items-center gap-3">
                    <div className="rounded-2xl border border-cyan-300/14 bg-cyan-400/10 p-2">
                      <Icon className="h-4 w-4 text-cyan-700" />
                    </div>
                    <div className="text-left">
                      <div className="font-semibold text-slate-950 transition group-hover:text-cyan-700">{result.ticker}</div>
                      <div className="text-sm text-slate-400">{result.name}</div>
                    </div>
                  </div>
                  <div className="flex flex-col items-end text-xs text-slate-500">
                    <span className="capitalize">{result.assetType}</span>
                    {result.exchange ? <span>{result.exchange}</span> : null}
                  </div>
                </motion.button>
              );
            })}
          </motion.div>
        ) : null}
      </AnimatePresence>

      {showResults && query.length >= 2 && results.length === 0 && !loading ? (
        <div className="absolute mt-2 w-full rounded-[1.2rem] border border-slate-200 bg-white/98 p-6 text-center text-slate-500 shadow-xl shadow-slate-200/70 backdrop-blur-xl">
          No results found for &quot;{query}&quot;
        </div>
      ) : null}
    </div>
  );
}
