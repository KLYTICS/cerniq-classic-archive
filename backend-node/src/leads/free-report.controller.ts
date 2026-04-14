import {
  Controller,
  Post,
  Get,
  Param,
  Body,
  Req,
  Res,
  Logger,
  HttpCode,
  BadRequestException,
  HttpException,
  HttpStatus,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import { FreeReportService } from './free-report.service';
import { PrismaService } from '../prisma.service';
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

  constructor(
    private readonly freeReport: FreeReportService,
    private readonly prisma: PrismaService,
  ) {}

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
      pdfGenerated: true,
    };
  }

  // ── Tracking Pixel ──────────────────────────────────────

  /** 1x1 transparent PNG returned for email open tracking. */
  private static readonly TRANSPARENT_1X1_PNG = Buffer.from(
    'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAYAAAAfFcSJAAAAC0lEQVQI12NgAAIABQAB' +
      'Nl7BcQAAAABJRU5ErkJggg==',
    'base64',
  );

  @Get('api/leads/track/:leadId')
  @SkipThrottle()
  async trackOpen(
    @Param('leadId') leadId: string,
    @Res() res: any,
  ): Promise<void> {
    // Fire-and-forget: merge openedAt into the Lead's publicDataSnapshot JSON field
    this.prisma.$executeRaw`
      UPDATE leads
      SET public_data_snapshot = COALESCE(public_data_snapshot, '{}'::jsonb) || ${JSON.stringify({ openedAt: new Date().toISOString() })}::jsonb
      WHERE id = ${leadId}
    `.catch((err: unknown) => {
      this.logger.warn({
        event: 'tracking_pixel.update_failed',
        leadId,
        error: err instanceof Error ? err.message : String(err),
      });
    });

    this.logger.log({ event: 'tracking_pixel.opened', leadId });

    res.set({
      'Content-Type': 'image/png',
      'Content-Length': FreeReportController.TRANSPARENT_1X1_PNG.length,
      'Cache-Control': 'no-store, no-cache, must-revalidate, proxy-revalidate',
      Pragma: 'no-cache',
      Expires: '0',
    });
    res.end(FreeReportController.TRANSPARENT_1X1_PNG);
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
