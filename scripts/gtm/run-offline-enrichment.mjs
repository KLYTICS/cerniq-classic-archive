#!/usr/bin/env node
/**
 * Offline GTM enrichment — runs without DB/API when credentials are unavailable.
 * Produces the same artifact bundle as the production pipeline for review + CRM import.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createHash } from 'node:crypto';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CSV_PATH = path.join(
  ROOT,
  'datasets/pr-cooperativas/puerto_rico_cooperativas_seed.csv',
);
const ARTIFACT_ROOT = process.env.GTM_ARTIFACT_ROOT || path.join(ROOT, 'data/gtm-runs');

const COSSEC_SLUGS = [
  { slug: 'caguas', tokens: ['caguas'] },
  { slug: 'oriental', tokens: ['oriental', 'humacao'] },
  { slug: 'bayamon', tokens: ['bayamon'] },
  { slug: 'ponce', tokens: ['ponce'] },
  { slug: 'arecibo', tokens: ['arecibo'] },
  { slug: 'carolina', tokens: ['carolina'] },
  { slug: 'guaynabo', tokens: ['guaynabo'] },
  { slug: 'mayaguez', tokens: ['mayaguez'] },
  { slug: 'trujillo-alto', tokens: ['trujillo'] },
  { slug: 'san-german', tokens: ['san german', 'sangerman'] },
  { slug: 'acacia', tokens: ['acacia'] },
  { slug: 'aguada', tokens: ['aguada'] },
  { slug: 'aguadilla', tokens: ['aguadilla'] },
  { slug: 'roosevelt-roads', tokens: ['roosevelt'] },
];

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') {
      inQuotes = !inQuotes;
      continue;
    }
    if (char === ',' && !inQuotes) {
      fields.push(current.trim());
      current = '';
      continue;
    }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

function loadCsv() {
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = (name) => header.indexOf(name);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      name: cols[idx('institution')],
      location: cols[idx('location')],
      estimatedAssets: Number.parseInt(cols[idx('estimated_assets')] || '0', 10),
      contactRole: cols[idx('contact_role')] || 'CFO',
      region: cols[idx('region')] || 'Other',
    };
  });
}

function normalize(value) {
  return value
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/cooperativa de ahorro y credito (de )?/g, '')
    .replace(/[^a-z0-9\s]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

function matchCossecSlug(name) {
  const norm = normalize(name);
  for (const entry of COSSEC_SLUGS) {
    if (entry.tokens.some((token) => norm.includes(token.replace(/\s+/g, '')))) {
      return entry.slug;
    }
  }
  return null;
}

function scoreProspect(row) {
  let score = 50;
  if (row.estimatedAssets >= 300_000_000) score += 20;
  else if (row.estimatedAssets >= 150_000_000) score += 10;
  else if (row.estimatedAssets < 50_000_000) score -= 10;

  if (row.region === 'Metro') score += 10;
  else if (['East', 'North'].includes(row.region)) score += 5;

  if (['CFO', 'VP Finanzas'].includes(row.contactRole)) score += 10;
  else if (['Director Financiero', 'Gerente Financiero'].includes(row.contactRole)) score += 5;

  if (matchCossecSlug(row.name)) score += 8;
  return Math.min(Math.max(score, 1), 100);
}

function gradeFromScore(score) {
  if (score >= 85) return 'A';
  if (score >= 70) return 'B';
  if (score >= 55) return 'C';
  return 'D';
}

function buildPlaybook(rows) {
  const byRegion = new Map();
  for (const row of rows) {
    const bucket = byRegion.get(row.region) || [];
    bucket.push(row);
    byRegion.set(row.region, bucket);
  }

  let week = 1;
  const routes = [...byRegion.entries()]
    .sort((a, b) => {
      const assetsA = a[1].reduce((s, r) => s + r.estimatedAssets, 0);
      const assetsB = b[1].reduce((s, r) => s + r.estimatedAssets, 0);
      return assetsB - assetsA;
    })
    .map(([region, stops]) => ({
      region,
      suggestedWeek: week++,
      institutionCount: stops.length,
      totalAssetsUsd: stops.reduce((s, r) => s + r.estimatedAssets, 0),
      cossecSnapshotCount: stops.filter((s) => s.cossecSlug).length,
      stops: stops
        .map((stop) => ({
          name: stop.name,
          location: stop.location,
          estimatedAssetsM: Math.round(stop.estimatedAssets / 1_000_000),
          score: stop.score,
          grade: stop.grade,
          cossecSlug: stop.cossecSlug,
          contactRole: stop.contactRole,
          priority: stop.score >= 80 ? 'HIGH' : stop.score >= 65 ? 'MEDIUM' : 'LOW',
        }))
        .sort((a, b) => b.estimatedAssetsM - a.estimatedAssetsM),
    }));

  return {
    generatedAt: new Date().toISOString(),
    mode: 'offline',
    totalInstitutions: rows.length,
    totalAssetsUsd: rows.reduce((s, r) => s + r.estimatedAssets, 0),
    tier1Count: rows.filter((r) => r.estimatedAssets >= 200_000_000).length,
    cossecSnapshotCount: rows.filter((r) => r.cossecSlug).length,
    routes,
    weeklyPlan: routes.map((r) => ({
      week: r.suggestedWeek,
      region: r.region,
      stopCount: r.stops.length,
    })),
  };
}

function main() {
  const rows = loadCsv().map((row) => {
    const cossecSlug = matchCossecSlug(row.name);
    const score = scoreProspect({ ...row, cossecSlug });
    return { ...row, cossecSlug, score, grade: gradeFromScore(score) };
  });

  const topTargets = [...rows]
    .sort((a, b) => b.score - a.score || b.estimatedAssets - a.estimatedAssets)
    .slice(0, 25);

  const playbook = buildPlaybook(rows);
  const runId = new Date().toISOString().replace(/[:.]/g, '-');
  const runDir = path.join(ARTIFACT_ROOT, runId);
  fs.mkdirSync(runDir, { recursive: true });

  const summary = {
    runId,
    mode: 'offline',
    generatedAt: new Date().toISOString(),
    prospectsTotal: rows.length,
    cossecLinked: rows.filter((r) => r.cossecSlug).length,
    tier1Count: playbook.tier1Count,
    topTargets: topTargets.map((r) => ({
      name: r.name,
      region: r.region,
      estimatedAssetsM: Math.round(r.estimatedAssets / 1_000_000),
      score: r.score,
      grade: r.grade,
      cossecSlug: r.cossecSlug,
      contactRole: r.contactRole,
    })),
  };

  fs.writeFileSync(path.join(runDir, 'summary.json'), JSON.stringify(summary, null, 2));
  fs.writeFileSync(path.join(runDir, 'field-playbook.json'), JSON.stringify(playbook, null, 2));
  fs.writeFileSync(
    path.join(runDir, 'top-targets.csv'),
    [
      'name,region,assets_m,score,grade,cossec_slug,contact_role',
      ...topTargets.map(
        (r) =>
          `"${r.name}",${r.region},${Math.round(r.estimatedAssets / 1_000_000)},${r.score},${r.grade},${r.cossecSlug || ''},${r.contactRole}`,
      ),
    ].join('\n'),
  );

  const manifest = {
    runId,
    generatedAt: summary.generatedAt,
    artifactPath: runDir,
    checksum: createHash('sha256')
      .update(JSON.stringify({ summary, playbook }))
      .digest('hex'),
    files: ['summary.json', 'field-playbook.json', 'top-targets.csv'],
  };
  fs.writeFileSync(path.join(runDir, 'manifest.json'), JSON.stringify(manifest, null, 2));
  fs.writeFileSync(path.join(ARTIFACT_ROOT, 'latest.json'), JSON.stringify(manifest, null, 2));

  console.log(JSON.stringify({ status: 'SUCCESS', ...manifest, summary }, null, 2));
}

main();
