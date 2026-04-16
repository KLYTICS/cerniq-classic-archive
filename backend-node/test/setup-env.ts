/**
 * E2E test environment setup.
 * Must run BEFORE any application modules are imported.
 */
process.env.JWT_SECRET =
  process.env.JWT_SECRET || 'test-secret-must-be-at-least-32-characters-long';
process.env.ADMIN_KEY = process.env.ADMIN_KEY || 'test-admin-key-e2e';
process.env.NODE_ENV = 'test';
// Suppress Sentry in tests
process.env.API_KEY_PEPPER =
  process.env.API_KEY_PEPPER ||
  'test-pepper-must-be-at-least-32-chars-long!!';
process.env.SENTRY_DSN = '';
// Suppress OpenTelemetry noise
process.env.OTEL_SDK_DISABLED = 'true';
