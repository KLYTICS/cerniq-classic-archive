import { NestFactory } from '@nestjs/core';
import { NestExpressApplication } from '@nestjs/platform-express';
import { ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmet = require('helmet');
import { AppModule } from './app.module';
import { corsOriginCallback } from './security/origin-allowlist';

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

  const app = await NestFactory.create<NestExpressApplication>(AppModule, {
    rawBody: true, // Required for Stripe webhook signature verification
  });

  // Trust Railway/Vercel proxy for correct client IP in rate limiting
  app.set('trust proxy', 1);

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

  // --- Start server ---
  const port = process.env.PORT || process.env.BACKEND_PORT || 3000;
  await app.listen(port, '0.0.0.0');
  console.log(`CERNIQ backend running on 0.0.0.0:${port}`);
}
bootstrap();
