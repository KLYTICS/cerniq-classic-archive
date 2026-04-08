export type FeatureBridgeState =
  | 'healthy'
  | 'warning'
  | 'critical'
  | 'inactive';

export type OperatorActionKind =
  | 'refresh_intelligence'
  | 'open_portal_cycle'
  | 'sweep_demo_seats'
  | 'run_pipeline'
  | 'force_regenerate_job'
  | 'run_health_checks'
  | 'refresh_session_snapshot';

export interface FeatureBridgeStatus {
  key: string;
  label: string;
  state: FeatureBridgeState;
  summary: string;
  deepLink: string;
  actionKind?: OperatorActionKind;
  metric?: number;
}

export interface OperatorAction {
  kind: OperatorActionKind;
  label: string;
  description: string;
  requiresTarget?: boolean;
  targetLabel?: string;
}

export interface OperatorActionResult {
  kind: OperatorActionKind;
  ok: boolean;
  title: string;
  summary: string;
  data?: Record<string, unknown> | null;
}

export interface SessionContinuitySnapshot {
  workspaceRoot: string;
  branch: string | null;
  latestStatusDate: string | null;
  latestStatusSummary: string[];
  blockers: string[];
  nextCommands: string[];
  sessionHandoffExcerpt: string | null;
  omxStateFiles: string[];
  omxLogFiles: string[];
}

export interface ControlTowerSummary {
  generatedAt: string;
  overview: {
    demoRequests: number;
    institutions: number;
    users: number;
    prospects: number;
    activeSubscriptions: number;
    totalSubscriptions: number;
    mrr: number;
    arr: number;
  };
  blockers: Array<{
    id: string;
    severity: 'warning' | 'critical';
    title: string;
    summary: string;
    deepLink?: string;
    actionKind?: OperatorActionKind;
    targetId?: string | null;
  }>;
  pipeline: {
    health: {
      awaitingData: number;
      processing: number;
      complete: number;
      failed: number;
    };
    recentJobs: Array<{
      id: string;
      institutionName: string;
      status: string;
      createdAt: string;
      errorMessage: string | null;
      userId: string;
      userEmail: string | null;
    }>;
  };
  portal: {
    awaitingData: number;
    validationFailed: number;
    processing: number;
    stalledCycles: Array<{
      id: string;
      institutionName: string;
      status: string;
      createdAt: string;
      userId: string;
      userEmail: string | null;
    }>;
  };
  demoSeats: {
    active: number;
    expired: number;
    converted: number;
    expiringSoon: number;
  };
  intelligence: {
    staleAccounts: number;
    overdueActions: number;
    hotChanges: number;
    recentRuns: number;
    handoffSummary: string | null;
  };
  continuity: SessionContinuitySnapshot;
  features: FeatureBridgeStatus[];
  actions: OperatorAction[];
}
