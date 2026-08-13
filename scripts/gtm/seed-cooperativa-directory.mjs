#!/usr/bin/env node
/**
 * Offline cooperativa leadership directory + secured outreach enrichment.
 * No database required. Never fabricates personal emails/phones/names.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'datasets/pr-cooperativas/puerto_rico_cooperativas_seed.csv');
const COSSEC_PATH = path.join(
  ROOT,
  'backend-node/src/alm/data-pull/cossec-snapshots/cossec-2025q4.ts',
);
const OUT_DIR = process.env.COOP_DIRECTORY_ROOT || path.join(ROOT, 'data/cooperativa-directory');

const ORG_UNITS = [
  { unitKey: 'junta_directiva', nameEs: 'Junta Directiva', nameEn: 'Board of Directors', sortOrder: 10 },
  { unitKey: 'gerencia_general', nameEs: 'Gerencia General', nameEn: 'Executive Management', sortOrder: 20 },
  { unitKey: 'finanzas', nameEs: 'Finanzas y Tesorería', nameEn: 'Finance and Treasury', sortOrder: 30 },
  { unitKey: 'riesgos_cumplimiento', nameEs: 'Riesgos y Cumplimiento', nameEn: 'Risk and Compliance', sortOrder: 40 },
  { unitKey: 'alco', nameEs: 'Comité ALCO', nameEn: 'ALCO Committee', sortOrder: 50 },
  { unitKey: 'auditoria', nameEs: 'Auditoría Interna', nameEn: 'Internal Audit', sortOrder: 60 },
  { unitKey: 'operaciones', nameEs: 'Operaciones', nameEn: 'Operations', sortOrder: 70 },
  { unitKey: 'tecnologia', nameEs: 'Tecnología', nameEn: 'Technology', sortOrder: 80 },
];

const ROLES = [
  { roleKey: 'presidente_junta', unitKey: 'junta_directiva', titleEs: 'Presidente(a) de la Junta Directiva', titleEn: 'Board Chair', decisionTier: 'board', almBuyerPriority: 75, reportsToRoleKey: null },
  { roleKey: 'vicepresidente_junta', unitKey: 'junta_directiva', titleEs: 'Vicepresidente(a) de la Junta', titleEn: 'Board Vice Chair', decisionTier: 'board', almBuyerPriority: 60, reportsToRoleKey: 'presidente_junta' },
  { roleKey: 'secretario_junta', unitKey: 'junta_directiva', titleEs: 'Secretario(a) de la Junta', titleEn: 'Board Secretary', decisionTier: 'board', almBuyerPriority: 40, reportsToRoleKey: 'presidente_junta' },
  { roleKey: 'tesorero_junta', unitKey: 'junta_directiva', titleEs: 'Tesorero(a) de la Junta', titleEn: 'Board Treasurer', decisionTier: 'board', almBuyerPriority: 70, reportsToRoleKey: 'presidente_junta' },
  { roleKey: 'gerente_general', unitKey: 'gerencia_general', titleEs: 'Gerente General', titleEn: 'CEO', decisionTier: 'executive', almBuyerPriority: 90, reportsToRoleKey: 'presidente_junta' },
  { roleKey: 'cfo', unitKey: 'finanzas', titleEs: 'CFO', titleEn: 'CFO', decisionTier: 'executive', almBuyerPriority: 100, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'gerente_financiero', unitKey: 'finanzas', titleEs: 'Gerente Financiero(a)', titleEn: 'Finance Manager', decisionTier: 'executive', almBuyerPriority: 95, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'director_financiero', unitKey: 'finanzas', titleEs: 'Director(a) Financiero(a)', titleEn: 'Director of Finance', decisionTier: 'executive', almBuyerPriority: 92, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'controller', unitKey: 'finanzas', titleEs: 'Controller', titleEn: 'Controller', decisionTier: 'operational', almBuyerPriority: 80, reportsToRoleKey: 'cfo' },
  { roleKey: 'tesorero_operaciones', unitKey: 'finanzas', titleEs: 'Tesorero(a)', titleEn: 'Treasurer', decisionTier: 'operational', almBuyerPriority: 78, reportsToRoleKey: 'cfo' },
  { roleKey: 'oficial_cumplimiento', unitKey: 'riesgos_cumplimiento', titleEs: 'Oficial de Cumplimiento', titleEn: 'Compliance Officer', decisionTier: 'executive', almBuyerPriority: 85, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'oficial_riesgos', unitKey: 'riesgos_cumplimiento', titleEs: 'Oficial de Riesgos', titleEn: 'Chief Risk Officer', decisionTier: 'executive', almBuyerPriority: 88, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'presidente_alco', unitKey: 'alco', titleEs: 'Presidente(a) del Comité ALCO', titleEn: 'ALCO Chair', decisionTier: 'committee', almBuyerPriority: 98, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'miembro_alco_finanzas', unitKey: 'alco', titleEs: 'Miembro ALCO (Finanzas)', titleEn: 'ALCO Member', decisionTier: 'committee', almBuyerPriority: 90, reportsToRoleKey: 'presidente_alco' },
  { roleKey: 'auditor_interno', unitKey: 'auditoria', titleEs: 'Auditor(a) Interno(a)', titleEn: 'Internal Auditor', decisionTier: 'operational', almBuyerPriority: 65, reportsToRoleKey: 'junta_directiva' },
  { roleKey: 'vp_operaciones', unitKey: 'operaciones', titleEs: 'VP Operaciones', titleEn: 'VP Operations', decisionTier: 'executive', almBuyerPriority: 55, reportsToRoleKey: 'gerente_general' },
  { roleKey: 'director_tecnologia', unitKey: 'tecnologia', titleEs: 'Director(a) de Tecnología', titleEn: 'CTO', decisionTier: 'executive', almBuyerPriority: 50, reportsToRoleKey: 'gerente_general' },
];

const ROLE_MAP = {
  CFO: 'cfo',
  'VP Finanzas': 'gerente_financiero',
  'Gerente Financiero': 'gerente_financiero',
  'Director Financiero': 'director_financiero',
  'Gerente General': 'gerente_general',
  Presidente: 'gerente_general',
};

const ROLE_LABEL = {
  cfo: 'CFO',
  gerente_financiero: 'Gerente Financiero / VP Finanzas',
  director_financiero: 'Director Financiero',
  gerente_general: 'Gerente General',
};

const REGION_WEEK = {
  Metro: 1,
  East: 2,
  South: 3,
  West: 4,
  North: 5,
  Central: 6,
  Islands: 7,
};

function parseCsvLine(line) {
  const fields = [];
  let current = '';
  let inQuotes = false;
  for (const char of line) {
    if (char === '"') { inQuotes = !inQuotes; continue; }
    if (char === ',' && !inQuotes) { fields.push(current.trim()); current = ''; continue; }
    current += char;
  }
  fields.push(current.trim());
  return fields;
}

function loadCsv() {
  const content = fs.readFileSync(CSV_PATH, 'utf8');
  const lines = content.split(/\r?\n/).filter(Boolean);
  const header = parseCsvLine(lines[0]);
  const idx = (n) => header.indexOf(n);
  return lines.slice(1).map((line) => {
    const cols = parseCsvLine(line);
    return {
      name: cols[idx('institution')],
      location: cols[idx('location')],
      estimatedAssets: Number.parseInt(cols[idx('estimated_assets')] || '0', 10),
      contactRole: cols[idx('contact_role')] || 'CFO',
      region: cols[idx('region')] || '',
    };
  });
}

function loadCossecSlugs() {
  const raw = fs.readFileSync(COSSEC_PATH, 'utf8');
  const slugs = [...raw.matchAll(/slug:\s*'([^']+)'/g)].map((m) => m[1]);
  const names = [...raw.matchAll(/name:\s*'([^']+)'/g)].map((m) => m[1]);
  return names.map((name, i) => ({ name, slug: slugs[i] })).filter((x) => x.slug);
}

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/cooperativa de ahorro y credito (de )?/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function normalize(input) {
  return input.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/cooperativa de ahorro y credito (de )?/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ').replace(/\s+/g, ' ').trim();
}

function matchCossec(name, cossecEntries) {
  const slug = slugify(name);
  const exact = cossecEntries.find((e) => e.slug === slug);
  if (exact) return exact.slug;
  const normalized = normalize(name);
  for (const entry of cossecEntries) {
    if (normalize(entry.name) === normalized) return entry.slug;
    if (normalized.includes(entry.slug.replace(/-/g, ' '))) return entry.slug;
  }
  const words = normalized.split(' ').filter((w) => w.length >= 4);
  for (const entry of cossecEntries) {
    const entryNorm = normalize(entry.name);
    for (const word of words) {
      if (entry.slug === word || entryNorm.includes(word)) return entry.slug;
    }
  }
  return null;
}

function scoreInstitution({ estimatedAssets, contactRole, region, cossec }) {
  let score = 40;
  if (estimatedAssets >= 300_000_000) score += 35;
  else if (estimatedAssets >= 200_000_000) score += 30;
  else if (estimatedAssets >= 100_000_000) score += 20;
  else if (estimatedAssets >= 50_000_000) score += 10;
  if (cossec) score += 15;
  const roleKey = ROLE_MAP[contactRole] || 'cfo';
  if (['cfo', 'gerente_financiero', 'director_financiero'].includes(roleKey)) score += 12;
  else if (roleKey === 'gerente_general') score += 8;
  if (region === 'Metro' || region === 'East') score += 5;
  score = Math.min(100, score);
  const grade = score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  const tier = estimatedAssets >= 200_000_000 ? 1 : estimatedAssets >= 100_000_000 ? 2 : 3;
  const pri = grade === 'A' || tier === 1 ? 'H' : grade === 'B' ? 'M' : 'L';
  return { score, grade, tier, pri, roleKey };
}

function buildOutreach(row, cossecSlug) {
  const cossec = Boolean(cossecSlug);
  const { score, grade, tier, pri, roleKey } = scoreInstitution({
    estimatedAssets: row.estimatedAssets,
    contactRole: row.contactRole,
    region: row.region,
    cossec,
  });
  const roleLabel = ROLE_LABEL[roleKey] || row.contactRole || 'CFO';
  const assetsM = Math.round((row.estimatedAssets || 0) / 1_000_000);
  const municipality = row.location?.split(',')[0]?.trim() || null;
  const ch = pri === 'H' ? (cossec ? ['ip', 'li', 'em'] : ['ip', 'li', 'em', 'ph'])
    : pri === 'M' ? ['li', 'em', 'ip'] : ['em', 'li'];
  const label = { ip: 'in-person', em: 'email', li: 'LinkedIn', ph: 'phone' };
  const seq = ch.map((c) => label[c]).join(' → ');
  const size = assetsM >= 200 ? 'tier-1' : assetsM >= 100 ? 'mid-market' : 'community';
  const hook = roleKey === 'gerente_general'
    ? `Gerente General · ${size}: board/ALCO pack + COSSEC readiness`
    : cossec
      ? `Finance buyer · ${size} + COSSEC snapshot: free health score → ALM demo`
      : `Finance buyer · ${size}: estimate-based health preview → COSSEC data ask`;
  const ask = pri === 'H'
    ? '15-min in-person ALM walkthrough this week; leave bilingual one-pager'
    : pri === 'M'
      ? 'LinkedIn + email: offer free COSSEC-aligned health report PDF'
      : 'Email nurture: quarterly COSSEC ratio brief; request decision-maker intro';
  const cossecBit = cossec
    ? 'COSSEC snapshot linked — lead with published ratios'
    : 'No COSSEC snapshot yet — ask for latest quarterly filing';
  const note = `${municipality || row.region} · T${tier}/${grade} · ask for ${roleLabel}. ${cossecBit}. Assets ~$${assetsM}M. Bilingual ES/EN. No cold spam; one touch + value.`;

  return {
    v: 1,
    score,
    grade,
    tier,
    pri,
    role: roleKey,
    roleLabel,
    ch,
    seq,
    hook,
    ask,
    note,
    route: { r: row.region || 'Unknown', w: REGION_WEEK[row.region] || 8 },
    cossec,
    cossecSlug,
    assetsM,
    loc: row.location || municipality || row.region || '',
    secure: { pii: 'none', access: 'admin' },
  };
}

function buildSeatContactNote(roleKey, isPrimaryBuyer, outreach) {
  if (!isPrimaryBuyer) return null;
  const title = ROLE_LABEL[roleKey] || outreach.roleLabel;
  const bestChannel = outreach.pri === 'H' ? 'in_person' : outreach.pri === 'M' ? 'linkedin' : 'email';
  return {
    approach: `Primary ALM buyer (${title}). ${outreach.seq}.`,
    openerEs: `Buenos días — soy de CERNIQ. Preparamos un brief bilingüe de salud ALM/COSSEC para ${outreach.loc} (~$${outreach.assetsM}M). ¿15 min con ${title}?`,
    openerEn: `Hi — CERNIQ here. We prepared a bilingual ALM/COSSEC health brief for ${outreach.loc} (~$${outreach.assetsM}M). 15 min with ${title}?`,
    bestChannel,
    nextAction: outreach.ask,
  };
}

function buildInstitution(row, cossecEntries) {
  const slug = slugify(row.name);
  const primaryRoleKey = ROLE_MAP[row.contactRole] || 'cfo';
  const cossecSlug = matchCossec(row.name, cossecEntries);
  const outreach = buildOutreach(row, cossecSlug);

  const leadershipFlat = ROLES.map((role) => {
    const isPrimaryBuyer = role.roleKey === primaryRoleKey;
    return {
      roleKey: role.roleKey,
      titleEs: role.titleEs,
      titleEn: role.titleEn,
      unitKey: role.unitKey,
      decisionTier: role.decisionTier,
      almBuyerPriority: role.almBuyerPriority,
      reportsToRoleKey: role.reportsToRoleKey,
      fullName: null,
      email: null,
      phone: null,
      linkedinUrl: null,
      isPrimaryBuyer,
      isPlaceholder: true,
      provenance: 'org_template+outreach',
      contactNote: buildSeatContactNote(role.roleKey, isPrimaryBuyer, outreach),
    };
  });

  const orgUnits = ORG_UNITS.map((unit) => ({
    ...unit,
    leadership: leadershipFlat.filter((seat) => seat.unitKey === unit.unitKey),
  }));

  return {
    slug,
    name: row.name,
    location: row.location,
    region: row.region,
    municipality: row.location?.split(',')[0]?.trim() ?? null,
    estimatedAssetsUsd: row.estimatedAssets,
    regulator: 'COSSEC',
    structureVersion: '2026.1',
    cossecSlug,
    outreach,
    orgUnits,
    primaryBuyers: leadershipFlat.filter((s) => s.isPrimaryBuyer),
    leadershipFlat,
  };
}

function buildSummary(institutions) {
  const routesMap = new Map();
  const totals = {
    institutions: institutions.length,
    tier1: 0,
    tier2: 0,
    tier3: 0,
    gradeA: 0,
    gradeB: 0,
    gradeC: 0,
    gradeD: 0,
    priorityH: 0,
    cossecLinked: 0,
    totalAssetsM: 0,
  };

  for (const inst of institutions) {
    const o = inst.outreach;
    if (o.tier === 1) totals.tier1++;
    else if (o.tier === 2) totals.tier2++;
    else totals.tier3++;
    if (o.grade === 'A') totals.gradeA++;
    else if (o.grade === 'B') totals.gradeB++;
    else if (o.grade === 'C') totals.gradeC++;
    else totals.gradeD++;
    if (o.pri === 'H') totals.priorityH++;
    if (o.cossec) totals.cossecLinked++;
    totals.totalAssetsM += o.assetsM;

    const existing = routesMap.get(o.route.r) || {
      region: o.route.r,
      week: o.route.w,
      count: 0,
      priorityH: 0,
    };
    existing.count += 1;
    if (o.pri === 'H') existing.priorityH += 1;
    routesMap.set(o.route.r, existing);
  }

  const topTargets = [...institutions]
    .sort((a, b) => b.outreach.score - a.outreach.score)
    .slice(0, 20)
    .map((inst) => ({
      slug: inst.slug,
      name: inst.name,
      score: inst.outreach.score,
      grade: inst.outreach.grade,
      tier: inst.outreach.tier,
      role: inst.outreach.roleLabel,
      loc: inst.outreach.loc,
      ask: inst.outreach.ask,
      note: inst.outreach.note,
    }));

  return {
    schemaVersion: 'cerniq.cooperativa-outreach.v1',
    generatedAt: new Date().toISOString(),
    secure: { piiPolicy: 'no_fabricated_contacts', access: 'admin_only' },
    totals,
    routes: [...routesMap.values()].sort((a, b) => a.week - b.week),
    topTargets,
  };
}

function main() {
  const cossecEntries = loadCossecSlugs();
  const institutions = loadCsv().map((row) => buildInstitution(row, cossecEntries));
  const summary = buildSummary(institutions);
  const bundle = {
    schemaVersion: 'cerniq.cooperativa-directory.v1',
    generatedAt: new Date().toISOString(),
    institutionCount: institutions.length,
    leadershipSeatCount: institutions.length * ROLES.length,
    secure: { piiPolicy: 'no_fabricated_contacts', access: 'admin_only' },
    institutions,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bundlePath = path.join(OUT_DIR, 'agent-bundle.json');
  const ndjsonPath = path.join(OUT_DIR, 'agent-bundle.ndjson');
  const summaryPath = path.join(OUT_DIR, 'outreach-summary.json');
  const compactPath = path.join(OUT_DIR, 'outreach-compact.csv');

  fs.writeFileSync(bundlePath, JSON.stringify(bundle));
  fs.writeFileSync(
    ndjsonPath,
    [
      JSON.stringify({ type: 'manifest', ...bundle, institutions: undefined }),
      ...institutions.map((i) => JSON.stringify(i)),
    ].join('\n'),
  );
  fs.writeFileSync(summaryPath, JSON.stringify(summary, null, 2));

  const csvHeader = 'slug,name,region,week,assets_m,score,grade,tier,pri,role,cossec,seq,ask,note';
  const csvRows = institutions.map((i) => {
    const o = i.outreach;
    const esc = (s) => `"${String(s).replace(/"/g, '""')}"`;
    return [
      i.slug,
      esc(i.name),
      o.route.r,
      o.route.w,
      o.assetsM,
      o.score,
      o.grade,
      o.tier,
      o.pri,
      esc(o.roleLabel),
      o.cossec,
      esc(o.seq),
      esc(o.ask),
      esc(o.note),
    ].join(',');
  });
  fs.writeFileSync(compactPath, [csvHeader, ...csvRows].join('\n'));

  fs.writeFileSync(
    path.join(OUT_DIR, 'latest.json'),
    JSON.stringify({
      generatedAt: bundle.generatedAt,
      bundlePath,
      ndjsonPath,
      summaryPath,
      compactPath,
      institutionCount: bundle.institutionCount,
      leadershipSeatCount: bundle.leadershipSeatCount,
      priorityH: summary.totals.priorityH,
      cossecLinked: summary.totals.cossecLinked,
    }, null, 2),
  );

  console.log(JSON.stringify({
    status: 'SUCCESS',
    bundlePath,
    summaryPath,
    compactPath,
    institutionCount: bundle.institutionCount,
    leadershipSeatCount: bundle.leadershipSeatCount,
    totals: summary.totals,
    routes: summary.routes,
    top5: summary.topTargets.slice(0, 5).map((t) => ({
      name: t.name,
      score: t.score,
      grade: t.grade,
      role: t.role,
      ask: t.ask,
    })),
  }, null, 2));
}

main();
