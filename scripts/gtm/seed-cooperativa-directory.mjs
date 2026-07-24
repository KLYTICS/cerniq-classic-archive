#!/usr/bin/env node
/**
 * Offline cooperativa leadership directory — no database required.
 * Produces agent-ready bundle for Hermes/OpenClaw handoff.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(__dirname, '../..');
const CSV_PATH = path.join(ROOT, 'services/outbound/data/puerto_rico_cooperativas_seed.csv');
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

function slugify(name) {
  return name.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase()
    .replace(/cooperativa de ahorro y credito (de )?/g, '')
    .replace(/[^a-z0-9\s-]/g, '').trim().replace(/\s+/g, '-');
}

function buildInstitution(row) {
  const slug = slugify(row.name);
  const primaryRoleKey = ROLE_MAP[row.contactRole] || 'cfo';
  const leadershipFlat = ROLES.map((role) => ({
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
    isPrimaryBuyer: role.roleKey === primaryRoleKey,
    isPlaceholder: true,
    provenance: 'org_template',
  }));

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
    orgUnits,
    primaryBuyers: leadershipFlat.filter((s) => s.isPrimaryBuyer),
    leadershipFlat,
  };
}

function main() {
  const institutions = loadCsv().map(buildInstitution);
  const bundle = {
    schemaVersion: 'cerniq.cooperativa-directory.v1',
    generatedAt: new Date().toISOString(),
    institutionCount: institutions.length,
    leadershipSeatCount: institutions.length * ROLES.length,
    institutions,
  };

  fs.mkdirSync(OUT_DIR, { recursive: true });
  const bundlePath = path.join(OUT_DIR, 'agent-bundle.json');
  const ndjsonPath = path.join(OUT_DIR, 'agent-bundle.ndjson');
  fs.writeFileSync(bundlePath, JSON.stringify(bundle, null, 2));
  fs.writeFileSync(
    ndjsonPath,
    [JSON.stringify({ type: 'manifest', ...bundle, institutions: undefined }), ...institutions.map((i) => JSON.stringify(i))].join('\n'),
  );
  fs.writeFileSync(
    path.join(OUT_DIR, 'latest.json'),
    JSON.stringify({ generatedAt: bundle.generatedAt, bundlePath, ndjsonPath, institutionCount: bundle.institutionCount }, null, 2),
  );

  console.log(JSON.stringify({ status: 'SUCCESS', bundlePath, ndjsonPath, ...bundle }, null, 2));
}

main();
