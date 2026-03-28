import { Injectable, Logger, BadRequestException } from '@nestjs/common';
import Stripe from 'stripe';
import * as crypto from 'crypto';
import { PrismaService } from '../prisma.service';
import { EmailService } from '../email/email.service';
import { STRIPE_PRICE_IDS } from './stripe.config';

type BillingTier = 'one_time' | 'monthly' | 'annual' | 'partner';

@Injectable()
export class BillingService {
  private readonly logger = new Logger(BillingService.name);
  private stripe: Stripe | null = null;

  constructor(
    private readonly prisma: PrismaService,
    private readonly email: EmailService,
  ) {
    if (process.env.STRIPE_SECRET_KEY) {
      this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
      this.logger.log('Stripe client initialized');
    } else {
      this.logger.warn('STRIPE_SECRET_KEY not set — billing disabled');
    }
  }

  private requireStripe(): Stripe {
    if (!this.stripe)
      throw new BadRequestException('Billing is not configured');
    return this.stripe;
  }

  // ── Checkout ──────────────────────────────────────────

  async createCheckoutSession(params: {
    tier: string;
    customerEmail?: string;
    customerName?: string;
    institutionName?: string;
    leadId?: string;
    successUrl: string;
    cancelUrl: string;
  }) {
    const stripe = this.requireStripe();
    const priceId = STRIPE_PRICE_IDS[params.tier];
    if (!priceId) throw new BadRequestException(`Unknown tier: ${params.tier}`);

    const mode = params.tier === 'one_time' ? 'payment' : 'subscription';

    const session = await stripe.checkout.sessions.create({
      payment_method_types: ['card'],
      mode,
      line_items: [{ price: priceId, quantity: 1 }],
      customer_email: params.customerEmail,
      metadata: {
        leadId: params.leadId || '',
        institutionName: params.institutionName || '',
        customerName: params.customerName || '',
        tier: params.tier,
      },
      success_url: this.resolveFrontendUrl(params.successUrl),
      cancel_url: this.resolveFrontendUrl(params.cancelUrl),
      allow_promotion_codes: true,
      billing_address_collection: 'required',
      locale: 'auto',
    });

    this.logger.log({
      event: 'checkout.created',
      tier: params.tier,
      sessionId: session.id,
    });

    return { checkoutUrl: session.url, sessionId: session.id };
  }

  // ── Billing Portal ────────────────────────────────────

  async createBillingPortalSession(userId: string) {
    const stripe = this.requireStripe();
    const sub = await this.prisma.subscription.findUnique({
      where: { userId },
    });
    if (!sub?.stripeCustomerId) {
      throw new BadRequestException('No billing account found');
    }

    const session = await stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${process.env.FRONTEND_URL}/portal/billing`,
    });

    return { portalUrl: session.url };
  }

  // ── Webhook Handlers ──────────────────────────────────

  verifyWebhookSignature(rawBody: Buffer, signature: string): Stripe.Event {
    const stripe = this.requireStripe();
    const secret = process.env.STRIPE_WEBHOOK_SECRET;
    if (!secret) throw new BadRequestException('Webhook secret not configured');
    return stripe.webhooks.constructEvent(rawBody, signature, secret);
  }

  async handlePaymentComplete(session: Stripe.Checkout.Session) {
    const {
      customer_email: customerEmail,
      metadata,
      customer,
      amount_total,
    } = session;
    if (!customerEmail || !metadata) return;

    const tier = (metadata.tier || 'one_time') as BillingTier;

    // 1. Find or create user
    let user = await this.prisma.user.findUnique({
      where: { email: customerEmail },
    });
    if (!user) {
      user = await this.prisma.user.create({
        data: {
          email: customerEmail,
          name: metadata.customerName || null,
          provider: 'magic_link',
          emailVerified: true,
        },
      });
      this.logger.log({
        event: 'user.auto_created',
        email: customerEmail,
        tier,
      });
    }

    // 2. Upsert subscription
    await this.prisma.subscription.upsert({
      where: { userId: user.id },
      create: {
        userId: user.id,
        tier,
        stripeCustomerId: (customer as string) || null,
        stripeSessionId: session.id,
        status: 'active',
        currentPeriodEnd:
          tier === 'one_time'
            ? null
            : this.addMonths(new Date(), tier === 'annual' ? 12 : 1),
      },
      update: {
        tier,
        status: 'active',
        stripeCustomerId: (customer as string) || null,
        stripeSessionId: session.id,
        currentPeriodEnd:
          tier === 'one_time'
            ? null
            : this.addMonths(new Date(), tier === 'annual' ? 12 : 1),
      },
    });

    // 3. Update lead if linked
    if (metadata.leadId) {
      await this.prisma.lead
        .update({
          where: { id: metadata.leadId },
          data: {
            status: 'CLOSED_WON',
            revenueAmount: (amount_total || 0) / 100,
            dealType: tier,
            convertedAt: new Date(),
          },
        })
        .catch(() => {
          this.logger.warn({
            event: 'lead.update_failed',
            leadId: metadata.leadId,
          });
        });
    }

    // 4. Create report job for one-time / first report
    await this.prisma.reportJob.create({
      data: {
        userId: user.id,
        institutionName: metadata.institutionName || 'Pending',
        status: 'AWAITING_DATA',
        triggeredBy: 'payment',
      },
    });

    // 5. Generate magic link and send welcome email
    const magicUrl = await this.generateMagicLink(user.id);
    await this.email.sendClientWelcome({
      email: customerEmail,
      name: metadata.customerName || '',
      tier,
      magicUrl,
      institutionName: metadata.institutionName || '',
    });

    // 6. Revenue alert to Erwin
    await this.email.sendRevenueAlert({
      amount: (amount_total || 0) / 100,
      tier,
      customerEmail,
      institutionName: metadata.institutionName || '',
    });

    // 7. Schedule onboarding emails
    await this.scheduleEmail(
      user.id,
      null,
      'B2',
      new Date(Date.now() + 30 * 60 * 1000),
    ); // 30 min
    await this.scheduleEmail(
      user.id,
      null,
      'B3',
      new Date(Date.now() + 48 * 60 * 60 * 1000),
    ); // 48h

    this.logger.log({
      event: 'payment.complete',
      userId: user.id,
      tier,
      amount: (amount_total || 0) / 100,
    });
  }

  async handleSubscriptionCreated(subscription: Stripe.Subscription) {
    await this.syncSubscriptionFromStripe(subscription, 'subscription.created');
  }

  async handleSubscriptionUpdated(subscription: Stripe.Subscription) {
    await this.syncSubscriptionFromStripe(subscription, 'subscription.updated');
  }

  async handleInvoicePaid(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        status: 'active',
        currentPeriodEnd: invoice.lines.data[0]?.period?.end
          ? new Date(invoice.lines.data[0].period.end * 1000)
          : sub.currentPeriodEnd,
      },
    });

    // Auto-create new report job for monthly/annual
    if (sub.tier === 'monthly' || sub.tier === 'annual') {
      const user = await this.prisma.user.findUnique({
        where: { id: sub.userId },
      });
      const latestJob = await this.prisma.reportJob.findFirst({
        where: { userId: sub.userId },
        orderBy: { createdAt: 'desc' },
      });

      await this.prisma.reportJob.create({
        data: {
          userId: sub.userId,
          institutionName: latestJob?.institutionName || 'Pending',
          status: 'AWAITING_DATA',
          triggeredBy: 'monthly_cron',
        },
      });

      if (user?.email) {
        await this.email.sendMonthlyReportCycle({
          email: user.email,
          name: user.name || '',
        });
      }
    }

    this.logger.log({ event: 'invoice.paid', customerId });
  }

  async handlePaymentFailed(invoice: Stripe.Invoice) {
    const customerId = invoice.customer as string;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'past_due' },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: sub.userId },
    });
    if (user?.email) {
      await this.email.sendPaymentFailed({
        email: user.email,
        name: user.name || '',
      });
    }

    // Alert Erwin
    await this.email.sendRevenueAlert({
      amount: 0,
      tier: sub.tier,
      customerEmail: user?.email || 'unknown',
      institutionName: `PAYMENT FAILED — ${user?.email}`,
    });

    this.logger.warn({
      event: 'payment.failed',
      userId: sub.userId,
      customerId,
    });
  }

  async handleSubscriptionCancelled(subscription: Stripe.Subscription) {
    const customerId = subscription.customer as string;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: { status: 'cancelled', cancelledAt: new Date() },
    });

    const user = await this.prisma.user.findUnique({
      where: { id: sub.userId },
    });
    if (user?.email) {
      await this.email.sendCancellationEmail({
        email: user.email,
        name: user.name || '',
      });
    }

    // Schedule win-back email (90 days)
    if (user) {
      await this.scheduleEmail(
        user.id,
        null,
        'D5',
        new Date(Date.now() + 90 * 24 * 60 * 60 * 1000),
      );
    }

    this.logger.log({
      event: 'subscription.cancelled',
      userId: sub.userId,
      customerId,
    });
  }

  async handleDispute(dispute: Stripe.Dispute) {
    await this.email.sendDisputeAlert({
      chargeId: dispute.charge as string,
      amount: dispute.amount / 100,
      reason: dispute.reason,
    });
    this.logger.error({
      event: 'dispute.created',
      chargeId: dispute.charge,
      reason: dispute.reason,
    });
  }

  // ── Magic Links ───────────────────────────────────────

  async generateMagicLink(userId: string, expiryHours = 24): Promise<string> {
    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date(Date.now() + expiryHours * 60 * 60 * 1000);

    await this.prisma.magicLink.create({
      data: { userId, token, expiresAt },
    });

    return `${process.env.FRONTEND_URL}/auth/magic?token=${token}`;
  }

  async verifyMagicLink(token: string) {
    const link = await this.prisma.magicLink.findUnique({
      where: { token },
      include: { user: true },
    });

    if (!link || link.usedAt || new Date() > link.expiresAt) {
      return null;
    }

    await this.prisma.magicLink.update({
      where: { id: link.id },
      data: { usedAt: new Date() },
    });

    // Update lastLoginAt timestamp for magic link login
    await this.prisma.user
      .update({
        where: { id: link.user.id },
        data: { lastLoginAt: new Date() },
      })
      .catch(() => {
        /* best-effort */
      });

    return link.user;
  }

  // ── Email Sequence Scheduling ─────────────────────────

  async scheduleEmail(
    userId: string | null,
    leadId: string | null,
    sequenceKey: string,
    scheduledAt: Date,
  ) {
    // Check for duplicates
    const existing = await this.prisma.emailSequence.findFirst({
      where: { userId, leadId, sequenceKey, cancelled: false },
    });
    if (existing) return;

    await this.prisma.emailSequence.create({
      data: { userId, leadId, sequenceKey, scheduledAt },
    });
  }

  async cancelSequences(userId?: string, leadId?: string) {
    const where: any = { cancelled: false, sentAt: null };
    if (userId) where.userId = userId;
    if (leadId) where.leadId = leadId;

    await this.prisma.emailSequence.updateMany({
      where,
      data: { cancelled: true },
    });
  }

  async requestMagicLink(email: string) {
    const user = await this.prisma.user.findUnique({ where: { email } });
    if (!user) return;

    const magicUrl = await this.generateMagicLink(user.id);
    await this.email.sendMagicLinkEmail({
      email,
      magicUrl,
      name: user.name || '',
    });
  }

  async getSubscription(userId: string) {
    return this.prisma.subscription.findUnique({
      where: { userId },
      select: {
        tier: true,
        status: true,
        currentPeriodEnd: true,
        reportsUsed: true,
        createdAt: true,
      },
    });
  }

  // ── Helpers ───────────────────────────────────────────

  private addMonths(date: Date, months: number): Date {
    const d = new Date(date);
    d.setMonth(d.getMonth() + months);
    return d;
  }

  private resolveFrontendUrl(pathOrUrl: string): string {
    const baseUrl = (process.env.FRONTEND_URL || 'https://cerniq.io')
      .trim()
      .replace(/\/+$/, '');
    const trimmed = (pathOrUrl || '').trim();

    if (!trimmed) {
      return baseUrl;
    }

    if (/^https?:\/\//i.test(trimmed)) {
      // Prevent open redirect — only allow URLs under cerniq.io / cerniqtech.com / FRONTEND_URL
      try {
        const allowed = new URL(baseUrl);
        const provided = new URL(trimmed);
        const isSameHost = provided.host === allowed.host;
        const isCerniqDomain = /^([a-z0-9-]+\.)*(cerniq\.io|cerniqtech\.com)$/i.test(provided.host);
        const isLocalDev = /^localhost(:\d+)?$/.test(provided.host);
        if (isSameHost || isCerniqDomain || isLocalDev) {
          return trimmed;
        }
        this.logger.warn({
          event: 'checkout.url_rejected',
          provided: trimmed,
          allowed: allowed.host,
        });
      } catch {
        // Invalid URL — fall through to baseUrl
      }
      return baseUrl;
    }

    return `${baseUrl}${trimmed.startsWith('/') ? '' : '/'}${trimmed}`;
  }

  private resolveSubscriptionStatus(
    status: Stripe.Subscription.Status,
  ): 'active' | 'past_due' | 'cancelled' | 'grace_period' {
    switch (status) {
      case 'active':
      case 'trialing':
        return 'active';
      case 'past_due':
      case 'unpaid':
      case 'incomplete':
        return 'past_due';
      case 'paused':
        return 'grace_period';
      case 'canceled':
      case 'incomplete_expired':
        return 'cancelled';
      default:
        return 'active';
    }
  }

  private resolveTierFromPriceId(
    subscription: Stripe.Subscription,
  ): BillingTier | null {
    const priceId = subscription.items?.data?.[0]?.price?.id;
    if (!priceId) return null;
    const match = Object.entries(STRIPE_PRICE_IDS).find(
      ([, configuredPriceId]) => configuredPriceId === priceId,
    );
    if (!match) return null;
    return match[0] as BillingTier;
  }

  private async syncSubscriptionFromStripe(
    subscription: Stripe.Subscription,
    eventName: string,
  ) {
    const customerId = subscription.customer as string;
    const sub = await this.prisma.subscription.findFirst({
      where: { stripeCustomerId: customerId },
    });
    if (!sub) return;

    const status = this.resolveSubscriptionStatus(subscription.status);
    const nextTier = this.resolveTierFromPriceId(subscription);
    const periodEndUnix = (subscription as any).current_period_end as
      | number
      | undefined;

    await this.prisma.subscription.update({
      where: { id: sub.id },
      data: {
        stripeSubscriptionId: subscription.id,
        status,
        ...(nextTier ? { tier: nextTier } : {}),
        ...(periodEndUnix
          ? { currentPeriodEnd: new Date(periodEndUnix * 1000) }
          : {}),
        ...(status === 'cancelled'
          ? { cancelledAt: new Date() }
          : { cancelledAt: null }),
      },
    });

    this.logger.log({
      event: eventName,
      customerId,
      subscriptionId: subscription.id,
      status,
      tier: nextTier || sub.tier,
    });
  }
}
