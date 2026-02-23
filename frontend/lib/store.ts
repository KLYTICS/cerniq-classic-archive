import { create } from 'zustand';
import { apiClient } from './api';

interface User {
    id: string;
    email: string;
    name?: string;
}

interface AuthState {
    user: User | null;
    initialized: boolean;
    isAuthenticated: boolean;
    onboardingComplete: boolean;
    hydrateFromStorage: () => Promise<void>;
    setUser: (user: User | null) => void;
    setOnboardingComplete: (complete: boolean) => void;
    logout: () => Promise<void>;
}

const AUTH_USER_STORAGE_KEY = 'capex_auth_user';
const onboardingKey = (userId: string) => `capex_onboarding_${userId}`;

export const useAuthStore = create<AuthState>((set) => ({
    user: { id: 'mock-user-id', email: 'demo@capexcycle.io', name: 'Demo User' },
    initialized: true,
    isAuthenticated: true,
    onboardingComplete: true,
    hydrateFromStorage: async () => { },
    setUser: (user) => { },
    setOnboardingComplete: (complete) => { },
    logout: async () => {
        await apiClient.logout();
        if (typeof window !== 'undefined') {
            localStorage.removeItem(AUTH_USER_STORAGE_KEY);
        }
        set({
            user: null,
            isAuthenticated: false,
            onboardingComplete: false,
            initialized: true,
        });
    },
}));

interface Portfolio {
    id: string;
    name: string;
    positions: any[];
}

interface PortfolioState {
    portfolios: Portfolio[];
    selectedPortfolio: Portfolio | null;
    setPortfolios: (portfolios: Portfolio[]) => void;
    selectPortfolio: (portfolio: Portfolio | null) => void;
    addPortfolio: (portfolio: Portfolio) => void;
}

export const usePortfolioStore = create<PortfolioState>((set) => ({
    portfolios: [],
    selectedPortfolio: null,
    setPortfolios: (portfolios) => set({ portfolios }),
    selectPortfolio: (portfolio) => set({ selectedPortfolio: portfolio }),
    addPortfolio: (portfolio) =>
        set((state) => ({ portfolios: [...state.portfolios, portfolio] })),
}));

// Market Data Cache with 60-second TTL
const CACHE_TTL_MS = 60_000;

interface QuoteData {
    ticker: string;
    price: number;
    change: number;
    changePercent: number;
    volume?: number;
    name?: string;
}

interface CacheEntry<T> {
    data: T;
    timestamp: number;
}

interface MarketDataState {
    quotes: Record<string, CacheEntry<QuoteData>>;
    lastUpdated: number | null;
    setQuote: (ticker: string, data: QuoteData) => void;
    setQuotes: (quotes: QuoteData[]) => void;
    getQuote: (ticker: string) => QuoteData | null;
    isStale: (ticker: string) => boolean;
    clearCache: () => void;
}

export const useMarketDataStore = create<MarketDataState>((set, get) => ({
    quotes: {},
    lastUpdated: null,

    setQuote: (ticker, data) =>
        set((state) => ({
            quotes: {
                ...state.quotes,
                [ticker]: { data, timestamp: Date.now() },
            },
            lastUpdated: Date.now(),
        })),

    setQuotes: (quotes) =>
        set((state) => {
            const now = Date.now();
            const updated = { ...state.quotes };
            quotes.forEach((q) => {
                updated[q.ticker] = { data: q, timestamp: now };
            });
            return { quotes: updated, lastUpdated: now };
        }),

    getQuote: (ticker) => {
        const entry = get().quotes[ticker];
        if (!entry) return null;
        if (Date.now() - entry.timestamp > CACHE_TTL_MS) return null;
        return entry.data;
    },

    isStale: (ticker) => {
        const entry = get().quotes[ticker];
        if (!entry) return true;
        return Date.now() - entry.timestamp > CACHE_TTL_MS;
    },

    clearCache: () => set({ quotes: {}, lastUpdated: null }),
}));
