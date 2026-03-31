export const ACCESS_TOKEN_KEY = 'cerniq_access_token';
export const LEGACY_ACCESS_TOKEN_KEY = 'capex_access_token';
export const AUTH_USER_STORAGE_KEY = 'cerniq_auth_user';
export const LEGACY_AUTH_USER_STORAGE_KEY = 'capex_auth_user';
export const PORTAL_USER_STORAGE_KEY = 'cerniq_portal_user';

export function hasStoredAuthHint() {
  if (typeof window === 'undefined') {
    return false;
  }

  return [
    sessionStorage.getItem(ACCESS_TOKEN_KEY),
    sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY),
    localStorage.getItem(ACCESS_TOKEN_KEY),
    localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY),
    localStorage.getItem(AUTH_USER_STORAGE_KEY),
    localStorage.getItem(LEGACY_AUTH_USER_STORAGE_KEY),
    localStorage.getItem(PORTAL_USER_STORAGE_KEY),
  ].some(Boolean);
}

export function clearClientAuthState(): void {
  if (typeof window === 'undefined') {
    return;
  }

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_USER_STORAGE_KEY);
  localStorage.removeItem(PORTAL_USER_STORAGE_KEY);
}
