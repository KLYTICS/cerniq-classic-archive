import type { PlatformAccessState } from './access';

export type PortalWorkflowState =
  | 'needs_report'
  | 'needs_upload'
  | 'validation_failed'
  | 'processing'
  | 'report_ready';

export const PORTAL_PROCESSING_STATUSES = [
  'VALIDATING',
  'QUEUED',
  'PROCESSING',
  'GENERATING_PDF',
  'UPLOADING',
] as const;

export interface PortalOverviewJob {
  id: string;
  institutionId: string | null;
  institutionName: string;
  status: string;
  analysisPeriod: string | null;
  previousJobId: string | null;
  submittedAt: string | null;
  processingStartedAt: string | null;
  completedAt: string | null;
  createdAt: string;
  reportUrl: string | null;
  reportUrlEn: string | null;
  reportLang: string;
  errorMessage: string | null;
  userId: string;
  triggeredBy: string;
}

export interface PortalValidationIssue {
  row?: number | null;
  field?: string | null;
  message: string;
}

export interface PortalValidationSummary {
  sourceFilename: string | null;
  status: string;
  totalRows: number;
  validRows: number;
  errorRows: number;
  importedCount: number;
  warningCount: number;
  errorCount: number;
  warnings: string[];
  errors: PortalValidationIssue[];
}

export interface PortalNextAction {
  labelEn: string;
  labelEs: string;
  href: string;
  jobId: string | null;
  explanationEn: string;
  explanationEs: string;
}

export interface PortalDemoSeatContext {
  isDemo: boolean;
  daysRemaining?: number | null;
  expiresAt?: string | null;
  seat: {
    prospectId: string;
    institutionName: string;
    publicDataSource: string | null;
    provisionedAt: string | null;
    expiresAt: string | null;
    reportJobId: string | null;
  } | null;
}

export interface PortalOverview {
  access: PlatformAccessState;
  jobs: PortalOverviewJob[];
  latestActionableJob: PortalOverviewJob | null;
  workflowState: PortalWorkflowState;
  counts: {
    total: number;
    awaitingData: number;
    validationFailed: number;
    processing: number;
    complete: number;
  };
  activation: {
    institutionId: string;
    activationScore: number;
    daysSinceSignup: number;
    isStalled: boolean;
    stalledMilestone: string | null;
    stalledMilestoneLabel: string | null;
    stalledMilestoneLabelEs: string | null;
    milestones: Array<{
      id: string;
      label: string;
      labelEs: string;
      completed: boolean;
      completedAt: string | null;
    }>;
  } | null;
  demoSeat: PortalDemoSeatContext;
  nextAction: PortalNextAction;
  validationSummary: PortalValidationSummary | null;
}

export interface PortalOpenCycleResponse {
  created: boolean;
  reopened: boolean;
  nextActionHref: string;
  job: PortalOverviewJob;
}

export function isPortalProcessingStatus(status?: string | null): boolean {
  return Boolean(
    status &&
      PORTAL_PROCESSING_STATUSES.includes(
        status as (typeof PORTAL_PROCESSING_STATUSES)[number],
      ),
  );
}

export function isPortalActionRequiredStatus(status?: string | null): boolean {
  return status === 'AWAITING_DATA' || status === 'VALIDATION_FAILED';
}
