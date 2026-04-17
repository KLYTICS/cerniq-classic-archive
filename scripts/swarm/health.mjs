#!/usr/bin/env node
// scripts/swarm/health.mjs
// Fleet health checker for the T-05 monitoring swarm.
// Checks all critical service endpoints and writes snapshots to .omx/state/health/.
//
// Usage:
//   npm run swarm:health                    # run all checks
//   npm run swarm:health -- --json          # output as JSON
//   npm run swarm:health -- --watch 60      # repeat every 60s (use with /loop)

import { c, HEALTH_DIR, ALERTS_DIR, writeAtomic, nowIso, dateStamp, ensureDir } from './_lib.mjs';
import { execSync } from 'node:child_process';
import { join } from 'node:path';

const args = process.argv.slice(2);
const jsonMode = args.includes('--json');

const CHECKS = [
  {
    service: 'api-backend',
    url: 'https://api.cerniq.io/health',
    critical: true,
    timeout_ms: 5000,
  },
  {
    service: 'frontend',
    url: 'https://cerniq.io',
    critical: true,
    timeout_ms: 5000,
  },
  {
    service: 'frontend-login',
    url: 'https://cerniq.io/login',
    critical: false,
    timeout_ms: 5000,
  },
  {
    service: 'frontend-demo',
    url: 'https://cerniq.io/demo?type=cooperativa',
    critical: true,
    timeout_ms: 5000,
  },
  {
    service: 'frontend-pricing',
    url: 'https://cerniq.io/pricing',
    critical: false,
    timeout_ms: 5000,
  },
];

const THRESHOLDS = {
  yellow_ms: 2000,
  red_ms: 5000,
  error_rate_yellow: 0.01,
  error_rate_red: 0.05,
};

function checkEndpoint(check) {
  const start = Date.now();
  try {
    const output = execSync(
      `curl -sS -o /dev/null -w '%{http_code}' --max-time ${Math.ceil(check.timeout_ms / 1000)} '${check.url}'`,
      { encoding: 'utf8', timeout: check.timeout_ms + 2000 }
    ).trim();
    const latency_ms = Date.now() - start;
    const http_code = parseInt(output, 10);
    const ok = http_code >= 200 && http_code < 400;

    let status = 'GREEN';
    if (!ok) status = 'RED';
    else if (latency_ms > THRESHOLDS.red_ms) status = 'RED';
    else if (latency_ms > THRESHOLDS.yellow_ms) status = 'YELLOW';

    return {
      service: check.service,
      url: check.url,
      critical: check.critical,
      http_code,
      latency_ms,
      status,
      error: null,
    };
  } catch (e) {
    return {
      service: check.service,
      url: check.url,
      critical: check.critical,
      http_code: 0,
      latency_ms: Date.now() - start,
      status: 'RED',
      error: e.message?.split('\n')[0] || 'unknown error',
    };
  }
}

function runAllChecks() {
  const timestamp = nowIso();
  const results = CHECKS.map(checkEndpoint);

  const snapshot = {
    timestamp,
    results,
    summary: {
      total: results.length,
      green: results.filter((r) => r.status === 'GREEN').length,
      yellow: results.filter((r) => r.status === 'YELLOW').length,
      red: results.filter((r) => r.status === 'RED').length,
      critical_down: results.filter((r) => r.status === 'RED' && r.critical).length,
    },
  };

  const snapshotPath = join(HEALTH_DIR, `${dateStamp()}.json`);
  writeAtomic(snapshotPath, snapshot);

  return { snapshot, snapshotPath };
}

function autoEscalate(snapshot) {
  const { summary, results } = snapshot;
  if (summary.critical_down === 0 && summary.red === 0) return;

  ensureDir(ALERTS_DIR);
  const criticalResults = results.filter((r) => r.status === 'RED');
  for (const r of criticalResults) {
    const alertId = `HEALTH-${dateStamp()}-${r.service}`;
    const alert = {
      id: alertId,
      type: r.critical ? 'critical_down' : 'degraded',
      severity: r.critical ? 'P0' : 'P1',
      source: 'swarm:health',
      service: r.service,
      url: r.url,
      http_code: r.http_code,
      latency_ms: r.latency_ms,
      error: r.error,
      timestamp: snapshot.timestamp,
      status: 'open',
      acknowledged: false,
    };
    writeAtomic(join(ALERTS_DIR, `${alertId}.json`), alert);
  }

  if (summary.critical_down > 0) {
    const msg = criticalResults
      .filter((r) => r.critical)
      .map((r) => `${r.service} (${r.error || `HTTP ${r.http_code}`})`)
      .join(', ');
    console.error(
      c('red', `\n  ⚠ AUTO-ESCALATED: ${summary.critical_down} critical service(s) → .omx/state/alerts/`)
    );
    console.error(c('grey', `    ${msg}`));
    console.error(c('yellow', '    Run: npm run swarm:escalate -- MON-01 "auto: critical health failure" --systems backend\n'));
  }
}

const { snapshot, snapshotPath } = runAllChecks();
autoEscalate(snapshot);

if (jsonMode) {
  console.log(JSON.stringify(snapshot, null, 2));
  process.exit(snapshot.summary.critical_down > 0 ? 1 : 0);
}

const statusGlyph = (s) => {
  switch (s) {
    case 'GREEN':  return c('green', '●');
    case 'YELLOW': return c('yellow', '●');
    case 'RED':    return c('red', '●');
    default:       return c('grey', '?');
  }
};

console.log(c('bold', '\n  CERNIQ · Fleet Health Check'));
console.log(c('grey', `  ${snapshot.timestamp}`));
console.log(c('grey', '  ' + '─'.repeat(55)));

for (const r of snapshot.results) {
  const crit = r.critical ? c('red', '!') : ' ';
  const latency = r.latency_ms > 0 ? `${r.latency_ms}ms` : '—';
  const err = r.error ? c('grey', ` (${r.error.slice(0, 40)})`) : '';
  console.log(
    `  ${statusGlyph(r.status)} ${crit} ${r.service.padEnd(20)} ` +
    `${c('grey', String(r.http_code).padStart(3))}  ${latency.padStart(6)}${err}`
  );
}

console.log(c('grey', '  ' + '─'.repeat(55)));
const { summary } = snapshot;
console.log(
  `  ${c('green', `${summary.green} green`)}  ` +
  `${summary.yellow > 0 ? c('yellow', `${summary.yellow} yellow`) : c('grey', '0 yellow')}  ` +
  `${summary.red > 0 ? c('red', `${summary.red} red`) : c('grey', '0 red')}`
);

if (summary.critical_down > 0) {
  console.log(c('red', `\n  ⚠ ${summary.critical_down} CRITICAL service(s) DOWN — escalate to T-10\n`));
} else {
  console.log(c('green', '\n  ✓ All critical services healthy\n'));
}

console.log(c('grey', `  snapshot: ${snapshotPath}\n`));

process.exit(summary.critical_down > 0 ? 1 : 0);
