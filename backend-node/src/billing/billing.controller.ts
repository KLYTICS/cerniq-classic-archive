import {
  Controller, Post, Get, Body, Headers, Req, Res, Query,
  UseGuards, HttpCode, HttpStatus, BadRequestException, Logger,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import { BillingService } from './billing.service';
import { CheckoutRequestDto } from './billing.dto';
import { AuthGuard } from '../auth/auth.guard';

const isProduction = process.env.NODE_ENV === 'production';

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return normalized === '1' || normalized === 'true' || normalized === 'yes' || normalized === 'on';
}

function resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
  const configured = (process.env.AUTH_COOKIE_SAMESITE || '').trim().toLowerCase();
  if (configured === 'strict' || configured === 'none' || configured === 'lax') {
    return configured;
  }
  return 'lax';
}

function resolveFrontendUrl(): string {
  const configured = (process.env.FRONTEND_URL || '').trim().replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  if (!isProduction) {
    return 'http://localhost:3001';
  }
  return 'https://cerniq.io';
}

const COOKIE_SECURE = parseBoolean(process.env.AUTH_COOKIE_SECURE, isProduction);
const COOKIE_SAME_SITE = resolveCookieSameSite();
const COOKIE_DOMAIN = (process.env.AUTH_COOKIE_DOMAIN || '').trim();

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

@Controller()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(private readonly billing: BillingService) {}

  // ── Checkout ──────────────────────────────────────────

  @Post('api/billing/checkout')
  async createCheckout(@Body() body: CheckoutRequestDto) {
    return this.billing.createCheckoutSession({
      tier: body.tier,
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      institutionName: body.institutionName,
      leadId: body.leadId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });
  }

  // ── Billing Portal (auth-protected) ───────────────────

  @Post('api/billing/portal')
  @UseGuards(AuthGuard)
  async getBillingPortal(@Req() req: any) {
    return this.billing.createBillingPortalSession(req.user.userId);
  }

  // ── Stripe Webhook (signature-verified, no auth) ──────

  @Post('api/billing/webhook')
  @SkipThrottle()
  @HttpCode(HttpStatus.OK)
  async handleWebhook(
    @Headers('stripe-signature') sig: string,
    @Req() req: any,
  ) {
    if (!sig) throw new BadRequestException('Missing stripe-signature header');

    const rawBody = req.rawBody;
    if (!rawBody) throw new BadRequestException('Raw body not available');

    let event;
    try {
      event = this.billing.verifyWebhookSignature(rawBody, sig);
    } catch (err: any) {
      this.logger.error({ event: 'webhook.signature_failed', error: err.message });
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log({ event: 'webhook.received', type: event.type, id: event.id });

    switch (event.type) {
      case 'checkout.session.completed': {
        const session = event.data.object;
        if ((session as any).payment_status === 'paid') {
          await this.billing.handlePaymentComplete(session as any);
        }
        break;
      }
      case 'customer.subscription.created':
        await this.billing.handleSubscriptionCreated(event.data.object as any);
        break;
      case 'customer.subscription.updated':
        await this.billing.handleSubscriptionUpdated(event.data.object as any);
        break;
      case 'invoice.payment_succeeded':
        await this.billing.handleInvoicePaid(event.data.object as any);
        break;
      case 'invoice.payment_failed':
        await this.billing.handlePaymentFailed(event.data.object as any);
        break;
      case 'customer.subscription.deleted':
        await this.billing.handleSubscriptionCancelled(event.data.object as any);
        break;
      case 'charge.dispute.created':
        await this.billing.handleDispute(event.data.object as any);
        break;
      default:
        this.logger.log({ event: 'webhook.unhandled', type: event.type });
    }

    return { received: true };
  }

  // ── Magic Link Auth ───────────────────────────────────

  @Get('auth/magic')
  @SkipThrottle()
  async verifyMagicLink(@Query('token') token: string, @Res() res: any) {
    const frontendUrl = resolveFrontendUrl();
    if (!token) {
      return res.redirect(`${frontendUrl}/auth/expired`);
    }

    const user = await this.billing.verifyMagicLink(token);
    if (!user) {
      return res.redirect(`${frontendUrl}/auth/expired`);
    }

    // Create JWT session (reuse existing auth service pattern)
    const jwt = require('jsonwebtoken');
    const accessToken = jwt.sign(
      { sub: user.id, email: user.email },
      process.env.JWT_SECRET,
      { expiresIn: '7d' },
    );

    res.cookie('access_token', accessToken, {
      ...AUTH_COOKIE_OPTIONS,
      maxAge: 7 * 24 * 60 * 60 * 1000,
    });

    return res.redirect(`${frontendUrl}/portal`);
  }

  @Post('auth/magic/request')
  @Throttle({ default: { limit: 3, ttl: 3600000 } })
  @HttpCode(HttpStatus.OK)
  async requestMagicLink(@Body() body: { email: string }) {
    // Always return success (don't reveal if email exists)
    try {
      await this.billing.requestMagicLink(body.email);
    } catch {
      // silently ignore
    }
    return { message: 'If this email has an account, a login link was sent.' };
  }

  // ── Subscription Info ─────────────────────────────────

  @Get('api/billing/subscription')
  @UseGuards(AuthGuard)
  async getSubscription(@Req() req: any) {
    const sub = await this.billing.getSubscription(req.user.userId);
    return sub || { tier: 'free', status: 'active' };
  }
}
