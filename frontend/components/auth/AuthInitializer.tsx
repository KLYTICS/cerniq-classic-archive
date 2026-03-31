'use client';

import { useEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { hasStoredAuthHint } from '@/lib/auth-storage';

const AUTH_ROUTE_PREFIXES = [
  '/auth',
  '/dashboard',
  '/onboarding',
  '/portal',
  '/portfolios',
  '/risk-analytics',
  '/settings',
];

const ANONYMOUS_ENTRY_ROUTES = new Set([
  '/login',
  '/portal/login',
  '/signup',
]);

function isAuthRelevantPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

function isAnonymousEntryRoute(pathname: string | null) {
  return pathname ? ANONYMOUS_ENTRY_ROUTES.has(pathname) : false;
}

export default function AuthInitializer() {
  const pathname = usePathname();
  const initialized = useAuthStore((state) => state.initialized);
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);
  const initializeAnonymous = useAuthStore((state) => state.initializeAnonymous);
  const scopeRef = useRef<'auth' | 'public' | null>(null);

  useEffect(() => {
    const hasStoredAuth = hasStoredAuthHint();
    const anonymousEntry = isAnonymousEntryRoute(pathname);
    const shouldHydrate =
      (isAuthRelevantPath(pathname) && !anonymousEntry) || hasStoredAuth;
    const nextScope = shouldHydrate ? 'auth' : 'public';
    const enteringNewScope = scopeRef.current !== nextScope;
    scopeRef.current = nextScope;

    if (!shouldHydrate) {
      if (anonymousEntry && !initialized) {
        initializeAnonymous();
      }
      return;
    }

    if (enteringNewScope || !initialized) {
      void hydrateFromStorage();
    }
  }, [pathname, initialized, hydrateFromStorage, initializeAnonymous]);

  return null;
}
