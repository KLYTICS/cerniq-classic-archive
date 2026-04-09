import {
  getGoogleOAuthWarnings,
  resolveGithubCallbackUrl,
  resolveGoogleCallbackUrl,
} from './oauth-config.util';

describe('oauth-config.util', () => {
  const OLD_ENV = process.env;

  beforeEach(() => {
    process.env = { ...OLD_ENV };
  });

  afterAll(() => {
    process.env = OLD_ENV;
  });

  describe('resolveGoogleCallbackUrl', () => {
    it('uses the configured Google callback URL', () => {
      process.env.GOOGLE_CALLBACK_URL = 'https://custom.example.com/callback/';

      expect(resolveGoogleCallbackUrl()).toBe(
        'https://custom.example.com/callback',
      );
    });

    it('falls back to the production callback URL', () => {
      delete process.env.GOOGLE_CALLBACK_URL;

      expect(resolveGoogleCallbackUrl()).toBe(
        'https://api.cerniq.io/api/auth/google/callback',
      );
    });
  });

  describe('resolveGithubCallbackUrl', () => {
    it('falls back to the production callback URL', () => {
      delete process.env.GITHUB_CALLBACK_URL;

      expect(resolveGithubCallbackUrl()).toBe(
        'https://api.cerniq.io/api/auth/github/callback',
      );
    });
  });

  describe('getGoogleOAuthWarnings', () => {
    it('returns no warnings outside production', () => {
      process.env.NODE_ENV = 'development';
      process.env.GOOGLE_CLIENT_ID = 'client-id';

      expect(getGoogleOAuthWarnings()).toEqual([]);
    });

    it('returns no warnings when Google OAuth is entirely disabled', () => {
      process.env.NODE_ENV = 'production';
      delete process.env.GOOGLE_CLIENT_ID;
      delete process.env.GOOGLE_CLIENT_SECRET;
      delete process.env.GOOGLE_CALLBACK_URL;
      delete process.env.FRONTEND_URL;

      expect(getGoogleOAuthWarnings()).toEqual([]);
    });

    it('warns when production Google OAuth is partially configured or mismatched', () => {
      process.env.NODE_ENV = 'production';
      process.env.GOOGLE_CLIENT_ID = 'client-id';
      process.env.FRONTEND_URL = 'https://staging.cerniq.io';
      process.env.GOOGLE_CALLBACK_URL =
        'https://cerniq.io/api/auth/google/callback';
      process.env.AUTH_COOKIE_DOMAIN = 'cerniq.io';
      delete process.env.GOOGLE_CLIENT_SECRET;

      expect(getGoogleOAuthWarnings()).toEqual(
        expect.arrayContaining([
          'GOOGLE_CLIENT_SECRET not set — Google OAuth callback exchange will fail in production.',
          'FRONTEND_URL is "https://staging.cerniq.io" but production Google OAuth expects "https://cerniq.io".',
          'GOOGLE_CALLBACK_URL is "https://cerniq.io/api/auth/google/callback" but Google Cloud must allow "https://api.cerniq.io/api/auth/google/callback".',
          'AUTH_COOKIE_DOMAIN is "cerniq.io" but cross-subdomain auth for cerniq.io expects ".cerniq.io".',
          'Google Cloud OAuth client must be a Web application with authorized JavaScript origins "https://cerniq.io" and "https://api.cerniq.io", plus redirect URI "https://api.cerniq.io/api/auth/google/callback".',
        ]),
      );
    });
  });
});
