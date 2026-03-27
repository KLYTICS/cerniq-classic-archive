import { Test, TestingModule } from '@nestjs/testing';
import { BadRequestException } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { AuditService } from '../audit/audit.service';
import { AuthGuard } from '../auth/auth.guard';

describe('BillingController', () => {
  let controller: BillingController;
  let billingService: jest.Mocked<
    Pick<
      BillingService,
      | 'createCheckoutSession'
      | 'verifyWebhookSignature'
      | 'handlePaymentComplete'
      | 'handleSubscriptionCreated'
      | 'handleSubscriptionUpdated'
      | 'handleInvoicePaid'
      | 'handlePaymentFailed'
      | 'handleSubscriptionCancelled'
      | 'handleDispute'
      | 'createBillingPortalSession'
      | 'getSubscription'
      | 'verifyMagicLink'
      | 'requestMagicLink'
    >
  >;
  let auditService: { log: jest.Mock };

  beforeEach(async () => {
    const mockBillingService = {
      createCheckoutSession: jest.fn(),
      verifyWebhookSignature: jest.fn(),
      handlePaymentComplete: jest.fn(),
      handleSubscriptionCreated: jest.fn(),
      handleSubscriptionUpdated: jest.fn(),
      handleInvoicePaid: jest.fn(),
      handlePaymentFailed: jest.fn(),
      handleSubscriptionCancelled: jest.fn(),
      handleDispute: jest.fn(),
      createBillingPortalSession: jest.fn(),
      getSubscription: jest.fn(),
      verifyMagicLink: jest.fn(),
      requestMagicLink: jest.fn(),
    };

    const mockAuditService = {
      log: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [BillingController],
      providers: [
        { provide: BillingService, useValue: mockBillingService },
        { provide: AuditService, useValue: mockAuditService },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<BillingController>(BillingController);
    billingService = module.get(BillingService);
    auditService = module.get(AuditService);
  });

  describe('POST /api/billing/checkout', () => {
    it('should create a checkout session with valid DTO', async () => {
      const dto = {
        tier: 'monthly' as const,
        customerEmail: 'test@example.com',
        customerName: 'Test User',
        institutionName: 'Test University',
        successUrl: '/success',
        cancelUrl: '/cancel',
      };
      const expected = {
        checkoutUrl: 'https://checkout.stripe.com/xxx',
        sessionId: 'sess_123',
      };
      billingService.createCheckoutSession.mockResolvedValue(expected);

      const req = { ip: '127.0.0.1', headers: { 'user-agent': 'jest' } };
      const result = await controller.createCheckout(dto, req);

      expect(result).toEqual(expected);
    });

    it('should pass tier, customerEmail, customerName, and institutionName to service', async () => {
      const dto = {
        tier: 'annual' as const,
        customerEmail: 'client@uni.edu',
        customerName: 'Jane Doe',
        institutionName: 'State University',
        successUrl: '/ok',
        cancelUrl: '/nope',
      };
      billingService.createCheckoutSession.mockResolvedValue({
        checkoutUrl: '',
        sessionId: '',
      });

      await controller.createCheckout(dto, { ip: '1.2.3.4', headers: {} });

      expect(billingService.createCheckoutSession).toHaveBeenCalledWith({
        tier: 'annual',
        customerEmail: 'client@uni.edu',
        customerName: 'Jane Doe',
        institutionName: 'State University',
        leadId: undefined,
        successUrl: '/ok',
        cancelUrl: '/nope',
      });
    });

    it('should fire an audit log on checkout', async () => {
      const dto = {
        tier: 'one_time' as const,
        customerEmail: 'audit@test.com',
        institutionName: 'Audit U',
        successUrl: '/s',
        cancelUrl: '/c',
      };
      billingService.createCheckoutSession.mockResolvedValue({
        checkoutUrl: '',
        sessionId: '',
      });

      await controller.createCheckout(dto, {
        ip: '10.0.0.1',
        headers: { 'user-agent': 'Mozilla' },
      });

      expect(auditService.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'payment_initiated',
          resource: 'subscription',
          metadata: expect.objectContaining({ tier: 'one_time' }),
        }),
      );
    });

    it('should propagate service errors for invalid tier', async () => {
      billingService.createCheckoutSession.mockRejectedValue(
        new BadRequestException('Unknown tier: invalid'),
      );

      const dto = {
        tier: 'invalid' as any,
        successUrl: '/s',
        cancelUrl: '/c',
      };

      await expect(
        controller.createCheckout(dto, { ip: '', headers: {} }),
      ).rejects.toThrow('Unknown tier: invalid');
    });
  });

  describe('POST /api/billing/webhook', () => {
    it('should reject when stripe-signature header is missing', async () => {
      const req = { rawBody: Buffer.from('{}') };

      await expect(
        controller.handleWebhook(undefined as any, req),
      ).rejects.toThrow('Missing stripe-signature header');
    });

    it('should reject when stripe-signature header is empty string', async () => {
      const req = { rawBody: Buffer.from('{}') };

      await expect(controller.handleWebhook('', req)).rejects.toThrow(
        'Missing stripe-signature header',
      );
    });

    it('should reject when rawBody is not available', async () => {
      const req = { rawBody: undefined };

      await expect(controller.handleWebhook('sig_abc', req)).rejects.toThrow(
        'Raw body not available',
      );
    });

    it('should reject invalid webhook signature', async () => {
      billingService.verifyWebhookSignature.mockImplementation(() => {
        throw new Error('Signature verification failed');
      });

      const req = { rawBody: Buffer.from('payload') };

      await expect(controller.handleWebhook('sig_bad', req)).rejects.toThrow(
        'Invalid webhook signature',
      );
    });

    it('should process checkout.session.completed event with paid status', async () => {
      const session = { payment_status: 'paid', id: 'sess_1' };
      const event = {
        type: 'checkout.session.completed',
        id: 'evt_1',
        data: { object: session },
      };
      billingService.verifyWebhookSignature.mockReturnValue(event as any);
      billingService.handlePaymentComplete.mockResolvedValue(undefined);

      const req = { rawBody: Buffer.from('body') };
      const result = await controller.handleWebhook('sig_valid', req);

      expect(result).toEqual({ received: true });
      expect(billingService.handlePaymentComplete).toHaveBeenCalledWith(
        session,
      );
    });

    it('should not call handlePaymentComplete when payment_status is not paid', async () => {
      const session = { payment_status: 'unpaid', id: 'sess_2' };
      const event = {
        type: 'checkout.session.completed',
        id: 'evt_2',
        data: { object: session },
      };
      billingService.verifyWebhookSignature.mockReturnValue(event as any);

      const req = { rawBody: Buffer.from('body') };
      await controller.handleWebhook('sig_valid', req);

      expect(billingService.handlePaymentComplete).not.toHaveBeenCalled();
    });
  });

  describe('GET /api/billing/subscription', () => {
    it('should return subscription for authenticated user', async () => {
      const subscription = {
        tier: 'monthly',
        status: 'active',
        currentPeriodEnd: new Date('2026-04-15'),
        reportsUsed: 3,
        createdAt: new Date('2026-01-01'),
      };
      billingService.getSubscription.mockResolvedValue(subscription);

      const req = { user: { userId: 'user-123' } };
      const result = await controller.getSubscription(req);

      expect(result).toEqual(subscription);
    });

    it('should return free tier when no subscription exists', async () => {
      billingService.getSubscription.mockResolvedValue(null);

      const req = { user: { userId: 'user-456' } };
      const result = await controller.getSubscription(req);

      expect(result).toEqual({ tier: 'free', status: 'active' });
    });

    it('should query subscription using userId from request', async () => {
      billingService.getSubscription.mockResolvedValue(null);

      const req = { user: { userId: 'user-789' } };
      await controller.getSubscription(req);

      expect(billingService.getSubscription).toHaveBeenCalledWith('user-789');
    });
  });

  describe('POST /api/billing/portal', () => {
    it('should create billing portal session for authenticated user', async () => {
      const expected = { portalUrl: 'https://billing.stripe.com/portal/xxx' };
      billingService.createBillingPortalSession.mockResolvedValue(expected);

      const req = { user: { userId: 'user-abc' } };
      const result = await controller.getBillingPortal(req);

      expect(result).toEqual(expected);
    });

    it('should pass userId from request to service', async () => {
      billingService.createBillingPortalSession.mockResolvedValue({
        portalUrl: '',
      });

      const req = { user: { userId: 'user-def' } };
      await controller.getBillingPortal(req);

      expect(billingService.createBillingPortalSession).toHaveBeenCalledWith(
        'user-def',
      );
    });

    it('should propagate error when no billing account found', async () => {
      billingService.createBillingPortalSession.mockRejectedValue(
        new BadRequestException('No billing account found'),
      );

      const req = { user: { userId: 'user-no-billing' } };

      await expect(controller.getBillingPortal(req)).rejects.toThrow(
        'No billing account found',
      );
    });
  });
});
