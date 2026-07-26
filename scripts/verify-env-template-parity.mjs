#!/usr/bin/env node
/**
 * verify-env-template-parity.mjs
 *
 * Ensures auth-cutover and critical production env vars documented in
 * `.env.production.template` and `docs/ops/railway_env_vars.md` stay aligned
 * with backend-node/src/config/env.schema.ts expectations.
 *
 * Usage:
 *   node scripts/verify-env-template-parity.mjs
 *   node scripts/verify-env-template-parity.mjs --self-test
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '..');

/** Vars that must appear in BOTH template + railway doc (cutover-critical). */
const PARITY_KEYS = [
  'DATABASE_URL',
  'JWT_SECRET',
  'DATA_ENCRYPTION_KEY',
  'FRONTEND_URL',
  'ALLOWED_ORIGINS',
  'SUPABASE_URL',
  'SUPABASE_ANON_KEY',
  'SUPABASE_SERVICE_ROLE_KEY',
  'SUPABASE_JWKS_URL',
  'SUPABASE_JWT_ISSUER',
  'SUPABASE_JWT_AUDIENCE',
  'AUTH_ALLOW_LEGACY',
  'KLYTICS_APP_ID',
  'KLYTICS_REQUIRE_ORG',
  'KLYTICS_REQUIRE_ENTITLEMENT',
  'ANTHROPIC_API_KEY',
  'STRIPE_SECRET_KEY',
  'RESEND_API_KEY',
  'REDIS_URL',
];

/** Frontend-only vars documented in template (not Railway). */
const FRONTEND_ONLY = [
  'NEXT_PUBLIC_SUPABASE_URL',
  'NEXT_PUBLIC_SUPABASE_ANON_KEY',
];

function read(rel) {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function assertContains(label, text, keys) {
  const missing = keys.filter((k) => !text.includes(k));
  if (missing.length) {
    console.error(`✘ ${label} missing: ${missing.join(', ')}`);
    return missing.length;
  }
  console.log(`✔ ${label} (${keys.length} keys)`);
  return 0;
}

function runLive() {
  let fail = 0;
  const template = read('.env.production.template');
  const railwayDoc = read('docs/ops/railway_env_vars.md');

  fail += assertContains('.env.production.template', template, PARITY_KEYS);
  fail += assertContains(
    '.env.production.template (frontend)',
    template,
    FRONTEND_ONLY,
  );
  fail += assertContains('docs/ops/railway_env_vars.md', railwayDoc, PARITY_KEYS);

  if (fail) {
    console.error(`\n✘ env template parity: ${fail} check(s) failed`);
    process.exit(1);
  }
  console.log('\n✔ env template parity OK');
}

function runSelfTest() {
  const good = PARITY_KEYS.join('\n') + FRONTEND_ONLY.join('\n');
  const bad = PARITY_KEYS.filter((k) => k !== 'SUPABASE_JWKS_URL').join('\n');
  if (assertContains('self-test-good', good, PARITY_KEYS) !== 0) {
    process.exit(1);
  }
  if (assertContains('self-test-bad', bad, PARITY_KEYS) === 0) {
    console.error('✘ self-test: expected failure on missing JWKS key');
    process.exit(1);
  }
  console.log('✔ verify-env-template-parity self-test OK');
}

if (process.argv.includes('--self-test')) {
  runSelfTest();
} else {
  runLive();
}
