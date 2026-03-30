// OpenTelemetry must initialize before other imports
import './telemetry';
import * as Sentry from '@sentry/nestjs';

function resolveProfilingSetup() {
  try {
    const { nodeProfilingIntegration } = require('@sentry/profiling-node') as {
      nodeProfilingIntegration: () => unknown;
    };

    return {
      integrations: [nodeProfilingIntegration()] as any[],
      profilesSampleRate: process.env.NODE_ENV === 'production' ? 0.1 : 1.0,
    };
  } catch (error) {
    console.warn(
      '[WARN] Sentry profiling disabled because native bindings are unavailable:',
      error,
    );

    return {
      integrations: [],
      profilesSampleRate: 0,
    };
  }
}

if (process.env.SENTRY_DSN) {
  const profiling = resolveProfilingSetup();

  Sentry.init({
    dsn: process.env.SENTRY_DSN,
    environment: process.env.NODE_ENV || 'development',
    release: process.env.RAILWAY_GIT_COMMIT_SHA || undefined,
    integrations: profiling.integrations,
    tracesSampleRate: process.env.NODE_ENV === 'production' ? 0.2 : 1.0,
    profilesSampleRate: profiling.profilesSampleRate,
    beforeSend(event) {
      // Scrub sensitive data from error reports
      if (event.request?.headers) {
        delete event.request.headers['authorization'];
        delete event.request.headers['cookie'];
        delete event.request.headers['x-admin-key'];
      }
      return event;
    },
  });
}
