import { extractClientIP, parseUserAgent } from './http.util';

describe('http.util', () => {
  describe('extractClientIP', () => {
    it('extracts IP from x-forwarded-for header', () => {
      const req = {
        headers: { 'x-forwarded-for': '203.0.113.50, 70.41.3.18' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;
      expect(extractClientIP(req)).toBe('203.0.113.50');
    });

    it('extracts IP from cf-connecting-ip header', () => {
      const req = {
        headers: { 'cf-connecting-ip': '1.2.3.4' },
        ip: '127.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;
      expect(extractClientIP(req)).toBe('1.2.3.4');
    });

    it('falls back to req.ip', () => {
      const req = {
        headers: {},
        ip: '10.0.0.1',
        socket: { remoteAddress: '127.0.0.1' },
      } as any;
      expect(extractClientIP(req)).toBe('10.0.0.1');
    });
  });

  describe('parseUserAgent', () => {
    it('detects Chrome on macOS', () => {
      const ua = 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) Chrome/120.0.0.0';
      const info = parseUserAgent(ua);
      expect(info.browser).toBe('Chrome');
      expect(info.os).toBe('macOS');
      expect(info.isBot).toBe(false);
      expect(info.isMobile).toBe(false);
    });

    it('detects bots', () => {
      const info = parseUserAgent('Googlebot/2.1 (+http://www.google.com/bot.html)');
      expect(info.isBot).toBe(true);
    });

    it('handles undefined user agent', () => {
      const info = parseUserAgent(undefined);
      expect(info.raw).toBe('');
      expect(info.browser).toBe('Unknown');
    });
  });
});
