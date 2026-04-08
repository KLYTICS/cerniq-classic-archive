'use client';

import { asRecord, unwrapApiData } from './api-response';
import { getPublicApiUrl } from './api-base';

const ACCESS_TOKEN_KEY = 'cerniq_access_token';
const LEGACY_ACCESS_TOKEN_KEY = 'capex_access_token';
const REFRESH_ENDPOINT = '/api/auth/refresh';

function normalizeInputUrl(input: RequestInfo | URL): URL | null {
  if (typeof window === 'undefined') {
    return null;
  }

  const raw =
    typeof input === 'string'
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;

  return new URL(raw, window.location.origin);
}

function isProtectedApiRequest(input: RequestInfo | URL): boolean {
  const normalizedUrl = normalizeInputUrl(input);
  if (!normalizedUrl || typeof window === 'undefined') {
    return false;
  }

  return (
    normalizedUrl.origin === window.location.origin &&
    normalizedUrl.pathname.startsWith('/api/')
  );
}

export function getStoredAccessToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  const legacySession = sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || '';
  if (legacySession) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, legacySession);
    sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    return legacySession;
  }

  const legacyToken =
    localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) ||
    localStorage.getItem(ACCESS_TOKEN_KEY) ||
    '';

  if (legacyToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, legacyToken);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }

  return legacyToken;
}

export function setStoredAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

export function clearStoredAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

function buildRequestInit(
  input: RequestInfo | URL,
  init?: RequestInit,
  accessToken?: string,
): RequestInit {
  const headers = new Headers(init?.headers);

  if (accessToken && isProtectedApiRequest(input)) {
    headers.set('Authorization', `Bearer ${accessToken}`);
  }

  return {
    ...init,
    credentials: init?.credentials ?? 'include',
    headers,
  };
}

async function tryRefreshAccessToken(): Promise<string | null> {
  if (typeof window === 'undefined') {
    return null;
  }

  const response = await fetch(getPublicApiUrl(REFRESH_ENDPOINT), {
    method: 'POST',
    credentials: 'include',
    headers: { 'Content-Type': 'application/json' },
  });

  if (!response.ok) {
    clearStoredAccessToken();
    return null;
  }

  const payload = asRecord(
    unwrapApiData<Record<string, unknown> | null>(
      await response.json().catch(() => null),
    ),
  );
  const nextToken =
    payload && typeof payload.accessToken === 'string'
      ? payload.accessToken
      : '';

  if (nextToken) {
    setStoredAccessToken(nextToken);
    return nextToken;
  }

  clearStoredAccessToken();
  return null;
}

export async function fetchWithAppAuth(
  input: RequestInfo | URL,
  init?: RequestInit,
): Promise<Response> {
  const firstToken = getStoredAccessToken();
  const firstResponse = await fetch(
    input,
    buildRequestInit(input, init, firstToken),
  );

  if (
    firstResponse.status !== 401 ||
    typeof window === 'undefined' ||
    normalizeInputUrl(input)?.pathname === REFRESH_ENDPOINT
  ) {
    return firstResponse;
  }

  const refreshedToken = await tryRefreshAccessToken();
  if (!refreshedToken) {
    return firstResponse;
  }

  return fetch(input, buildRequestInit(input, init, refreshedToken));
}
