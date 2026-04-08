/**
 * Close Cockpit API client.
 *
 * Uses fetch instead of axios to keep this module zero-dependency and easy
 * to use from server components later. Mirrors the public surface of the
 * NestJS CloseController in backend-node/src/close.
 */

import { getPublicApiBase } from './api-base';

const API_BASE = getPublicApiBase();

export type CloseCycleStatus = 'OPEN' | 'IN_REVIEW' | 'SIGNED_OFF' | 'REOPENED';
export type CloseTaskStatus = 'PENDING' | 'IN_PROGRESS' | 'BLOCKED' | 'REVIEW' | 'DONE' | 'WAIVED';
export type ReconciliationStatus = 'OPEN' | 'TIE' | 'EXCEPTION' | 'REVIEWED' | 'SIGNED_OFF';
export type ReconciliationType =
  | 'BANK'
  | 'AP_SUBLEDGER'
  | 'AR_SUBLEDGER'
  | 'INTERCOMPANY'
  | 'PREPAID'
  | 'ACCRUAL'
  | 'FIXED_ASSET';

export interface CloseTask {
  id: string;
  kind: string;
  titleEn: string;
  titleEs: string;
  ownerId: string | null;
  dueAt: string | null;
  status: CloseTaskStatus;
  blockedByIds: string[];
  evidenceUrls: string[];
  completedAt: string | null;
}

export interface CloseReconciliation {
  id: string;
  account: string;
  reconType: ReconciliationType;
  glBalance: string | number;
  externalBalance: string | number;
  difference: string | number;
  unmatchedItems: unknown;
  status: ReconciliationStatus;
}

export interface CloseJournalEntry {
  id: string;
  reference: string;
  memoEn: string;
  memoEs: string;
  totalDebit: string | number;
  totalCredit: string | number;
  status: string;
  lines: unknown;
  evidenceUrls: string[];
  /** Set on a reversal JE — points back to the original it offsets. */
  reversesJeId?: string | null;
}

export interface CloseFluxNarrative {
  id: string;
  account: string;
  priorBalance: string | number;
  currentBalance: string | number;
  varianceAbs: string | number;
  variancePct: number;
  isMaterial: boolean;
  narrativeEn: string;
  narrativeEs: string;
  confidence: number;
}

export interface CloseCycleSummary {
  id: string;
  organizationId: string;
  periodYear: number;
  periodMonth: number;
  status: CloseCycleStatus;
  openedAt: string;
  targetCloseAt: string | null;
  closedAt: string | null;
  materialityAbs: string | number;
  materialityPct: number;
  _count?: { tasks: number; reconciliations: number; journalEntries: number };
}

export interface CloseCycleDetail extends CloseCycleSummary {
  tasks: CloseTask[];
  reconciliations: CloseReconciliation[];
  journalEntries: CloseJournalEntry[];
  fluxNarratives: CloseFluxNarrative[];
}

async function jfetch<T>(path: string, init?: RequestInit): Promise<T> {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: { 'Content-Type': 'application/json', ...(init?.headers ?? {}) },
    ...init,
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`close-api ${res.status}: ${text || res.statusText}`);
  }
  return (await res.json()) as T;
}

export const closeApi = {
  listCycles: (orgId: string) =>
    jfetch<CloseCycleSummary[]>(`/api/close/${orgId}/cycles`),

  createCycle: (orgId: string, periodYear: number, periodMonth: number, targetCloseAt?: string) =>
    jfetch<CloseCycleDetail>(`/api/close/${orgId}/cycles`, {
      method: 'POST',
      body: JSON.stringify({ periodYear, periodMonth, targetCloseAt }),
    }),

  getCycle: (cycleId: string) =>
    jfetch<CloseCycleDetail>(`/api/close/cycles/${cycleId}`),

  signOff: (cycleId: string) =>
    jfetch<CloseCycleSummary>(`/api/close/cycles/${cycleId}/sign-off`, { method: 'POST' }),

  reopen: (cycleId: string, reason: string) =>
    jfetch<CloseCycleSummary>(`/api/close/cycles/${cycleId}/reopen`, {
      method: 'POST',
      body: JSON.stringify({ reason }),
    }),

  updateTask: (
    cycleId: string,
    taskId: string,
    body: {
      status?: CloseTaskStatus;
      ownerId?: string;
      dueAt?: string;
      evidenceUrls?: string[];
    },
  ) =>
    jfetch<{ task: CloseTask; cascadedTaskIds: string[] }>(
      `/api/close/cycles/${cycleId}/tasks/${taskId}`,
      { method: 'PATCH', body: JSON.stringify(body) },
    ),

  runTieOut: (
    cycleId: string,
    body: {
      account: string;
      reconType: ReconciliationType;
      glBalance: number;
      externalBalance: number;
      lines: Array<{ description: string; amount: number; side: 'gl' | 'ext' }>;
    },
  ) =>
    jfetch<CloseReconciliation>(`/api/close/cycles/${cycleId}/tie-out`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reviewReconciliation: (cycleId: string, reconId: string, notes?: string) =>
    jfetch<CloseReconciliation>(
      `/api/close/cycles/${cycleId}/reconciliations/${reconId}/review`,
      {
        method: 'PATCH',
        body: JSON.stringify({ notes }),
      },
    ),

  postJournalEntry: (
    cycleId: string,
    body: {
      reference: string;
      memoEn: string;
      memoEs: string;
      lines: Array<{ account: string; debit: number; credit: number; dimension?: string }>;
      evidenceUrls?: string[];
    },
  ) =>
    jfetch<CloseJournalEntry>(`/api/close/cycles/${cycleId}/journal-entries`, {
      method: 'POST',
      body: JSON.stringify(body),
    }),

  reverseJournalEntry: (cycleId: string, jeId: string, reason: string) =>
    jfetch<{ reversalJe: CloseJournalEntry; originalReference: string }>(
      `/api/close/cycles/${cycleId}/journal-entries/${jeId}/reverse`,
      {
        method: 'POST',
        body: JSON.stringify({ reason }),
      },
    ),

  runFlux: (
    cycleId: string,
    rows: Array<{ account: string; priorBalance: number; currentBalance: number }>,
  ) =>
    jfetch<CloseFluxNarrative[]>(`/api/close/cycles/${cycleId}/flux`, {
      method: 'POST',
      body: JSON.stringify({ rows }),
    }),

  binder: (cycleId: string) =>
    jfetch<unknown>(`/api/close/cycles/${cycleId}/binder`),

  listActivity: (cycleId: string, limit?: number) =>
    jfetch<CloseActivity[]>(
      `/api/close/cycles/${cycleId}/activity${limit != null ? `?limit=${limit}` : ''}`,
    ),

  // ── GL integration ────────────────────────────────────────────────

  getGlBalance: (orgId: string, account: string, periodYear: number, periodMonth: number) =>
    jfetch<GlBalance>(
      `/api/close/${orgId}/gl-balance?account=${encodeURIComponent(account)}&periodYear=${periodYear}&periodMonth=${periodMonth}`,
    ),

  listGlAccounts: (orgId: string, periodYear: number, periodMonth: number) =>
    jfetch<GlAccountBalance[]>(
      `/api/close/${orgId}/gl-accounts?periodYear=${periodYear}&periodMonth=${periodMonth}`,
    ),

  uploadGlCsv: async (orgId: string, file: File): Promise<GlUploadResult> => {
    const form = new FormData();
    form.append('file', file);
    const res = await fetch(`${API_BASE}/api/close/${orgId}/gl-upload`, {
      method: 'POST',
      credentials: 'include',
      body: form,
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(`close-api ${res.status}: ${text || res.statusText}`);
    }
    return (await res.json()) as GlUploadResult;
  },

  listGlSnapshots: (orgId: string, periodYear: number, periodMonth: number) =>
    jfetch<GlSnapshotRow[]>(
      `/api/close/${orgId}/gl-snapshots?periodYear=${periodYear}&periodMonth=${periodMonth}`,
    ),

  deleteGlSnapshot: (orgId: string, snapshotId: string) =>
    jfetch<{ deleted: boolean }>(`/api/close/${orgId}/gl-snapshots/${snapshotId}`, {
      method: 'DELETE',
    }),
};

export interface GlSnapshotRow {
  id: string;
  account: string;
  balance: number;
  sourceLabel: string | null;
  uploadedById: string | null;
  notes: string | null;
  updatedAt: string;
}

export interface GlUploadError {
  rowNumber: number;
  message: string;
}

export interface GlUploadResult {
  inserted: number;
  updated: number;
  errored: number;
  errors: GlUploadError[];
  rows: number;
  source: string;
}

export type GlSource = 'snapshot' | 'alm' | 'demo';

export interface GlBalance {
  account: string;
  balance: number;
  source: GlSource;
}

export interface GlAccountBalance {
  account: string;
  priorBalance: number;
  currentBalance: number;
  source: GlSource;
}

export type CloseActivityKind =
  | 'CYCLE_OPENED'
  | 'CYCLE_SIGNED_OFF'
  | 'CYCLE_REOPENED'
  | 'TASK_UPDATED'
  | 'TASK_COMPLETED'
  | 'TASK_WAIVED'
  | 'TASK_CASCADED_UNBLOCK'
  | 'TIE_OUT_RUN'
  | 'JE_POSTED'
  | 'JE_REVERSED'
  | 'FLUX_REFRESHED'
  | 'GL_UPLOADED'
  | 'RECON_REVIEWED';

export interface CloseActivity {
  id: string;
  cycleId: string;
  actorId: string | null;
  kind: CloseActivityKind;
  summaryEn: string;
  summaryEs: string;
  payload: Record<string, unknown>;
  createdAt: string;
}
