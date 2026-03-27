# CERNIQ Enterprise Engineering Bible - Part 3

## 9. Error Handling & Observability

### 9.1 Global Exception Filter Architecture

Every unhandled error is caught, logged, and transformed into a structured response.

```typescript
// backend-node/src/common/filters/exception.filter.ts
import {
  ExceptionFilter,
  Catch,
  ArgumentsHost,
  HttpException,
  HttpStatus,
  Logger,
} from '@nestjs/common';
import { Request, Response } from 'express';
import * as Sentry from '@sentry/node';

@Catch()
export class GlobalExceptionFilter implements ExceptionFilter {
  private readonly logger = new Logger(GlobalExceptionFilter.name);

  catch(exception: unknown, host: ArgumentsHost) {
    const ctx = host.switchToHttp();
    const response = ctx.getResponse<Response>();
    const request = ctx.getRequest<Request>();

    let status = HttpStatus.INTERNAL_SERVER_ERROR;
    let code = 'INTERNAL_SERVER_ERROR';
    let message = 'An unexpected error occurred';
    let details: any = undefined;

    // Handle NestJS HttpException
    if (exception instanceof HttpException) {
      status = exception.getStatus();
      const errorResponse = exception.getResponse();

      if (typeof errorResponse === 'object') {
        code = errorResponse['code'] || exception.name;
        message = errorResponse['message'] || exception.message;
        details = errorResponse['details'];
      } else {
        message = errorResponse as string;
      }
    } else if (exception instanceof Error) {
      // Handle generic Error
      message = exception.message;
      code = exception.name;

      // Log stack trace for unexpected errors
      this.logger.error('Unexpected error', {
        message: exception.message,
        stack: exception.stack,
        path: request.path,
      });
    }

    const errorResponse = {
      code,
      message,
      statusCode: status,
      timestamp: new Date().toISOString(),
      path: request.path,
      ...(details && { details }),
    };

    // Report to Sentry for errors >= 500
    if (status >= 500) {
      Sentry.captureException(exception, {
        contexts: {
          request: {
            method: request.method,
            path: request.path,
            headers: request.headers,
          },
        },
      });
    }

    response.status(status).json(errorResponse);
  }
}

// Register in main.ts:
app.useGlobalFilters(new GlobalExceptionFilter());
```

### 9.2 Error Response Format

**Every API error response follows this format:**

```json
{
  "code": "UNIQUE_ERROR_CODE",
  "message": "Human-readable error message",
  "statusCode": 400,
  "timestamp": "2026-03-27T14:32:00Z",
  "path": "/api/v1/portfolios/xyz",
  "details": {
    "field": "portfolio_id",
    "reason": "Portfolio with this ID not found"
  }
}
```

**Error codes by category:**

```
Auth errors:
  INVALID_CREDENTIALS        (401)
  TOKEN_EXPIRED              (401)
  INVALID_API_KEY            (401)
  INSUFFICIENT_PERMISSIONS   (403)
  WORKSPACE_ACCESS_DENIED    (403)

Validation errors:
  INVALID_REQUEST_BODY       (400)
  MISSING_REQUIRED_FIELD     (400)
  INVALID_PORTFOLIO_ID       (400)
  INVALID_DATE_FORMAT        (400)

Resource errors:
  PORTFOLIO_NOT_FOUND        (404)
  ASSET_NOT_FOUND            (404)
  ORGANIZATION_NOT_FOUND     (404)
  WORKSPACE_NOT_FOUND        (404)

Conflict errors:
  PORTFOLIO_ALREADY_EXISTS   (409)
  DUPLICATE_ASSET            (409)
  CONCURRENT_MODIFICATION    (409)

Rate limiting:
  RATE_LIMIT_EXCEEDED        (429)
  TOO_MANY_REQUESTS          (429)

Server errors:
  DATABASE_ERROR             (500)
  CALCULATION_FAILED         (500)
  PDF_GENERATION_FAILED      (500)
  INTERNAL_SERVER_ERROR      (500)
```

### 9.3 Sentry Error Tracking Integration

```typescript
// backend-node/src/main.ts
import * as Sentry from '@sentry/node';
import { nodeProfilingIntegration } from '@sentry/profiling-node';

async function bootstrap() {
  // Initialize Sentry
  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV,
    integrations: [
      nodeProfilingIntegration(),
      new Sentry.Integrations.Http({ tracing: true }),
    ],
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
  });

  const app = await NestFactory.create(AppModule);

  // Use Sentry middleware for transaction tracking
  app.use(Sentry.Handlers.requestHandler());
  app.use(Sentry.Handlers.errorHandler());

  await app.listen(3001);
}

bootstrap();
```

**Sentry in services:**

```typescript
@Injectable()
export class AlmService {
  async calculateAlm(portfolioId: string) {
    const transaction = Sentry.startTransaction({
      op: 'alm.calculate',
      name: 'Calculate ALM',
    });

    try {
      const result = await this._calculateInternal(portfolioId);
      transaction.setStatus('ok');
      return result;
    } catch (error) {
      transaction.setStatus('error');
      Sentry.captureException(error, {
        contexts: {
          alm: {
            portfolioId,
            calculationType: 'full_calculation',
          },
        },
        level: 'error',
      });
      throw error;
    } finally {
      transaction.finish();
    }
  }
}
```

### 9.4 OpenTelemetry Distributed Tracing

```typescript
// backend-node/src/tracing.ts
import { BasicTracerProvider, ConsoleSpanExporter, SimpleSpanProcessor } from '@opentelemetry/sdk-trace-node';
import { NodeSDK } from '@opentelemetry/auto-instrumentations-node';

const sdk = new NodeSDK({
  traceExporter: new ConsoleSpanExporter(),
});

sdk.start();

// Spans are automatically created for:
// - HTTP requests/responses
// - Database queries (Prisma)
// - Redis operations
// - Timers and promises

export default sdk;
```

**Manual span creation:**

```typescript
import { trace } from '@opentelemetry/api';

const tracer = trace.getTracer('cerniq-backend');

async function complexCalculation() {
  const span = tracer.startSpan('complex_calculation');

  try {
    const childSpan = tracer.startSpan('data_fetch', { parent: span });
    const data = await fetchData();
    childSpan.end();

    const processSpan = tracer.startSpan('process_data', { parent: span });
    const result = processData(data);
    processSpan.end();

    return result;
  } finally {
    span.end();
  }
}
```

### 9.5 Pino Structured Logging

```typescript
// backend-node/src/logger/logger.service.ts
import pino from 'pino';

export const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
  transport:
    process.env.NODE_ENV === 'production'
      ? undefined
      : {
          target: 'pino-pretty',
          options: {
            colorize: true,
            singleLine: false,
            translateTime: 'SYS:standard',
            ignore: 'pid,hostname',
          },
        },
});

// Usage:
import { Logger } from '@nestjs/common';

@Injectable()
export class PortfolioService {
  private logger = new Logger(PortfolioService.name);

  async createPortfolio(organizationId: string, dto: CreatePortfolioDto) {
    const correlationId = v4();

    this.logger.log('Creating portfolio', {
      correlationId,
      organizationId,
      portfolioName: dto.name,
    });

    const portfolio = await this.prisma.portfolio.create({
      data: { ...dto, organizationId },
    });

    this.logger.log('Portfolio created', {
      correlationId,
      portfolioId: portfolio.id,
      duration: Date.now() - startTime,
    });

    return portfolio;
  }
}
```

**Log levels by severity:**

```
DEBUG: Detailed execution flow, variable values
  portfolio_service.ts:
    "Fetching portfolio from database"
    "Setting cache TTL to 600 seconds"

INFO: Business events (creates, updates, calculations)
  portfolio_service.ts:
    "Portfolio created successfully"
    "ALM calculation started"
    "Risk metrics updated"

WARN: Recoverable issues (retries, degraded state)
  portfolio_service.ts:
    "Database query slow: 250ms (expected <50ms)"
    "Redis connection failed, using database fallback"
    "Retry attempt 2 of 3"

ERROR: Unrecoverable failures (crashes, exceptions)
  portfolio_service.ts:
    "Failed to create portfolio: database error"
    "Calculation timed out after 5 seconds"
    "Payment processing failed"

FATAL: System-level failures requiring intervention
  main.ts:
    "Database connection lost"
    "Out of memory - emergency shutdown"
```

### 9.6 Health Check Architecture

```typescript
// backend-node/src/health/health.controller.ts
import { Controller, Get } from '@nestjs/common';
import { HealthService } from './health.service';

@Controller('health')
export class HealthController {
  constructor(private health: HealthService) {}

  /**
   * GET /health
   * Returns 200 if service is running
   * Used by Kubernetes, load balancers
   */
  @Get()
  async liveness() {
    return {
      status: 'ok',
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /ready
   * Returns 200 if service is ready to handle traffic
   * Checks dependencies (DB, Redis, external services)
   */
  @Get('ready')
  async readiness() {
    const checks = await this.health.checkAll();

    return {
      status: checks.every(c => c.healthy) ? 'ready' : 'not_ready',
      checks,
      timestamp: new Date().toISOString(),
    };
  }

  /**
   * GET /health/detailed
   * Detailed health check with metrics
   */
  @Get('detailed')
  async detailed() {
    return {
      service: 'cerniq-backend',
      version: process.env.VERSION || 'unknown',
      uptime: process.uptime(),
      memory: process.memoryUsage(),
      database: await this.health.checkDatabase(),
      redis: await this.health.checkRedis(),
      timestamp: new Date().toISOString(),
    };
  }
}

@Injectable()
export class HealthService {
  constructor(
    private prisma: PrismaService,
    private redis: RedisService,
  ) {}

  async checkAll() {
    return Promise.all([
      this.checkDatabase(),
      this.checkRedis(),
      this.checkExternalServices(),
    ]);
  }

  async checkDatabase() {
    try {
      await this.prisma.$queryRaw`SELECT 1`;
      return { name: 'database', healthy: true, latencyMs: null };
    } catch (error) {
      return { name: 'database', healthy: false, error: error.message };
    }
  }

  async checkRedis() {
    try {
      await this.redis.ping();
      return { name: 'redis', healthy: true };
    } catch (error) {
      return { name: 'redis', healthy: false, error: error.message };
    }
  }

  async checkExternalServices() {
    // Check Stripe, Resend, etc.
    return { name: 'external', healthy: true };
  }
}
```

### 9.7 Alert Thresholds and On-Call Runbook

```yaml
# monitoring/alerts.yml
alerts:
  - name: HighErrorRate
    condition: error_rate > 5%
    window: 5m
    severity: critical
    action: page_oncall
    runbook: "https://docs.cerniq.com/runbooks/high-error-rate"

  - name: DatabaseResponseSlow
    condition: db_query_p99 > 200ms
    window: 10m
    severity: warning
    action: alert_slack
    runbook: "https://docs.cerniq.com/runbooks/slow-db"

  - name: RedisCacheMiss
    condition: cache_miss_ratio > 30%
    window: 15m
    severity: warning
    action: alert_slack

  - name: OutOfMemory
    condition: memory_usage > 90%
    window: 1m
    severity: critical
    action: page_oncall

  - name: StripeWebhookFailure
    condition: webhook_error_count > 10
    window: 5m
    severity: critical
    action: page_oncall

  - name: PDFGenerationTimeout
    condition: pdf_timeout_count > 5
    window: 10m
    severity: warning
    action: alert_slack
```

---

## 10. Security Engineering

### 10.1 CORS Configuration

CERNIQ accepts requests from:
- Production: `https://cerniq.com`, `https://*.cerniq.com`
- Staging: `https://staging.cerniq.com`
- Vercel previews: `https://*.vercel.app`
- Development: `http://localhost:3000`

```typescript
// backend-node/src/main.ts
import { NestFactory } from '@nestjs/core';
import { AppModule } from './app.module';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.enableCors({
    origin: (origin, callback) => {
      const allowedOrigins = [
        /^https:\/\/cerniq\.com$/,
        /^https:\/\/[\w-]+\.cerniq\.com$/,
        /^https:\/\/[\w-]+\.vercel\.app$/,
        /^http:\/\/localhost:3000$/,
      ];

      const isAllowed = allowedOrigins.some(pattern =>
        pattern.test(origin || '')
      );

      if (isAllowed || !origin) {
        callback(null, true);
      } else {
        callback(new Error('CORS not allowed'));
      }
    },
    credentials: true,
    methods: ['GET', 'POST', 'PATCH', 'DELETE', 'PUT', 'OPTIONS'],
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'X-API-Key',
      'X-Correlation-ID',
    ],
  });

  await app.listen(3001);
}

bootstrap();
```

### 10.2 Rate Limiting Implementation

```typescript
// backend-node/src/app.module.ts
import { ThrottlerModule } from '@nestjs/throttler';

@Module({
  imports: [
    ThrottlerModule.forRoot([
      {
        name: 'global',
        ttl: 60000,
        limit: 100,
      },
      {
        name: 'auth',
        ttl: 60000,
        limit: 5,
      },
      {
        name: 'calculation',
        ttl: 60000,
        limit: 10,
      },
    ]),
  ],
})
export class AppModule {}

// Controllers:
@Controller('api/v1/auth')
export class AuthController {
  @Post('login')
  @UseGuards(ThrottlerGuard)
  @Throttle({ auth: { limit: 5, ttl: 60000 } })
  async login(@Body() dto: LoginDto) {
    // Max 5 login attempts per minute per IP
  }
}

@Controller('api/v1/alm')
export class AlmController {
  @Post('calculate')
  @UseGuards(ThrottlerGuard)
  @Throttle({ calculation: { limit: 10, ttl: 60000 } })
  async calculate(@Body() dto: CalculateAlmDto) {
    // Max 10 calculations per minute per user
  }
}
```

### 10.3 AES-256-GCM Encryption Service

Sensitive data (SSN, account numbers, etc.) is encrypted at rest.

```typescript
// backend-node/src/crypto/encryption.service.ts
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly encryptionKey: Buffer;

  constructor() {
    // Load key from environment (must be 32 bytes for AES-256)
    this.encryptionKey = Buffer.from(
      process.env.ENCRYPTION_KEY,
      'hex'
    );

    if (this.encryptionKey.length !== 32) {
      throw new Error('ENCRYPTION_KEY must be 64 hex characters (32 bytes)');
    }
  }

  /**
   * Encrypt plaintext using AES-256-GCM
   * Returns: iv::authTag::ciphertext (all hex-encoded)
   */
  encrypt(plaintext: string): string {
    const iv = crypto.randomBytes(16); // IV unique per encryption
    const cipher = crypto.createCipheriv('aes-256-gcm', this.encryptionKey, iv);

    let ciphertext = cipher.update(plaintext, 'utf8', 'hex');
    ciphertext += cipher.final('hex');

    const authTag = cipher.getAuthTag();

    // Format: iv::authTag::ciphertext
    return `${iv.toString('hex')}::${authTag.toString('hex')}::${ciphertext}`;
  }

  /**
   * Decrypt ciphertext using AES-256-GCM
   */
  decrypt(encryptedData: string): string {
    const [ivHex, authTagHex, ciphertext] = encryptedData.split('::');

    const iv = Buffer.from(ivHex, 'hex');
    const authTag = Buffer.from(authTagHex, 'hex');

    const decipher = crypto.createDecipheriv(
      'aes-256-gcm',
      this.encryptionKey,
      iv
    );
    decipher.setAuthTag(authTag);

    let plaintext = decipher.update(ciphertext, 'hex', 'utf8');
    plaintext += decipher.final('utf8');

    return plaintext;
  }
}

// Usage:
@Injectable()
export class UserService {
  constructor(private encryption: EncryptionService) {}

  async createUser(email: string, ssn: string) {
    // Encrypt SSN before storing
    const encryptedSsn = this.encryption.encrypt(ssn);

    return this.prisma.user.create({
      data: {
        email,
        ssn: encryptedSsn,
      },
    });
  }

  async getUserSsn(userId: string): Promise<string> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    // Decrypt SSN when needed
    return this.encryption.decrypt(user.ssn);
  }
}

// Prisma model:
model User {
  id        String @id @default(cuid())
  email     String @unique
  ssn       String // Stored encrypted
  createdAt DateTime @default(now())
}
```

### 10.4 Bcrypt Password Hashing

```typescript
// backend-node/src/crypto/password.service.ts
import * as bcrypt from 'bcrypt';

@Injectable()
export class PasswordService {
  private readonly saltRounds = 12; // High but not excessive

  async hash(password: string): Promise<string> {
    return bcrypt.hash(password, this.saltRounds);
  }

  async verify(password: string, hash: string): Promise<boolean> {
    return bcrypt.compare(password, hash);
  }

  /**
   * Upgrade password hash on login (if rounds changed)
   */
  async shouldUpgradeHash(password: string, hash: string): Promise<boolean> {
    const rounds = parseInt(hash.split('$')[2]);
    return rounds < this.saltRounds;
  }

  async upgradeHash(password: string): Promise<string> {
    return this.hash(password);
  }
}

// Usage:
@Injectable()
export class AuthService {
  constructor(
    private passwords: PasswordService,
    private prisma: PrismaService,
  ) {}

  async login(email: string, password: string) {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await this.passwords.verify(password, user.passwordHash);
    if (!isValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Upgrade hash if needed (transparent to user)
    if (await this.passwords.shouldUpgradeHash(password, user.passwordHash)) {
      const newHash = await this.passwords.upgradeHash(password);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { passwordHash: newHash },
      });
    }

    return this.generateTokens(user);
  }
}
```

### 10.5 API Key Security (Prefix Pattern)

Already covered in Section 5.4. Summarized:

- Prefix pattern: `alm_xxxxxxxx` (visible to user)
- Storage: `SHA256(full_key + pepper)` (unhashable)
- Verification: Constant-time comparison
- Expiration: Optional, tracked per-key
- Rotation: Generate new key, revoke old

### 10.6 Prisma SQL Injection Prevention

Always use `$queryRaw` with template literals (NOT string concatenation):

```typescript
// ❌ VULNERABLE: String concatenation
const dangerous = await this.prisma.$queryRaw(
  `SELECT * FROM users WHERE id = '${userId}'`
);

// ✅ SAFE: Template literals with parameter binding
const safe = await this.prisma.$queryRaw`
  SELECT * FROM "User" WHERE id = ${userId}
`;

// ✅ ALSO SAFE: Using Prisma query builder (no raw SQL)
const safe2 = await this.prisma.user.findUnique({
  where: { id: userId },
});
```

### 10.7 Helmet Security Headers

```typescript
// backend-node/src/main.ts
import helmet from '@nestjs/helmet';

async function bootstrap() {
  const app = await NestFactory.create(AppModule);

  app.use(helmet({
    contentSecurityPolicy: {
      directives: {
        defaultSrc: ["'self'"],
        scriptSrc: ["'self'", "'unsafe-inline'"],
        styleSrc: ["'self'", "'unsafe-inline'"],
        imgSrc: ["'self'", 'data:', 'https:'],
      },
    },
    hsts: {
      maxAge: 31536000, // 1 year
      includeSubDomains: true,
      preload: true,
    },
    frameguard: {
      action: 'deny',
    },
    xssFilter: true,
    noSniff: true,
    referrerPolicy: {
      policy: 'strict-origin-when-cross-origin',
    },
  }));

  await app.listen(3001);
}

bootstrap();
```

### 10.8 Stripe Webhook Signature Verification

```typescript
// backend-node/src/billing/webhook.controller.ts
import { Controller, Post, RawBodyRequest, Req } from '@nestjs/common';
import Stripe from 'stripe';

@Controller('webhooks')
export class WebhookController {
  private stripe: Stripe;

  constructor(private billingService: BillingService) {
    this.stripe = new Stripe(process.env.STRIPE_SECRET_KEY);
  }

  @Post('stripe')
  async handleStripeWebhook(
    @Req() req: RawBodyRequest<Request>
  ) {
    const signature = req.headers['stripe-signature'] as string;
    const rawBody = req.rawBody;

    let event: Stripe.Event;

    try {
      // Verify signature before processing
      event = this.stripe.webhooks.constructEvent(
        rawBody,
        signature,
        process.env.STRIPE_WEBHOOK_SECRET
      );
    } catch (error) {
      throw new BadRequestException(`Webhook signature verification failed: ${error.message}`);
    }

    // Handle events
    switch (event.type) {
      case 'invoice.payment_succeeded':
        await this.billingService.handlePaymentSucceeded(event.data.object);
        break;

      case 'customer.subscription.deleted':
        await this.billingService.handleSubscriptionCanceled(event.data.object);
        break;

      default:
        this.logger.warn(`Unhandled event type: ${event.type}`);
    }

    return { received: true };
  }
}
```

### 10.9 OWASP Top 10 Compliance Checklist

```
A1: Broken Access Control
  [x] Role-based access control implemented
  [x] Guards check user authorization before every action
  [x] Workspace isolation enforced
  [x] API keys scoped to organization
  [x] No direct object reference (e.g., /portfolios/1 requires auth)

A2: Cryptographic Failures
  [x] HTTPS enforced (443 only)
  [x] AES-256-GCM for sensitive data
  [x] Bcrypt for passwords (salt rounds 12)
  [x] API keys hashed with SHA-256 + pepper
  [x] Encryption keys in environment variables

A3: Injection
  [x] Parameterized queries (Prisma template literals)
  [x] Input validation with class-validator
  [x] No string concatenation in SQL
  [x] Helmet CSP headers
  [x] XSS protection

A4: Insecure Design
  [x] Security-first architecture
  [x] Principle of least privilege
  [x] Input validation by default
  [x] Error messages don't leak info
  [x] Rate limiting on sensitive endpoints

A5: Security Misconfiguration
  [x] Helmet headers configured
  [x] CORS whitelist (not wildcard)
  [x] No debug logs in production
  [x] Secrets in environment variables
  [x] Health checks don't expose sensitive data

A6: Vulnerable & Outdated Components
  [x] npm audit regularly run
  [x] Automated dependency updates (Dependabot)
  [x] Node LTS versions only
  [x] No vulnerable packages in lockfile
  [x] Transitive dependencies scanned

A7: Identification & Authentication Failures
  [x] JWT with proper expiration
  [x] Refresh token rotation
  [x] Password complexity requirements
  [x] Rate limiting on auth endpoints
  [x] Token version tracking to prevent reuse

A8: Software & Data Integrity Failures
  [x] Code signed commits
  [x] Build artifacts signed
  [x] CI/CD pipeline secured
  [x] Secrets not in git history
  [x] Dependency integrity verified

A9: Logging & Monitoring Failures
  [x] Structured logging (Pino)
  [x] Error tracking (Sentry)
  [x] Distributed tracing (OpenTelemetry)
  [x] Audit trails for sensitive operations
  [x] No PII/tokens logged

A10: Server-Side Request Forgery (SSRF)
  [x] Outbound requests validated
  [x] No user-provided URLs in requests
  [x] Whitelist internal endpoints
  [x] Webhook URLs validated
```

---

## 11. Frontend Architecture

### 11.1 Next.js 16 App Router Patterns

**Directory structure:**

```
frontend/
├── src/
│   ├── app/
│   │   ├── (auth)/
│   │   │   ├── login/page.tsx
│   │   │   ├── register/page.tsx
│   │   │   └── layout.tsx
│   │   ├── (dashboard)/
│   │   │   ├── portfolios/page.tsx
│   │   │   ├── portfolios/[id]/page.tsx
│   │   │   ├── alm/page.tsx
│   │   │   └── layout.tsx
│   │   ├── api/
│   │   │   ├── auth/route.ts
│   │   │   └── webhooks/stripe/route.ts
│   │   └── layout.tsx
│   ├── components/
│   │   ├── shared/
│   │   ├── alm/
│   │   ├── charts/
│   │   └── forms/
│   ├── hooks/
│   ├── lib/
│   │   ├── api-client.ts
│   │   └── utils.ts
│   └── store/
│       └── auth.ts
```

**Server Components vs Client Components:**

```typescript
// ✅ Good: Server Component (default)
// - No interactivity, fetches data
// - Used for lists, details pages
import { PortfolioService } from '@/lib/portfolio-service';

export default async function PortfolioPage() {
  const portfolio = await PortfolioService.getPortfolio('id');

  return (
    <div>
      <h1>{portfolio.name}</h1>
      <PortfolioChart data={portfolio} />
    </div>
  );
}

// ❌ Bad: Making Server Component interactive without need
export default async function PortfolioPage() {
  const [isLoading, setIsLoading] = useState(false); // ❌ Can't use hooks
}

// ✅ Good: Client Component (interactive features)
'use client';

import { useState } from 'react';
import { usePortfolio } from '@/hooks/usePortfolio';

export default function PortfolioForm() {
  const [isLoading, setIsLoading] = useState(false);
  const { portfolio, updatePortfolio } = usePortfolio();

  return (
    <form onSubmit={handleSubmit}>
      {/* Interactive form */}
    </form>
  );
}

// ✅ Composition: Server Component uses Client Component
export default async function PortfolioPage() {
  const portfolio = await PortfolioService.getPortfolio('id');

  return (
    <div>
      <h1>{portfolio.name}</h1>
      {/* Client component for interactivity */}
      <EditPortfolioForm portfolio={portfolio} />
    </div>
  );
}
```

### 11.2 API Client Architecture

```typescript
// frontend/src/lib/api-client.ts
import axios, { AxiosInstance, AxiosError, InternalAxiosRequestConfig } from 'axios';
import { useAuthStore } from '@/store/auth';

export const apiClient: AxiosInstance = axios.create({
  baseURL: process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3001',
  withCredentials: true,
});

// Request interceptor: Add access token
apiClient.interceptors.request.use(
  (config: InternalAxiosRequestConfig) => {
    const { accessToken } = useAuthStore.getState();

    if (accessToken) {
      config.headers.Authorization = `Bearer ${accessToken}`;
    }

    return config;
  },
  (error) => Promise.reject(error)
);

// Response interceptor: Handle 401 and refresh token
apiClient.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const originalRequest = error.config as InternalAxiosRequestConfig & {
      _retry?: boolean;
    };

    if (error.response?.status === 401 && !originalRequest._retry) {
      originalRequest._retry = true;

      try {
        // Refresh access token
        const response = await axios.post(
          `${process.env.NEXT_PUBLIC_API_URL}/api/v1/auth/refresh`,
          {},
          { withCredentials: true }
        );

        const { accessToken } = response.data;
        useAuthStore.setState({ accessToken });

        // Retry original request
        originalRequest.headers.Authorization = `Bearer ${accessToken}`;
        return apiClient(originalRequest);
      } catch (refreshError) {
        // Refresh failed, redirect to login
        useAuthStore.setState({ user: null, accessToken: null });
        window.location.href = '/login';
        return Promise.reject(refreshError);
      }
    }

    return Promise.reject(error);
  }
);
```

### 11.3 Zustand State Management

```typescript
// frontend/src/store/auth.ts
import { create } from 'zustand';
import { persist } from 'zustand/middleware';

interface User {
  id: string;
  email: string;
  role: 'OWNER' | 'ANALYST' | 'VIEWER';
}

interface AuthStore {
  user: User | null;
  accessToken: string | null;
  activeWorkspace: string | null;
  activeOrganization: string | null;

  setUser: (user: User | null) => void;
  setAccessToken: (token: string | null) => void;
  setActiveWorkspace: (workspaceId: string) => void;
  logout: () => void;
}

export const useAuthStore = create<AuthStore>()(
  persist(
    (set) => ({
      user: null,
      accessToken: null,
      activeWorkspace: null,
      activeOrganization: null,

      setUser: (user) => set({ user }),
      setAccessToken: (token) => set({ accessToken: token }),
      setActiveWorkspace: (workspaceId) => set({ activeWorkspace: workspaceId }),

      logout: () =>
        set({
          user: null,
          accessToken: null,
          activeWorkspace: null,
        }),
    }),
    {
      name: 'auth-store',
      partialize: (state) => ({
        // Only persist certain fields (not tokens in localStorage)
        user: state.user,
        activeWorkspace: state.activeWorkspace,
        activeOrganization: state.activeOrganization,
      }),
    }
  )
);
```

### 11.4 React Query (TanStack Query) Data Fetching

```typescript
// frontend/src/hooks/usePortfolios.ts
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import { apiClient } from '@/lib/api-client';

export const usePortfolios = (workspaceId: string) => {
  return useQuery({
    queryKey: ['portfolios', workspaceId],
    queryFn: async () => {
      const { data } = await apiClient.get('/api/v1/portfolios', {
        params: { workspaceId },
      });
      return data;
    },
    staleTime: 5 * 60 * 1000, // 5 minutes
    gcTime: 10 * 60 * 1000,   // Cache for 10 minutes
  });
};

export const useCreatePortfolio = () => {
  const queryClient = useQueryClient();
  const { activeWorkspace } = useAuthStore();

  return useMutation({
    mutationFn: async (dto: CreatePortfolioDto) => {
      const { data } = await apiClient.post('/api/v1/portfolios', {
        ...dto,
        workspaceId: activeWorkspace,
      });
      return data;
    },

    onSuccess: (newPortfolio) => {
      // Invalidate list queries so they refetch
      queryClient.invalidateQueries({
        queryKey: ['portfolios', activeWorkspace],
      });

      // Optionally update cache with new data
      queryClient.setQueryData(
        ['portfolio', newPortfolio.id],
        newPortfolio
      );
    },

    onError: (error: AxiosError) => {
      // Handle error (show toast, etc.)
      console.error('Create failed:', error.response?.data);
    },
  });
};

// Usage in component:
export function CreatePortfolioButton() {
  const { mutate, isPending } = useCreatePortfolio();

  return (
    <button
      onClick={() => mutate({ name: 'New Portfolio' })}
      disabled={isPending}
    >
      {isPending ? 'Creating...' : 'Create'}
    </button>
  );
}
```

### 11.5 Form Validation with react-hook-form + Zod

```typescript
// frontend/src/schemas/portfolio.schema.ts
import { z } from 'zod';

export const CreatePortfolioSchema = z.object({
  name: z.string().min(3).max(100),
  description: z.string().max(500).optional(),
});

export type CreatePortfolioInput = z.infer<typeof CreatePortfolioSchema>;

// Component:
'use client';

import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { CreatePortfolioSchema } from '@/schemas/portfolio.schema';

export function PortfolioForm() {
  const {
    register,
    handleSubmit,
    formState: { errors, isSubmitting },
  } = useForm({
    resolver: zodResolver(CreatePortfolioSchema),
  });

  const { mutate: create } = useCreatePortfolio();

  return (
    <form onSubmit={handleSubmit((data) => create(data))}>
      <div>
        <input
          placeholder="Portfolio name"
          {...register('name')}
        />
        {errors.name && <span>{errors.name.message}</span>}
      </div>

      <button type="submit" disabled={isSubmitting}>
        Create
      </button>
    </form>
  );
}
```

### 11.6 Internationalization (i18n) - Bilingual ES/EN

```typescript
// frontend/src/lib/i18n.ts
import { getRequestConfig } from 'next-intl/server';

export default getRequestConfig(async ({ locale }) => ({
  messages: (await import(`./messages/${locale}.json`)).default,
}));

// messages/en.json
{
  "nav": {
    "portfolios": "Portfolios",
    "alm": "ALM",
    "settings": "Settings"
  },
  "portfolio": {
    "title": "Portfolio",
    "create": "Create Portfolio",
    "delete": "Delete"
  }
}

// messages/es.json
{
  "nav": {
    "portfolios": "Carteras",
    "alm": "ALM",
    "settings": "Configuración"
  },
  "portfolio": {
    "title": "Cartera",
    "create": "Crear Cartera",
    "delete": "Eliminar"
  }
}

// Component usage:
'use client';

import { useTranslations } from 'next-intl';

export function Navigation() {
  const t = useTranslations('nav');

  return (
    <nav>
      <a href="/portfolios">{t('portfolios')}</a>
      <a href="/alm">{t('alm')}</a>
    </nav>
  );
}
```

### 11.7 Recharts for ALM Visualizations

```typescript
// frontend/src/components/alm/MaturityGapChart.tsx
'use client';

import {
  BarChart,
  Bar,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';

interface MaturityGapData {
  period: string;
  assets: number;
  liabilities: number;
  gap: number;
}

export function MaturityGapChart({ data }: { data: MaturityGapData[] }) {
  return (
    <ResponsiveContainer width="100%" height={400}>
      <BarChart data={data}>
        <CartesianGrid strokeDasharray="3 3" />
        <XAxis dataKey="period" />
        <YAxis />
        <Tooltip
          formatter={(value) => `$${(value / 1000).toFixed(1)}k`}
        />
        <Legend />
        <Bar dataKey="assets" fill="#2196F3" />
        <Bar dataKey="liabilities" fill="#FF9800" />
        <Bar dataKey="gap" fill="#4CAF50" />
      </BarChart>
    </ResponsiveContainer>
  );
}
```

### 11.8 File Upload Flow

```typescript
// frontend/src/components/file-upload.tsx
'use client';

import { useState } from 'react';
import { useDropzone } from 'react-dropzone';
import { apiClient } from '@/lib/api-client';

export function FileUpload({ onSuccess }: { onSuccess: (file: any) => void }) {
  const [uploading, setUploading] = useState(false);
  const [progress, setProgress] = useState(0);

  const { getRootProps, getInputProps } = useDropzone({
    onDrop: async (files) => {
      const file = files[0];

      const formData = new FormData();
      formData.append('file', file);

      setUploading(true);

      try {
        // Upload to backend
        const response = await apiClient.post(
          '/api/v1/files/upload',
          formData,
          {
            onUploadProgress: (e) => {
              const percentage = Math.round((e.loaded * 100) / e.total);
              setProgress(percentage);
            },
          }
        );

        onSuccess(response.data);
      } finally {
        setUploading(false);
        setProgress(0);
      }
    },
  });

  return (
    <div {...getRootProps()}>
      <input {...getInputProps()} />
      {uploading ? (
        <p>Uploading: {progress}%</p>
      ) : (
        <p>Drag files here or click to select</p>
      )}
    </div>
  );
}
```

### 11.9 Error Boundary and Loading States

```typescript
// frontend/src/components/error-boundary.tsx
'use client';

import { ReactNode } from 'react';

interface ErrorBoundaryProps {
  children: ReactNode;
  fallback?: (error: Error) => ReactNode;
}

export class ErrorBoundary extends React.Component<
  ErrorBoundaryProps,
  { hasError: boolean; error: Error | null }
> {
  constructor(props: ErrorBoundaryProps) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error) {
    return { hasError: true, error };
  }

  render() {
    if (this.state.hasError) {
      return (
        this.props.fallback?.(this.state.error!) || (
          <div>
            <h2>Something went wrong</h2>
            <p>{this.state.error?.message}</p>
          </div>
        )
      );
    }

    return this.props.children;
  }
}

// Usage:
export default function Layout() {
  return (
    <ErrorBoundary fallback={(error) => <ErrorPage error={error} />}>
      <Navigation />
      <main>
        <Suspense fallback={<LoadingSpinner />}>
          <Content />
        </Suspense>
      </main>
    </ErrorBoundary>
  );
}
```

### 11.10 Authentication State Management

```typescript
// frontend/src/components/protected-route.tsx
'use client';

import { useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { useAuthStore } from '@/store/auth';

export function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const router = useRouter();
  const { user, isLoading } = useAuthStore();

  useEffect(() => {
    if (!isLoading && !user) {
      router.push('/login');
    }
  }, [user, isLoading, router]);

  if (isLoading || !user) {
    return <LoadingSpinner />;
  }

  return <>{children}</>;
}
```

---

## 12. PDF Generation Engine

### 12.1 PDFKit Implementation Patterns

```typescript
// backend-node/src/pdf/pdf.service.ts
import PDFDocument from 'pdfkit';
import { Readable } from 'stream';

@Injectable()
export class PdfService {
  async generatePortfolioPdf(portfolio: Portfolio): Promise<Buffer> {
    const doc = new PDFDocument({
      margin: 40,
      size: 'LETTER',
    });

    const chunks: Buffer[] = [];

    doc.on('data', (chunk) => chunks.push(chunk));

    // Page 1: Cover
    this.addCover(doc, portfolio);
    doc.addPage();

    // Pages 2-7: English section
    this.addEnglishSection(doc, portfolio);
    doc.addPage();

    // Pages 8-14: Spanish section
    this.addSpanishSection(doc, portfolio);

    doc.end();

    return new Promise((resolve, reject) => {
      doc.on('finish', () => {
        resolve(Buffer.concat(chunks));
      });
      doc.on('error', reject);
    });
  }

  private addCover(doc: PDFDocument, portfolio: Portfolio) {
    doc.fontSize(36).text('CERNIQ', 100, 100);
    doc.fontSize(24).text('Portfolio Report', 100, 150);
    doc.fontSize(14).text(`Portfolio: ${portfolio.name}`, 100, 220);
    doc.text(`Date: ${new Date().toLocaleDateString()}`, 100, 250);
  }

  private addEnglishSection(doc: PDFDocument, portfolio: Portfolio) {
    doc.fontSize(18).text('Portfolio Overview', 50, 50);
    doc.fontSize(12).text(`Total Assets: $${portfolio.totalAssets}`, 50, 100);
    doc.text(`Total Liabilities: $${portfolio.totalLiabilities}`, 50, 130);
    doc.text(`Net Worth: $${portfolio.netWorth}`, 50, 160);
  }

  private addSpanishSection(doc: PDFDocument, portfolio: Portfolio) {
    doc.fontSize(18).text('Resumen de la Cartera', 50, 50);
    doc.fontSize(12).text(`Activos Totales: $${portfolio.totalAssets}`, 50, 100);
    doc.text(`Pasivos Totales: $${portfolio.totalLiabilities}`, 50, 130);
    doc.text(`Patrimonio Neto: $${portfolio.netWorth}`, 50, 160);
  }
}
```

### 12.2 Bilingual PDF Structure

```
Page 1:     Cover (CERNIQ Logo, Title, Date)
Pages 2-3:  Executive Summary (English)
Pages 4-5:  Portfolio Holdings (English)
Pages 6-7:  Risk Metrics (English)
Page 8:     Page Break + Spanish Section Header
Pages 9-10: Executive Summary (Spanish)
Pages 11-12: Portfolio Holdings (Spanish)
Pages 13-14: Risk Metrics (Spanish)
```

### 12.3 Chart Generation for PDF

```typescript
import { createCanvas } from 'canvas';

private addCharts(doc: PDFDocument, portfolio: Portfolio) {
  // Create chart image server-side
  const canvas = createCanvas(600, 400);
  const ctx = canvas.getContext('2d');

  // Draw maturity gap chart
  this.drawMaturityGapChart(ctx, portfolio);

  const chartImage = canvas.toDataURL('image/png');
  doc.image(chartImage, 50, 200, { width: 500 });
}

private drawMaturityGapChart(ctx: CanvasRenderingContext2D, portfolio: Portfolio) {
  // Use canvas drawing API
  ctx.fillStyle = '#2196F3';
  ctx.fillRect(50, 100, 100, 200); // Bar 1
  ctx.fillRect(200, 150, 100, 150); // Bar 2
  ctx.fillRect(350, 80, 100, 220);  // Bar 3

  // Labels
  ctx.fillStyle = '#000';
  ctx.font = '12px Arial';
  ctx.fillText('0-30d', 50, 320);
  ctx.fillText('30-90d', 200, 320);
  ctx.fillText('90d+', 350, 320);
}
```

### 12.4 Cloudflare R2 Upload + Presigned URLs

```typescript
// backend-node/src/storage/r2.service.ts
import { S3Client, PutObjectCommand, GetObjectCommand } from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';

@Injectable()
export class R2Service {
  private s3Client: S3Client;

  constructor() {
    this.s3Client = new S3Client({
      region: 'auto',
      credentials: {
        accessKeyId: process.env.R2_ACCESS_KEY_ID,
        secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
      },
      endpoint: `https://${process.env.R2_ACCOUNT_ID}.r2.cloudflarestorage.com`,
    });
  }

  async uploadPdf(
    portfolioId: string,
    fileName: string,
    pdfBuffer: Buffer
  ): Promise<string> {
    const key = `portfolios/${portfolioId}/${fileName}`;

    await this.s3Client.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: pdfBuffer,
        ContentType: 'application/pdf',
      })
    );

    // Return presigned URL (valid for 24 hours)
    return this.getPresignedUrl(key);
  }

  async getPresignedUrl(key: string): Promise<string> {
    const command = new GetObjectCommand({
      Bucket: process.env.R2_BUCKET_NAME,
      Key: key,
    });

    return getSignedUrl(this.s3Client, command, { expiresIn: 86400 });
  }
}

// Usage:
@Injectable()
export class ReportService {
  constructor(
    private pdf: PdfService,
    private r2: R2Service,
  ) {}

  async generateAndUploadReport(portfolioId: string) {
    const portfolio = await this.getPortfolio(portfolioId);
    const pdfBuffer = await this.pdf.generatePortfolioPdf(portfolio);

    const fileName = `report_${Date.now()}.pdf`;
    const presignedUrl = await this.r2.uploadPdf(
      portfolioId,
      fileName,
      pdfBuffer
    );

    return { presignedUrl, fileName };
  }
}
```

### 12.5 Report Job State Machine (9 Stages)

```
1. QUEUED
   ↓
2. PROCESSING (validating portfolio, collecting data)
   ↓
3. CALCULATING (running ALM, risk metrics)
   ↓
4. GENERATING (creating PDF with charts)
   ↓
5. UPLOADING (storing in R2)
   ↓
6. COMPLETED (presigned URL ready)
   ↓
7. EXPIRED (older than 30 days, removed from R2)

ERROR STATES:
   ✗ FAILED (any step failed)
   ✗ TIMEOUT (took > 5 minutes)
```

```typescript
@Injectable()
export class ReportJobService {
  async createJob(portfolioId: string) {
    return this.prisma.reportJob.create({
      data: {
        portfolioId,
        status: 'QUEUED',
      },
    });
  }

  async processJob(jobId: string) {
    const job = await this.prisma.reportJob.findUnique({
      where: { id: jobId },
    });

    try {
      await this.updateJobStatus(jobId, 'PROCESSING');
      const portfolio = await this.getPortfolio(job.portfolioId);

      await this.updateJobStatus(jobId, 'CALCULATING');
      const almResult = await this.alm.calculate(portfolio);

      await this.updateJobStatus(jobId, 'GENERATING');
      const pdfBuffer = await this.pdf.generatePortfolioPdf(portfolio);

      await this.updateJobStatus(jobId, 'UPLOADING');
      const url = await this.r2.uploadPdf(job.portfolioId, `report.pdf`, pdfBuffer);

      await this.updateJobStatus(jobId, 'COMPLETED', { presignedUrl: url });
    } catch (error) {
      await this.updateJobStatus(jobId, 'FAILED', { error: error.message });
    }
  }

  private async updateJobStatus(
    jobId: string,
    status: string,
    data?: any
  ) {
    return this.prisma.reportJob.update({
      where: { id: jobId },
      data: {
        status,
        ...data,
        updatedAt: new Date(),
      },
    });
  }
}
```

---

## 13. Code Conventions & Patterns

### 13.1 TypeScript Patterns Used Throughout

**Discriminated Unions:**

```typescript
type Asset =
  | { type: 'BOND'; yield: number; maturityDate: Date }
  | { type: 'EQUITY'; dividend: number; volatility: number }
  | { type: 'CASH'; rate: number };

function calculateReturn(asset: Asset): number {
  switch (asset.type) {
    case 'BOND':
      return asset.yield * 100;
    case 'EQUITY':
      return asset.dividend + (asset.volatility * 0.5);
    case 'CASH':
      return asset.rate;
  }
}
```

**Branded Types:**

```typescript
type UserId = string & { readonly __brand: 'UserId' };
type PortfolioId = string & { readonly __brand: 'PortfolioId' };

const createUserId = (id: string): UserId => id as UserId;
const createPortfolioId = (id: string): PortfolioId => id as PortfolioId;

function getPortfolio(id: PortfolioId) {
  // id is guaranteed to be a portfolio ID, not a user ID
}
```

**Mapped Types:**

```typescript
type Readonly<T> = {
  readonly [K in keyof T]: T[K];
};

type Partial<T> = {
  [K in keyof T]?: T[K];
};

type GettersSetters<T> = {
  [K in keyof T as `get${Capitalize<string & K>}`]: () => T[K];
} & {
  [K in keyof T as `set${Capitalize<string & K>}`]: (v: T[K]) => void;
};
```

### 13.2 NestJS Decorators Cheat Sheet

```typescript
// Method decorators
@Get('/:id')                      // GET /api/resource/:id
@Post()                           // POST /api/resource
@Patch('/:id')                    // PATCH /api/resource/:id
@Delete('/:id')                   // DELETE /api/resource/:id
@Put('/:id')                      // PUT /api/resource/:id

// Parameter decorators
@Param('id')                      // Extract from URL parameter
@Query('limit')                   // Extract from query string
@Body()                           // Extract request body
@Headers('authorization')         // Extract HTTP header
@Req()                            // Inject entire request object
@Res()                            // Inject entire response object

// Guard & Interceptor decorators
@UseGuards(AuthGuard)             // Apply guard before handler
@UseInterceptors(CachingInterceptor)  // Apply interceptor
@UseFilters(ExceptionFilter)      // Apply exception filter

// Metadata decorators
@SetMetadata('roles', ['OWNER'])  // Set metadata for guards
@Roles('OWNER', 'ANALYST')        // Custom metadata

// Provider decorators
@Injectable()                     // Mark as injectable service
@Global()                         // Make module global
@Optional()                       // Mark dependency as optional
@Inject('TOKEN')                  // Inject by token/string
```

### 13.3 Prisma Patterns

```typescript
// findFirst vs findUnique
// Use findUnique only for unique constraints
await prisma.user.findUnique({
  where: { email: 'user@example.com' }, // email is @unique
});

// Use findFirst for non-unique fields
await prisma.portfolio.findFirst({
  where: { organizationId: 'org_123' },
});

// Upsert (create or update)
await prisma.user.upsert({
  where: { email: 'user@example.com' },
  update: { lastLogin: new Date() },
  create: { email: 'user@example.com', name: 'User' },
});

// Cursor-based pagination (better for large datasets)
await prisma.portfolio.findMany({
  take: 20,
  skip: 0, // Or use: cursor: { id: 'last_id' }, skip: 1
  cursor: { id: 'cursor_portfolio_id' },
  orderBy: { createdAt: 'desc' },
});

// Transactions
await prisma.$transaction(async (tx) => {
  await tx.user.update({ ... });
  await tx.portfolio.create({ ... });
});

// Raw queries (ONLY with template literals)
await prisma.$queryRaw`
  SELECT * FROM "Portfolio" WHERE "organizationId" = ${orgId}
`;
```

### 13.4 Response DTO Patterns

```typescript
// ALWAYS return typed responses
@Get(':id')
async getPortfolio(@Param('id') id: string): Promise<PortfolioResponseDto> {
  const portfolio = await this.service.getPortfolio(id);
  return new PortfolioResponseDto(portfolio); // Map to DTO
}

// NEVER leak internal IDs unnecessarily
export class PortfolioResponseDto {
  id: string;
  name: string;
  totalAssets: number;
  // Do NOT include: createdById, internalDbId, tempWorkingId

  constructor(portfolio: Portfolio) {
    this.id = portfolio.id;
    this.name = portfolio.name;
    this.totalAssets = portfolio.assets.length;
  }
}

// Transform nested relations
export class PortfolioDetailResponseDto {
  id: string;
  name: string;
  assets: AssetSummaryDto[];

  constructor(portfolio: Portfolio) {
    this.id = portfolio.id;
    this.name = portfolio.name;
    this.assets = portfolio.assets.map(
      a => new AssetSummaryDto(a)
    );
  }
}
```

### 13.5 Import Organization Conventions

```typescript
// 1. NestJS & third-party
import { Injectable, Logger } from '@nestjs/common';
import axios from 'axios';

// 2. Custom services/modules
import { PrismaService } from '../prisma/prisma.service';
import { AuthService } from '../auth/auth.service';

// 3. DTOs & types
import { CreatePortfolioDto } from './dto/create-portfolio.dto';
import { Portfolio } from '@prisma/client';

// 4. Utilities
import { generateId } from '@/lib/utils';
import { logger } from '@/logger';

// Blank line between groups
```

### 13.6 File Naming Conventions

```
Services:          *.service.ts        portfolio.service.ts
Controllers:       *.controller.ts     portfolio.controller.ts
DTOs:              *.dto.ts            create-portfolio.dto.ts
Guards:            *.guard.ts          auth.guard.ts
Interceptors:      *.interceptor.ts    caching.interceptor.ts
Filters:           *.filter.ts         exception.filter.ts
Modules:           *.module.ts         portfolio.module.ts
Specs (tests):     *.spec.ts           portfolio.service.spec.ts
E2E tests:         *.e2e.spec.ts       portfolio.e2e.spec.ts
Decorators:        *.decorator.ts      current-user.decorator.ts
Middleware:        *.middleware.ts     correlation-id.middleware.ts
Pipes:             *.pipe.ts           validation.pipe.ts
Strategies:        *.strategy.ts       jwt.strategy.ts
```

---

## 14. Known Technical Debt & Fix Priority

### 14.1 Critical Fixes (Do ASAP)

**1. Docker Compose Database Name Mismatch**

*Problem:* docker-compose.yml uses `DATABASE_NAME=cerniq_dev`, but migrations expect `cerniq`.

*Impact:* Local development setup fails silently, migrations don't run.

*Fix:*
```yaml
# docker-compose.yml
environment:
  - POSTGRES_DB=cerniq_dev  # ← Change to match migrations
```

*Effort:* 15 minutes

**2. Risk Controller Prefix Inconsistency**

*Problem:* Risk endpoints have conflicting prefixes: `/api/v1/risk` vs `/api/v1/portfolio/:id/risk`.

*Impact:* API documentation confusing, frontend hard to maintain.

*Fix:*
```typescript
// Standardize all risk endpoints under /api/v1/risk
@Controller('api/v1/risk')
export class RiskController {
  @Post('/calculate/:portfolioId')
  async calculate(@Param('portfolioId') id: string) { ... }
}
```

*Effort:* 1 hour

**3. Dual Token Storage**

*Problem:* AccessToken stored in both memory AND localStorage, causing sync issues.

*Impact:* Token refresh fails if browser/tab out of sync.

*Fix:*
```typescript
// Store ONLY in memory + httpOnly cookie
// localStorage: activeWorkspace, user.id only (not tokens)
```

*Effort:* 2 hours

### 14.2 Medium Priority (Next Quarter)

**1. BullMQ Job Queue**

*Current:* PDF jobs process synchronously in request handler.

*Problem:* Long-running jobs timeout (5s limit on serverless).

*Solution:*
```typescript
// Implement BullMQ for background jobs
@InjectQueue('reports')
private reportQueue: Queue;

async generateReport(portfolioId: string) {
  await this.reportQueue.add('generate', { portfolioId });
  return { jobId: job.id, status: 'queued' };
}
```

*Benefit:* Handle 30s+ PDF generation, retry failed jobs, track progress.

*Effort:* 8 hours

**2. Redis Caching for ALM**

*Current:* ALM calculations not cached.

*Problem:* Same calculation runs multiple times, slow performance.

*Solution:* Cache with 10-minute TTL, invalidate on portfolio update.

*Benefit:* 70%+ cache hit ratio, < 50ms response time.

*Effort:* 6 hours

**3. API Versioning**

*Current:* Only `/api/v1/`, no strategy for v2.

*Problem:* Breaking changes require immediate migration.

*Solution:*
```typescript
// Support both versions
@Controller('api/v1/portfolios')
@Controller('api/v2/portfolios') // Enhanced response format
```

*Benefit:* Non-breaking evolution, gradual migration.

*Effort:* 4 hours

### 14.3 Low Priority (Future Optimization)

**1. TimescaleDB for Market Data**

*Current:* PostgreSQL stores historical prices + metrics.

*Problem:* Time-series queries slow on large datasets (> 1M rows).

*Solution:* Migrate historical_prices → TimescaleDB hypertable.

*Benefit:* 10-100x faster time-series queries.

*Effort:* 16 hours, requires migration strategy

**2. Dead Code Cleanup**

*Current:* Legacy email templates, old asset validators.

*Problem:* Code cluttered, maintenance overhead.

*Solution:* Remove unused files, consolidate validators.

*Effort:* 3 hours

**3. Frontend Component Library Storybook**

*Current:* No component documentation.

*Problem:* Developers duplicate components, inconsistent UI.

*Solution:* Set up Storybook, document shared components.

*Benefit:* Faster feature development, consistent UI.

*Effort:* 8 hours

---

## Appendix: Deployment Checklist

Before deploying to production:

- [ ] All tests passing (unit + E2E)
- [ ] TypeScript strict mode compliant
- [ ] ESLint + Prettier passing
- [ ] Database migrations tested locally
- [ ] Env variables set in Railway + Vercel
- [ ] Sentry DSN configured
- [ ] CORS whitelist updated
- [ ] Rate limiting verified
- [ ] Health checks responding
- [ ] API documentation updated
- [ ] Rollback plan documented
- [ ] On-call engineer notified
- [ ] Slack deployment message posted
- [ ] Monitoring dashboards checked
- [ ] Backup created

---

**Last Updated:** March 27, 2026

This Engineering Bible is a living document. Update it when:
- New patterns are established
- Best practices change
- Common mistakes are discovered
- New modules are created
- Major refactors are completed
