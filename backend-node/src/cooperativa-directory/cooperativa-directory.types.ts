import type {
  CooperativaOutreach,
  CooperativaSeatContactNote,
} from './cooperativa-outreach';

export const COOPERATIVA_DIRECTORY_SCHEMA_VERSION = 'cerniq.cooperativa-directory.v1';

export type AgentBundleLeadershipSeat = {
  seatId: string;
  roleKey: string;
  titleEs: string;
  titleEn: string;
  unitKey: string | null;
  unitNameEs: string | null;
  decisionTier: string;
  almBuyerPriority: number;
  reportsToRoleKey: string | null;
  fullName: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  isPrimaryBuyer: boolean;
  isPlaceholder: boolean;
  provenance: string;
  contactNote: CooperativaSeatContactNote | null;
};

export type AgentBundleOrgUnit = {
  unitKey: string;
  nameEs: string;
  nameEn: string;
  sortOrder: number;
  leadership: AgentBundleLeadershipSeat[];
};

export type AgentBundleInstitution = {
  profileId: string;
  prospectInstitutionId: string;
  slug: string;
  name: string;
  location: string | null;
  region: string | null;
  municipality: string | null;
  estimatedAssetsUsd: number | null;
  regulator: string;
  structureVersion: string;
  cossecSlug: string | null;
  outreach: CooperativaOutreach;
  orgUnits: AgentBundleOrgUnit[];
  primaryBuyers: AgentBundleLeadershipSeat[];
  leadershipFlat: AgentBundleLeadershipSeat[];
};

export type CooperativaAgentBundle = {
  schemaVersion: typeof COOPERATIVA_DIRECTORY_SCHEMA_VERSION;
  generatedAt: string;
  institutionCount: number;
  leadershipSeatCount: number;
  institutions: AgentBundleInstitution[];
};
