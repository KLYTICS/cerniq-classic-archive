#!/usr/bin/env node
/**
 * List tenant institutions for production E2E — maps cooperativas to institution IDs.
 *
 * Usage:
 *   source .env.production-e2e.local
 *   node scripts/e2e-list-institutions.mjs [--json] [--type cooperativa]
 *
 * Fixture seed keys (seed into QA workspace only):
 *   pr-cooperativa-demo     → CoopAhorro San Juan ($250M, COSSEC)
 *   pr-credit-union-demo    → PR credit union demo
 *   pr-bank-demo            → PR bank demo
 *   pr-family-office-demo   → PR family office demo
 */

const API_URL = (process.env.CERNIQ_API_URL || 'https://api.cerniq.io').replace(/\/$/, '');
const JWT = process.env.CERNIQ_E2E_JWT;
const workspaceId = process.env.CERNIQ_E2E_WORKSPACE_ID;
const typeFilter = process.argv.includes('--type')
  ? process.argv[process.argv.indexOf('--type') + 1]
  : null;
const jsonOut = process.argv.includes('--json');

const FIXTURE_MAP = [
  {
    seedKey: 'pr-cooperativa-demo',
    demoName: 'CoopAhorro San Juan',
    type: 'cooperativa',
    regulator: 'COSSEC',
    assetsM: 250,
  },
  {
    seedKey: 'pr-credit-union-demo',
    demoName: 'PR Credit Union Demo',
    type: 'credit_union',
    regulator: 'NCUA',
    assetsM: null,
  },
  {
    seedKey: 'pr-bank-demo',
    demoName: 'PR Bank Demo',
    type: 'bank',
    regulator: 'OCC/FDIC',
    assetsM: null,
  },
  {
    seedKey: 'pr-family-office-demo',
    demoName: 'PR Family Office Demo',
    type: 'family_office',
    regulator: null,
    assetsM: null,
  },
];

if (!JWT) {
  console.error('CERNIQ_E2E_JWT required (source .env.production-e2e.local)');
  process.exit(2);
}

const params = new URLSearchParams({ limit: '100' });
if (workspaceId) params.set('workspaceId', workspaceId);

const res = await fetch(`${API_URL}/api/alm/institutions?${params}`, {
  headers: {
    Authorization: `Bearer ${JWT}`,
    Accept: 'application/json',
  },
});

if (!res.ok) {
  console.error(`GET /api/alm/institutions failed: ${res.status}`);
  process.exit(1);
}

const raw = await res.json();
const data = raw.data ?? raw;
const items = Array.isArray(data) ? data : (data.items ?? data.data ?? []);

let filtered = items;
if (typeFilter) {
  filtered = items.filter((i) => i.type === typeFilter);
}

const rows = filtered.map((inst) => {
  const match = FIXTURE_MAP.find(
    (f) =>
      inst.seedKey === f.seedKey ||
      (inst.name && inst.name.toLowerCase().includes(f.demoName.toLowerCase().split(' ')[0])),
  );
  return {
    institutionId: inst.id ?? inst.institutionId,
    name: inst.name,
    type: inst.type,
    seedKey: inst.seedKey ?? match?.seedKey ?? '(client / unknown)',
    fixtureHint: match?.seedKey ?? null,
    regulator: inst.primaryRegulator ?? match?.regulator ?? null,
  };
});

if (jsonOut) {
  console.log(JSON.stringify({ apiUrl: API_URL, count: rows.length, institutions: rows, fixtures: FIXTURE_MAP }, null, 2));
} else {
  console.log(`\nCerniQ institutions (${API_URL}) — ${rows.length} row(s)\n`);
  console.log('institutionId'.padEnd(28), 'type'.padEnd(14), 'seedKey / name');
  console.log('-'.repeat(80));
  for (const r of rows) {
    console.log(String(r.institutionId).padEnd(28), String(r.type ?? '').padEnd(14), `${r.seedKey} — ${r.name}`);
  }
  console.log('\nFixture catalog (seed via pnpm seed:institution -- --workspace=QA --fixture=<seedKey>):');
  for (const f of FIXTURE_MAP) {
    console.log(`  ${f.seedKey.padEnd(26)} ${f.demoName} (${f.type})`);
  }
  if (rows.length === 0) {
    console.log('\nNo institutions — seed pr-cooperativa-demo in QA workspace first.');
    process.exit(1);
  }
}
