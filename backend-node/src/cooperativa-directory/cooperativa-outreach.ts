/**
 * Compact, secured outreach enrichment for PR cooperativas.
 * Never fabricates personal emails/phones/names — only operational playbooks.
 */

import { COSSEC_SNAPSHOT_2025Q4 } from '../alm/data-pull/cossec-snapshots/cossec-2025q4';
import {
  resolvePrimaryRoleKey,
  slugifyCooperativaName,
} from './cooperativa-org-template';

export const OUTREACH_PACK_VERSION = 1 as const;

export type OutreachGrade = 'A' | 'B' | 'C' | 'D';
export type OutreachPriority = 'H' | 'M' | 'L';
export type OutreachTier = 1 | 2 | 3;
export type OutreachChannel = 'ip' | 'em' | 'li' | 'ph';

export type CooperativaOutreach = {
  v: typeof OUTREACH_PACK_VERSION;
  score: number;
  grade: OutreachGrade;
  tier: OutreachTier;
  pri: OutreachPriority;
  role: string;
  roleLabel: string;
  ch: OutreachChannel[];
  seq: string;
  hook: string;
  ask: string;
  note: string;
  route: { r: string; w: number };
  cossec: boolean;
  cossecSlug: string | null;
  assetsM: number;
  loc: string;
  secure: { pii: 'none' | 'partial'; access: 'admin' };
};

export type CooperativaSeatContactNote = {
  approach: string;
  openerEs: string;
  openerEn: string;
  bestChannel: 'in_person' | 'linkedin' | 'email';
  nextAction: string;
};

const REGION_WEEK: Record<string, number> = {
  Metro: 1,
  East: 2,
  South: 3,
  West: 4,
  North: 5,
  Central: 6,
  Islands: 7,
};

const ROLE_LABEL: Record<string, string> = {
  cfo: 'CFO',
  gerente_financiero: 'Gerente Financiero / VP Finanzas',
  director_financiero: 'Director Financiero',
  gerente_general: 'Gerente General',
  presidente_alco: 'Presidente ALCO',
  oficial_riesgos: 'Oficial de Riesgos',
  oficial_cumplimiento: 'Oficial de Cumplimiento',
};

function normalize(input: string): string {
  return input
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/cooperativa de ahorro y credito (de )?/g, '')
    .replace(/[^a-z0-9\s-]/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
}

export function matchCossecSlug(name: string): string | null {
  const slug = slugifyCooperativaName(name);
  const exact = COSSEC_SNAPSHOT_2025Q4.find((e) => e.slug === slug);
  if (exact) return exact.slug;

  const normalized = normalize(name);
  for (const entry of COSSEC_SNAPSHOT_2025Q4) {
    if (normalize(entry.name) === normalized) return entry.slug;
    if (
      normalized.includes(entry.slug) ||
      entry.slug.includes(normalized.split(' ')[0] ?? '')
    ) {
      if (
        entry.slug.length >= 4 &&
        normalized.includes(entry.slug.replace(/-/g, ' '))
      ) {
        return entry.slug;
      }
    }
  }

  const words = normalized.split(' ').filter((w) => w.length >= 4);
  for (const entry of COSSEC_SNAPSHOT_2025Q4) {
    const entryNorm = normalize(entry.name);
    for (const word of words) {
      if (entry.slug === word || entryNorm.includes(word)) return entry.slug;
    }
  }
  return null;
}

export function scoreInstitution(input: {
  estimatedAssets: number;
  contactRole: string;
  region: string;
  cossec: boolean;
}): {
  score: number;
  grade: OutreachGrade;
  tier: OutreachTier;
  pri: OutreachPriority;
} {
  let score = 40;
  const assets = input.estimatedAssets || 0;

  if (assets >= 300_000_000) score += 35;
  else if (assets >= 200_000_000) score += 30;
  else if (assets >= 100_000_000) score += 20;
  else if (assets >= 50_000_000) score += 10;

  if (input.cossec) score += 15;

  const roleKey = resolvePrimaryRoleKey(input.contactRole);
  if (
    [
      'cfo',
      'gerente_financiero',
      'director_financiero',
      'presidente_alco',
    ].includes(roleKey)
  ) {
    score += 12;
  } else if (roleKey === 'gerente_general') {
    score += 8;
  }

  if (input.region === 'Metro' || input.region === 'East') score += 5;

  score = Math.min(100, score);

  const grade: OutreachGrade =
    score >= 85 ? 'A' : score >= 70 ? 'B' : score >= 55 ? 'C' : 'D';
  const tier: OutreachTier =
    assets >= 200_000_000 ? 1 : assets >= 100_000_000 ? 2 : 3;
  const pri: OutreachPriority =
    grade === 'A' || tier === 1 ? 'H' : grade === 'B' ? 'M' : 'L';

  return { score, grade, tier, pri };
}

function channelsFor(
  pri: OutreachPriority,
  cossec: boolean,
): OutreachChannel[] {
  if (pri === 'H')
    return cossec ? ['ip', 'li', 'em'] : ['ip', 'li', 'em', 'ph'];
  if (pri === 'M') return ['li', 'em', 'ip'];
  return ['em', 'li'];
}

function hookFor(roleKey: string, assetsM: number, cossec: boolean): string {
  const size =
    assetsM >= 200 ? 'tier-1' : assetsM >= 100 ? 'mid-market' : 'community';
  if (roleKey === 'gerente_general') {
    return `Gerente General · ${size}: board/ALCO pack + COSSEC readiness in one bilingual brief`;
  }
  if (roleKey === 'oficial_riesgos' || roleKey === 'oficial_cumplimiento') {
    return `Risk/Compliance · ${size}: gap manifest (no silent zeros) + ratio watchlist`;
  }
  if (cossec) {
    return `Finance buyer · ${size} + COSSEC snapshot: free health score → ALM demo`;
  }
  return `Finance buyer · ${size}: estimate-based health preview → COSSEC data pull ask`;
}

function askFor(pri: OutreachPriority): string {
  if (pri === 'H')
    return '15-min in-person ALM walkthrough this week; leave bilingual one-pager';
  if (pri === 'M')
    return 'LinkedIn + email: offer free COSSEC-aligned health report PDF';
  return 'Email nurture: quarterly COSSEC ratio brief; request decision-maker intro';
}

function seqFor(ch: OutreachChannel[]): string {
  const label: Record<OutreachChannel, string> = {
    ip: 'in-person',
    em: 'email',
    li: 'LinkedIn',
    ph: 'phone',
  };
  return ch.map((c) => label[c]).join(' → ');
}

function noteFor(input: {
  name: string;
  municipality: string | null;
  region: string;
  roleLabel: string;
  grade: OutreachGrade;
  tier: OutreachTier;
  cossec: boolean;
  assetsM: number;
}): string {
  const city = input.municipality || input.region;
  const cossecBit = input.cossec
    ? 'COSSEC snapshot linked — lead with published ratios'
    : 'No COSSEC snapshot yet — ask for latest quarterly filing';
  return `${city} · T${input.tier}/${input.grade} · ask for ${input.roleLabel}. ${cossecBit}. Assets ~$${input.assetsM}M. Bilingual ES/EN. No cold spam; one touch + value.`;
}

export function buildSeatContactNote(input: {
  roleKey: string;
  isPrimaryBuyer: boolean;
  outreach: CooperativaOutreach;
}): CooperativaSeatContactNote | null {
  if (!input.isPrimaryBuyer) return null;

  const title = ROLE_LABEL[input.roleKey] ?? input.outreach.roleLabel;
  const bestChannel =
    input.outreach.pri === 'H'
      ? ('in_person' as const)
      : input.outreach.pri === 'M'
        ? ('linkedin' as const)
        : ('email' as const);

  return {
    approach: `Primary ALM buyer (${title}). ${input.outreach.seq}.`,
    openerEs: `Buenos días — soy de CERNIQ. Preparamos un brief bilingüe de salud ALM/COSSEC para ${input.outreach.loc} (~$${input.outreach.assetsM}M). ¿15 min con ${title}?`,
    openerEn: `Hi — CERNIQ here. We prepared a bilingual ALM/COSSEC health brief for ${input.outreach.loc} (~$${input.outreach.assetsM}M). 15 min with ${title}?`,
    bestChannel,
    nextAction: input.outreach.ask,
  };
}

export function buildOutreach(input: {
  name: string;
  location: string | null | undefined;
  estimatedAssets: number;
  contactRole: string;
  region: string;
}): CooperativaOutreach {
  const cossecSlug = matchCossecSlug(input.name);
  const cossec = Boolean(cossecSlug);
  const { score, grade, tier, pri } = scoreInstitution({
    estimatedAssets: input.estimatedAssets,
    contactRole: input.contactRole,
    region: input.region,
    cossec,
  });
  const role = resolvePrimaryRoleKey(input.contactRole);
  const roleLabel = ROLE_LABEL[role] ?? (input.contactRole || 'CFO');
  const assetsM = Math.round((input.estimatedAssets || 0) / 1_000_000);
  const municipality = input.location?.split(',')[0]?.trim() ?? null;
  const ch = channelsFor(pri, cossec);
  const week = REGION_WEEK[input.region] ?? 8;

  return {
    v: OUTREACH_PACK_VERSION,
    score,
    grade,
    tier,
    pri,
    role,
    roleLabel,
    ch,
    seq: seqFor(ch),
    hook: hookFor(role, assetsM, cossec),
    ask: askFor(pri),
    note: noteFor({
      name: input.name,
      municipality,
      region: input.region,
      roleLabel,
      grade,
      tier,
      cossec,
      assetsM,
    }),
    route: { r: input.region || 'Unknown', w: week },
    cossec,
    cossecSlug,
    assetsM,
    loc: input.location || municipality || input.region || '',
    secure: { pii: 'none', access: 'admin' },
  };
}

export type CompactOutreachSummary = {
  schemaVersion: 'cerniq.cooperativa-outreach.v1';
  generatedAt: string;
  secure: { piiPolicy: 'no_fabricated_contacts'; access: 'admin_only' };
  totals: {
    institutions: number;
    tier1: number;
    tier2: number;
    tier3: number;
    gradeA: number;
    gradeB: number;
    gradeC: number;
    gradeD: number;
    priorityH: number;
    cossecLinked: number;
    totalAssetsM: number;
  };
  routes: Array<{
    region: string;
    week: number;
    count: number;
    priorityH: number;
  }>;
  topTargets: Array<{
    slug: string;
    name: string;
    score: number;
    grade: OutreachGrade;
    tier: OutreachTier;
    role: string;
    loc: string;
    ask: string;
    note: string;
  }>;
};
