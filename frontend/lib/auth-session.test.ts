import { beforeEach, describe, expect, it } from 'vitest';
import {
  AUTH_USER_STORAGE_KEY,
  ADMIN_KEY_STORAGE,
  LEGACY_ACCESS_TOKEN_KEY,
  LEGACY_AUTH_USER_STORAGE_KEY,
  LEGACY_ADMIN_KEY_STORAGE,
  ACCESS_TOKEN_KEY,
  clearAccessToken,
  clearAuthBrowserState,
  clearPersistentAuthArtifacts,
  clearStoredAuthUser,
  hasSessionAuthHint,
  getAccessToken,
  getAdminAccessKey,
  setAdminAccessKey,
  setAccessToken,
} from './auth-session';

describe('auth-session helpers', () => {
  beforeEach(() => {
    localStorage.clear();
    sessionStorage.clear();
  });

  it('does not revive durable access tokens into an active session', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'durable-token');

    expect(getAccessToken()).toBe('');
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('stores access tokens in session scope and clears legacy copies', () => {
    localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'legacy-token');

    setAccessToken('fresh-token');

    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe('fresh-token');
    expect(localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('surfaces a session auth hint for current and legacy session tokens', () => {
    expect(hasSessionAuthHint()).toBe(false);

    sessionStorage.setItem(ACCESS_TOKEN_KEY, 'fresh-token');
    expect(hasSessionAuthHint()).toBe(true);

    sessionStorage.removeItem(ACCESS_TOKEN_KEY);
    sessionStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'legacy-token');
    expect(hasSessionAuthHint()).toBe(true);
  });

  it('migrates legacy session tokens forward when reading access tokens', () => {
    sessionStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'legacy-session');

    expect(getAccessToken()).toBe('legacy-session');
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe('legacy-session');
    expect(sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('does not revive legacy admin keys from local storage', () => {
    localStorage.setItem(LEGACY_ADMIN_KEY_STORAGE, 'legacy-admin');

    expect(getAdminAccessKey()).toBe('');
    expect(localStorage.getItem(LEGACY_ADMIN_KEY_STORAGE)).toBeNull();
  });

  it('stores admin access keys in session scope only', () => {
    localStorage.setItem(LEGACY_ADMIN_KEY_STORAGE, 'legacy-admin');

    setAdminAccessKey('desk-admin');

    expect(getAdminAccessKey()).toBe('desk-admin');
    expect(sessionStorage.getItem(ADMIN_KEY_STORAGE)).toBe('desk-admin');
    expect(localStorage.getItem(LEGACY_ADMIN_KEY_STORAGE)).toBeNull();
  });

  it('clears access tokens from both session and local storage', () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, 'desk-token');
    sessionStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'legacy-session');
    localStorage.setItem(ACCESS_TOKEN_KEY, 'durable-token');
    localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'legacy-durable');

    clearAccessToken();

    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBeNull();
  });

  it('clears only persistent auth artifacts when requested', () => {
    localStorage.setItem(ACCESS_TOKEN_KEY, 'durable-token');
    localStorage.setItem(LEGACY_ACCESS_TOKEN_KEY, 'legacy-durable');
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify({ id: 'u_1' }));
    localStorage.setItem('capex_auth_user', JSON.stringify({ id: 'u_legacy' }));
    localStorage.setItem(LEGACY_ADMIN_KEY_STORAGE, 'legacy-admin');
    sessionStorage.setItem(ACCESS_TOKEN_KEY, 'session-token');

    clearPersistentAuthArtifacts();

    expect(localStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('capex_auth_user')).toBeNull();
    expect(localStorage.getItem(LEGACY_ADMIN_KEY_STORAGE)).toBeNull();
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe('session-token');
  });

  it('clears stored auth users without touching session keys', () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, 'desk-token');
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify({ id: 'u_1' }));
    localStorage.setItem('capex_auth_user', JSON.stringify({ id: 'u_legacy' }));

    clearStoredAuthUser();

    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem('capex_auth_user')).toBeNull();
    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBe('desk-token');
  });

  it('clears user, token, and admin desk artifacts together', () => {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, 'desk-token');
    sessionStorage.setItem(ADMIN_KEY_STORAGE, 'desk-admin');
    localStorage.setItem(AUTH_USER_STORAGE_KEY, JSON.stringify({ id: 'u_1' }));
    localStorage.setItem(LEGACY_ADMIN_KEY_STORAGE, 'legacy-admin');

    clearAuthBrowserState();

    expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
    expect(sessionStorage.getItem(ADMIN_KEY_STORAGE)).toBeNull();
    expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
    expect(localStorage.getItem(LEGACY_ADMIN_KEY_STORAGE)).toBeNull();
  });

  it('returns safe defaults when browser storage is unavailable', () => {
    const originalWindow = globalThis.window;
    Reflect.deleteProperty(globalThis, 'window');

    try {
      expect(hasSessionAuthHint()).toBe(false);
      expect(getAccessToken()).toBe('');
      expect(getAdminAccessKey()).toBe('');

      clearAccessToken();
      clearStoredAuthUser();
      clearPersistentAuthArtifacts();
      clearAuthBrowserState();
      setAccessToken('serverless-token');
      setAdminAccessKey('serverless-admin');

      expect(sessionStorage.getItem(ACCESS_TOKEN_KEY)).toBeNull();
      expect(sessionStorage.getItem(ADMIN_KEY_STORAGE)).toBeNull();
      expect(localStorage.getItem(AUTH_USER_STORAGE_KEY)).toBeNull();
      expect(localStorage.getItem(LEGACY_AUTH_USER_STORAGE_KEY)).toBeNull();
    } finally {
      Object.defineProperty(globalThis, 'window', {
        configurable: true,
        value: originalWindow,
      });
    }
  });
});
