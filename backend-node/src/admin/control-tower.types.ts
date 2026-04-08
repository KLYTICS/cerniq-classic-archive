export type FeatureBridgeState = 'healthy' | 'warning' | 'active';

export type OperatorActionKind =
  | 'refresh_intelligence'
  | 'open_portal_cycle'
  | 'sweep_demo_seats'
  | 'run_pipeline'
  | 'retry_pipeline_job'
  | 'refresh_session_snapshot';

export interface OperatorActionRequest {
  action: OperatorActionKind;
  userId?: string;
  jobId?: string;
}

export interface OperatorAction {
  action: OperatorActionKind;
  label: string;
  description: string;
}

export interface OperatorActionResult {
  action: OperatorActionKind;
  status: 'success' | 'error';
  summary: string;
  message?: string;
  data?: unknown;
}

export interface FeatureBridgeStatus {
  id: string;
  label: string;
  status: FeatureBridgeState;
  href: string;
  detail: string;
  metricLabel: string;
  metricValue: number;
  nextActionLabel: string;
}

export interface SessionContinuitySnapshot {
  workspaceRoot: string;
  branch: string;
  dirtyFiles: number;
  latestSessionSummary: string[];
  latestHandoffObjective: string | null;
  blockers: string[];
  nextCommands: string[];
  activeSkill: string | null;
  activeSkillPhase: string | null;
  recentAgentTurns: number;
  lastHudTitle: string | null;
  omxStateFiles: Array<{
    file: string;
    updatedAt: string;
  }>;
}

export interface RawSessionContinuitySnapshot {
  workspaceRoot: string;
  activeBranch: string | null;
  latestStatusSummary: string[];
  latestStatusBlockers: string[];
  lastAgentOutputTitle: string | null;
  handoffUpdatedAt: string | null;
  latestStatusUpdatedAt: string | null;
  activeModes: string[];
  stateFiles: string[];
  metrics: {
    turnCount: number | null;
    lastTurnAt: string | null;
  } | null;
  recommendedCommands: string[];
}

export interface ControlTowerSummary {
  generatedAt: string;
  executive: {
    demoRequests: number;
    institutions: number;
    users: number;
    prospects: number;
    recentUsers: number;
    activeSubscriptions: number;
    totalSubscriptions: number;
    totalReportJobs: number;
    completedReports: number;
    failedReports: number;
    mrr: number;
    arr: number;
  };
  health: {
    api: string;
    database: string;
    uptimeSeconds: number;
    memoryPercent: number;
    timestamp: string;
  };
  stats: {
    demoRequests: number;
    institutions: number;
    users: number;
    prospects: number;
    recentUsers: number;
    totalReportJobs: number;
    completedReports: number;
    failedReports: number;
  };
  revenue: {
    activeSubscriptions: number;
    totalSubscriptions: number;
    mrr: number;
    arr: number;
  };
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
      retryCount: number;
      createdAt: Date | string;
      completedAt: Date | string | null;
      errorMessage: string | null;
      triggeredBy: string;
      user?: { email?: string | null; name?: string | null };
    }>;
  };
  portal: {
    counts: {
      awaitingData: number;
      validationFailed: number;
      processing: number;
      complete: number;
      failed: number;
      stalledActivations: number;
    };
    stalledJobs: Array<{
      id: string;
      userId: string;
      institutionName: string;
      status: string;
      errorMessage: string | null;
      createdAt: Date | string;
      user?: { email?: string | null; name?: string | null };
    }>;
    recentActionableJobs: Array<{
      id: string;
      userId: string;
      institutionName: string;
      status: string;
      errorMessage: string | null;
      createdAt: Date | string;
      user?: { email?: string | null; name?: string | null };
    }>;
  };
  exports: {
    completedJobs: number;
    onDemandFallbackJobs: number;
    readyManifestCount: number;
    degradedCount: number;
  };
  demoSeats: {
    active: number;
    expired: number;
    expiringSoon: number;
    recent: Array<Record<string, unknown>>;
  };
  intelligence: {
    workspace: { id: string; name: string };
    stats: {
      totalAccounts: number;
      buyers: number;
      competitors: number;
      staleAccounts: number;
      overdueActions: number;
    };
    hotChanges: Array<Record<string, unknown>>;
    staleAccounts: Array<Record<string, unknown>>;
    actions: Array<Record<string, unknown>>;
    recentRuns: Array<Record<string, unknown>>;
    recentArtifacts: Array<Record<string, unknown>>;
    handoff: {
      summary: string;
      pinnedEntries: Array<Record<string, unknown>>;
    };
  };
  continuity: SessionContinuitySnapshot;
  sessionContinuity: RawSessionContinuitySnapshot;
  featureBridge: FeatureBridgeStatus[];
  nextActions: Array<{
    id: string;
    title: string;
    domain: string;
    severity: string;
    href?: string;
    action?: OperatorActionKind;
  }>;
  blockers: Array<{
    key: string;
    severity: 'high' | 'medium';
    title: string;
    description: string;
    href?: string;
    actionKey?: OperatorActionKind;
    targetId?: string | null;
  }>;
  recommendedActions: Array<{
    key: OperatorActionKind;
    label: string;
    description: string;
    tone: string;
  }>;
  safeActions: OperatorAction[];
}
