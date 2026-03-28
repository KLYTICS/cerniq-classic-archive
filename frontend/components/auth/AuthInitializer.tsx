'use client';

import { useLayoutEffect, useRef } from 'react';
import { usePathname } from 'next/navigation';
import { useAuthStore } from '@/lib/store';

const AUTH_ROUTE_PREFIXES = [
  '/auth',
  '/dashboard',
  '/login',
  '/onboarding',
  '/portal',
  '/portfolios',
  '/risk-analytics',
  '/settings',
  '/signup',
];

function hasStoredAuthHint() {
  if (typeof window === 'undefined') {
    return false;
  }

  return [
    sessionStorage.getItem('cerniq_access_token'),
    sessionStorage.getItem('capex_access_token'),
    localStorage.getItem('cerniq_access_token'),
    localStorage.getItem('capex_access_token'),
    localStorage.getItem('cerniq_auth_user'),
    localStorage.getItem('capex_auth_user'),
  ].some(Boolean);
}

function isAuthRelevantPath(pathname: string | null) {
  if (!pathname) {
    return false;
  }

  return AUTH_ROUTE_PREFIXES.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

export default function AuthInitializer() {
  const pathname = usePathname();
  const initialized = useAuthStore((state) => state.initialized);
  const hydrateFromStorage = useAuthStore((state) => state.hydrateFromStorage);
  const scopeRef = useRef<'auth' | 'public' | null>(null);

  useLayoutEffect(() => {
    const shouldHydrate = isAuthRelevantPath(pathname) || hasStoredAuthHint();
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
