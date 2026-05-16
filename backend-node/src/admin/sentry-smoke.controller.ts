import {
  Controller,
  Get,
  HttpException,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import { AdminKeyGuard } from '../auth/admin-key.guard';

/**
 * Sentry smoke endpoint — one-shot verification that error capture is wired
 * end-to-end on the live backend.
 *
 * Contract:
 *   GET /admin/api/sentry-smoke
 *     - Requires AdminKeyGuard (x-admin-key header).
 *     - In production, returns 501 UNLESS `SENTRY_SMOKE_ENABLED=1` is set.
 *       (Prevents accidental noise in prod Sentry projects from a stray curl.)
 *     - In dev/staging, always throws a labeled error that Sentry captures.
 *
 * Usage during going-live:
 *
 *   curl -H "x-admin-key: $ADMIN_KEY" https://api.cerniq.io/admin/api/sentry-smoke
 *
 * Expect: 500 response + a new Sentry issue titled
 *   "Sentry smoke test — CERNIQ backend wired correctly"
 * within 60s. If the issue doesn't show up, check:
 *   • SENTRY_DSN env var is set on Railway
 *   • SentryModule.forRoot() is registered in AppModule (it is, line ~85)
 *   • Outbound network access to ingest.sentry.io is permitted
 *
 * This endpoint is intentionally minimal and idempotent. Once verified,
 * revoke access by removing `SENTRY_SMOKE_ENABLED` from Railway.
 */
@Controller('admin/api/sentry-smoke')
@UseGuards(AdminKeyGuard)
export class SentrySmokeController {
  @Get()
  trigger(): never {
    const isProd = process.env.NODE_ENV === 'production';
    const explicitlyEnabled = process.env.SENTRY_SMOKE_ENABLED === '1';

    if (isProd && !explicitlyEnabled) {
      throw new HttpException(
        {
          error: 'disabled',
          message:
            'Sentry smoke endpoint is disabled in production. Set SENTRY_SMOKE_ENABLED=1 to enable, then remove after verification.',
        },
        HttpStatus.NOT_IMPLEMENTED,
      );
    }

    // Throw a deliberately-labeled error so it's easy to find the resulting
    // Sentry issue and confirm provenance. Do NOT change this message
    // without also updating going-live runbooks.
    throw new Error(
      'Sentry smoke test — CERNIQ backend wired correctly. Delete this issue from Sentry after triage.',
    );
  }
}
