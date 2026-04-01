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

  describe('sendReportReady', () => {
    it('should send report ready email without throwing', async () => {
      await expect(
        service.sendReportReady({
          email: 'test@example.com',
          name: 'Test',
          institutionName: 'Coop Ready',
          portalUrl: 'https://cerniq.io/portal/reports/42',
        }),
      ).resolves.not.toThrow();
    });

    it('should handle dry-run gracefully', async () => {
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
  });

  describe('sendMagicLinkEmail', () => {
    it('should send magic link email without throwing', async () => {
      await expect(
        service.sendMagicLinkEmail({
          email: 'test@example.com',
          magicUrl: 'https://cerniq.io/magic/abc',
          name: 'Test',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendJobFailedAlert', () => {
    it('should send job failed alert without throwing', async () => {
      await expect(
        service.sendJobFailedAlert({
          jobId: 'job_001',
          institutionName: 'Coop',
          error: 'timeout',
          clientEmail: 'client@example.com',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendPaymentFailed', () => {
    it('should send payment failed email without throwing', async () => {
      await expect(
        service.sendPaymentFailed({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendCancellationEmail', () => {
    it('should send cancellation email without throwing', async () => {
      await expect(
        service.sendCancellationEmail({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendMonthlyReportCycle', () => {
    it('should send monthly cycle email without throwing', async () => {
      await expect(
        service.sendMonthlyReportCycle({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendDataSubmissionReminder (B2)', () => {
    it('should send B2 reminder without throwing', async () => {
      await expect(
        service.sendDataSubmissionReminder({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendOnboardingCheckIn (B3)', () => {
    it('should send B3 check-in without throwing', async () => {
      await expect(
        service.sendOnboardingCheckIn({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendReportFollowUp (C2)', () => {
    it('should send C2 follow-up without throwing', async () => {
      await expect(
        service.sendReportFollowUp({
          email: 'test@example.com',
          name: 'Test',
          institutionName: 'Coop',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendWinBackEmail (D5)', () => {
    it('should send D5 win-back without throwing', async () => {
      await expect(
        service.sendWinBackEmail({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendLeadNurtureTeaser (A1)', () => {
    it('should send A1 teaser without throwing', async () => {
      await expect(
        service.sendLeadNurtureTeaser({
          email: 'test@example.com',
          name: 'Test',
          institutionName: 'Coop Test',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendLeadNurturePricing (A2)', () => {
    it('should send A2 pricing without throwing', async () => {
      await expect(
        service.sendLeadNurturePricing({ email: 'test@example.com', name: 'Test' }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendDemoRequestNotification', () => {
    it('should send demo request notification without throwing', async () => {
      await expect(
        service.sendDemoRequestNotification({
          email: 'demo@example.com',
          name: 'Demo User',
          institutionName: 'Demo Coop',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendLeadNotification', () => {
    it('should send lead notification without throwing', async () => {
      await expect(
        service.sendLeadNotification({
          leadId: 'lead_001',
          name: 'Lead User',
          email: 'lead@example.com',
          role: 'CFO',
          institutionName: 'Lead Coop',
          institutionType: 'cooperativa',
          priority: 'HIGH',
          nextFollowUp: new Date('2026-04-05'),
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendLeadConfirmation', () => {
    it('should send bilingual lead confirmation without throwing', async () => {
      await expect(
        service.sendLeadConfirmation({
          name: 'Prospect',
          email: 'prospect@example.com',
          institutionName: 'Prospect Coop',
          bilingual: true,
        }),
      ).resolves.not.toThrow();
    });

    it('should send Spanish-only lead confirmation without throwing', async () => {
      await expect(
        service.sendLeadConfirmation({
          name: 'Prospect',
          email: 'prospect@example.com',
          institutionName: 'Prospect Coop',
          bilingual: false,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendRevenueAlert', () => {
    it('should send revenue alert without throwing', async () => {
      await expect(
        service.sendRevenueAlert({
          amount: 499,
          tier: 'monthly',
          customerEmail: 'customer@example.com',
          institutionName: 'Revenue Coop',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendDisputeAlert', () => {
    it('should send dispute alert without throwing', async () => {
      await expect(
        service.sendDisputeAlert({
          chargeId: 'ch_123',
          amount: 299,
          reason: 'fraudulent',
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

    it('should return default when FRONTEND_URL is not set', () => {
      delete process.env.FRONTEND_URL;
      const url = (service as any).frontendUrl();
      expect(url).toBe('https://cerniq.io');
    });
  });

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
      expect(html).not.toContain('padding: 16px 36px');
    });
  });

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

  describe('error handling with mock resend', () => {
    it('should not throw when resend.emails.send rejects', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Network error'));
      (service as any).resend = { emails: { send: mockSend } };

      await expect(
        service.sendClientWelcome({
          email: 'fail@test.com',
          name: 'Fail',
          tier: 'monthly',
          magicUrl: 'https://cerniq.io/magic',
          institutionName: 'Coop Fail',
        }),
      ).resolves.toBeUndefined();
    });

    it('should include correct subject and recipient for sendJobFailedAlert', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_456' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendJobFailedAlert({
        jobId: 'job_xyz',
        institutionName: 'Coop Fail',
        error: 'PDF generation timeout',
        clientEmail: 'client@test.com',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('FAILED');
      expect(call.subject).toContain('Coop Fail');
      expect(call.text).toContain('PDF generation timeout');
    });

    it('sendReportReady should include portal URL in CTA html', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_789' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendReportReady({
        email: 'user@example.com',
        name: 'Carlos',
        institutionName: 'Coop Ready',
        portalUrl: 'https://cerniq.io/portal/reports/42',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.html).toContain('https://cerniq.io/portal/reports/42');
    });
  });

  // ── Coverage boost: additional email method tests ──────────
  describe('sendDailyOperationsReport', () => {
    it('should send ops report with correct metrics in subject', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_ops' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendDailyOperationsReport({
        pendingJobs: 3,
        failedJobs: 1,
        newLeads: 5,
        pendingFollowUps: 2,
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('5 leads');
      expect(call.subject).toContain('3 pending');
      expect(call.subject).toContain('1 failed');
      expect(call.text).toContain('Overdue Follow-ups: 2');
    });

    it('handles dry-run when resend is null', async () => {
      (service as any).resend = null;
      await expect(
        service.sendDailyOperationsReport({
          pendingJobs: 0,
          failedJobs: 0,
          newLeads: 0,
          pendingFollowUps: 0,
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendDemoRequestNotification', () => {
    it('includes institution name and email in notification text', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_demo' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendDemoRequestNotification({
        email: 'prospect@coop.com',
        name: 'Maria',
        institutionName: 'Coop Progreso',
        institutionType: 'cooperativa',
        totalAssets: '$100-500M',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('Coop Progreso');
      expect(call.text).toContain('prospect@coop.com');
      expect(call.text).toContain('$100-500M');
    });
  });

  describe('sendLeadNotification with phone and message', () => {
    it('includes phone and message fields when provided', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_lead' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendLeadNotification({
        leadId: 'lead_002',
        name: 'Juan',
        email: 'juan@coop.com',
        phone: '787-555-1234',
        role: 'CEO',
        institutionName: 'Coop Unidos',
        institutionType: 'cooperativa',
        message: 'Interested in quarterly reporting',
        priority: 'MEDIUM',
        nextFollowUp: new Date('2026-04-10'),
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.text).toContain('787-555-1234');
      expect(call.text).toContain('Interested in quarterly reporting');
      expect(call.subject).toContain('MEDIUM');
    });
  });

  describe('sendRevenueAlert with correct formatting', () => {
    it('includes amount and tier in the subject', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_rev' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendRevenueAlert({
        amount: 1299,
        tier: 'annual',
        customerEmail: 'customer@coop.com',
        institutionName: 'Coop Premium',
      });

      expect(mockSend).toHaveBeenCalledTimes(1);
      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('$1299');
      expect(call.subject).toContain('annual');
      expect(call.text).toContain('customer@coop.com');
    });
  });

  // ── Coverage boost: remaining email methods ───────────────
  describe('sendRenewalReminder', () => {
    it('sends urgent subject when daysLeft <= 7', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_renew' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendRenewalReminder({
        email: 'user@coop.com',
        name: 'Maria',
        daysLeft: 3,
        tier: 'Gold',
        currentPeriodEnd: '2026-04-01',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('Accion requerida');
      expect(call.subject).toContain('3 dias');
    });

    it('sends non-urgent subject when daysLeft > 7', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_renew2' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendRenewalReminder({
        email: 'user@coop.com',
        name: 'Maria',
        daysLeft: 20,
        tier: 'Silver',
        currentPeriodEnd: '2026-04-20',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('se renueva');
    });

    it('handles dry-run when resend is null', async () => {
      (service as any).resend = null;
      await expect(
        service.sendRenewalReminder({
          email: 'user@coop.com',
          name: 'Maria',
          daysLeft: 5,
          tier: 'Gold',
          currentPeriodEnd: '2026-04-01',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendChurnRiskAlert', () => {
    it('sends churn risk alert with days inactive', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_churn' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendChurnRiskAlert({
        userName: 'Carlos',
        userEmail: 'carlos@coop.com',
        tier: 'monthly',
        daysSinceLogin: 45,
        currentPeriodEnd: '2026-05-01',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('CHURN RISK');
      expect(call.subject).toContain('45d inactive');
      expect(call.text).toContain('carlos@coop.com');
    });
  });

  describe('sendWeeklyRevenueReport', () => {
    it('sends report with tier breakdown and renewals', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_weekly' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendWeeklyRevenueReport({
        activeBytier: { Gold: 5, Silver: 10 },
        totalActive: 15,
        newThisWeek: 3,
        cancelledThisWeek: 1,
        upcomingRenewals: [
          { email: 'a@coop.com', tier: 'Gold', renewsAt: '2026-04-10' },
        ],
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('15 active');
      expect(call.text).toContain('Gold: 5');
      expect(call.text).toContain('a@coop.com');
    });
  });

  describe('sendNPSSurvey', () => {
    it('sends NPS survey with score links', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_nps' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendNPSSurvey({
        email: 'user@coop.com',
        name: 'Ana',
        institutionName: 'Coop Test',
        jobId: 'job_123',
        institutionId: 'inst_123',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('experiencia');
      expect(call.html).toContain('score=0');
      expect(call.html).toContain('score=10');
    });
  });

  describe('sendTeamInviteEmail', () => {
    it('sends team invite with role label', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_invite' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendTeamInviteEmail({
        email: 'new@coop.com',
        name: 'Pedro',
        inviterName: 'Erwin',
        role: 'ANALYST',
        magicUrl: 'https://cerniq.io/auth/magic?token=xyz',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('Erwin');
      expect(call.html).toContain('Analista / Analyst');
    });

    it('handles dry-run when resend is null', async () => {
      (service as any).resend = null;
      await expect(
        service.sendTeamInviteEmail({
          email: 'new@coop.com',
          name: 'Pedro',
          inviterName: 'Erwin',
          role: 'VIEWER',
          magicUrl: 'https://cerniq.io/magic/abc',
        }),
      ).resolves.not.toThrow();
    });
  });

  describe('sendRawEmail', () => {
    it('sends raw email with provided html', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_raw' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendRawEmail({
        to: 'prospect@example.com',
        subject: 'Custom Outreach',
        html: '<p>Hello from CERNIQ</p>',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.to).toBe('prospect@example.com');
      expect(call.html).toContain('Hello from CERNIQ');
      expect(call.html).toContain('CERNIQ'); // wrapped in template
    });

    it('throws when resend fails', async () => {
      const mockSend = jest.fn().mockRejectedValue(new Error('Send failed'));
      (service as any).resend = { emails: { send: mockSend } };

      await expect(
        service.sendRawEmail({
          to: 'fail@example.com',
          subject: 'Test',
          html: '<p>Test</p>',
        }),
      ).rejects.toThrow('Send failed');
    });
  });

  describe('sendDemoConfirmation', () => {
    it('sends demo confirmation email', async () => {
      const mockSend = jest.fn().mockResolvedValue({ id: 'msg_demo_conf' });
      (service as any).resend = { emails: { send: mockSend } };

      await service.sendDemoConfirmation({
        name: 'Carlos',
        email: 'carlos@bank.com',
      });

      const call = mockSend.mock.calls[0][0];
      expect(call.subject).toContain('demo');
      expect(call.html).toContain('demo');
    });

    it('returns early when resend is null', async () => {
      (service as any).resend = null;
      await expect(
        service.sendDemoConfirmation({ email: 'test@test.com' }),
      ).resolves.not.toThrow();
    });
  });
});
