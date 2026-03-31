import { create } from 'zustand';
import { apiClient } from './api';
import {
    AUTH_USER_STORAGE_KEY,
    LEGACY_AUTH_USER_STORAGE_KEY,
    clearClientAuthState,
    hasStoredAuthHint,
} from './auth-storage';

interface User {
    id: string;
    email: string;
    name?: string;
}

interface AuthState {
    user: User | null;
    initialized: boolean;
    isAuthenticated: boolean;
    authRevision: number;
    onboardingComplete: boolean;
    hydrateFromStorage: () => Promise<void>;
    initializeAnonymous: () => void;
    setUser: (user: User | null) => void;
    setOnboardingComplete: (complete: boolean) => void;
    logout: () => Promise<void>;
}

const onboardingKey = (userId: string) => `cerniq_onboarding_${userId}`;
const legacyOnboardingKey = (userId: string) => `capex_onboarding_${userId}`;

function shouldProbeServerSession() {
    return typeof window !== 'undefined';
}

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
    authRevision: 0,
    onboardingComplete: false,
    hydrateFromStorage: async () => {
        if (typeof window === 'undefined') {
            set({ initialized: true });
            return;
        }

        set({ initialized: false });
        const storedAuthHint = hasStoredAuthHint();

        const setUnauthenticated = () =>
            set((state) => ({
                user: null,
                isAuthenticated: false,
                authRevision: state.authRevision + 1,
                onboardingComplete: false,
                initialized: true,
            }));

        const setAuthenticated = (user: User) => {
            localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
            const onboardingComplete = localStorage.getItem(onboardingKey(user.id)) === 'true';
            set((state) => ({
                user,
                isAuthenticated: true,
                authRevision: state.authRevision + 1,
                onboardingComplete,
                initialized: true,
            }));
        };

        // Migrate legacy capex_ keys to cerniq_ keys
        const legacyRaw = localStorage.getItem(LEGACY_AUTH_USER_STORAGE_KEY);
        if (legacyRaw) {
            localStorage.setItem(AUTH_USER_STORAGE_KEY, legacyRaw);
            localStorage.removeItem(LEGACY_AUTH_USER_STORAGE_KEY);
            // Also migrate onboarding key for this user
            try {
                const legacyUser = normalizeUser(JSON.parse(legacyRaw));
                if (legacyUser) {
                    const legacyOnboarding = localStorage.getItem(legacyOnboardingKey(legacyUser.id));
                    if (legacyOnboarding) {
                        localStorage.setItem(onboardingKey(legacyUser.id), legacyOnboarding);
                        localStorage.removeItem(legacyOnboardingKey(legacyUser.id));
                    }
                }
            } catch { /* best-effort migration */ }
        }

        let storedUser: User | null = null;
        const storedUserRaw = localStorage.getItem(AUTH_USER_STORAGE_KEY);
        if (storedUserRaw) {
            try {
                storedUser = normalizeUser(JSON.parse(storedUserRaw));
                if (!storedUser) {
                    localStorage.removeItem(AUTH_USER_STORAGE_KEY);
                }
            } catch {
                localStorage.removeItem(AUTH_USER_STORAGE_KEY);
            }
        }

        if (shouldProbeServerSession()) {
            try {
                const profile = await apiClient.getCurrentUser();
                const profileUser = normalizeUser(profile);
                if (profileUser) {
                    setAuthenticated(profileUser);
                    return;
                }
            } catch {
                // Server session missing or unavailable — fall through to a clean unauthenticated state.
            }

            if (storedAuthHint) {
                clearClientAuthState();
            }

            setUnauthenticated();
            return;
        }

        if (storedUser) {
            setAuthenticated(storedUser);
            return;
        }

        setUnauthenticated();
    },
    initializeAnonymous: () => {
        set((state) => ({
            user: null,
            isAuthenticated: false,
            authRevision: state.authRevision + 1,
            onboardingComplete: false,
            initialized: true,
        }));
    },
    setUser: (user) => {
        if (typeof window !== 'undefined') {
            if (user) {
                localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify(user));
            } else {
                clearClientAuthState();
            }
        }

        const onboardingComplete = user
            ? (typeof window !== 'undefined' && localStorage.getItem(onboardingKey(user.id)) === 'true')
            : false;

        set((state) => ({
            user,
            isAuthenticated: Boolean(user),
            authRevision: state.authRevision + 1,
            onboardingComplete,
            initialized: true,
        }));
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
        clearClientAuthState();
        set((state) => ({
            user: null,
            isAuthenticated: false,
            authRevision: state.authRevision + 1,
            onboardingComplete: false,
            initialized: true,
        }));
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
