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

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

function normalizeUser(payload: unknown): User | null {
    const payloadRecord = asRecord(payload);
    const maybeNestedUser = payloadRecord?.user;
    const candidate = asRecord(maybeNestedUser) ?? payloadRecord;
    if (!candidate) {
        return null;
    }

    const id = candidate.id ?? candidate.user_id ?? candidate.sub ?? candidate.email;
    const email = candidate.email;
    if (typeof id !== 'string' || typeof email !== 'string' || !id || !email) {
        return null;
    }

    return {
        id,
        email,
        name: typeof candidate.name === 'string' ? candidate.name : undefined,
    };
}

export const useAuthStore = create<AuthState>((set) => ({
    user: null,
    initialized: false,
    isAuthenticated: false,
    onboardingComplete: false,
    hydrateFromStorage: async () => {
        if (typeof window === 'undefined') {
            set({ initialized: true });
            return;
        }

        const setUnauthenticated = () =>
            set({
                user: null,
                isAuthenticated: false,
                onboardingComplete: false,
                initialized: true,
            });

        const setAuthenticated = (user: User) => {
            localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
            const onboardingComplete = localStorage.getItem(onboardingKey(user.id)) === 'true';
            set({
                user,
                isAuthenticated: true,
                onboardingComplete,
                initialized: true,
            });
        };

        const storedUserRaw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (storedUserRaw) {
            try {
                const parsedUser = normalizeUser(JSON.parse(storedUserRaw));
                if (parsedUser) {
                    setAuthenticated(parsedUser);
                    return;
                }
                localStorage.removeItem(AUTH_USER_STORAGE_KEY);
            } catch {
                localStorage.removeItem(AUTH_USER_STORAGE_KEY);
            }
        }

        // OAuth/login may have a valid server-side cookie before localStorage is populated.
        try {
            const profile = await apiClient.getCurrentUser();
            const profileUser = normalizeUser(profile);
            if (profileUser) {
                setAuthenticated(profileUser);
                return;
            }
        } catch {
            // No active session or profile endpoint unavailable.
        }

        setUnauthenticated();
    },
    setUser: (user) => {
        if (typeof window !== 'undefined') {
            if (user) {
                localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
            } else {
                localStorage.removeItem(AUTH_USER_STORAGE_KEY);
            }
        }

        const onboardingComplete = user
            ? (typeof window !== 'undefined' && localStorage.getItem(onboardingKey(user.id)) === 'true')
            : false;

        set({
            user,
            isAuthenticated: Boolean(user),
            onboardingComplete,
            initialized: true,
        });
    },
    setOnboardingComplete: (complete) => {
        set((state) => {
            if (typeof window !== 'undefined' && state.user) {
                localStorage.setItem(onboardingKey(state.user.id), String(complete));
            }
            return { onboardingComplete: complete };
        });
    },
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
    positions: unknown[];
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
