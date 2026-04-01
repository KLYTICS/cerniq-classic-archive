import { Test, TestingModule } from '@nestjs/testing';
import { EmailService } from './email.service';

// Mock Resend
jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: jest.fn().mockResolvedValue({ id: 'msg-123' }),
    },
  })),
}));

describe('EmailService', () => {
  let service: EmailService;

  beforeEach(async () => {
    process.env.RESEND_API_KEY = 'test-resend-key';
    process.env.FRONTEND_URL = 'https://test.cerniq.io';

    const module: TestingModule = await Test.createTestingModule({
      providers: [EmailService],
    }).compile();

    service = module.get<EmailService>(EmailService);
  });

  afterEach(() => {
    delete process.env.RESEND_API_KEY;
    delete process.env.FRONTEND_URL;
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('sendClientWelcome', () => {
    it('should send welcome email without throwing', async () => {
      await expect(
        service.sendClientWelcome({
          email: 'test@example.com',
          name: 'Test User',
          tier: 'Silver',
          magicUrl: 'https://cerniq.io/auth/magic?token=abc',
          institutionName: 'Cooperativa Test',
        }),
      ).resolves.not.toThrow();
    });

    it('should handle dry-run when resend is not configured', async () => {
      (service as any).resend = null;
      await expect(
        service.sendClientWelcome({
          email: 'test@example.com',
          name: 'Test',
          tier: 'Gold',
          magicUrl: 'https://cerniq.io/auth/magic?token=xyz',
          institutionName: 'Cooperativa Demo',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendDataSubmissionAck', () => {
    it('should send acknowledgment email without throwing', async () => {
      await expect(
        service.sendDataSubmissionAck({
          email: 'test@example.com',
          name: 'Test User',
          institutionName: 'Cooperativa Test',
        }),
      ).resolves.not.toThrow();
    });

    it('should handle dry-run gracefully', async () => {
      (service as any).resend = null;
      await expect(
        service.sendDataSubmissionAck({
          email: 'test@example.com',
          name: 'Test',
          institutionName: 'Demo CU',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('frontendUrl', () => {
    it('should strip trailing slashes from FRONTEND_URL', () => {
      process.env.FRONTEND_URL = 'https://cerniq.io///';
      const url = (service as any).frontendUrl();
      expect(url).toBe('https://cerniq.io');
    });
  });

  // ── adminEmail ─────────────────────────────────────────────
  describe('adminEmail', () => {
    it('returns ERWIN_EMAIL env var when set', () => {
      process.env.ERWIN_EMAIL = 'custom@example.com';
      const email = (service as any).adminEmail();
      expect(email).toBe('custom@example.com');
      delete process.env.ERWIN_EMAIL;
    });

    it('returns default email when ERWIN_EMAIL is not set', () => {
      delete process.env.ERWIN_EMAIL;
      const email = (service as any).adminEmail();
      expect(email).toBe('eskiessalfonso@gmail.com');
    });
  });

  // ── wrap() HTML helper ─────────────────────────────────────
  describe('wrap', () => {
    it('returns valid HTML with CERNIQ branding', () => {
      const html = (service as any).wrap('<p>Hello</p>');
      expect(html).toContain('CERNIQ');
      expect(html).toContain('<p>Hello</p>');
      expect(html).toContain('<!DOCTYPE html>');
    });

    it('includes CTA button when ctaUrl and ctaText are provided', () => {
      const html = (service as any).wrap(
        '<p>Body</p>',
        'https://example.com/action',
        'Click Me',
      );
      expect(html).toContain('https://example.com/action');
      expect(html).toContain('Click Me');
    });

    it('omits CTA button when ctaUrl is not provided', () => {
      const html = (service as any).wrap('<p>No CTA</p>');
      expect(html).not.toContain('#E8A020'); // CTA button background color absent from body
      // The CTA block should not contain an <a> with the button style
      expect(html).not.toContain('padding: 16px 36px');
    });
  });

  // ── dry-run logging when RESEND_API_KEY missing ────────────
  describe('dry-run behavior', () => {
    it('sendReportReady does not throw in dry-run mode', async () => {
      (service as any).resend = null;
      await expect(
        service.sendReportReady({
          email: 'test@example.com',
          name: 'Test',
          institutionName: 'Coop Demo',
          portalUrl: 'https://cerniq.io/portal/123',
        }),
      ).resolves.not.toThrow();
    });

    it('sendClientWelcome logs dry-run when resend is null', async () => {
      (service as any).resend = null;
      const logSpy = jest.spyOn((service as any).logger, 'log');
      await service.sendClientWelcome({
        email: 'dry@example.com',
        name: 'Dry',
        tier: 'Bronze',
        magicUrl: 'https://cerniq.io/magic/abc',
        institutionName: 'Dry Coop',
      });
      expect(logSpy).toHaveBeenCalledWith(
        expect.stringContaining('[DRY RUN]'),
      );
    });
  });
});
