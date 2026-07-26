#!/usr/bin/env node
/**
 * Bootstrap .env.production-e2e.local — validate JWT against prod API and resolve institution id.
 *
 * Usage:
 *   node scripts/bootstrap-production-e2e.mjs [--jwt <token>] [--write]
 *   CERNIQ_E2E_JWT=eyJ... node scripts/bootstrap-production-e2e.mjs --write
 *
 * --write  Creates/updates .env.production-e2e.local (never prints full JWT).
 */

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = path.resolve(__dirname, '..');
const ENV_PATH = path.join(REPO_ROOT, '.env.production-e2e.local');
const EXAMPLE_PATH = path.join(REPO_ROOT, '.env.production-e2e.example');

const args = process.argv.slice(2);
const write = args.includes('--write');
const jwtFlag = args.indexOf('--jwt');
const jwtFromArg = jwtFlag >= 0 ? args[jwtFlag + 1] : undefined;
const jwt = (jwtFromArg || process.env.CERNIQ_E2E_JWT || '').trim();

const API_URL = (process.env.CERNIQ_API_URL || 'https://api.cerniq.io').replace(/\/$/, '');
const FRONTEND_URL = (process.env.CERNIQ_FRONTEND_URL || 'https://cerniq.io').replace(/\/$/, '');

function fail(msg) {
  console.error(`bootstrap-production-e2e: ${msg}`);
  process.exit(1);
}

if (!jwt) {
  console.error(`Missing JWT. Options:
  1. node scripts/bootstrap-production-e2e.mjs --jwt '<token>' --write
  2. export CERNIQ_E2E_JWT=... && node scripts/bootstrap-production-e2e.mjs --write

See docs/ops/PRODUCTION_E2E_RUNBOOK.md § JWT bootstrap (login at ${FRONTEND_URL}/login).`);
  process.exit(2);
}

async function verifyJwt() {
  const res = await fetch(`${API_URL}/api/alm/institutions?limit=5`, {
    headers: { Authorization: `Bearer ${jwt}`, Accept: 'application/json' },
  });
  if (res.status === 401 || res.status === 403) {
    fail(`JWT rejected (${res.status}). Re-bootstrap from ${FRONTEND_URL}/login.`);
  }
  if (!res.ok) {
    fail(`GET /api/alm/institutions failed: ${res.status}`);
  }
  const raw = await res.json();
  const data = raw.data ?? raw;
  const items = Array.isArray(data) ? data : (data.items ?? data.data ?? []);
  return items;
}

function pickCooperativa(items) {
  const coop =
    items.find((i) => i.type === 'cooperativa') ||
    items.find((i) => i.seedKey === 'pr-cooperativa-demo') ||
    items.find((i) => (i.name || '').toLowerCase().includes('coop'));
  return coop ? (coop.id ?? coop.institutionId) : null;
}

function loadExistingEnv() {
  if (!fs.existsSync(ENV_PATH)) {
    return fs.readFileSync(EXAMPLE_PATH, 'utf8');
  }
  return fs.readFileSync(ENV_PATH, 'utf8');
}

function upsertEnvLine(content, key, value) {
  const line = `${key}=${value}`;
  const re = new RegExp(`^${key}=.*$`, 'm');
  if (re.test(content)) return content.replace(re, line);
  return `${content.trimEnd()}\n${line}\n`;
}

const items = await verifyJwt();
const institutionId =
  process.env.CERNIQ_E2E_INSTITUTION_ID?.trim() || pickCooperativa(items);

console.log(`JWT valid against ${API_URL} (${items.length} institution(s) visible).`);

if (institutionId) {
  console.log(`Suggested CERNIQ_E2E_INSTITUTION_ID=${institutionId}`);
} else {
  console.warn('No cooperativa institution found — seed pr-cooperativa-demo in QA workspace.');
}

if (!write) {
  console.log('Dry run (no file written). Pass --write to create .env.production-e2e.local');
  process.exit(institutionId ? 0 : 1);
}

let content = loadExistingEnv();
content = upsertEnvLine(content, 'CERNIQ_API_URL', API_URL);
content = upsertEnvLine(content, 'CERNIQ_FRONTEND_URL', FRONTEND_URL);
content = upsertEnvLine(content, 'CERNIQ_E2E_JWT', jwt);
if (institutionId) {
  content = upsertEnvLine(content, 'CERNIQ_E2E_INSTITUTION_ID', institutionId);
}
fs.writeFileSync(ENV_PATH, content, { mode: 0o600 });
console.log(`Wrote ${ENV_PATH} (mode 600). JWT stored — not echoed.`);
