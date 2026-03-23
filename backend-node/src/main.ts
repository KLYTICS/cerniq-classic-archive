import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
import { SwaggerModule, DocumentBuilder } from '@nestjs/swagger';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmet = require('helmet');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const express = require('express');
import { AppModule } from './app.module';
import { corsOriginCallback } from './security/origin-allowlist';
import { GlobalExceptionFilter } from './common/filters/http-exception.filter';
import { ResponseEnvelopeInterceptor } from './common/interceptors/response-envelope.interceptor';

async function bootstrap() {
  // --- Env var validation ---
  const jwtSecret = process.env.JWT_SECRET;
  if (!jwtSecret || jwtSecret.length < 32) {
    console.error(
      'FATAL: JWT_SECRET must be set and at least 32 characters. Exiting.',
    );
    process.exit(1);
  }
  if (!process.env.DATABASE_URL) {
    console.error('FATAL: DATABASE_URL must be set. Exiting.');
    process.exit(1);
  }
  // Warn on missing but non-fatal integrations
  const isProd = process.env.NODE_ENV === 'production';
  if (isProd && !process.env.ADMIN_KEY) console.warn('WARN: ADMIN_KEY not set — admin endpoints disabled.');
  if (isProd && !process.env.STRIPE_SECRET_KEY) console.warn('WARN: STRIPE_SECRET_KEY not set — billing disabled.');
  if (isProd && !process.env.RESEND_API_KEY) console.warn('WARN: RESEND_API_KEY not set — email delivery disabled.');
  if (isProd && !process.env.DATA_ENCRYPTION_KEY) console.warn('WARN: DATA_ENCRYPTION_KEY not set — PII encryption disabled.');

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });

  // Trust Railway/Vercel proxy for correct client IP in rate limiting
  app.set('trust proxy', 1);

  // --- Request body size limits ---
  app.use(express.json({ limit: '10mb' }));
  app.use(express.urlencoded({ extended: true, limit: '10mb' }));

  // --- Security middleware ---
  app.use(cookieParser());
  app.use(
    helmet({
      contentSecurityPolicy: {
        directives: {
          defaultSrc: ["'self'"],
          scriptSrc: [
            "'self'",
            "'unsafe-inline'",
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
          ],
          imgSrc: ["'self'", 'data:', 'https:'],
          styleSrc: ["'self'", "'unsafe-inline'"],
        },
      },
    }),
  );

  // --- Global exception filter & response envelope ---
  app.useGlobalFilters(new GlobalExceptionFilter());
  app.useGlobalInterceptors(new ResponseEnvelopeInterceptor());

  // --- Global validation pipe ---
  app.useGlobalPipes(
    new ValidationPipe({
      whitelist: true,
      forbidNonWhitelisted: true,
      transform: true,
    }),
  );

  // --- CORS ---
  app.enableCors({
    origin: corsOriginCallback,
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
    allowedHeaders: ['Content-Type', 'Authorization', 'x-admin-key', 'x-organization-id'],
    maxAge: 86400,
  });

  // --- Graceful shutdown (drain connections on SIGTERM) ---
  app.enableShutdownHooks();

  // --- Swagger / OpenAPI ---
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
  console.log('Swagger UI available at /api/v1/docs');

  // --- Start server ---
  const port = process.env.PORT || process.env.BACKEND_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`CERNIQ backend running on 0.0.0.0:${port} [${process.env.NODE_ENV || 'development'}]`);
}
bootstrap();
