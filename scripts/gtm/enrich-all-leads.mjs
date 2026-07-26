#!/usr/bin/env node
/**
 * CERNIQ GTM — enrich all cooperativa leads and build field-sales playbook.
 *
 * Usage:
 *   ADMIN_KEY=... API_BASE=https://api.cerniq.io node scripts/gtm/enrich-all-leads.mjs
 *   ADMIN_KEY=... API_BASE=http://localhost:3001 node scripts/gtm/enrich-all-leads.mjs --linkedin ./connections.csv
 *
 * Artifacts land in data/gtm-runs/<run-id>/ (override with GTM_ARTIFACT_ROOT).
 */

import fs from 'node:fs';
import path from 'node:path';

const args = process.argv.slice(2);

function getArg(name) {
  const idx = args.indexOf(name);
  if (idx < 0 || idx + 1 >= args.length) return null;
  return args[idx + 1];
}

const API_BASE = process.env.API_BASE || 'http://localhost:3001';
const ADMIN_KEY = process.env.ADMIN_KEY;

if (!ADMIN_KEY) {
  console.error('ADMIN_KEY is required');
  process.exit(1);
}

async function api(endpoint, options = {}) {
  const response = await fetch(`${API_BASE}${endpoint}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      'x-admin-key': ADMIN_KEY,
      ...(options.headers || {}),
    },
  });

  const text = await response.text();
  let body;
  try {
    body = text ? JSON.parse(text) : null;
  } catch {
    body = text;
  }

  if (!response.ok) {
    throw new Error(`${options.method || 'GET'} ${endpoint} failed (${response.status}): ${text}`);
  }

  return body;
}

async function main() {
  console.log('🚀 CERNIQ GTM — seeding all PR cooperativas...');
  const seeded = await api('/admin/api/prospects/seed-all', { method: 'POST' });
  console.log(JSON.stringify({ step: 'seed-all', ...seeded }, null, 2));

  console.log('📊 Enriching prospects (COSSEC + intelligence + lead scoring)...');
  const enriched = await api('/admin/api/gtm/enrich-all', { method: 'POST' });
  console.log(JSON.stringify({ step: 'enrich-all', ...enriched }, null, 2));

  const linkedInPath = getArg('--linkedin');
  if (linkedInPath) {
    const fs = await import('node:fs');
    const csv = fs.readFileSync(linkedInPath, 'utf8');
    console.log(`🔗 Importing LinkedIn connections from ${linkedInPath}...`);
    const linkedIn = await api('/admin/api/gtm/linkedin-import', {
      method: 'POST',
      body: JSON.stringify({ csv }),
    });
    console.log(JSON.stringify({ step: 'linkedin-import', ...linkedIn }, null, 2));
  }

  console.log('🗺️  Building in-person field-sales playbook...');
  const playbook = await api('/admin/api/gtm/field-playbook');
  const outPath = getArg('--out');
  const artifactRoot = process.env.GTM_ARTIFACT_ROOT || path.join(process.cwd(), 'data/gtm-runs');
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(artifactRoot, runId);
  fs.mkdirSync(runDir, { recursive: true });
  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify({ seeded, enriched, linkedIn: linkedInPath ? true : false }, null, 2));
  fs.writeFileSync(path.join(runDir, 'field-playbook.json'), JSON.stringify(playbook, null, 2));
  fs.writeFileSync(path.join(artifactRoot, 'latest.json'), JSON.stringify({ runId, artifactPath: runDir, generatedAt: new Date().toISOString() }, null, 2));
  if (outPath) {
    fs.writeFileSync(outPath, JSON.stringify(playbook, null, 2));
    console.log(`Playbook written to ${outPath}`);
  } else {
    console.log(JSON.stringify({ step: 'field-playbook', artifactPath: runDir, ...playbook }, null, 2));
  }

  console.log('\n✅ GTM enrichment complete.');
  console.log('Next: visit /admin/prospects and /admin/intelligence for dossiers.');
  if (!linkedInPath) {
    console.log(
      'Tip: export LinkedIn connections (Settings → Data Privacy → Get a copy of your data → Connections)',
    );
    console.log('Then rerun with: --linkedin ./Connections.csv');
  }
}

main().catch((error) => {
  console.error(error.message || error);
  process.exit(1);
});
