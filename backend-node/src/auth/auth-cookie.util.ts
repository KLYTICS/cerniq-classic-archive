const isProduction = process.env.NODE_ENV === 'production';

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized) {
    return fallback;
  }
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
  const configured = (process.env.AUTH_COOKIE_SAMESITE || '')
    .trim()
    .toLowerCase();

  if (
    configured === 'strict' ||
    configured === 'none' ||
    configured === 'lax'
  ) {
    return configured;
  }

  return 'lax';
}

function resolveCookieDomain(): string {
  const configured = (process.env.AUTH_COOKIE_DOMAIN || '').trim();
  if (configured) {
    return configured;
  }

  if (!isProduction) {
    return '';
  }

  try {
    const frontendUrl = new URL(resolveFrontendUrl());
    const hostname = frontendUrl.hostname.trim().toLowerCase();
    const labels = hostname.split('.').filter(Boolean);

    if (
      !hostname ||
      hostname === 'localhost' ||
      /^\d{1,3}(?:\.\d{1,3}){3}$/.test(hostname) ||
      labels.length < 2
    ) {
      return '';
    }

    return `.${labels.slice(-2).join('.')}`;
  } catch {
    return '';
  }
}

export function resolveFrontendUrl(): string {
  const configured = (process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (configured) {
    return configured;
  }

  if (!isProduction) {
    return 'http://localhost:3001';
  }

  return 'https://cerniq.io';
}

export function getAuthCookieOptions() {
  const cookieDomain = resolveCookieDomain();

  return {
    httpOnly: true,
    secure: parseBoolean(process.env.AUTH_COOKIE_SECURE, isProduction),
    sameSite: resolveCookieSameSite(),
    path: '/',
    ...(cookieDomain ? { domain: cookieDomain } : {}),
  };
}

const ACCESS_TOKEN_MAX_AGE = 24 * 60 * 60 * 1000; // 24h
const REFRESH_TOKEN_MAX_AGE = 7 * 24 * 60 * 60 * 1000; // 7d

export function setAuthCookies(
  res: {
    cookie: (
      name: string,
      value: string,
      options: Record<string, unknown>,
    ) => void;
  },
  accessToken: string,
  refreshToken: string,
) {
  const cookieOptions = getAuthCookieOptions();

  res.cookie('access_token', accessToken, {
    ...cookieOptions,
    maxAge: ACCESS_TOKEN_MAX_AGE,
  });
  res.cookie('refresh_token', refreshToken, {
    ...cookieOptions,
    maxAge: REFRESH_TOKEN_MAX_AGE,
  });
}

export function clearAuthCookies(
  res: {
    clearCookie: (
      name: string,
      options: Record<string, unknown>,
    ) => void;
  },
) {
  const cookieOptions = getAuthCookieOptions();

  res.clearCookie('access_token', cookieOptions);
  res.clearCookie('refresh_token', cookieOptions);
}
