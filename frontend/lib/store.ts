import { create } from 'zustand';
import { apiClient } from './api';
import {
    clearAuthBrowserState,
    clearPersistentAuthArtifacts,
} from './auth-session';

interface User {
    id: string;
    email: string;
    name?: string;
}

export type AuthBootstrapState =
    | 'authenticated_from_server'
    | 'authenticated_from_login'
    | 'unauthenticated';

interface AuthState {
    user: User | null;
    initialized: boolean;
    isAuthenticated: boolean;
    authRevision: number;
    authBootstrapState: AuthBootstrapState;
    onboardingComplete: boolean;
    hydrateFromStorage: () => Promise<void>;
    initializeAnonymous: () => void;
    setUser: (user: User | null) => void;
    setOnboardingComplete: (complete: boolean) => void;
    logout: () => Promise<void>;
}
const onboardingKey = (userId: string) => `cerniq_onboarding_${userId}`;

export function shouldProbeServerSession() {
    if (typeof window === 'undefined') {
        return false;
    }

    const nodeApiUrl = (process.env.NEXT_PUBLIC_NODE_API_URL || '').trim();
    if (!nodeApiUrl) {
        return true;
    }

    try {
        const apiUrl = new URL(nodeApiUrl, window.location.origin);
        const localHosts = new Set(['localhost', '127.0.0.1']);
        const isLocalFrontend = localHosts.has(window.location.hostname);
        const isLocalBackend = localHosts.has(apiUrl.hostname);

        if (isLocalFrontend && isLocalBackend && apiUrl.origin !== window.location.origin) {
            return false;
        }
    } catch {
        return true;
    }

    return true;
}

function asRecord(value: unknown): Record<string, unknown> | null {
    return value !== null && typeof value === 'object' ? (value as Record<string, unknown>) : null;
}

export function normalizeUser(payload: unknown): User | null {
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
    authBootstrapState: 'unauthenticated',
    onboardingComplete: false,
    hydrateFromStorage: async () => {
        if (typeof window === 'undefined') {
            set({ initialized: true, authBootstrapState: 'unauthenticated' });
            return;
        }

        set({ initialized: false });

        const setUnauthenticated = () =>
            set((state) => ({
                user: null,
                isAuthenticated: false,
                authRevision: state.authRevision + 1,
                authBootstrapState: 'unauthenticated',
                onboardingComplete: false,
                initialized: true,
            }));

        const setAuthenticated = (
            user: User,
            authBootstrapState: Exclude<AuthBootstrapState, 'unauthenticated'>,
        ) => {
            const onboardingComplete = localStorage.getItem(onboardingKey(user.id)) === 'true';
            set((state) => ({
                user,
                isAuthenticated: true,
                authRevision: state.authRevision + 1,
                authBootstrapState,
                onboardingComplete,
                initialized: true,
            }));
        };

        clearPersistentAuthArtifacts();

        // OAuth/login may have a valid server-side cookie before localStorage is populated.
        if (shouldProbeServerSession()) {
            try {
                const profile = await apiClient.getCurrentUser();
                const profileUser = normalizeUser(profile);
                if (profileUser) {
                    setAuthenticated(profileUser, 'authenticated_from_server');
                    return;
                }
            } catch {
                // No active session or profile endpoint unavailable.
            }
        }

        setUnauthenticated();
    },
    initializeAnonymous: () => {
        set((state) => ({
            user: null,
            isAuthenticated: false,
            authRevision: state.authRevision + 1,
            authBootstrapState: 'unauthenticated',
            onboardingComplete: false,
            initialized: true,
        }));
    },
    setUser: (user) => {
        clearPersistentAuthArtifacts();

        const onboardingComplete = user
            ? (typeof window !== 'undefined' && localStorage.getItem(onboardingKey(user.id)) === 'true')
            : false;

        set((state) => ({
            user,
            isAuthenticated: Boolean(user),
            authRevision: state.authRevision + 1,
            authBootstrapState: user ? 'authenticated_from_login' : 'unauthenticated',
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
        clearAuthBrowserState();
        set((state) => ({
            user: null,
            isAuthenticated: false,
            authRevision: state.authRevision + 1,
            authBootstrapState: 'unauthenticated',
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
