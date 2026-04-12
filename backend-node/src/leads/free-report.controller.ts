import {
  Controller,
  Post,
  Body,
  Req,
  Logger,
  HttpCode,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FreeReportService } from './free-report.service';
import { TokenBucketLimiter } from '../common/utils/rate-limit.util';

// ─── DTO (validated inline — no external dep needed) ────────

interface FreeReportDto {
  institutionName: string;
  email: string;
  firstName: string;
}

/**
 * Public-facing controller for the free ALM health check.
 * NO authentication required — this is the cold-outreach conversion hook.
 *
 * Rate limiting: 3 requests per IP per day (86 400 seconds).
 * Uses the project's existing TokenBucketLimiter utility so we stay
 * in-memory without needing Redis for this lightweight endpoint.
 */
@Controller()
export class FreeReportController {
  private readonly logger = new Logger(FreeReportController.name);

  /**
   * 3 tokens max, refill rate = 3 / 86400 ≈ 0.0000347 tokens/sec.
   * This gives each IP exactly 3 requests per 24-hour rolling window.
   */
  private readonly rateLimiter = new TokenBucketLimiter({
    maxTokens: 3,
    refillRate: 3 / 86_400,
  });

  constructor(private readonly freeReport: FreeReportService) {}

  @Post('api/leads/free-report')
  @SkipThrottle() // We handle our own rate limiting below
  @HttpCode(200)
  async requestFreeReport(@Body() body: FreeReportDto, @Req() req: any) {
    // ── Validate ──
    if (!body || typeof body !== 'object') {
      throw new BadRequestException('Request body is required.');
    }

    const institutionName = (body.institutionName ?? '').trim();
    const email = (body.email ?? '').trim().toLowerCase();
    const firstName = (body.firstName ?? '').trim();

    if (!institutionName) {
      throw new BadRequestException('institutionName is required.');
    }
    if (!firstName) {
      throw new BadRequestException('firstName is required.');
    }
    if (!this.isValidEmail(email)) {
      throw new BadRequestException('A valid email address is required.');
    }

    // ── Rate limit by IP ──
    const ip =
      req.headers['x-forwarded-for']?.split(',')[0]?.trim() ||
      req.ip ||
      'unknown';

    if (!this.rateLimiter.consume(`free-report:${ip}`)) {
      const retryAfter = this.rateLimiter.retryAfter(`free-report:${ip}`);
      this.logger.warn({
        event: 'free_report.rate_limited',
        ip,
        retryAfterSec: retryAfter,
      });
      throw new HttpException(
        {
          statusCode: HttpStatus.TOO_MANY_REQUESTS,
          message:
            'Ha excedido el límite de solicitudes. Intente nuevamente mañana. / You have exceeded the request limit. Please try again tomorrow.',
          retryAfterSeconds: Math.ceil(retryAfter),
        },
        HttpStatus.TOO_MANY_REQUESTS,
      );
    }

    // ── Generate ──
    this.logger.log({
      event: 'free_report.requested',
      institutionName,
      email,
      ip,
    });

    const result = await this.freeReport.generateFreeReport({
      institutionName,
      email,
      firstName,
    });

    return {
      success: true,
      message:
        'Su reporte será enviado en los próximos 5 minutos. / Your report will be sent within 5 minutes.',
      healthScore: result.healthScore,
      healthGrade: result.healthGrade,
      niiHook: result.niiHookFormatted,
      matched: result.matched,
    };
  }

  // ── Helpers ──

  private isValidEmail(email: string): boolean {
    // RFC 5322 simplified — good enough for lead capture
    return /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/.test(email);
  }

  // Exposed for testing
  get _rateLimiter(): TokenBucketLimiter {
    return this.rateLimiter;
  }
}
