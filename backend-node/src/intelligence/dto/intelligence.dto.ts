import {
  IsArray,
  IsBoolean,
  IsNumber,
  IsObject,
  IsOptional,
  IsString,
  IsUrl,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';
import { IsEnum } from 'class-validator';

export const IntelligenceAccountKindValues = {
  COMPETITOR: 'COMPETITOR',
  BUYER: 'BUYER',
} as const;
export type IntelligenceAccountKind =
  (typeof IntelligenceAccountKindValues)[keyof typeof IntelligenceAccountKindValues];

export const IntelligenceActionStatusValues = {
  OPEN: 'OPEN',
  IN_PROGRESS: 'IN_PROGRESS',
  DONE: 'DONE',
  DISMISSED: 'DISMISSED',
} as const;
export type IntelligenceActionStatus =
  (typeof IntelligenceActionStatusValues)[keyof typeof IntelligenceActionStatusValues];

export const IntelligenceArtifactTypeValues = {
  WEEKLY_BRIEF: 'WEEKLY_BRIEF',
  COMPETITOR_TEAR_SHEET: 'COMPETITOR_TEAR_SHEET',
  BUYER_DOSSIER: 'BUYER_DOSSIER',
  ACCOUNT_EXPORT: 'ACCOUNT_EXPORT',
  ACTION_EXPORT: 'ACTION_EXPORT',
  HANDOFF_REPORT: 'HANDOFF_REPORT',
} as const;
export type IntelligenceArtifactType =
  (typeof IntelligenceArtifactTypeValues)[keyof typeof IntelligenceArtifactTypeValues];

export const IntelligenceInsightSeverityValues = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type IntelligenceInsightSeverity =
  (typeof IntelligenceInsightSeverityValues)[keyof typeof IntelligenceInsightSeverityValues];

export const IntelligenceInsightTypeValues = {
  PRICING_CHANGE: 'PRICING_CHANGE',
  HIRING_SIGNAL: 'HIRING_SIGNAL',
  REGULATORY_SIGNAL: 'REGULATORY_SIGNAL',
  PRODUCT_SIGNAL: 'PRODUCT_SIGNAL',
  URGENCY_SIGNAL: 'URGENCY_SIGNAL',
  THREAT_SIGNAL: 'THREAT_SIGNAL',
  CONTACT_SIGNAL: 'CONTACT_SIGNAL',
  REFRESH_NOTE: 'REFRESH_NOTE',
} as const;
export type IntelligenceInsightType =
  (typeof IntelligenceInsightTypeValues)[keyof typeof IntelligenceInsightTypeValues];

export const IntelligenceSourceFetchPolicyValues = {
  MANUAL: 'MANUAL',
  DAILY: 'DAILY',
  WEEKLY: 'WEEKLY',
  MONTHLY: 'MONTHLY',
} as const;
export type IntelligenceSourceFetchPolicy =
  (typeof IntelligenceSourceFetchPolicyValues)[keyof typeof IntelligenceSourceFetchPolicyValues];

export const IntelligenceSourceTrustLevelValues = {
  HIGH: 'HIGH',
  MEDIUM: 'MEDIUM',
  LOW: 'LOW',
} as const;
export type IntelligenceSourceTrustLevel =
  (typeof IntelligenceSourceTrustLevelValues)[keyof typeof IntelligenceSourceTrustLevelValues];

export const IntelligenceSourceTypeValues = {
  OFFICIAL_REGISTRY: 'OFFICIAL_REGISTRY',
  PUBLIC_WEBSITE: 'PUBLIC_WEBSITE',
  PRICING_PAGE: 'PRICING_PAGE',
  DOCUMENT: 'DOCUMENT',
  MANUAL_UPLOAD: 'MANUAL_UPLOAD',
  INTERNAL_NOTE: 'INTERNAL_NOTE',
  ENRICHMENT_API: 'ENRICHMENT_API',
} as const;
export type IntelligenceSourceType =
  (typeof IntelligenceSourceTypeValues)[keyof typeof IntelligenceSourceTypeValues];

export const WorkspaceMemoryEntryTypeValues = {
  HANDOFF: 'HANDOFF',
  DECISION: 'DECISION',
  NOTE: 'NOTE',
  ALERT: 'ALERT',
} as const;
export type WorkspaceMemoryEntryType =
  (typeof WorkspaceMemoryEntryTypeValues)[keyof typeof WorkspaceMemoryEntryTypeValues];

export class IntelligenceSourceInputDto {
  @IsOptional()
  @IsString()
  label?: string;

  @IsUrl({ require_tld: false })
  url!: string;

  @IsEnum(IntelligenceSourceTypeValues)
  sourceType!: IntelligenceSourceType;

  @IsOptional()
  @IsEnum(IntelligenceSourceFetchPolicyValues)
  fetchPolicy?: IntelligenceSourceFetchPolicy;

  @IsOptional()
  @IsEnum(IntelligenceSourceTrustLevelValues)
  trustLevel?: IntelligenceSourceTrustLevel;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class IntelligenceContactInputDto {
  @IsString()
  fullName!: string;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsString()
  department?: string;

  @IsOptional()
  @IsString()
  seniority?: string;

  @IsOptional()
  @IsString()
  email?: string;

  @IsOptional()
  @IsString()
  phone?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  linkedinUrl?: string;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  contactScore?: number;

  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  reachabilityScore?: number;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;
}

export class IntelligenceAccountImportDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsEnum(IntelligenceAccountKindValues)
  kind!: IntelligenceAccountKind;

  @IsString()
  name!: string;

  @IsOptional()
  @IsString()
  domain?: string;

  @IsOptional()
  @IsUrl({ require_tld: false })
  websiteUrl?: string;

  @IsOptional()
  @IsString()
  region?: string;

  @IsOptional()
  @IsString()
  country?: string;

  @IsOptional()
  @IsString()
  industry?: string;

  @IsOptional()
  @IsString()
  institutionalType?: string;

  @IsOptional()
  @IsString()
  sourceOfTruth?: string;

  @IsOptional()
  @IsString()
  currentSummary?: string;

  @IsOptional()
  @IsObject()
  metadata?: Record<string, unknown>;

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntelligenceSourceInputDto)
  sources?: IntelligenceSourceInputDto[];

  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntelligenceContactInputDto)
  contacts?: IntelligenceContactInputDto[];
}

export class IntelligenceAccountsImportRequestDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => IntelligenceAccountImportDto)
  accounts!: IntelligenceAccountImportDto[];
}

export class IntelligenceRefreshRequestDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accountIds?: string[];

  @IsOptional()
  @IsArray()
  @IsEnum(IntelligenceAccountKindValues, { each: true })
  kinds?: IntelligenceAccountKind[];

  @IsOptional()
  @IsBoolean()
  staleOnly?: boolean;

  @IsOptional()
  @IsString()
  trigger?: string;
}

export class IntelligenceReportRequestDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsEnum(IntelligenceArtifactTypeValues)
  type!: IntelligenceArtifactType;

  @IsOptional()
  @IsString()
  title?: string;

  @IsOptional()
  @IsArray()
  @IsString({ each: true })
  accountIds?: string[];

  @IsOptional()
  @IsBoolean()
  includeClosedActions?: boolean;
}

export class WorkspaceMemoryInputDto {
  @IsOptional()
  @IsString()
  workspaceId?: string;

  @IsOptional()
  @IsString()
  accountId?: string;

  @IsEnum(WorkspaceMemoryEntryTypeValues)
  type!: WorkspaceMemoryEntryType;

  @IsString()
  title!: string;

  @IsString()
  body!: string;

  @IsOptional()
  @IsBoolean()
  pinned?: boolean;
}

export interface IntelligenceAccountSummary {
  id: string;
  workspaceId: string;
  kind: IntelligenceAccountKind;
  status: string;
  name: string;
  domain: string | null;
  websiteUrl: string | null;
  currentSummary: string | null;
  freshnessScore: number;
  opportunityScore: number;
  threatScore: number;
  actionScore: number;
  lastRefreshedAt: string | null;
  nextRefreshAt: string | null;
  contactCount: number;
  openActionCount: number;
  recentInsightCount: number;
  linkedLeadId: string | null;
  linkedProspectId: string | null;
}

export interface IntelligenceContactRecord {
  id: string;
  fullName: string;
  title: string | null;
  email: string | null;
  phone: string | null;
  linkedinUrl: string | null;
  contactScore: number;
  reachabilityScore: number;
  lastVerifiedAt: string | null;
}

export interface IntelligenceInsightRecord {
  id: string;
  type: IntelligenceInsightType;
  severity: IntelligenceInsightSeverity;
  title: string;
  description: string;
  confidence: number;
  createdAt: string;
  reviewedAt: string | null;
}

export interface IntelligenceActionRecord {
  id: string;
  type: string;
  status: IntelligenceActionStatus;
  title: string;
  description: string;
  confidence: number;
  actionScore: number;
  dueAt: string | null;
  completedAt: string | null;
}

export interface WorkspaceHandoff {
  workspaceId: string;
  summary: string;
  pinnedEntries: Array<{
    id: string;
    title: string;
    type: WorkspaceMemoryEntryType;
    body: string;
    createdAt: string;
  }>;
  overdueActions: number;
  staleAccounts: number;
  latestArtifactTitle: string | null;
}
