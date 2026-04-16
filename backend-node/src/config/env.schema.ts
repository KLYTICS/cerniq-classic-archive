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
  // Consumed by oauth-config.util.ts; must be a well-formed URL.
  GOOGLE_CALLBACK_URL: z.string().url().optional(),
  GITHUB_CALLBACK_URL: z.string().url().optional(),
  // Cookie domain for cross-subdomain auth (e.g. `.cerniq.io`).
  AUTH_COOKIE_DOMAIN: z.string().optional(),
  // Canonical frontend origin. Consumed by auth-cookie, oauth-config,
  // origin-allowlist, pipeline.worker, portal demo-seat, and the alert
  // notifier deep-link. A typo here (today) silently breaks magic
  // links and SameSite cookies — hence strict URL validation.
  FRONTEND_URL: z.string().url().optional(),

  // ── Billing ──────────────────────────────────────────────────────
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_MONTHLY: z.string().optional(),
  STRIPE_PRICE_ANNUAL: z.string().optional(),
  STRIPE_PRICE_PILOT: z.string().optional(),

  // ── Email ────────────────────────────────────────────────────────
  RESEND_API_KEY: z.string().optional(),
  EMAIL_FROM: z.string().default('CerniQ <reports@cerniq.io>'),
  // Reply-to for agent alert emails (founder inbox).
  ERWIN_EMAIL: z.string().email().optional(),

  // ── Security ─────────────────────────────────────────────────────
  DATA_ENCRYPTION_KEY: z.string().optional(),
  API_KEY_PEPPER: z
    .string()
    .min(32, 'API_KEY_PEPPER must be at least 32 characters')
    .optional(),
  ALLOWED_ORIGINS: z.string().optional(),

  // ── AI / Claude ──────────────────────────────────────────────────
  ANTHROPIC_API_KEY: z.string().optional(),
  // Forwarded verbatim to the Anthropic client for opt-in beta features.
  ANTHROPIC_BETA_HEADER: z.string().optional(),

  // ── Agent runtime (Wave-03) ──────────────────────────────────────
  // Per-institution LLM worker concurrency. Defaults live in the queue
  // module; this just validates the override.
  AGENT_WORKER_CONCURRENCY: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).max(50).optional()),
  // Per-run output token cap. Values <1 would create silent no-ops.
  MAX_AGENT_TOKENS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).optional()),
  // Cost circuit breaker threshold in USD. `0` is legal ("alert on
  // anything") so we use nonnegative, not positive.
  LLM_COST_ALERT_THRESHOLD_USD: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().nonnegative().optional()),
  // Legacy/precise form of the cost cap, expressed in integer cents.
  // `AgentCostCircuitBreakerService` prefers this when set for exact
  // integer math; otherwise it falls back to LLM_COST_ALERT_THRESHOLD_USD
  // (from `.env.example`) multiplied by 100. Validation prevents the
  // silent-disable-on-typo path where `parseInt('abc',10)` returned NaN.
  LLM_COST_CAP_USD_CENTS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(1).optional()),
  // Retention window for agent_audit_logs and audit_logs. Default lives
  // in the service layer (2555 = 7 years, matches security claim page).
  AUDIT_LOG_RETENTION_DAYS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().positive().optional()),
  // SSE keepalive interval. Lower bound is 100ms to avoid accidental
  // busy-loop heartbeats.
  SSE_HEARTBEAT_INTERVAL_MS: z
    .string()
    .optional()
    .transform((v) => (v ? Number(v) : undefined))
    .pipe(z.number().int().min(100).optional()),
  // Kill switch for the scheduler (maps to AgentSchedulerService
  // truthy check). Accepts only the canonical truthy/falsy strings.
  AGENT_SCHEDULER_DISABLED: z
    .enum(['true', 'false', '1', '0'])
    .optional(),

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
