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
});
