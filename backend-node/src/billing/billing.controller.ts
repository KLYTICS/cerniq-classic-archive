import {
  Controller,
  Post,
  Get,
  Body,
  Headers,
  Req,
  Res,
  Query,
  UseGuards,
  HttpCode,
  HttpStatus,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { SkipThrottle, Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiHeader,
} from '@nestjs/swagger';
import { BillingService } from './billing.service';
import { CheckoutRequestDto } from './billing.dto';
import { AuthGuard } from '../auth/auth.guard';
import { AuditService } from '../audit/audit.service';
import { PrismaService } from '../prisma.service';

const isProduction = process.env.NODE_ENV === 'production';

function parseBoolean(raw: string | undefined, fallback: boolean): boolean {
  const normalized = (raw || '').trim().toLowerCase();
  if (!normalized) return fallback;
  return (
    normalized === '1' ||
    normalized === 'true' ||
    normalized === 'yes' ||
    normalized === 'on'
  );
}

function resolveCookieSameSite(): 'lax' | 'strict' | 'none' {
  const configured = (process.env.AUTH_COOKIE_SAMESITE || '')
    .trim()
    .toLowerCase();
  if (
    configured === 'strict' ||
    configured === 'none' ||
    configured === 'lax'
  ) {
    return configured;
  }
  return 'lax';
}

function resolveFrontendUrl(): string {
  const configured = (process.env.FRONTEND_URL || '')
    .trim()
    .replace(/\/+$/, '');
  if (configured) {
    return configured;
  }
  if (!isProduction) {
    return 'http://localhost:3001';
  }
  return 'https://cerniq.io';
}

const COOKIE_SECURE = parseBoolean(
  process.env.AUTH_COOKIE_SECURE,
  isProduction,
);
const COOKIE_SAME_SITE = resolveCookieSameSite();
const COOKIE_DOMAIN = (process.env.AUTH_COOKIE_DOMAIN || '').trim();

const AUTH_COOKIE_OPTIONS = {
  httpOnly: true,
  secure: COOKIE_SECURE,
  sameSite: COOKIE_SAME_SITE,
  path: '/',
  ...(COOKIE_DOMAIN ? { domain: COOKIE_DOMAIN } : {}),
};

@ApiTags('Billing')
@Controller()
export class BillingController {
  private readonly logger = new Logger(BillingController.name);

  constructor(
    private readonly billing: BillingService,
    private readonly audit: AuditService,
    private readonly prisma: PrismaService,
  ) {}

  // ── Checkout ──────────────────────────────────────────

  @Post('api/billing/checkout')
  @Throttle({ default: { limit: 10, ttl: 3600000 } })
  async createCheckout(@Body() body: CheckoutRequestDto, @Req() req: any) {
    const result = await this.billing.createCheckoutSession({
      tier: body.tier,
      customerEmail: body.customerEmail,
      customerName: body.customerName,
      institutionName: body.institutionName,
      leadId: body.leadId,
      successUrl: body.successUrl,
      cancelUrl: body.cancelUrl,
    });

    this.audit.log({
      action: 'payment_initiated',
      resource: 'subscription',
      metadata: {
        tier: body.tier,
        customerEmail: body.customerEmail,
        institutionName: body.institutionName,
      },
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
    });

    return result;
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
      this.logger.error({
        event: 'webhook.signature_failed',
        error: err.message,
      });
      throw new BadRequestException('Invalid webhook signature');
    }

    this.logger.log({
      event: 'webhook.received',
      type: event.type,
      id: event.id,
    });

    // Idempotency: skip already-processed events (Stripe can replay)
    const existing = await this.prisma.processedWebhookEvent.findUnique({
      where: { id: event.id },
    });
    if (existing) {
      this.logger.log({ event: 'webhook.duplicate_skipped', id: event.id });
      return { received: true, duplicate: true };
    }

    try {
      switch (event.type) {
        case 'checkout.session.completed': {
          const session = event.data.object;
          if (session.payment_status === 'paid') {
            await this.billing.handlePaymentComplete(session);
          }
          break;
        }
        case 'customer.subscription.created':
          await this.billing.handleSubscriptionCreated(event.data.object);
          break;
        case 'customer.subscription.updated':
          await this.billing.handleSubscriptionUpdated(event.data.object);
          break;
        case 'invoice.payment_succeeded':
          await this.billing.handleInvoicePaid(event.data.object);
          break;
        case 'invoice.payment_failed':
          await this.billing.handlePaymentFailed(event.data.object);
          break;
        case 'customer.subscription.deleted':
          await this.billing.handleSubscriptionCancelled(event.data.object);
          break;
        case 'charge.dispute.created':
          await this.billing.handleDispute(event.data.object);
          break;
        default:
          this.logger.log({ event: 'webhook.unhandled', type: event.type });
      }

      // Mark event as processed after successful handling
      await this.prisma.processedWebhookEvent.create({
        data: { id: event.id, eventType: event.type },
      }).catch((err: any) => {
        // Unique constraint race — another instance processed it first
        this.logger.warn({ event: 'webhook.dedup_race', id: event.id, error: err.message });
      });
    } catch (err: any) {
      // Log error but return 200 to prevent Stripe retry storms
      this.logger.error({
        event: 'webhook.processing_error',
        type: event.type,
        id: event.id,
        error: err.message,
        stack: err.stack,
      });
    }

    return { received: true };
  }

  // ── Magic Link Auth ───────────────────────────────────

  @Get('auth/magic')
  @Throttle({ default: { limit: 10, ttl: 900000 } })
  async verifyMagicLink(
    @Query('token') token: string,
    @Req() req: any,
    @Res() res: any,
  ) {
    const frontendUrl = resolveFrontendUrl();
    if (!token) {
      return res.redirect(`${frontendUrl}/auth/expired`);
    }

    const user = await this.billing.verifyMagicLink(token);
    if (!user) {
      this.audit.log({
        action: 'login',
        resource: 'magic_link',
        outcome: 'failure',
        metadata: { reason: 'invalid_or_expired_token' },
        ipAddress: req.ip,
        userAgent: req.headers?.['user-agent'],
      });
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

    this.audit.log({
      userId: user.id,
      action: 'login',
      resource: 'magic_link',
      outcome: 'success',
      ipAddress: req.ip,
      userAgent: req.headers?.['user-agent'],
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
    } catch (err) {
      // Don't reveal account existence — but log for audit trail
      this.logger.warn(`Magic link request failed for ${body.email}: ${(err as Error).message}`);
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
