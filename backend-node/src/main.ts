import { NestFactory } from '@nestjs/core';
import { ValidationPipe } from '@nestjs/common';
// eslint-disable-next-line @typescript-eslint/no-require-imports
const cookieParser = require('cookie-parser');
// eslint-disable-next-line @typescript-eslint/no-require-imports
const helmet = require('helmet');
import { AppModule } from './app.module';

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

  const app = await NestFactory.create(AppModule);

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
  const configuredOrigins = (
    process.env.ALLOWED_ORIGINS ||
    process.env.CORS_ORIGIN ||
    ''
  )
    .split(',')
    .map((origin) => origin.trim())
    .filter(Boolean);

  const staticAllowedOrigins = new Set([
    'http://localhost:3000',
    'http://localhost:3001',
    ...configuredOrigins,
  ]);

  app.enableCors({
    origin: (origin, callback) => {
      if (!origin) {
        callback(null, true);
        return;
      }
      if (staticAllowedOrigins.has(origin)) {
        callback(null, true);
        return;
      }
      if (/^https:\/\/[a-zA-Z0-9-]+\.vercel\.app$/.test(origin)) {
        callback(null, true);
        return;
      }
      if (/^https:\/\/[a-zA-Z0-9-]+\.fly\.dev$/.test(origin)) {
        callback(null, true);
        return;
      }
      callback(new Error(`CORS origin not allowed: ${origin}`), false);
    },
    methods: 'GET,HEAD,PUT,PATCH,POST,DELETE,OPTIONS',
    credentials: true,
  });

  await app.listen(process.env.PORT ?? 3000);
}
bootstrap();
