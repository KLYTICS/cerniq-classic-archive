/**
 * Standard COSSEC-regulated cooperativa org structure for PR financial institutions.
 * Seats are placeholders until enriched via LinkedIn, manual entry, or future Hermes/OpenClaw agent.
 */

export type CooperativaDecisionTier =
  | 'board'
  | 'executive'
  | 'committee'
  | 'operational';

export type CooperativaOrgUnitTemplate = {
  unitKey: string;
  nameEs: string;
  nameEn: string;
  sortOrder: number;
};

export type CooperativaLeadershipRoleTemplate = {
  roleKey: string;
  unitKey: string;
  titleEs: string;
  titleEn: string;
  decisionTier: CooperativaDecisionTier;
  almBuyerPriority: number;
  isPrimaryBuyerCandidate: boolean;
  reportsToRoleKey?: string;
};

export const COOPERATIVA_STRUCTURE_VERSION = '2026.1';

export const COOPERATIVA_ORG_UNITS: CooperativaOrgUnitTemplate[] = [
  {
    unitKey: 'junta_directiva',
    nameEs: 'Junta Directiva',
    nameEn: 'Board of Directors',
    sortOrder: 10,
  },
  {
    unitKey: 'gerencia_general',
    nameEs: 'Gerencia General',
    nameEn: 'Executive Management',
    sortOrder: 20,
  },
  {
    unitKey: 'finanzas',
    nameEs: 'Finanzas y Tesorería',
    nameEn: 'Finance and Treasury',
    sortOrder: 30,
  },
  {
    unitKey: 'riesgos_cumplimiento',
    nameEs: 'Riesgos y Cumplimiento',
    nameEn: 'Risk and Compliance',
    sortOrder: 40,
  },
  {
    unitKey: 'alco',
    nameEs: 'Comité de Activos y Pasivos (ALCO)',
    nameEn: 'Asset-Liability Committee (ALCO)',
    sortOrder: 50,
  },
  {
    unitKey: 'auditoria',
    nameEs: 'Auditoría Interna',
    nameEn: 'Internal Audit',
    sortOrder: 60,
  },
  {
    unitKey: 'operaciones',
    nameEs: 'Operaciones',
    nameEn: 'Operations',
    sortOrder: 70,
  },
  {
    unitKey: 'tecnologia',
    nameEs: 'Tecnología',
    nameEn: 'Technology',
    sortOrder: 80,
  },
];

export const COOPERATIVA_LEADERSHIP_ROLES: CooperativaLeadershipRoleTemplate[] =
  [
    {
      roleKey: 'presidente_junta',
      unitKey: 'junta_directiva',
      titleEs: 'Presidente(a) de la Junta Directiva',
      titleEn: 'Board Chair',
      decisionTier: 'board',
      almBuyerPriority: 75,
      isPrimaryBuyerCandidate: true,
    },
    {
      roleKey: 'vicepresidente_junta',
      unitKey: 'junta_directiva',
      titleEs: 'Vicepresidente(a) de la Junta Directiva',
      titleEn: 'Board Vice Chair',
      decisionTier: 'board',
      almBuyerPriority: 60,
      isPrimaryBuyerCandidate: false,
      reportsToRoleKey: 'presidente_junta',
    },
    {
      roleKey: 'secretario_junta',
      unitKey: 'junta_directiva',
      titleEs: 'Secretario(a) de la Junta Directiva',
      titleEn: 'Board Secretary',
      decisionTier: 'board',
      almBuyerPriority: 40,
      isPrimaryBuyerCandidate: false,
      reportsToRoleKey: 'presidente_junta',
    },
    {
      roleKey: 'tesorero_junta',
      unitKey: 'junta_directiva',
      titleEs: 'Tesorero(a) de la Junta Directiva',
      titleEn: 'Board Treasurer',
      decisionTier: 'board',
      almBuyerPriority: 70,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'presidente_junta',
    },
    {
      roleKey: 'gerente_general',
      unitKey: 'gerencia_general',
      titleEs: 'Gerente General',
      titleEn: 'General Manager / CEO',
      decisionTier: 'executive',
      almBuyerPriority: 90,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'presidente_junta',
    },
    {
      roleKey: 'cfo',
      unitKey: 'finanzas',
      titleEs: 'Chief Financial Officer (CFO)',
      titleEn: 'Chief Financial Officer',
      decisionTier: 'executive',
      almBuyerPriority: 100,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'gerente_financiero',
      unitKey: 'finanzas',
      titleEs: 'Gerente Financiero(a)',
      titleEn: 'Finance Manager',
      decisionTier: 'executive',
      almBuyerPriority: 95,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'director_financiero',
      unitKey: 'finanzas',
      titleEs: 'Director(a) Financiero(a)',
      titleEn: 'Director of Finance',
      decisionTier: 'executive',
      almBuyerPriority: 92,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'controller',
      unitKey: 'finanzas',
      titleEs: 'Controller / Contralor(a)',
      titleEn: 'Controller',
      decisionTier: 'operational',
      almBuyerPriority: 80,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'cfo',
    },
    {
      roleKey: 'tesorero_operaciones',
      unitKey: 'finanzas',
      titleEs: 'Tesorero(a)',
      titleEn: 'Treasurer',
      decisionTier: 'operational',
      almBuyerPriority: 78,
      isPrimaryBuyerCandidate: false,
      reportsToRoleKey: 'cfo',
    },
    {
      roleKey: 'oficial_cumplimiento',
      unitKey: 'riesgos_cumplimiento',
      titleEs: 'Oficial de Cumplimiento',
      titleEn: 'Compliance Officer',
      decisionTier: 'executive',
      almBuyerPriority: 85,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'oficial_riesgos',
      unitKey: 'riesgos_cumplimiento',
      titleEs: 'Oficial de Riesgos',
      titleEn: 'Chief Risk Officer',
      decisionTier: 'executive',
      almBuyerPriority: 88,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'presidente_alco',
      unitKey: 'alco',
      titleEs: 'Presidente(a) del Comité ALCO',
      titleEn: 'ALCO Chair',
      decisionTier: 'committee',
      almBuyerPriority: 98,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'miembro_alco_finanzas',
      unitKey: 'alco',
      titleEs: 'Miembro ALCO (Finanzas)',
      titleEn: 'ALCO Member (Finance)',
      decisionTier: 'committee',
      almBuyerPriority: 90,
      isPrimaryBuyerCandidate: true,
      reportsToRoleKey: 'presidente_alco',
    },
    {
      roleKey: 'auditor_interno',
      unitKey: 'auditoria',
      titleEs: 'Auditor(a) Interno(a)',
      titleEn: 'Internal Auditor',
      decisionTier: 'operational',
      almBuyerPriority: 65,
      isPrimaryBuyerCandidate: false,
      reportsToRoleKey: 'junta_directiva',
    },
    {
      roleKey: 'vp_operaciones',
      unitKey: 'operaciones',
      titleEs: 'Vicepresidente(a) de Operaciones',
      titleEn: 'VP Operations',
      decisionTier: 'executive',
      almBuyerPriority: 55,
      isPrimaryBuyerCandidate: false,
      reportsToRoleKey: 'gerente_general',
    },
    {
      roleKey: 'director_tecnologia',
      unitKey: 'tecnologia',
      titleEs: 'Director(a) de Tecnología',
      titleEn: 'Chief Technology Officer',
      decisionTier: 'executive',
      almBuyerPriority: 50,
      isPrimaryBuyerCandidate: false,
      reportsToRoleKey: 'gerente_general',
    },
  ];

/** Map CSV seed contact_role strings to canonical role keys */
export const CSV_CONTACT_ROLE_TO_ROLE_KEY: Record<string, string> = {
  CFO: 'cfo',
  'VP Finanzas': 'gerente_financiero',
  'Gerente Financiero': 'gerente_financiero',
  'Director Financiero': 'director_financiero',
  'Gerente General': 'gerente_general',
  Presidente: 'gerente_general',
};

export function resolvePrimaryRoleKey(
  contactRole: string | null | undefined,
): string {
  if (!contactRole) return 'cfo';
  return CSV_CONTACT_ROLE_TO_ROLE_KEY[contactRole] ?? 'cfo';
}

export function slugifyCooperativaName(name: string): string {
  return name
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/cooperativa de ahorro y credito (de )?/g, '')
    .replace(/[^a-z0-9\s-]/g, '')
    .trim()
    .replace(/\s+/g, '-')
    .replace(/-+/g, '-');
}

export function extractMunicipality(
  location: string | null | undefined,
): string | null {
  if (!location) return null;
  const match = location.match(/^([^,]+)/);
  return match?.[1]?.trim() ?? null;
}
