/**
 * Zod-based environment variable validation schema.
 *
 * Replaces the manual string checks in main.ts with a typed schema
 * that validates at startup. Every env var the app reads is declared
 * here with its type, constraints, and default values.
 *
 * Usage:
 *   import { validateEnv, type Env } from './config/env.schema';
 *   const env = validateEnv();
 */
import { z } from 'zod';

const envSchema = z.object({
  // ── Required (fatal if missing) ──────────────────────────────────
  JWT_SECRET: z.string().min(32, 'JWT_SECRET must be at least 32 characters'),
  DATABASE_URL: z.string().min(1, 'DATABASE_URL is required'),

  // ── Node/NestJS ──────────────────────────────────────────────────
  NODE_ENV: z
    .enum(['development', 'production', 'test'])
    .default('development'),
  PORT: z
    .string()
    .default('4000')
    .transform(Number)
    .pipe(z.number().int().min(1).max(65535)),

  // ── Auth ─────────────────────────────────────────────────────────
  ADMIN_KEY: z.string().optional(),
  SUPABASE_URL: z.string().optional(),
  SUPABASE_SERVICE_ROLE_KEY: z.string().optional(),
  SUPABASE_JWT_SECRET: z.string().optional(),

  // ── OAuth ───────────────────────────────────────���────────────────
  GOOGLE_CLIENT_ID: z.string().optional(),
  GOOGLE_CLIENT_SECRET: z.string().optional(),
  GOOGLE_REDIRECT_URI: z.string().optional(),
  GITHUB_CLIENT_ID: z.string().optional(),
  GITHUB_CLIENT_SECRET: z.string().optional(),
  GITHUB_REDIRECT_URI: z.string().optional(),

  // ── Billing ──────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PILOT: z.string().optional(),

  // ── Email ────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('CerniQ <reports@cerniq.io>'),

  // ── Security ─────────────────────────────────────────────────────
  DATA_ENCRYPTION_KEY: z.string().optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // ── AI / Claude ──────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),

  // ── Storage ──────────────────────────────────────────────────────
  AWS_ACCESS_KEY_ID: z.string().optional(),
  AWS_SECRET_ACCESS_KEY: z.string().optional(),
  AWS_S3_BUCKET: z.string().optional(),
  AWS_S3_REGION: z.string().optional(),
  AWS_S3_ENDPOINT: z.string().optional(),

  // ── Cache ────────────────────────────────────────────────────────
  REDIS_URL: z.string().optional(),

  // ── Observability ────────────────────────────────────────────────
  SENTRY_DSN: z.string().optional(),
  OTEL_EXPORTER_OTLP_ENDPOINT: z.string().optional(),
  OTEL_EXPORTER_OTLP_HEADERS: z.string().optional(),
  LOG_LEVEL: z
    .enum(['fatal', 'error', 'warn', 'info', 'debug', 'trace'])
    .optional(),

  // ���─ Deploy context ───────────────────────────────────────────────
  RAILWAY_GIT_COMMIT_SHA: z.string().optional(),
  RAILWAY_ENVIRONMENT: z.string().optional(),

  // ── Rate limiting ────────────────────────────────────────────────
  THROTTLE_TTL: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().positive().optional()),
  THROTTLE_LIMIT: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().positive().optional()),
});

export type Env = z.infer<typeof envSchema>;

/**
 * Validate and return typed environment variables.
 * Throws a formatted error listing all validation failures.
 */
export function validateEnv(): Env {
  const result = envSchema.safeParse(process.env);

  if (!result.success) {
    const issues = result.error.issues.map(
      (i) => `  ${i.path.join('.')}: ${i.message}`,
    );
    const msg = [
      '',
      '╔══════════════════════════════���═══════════════╗',
      '║  CERNIQ — Environment Validation Failed      ║',
      '╚══════════════════════════════════════════════╝',
      '',
      ...issues,
      '',
      'Fix the above environment variables and restart.',
      '',
    ].join('\n');

    console.error(msg);
    process.exit(1);
  }

  return result.data;
}
