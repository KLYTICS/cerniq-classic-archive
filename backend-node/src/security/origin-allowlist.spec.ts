import { isAllowedOrigin, corsOriginCallback } from './origin-allowlist';

describe('origin-allowlist', () => {
  const originalEnv = { ...process.env };

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  describe('isAllowedOrigin', () => {
    it('allows undefined/null origin (same-origin or server-to-server)', () => {
      expect(isAllowedOrigin(undefined)).toBe(true);
      expect(isAllowedOrigin(null)).toBe(true);
    });

    it('allows cerniq.io domain', () => {
      expect(isAllowedOrigin('https://cerniq.io')).toBe(true);
    });

    it('allows subdomains of cerniq.io', () => {
      expect(isAllowedOrigin('https://app.cerniq.io')).toBe(true);
      expect(isAllowedOrigin('https://staging.cerniq.io')).toBe(true);
    });

    it('allows cerniqtech.com domain', () => {
      expect(isAllowedOrigin('https://cerniqtech.com')).toBe(true);
      expect(isAllowedOrigin('https://api.cerniqtech.com')).toBe(true);
    });

    it('allows localhost in non-production', () => {
      process.env.NODE_ENV = 'development';
      expect(isAllowedOrigin('http://localhost:3000')).toBe(true);
      expect(isAllowedOrigin('http://localhost:3001')).toBe(true);
    });

    it('rejects random external origins', () => {
      process.env.NODE_ENV = 'production';
      expect(isAllowedOrigin('https://evil.com')).toBe(false);
      expect(isAllowedOrigin('https://not-cerniq.io')).toBe(false);
    });

    it('rejects invalid URL formats', () => {
      expect(isAllowedOrigin('not-a-url')).toBe(false);
      expect(isAllowedOrigin('ftp://cerniq.io')).toBe(false);
    });

    it('allows origins from FRONTEND_URL env var', () => {
      process.env.FRONTEND_URL = 'https://custom-frontend.example.com';
      expect(isAllowedOrigin('https://custom-frontend.example.com')).toBe(true);
    });

    it('allows origins from ALLOWED_ORIGINS csv', () => {
      process.env.ALLOWED_ORIGINS =
        'https://partner1.com, https://partner2.com';
      expect(isAllowedOrigin('https://partner1.com')).toBe(true);
      expect(isAllowedOrigin('https://partner2.com')).toBe(true);
    });

    it('allows origins from CORS_ORIGIN csv', () => {
      process.env.CORS_ORIGIN = 'https://cors-allowed.com';
      expect(isAllowedOrigin('https://cors-allowed.com')).toBe(true);
    });

    it('allows Vercel preview origins when enabled', () => {
      process.env.ALLOW_PREVIEW_ORIGINS = 'true';
      expect(isAllowedOrigin('https://my-app-ekiess-projects.vercel.app')).toBe(
        true,
      );
    });

    it('rejects Vercel preview origins when not enabled', () => {
      process.env.ALLOW_PREVIEW_ORIGINS = '';
      process.env.NODE_ENV = 'production';
      // This should not match the preview regex when preview origins are disabled
      // and it's not in the static allowlist
      expect(isAllowedOrigin('https://random-ekiess-projects.vercel.app')).toBe(
        false,
      );
    });

    it('normalizes origins by stripping trailing slashes and paths', () => {
      expect(isAllowedOrigin('https://cerniq.io/')).toBe(true);
      expect(isAllowedOrigin('https://cerniq.io/some/path')).toBe(true);
    });
  });

  describe('corsOriginCallback', () => {
    it('calls callback with null error and true for allowed origins', () => {
      const callback = jest.fn();
      corsOriginCallback('https://cerniq.io', callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });

    it('calls callback with Error for disallowed origins', () => {
      process.env.NODE_ENV = 'production';
      const callback = jest.fn();
      corsOriginCallback('https://evil.com', callback);
      expect(callback).toHaveBeenCalledWith(expect.any(Error), false);
    });

    it('includes origin in error message', () => {
      process.env.NODE_ENV = 'production';
      const callback = jest.fn();
      corsOriginCallback('https://blocked.com', callback);
      const error = callback.mock.calls[0][0] as Error;
      expect(error.message).toContain('blocked.com');
    });

    it('allows undefined origin (same-origin)', () => {
      const callback = jest.fn();
      corsOriginCallback(undefined, callback);
      expect(callback).toHaveBeenCalledWith(null, true);
    });
  });
});
