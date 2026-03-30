export const ACCESS_TOKEN_KEY = 'cerniq_access_token';
export const LEGACY_ACCESS_TOKEN_KEY = 'capex_access_token';
export const AUTH_USER_STORAGE_KEY = 'cerniq_auth_user';
export const LEGACY_AUTH_USER_STORAGE_KEY = 'capex_auth_user';
export const ADMIN_KEY_STORAGE = 'cerniq_admin_key';
export const LEGACY_ADMIN_KEY_STORAGE = 'admin_key';

function canUseBrowserStorage() {
  return typeof window !== 'undefined';
}

export function hasSessionAuthHint() {
  if (!canUseBrowserStorage()) {
    return false;
  }

  return Boolean(
    sessionStorage.getItem(ACCESS_TOKEN_KEY) ||
      sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY),
  );
}

export function clearPersistentAuthArtifacts() {
  if (!canUseBrowserStorage()) {
    return;
  }

  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_USER_STORAGE_KEY);
  localStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE);
}

export function getAccessToken(): string {
  if (!canUseBrowserStorage()) {
    return '';
  }

  const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  const legacySessionToken =
    sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || '';
  if (legacySessionToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, legacySessionToken);
    sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    return legacySessionToken;
  }

  // Strict session-first auth: clear stale durable auth artifacts instead of reviving them.
  clearPersistentAuthArtifacts();
  return '';
}

export function setAccessToken(token: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  clearPersistentAuthArtifacts();
}

export function clearAccessToken() {
  if (!canUseBrowserStorage()) {
    return;
  }

  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

export function setAdminAccessKey(key: string) {
  if (!canUseBrowserStorage()) {
    return;
  }

  sessionStorage.setItem(ADMIN_KEY_STORAGE, key);
  localStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE);
}

export function getAdminAccessKey() {
  if (!canUseBrowserStorage()) {
    return '';
  }

  const sessionKey = sessionStorage.getItem(ADMIN_KEY_STORAGE) || '';
  if (sessionKey) {
    return sessionKey;
  }

  if (localStorage.getItem(LEGACY_ADMIN_KEY_STORAGE)) {
    localStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE);
  }

  return '';
}

export function clearAdminAccessKey() {
  if (!canUseBrowserStorage()) {
    return;
  }

  sessionStorage.removeItem(ADMIN_KEY_STORAGE);
  localStorage.removeItem(LEGACY_ADMIN_KEY_STORAGE);
}

export function clearStoredAuthUser() {
  if (!canUseBrowserStorage()) {
    return;
  }

  localStorage.removeItem(AUTH_USER_STORAGE_KEY);
  localStorage.removeItem(LEGACY_AUTH_USER_STORAGE_KEY);
}

export function clearAuthBrowserState() {
  clearAccessToken();
  clearStoredAuthUser();
  clearAdminAccessKey();
}
