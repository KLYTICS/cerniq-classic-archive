'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';
import { hasSessionAuthHint } from '@/lib/auth-session';

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

export function isAuthRelevantPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export function isAnonymousEntryRoute(pathname: string | null) {
  return pathname ? ANONYMOUS_ENTRY_ROUTES.has(pathname) : false;
}

export default function AuthInitializer() {
  const pathname = usePathname();
  const initialized = useAuthStore((state) => state.initialized);
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);
  const scopeRef = useRef<'auth' | 'public' | null>(null);

  useLayoutEffect(() => {
    const hasStoredAuth = hasSessionAuthHint();
    const shouldHydrate =
      isAuthRelevantPath(pathname) ||
      isAnonymousEntryRoute(pathname) ||
      hasStoredAuth;
    const nextScope = shouldHydrate ? 'auth' : 'public';
    const enteringNewScope = scopeRef.current !== nextScope;
    scopeRef.current = nextScope;

    if (!shouldHydrate) {
      return;
    }

    if (enteringNewScope || !initialized) {
      void hydrateFromStorage();
    }
  }, [pathname, initialized, hydrateFromStorage]);

  return null;
}
