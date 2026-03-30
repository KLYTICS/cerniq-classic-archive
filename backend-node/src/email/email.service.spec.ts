import { EmailService } from './email.service';

const sendEmailMock = jest.fn();

jest.mock('resend', () => ({
  Resend: jest.fn().mockImplementation(() => ({
    emails: {
      send: sendEmailMock,
    },
  })),
}));

describe('EmailService', () => {
  const originalEnv = { ...process.env };

  beforeEach(() => {
    process.env = {
      ...originalEnv,
      RESEND_API_KEY: 'test-resend-key',
      FRONTEND_URL: 'https://test.cerniq.io/',
      BACKEND_URL: 'https://api.test.cerniq.io/',
      ERWIN_EMAIL: 'erwin@test.cerniq.io',
    };
    sendEmailMock.mockReset().mockResolvedValue({ id: 'msg-123' });
    jest.restoreAllMocks();
  });

  afterEach(() => {
    process.env = { ...originalEnv };
  });

  it('sends welcome emails with the portal CTA and personalized institution copy', async () => {
    const service = new EmailService();

    await service.sendClientWelcome({
      email: 'client@example.com',
      name: 'Ana',
      tier: 'Enterprise',
      magicUrl: 'https://test.cerniq.io/magic/token-123',
      institutionName: 'Cooperativa Norte',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'client@example.com',
        replyTo: 'erwin@test.cerniq.io',
        subject: expect.stringContaining('Cooperativa Norte'),
        html: expect.stringContaining('https://test.cerniq.io/magic/token-123'),
      }),
    );
  });

  it('uses dry-run mode when the Resend client is unavailable', async () => {
    delete process.env.RESEND_API_KEY;
    const service = new EmailService();
    const logSpy = jest.spyOn((service as any).logger, 'log');

    await service.sendClientWelcome({
      email: 'dryrun@example.com',
      name: 'Dry Run',
      tier: 'Silver',
      magicUrl: 'https://test.cerniq.io/magic',
      institutionName: 'Demo Coop',
    });

    expect(sendEmailMock).not.toHaveBeenCalled();
    expect(logSpy).toHaveBeenCalledWith(
      '[DRY RUN] Client welcome: dryrun@example.com',
    );
  });

  it('formats lead notifications with follow-up timing, priority, and admin link', async () => {
    const service = new EmailService();

    await service.sendLeadNotification({
      leadId: 'lead-123',
      name: 'Taylor Risk',
      email: 'taylor@example.com',
      phone: '787-555-0100',
      role: 'CFO',
      institutionName: 'Atlantic CU',
      institutionType: 'credit_union',
      message: 'Need ALM review before the board packet closes.',
      priority: 'HIGH',
      nextFollowUp: new Date('2026-03-31T14:30:00.000Z'),
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'erwin@test.cerniq.io',
        subject: 'NEW LEAD [HIGH]: Atlantic CU — credit_union',
        text: expect.stringContaining('/admin/leads/lead-123'),
      }),
    );
    expect(sendEmailMock.mock.calls[0][0].text).toContain(
      'Phone: 787-555-0100',
    );
    expect(sendEmailMock.mock.calls[0][0].text).toContain(
      'Message: Need ALM review before the board packet closes.',
    );
  });

  it('omits the English confirmation block when a lead confirmation is Spanish-only', async () => {
    const service = new EmailService();

    await service.sendLeadConfirmation({
      name: 'Maria',
      email: 'maria@example.com',
      institutionName: 'Cooperativa Delta',
      bilingual: false,
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'maria@example.com',
        subject: expect.stringContaining('Cooperativa Delta'),
      }),
    );
    expect(sendEmailMock.mock.calls[0][0].html).toContain('Hola Maria');
    expect(sendEmailMock.mock.calls[0][0].html).not.toContain('Hi Maria');
  });

  it('sends payment failure notices with a billing CTA rooted in the normalized frontend URL', async () => {
    const service = new EmailService();

    await service.sendPaymentFailed({
      email: 'billing@example.com',
      name: 'Billing Contact',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'billing@example.com',
        html: expect.stringContaining('https://test.cerniq.io/portal/billing'),
      }),
    );
  });

  it('marks renewal reminders as urgent when the renewal window is within seven days', async () => {
    const service = new EmailService();

    await service.sendRenewalReminder({
      email: 'renew@example.com',
      name: 'Rene',
      daysLeft: 5,
      tier: 'Professional',
      currentPeriodEnd: 'April 4, 2026',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'renew@example.com',
        subject:
          'Accion requerida: su suscripcion vence en 5 dias / Action required — CERNIQ',
        html: expect.stringContaining('https://test.cerniq.io/portal/billing'),
      }),
    );
    expect(sendEmailMock.mock.calls[0][0].html).toContain(
      'verifique que su metodo de pago este al dia',
    );
  });

  it('summarizes weekly revenue with tier lines and a None fallback for empty renewals', async () => {
    const service = new EmailService();

    await service.sendWeeklyRevenueReport({
      activeBytier: {
        enterprise: 4,
        monthly: 7,
      },
      totalActive: 11,
      newThisWeek: 2,
      cancelledThisWeek: 1,
      upcomingRenewals: [],
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'erwin@test.cerniq.io',
        subject: 'Weekly Revenue: 11 active | +2 new | -1 cancelled',
      }),
    );
    expect(sendEmailMock.mock.calls[0][0].text).toContain('enterprise: 4');
    expect(sendEmailMock.mock.calls[0][0].text).toContain('monthly: 7');
    expect(sendEmailMock.mock.calls[0][0].text).toContain(
      'Upcoming Renewals (30d):\n  None',
    );
  });

  it('builds NPS score links against the normalized backend feedback endpoint', async () => {
    const service = new EmailService();

    await service.sendNPSSurvey({
      email: 'nps@example.com',
      name: 'Nora',
      institutionName: 'Harbor Bank',
      jobId: 'job-77',
      institutionId: 'inst-88',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'nps@example.com',
        subject: expect.stringContaining('Harbor Bank'),
      }),
    );
    const html = sendEmailMock.mock.calls[0][0].html as string;
    expect(html).toContain(
      'https://api.test.cerniq.io/api/feedback/nps?score=0&jobId=job-77&institutionId=inst-88',
    );
    expect(html).toContain(
      'https://api.test.cerniq.io/api/feedback/nps?score=10&jobId=job-77&institutionId=inst-88',
    );
  });

  it('maps team invite roles into bilingual role labels', async () => {
    const service = new EmailService();

    await service.sendTeamInviteEmail({
      email: 'invitee@example.com',
      name: 'Jamie',
      inviterName: 'Lead Admin',
      role: 'ANALYST',
      magicUrl: 'https://test.cerniq.io/invite/token',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'invitee@example.com',
        html: expect.stringContaining('Analista / Analyst'),
      }),
    );
  });

  it('rethrows sendRawEmail failures so operator workflows can surface delivery issues', async () => {
    const service = new EmailService();
    sendEmailMock.mockRejectedValueOnce(new Error('transport down'));

    await expect(
      service.sendRawEmail({
        to: 'ops@example.com',
        subject: 'Manual outreach',
        html: '<p>Manual note</p>',
      }),
    ).rejects.toThrow('transport down');
  });

  it('sends demo confirmations with a bank demo CTA and bilingual copy', async () => {
    const service = new EmailService();

    await service.sendDemoConfirmation({
      name: 'Pat',
      email: 'pat@example.com',
    });

    expect(sendEmailMock).toHaveBeenCalledWith(
      expect.objectContaining({
        to: 'pat@example.com',
        subject: 'Su demo de CERNIQ esta listo / Your CERNIQ demo is ready',
        html: expect.stringContaining('https://test.cerniq.io/demo?type=bank'),
      }),
    );
  });
});
