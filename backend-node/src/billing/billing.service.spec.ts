import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BillingService } from './billing.service';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';

// Mock PrismaService module to avoid DATABASE_URL requirement at import time
jest.mock('../prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

// Mock Stripe price config (module-level reads from env at import time)
jest.mock('./stripe.config', () => ({
  STRIPE_PRICE_IDS: {
    one_time: 'price_onetime_test',
    monthly: 'price_monthly_test',
    annual: 'price_annual_test',
    partner: 'price_partner_test',
  },
  STRIPE_PRODUCTS: {},
}));

// Stub Stripe constructor so the service thinks it's initialized
jest.mock('stripe', () => {
  return jest.fn().mockImplementation(() => ({
    checkout: {
      sessions: { create: jest.fn() },
    },
    billingPortal: {
      sessions: { create: jest.fn() },
    },
    webhooks: { constructEvent: jest.fn() },
  }));
});

describe('BillingService', () => {
  let service: BillingService;
  let prisma: Record<string, any>;
  let email: Record<string, jest.Mock>;

  beforeEach(async () => {
    // Enable Stripe
    process.env.STRIPE_SECRET_KEY = 'sk_test_fake';
    process.env.STRIPE_WEBHOOK_SECRET = 'whsec_fake';
    process.env.FRONTEND_URL = 'https://cerniq.io';

    prisma = {
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      subscription: {
        findUnique: jest.fn(),
        findFirst: jest.fn(),
        upsert: jest.fn(),
        update: jest.fn(),
      },
      lead: { update: jest.fn() },
      reportJob: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
      magicLink: {
        create: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      emailSequence: {
        findFirst: jest.fn(),
        create: jest.fn(),
        updateMany: jest.fn(),
      },
    };

    email = {
      sendClientWelcome: jest.fn().mockResolvedValue(undefined),
      sendRevenueAlert: jest.fn().mockResolvedValue(undefined),
      sendMonthlyReportCycle: jest.fn().mockResolvedValue(undefined),
      sendPaymentFailed: jest.fn().mockResolvedValue(undefined),
      sendCancellationEmail: jest.fn().mockResolvedValue(undefined),
      sendMagicLinkEmail: jest.fn().mockResolvedValue(undefined),
      sendDisputeAlert: jest.fn().mockResolvedValue(undefined),
    };

    const module: TestingModule = await Test.createTestingModule({
      providers: [
        BillingService,
        { provide: PrismaService, useValue: prisma },
        { provide: EmailService, useValue: email },
      ],
    }).compile();

    service = module.get<BillingService>(BillingService);
  });

  afterEach(() => {
    delete process.env.STRIPE_SECRET_KEY;
    delete process.env.STRIPE_WEBHOOK_SECRET;
    jest.restoreAllMocks();
  });

  // ── requireStripe guard ──────────────────────────

  describe('requireStripe', () => {
    it('should throw when STRIPE_SECRET_KEY is not set', async () => {
      delete process.env.STRIPE_SECRET_KEY;

      const module = await Test.createTestingModule({
        providers: [
          BillingService,
          { provide: PrismaService, useValue: prisma },
          { provide: EmailService, useValue: email },
        ],
      }).compile();

      const noStripeService = module.get<BillingService>(BillingService);

      await expect(
        noStripeService.createCheckoutSession({
          tier: 'monthly',
          successUrl: '/s',
          cancelUrl: '/c',
        }),
      ).rejects.toThrow('Billing is not configured');
    });
  });

  // ── createCheckoutSession ────────────────────────

  describe('createCheckoutSession', () => {
    it('should throw for unknown tier', async () => {
      await expect(
        service.createCheckoutSession({
          tier: 'bogus',
          successUrl: '/s',
          cancelUrl: '/c',
        }),
      ).rejects.toThrow('Unknown tier: bogus');
    });

    it('should use "payment" mode for one_time tier', async () => {
      const stripeMock = (service as any).stripe;
      stripeMock.checkout.sessions.create.mockResolvedValue({
        url: 'https://checkout.stripe.com/test',
        id: 'cs_test_123',
      });

      const result = await service.createCheckoutSession({
        tier: 'one_time',
        customerEmail: 'test@coop.pr',
        successUrl: '/success',
        cancelUrl: '/cancel',
      });

      expect(result.checkoutUrl).toBe('https://checkout.stripe.com/test');
      expect(result.sessionId).toBe('cs_test_123');

      const callArgs = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(callArgs.mode).toBe('payment');
    });

    it('should use "subscription" mode for monthly tier', async () => {
      const stripeMock = (service as any).stripe;
      stripeMock.checkout.sessions.create.mockResolvedValue({
        url: '',
        id: 'cs_m',
      });

      await service.createCheckoutSession({
        tier: 'monthly',
        successUrl: '/s',
        cancelUrl: '/c',
      });

      const callArgs = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(callArgs.mode).toBe('subscription');
    });

    it('should prepend FRONTEND_URL to success/cancel URLs', async () => {
      const stripeMock = (service as any).stripe;
      stripeMock.checkout.sessions.create.mockResolvedValue({
        url: '',
        id: 'cs_x',
      });

      await service.createCheckoutSession({
        tier: 'annual',
        successUrl: '/billing/success',
        cancelUrl: '/billing/cancel',
      });

      const callArgs = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(callArgs.success_url).toBe('https://cerniq.io/billing/success');
      expect(callArgs.cancel_url).toBe('https://cerniq.io/billing/cancel');
    });

    it('should keep absolute success and cancel URLs unchanged when host matches', async () => {
      const stripeMock = (service as any).stripe;
      stripeMock.checkout.sessions.create.mockResolvedValue({
        url: '',
        id: 'cs_abs',
      });

      // Use same-origin URLs (matches default FRONTEND_URL=https://cerniq.io)
      await service.createCheckoutSession({
        tier: 'monthly',
        successUrl: 'https://cerniq.io/portal?welcome=1',
        cancelUrl: 'https://cerniq.io/pricing',
      });

      const callArgs = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(callArgs.success_url).toBe(
        'https://cerniq.io/portal?welcome=1',
      );
      expect(callArgs.cancel_url).toBe('https://cerniq.io/pricing');
    });

    it('should pass metadata including leadId and institutionName', async () => {
      const stripeMock = (service as any).stripe;
      stripeMock.checkout.sessions.create.mockResolvedValue({
        url: '',
        id: 'cs_y',
      });

      await service.createCheckoutSession({
        tier: 'monthly',
        customerEmail: 'cfo@coop.pr',
        customerName: 'Maria',
        institutionName: 'Cooperativa XYZ',
        leadId: 'lead-abc',
        successUrl: '/s',
        cancelUrl: '/c',
      });

      const callArgs = stripeMock.checkout.sessions.create.mock.calls[0][0];
      expect(callArgs.metadata).toEqual({
        leadId: 'lead-abc',
        institutionName: 'Cooperativa XYZ',
        customerName: 'Maria',
        tier: 'monthly',
      });
      expect(callArgs.customer_email).toBe('cfo@coop.pr');
    });
  });

  // ── createBillingPortalSession ───────────────────

  describe('createBillingPortalSession', () => {
    it('should throw when no subscription exists', async () => {
      prisma.subscription.findUnique.mockResolvedValue(null);

      await expect(
        service.createBillingPortalSession('user-1'),
      ).rejects.toThrow('No billing account found');
    });

    it('should throw when subscription has no stripeCustomerId', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        userId: 'user-1',
        stripeCustomerId: null,
      });

      await expect(
        service.createBillingPortalSession('user-1'),
      ).rejects.toThrow('No billing account found');
    });

    it('should create portal session with return URL', async () => {
      prisma.subscription.findUnique.mockResolvedValue({
        stripeCustomerId: 'cus_123',
      });

      const stripeMock = (service as any).stripe;
      stripeMock.billingPortal.sessions.create.mockResolvedValue({
        url: 'https://billing.stripe.com/session/xyz',
      });

      const result = await service.createBillingPortalSession('user-1');

      expect(result.portalUrl).toBe('https://billing.stripe.com/session/xyz');
      expect(stripeMock.billingPortal.sessions.create).toHaveBeenCalledWith({
        customer: 'cus_123',
        return_url: 'https://cerniq.io/portal/billing',
      });
    });
  });

  // ── handlePaymentComplete ────────────────────────

  describe('handlePaymentComplete', () => {
    const baseSession = {
      id: 'cs_test',
      customer_email: 'cfo@coop.pr',
      customer: 'cus_new',
      amount_total: 75000,
      metadata: {
        tier: 'one_time',
        leadId: 'lead-1',
        institutionName: 'Cooperativa ABC',
        customerName: 'Pablo',
      },
    } as any;

    beforeEach(() => {
      prisma.user.findUnique.mockResolvedValue(null);
      prisma.user.create.mockResolvedValue({
        id: 'user-new',
        email: 'cfo@coop.pr',
        name: 'Pablo',
      });
      prisma.subscription.upsert.mockResolvedValue({});
      prisma.lead.update.mockResolvedValue({});
      prisma.reportJob.create.mockResolvedValue({});
      prisma.magicLink.create.mockResolvedValue({});
      prisma.emailSequence.findFirst.mockResolvedValue(null);
      prisma.emailSequence.create.mockResolvedValue({});
    });

    it('should auto-create user when not found', async () => {
      await service.handlePaymentComplete(baseSession);

      expect(prisma.user.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          email: 'cfo@coop.pr',
          name: 'Pablo',
          provider: 'magic_link',
          emailVerified: true,
        }),
      });
    });

    it('should use existing user when found', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-existing',
        email: 'cfo@coop.pr',
      });

      await service.handlePaymentComplete(baseSession);

      expect(prisma.user.create).not.toHaveBeenCalled();
      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-existing' },
        }),
      );
    });

    it('should upsert subscription with correct tier and status', async () => {
      await service.handlePaymentComplete(baseSession);

      expect(prisma.subscription.upsert).toHaveBeenCalledWith(
        expect.objectContaining({
          create: expect.objectContaining({
            tier: 'one_time',
            status: 'active',
            stripeCustomerId: 'cus_new',
            stripeSessionId: 'cs_test',
          }),
        }),
      );
    });

    it('should set currentPeriodEnd to null for one_time tier', async () => {
      await service.handlePaymentComplete(baseSession);

      const call = prisma.subscription.upsert.mock.calls[0][0];
      expect(call.create.currentPeriodEnd).toBeNull();
    });

    it('should set currentPeriodEnd ~1 month for monthly tier', async () => {
      const monthlySession = {
        ...baseSession,
        metadata: { ...baseSession.metadata, tier: 'monthly' },
      };

      await service.handlePaymentComplete(monthlySession);

      const call = prisma.subscription.upsert.mock.calls[0][0];
      const endDate = call.create.currentPeriodEnd as Date;
      expect(endDate).toBeInstanceOf(Date);
      // Should be ~30 days in the future
      const diffMs = endDate.getTime() - Date.now();
      expect(diffMs).toBeGreaterThan(25 * 24 * 60 * 60 * 1000);
      expect(diffMs).toBeLessThan(35 * 24 * 60 * 60 * 1000);
    });

    it('should update lead to CLOSED_WON when leadId present', async () => {
      await service.handlePaymentComplete(baseSession);

      expect(prisma.lead.update).toHaveBeenCalledWith({
        where: { id: 'lead-1' },
        data: expect.objectContaining({
          status: 'CLOSED_WON',
          revenueAmount: 750,
          dealType: 'one_time',
        }),
      });
    });

    it('should not update lead when leadId is empty', async () => {
      const noLeadSession = {
        ...baseSession,
        metadata: { ...baseSession.metadata, leadId: '' },
      };

      await service.handlePaymentComplete(noLeadSession);

      expect(prisma.lead.update).not.toHaveBeenCalled();
    });

    it('should create AWAITING_DATA report job', async () => {
      await service.handlePaymentComplete(baseSession);

      expect(prisma.reportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          status: 'AWAITING_DATA',
          triggeredBy: 'payment',
          institutionName: 'Cooperativa ABC',
        }),
      });
    });

    it('should send welcome email with magic link', async () => {
      await service.handlePaymentComplete(baseSession);

      expect(email.sendClientWelcome).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'cfo@coop.pr',
          name: 'Pablo',
          tier: 'one_time',
          institutionName: 'Cooperativa ABC',
        }),
      );
    });

    it('should send revenue alert to admin', async () => {
      await service.handlePaymentComplete(baseSession);

      expect(email.sendRevenueAlert).toHaveBeenCalledWith({
        amount: 750,
        tier: 'one_time',
        customerEmail: 'cfo@coop.pr',
        institutionName: 'Cooperativa ABC',
      });
    });

    it('should schedule onboarding emails (B2 at 30min, B3 at 48h)', async () => {
      await service.handlePaymentComplete(baseSession);

      // scheduleEmail is called at least twice for onboarding
      expect(prisma.emailSequence.create).toHaveBeenCalled();
      const calls = prisma.emailSequence.create.mock.calls;
      const sequenceKeys = calls.map((c: any) => c[0].data.sequenceKey);
      expect(sequenceKeys).toContain('B2');
      expect(sequenceKeys).toContain('B3');
    });

    it('should silently skip when no email or metadata', async () => {
      const emptySession = { customer_email: null, metadata: null } as any;

      // Should return without throwing
      await service.handlePaymentComplete(emptySession);

      expect(prisma.user.findUnique).not.toHaveBeenCalled();
    });
  });

  // ── handleInvoicePaid ────────────────────────────

  describe('handleInvoicePaid', () => {
    it('should update subscription status to active', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'monthly',
        currentPeriodEnd: new Date(),
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'u@test.com',
        name: 'U',
      });
      prisma.reportJob.findFirst.mockResolvedValue({
        institutionName: 'Coop A',
      });
      prisma.reportJob.create.mockResolvedValue({});

      const invoice = {
        customer: 'cus_123',
        lines: {
          data: [
            { period: { end: Math.floor(Date.now() / 1000) + 86400 * 30 } },
          ],
        },
      } as any;

      await service.handleInvoicePaid(invoice);

      expect(prisma.subscription.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'sub-1' },
          data: expect.objectContaining({ status: 'active' }),
        }),
      );
    });

    it('should auto-create report job for monthly/annual subscriptions', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'monthly',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'u@test.com',
        name: 'U',
      });
      prisma.reportJob.findFirst.mockResolvedValue({
        institutionName: 'Coop B',
      });
      prisma.reportJob.create.mockResolvedValue({});

      await service.handleInvoicePaid({
        customer: 'cus_123',
        lines: { data: [] },
      } as any);

      expect(prisma.reportJob.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'AWAITING_DATA',
          triggeredBy: 'monthly_cron',
        }),
      });
    });

    it('should send monthly report cycle email', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'annual',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'u@test.com',
        name: 'Jane',
      });
      prisma.reportJob.findFirst.mockResolvedValue(null);
      prisma.reportJob.create.mockResolvedValue({});

      await service.handleInvoicePaid({
        customer: 'cus_x',
        lines: { data: [] },
      } as any);

      expect(email.sendMonthlyReportCycle).toHaveBeenCalledWith({
        email: 'u@test.com',
        name: 'Jane',
      });
    });

    it('should silently skip when no matching subscription', async () => {
      prisma.subscription.findFirst.mockResolvedValue(null);

      await service.handleInvoicePaid({
        customer: 'cus_unknown',
        lines: { data: [] },
      } as any);

      expect(prisma.subscription.update).not.toHaveBeenCalled();
    });
  });

  // ── handlePaymentFailed ──────────────────────────

  describe('handlePaymentFailed', () => {
    it('should mark subscription as past_due', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'monthly',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'u@test.com',
        name: 'U',
      });

      await service.handlePaymentFailed({ customer: 'cus_1' } as any);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: { status: 'past_due' },
      });
    });

    it('should send payment failed email to user', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'monthly',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'cfo@coop.pr',
        name: 'Maria',
      });

      await service.handlePaymentFailed({ customer: 'cus_1' } as any);

      expect(email.sendPaymentFailed).toHaveBeenCalledWith({
        email: 'cfo@coop.pr',
        name: 'Maria',
      });
    });

    it('should send revenue alert for failed payment', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
        tier: 'annual',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'fail@test.com',
      });

      await service.handlePaymentFailed({ customer: 'cus_1' } as any);

      expect(email.sendRevenueAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          amount: 0,
          institutionName: expect.stringContaining('PAYMENT FAILED'),
        }),
      );
    });
  });

  // ── handleSubscriptionCancelled ──────────────────

  describe('handleSubscriptionCancelled', () => {
    it('should mark subscription as cancelled with timestamp', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'gone@test.com',
        name: 'Ex',
      });
      prisma.emailSequence.findFirst.mockResolvedValue(null);
      prisma.emailSequence.create.mockResolvedValue({});

      await service.handleSubscriptionCancelled({
        customer: 'cus_cancel',
      } as any);

      expect(prisma.subscription.update).toHaveBeenCalledWith({
        where: { id: 'sub-1' },
        data: expect.objectContaining({
          status: 'cancelled',
          cancelledAt: expect.any(Date),
        }),
      });
    });

    it('should send cancellation email', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'bye@test.com',
        name: 'Bye',
      });
      prisma.emailSequence.findFirst.mockResolvedValue(null);
      prisma.emailSequence.create.mockResolvedValue({});

      await service.handleSubscriptionCancelled({ customer: 'cus_c' } as any);

      expect(email.sendCancellationEmail).toHaveBeenCalledWith({
        email: 'bye@test.com',
        name: 'Bye',
      });
    });

    it('should schedule D5 win-back email at 90 days', async () => {
      prisma.subscription.findFirst.mockResolvedValue({
        id: 'sub-1',
        userId: 'user-1',
      });
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'wb@test.com',
        name: 'WB',
      });
      prisma.emailSequence.findFirst.mockResolvedValue(null);
      prisma.emailSequence.create.mockResolvedValue({});

      await service.handleSubscriptionCancelled({ customer: 'cus_wb' } as any);

      expect(prisma.emailSequence.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          sequenceKey: 'D5',
        }),
      });
    });
  });

  // ── handleDispute ────────────────────────────────

  describe('handleDispute', () => {
    it('should send dispute alert email', async () => {
      await service.handleDispute({
        charge: 'ch_123',
        amount: 75000,
        reason: 'fraudulent',
      } as any);

      expect(email.sendDisputeAlert).toHaveBeenCalledWith({
        chargeId: 'ch_123',
        amount: 750,
        reason: 'fraudulent',
      });
    });
  });

  // ── Magic Links ──────────────────────────────────

  describe('generateMagicLink', () => {
    it('should create magic link record in DB', async () => {
      prisma.magicLink.create.mockResolvedValue({});

      const url = await service.generateMagicLink('user-1');

      expect(url).toMatch(
        /^https:\/\/cerniq\.io\/auth\/magic\?token=[a-f0-9]{64}$/,
      );
      expect(prisma.magicLink.create).toHaveBeenCalledWith({
        data: expect.objectContaining({
          userId: 'user-1',
          token: expect.any(String),
          expiresAt: expect.any(Date),
        }),
      });
    });

    it('should use custom expiry hours', async () => {
      prisma.magicLink.create.mockResolvedValue({});

      await service.generateMagicLink('user-1', 48);

      const call = prisma.magicLink.create.mock.calls[0][0];
      const expiry = call.data.expiresAt as Date;
      const diffHours = (expiry.getTime() - Date.now()) / (60 * 60 * 1000);
      expect(diffHours).toBeGreaterThan(47);
      expect(diffHours).toBeLessThan(49);
    });
  });

  describe('verifyMagicLink', () => {
    it('should return null for non-existent token', async () => {
      prisma.magicLink.findUnique.mockResolvedValue(null);

      const result = await service.verifyMagicLink('bad-token');

      expect(result).toBeNull();
    });

    it('should return null for already-used token', async () => {
      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1',
        usedAt: new Date(),
        expiresAt: new Date(Date.now() + 60000),
        user: { id: 'user-1' },
      });

      const result = await service.verifyMagicLink('used-token');

      expect(result).toBeNull();
    });

    it('should return null for expired token', async () => {
      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1',
        usedAt: null,
        expiresAt: new Date(Date.now() - 60000),
        user: { id: 'user-1' },
      });

      const result = await service.verifyMagicLink('expired-token');

      expect(result).toBeNull();
    });

    it('should mark token as used and return user for valid token', async () => {
      const mockUser = { id: 'user-1', email: 'valid@test.com' };
      prisma.magicLink.findUnique.mockResolvedValue({
        id: 'ml-1',
        usedAt: null,
        expiresAt: new Date(Date.now() + 60000),
        user: mockUser,
      });
      prisma.magicLink.update.mockResolvedValue({});
      prisma.user.update.mockResolvedValue({});

      const result = await service.verifyMagicLink('valid-token');

      expect(result).toEqual(mockUser);
      expect(prisma.magicLink.update).toHaveBeenCalledWith({
        where: { id: 'ml-1' },
        data: { usedAt: expect.any(Date) },
      });
    });
  });

  // ── Email Scheduling ─────────────────────────────

  describe('scheduleEmail', () => {
    it('should skip if duplicate sequence exists', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue({ id: 'existing' });

      await service.scheduleEmail('user-1', null, 'B2', new Date());

      expect(prisma.emailSequence.create).not.toHaveBeenCalled();
    });

    it('should create sequence when no duplicate', async () => {
      prisma.emailSequence.findFirst.mockResolvedValue(null);
      prisma.emailSequence.create.mockResolvedValue({});

      const scheduledAt = new Date(Date.now() + 3600000);
      await service.scheduleEmail('user-1', null, 'B3', scheduledAt);

      expect(prisma.emailSequence.create).toHaveBeenCalledWith({
        data: {
          userId: 'user-1',
          leadId: null,
          sequenceKey: 'B3',
          scheduledAt,
        },
      });
    });
  });

  describe('cancelSequences', () => {
    it('should cancel unsent sequences for a user', async () => {
      prisma.emailSequence.updateMany.mockResolvedValue({ count: 2 });

      await service.cancelSequences('user-1');

      expect(prisma.emailSequence.updateMany).toHaveBeenCalledWith({
        where: { cancelled: false, sentAt: null, userId: 'user-1' },
        data: { cancelled: true },
      });
    });
  });

  describe('requestMagicLink', () => {
    it('should silently return when user not found (no enumeration)', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await service.requestMagicLink('nobody@test.com');

      expect(email.sendMagicLinkEmail).not.toHaveBeenCalled();
    });

    it('should generate link and send email when user exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'exists@test.com',
        name: 'Test',
      });
      prisma.magicLink.create.mockResolvedValue({});

      await service.requestMagicLink('exists@test.com');

      expect(email.sendMagicLinkEmail).toHaveBeenCalledWith({
        email: 'exists@test.com',
        magicUrl: expect.stringContaining(
          'https://cerniq.io/auth/magic?token=',
        ),
        name: 'Test',
      });
    });
  });

  // ── getSubscription ──────────────────────────────

  describe('getSubscription', () => {
    it('should return subscription with selected fields', async () => {
      const sub = {
        tier: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date(),
        reportsUsed: 5,
        createdAt: new Date(),
      };
      prisma.subscription.findUnique.mockResolvedValue(sub);

      const result = await service.getSubscription('user-1');

      expect(result).toEqual(sub);
      expect(prisma.subscription.findUnique).toHaveBeenCalledWith({
        where: { userId: 'user-1' },
        select: {
          tier: true,
          status: true,
          currentPeriodEnd: true,
          reportsUsed: true,
          createdAt: true,
        },
      });
    });
  });
});
