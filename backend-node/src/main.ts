// Sentry must be imported before everything else
import './instrument';
import * as Sentry from '@sentry/nestjs';
import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe, Logger as NestLogger } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
import { Logger } from 'nestjs-pino';

const cookieParser = require('cookie-parser');
const helmet = require('helmet');
const express = require('express');
const compression = require('compression');

import { AppModule } from './app.module';
import { PerformanceInterceptor } from './common/interceptors/performance.interceptor';
import { MaintenanceModeGuard } from './common/guards/maintenance-mode.guard';
import { corsOriginCallback } from './security/origin-allowlist';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';
import { SensitiveFieldRedactorInterceptor } from './common/interceptors/sensitive-field-redactor.interceptor';
import { SanitizePipe } from './common/pipes/sanitize.pipe';

export function validateBootstrapEnv(env: NodeJS.ProcessEnv): string[] {
  const jwtSecret = env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    throw new Error(
      'FATAL: JWT_SECRET must be set and at least 32 characters.',
    );
  }
  if (!env.DATABASE_URL) {
    throw new Error('FATAL: DATABASE_URL must be set.');
  }

  if (env.NODE_ENV !== 'production') {
    return [];
  }

  return [
    !env.ADMIN_KEY
      ? 'WARN: ADMIN_KEY not set — admin endpoints disabled.'
      : null,
    !env.STRIPE_SECRET_KEY
      ? 'WARN: STRIPE_SECRET_KEY not set — billing disabled.'
      : null,
    !env.RESEND_API_KEY
      ? 'WARN: RESEND_API_KEY not set — email delivery disabled.'
      : null,
    !env.DATA_ENCRYPTION_KEY
      ? 'WARN: DATA_ENCRYPTION_KEY not set — PII encryption disabled.'
      : null,
  ].filter((warning): warning is string => warning !== null);
}

export function registerGlobalCrashHandlers(
  processRef: Pick<NodeJS.Process, 'on' | 'exit'> = process,
  sentryRef: Pick<typeof Sentry, 'captureException'> = Sentry,
  errorLogger: (
    message?: any,
    ...optionalParams: any[]
  ) => void = console.error,
  scheduleExit: typeof setTimeout = setTimeout,
) {
  processRef.on('unhandledRejection', (reason: unknown) => {
    errorLogger('[FATAL] Unhandled Promise rejection:', reason);
    sentryRef.captureException(
      reason instanceof Error ? reason : new Error(String(reason)),
    );
    scheduleExit(() => processRef.exit(1), 2000);
  });

  processRef.on('uncaughtException', (error: Error) => {
    errorLogger('[FATAL] Uncaught exception:', error);
    sentryRef.captureException(error);
    scheduleExit(() => processRef.exit(1), 2000);
  });
}

export async function bridgeShutdownToHealth(
  processRef: Pick<NodeJS.Process, 'on'> = process,
  loadControllerModule: () => Promise<{
    AppController: { markShuttingDown: () => void };
  }> = () => import('./app.controller.js'),
  warnLogger: (message?: any, ...optionalParams: any[]) => void = console.warn,
) {
  processRef.on('SIGTERM', () => {
    void loadControllerModule()
      .then((mod) => mod.AppController.markShuttingDown())
      .catch((error) => {
        warnLogger(
          '[WARN] Failed to bridge SIGTERM into AppController shutdown state:',
          error,
        );
      });
  });
}

export async function bootstrap() {
  try {
    validateBootstrapEnv(process.env).forEach((warning) =>
      console.warn(warning),
    );
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    console.error(`${message} Exiting.`);
    process.exit(1);
    return;
  }

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true,
    bufferLogs: true,
  });

  try {
    app.useLogger(app.get(Logger));
  } catch {
    new NestLogger('Bootstrap').warn(
      'Pino logger not available, using default',
    );
  }

  app.set('trust proxy', 1);

  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));
  app.use(compression({ threshold: 1024 }));

  app.use(cookieParser());
  app.use((_req: any, res: any, next: any) => {
    const nonce = require('crypto').randomBytes(16).toString('base64');
    res.locals.cspNonce = nonce;
    next();
  });
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            ((_req: any, res: any) => `'nonce-${res.locals.cspNonce}'`) as any,
            'https://cdn.segment.com',
            'https://*.google-analytics.com',
            'https://*.googletagmanager.com',
            'https://us.i.posthog.com',
          ],
          connectSrc: [
            "'self'",
            'https://api.segment.io',
            'https://*.google-analytics.com',
            'https://*.analytics.google.com',
            'https://us.i.posthog.com',
            'wss:',
          ],
          imgSrc: ["'self'", 'data:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
          fontSrc: ["'self'", 'https://fonts.gstatic.com'],
          frameSrc: ["'none'"],
          objectSrc: ["'none'"],
          baseUri: ["'self'"],
          formAction: ["'self'"],
          upgradeInsecureRequests: [],
        },
      },
    }),
  );

  if (
    process.env.SENTRY_DSN &&
    typeof (Sentry as any).SentryGlobalFilter === 'function'
  ) {
    app.useGlobalFilters(new (Sentry as any).SentryGlobalFilter());
  }
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  app.useGlobalInterceptors(new PerformanceInterceptor());
  app.useGlobalInterceptors(new SensitiveFieldRedactorInterceptor());
  app.useGlobalGuards(new MaintenanceModeGuard());

  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );
  app.useGlobalPipes(new SanitizePipe());

  app.enableCors({
    origin: corsOriginCallback,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: [
      'Content-Type',
      'Authorization',
      'x-admin-key',
      'x-organization-id',
      'x-klytics-org-id',
      'x-idempotency-key',
    ],
    maxAge: 86400,
  });

  app.enableShutdownHooks();
  await bridgeShutdownToHealth();

  const swaggerConfig = new DocumentBuilder()
    .setTitle('CERNIQ API')
    .setDescription(
      'Institutional ALM Intelligence API for credit unions, cooperativas, and community banks.\n\n' +
        '## Authentication\n' +
        'All authenticated endpoints require an API key passed via the `Authorization` header:\n' +
        '```\nAuthorization: Bearer ck_live_...\n```\n\n' +
        '## Rate Limits\n' +
        '- **Standard tier:** 100 requests/hour per API key\n' +
        '- **Partner tier:** 1,000 requests/hour per API key\n\n' +
        '## Response Envelope\n' +
        'All responses are wrapped in: `{ "success": true, "data": ... }`',
    )
    .setVersion('1.0')
    .addBearerAuth(
      { type: 'http', scheme: 'bearer', description: 'API Key (ck_live_...)' },
      'BearerAuth',
    )
    .addTag('ALM Analysis', 'Balance sheet analysis and regulatory compliance')
    .addTag(
      'Authentication',
      'User registration, login, OAuth, and API key management',
    )
    .addTag(
      'Billing',
      'Subscription checkout, Stripe webhooks, and billing portal',
    )
    .addTag(
      'Client Portal',
      'Report jobs, data submission, ALCO packs, and team management',
    )
    .addTag(
      'SpendCheck',
      'Expense management, anomaly detection, and AP intelligence',
    )
    .addTag('Benchmarks', 'Sector benchmarks and comparison data')
    .addTag('Reference Data', 'Supported frameworks and configuration')
    .addTag('System', 'Health checks and diagnostics')
    .build();

  const swaggerDocument = SwaggerModule.createDocument(app, swaggerConfig);
  SwaggerModule.setup('api/v1/docs', app, swaggerDocument, {
    customSiteTitle: 'CERNIQ API Documentation',
    customCss: `.topbar-wrapper img { content: url('data:image/svg+xml;utf8,<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 100 20"><text x="0" y="15" font-size="16" font-family="system-ui" font-weight="bold" fill="%231B3A6B">CERNIQ</text></svg>'); }`,
    swaggerOptions: {
      persistAuthorization: true,
      docExpansion: 'list',
      filter: true,
      showRequestDuration: true,
    },
  });

  const bootLogger = new NestLogger('Bootstrap');
  bootLogger.log('Swagger UI available at /api/v1/docs');

  const port = process.env.PORT || process.env.BACKEND_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  bootLogger.log(
    `CERNIQ backend running on 0.0.0.0:${port} [${process.env.NODE_ENV || 'development'}]`,
  );
}

if (require.main === module) {
  registerGlobalCrashHandlers();
  void bootstrap();
}
