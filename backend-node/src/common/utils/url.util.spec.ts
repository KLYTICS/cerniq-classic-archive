import {
  isValidUrl,
  normalizeUrl,
  isSafeRedirect,
  extractDomain,
  buildUrl,
} from './url.util';

describe('url.util', () => {
  describe('isValidUrl', () => {
    it('accepts valid HTTPS URLs', () => {
      expect(isValidUrl('https://example.com')).toBe(true);
    });

    it('rejects invalid strings', () => {
      expect(isValidUrl('not-a-url')).toBe(false);
    });
  });

  describe('normalizeUrl', () => {
    it('removes default port 443 for HTTPS', () => {
      expect(normalizeUrl('https://example.com:443/path')).toBe(
        'https://example.com/path',
      );
    });

    it('sorts query parameters alphabetically', () => {
      const result = normalizeUrl('https://example.com?z=1&a=2');
      expect(result).toBe('https://example.com/?a=2&z=1');
    });
  });

  describe('isSafeRedirect', () => {
    it('allows relative URLs', () => {
      expect(isSafeRedirect('/dashboard', ['example.com'])).toBe(true);
    });

    it('blocks protocol-relative URLs', () => {
      expect(isSafeRedirect('//evil.com', ['example.com'])).toBe(false);
    });

    it('allows URLs on allowed hosts', () => {
      expect(
        isSafeRedirect('https://app.example.com/page', ['example.com']),
      ).toBe(true);
    });

    it('blocks URLs on disallowed hosts', () => {
      expect(isSafeRedirect('https://evil.com/page', ['example.com'])).toBe(
        false,
      );
    });
  });

  describe('extractDomain', () => {
    it('extracts hostname from URL', () => {
      expect(extractDomain('https://www.example.com:8080/path')).toBe(
        'www.example.com',
      );
    });

    it('returns null for invalid input', () => {
      expect(extractDomain('not-a-url')).toBeNull();
    });
  });

  describe('buildUrl', () => {
    it('builds URL with query parameters', () => {
      const result = buildUrl('https://api.example.com/search', {
        q: 'test',
        page: 1,
      });
      expect(result).toContain('q=test');
      expect(result).toContain('page=1');
    });
  });
});
