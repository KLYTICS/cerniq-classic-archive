#!/usr/bin/env node
// scripts/swarm/doctor.mjs
// Validates the entire swarm infrastructure is correctly wired.
// Run after any structural change to confirm nothing's broken.
//
// Usage:
//   npm run swarm:doctor
//   npm run swarm:doctor -- --json

import { loadRegistry, c, REPO_ROOT, OMX_STATE, MISSIONS_DIR, HEALTH_DIR, EMERGENCIES_DIR, ALERTS_DIR } from './_lib.mjs';
import { existsSync, readFileSync, readdirSync } from 'node:fs';
import { join } from 'node:path';
import { execSync } from 'node:child_process';

const jsonMode = process.argv.includes('--json');
const results = [];

function check(name, fn) {
  try {
    const result = fn();
    if (result === true || result === 'pass') {
      results.push({ name, status: 'pass' });
      if (!jsonMode) console.log(`  ${c('green', '✓')} ${name}`);
    } else {
      results.push({ name, status: 'fail', detail: String(result) });
      if (!jsonMode) console.log(`  ${c('red', '✗')} ${name} — ${c('grey', String(result))}`);
    }
  } catch (e) {
    results.push({ name, status: 'fail', detail: e.message });
    if (!jsonMode) console.log(`  ${c('red', '✗')} ${name} — ${c('grey', e.message.split('\n')[0])}`);
  }
}

if (!jsonMode) {
  console.log(c('bold', '\n  CERNIQ · Swarm Doctor'));
  console.log(c('grey', '  ' + '─'.repeat(55)));
}

// ── Registry integrity ──────────────────────────────────────────────────

check('registry.json exists and parses', () => {
  const reg = loadRegistry();
  if (!reg.swarms || !reg.clis || !reg.terminals) return 'missing swarms/clis/terminals';
  return true;
});

check('all CLI swarm refs resolve', () => {
  const reg = loadRegistry();
  const bad = reg.clis.filter((cli) => !reg.swarms[cli.swarm]);
  return bad.length === 0 ? true : `${bad.length} orphaned: ${bad.map((c) => c.id).join(', ')}`;
});

check('all swarm terminal refs resolve', () => {
  const reg = loadRegistry();
  const bad = Object.entries(reg.swarms).filter(([, s]) => !reg.terminals[s.terminal]);
  return bad.length === 0 ? true : `${bad.length} bad refs: ${bad.map(([k]) => k).join(', ')}`;
});

check('no duplicate CLI IDs', () => {
  const reg = loadRegistry();
  const ids = reg.clis.map((c) => c.id);
  const dupes = ids.filter((id, i) => ids.indexOf(id) !== i);
  return dupes.length === 0 ? true : `duplicates: ${[...new Set(dupes)].join(', ')}`;
});

// ── Script files exist ──────────────────────────────────────────────────

const expectedScripts = [
  'boot.mjs', 'dispatch.mjs', 'gate.mjs', 'health.mjs',
  'escalate.mjs', 'fleet.mjs', 'metrics.mjs', '_lib.mjs',
  'approval.mjs', 'audit.mjs', 'scope-check.mjs',
  'handoff.mjs', 'landing.mjs', 'cross.mjs',
];

check('all swarm scripts present', () => {
  const dir = join(REPO_ROOT, 'scripts', 'swarm');
  const missing = expectedScripts.filter((s) => !existsSync(join(dir, s)));
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`;
});

const expectedSessionScripts = [
  'register.mjs', 'claim.mjs', 'release.mjs',
  'handoff.mjs', 'list.mjs', 'status.mjs', '_lib.mjs',
];

check('all session scripts present', () => {
  const dir = join(REPO_ROOT, 'scripts', 'session');
  const missing = expectedSessionScripts.filter((s) => !existsSync(join(dir, s)));
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`;
});

// ── OMX state directories ───────────────────────────────────────────────

const expectedDirs = [
  'missions', 'health', 'alerts', 'emergencies', 'approvals', 'audit',
  'team', 'team/sessions',
];

check('.omx/state/ directories exist', () => {
  const missing = expectedDirs.filter((d) => !existsSync(join(OMX_STATE, d)));
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`;
});

// ── .gitignore coverage ─────────────────────────────────────────────────

check('.gitignore covers .env files', () => {
  const envFiles = ['.env', 'backend-node/.env', 'frontend/.env.local', 'services/outbound/.env'];
  const exposed = envFiles.filter((f) => {
    try {
      execSync(`git check-ignore -q "${f}"`, { cwd: REPO_ROOT, stdio: 'pipe' });
      return false;
    } catch {
      return true;
    }
  });
  return exposed.length === 0 ? true : `NOT ignored: ${exposed.join(', ')}`;
});

check('.gitignore covers .omx/state JSON', () => {
  try {
    execSync('git check-ignore -q ".omx/state/health/test.json"', { cwd: REPO_ROOT, stdio: 'pipe' });
    return true;
  } catch {
    return '.omx/state/*.json not ignored';
  }
});

// ── Pre-commit hooks ────────────────────────────────────────────────────

check('husky pre-commit hook exists', () => {
  return existsSync(join(REPO_ROOT, '.husky', 'pre-commit')) ? true : '.husky/pre-commit missing';
});

check('pre-commit includes secret scan', () => {
  const hook = readFileSync(join(REPO_ROOT, '.husky', 'pre-commit'), 'utf8');
  return hook.includes('SECRET') || hook.includes('secret') ? true : 'no secret scan in pre-commit';
});

check('pre-commit includes claim conflict check', () => {
  const hook = readFileSync(join(REPO_ROOT, '.husky', 'pre-commit'), 'utf8');
  return hook.includes('claim-conflicts') || hook.includes('check-claim') ? true : 'no claim check in pre-commit';
});

// ── CI pipeline ─────────────────────────────────────────────────────────

check('CI has secrets-scan job', () => {
  const ci = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'ci-cd.yml'), 'utf8');
  return ci.includes('gitleaks') || ci.includes('secrets-scan') ? true : 'no secrets scanning in CI';
});

check('CI release-gate requires secrets-scan', () => {
  const ci = readFileSync(join(REPO_ROOT, '.github', 'workflows', 'ci-cd.yml'), 'utf8');
  return ci.includes('secrets-scan') && ci.includes('release-gate') ? true : 'secrets-scan not in release gate';
});

// ── Vol.3 terminal registry ─────────────────────────────────────────────

check('.cerniq/terminals.json exists', () => {
  return existsSync(join(REPO_ROOT, '.cerniq', 'terminals.json')) ? true : 'missing';
});

check('.cerniq/CONTRACTS.md exists', () => {
  return existsSync(join(REPO_ROOT, '.cerniq', 'CONTRACTS.md')) ? true : 'missing';
});

// ── Security hardening ──────────────────────────────────────────────────

check('CORS rejects no-Origin on mutating requests', () => {
  const src = readFileSync(join(REPO_ROOT, 'backend-node', 'src', 'security', 'origin-allowlist.ts'), 'utf8');
  return src.includes('isMutating') ? true : 'no mutating-request check in isAllowedOrigin';
});

check('API key uses HMAC (not plain SHA-256)', () => {
  const src = readFileSync(join(REPO_ROOT, 'backend-node', 'src', 'auth', 'api-key.util.ts'), 'utf8');
  return src.includes('createHmac') ? true : 'still using createHash — upgrade to HMAC';
});

check('Auth guard validates token size/format', () => {
  const src = readFileSync(join(REPO_ROOT, 'backend-node', 'src', 'auth', 'auth.guard.ts'), 'utf8');
  return src.includes('MAX_TOKEN_BYTES') ? true : 'no token size validation';
});

check('Docker prod: no host-exposed DB/Redis ports', () => {
  const dc = readFileSync(join(REPO_ROOT, 'docker-compose.prod.yml'), 'utf8');
  const hasPgPort = /postgres[\s\S]*?ports:\s*\n\s*-\s*"\d+:5432"/.test(dc);
  const hasRedisPort = /redis[\s\S]*?ports:\s*\n\s*-\s*"\d+:6379"/.test(dc);
  if (hasPgPort) return 'postgres still exposes host port';
  if (hasRedisPort) return 'redis still exposes host port';
  return true;
});

// ── Package.json scripts wired ──────────────────────────────────────────

check('npm scripts: all swarm commands wired', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const required = ['swarm:boot', 'swarm:dispatch', 'swarm:gate', 'swarm:health', 'swarm:escalate', 'swarm:fleet', 'swarm:metrics'];
  const missing = required.filter((s) => !pkg.scripts[s]);
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`;
});

check('npm scripts: all session commands wired', () => {
  const pkg = JSON.parse(readFileSync(join(REPO_ROOT, 'package.json'), 'utf8'));
  const required = ['session:register', 'session:claim', 'session:release', 'session:list', 'session:status', 'session:handoff'];
  const missing = required.filter((s) => !pkg.scripts[s]);
  return missing.length === 0 ? true : `missing: ${missing.join(', ')}`;
});

// ── Summary ─────────────────────────────────────────────────────────────

const passed = results.filter((r) => r.status === 'pass').length;
const failed = results.filter((r) => r.status === 'fail').length;

if (jsonMode) {
  console.log(JSON.stringify({ passed, failed, total: results.length, results }, null, 2));
} else {
  console.log(c('grey', '\n  ' + '─'.repeat(55)));
  console.log(
    `  ${c('green', `${passed} passed`)}  ` +
    `${failed > 0 ? c('red', `${failed} failed`) : c('green', '0 failed')}  ` +
    `(${results.length} checks)`
  );
  if (failed === 0) {
    console.log(c('green', '\n  ✓ Swarm infrastructure healthy\n'));
  } else {
    console.log(c('red', `\n  ✗ ${failed} issue(s) need attention\n`));
  }
}

process.exit(failed > 0 ? 1 : 0);
