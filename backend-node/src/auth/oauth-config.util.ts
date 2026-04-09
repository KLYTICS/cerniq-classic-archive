const PROD_FRONTEND_ORIGIN = 'https://cerniq.io';
const PROD_API_ORIGIN = 'https://api.cerniq.io';
const PROD_GOOGLE_CALLBACK_URL = `${PROD_API_ORIGIN}/api/auth/google/callback`;
const PROD_GITHUB_CALLBACK_URL = `${PROD_API_ORIGIN}/api/auth/github/callback`;

function trimTrailingSlashes(value: string | undefined): string {
  return (value || '').trim().replace(/\/+$/, '');
}

export function resolveGoogleCallbackUrl(): string {
  return (
    trimTrailingSlashes(process.env.GOOGLE_CALLBACK_URL) ||
    PROD_GOOGLE_CALLBACK_URL
  );
}

export function resolveGithubCallbackUrl(): string {
  return (
    trimTrailingSlashes(process.env.GITHUB_CALLBACK_URL) ||
    PROD_GITHUB_CALLBACK_URL
  );
}

export function getGoogleOAuthWarnings(env = process.env): string[] {
  const warnings: string[] = [];
  const isProd = env.NODE_ENV === 'production';

  if (!isProd) {
    return warnings;
  }

  const frontendUrl = trimTrailingSlashes(env.FRONTEND_URL);
  const callbackUrl = trimTrailingSlashes(env.GOOGLE_CALLBACK_URL);
  const cookieDomain = (env.AUTH_COOKIE_DOMAIN || '').trim();
  const clientId = (env.GOOGLE_CLIENT_ID || '').trim();
  const clientSecret = (env.GOOGLE_CLIENT_SECRET || '').trim();

  const googleConfigured = Boolean(
    clientId || clientSecret || callbackUrl || frontendUrl,
  );

  if (!googleConfigured) {
    return warnings;
  }

  if (!clientId) {
    warnings.push(
      'GOOGLE_CLIENT_ID not set — Google OAuth requests will fail with invalid_client.',
    );
  }

  if (!clientSecret) {
    warnings.push(
      'GOOGLE_CLIENT_SECRET not set — Google OAuth callback exchange will fail in production.',
    );
  }

  if (frontendUrl && frontendUrl !== PROD_FRONTEND_ORIGIN) {
    warnings.push(
      `FRONTEND_URL is "${frontendUrl}" but production Google OAuth expects "${PROD_FRONTEND_ORIGIN}".`,
    );
  }

  if (callbackUrl && callbackUrl !== PROD_GOOGLE_CALLBACK_URL) {
    warnings.push(
      `GOOGLE_CALLBACK_URL is "${callbackUrl}" but Google Cloud must allow "${PROD_GOOGLE_CALLBACK_URL}".`,
    );
  }

  if (cookieDomain && cookieDomain !== '.cerniq.io') {
    warnings.push(
      `AUTH_COOKIE_DOMAIN is "${cookieDomain}" but cross-subdomain auth for cerniq.io expects ".cerniq.io".`,
    );
  }

  warnings.push(
    `Google Cloud OAuth client must be a Web application with authorized JavaScript origins "${PROD_FRONTEND_ORIGIN}" and "${PROD_API_ORIGIN}", plus redirect URI "${PROD_GOOGLE_CALLBACK_URL}".`,
  );

  return warnings;
}
