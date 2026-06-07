import axios, { AxiosInstance } from 'axios';
import { getMarketApiBase } from './marketTransport';
import { getPublicApiBase, getPublicApiUrl } from './api-base';
import { asRecord, unwrapApiData } from './api-response';
import { ACCESS_REQUIRED_ROUTE } from './access';
import { getStoredAdminKey } from './admin-session';
import { buildLoginUrlForReturnUrl } from './auth-redirect';

declare module 'axios' {
  interface AxiosRequestConfig {
    _retry401?: boolean;
    skipAuthRedirect?: boolean;
  }

  interface InternalAxiosRequestConfig {
    _retry401?: boolean;
    skipAuthRedirect?: boolean;
  }
}

const API_URL = getPublicApiBase();
const NODE_API_URL = getPublicApiBase();
const ACCESS_TOKEN_KEY = 'cerniq_access_token';
const LEGACY_ACCESS_TOKEN_KEY = 'capex_access_token';
const MARKET_API_BASE = getMarketApiBase();
const REFRESH_ENDPOINT = '/api/auth/refresh';
export const APP_NAVIGATION_EVENT = 'cerniq:navigate';

type AppNavigationDetail = {
  href: string;
  replace?: boolean;
};

export type PortalExportStatus =
  | 'not_applicable'
  | 'ready'
  | 'partial'
  | 'missing';

export type PortalExportSummary = {
  manifestPath: string;
  status: PortalExportStatus;
  readyCount: number;
  totalCount: number;
  readyReportLanguages: Array<'en' | 'es'>;
  missingReportLanguages: Array<'en' | 'es'>;
  readyBoardPackLanguages: Array<'en' | 'es'>;
  missingBoardPackLanguages: Array<'en' | 'es'>;
};

export type PortalOverviewJob = {
  id: string;
  institutionId?: string | null;
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
  exportSummary?: PortalExportSummary | null;
};

export type PortalOverview = {
  jobs: PortalOverviewJob[];
  latestActionableJob: PortalOverviewJob | null;
  workflowState: string;
  counts: {
    total: number;
    awaitingData: number;
    validationFailed: number;
    processing: number;
    complete: number;
  };
  demoSeat: unknown;
  nextAction: {
    labelEn: string;
    labelEs: string;
    href: string;
    jobId: string | null;
    explanationEn: string;
    explanationEs: string;
  };
  validationSummary: unknown;
};

function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

export function getAccessToken(): string {
  if (typeof window === 'undefined') {
    return '';
  }

  const sessionToken = sessionStorage.getItem(ACCESS_TOKEN_KEY);
  if (sessionToken) {
    return sessionToken;
  }

  // Migrate legacy capex_ token to cerniq_ key
  const legacySession = sessionStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || '';
  if (legacySession) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, legacySession);
    sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    return legacySession;
  }

  // Migrate any legacy persisted token to session scope.
  const legacyToken = localStorage.getItem(LEGACY_ACCESS_TOKEN_KEY) || localStorage.getItem(ACCESS_TOKEN_KEY) || '';
  if (legacyToken) {
    sessionStorage.setItem(ACCESS_TOKEN_KEY, legacyToken);
    localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
    localStorage.removeItem(ACCESS_TOKEN_KEY);
  }
  return legacyToken;
}

function setAccessToken(token: string): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.setItem(ACCESS_TOKEN_KEY, token);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
}

function clearAccessToken(): void {
  if (typeof window === 'undefined') {
    return;
  }
  sessionStorage.removeItem(ACCESS_TOKEN_KEY);
  sessionStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
  localStorage.removeItem(ACCESS_TOKEN_KEY);
  localStorage.removeItem(LEGACY_ACCESS_TOKEN_KEY);
}

function getResponseStatus(error: unknown): number | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as { response?: { status?: number } }).response?.status === 'number'
  ) {
    return (error as { response: { status: number } }).response.status;
  }

  return undefined;
}

function getResponseCode(error: unknown): string | undefined {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error
  ) {
    const data = (error as {
      response?: { data?: { code?: string; error?: { code?: string } } };
    }).response?.data;
    if (typeof data?.code === 'string') {
      return data.code;
    }
    if (typeof data?.error?.code === 'string') {
      return data.error.code;
    }
  }

  return undefined;
}

export function isAuthError(error: unknown): boolean {
  const status = getResponseStatus(error);
  return status === 401;
}

export function isPlatformAccessError(error: unknown): boolean {
  return (
    getResponseStatus(error) === 403 &&
    getResponseCode(error) === 'PLATFORM_ACCESS_REQUIRED'
  );
}

export function getApiErrorMessage(error: unknown, fallback: string): string {
  if (
    typeof error === 'object' &&
    error !== null &&
    'response' in error &&
    typeof (error as {
      response?: {
        data?: {
          error?: string | { message?: string; detail?: string };
          message?: string;
          detail?: string;
        };
      };
    }).response === 'object'
  ) {
    const data = (error as {
      response?: {
        data?: {
          error?: string | { message?: string; detail?: string };
          message?: string;
          detail?: string;
        };
      };
    }).response?.data;
    if (typeof data?.error === 'string' && data.error.trim()) {
      return data.error;
    }
    if (
      typeof data?.error === 'object' &&
      data.error !== null &&
      typeof data.error.message === 'string' &&
      data.error.message.trim()
    ) {
      return data.error.message;
    }
    if (typeof data?.message === 'string' && data.message.trim()) {
      return data.message;
    }
    if (typeof data?.detail === 'string' && data.detail.trim()) {
      return data.detail;
    }
  }

  if (error instanceof Error && error.message.trim()) {
    return error.message;
  }

  return fallback;
}

export interface DemoRequestSubmissionResult {
  leadId: string | null;
  demoRequestId: string | null;
  institutionName: string;
  institutionType: string;
  message: string;
  duplicateLead: boolean;
}

export function buildLoginRedirectUrl(pathname: string, search = ''): string {
  return buildLoginUrlForReturnUrl(`${pathname}${search}`);
}

function requestAppNavigation(detail: AppNavigationDetail) {
  if (typeof window === 'undefined') {
    return;
  }

  window.dispatchEvent(
    new CustomEvent<AppNavigationDetail>(APP_NAVIGATION_EVENT, {
      detail,
    }),
  );
}

export interface ManagedApiKey {
  id: string;
  name: string;
  keyPrefix: string;
  createdAt: string;
  lastUsedAt?: string | null;
  revokedAt?: string | null;
  expiresAt?: string | null;
}

// SpendCheck AP Analysis types
export interface APFinding {
  id: string;
  type: string;
  vendor: string;
  explanation: string;
  explanationEs?: string;
  estimatedRecovery: number;
  severity: 'HIGH' | 'MEDIUM' | 'LOW';
  invoiceIds?: string[];
  recommendedActions?: string[];
  status?: 'open' | 'reviewed' | 'dismissed';
}

export interface APVendorStat {
  name: string;
  quarterlySpend: number;
  percentOfTotal: number;
  invoiceCount: number;
  avgInvoice: number;
  riskLevel: 'low' | 'medium' | 'high';
}

export interface APAnalysisResult {
  healthScore: number;
  totalSpendAnalyzed: number;
  totalFindings: number;
  potentialRecovery: number;
  recoveredAmount: number;
  findings: APFinding[];
  vendorStats: APVendorStat[];
  severityBreakdown: { high: number; medium: number; low: number };
  topVendor: { name: string; percentOfTotal: number };
  apRiskScore: number;
}

export interface ExpenseUploadSummary {
  totalRows: number;
  validRows: number;
  errorRows: number;
  totalAmount: number;
  uniqueVendors: number;
  dateRange: { from: string; to: string } | null;
}

export interface ExpenseUploadError {
  row?: number;
  message: string;
  [key: string]: unknown;
}

export interface ExpenseUploadResult {
  ingested: number;
  orgId: string;
  errors: ExpenseUploadError[];
  warnings: string[];
  summary: ExpenseUploadSummary;
  analysisTriggered: boolean;
}

export interface StressScenarioParams {
  rateShockBps: number;
  depositRunoffPct: number;
  defaultRateIncreasePct: number;
  energyCostShockPct: number;
}

export type StressScenarioVerdict = 'RESILIENT' | 'ADEQUATE' | 'VULNERABLE' | 'CRITICAL';

export interface StressScenarioResult {
  nimImpactBps: number;
  nimBefore: number;
  nimAfter: number;
  lcrBefore: number;
  lcrAfter: number;
  capitalBefore: number;
  capitalAfter: number;
  examReadinessBefore: number;
  examReadinessAfter: number;
  verdict: StressScenarioVerdict;
  narrative: string;
  narrativeEs: string;
}

export interface DemoSeatAnalytics {
  generatedAt: string;
  totals: {
    provisioned: number;
    active: number;
    expired: number;
    converted: number;
    viewedAtLeastOnce: number;
  };
  rates: {
    conversionRatePct: number;
    viewRatePct: number;
  };
  revenue: {
    allTimeUsd: number;
    thisMonthUsd: number;
  };
  velocity: {
    provisionedLast7Days: number;
    convertedLast7Days: number;
    avgDaysToConvert: number | null;
  };
  thisMonthConverted: number;
  topConvertingSnapshots: Array<{
    identifier: string;
    source: string;
    converted: number;
    revenueUsd: number;
  }>;
}

export interface AdminRevenueMetrics {
  revenueToday: number;
  revenueMonth: number;
  revenueYear: number;
  mrr: number;
  arr: number;
  activeSubscriptions: number;
  totalSubscriptions: number;
}

export interface AdminPipelineHealth {
  awaitingData: number;
  processing: number;
  complete: number;
  failed: number;
}

export interface AdminPipelineJob {
  id: string;
  institutionName: string;
  status: string;
  retryCount: number;
  createdAt: string;
  completedAt?: string;
  errorMessage?: string;
  user?: { email: string; name: string };
}

export interface AdminPipelineSnapshot {
  jobs: AdminPipelineJob[];
  health: AdminPipelineHealth;
}

export interface AdminOpsSnapshot {
  recentJobs: Array<{
    id: string;
    institutionName: string;
    status: string;
    createdAt: string;
    completedAt: string | null;
    errorMessage: string | null;
    triggeredBy: string;
  }>;
  activeSubscriptions: number;
  totalAnalysisRuns: number;
  performanceMetrics: Array<Record<string, unknown>>;
}

export interface AdminAuditEntry {
  id: string;
  userId: string | null;
  action: string;
  resource: string;
  outcome: string;
  metadata: Record<string, unknown> | null;
  ipAddress: string | null;
  createdAt: string;
}

export interface IntelligenceAccountSummary {
  accountId: string;
  prospectId: string | null;
  name: string;
  status: string;
  institutionalType: string | null;
  location: string | null;
  estimatedAssets: number | null;
  freshnessScore: number;
  opportunityScore: number;
  actionScore: number;
  sourceCount: number;
  openActionCount: number;
  latestSnapshotAt: string | null;
  latestArtifactTitle: string | null;
  linkedLeadStatus: string | null;
  topInsight: {
    title: string;
    severity: string;
    type: string;
  } | null;
}

export interface ProspectDossierDetail {
  account: {
    id: string;
    name: string;
    status: string;
    kind: string;
    institutionalType: string | null;
    sourceOfTruth: string | null;
    freshnessScore: number;
    opportunityScore: number;
    threatScore: number;
    actionScore: number;
    lastRefreshedAt: string | null;
    lastChangedAt: string | null;
    nextRefreshAt: string | null;
    currentSummary: string | null;
    metadata?: Record<string, unknown> | null;
  };
  prospect: Record<string, unknown> | null;
  linkedLeads: Array<Record<string, unknown>>;
  sources: Array<Record<string, unknown>>;
  snapshots: Array<Record<string, unknown>>;
  latestSnapshot: Record<string, unknown> | null;
  insights: Array<Record<string, unknown>>;
  actions: Array<Record<string, unknown>>;
  artifacts: Array<Record<string, unknown>>;
  memoryEntries: Array<Record<string, unknown>>;
}

export interface SavedStressScenario {
  id: string;
  name: string;
  description?: string;
  scenarioType: string;
  parameters: StressScenarioParams;
  results: StressScenarioResult | null;
  tags: string[];
  createdAt: string;
}

export interface ScenarioListResponse {
  items: SavedStressScenario[];
  page?: number;
  total?: number;
  totalPages?: number;
}

export interface ScenarioComparisonRow {
  metric: string;
  key: string;
  higherIsBetter: boolean;
  values: Array<number | null>;
  best: number | null;
  worst: number | null;
}

export interface ScenarioComparisonResponse {
  scenarios: SavedStressScenario[];
  comparison: {
    rows: ScenarioComparisonRow[];
    verdicts: string[];
  };
}

interface AuthUser {
  id: string;
  email: string;
  name?: string;
  workspaceId?: string;
}

interface PortalCycleResponse {
  jobId: string;
  institutionId: string | null;
  institutionName: string | null;
  status: string;
  nextHref: string;
}

interface AuthResponse {
  access_token?: string;
  user?: AuthUser;
  [key: string]: unknown;
}

type JsonObject = Record<string, unknown>;
type JsonObjectArray = JsonObject[];

interface PortfolioPositionInput {
  ticker: string;
  quantity: number | string;
  price?: number | string;
  currentPrice?: number | string;
  [key: string]: unknown;
}

class APIClient {
  private client: AxiosInstance;

  constructor() {
    this.client = axios.create({
      baseURL: API_URL,
      headers: {
        'Content-Type': 'application/json',
      },
      withCredentials: true,
    });

    this.client.interceptors.request.use((config) => {
      if (typeof window !== 'undefined') {
        const token = getAccessToken();
        if (token) {
          config.headers = config.headers || {};
          config.headers.Authorization = `Bearer ${token}`;
        }
      }
      return config;
    });

    // Strict-auth requests attempt silent refresh once, then redirect to login.
    this.client.interceptors.response.use(
      (response) => response,
      async (error) => {
        const status = getResponseStatus(error);
        const originalRequest = error.config;

        if (status === 403 && getResponseCode(error) === 'PLATFORM_ACCESS_REQUIRED') {
          if (typeof window !== 'undefined' && window.location.pathname !== ACCESS_REQUIRED_ROUTE) {
            requestAppNavigation({ href: ACCESS_REQUIRED_ROUTE, replace: true });
          }
          return Promise.reject(error);
        }

        if (status === 401 && originalRequest?.skipAuthRedirect) {
          clearAccessToken();
          return Promise.reject(error);
        }

        // Only handle 401s; don't retry refresh calls themselves.
        if (
          status === 401 &&
          originalRequest &&
          !originalRequest._retry401 &&
          !String(originalRequest.url || '').includes(REFRESH_ENDPOINT)
        ) {
          originalRequest._retry401 = true;
          try {
            // Attempt silent token refresh against the same public /api origin the browser uses.
            const refreshRes = await axios.post(
              getPublicApiUrl(REFRESH_ENDPOINT),
              {},
              {
                headers: { 'Content-Type': 'application/json' },
                validateStatus: () => true,
                withCredentials: true,
              }
            );
            const refreshPayload = asRecord(
              unwrapApiData<Record<string, unknown>>(refreshRes.data)
            );
            const newToken =
              typeof refreshPayload?.accessToken === 'string'
                ? refreshPayload.accessToken
                : '';
            if (refreshRes.status < 200 || refreshRes.status >= 300) {
              throw new Error(`Refresh failed with status ${refreshRes.status}`);
            }
            if (newToken) {
              setAccessToken(newToken);
              originalRequest.headers = originalRequest.headers || {};
              originalRequest.headers['Authorization'] = `Bearer ${newToken}`;
            } else if (originalRequest.headers?.Authorization) {
              clearAccessToken();
              delete originalRequest.headers.Authorization;
            }

            return this.client.request(originalRequest);
          } catch {
            // Refresh failed — clear session and redirect to login
          }
          clearAccessToken();
          if (typeof window !== 'undefined') {
            const currentPath = window.location.pathname;
            if (currentPath === '/login' || currentPath === '/portal/login') {
              return Promise.reject(error);
            }
            requestAppNavigation({
              href: buildLoginRedirectUrl(
                window.location.pathname,
                window.location.search,
              ),
              replace: true,
            });
          }
        }

        return Promise.reject(error);
      }
    );
  }

  // Authentication
  async register(email: string, password: string, name?: string): Promise<AuthResponse> {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/register`, {
      email: normalizeEmail(email),
      password,
      name,
    });
    return unwrapApiData<AuthResponse>(response.data);
  }

  async login(email: string, password: string): Promise<AuthResponse> {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/login`, {
      email: normalizeEmail(email),
      password,
    });
    return unwrapApiData<AuthResponse>(response.data);
  }

  async getCurrentUser(): Promise<AuthUser | null> {
    const response = await this.client.get(`${NODE_API_URL}/api/auth/profile`, {
      skipAuthRedirect: true,
    });
    return unwrapApiData<AuthUser | null>(response.data);
  }

  async logout() {
    try {
      await this.client.post(`${NODE_API_URL}/api/auth/logout`);
    } catch {
      // Best-effort server-side logout
    }
    clearAccessToken();
  }

  async refreshTokens() {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/refresh`, {});
    return unwrapApiData(response.data);
  }

  async changePassword(currentPassword: string, newPassword: string) {
    const response = await this.client.put(`${NODE_API_URL}/api/auth/password`, { currentPassword, newPassword });
    return response.data;
  }

  async requestPasswordReset(email: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/password-reset`, {
      email: normalizeEmail(email),
    });
    return response.data;
  }

  async confirmPasswordReset(token: string, newPassword: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/password-reset/confirm`, {
      token,
      newPassword,
    });
    return response.data;
  }

  async listApiKeys(): Promise<{ keys: ManagedApiKey[] }> {
    const response = await this.client.get(`${NODE_API_URL}/api/auth/api-keys`);
    return response.data;
  }

  async createApiKey(name: string, expiresInDays?: number): Promise<{ apiKey: string; record: ManagedApiKey }> {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/api-keys`, { name, expiresInDays });
    return response.data;
  }

  async revokeApiKey(keyId: string): Promise<{ revoked: boolean }> {
    const response = await this.client.post(`${NODE_API_URL}/api/auth/api-keys/${keyId}/revoke`);
    return response.data;
  }

  async getPortalSettings() {
    const response = await this.client.get(`${NODE_API_URL}/api/portal/settings`);
    return response.data;
  }

  async getPortalOverview(): Promise<PortalOverview> {
    const response = await this.client.get(`${NODE_API_URL}/api/portal/overview`);
    return unwrapApiData<PortalOverview>(response.data);
  }

  async getPortalJob(jobId: string): Promise<PortalOverviewJob> {
    const response = await this.client.get(
      `${NODE_API_URL}/api/portal/jobs/${jobId}`,
    );
    return unwrapApiData<PortalOverviewJob>(response.data);
  }

  async getPortalJobExports(jobId: string) {
    const response = await this.client.get(
      `${NODE_API_URL}/api/portal/jobs/${jobId}/exports`,
    );
    return unwrapApiData(response.data);
  }

  async invitePortalUser(data: { email: string; role: 'OWNER' | 'ANALYST' | 'VIEWER'; name?: string }) {
    const response = await this.client.post(`${NODE_API_URL}/api/portal/invite`, data);
    return response.data;
  }

  // Demo Request (landing page) — submits to both legacy endpoint and lead pipeline
  async submitDemoRequest(data: {
    email: string;
    name?: string;
    institutionName?: string;
    institutionType?: string;
    totalAssets?: string;
    message?: string;
    company?: string;
  }): Promise<DemoRequestSubmissionResult> {
    const rawInstitutionType = (data.institutionType || '').trim().toLowerCase();
    const institutionTypeAliases: Record<string, string> = {
      bank: 'community_bank',
      family_office: 'other',
    };
    const allowedInstitutionTypes = new Set([
      'cooperativa',
      'credit_union',
      'community_bank',
      'cpa_consultant',
      'other',
    ]);
    const mappedInstitutionType = institutionTypeAliases[rawInstitutionType] || rawInstitutionType;
    const normalizedInstitutionType = allowedInstitutionTypes.has(mappedInstitutionType)
      ? mappedInstitutionType
      : 'other';
    const normalizedInstitutionName = (data.institutionName || data.company || '').trim();

    // Submit to lead pipeline (primary)
    const leadPayload = {
      name: data.name || '',
      email: data.email,
      institutionName: normalizedInstitutionName,
      institutionType: normalizedInstitutionType,
      message: data.message,
      source: 'landing_page',
    };
    let leadResult: Record<string, unknown> | null = null;
    try {
      const leadResponse = await this.client.post(
        `${NODE_API_URL}/api/v1/leads/submit`,
        leadPayload,
      );
      leadResult = asRecord(unwrapApiData<Record<string, unknown>>(leadResponse.data));
    } catch { /* fallback to legacy */ }

    // Also submit to legacy demo-request endpoint
    const legacyPayload = {
      ...data,
      institutionName: normalizedInstitutionName || undefined,
      institutionType: normalizedInstitutionType,
    };
    const response = await this.client.post(`${NODE_API_URL}/api/demo-request`, legacyPayload);
    const legacyResult = asRecord(
      unwrapApiData<Record<string, unknown>>(response.data),
    );

    return {
      leadId:
        typeof leadResult?.leadId === 'string' ? leadResult.leadId : null,
      demoRequestId:
        typeof legacyResult?.id === 'string' ? legacyResult.id : null,
      institutionName: normalizedInstitutionName,
      institutionType: normalizedInstitutionType,
      message:
        (typeof legacyResult?.message === 'string' && legacyResult.message) ||
        (typeof leadResult?.message === 'string' && leadResult.message) ||
        'Demo request received',
      duplicateLead: Boolean(leadResult?.duplicate),
    };
  }

  // Admin (all admin endpoints require x-admin-key header)
  private adminHeaders() {
    const key = getStoredAdminKey();
    return { 'x-admin-key': key };
  }

  async getDemoRequests() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/demo-requests`, { headers: this.adminHeaders() });
    return response.data;
  }

  async resetDemoData() {
    const response = await this.client.delete(`${NODE_API_URL}/api/admin/demo-data`, { headers: this.adminHeaders() });
    return response.data;
  }

  async getAdminStats() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/stats`, { headers: this.adminHeaders() });
    return response.data;
  }

  async getAdminControlTowerSummary() {
    const response = await this.client.get(
      `${NODE_API_URL}/admin/api/control-tower/summary`,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async runAdminControlTowerAction(body: {
    action: string;
    userId?: string;
    jobId?: string;
  }) {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/control-tower/actions`,
      body,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async getAdminOps(): Promise<AdminOpsSnapshot> {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/ops`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getAdminPipeline(status?: string): Promise<AdminPipelineSnapshot> {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/pipeline${suffix}`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async runAdminPipelineAction(
    jobId: string,
    action: 'force-advance' | 'force-fail' | 'force-regenerate',
    body?: Record<string, unknown>,
  ) {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/pipeline/${jobId}/${action}`,
      body || {},
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async getAdminRevenueMetrics(): Promise<AdminRevenueMetrics> {
    const response = await this.client.get(`${NODE_API_URL}/admin/api/revenue`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getAdminAuditLogs(limit = 100): Promise<AdminAuditEntry[]> {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/audit-logs?limit=${limit}`, {
      headers: this.adminHeaders(),
    });
    return Array.isArray(response.data) ? response.data : response.data.logs || [];
  }

  async getAdminLeads(status?: string) {
    const suffix = status ? `?status=${encodeURIComponent(status)}` : '';
    const response = await this.client.get(
      `${NODE_API_URL}/admin/api/leads${suffix}`,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async getAdminLeadMetrics() {
    const response = await this.client.get(
      `${NODE_API_URL}/admin/api/leads/metrics`,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async updateAdminLead(id: string, body: Record<string, unknown>) {
    const response = await this.client.put(
      `${NODE_API_URL}/admin/api/leads/${id}`,
      body,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async addAdminLeadNote(id: string, note: string) {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/leads/${id}/note`,
      { note },
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async markAdminReportSent(id: string) {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/leads/${id}/mark-report-sent`,
      {},
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async getExitMetrics() {
    const response = await this.client.get(`${NODE_API_URL}/api/admin/exit-metrics`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getIntelligenceOverview(workspaceId?: string) {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/overview${qs}`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getIntelligenceAccounts(params?: {
    workspaceId?: string;
    kind?: string;
    status?: string;
    search?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.workspaceId) qs.set('workspaceId', params.workspaceId);
    if (params?.kind) qs.set('kind', params.kind);
    if (params?.status) qs.set('status', params.status);
    if (params?.search) qs.set('search', params.search);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/accounts${suffix}`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getIntelligenceAccount(id: string) {
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/accounts/${id}`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getIntelligenceTimeline(id: string) {
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/accounts/${id}/timeline`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getIntelligenceActions(params?: {
    workspaceId?: string;
    status?: string;
    kind?: string;
  }) {
    const qs = new URLSearchParams();
    if (params?.workspaceId) qs.set('workspaceId', params.workspaceId);
    if (params?.status) qs.set('status', params.status);
    if (params?.kind) qs.set('kind', params.kind);
    const suffix = qs.toString() ? `?${qs.toString()}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/actions${suffix}`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async refreshIntelligence(body: {
    workspaceId?: string;
    accountIds?: string[];
    kinds?: string[];
    staleOnly?: boolean;
    trigger?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/refresh`, body, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async importIntelligenceAccounts(body: {
    workspaceId?: string;
    accounts: Array<Record<string, unknown>>;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/accounts/import`, body, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async generateIntelligenceReport(body: {
    workspaceId?: string;
    type: string;
    title?: string;
    accountIds?: string[];
    includeClosedActions?: boolean;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/reports`, body, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async getIntelligenceHandoff(workspaceId?: string) {
    const qs = workspaceId ? `?workspaceId=${encodeURIComponent(workspaceId)}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/handoff${qs}`, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async createIntelligenceMemoryEntry(body: {
    workspaceId?: string;
    accountId?: string;
    type: string;
    title: string;
    body: string;
    pinned?: boolean;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/memory`, body, {
      headers: this.adminHeaders(),
    });
    return response.data;
  }

  async downloadIntelligenceArtifact(id: string, format: 'csv' | 'json' = 'json') {
    const response = await this.client.get(
      `${NODE_API_URL}/admin/api/intelligence/artifacts/${id}/export?format=${format}`,
      {
        headers: this.adminHeaders(),
        responseType: format === 'csv' ? 'blob' : 'json',
      },
    );

    if (format === 'json') {
      const blob = new Blob([JSON.stringify(response.data, null, 2)], {
        type: 'application/json',
      });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `intelligence-artifact-${id}.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
      return response.data;
    }

    const blob = new Blob([response.data], { type: 'text/csv' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `intelligence-artifact-${id}.csv`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    return true;
  }

  // Risk Analysis
  async getRiskAnalysis(portfolioId: string) {
    const response = await this.client.get(`/risk/${portfolioId}`);
    return response.data;
  }

  // Market Data
  async getQuote(ticker: string) {
    return this.getNodeQuote(ticker);
  }

  async getFundamentals(ticker: string) {
    return this.getNodeFundamentals(ticker);
  }

  async getVolatilityForecast(ticker: string, horizon: number = 30) {
    const baseVol = 0.15 + (ticker.charCodeAt(0) % 10) / 100; // e.g., 0.15 to 0.24
    const forecast = [];
    let currentVol = baseVol;

    for (let i = 1; i <= horizon; i++) {
      // Mean reversion towards slightly higher long-term vol
      const drift = (0.20 - currentVol) * 0.05;
      const shock = (Math.random() - 0.4) * 0.01;
      currentVol = Math.max(0.05, currentVol + drift + shock);

      forecast.push({
        day: i,
        volatility: currentVol,
        lower95: Math.max(0, currentVol * 0.8),
        upper95: currentVol * 1.25
      });
    }

    return Promise.resolve({
      ticker,
      currentVolatility: baseVol,
      forecast,
      model: 'GARCH(1,1) Mock'
    });
  }

  async getHistoricalPrices(ticker: string, startDate?: string, endDate?: string) {
    const params: Record<string, string> = {};
    if (startDate) params.start = startDate;
    if (endDate) params.end = endDate;

    const response = await this.client.get(`${MARKET_API_BASE}/history/${ticker}`, {
      params,
      skipAuthRedirect: true,
    });
    return response.data;
  }

  async getTechnicalChart(ticker: string, timeframe: string, indicators: string) {
    try {
      const response = await this.client.get(`/charts/technical/${ticker}`, {
        params: { timeframe, indicators }
      });
      return response.data;
    } catch (e) {
      console.error("Failed to fetch technical chart", e);
      return null;
    }
  }

  async calculateCorrelation(tickers: string[]) {
    // Generate a symmetric correlation matrix
    const n = tickers.length;
    const matrix = Array(n).fill(0).map(() => Array(n).fill(0));

    for (let i = 0; i < n; i++) {
      for (let j = 0; j <= i; j++) {
        if (i === j) {
          matrix[i][j] = 1.0;
        } else {
          // Pseudo-random correlation between -0.3 and 0.8
          const val = -0.3 + (Math.abs(Math.sin((i + 1) * (j + 1))) * 1.1);
          matrix[i][j] = val;
          matrix[j][i] = val; // symmetric
        }
      }
    }

    return Promise.resolve({
      tickers,
      matrix,
      computedAt: new Date().toISOString()
    });
  }

  async calculateComponentVaR(positions: PortfolioPositionInput[], confidenceLevel: number = 0.95, horizon: number = 1) {
    let portfolioValue = 0;
    const components = positions.map(p => {
      const val = Number(p.quantity) * Number(p.price || p.currentPrice || 100);
      portfolioValue += val;
      return { ticker: p.ticker, value: val };
    });

    const portfolioVaR = portfolioValue * 0.05; // 5% total VaR roughly

    let totalRiskContrib = 0;
    const resultComponents = components.map(c => {
      const weight = c.value / portfolioValue;
      const compVaR = portfolioVaR * weight * (0.8 + Math.random() * 0.4); // Randomize risk a bit
      totalRiskContrib += compVaR;
      return {
        ticker: c.ticker,
        position: c.value,
        marginalVaR: compVaR / c.value,
        componentVaR: compVaR,
        riskContribution: 0 // Will normalize
      };
    });

    // Normalize risk contributions to 100%
    resultComponents.forEach(c => {
      c.riskContribution = (c.componentVaR / totalRiskContrib) * 100;
    });

    return Promise.resolve({
      portfolioVaR: totalRiskContrib,
      portfolioValue,
      confidenceLevel,
      horizon,
      components: resultComponents
    });
  }

  async getMarketData(tickers: string[], startDate?: string, endDate?: string) {
    const response = await this.client.post('/market-data', {
      tickers,
      startDate,
      endDate,
    });
    return response.data;
  }

  // AI Insights
  async getInsights(ticker?: string) {
    const scope = ticker?.toUpperCase() || 'MARKET';
    return {
      insights: [
        { id: '1', title: `${scope}: Tech Sector Valuation Premium`, source: 'AI Macro Engine', summary: 'AI infrastructure spend continues to accelerate, sustaining high multiples for semiconductor firms despite rising real yields.', sentiment: 'bullish', confidence: 0.88, timestamp: new Date().toISOString() },
        { id: '2', title: `${scope}: Consumer Discretionary Weakness`, source: 'Consumer Data Feed', summary: 'Excess savings depletion is leading to softer guidance in retail. Defensive rotation recommended.', sentiment: 'bearish', confidence: 0.75, timestamp: new Date(Date.now() - 3600000).toISOString() },
        { id: '3', title: `${scope}: Energy Market Contango`, source: 'Commodities Desk', summary: 'Geopolitical risk premium is evaporating, putting downward pressure on near-term futures.', sentiment: 'neutral', confidence: 0.65, timestamp: new Date(Date.now() - 7200000).toISOString() }
      ]
    };
  }

  // Waitlist
  async joinWaitlist(data: JsonObject) {
    try {
      const response = await this.client.post('/api/waitlist', data);
      return response.data;
    } catch {
      const response = await this.client.post('/waitlist', data);
      return response.data;
    }
  }

  async createWorkspace(userId: string, data: { name: string; company_name?: string }) {
    const response = await this.client.post(`${NODE_API_URL}/api/workspaces`, {
      name: data.name,
      company_name: data.company_name,
      userId,
    });
    return response.data;
  }

  // File Upload & Analysis
  async uploadFile(formData: FormData) {
    const response = await this.client.post('/upload', formData, {
      headers: {
        'Content-Type': 'multipart/form-data',
      },
    });
    return response.data;
  }

  async runAnalysis(data: JsonObject) {
    const response = await this.client.post('/analyze', data);
    return response.data;
  }

  async generateReport(data: JsonObject) {
    const response = await this.client.post('/reports/generate', data);
    return response.data;
  }

  // Cyclical Valuation
  async computeCyclicalValuation(ticker: string) {
    return Promise.resolve({ status: 'computed', ticker: ticker.toUpperCase() });
  }

  async getCyclicalValuation(ticker: string) {
    const basePrice = ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 500 + 50;
    return Promise.resolve({
      ticker: ticker.toUpperCase(),
      cycles_detected: 3,
      mid_cycle_revenue: basePrice * 10000000,
      mid_cycle_eps: basePrice / 20,
      mid_cycle_margin: 0.25,
      mid_cycle_pe: 22,
      fair_value_base: basePrice * 1.15,
      fair_value_low: basePrice * 0.9,
      fair_value_high: basePrice * 1.4,
      current_price: basePrice,
      upside_downside_pct: 15.0,
      current_cycle_position: 'Early Expansion'
    });
  }

  // Tickers
  async getPopularTickers() {
    const popularTickers: Array<{
      ticker: string;
      name: string;
      sector: string | null;
      industry: string | null;
      asset_type: 'stock' | 'etf' | 'crypto' | 'index';
      exchange: string | null;
    }> = [
      { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'AAPL', name: 'Apple Inc.', sector: 'Technology', industry: 'Consumer Electronics', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'MSFT', name: 'Microsoft Corporation', sector: 'Technology', industry: 'Software', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'TSLA', name: 'Tesla, Inc.', sector: 'Consumer Discretionary', industry: 'Automobiles', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'GOOGL', name: 'Alphabet Inc.', sector: 'Communication Services', industry: 'Internet Content & Information', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'META', name: 'Meta Platforms, Inc.', sector: 'Communication Services', industry: 'Internet Content & Information', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'AMZN', name: 'Amazon.com, Inc.', sector: 'Consumer Discretionary', industry: 'Internet Retail', asset_type: 'stock', exchange: 'NASDAQ' },
    ];
    return Promise.resolve(popularTickers);
  }

  async searchTickers(query: string) {
    const pseudoResults: Array<{
      ticker: string;
      name: string;
      sector: string | null;
      industry: string | null;
      asset_type: 'stock' | 'etf' | 'crypto' | 'index';
      exchange: string | null;
    }> = [
      { ticker: 'NVDA', name: 'NVIDIA Corporation', sector: 'Technology', industry: 'Semiconductors', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'AMD', name: 'Advanced Micro Devices', sector: 'Technology', industry: 'Semiconductors', asset_type: 'stock', exchange: 'NASDAQ' },
      { ticker: 'TSM', name: 'Taiwan Semiconductor', sector: 'Technology', industry: 'Semiconductors', asset_type: 'stock', exchange: 'NYSE' },
      query.length > 0
        ? { ticker: query.toUpperCase(), name: `${query.toUpperCase()} Corp`, sector: null, industry: null, asset_type: 'stock', exchange: 'NASDAQ' }
        : { ticker: 'INTC', name: 'Intel Corp', sector: 'Technology', industry: 'Semiconductors', asset_type: 'stock', exchange: 'NASDAQ' },
    ];
    return Promise.resolve(pseudoResults);
  }

  async getPortfolios() {
    return Promise.resolve([{
      id: 'demo-portfolio',
      name: 'AI Macro Starter',
      description: 'Seeded by onboarding for VaR, CVaR, and Monte Carlo workflows',
      benchmark: 'QQQ',
      initial_capital: 250000,
      initialCash: 250000,
      currentCash: 5000,
      totalValue: 275000,
      totalPnL: 25000,
      totalPnLPercent: 10.0,
      currency: 'USD',
      positions: [
        { id: '1', symbol: 'NVDA', ticker: 'NVDA', quantity: 120, avgCost: 500, currentPrice: 880.50, marketValue: 105660, unrealizedPnL: 45660, unrealizedPnLPercent: 76.10, weight: 0.38 },
        { id: '2', symbol: 'MSFT', ticker: 'MSFT', quantity: 80, avgCost: 380, currentPrice: 420.15, marketValue: 33612, unrealizedPnL: 3212, unrealizedPnLPercent: 10.56, weight: 0.12 },
        { id: '3', symbol: 'AMZN', ticker: 'AMZN', quantity: 100, avgCost: 140, currentPrice: 185.40, marketValue: 18540, unrealizedPnL: 4540, unrealizedPnLPercent: 32.42, weight: 0.07 },
        { id: '4', symbol: 'TSM', ticker: 'TSM', quantity: 110, avgCost: 110, currentPrice: 145.20, marketValue: 15972, unrealizedPnL: 3872, unrealizedPnLPercent: 31.56, weight: 0.05 },
        { id: '5', symbol: 'BTC', ticker: 'BTC', quantity: 1.5, avgCost: 45000, currentPrice: 68500.00, marketValue: 102750, unrealizedPnL: 35250, unrealizedPnLPercent: 52.22, weight: 0.37 },
      ]
    }]);
  }

  async createPortfolio(userId: string, data: JsonObject) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/portfolios`, data);
      return response.data;
    } catch {
      try {
        const response = await this.client.post('/portfolios', data);
        return response.data;
      } catch (fallbackError) {
        console.error("Failed to create portfolio", fallbackError);
        return null;
      }
    }
  }

  async addPosition(portfolioId: string, userId: string, position: JsonObject) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/portfolios/${portfolioId}/positions`, position);
      return response.data;
    } catch {
      try {
        const response = await this.client.post(`/portfolios/${portfolioId}/positions`, position);
        return response.data;
      } catch (fallbackError) {
        console.error("Failed to add position", fallbackError);
        return null;
      }
    }
  }

  async getPortfolioAnalytics(portfolioId: string) {
    return {
      portfolio_id: portfolioId,
      cvar: 15420.50,
      var_95: 12100.25,
      var_99: 18500.75,
      monte_carlo_paths: 1000,
      stress_test_loss: 28400.00,
      portfolio_beta: 1.25,
      sharpe_ratio: 1.8,
      positions_risk: [
        { symbol: 'NVDA', component_var: 6200, marginal_var: 5800, weight: 0.4 },
        { symbol: 'MSFT', component_var: 3100, marginal_var: 2900, weight: 0.25 },
        { symbol: 'AMZN', component_var: 2500, marginal_var: 2400, weight: 0.2 },
        { symbol: 'TSM', component_var: 3620, marginal_var: 3500, weight: 0.15 },
      ]
    };
  }

  // --- NestJS Market Data (MOCKED FOR 24/7 DEMO) ---

  // Comprehensive map of realistic baseline prices for popular assets
  private getBasePrice(ticker: string): number {
    const symbol = ticker.toUpperCase();
    const REALISTIC_PRICES: Record<string, number> = {
      // Indices & ETFs
      'SPY': 510.45, 'QQQ': 440.12, 'DIA': 390.50, 'IWM': 205.80, 'VIX': 14.50,
      'TLT': 93.20, 'GLD': 210.30, 'USO': 78.40, 'XLK': 208.15, 'XLF': 41.20,
      'XLE': 88.50, 'XLV': 144.30, 'XLY': 180.10, 'XLI': 122.40, 'XLB': 89.20,
      'XLP': 74.50, 'XLU': 65.10, 'SMH': 225.40, 'ARKK': 50.20,

      // Mag 7 & Large Cap Tech
      'NVDA': 880.50, 'AAPL': 175.20, 'MSFT': 420.15, 'AMZN': 185.40,
      'META': 500.20, 'GOOGL': 155.30, 'TSLA': 175.80, 'AMD': 170.10,
      'TSM': 145.20, 'AVGO': 1320.50, 'ASML': 980.40, 'ADBE': 490.15,
      'CRM': 305.20, 'NFLX': 610.80,

      // Financials & Others
      'JPM': 195.40, 'BAC': 37.50, 'GS': 410.20, 'V': 285.40, 'MA': 475.10,
      'UNH': 480.30, 'JNJ': 155.20, 'LLY': 780.40, 'NVO': 130.20, 'WMT': 60.50,
      'PG': 160.10, 'KO': 60.20, 'PEP': 170.50, 'COST': 740.20, 'HD': 375.40,
      'XOM': 115.20, 'CVX': 155.40,

      // Crypto (Proxies)
      'BTC': 68500.00, 'ETH': 3550.00, 'SOL': 180.50, 'COIN': 260.40, 'MSTR': 1550.20
    };

    if (REALISTIC_PRICES[symbol]) {
      return REALISTIC_PRICES[symbol];
    }
    // Fallback pseudo-random for unknown tickers (e.g. 50 to 550)
    return ticker.split('').reduce((acc, char) => acc + char.charCodeAt(0), 0) % 500 + 50;
  }

  async getNodeQuote(ticker: string) {
    const response = await this.client.get(`${MARKET_API_BASE}/quote/${ticker}`, {
      skipAuthRedirect: true,
    });
    const data = response.data;

    return {
      ...data,
      ticker: data.ticker || ticker.toUpperCase(),
      name: data.name || data.shortName || data.ticker || ticker.toUpperCase(),
      dayHigh: data.dayHigh ?? data.high ?? data.price ?? 0,
      dayLow: data.dayLow ?? data.low ?? data.price ?? 0,
    };
  }

  async getNodeHistory(ticker: string, start?: string, end?: string) {
    const params: Record<string, string> = {};
    if (start) params.start = start;
    if (end) params.end = end;

    const response = await this.client.get(`${MARKET_API_BASE}/history/${ticker}`, {
      params,
      skipAuthRedirect: true,
    });
    return response.data;
  }

  async getNodeFundamentals(ticker: string) {
    const response = await this.client.get(`${MARKET_API_BASE}/fundamentals/${ticker}`, {
      skipAuthRedirect: true,
    });
    return response.data;
  }

  async searchNodeTickers(query: string, assetType?: string) {
    const params: Record<string, string> = { q: query };
    if (assetType) params.assetType = assetType;
    const response = await this.client.get(`${MARKET_API_BASE}/search`, { params });
    return response.data;
  }

  async getNodeInstrument(ticker: string) {
    const response = await this.client.get(`${MARKET_API_BASE}/instrument/${ticker}`, {
      skipAuthRedirect: true,
    });
    return response.data;
  }

  async getNodeNews(ticker: string, limit: number = 8) {
    const response = await this.client.get(`${MARKET_API_BASE}/news/${ticker}`, {
      params: { limit },
      skipAuthRedirect: true,
    });
    return response.data;
  }

  async getNodeSnapshot(ticker: string, newsLimit: number = 8) {
    const response = await this.client.get(`${MARKET_API_BASE}/snapshot/${ticker}`, {
      params: { newsLimit },
      skipAuthRedirect: true,
    });
    return response.data;
  }

  async getNodeInsights(ticker?: string) {
    const params: Record<string, string> = {};
    if (ticker) params.ticker = ticker;
    const response = await this.client.get(`${MARKET_API_BASE}/insights`, { params });
    return response.data;
  }

  async getNodeTechnicalChart(ticker: string, timeframe: string = '3M', indicators: string = 'sma20,rsi,macd') {
    const response = await this.client.get(`${NODE_API_URL}/api/charts/technical/${ticker}`, {
      params: { timeframe, indicators }
    });
    return response.data;
  }

  async getNodeOptionsChain(ticker: string, maturity?: string) {
    const params: Record<string, string> = {};
    if (maturity) params.maturity = maturity;
    const response = await this.client.get(`${NODE_API_URL}/api/options/chain/${ticker}`, { params });
    return response.data;
  }

  async calculateNodeGreeks(data: { underlying: number; strike: number; timeToExpiry: number; riskFreeRate: number; volatility: number; optionType: string }) {
    const response = await this.client.post(`${NODE_API_URL}/api/options/calculate`, data);
    return response.data;
  }

  async getNodeValuationScreener(params?: { sector?: string; minScore?: number }) {
    const results = [
      { ticker: 'NVDA', score: 98, sector: 'Technology', fair_value_base: 145.00, current_price: 120.00, upside_downside_pct: 20.8 },
      { ticker: 'AMD', score: 85, sector: 'Technology', fair_value_base: 180.00, current_price: 155.00, upside_downside_pct: 16.1 },
      { ticker: 'TSM', score: 92, sector: 'Technology', fair_value_base: 195.00, current_price: 175.00, upside_downside_pct: 11.4 },
    ];
    return Promise.resolve(
      results.filter((item) => {
        const sectorMatches = !params?.sector || item.sector === params.sector;
        const scoreMatches = params?.minScore === undefined || item.score >= params.minScore;
        return sectorMatches && scoreMatches;
      }),
    );
  }

  async getNodeValuation(ticker: string, type: 'cyclical' | 'compounder' | 'frontier' = 'cyclical') {
    const basePrice = this.getBasePrice(ticker);
    return Promise.resolve({
      ticker: ticker.toUpperCase(),
      valuation_type: type,
      cycles_detected: 3,
      mid_cycle_revenue: basePrice * 10000000,
      mid_cycle_eps: basePrice / 20,
      mid_cycle_margin: 0.25,
      mid_cycle_pe: 22,
      fair_value_base: basePrice * 1.15,
      fair_value_low: basePrice * 0.9,
      fair_value_high: basePrice * 1.4,
      current_price: basePrice,
      upside_downside_pct: 15.0,
      current_cycle_position: 'Early Expansion'
    });
  }

  async getNodeCorrelation(tickers: string[]) {
    return this.calculateCorrelation(tickers);
  }

  async getNodeComponentVaR(positions: PortfolioPositionInput[], confidenceLevel: number = 0.95, horizon: number = 1) {
    return this.calculateComponentVaR(positions, confidenceLevel, horizon);
  }

  async getNodeVolatilityForecast(ticker: string, horizon: number = 30) {
    return this.getVolatilityForecast(ticker, horizon);
  }

  async getNodePortfolios() {
    return this.getPortfolios();
  }

  async getNodePortfolioAnalytics(portfolioId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/portfolios/${portfolioId}/analytics`);
    return response.data;
  }

  // --- ALM (Asset Liability Management) ---

  async getAlmDemoAnalysis() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/demo-analysis`);
    return response.data;
  }

  async getAlmDemoBalanceSheet() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/demo-balance-sheet`);
    return response.data;
  }

  async postAlmFullAnalysis(balanceSheet: JsonObject, rateShocks?: number[], lcr?: JsonObject) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/full-analysis`, {
      balanceSheet,
      rateShocks,
      lcr,
    });
    return response.data;
  }

  // --- ALM Enterprise (DB-backed) ---

  async getInstitutions(workspaceId?: string) {
    const params = workspaceId ? `?workspaceId=${workspaceId}` : '';
    const response = await this.client.get(`${NODE_API_URL}/api/alm/institutions${params}`);
    const payload = response.data?.data ?? response.data;
    return payload?.items ?? payload ?? [];
  }

  async createInstitution(data: {
    name: string;
    type: string;
    totalAssets: number;
    reportingDate: string;
    workspaceId: string;
    currency?: string;
    primaryRegulator?: string;
    preferredLanguage?: 'en' | 'es' | 'both';
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/institutions`, data);
    return response.data?.data ?? response.data;
  }

  async openPortalReportCycle(data: {
    institutionName?: string;
    institutionType?: string;
    primaryRegulator?: 'COSSEC' | 'NCUA';
    preferredLanguage?: 'en' | 'es' | 'both';
    totalAssets?: number | string;
  } = {}): Promise<PortalCycleResponse> {
    const response = await this.client.post(
      `${NODE_API_URL}/api/portal/jobs/open-cycle`,
      data,
    );
    return unwrapApiData<PortalCycleResponse>(response.data);
  }

  async getInstitution(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/institutions/${institutionId}`);
    return response.data?.data ?? response.data;
  }

  async getALMSummary(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/summary`);
    return response.data?.data ?? response.data;
  }

  async getNIISensitivity(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/nii-sensitivity`);
      return response.data;
    } catch {
      return {
        institutionId, baseNII: 742, riskRating: 'moderate' as const,
        scenarios: [
          { name: '+200 bps', shiftBps: 200, niImpact: 118, niImpactPct: 15.9, mveImpact: -412, mveImpactPct: -17.2 },
          { name: '+100 bps', shiftBps: 100, niImpact: 62, niImpactPct: 8.4, mveImpact: -198, mveImpactPct: -8.3 },
          { name: 'Base', shiftBps: 0, niImpact: 0, niImpactPct: 0, mveImpact: 0, mveImpactPct: 0 },
          { name: '-100 bps', shiftBps: -100, niImpact: -48, niImpactPct: -6.5, mveImpact: 164, mveImpactPct: 6.8 },
          { name: '-200 bps', shiftBps: -200, niImpact: -96, niImpactPct: -12.9, mveImpact: 341, mveImpactPct: 14.2 },
        ],
      };
    }
  }

  async getLiquidityPosition(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/liquidity`);
      return response.data;
    } catch {
      // Fallback demo data
    }
    return {
      institutionId,
      lcr: 148.2,
      nsfr: 118.4,
      hqla: 4800,
      netOutflows: 3240,
      status: 'compliant' as const,
      buffer: 48.2,
    };
  }

  async getDurationGap(institutionId: string) {
    try {
      const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/duration-gap`);
      return response.data;
    } catch {
      return { institutionId, assetDuration: 3.8, liabilityDuration: 2.0, durationGap: 1.8, riskProfile: 'asset-sensitive' as const };
    }
  }

  async importBalanceSheetItems(institutionId: string, items: JsonObjectArray) {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/institutions/${institutionId}/balance-sheet-items`,
      { items },
    );
    return response.data;
  }

  async uploadBalanceSheetCSV(institutionId: string, file: File, dryRun = false) {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/institutions/${institutionId}/upload-csv${dryRun ? '?dryRun=true' : ''}`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  async runStressTest(institutionId: string, params?: {
    paths?: number; horizon?: number; volatility?: number; meanReversion?: number;
  }) {
    try {
      const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/stress-test`, params ?? {});
      return response.data;
    } catch { /* fallback below */ }
    return ({
      monteCarlo: {
        paths: 1000,
        horizon: 12,
        ratePaths: [],
        niiDistribution: { p5: -5.2, p25: -2.1, median: 0.8, p75: 3.4, p95: 6.1 },
        monthlyNIIBands: [
          { month: 1, p5: -0.5, p25: -0.2, median: 0.1, p75: 0.3, p95: 0.6 },
          { month: 2, p5: -0.8, p25: -0.3, median: 0.2, p75: 0.5, p95: 0.9 },
          { month: 3, p5: -1.2, p25: -0.5, median: 0.3, p75: 0.8, p95: 1.4 },
          { month: 6, p5: -2.5, p25: -1.1, median: 0.5, p75: 1.6, p95: 2.8 },
          { month: 9, p5: -4.0, p25: -1.6, median: 0.7, p75: 2.4, p95: 4.5 },
          { month: 12, p5: -5.2, p25: -2.1, median: 0.8, p75: 3.4, p95: 6.1 },
        ],
        worstCaseNII: -5.8,
        expectedNII: 12.8,
        niiAtRisk: 5.2,
      },
      regulatory: {
        scenarios: [
          {
            name: 'Severe Baseline Rates',
            description: 'Assumes an immediate +300bps parallel shift across the curve.',
            rateShock: [300, 300, 300, 300],
            niImpact: 4.2,
            mveImpact: -8.5,
            lcrImpact: 108,
            capitalImpact: -0.2,
            passFailStatus: 'pass' as const,
          },
          {
            name: 'Liquidity Crisis Draft',
            description: 'Significant retail deposit flight forcing immediate wholesale funding utilization.',
            rateShock: [0, 0, 0, 0],
            niImpact: -2.1,
            mveImpact: -0.5,
            lcrImpact: 92,
            capitalImpact: -0.8,
            passFailStatus: 'warn' as const,
          },
          {
            name: 'Flattening Curve Shock',
            description: 'Short rates rise +200bps while long rates fall -100bps, compressing margins heavily.',
            rateShock: [200, 100, 0, -100],
            niImpact: -5.4,
            mveImpact: 1.2,
            lcrImpact: 112,
            capitalImpact: 0.1,
            passFailStatus: 'fail' as const,
          },
          {
            name: 'Stagflation Stress Event',
            description: 'High rates (+250bps) persist while credit losses multiply drastically.',
            rateShock: [250, 250, 250, 250],
            niImpact: 1.8,
            mveImpact: -12.4,
            lcrImpact: 104,
            capitalImpact: -1.5,
            passFailStatus: 'pass' as const,
          }
        ],
        overallRating: 'adequate' as const,
      }
    });
  }

  // --- Custom Stress Scenario Builder ---

  async runCustomStressTest(institutionId: string, params: StressScenarioParams): Promise<StressScenarioResult> {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/${institutionId}/stress/custom`,
      params,
    );
    return response.data;
  }

  // --- Compliance Calendar ---

  async getComplianceCalendar(institutionId: string): Promise<{
    id: string;
    title: string;
    titleEs: string;
    deadlineDate: string;
    category: 'exam' | 'report' | 'meeting' | 'tax' | 'internal';
    urgency: 'CRITICAL' | 'HIGH' | 'MEDIUM' | 'LOW' | 'OVERDUE';
    description: string;
    descriptionEs: string;
    relatedModule: string;
  }[]> {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/calendar`, {
      skipAuthRedirect: true,
    });
    return response.data;
  }

  getALMReportUrl(institutionId: string, lang: string = 'en'): string {
    return `${NODE_API_URL}/api/alm/${institutionId}/report?lang=${lang}`;
  }

  async downloadALMReport(institutionId: string, lang: string = 'en'): Promise<void> {
    const response = await this.client.get(
      `${NODE_API_URL}/api/alm/${institutionId}/report?lang=${lang}`,
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers['content-disposition'];
    const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
    a.download = filenameMatch?.[1] || `alm-report-${institutionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Download the push-button COSSEC regulatory compliance report as a PDF.
   * Spanish-first (`lang` defaults to 'es' — the cooperativa examiner language).
   * The backend renders even with data gaps (it never fabricates), so the
   * caller may invoke this whenever an institution is selected.
   */
  async downloadCossecReport(
    institutionId: string,
    lang: string = 'es',
  ): Promise<void> {
    const response = await this.client.get(
      `${NODE_API_URL}/api/alm/${institutionId}/cossec-report/pdf?lang=${lang === 'en' ? 'en' : 'es'}`,
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const disposition = response.headers['content-disposition'];
    const filenameMatch = disposition?.match(/filename="?([^"]+)"?/);
    a.download = filenameMatch?.[1] || `cossec-report-${institutionId}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  /**
   * Seed an institution for the onboarding / demo flow.
   *
   * Routing strategy (Phase 1 complete — 2026-04-14):
   * All four institution types now route through the **idempotent** fixture
   * endpoint `POST /api/alm/institutions/seed`. Re-invocation returns the
   * same `institutionId` (keyed by `(workspaceId, seedKey)`), which matches
   * the Phase 1 pickup contract. The legacy `POST /api/alm/seed-demo`
   * endpoint is deprecated and no longer called from the frontend.
   *
   * | type           | fixture                     |
   * |----------------|-----------------------------|
   * | cooperativa    | `pr-cooperativa-demo`       |
   * | bank           | `pr-bank-demo`              |
   * | credit_union   | `pr-credit-union-demo`      |
   * | family_office  | `pr-family-office-demo`     |
   *
   * No silent fallback — errors propagate so the UI surfaces real failure
   * states instead of navigating the user to a phantom `demo-bank-id` that
   * doesn't exist in the database (D1 convention).
   */
  async seedDemoInstitution(workspaceId: string, type: 'bank' | 'credit_union' | 'family_office' | 'cooperativa') {
    const fixtureByType = {
      bank: 'pr-bank-demo',
      credit_union: 'pr-credit-union-demo',
      family_office: 'pr-family-office-demo',
      cooperativa: 'pr-cooperativa-demo',
    } as const;
    const result = await this.seedInstitutionFromFixture(
      workspaceId,
      fixtureByType[type],
    );
    return {
      success: true,
      institutionId: result.institutionId,
      institution: {
        id: result.institutionId,
        name: result.fixture?.name ?? `${type} demo`,
        type,
        seedKey: result.seedKey,
      },
      delta: result.delta,
    };
  }

  /**
   * Direct handle on the idempotent fixture seeder. Callers that want
   * explicit control over which fixture to seed (future: multi-tenant
   * demos, CI smoke-tests) should use this instead of `seedDemoInstitution`.
   *
   * Return shape mirrors the backend `SeedResult` — see
   * `backend-node/src/alm/data/fixtures/_schema.ts`.
   */
  async seedInstitutionFromFixture(workspaceId: string, fixture: string): Promise<{
    institutionId: string;
    seedKey: string;
    delta: {
      institution: 'created' | 'updated' | 'unchanged';
      balanceSheetItems: { before: number; after: number; replaced: boolean };
      liquidityPosition: 'created' | 'updated' | 'unchanged';
    };
    fixture: { seedKey: string; name: string; itemCount: number };
  }> {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/institutions/seed`,
      { workspaceId, fixture },
    );
    return response.data?.data ?? response.data;
  }

  // --- AI Advisor ---

  async askAdvisor(
    institutionId: string,
    message: string,
    conversationHistory: Array<{ role: string; content: string }> = [],
    language: string = 'es',
  ): Promise<{ response: string; tokensUsed: number }> {
    const response = await this.client.post(
      `${NODE_API_URL}/api/alm/${institutionId}/advisor`,
      { message, conversationHistory, language },
    );
    return response.data;
  }

  // --- Workspaces (ALM) ---

  async getMyWorkspaces() {
    const response = await this.client.get(`${NODE_API_URL}/api/workspaces`);
    return response.data?.data ?? response.data;
  }

  async createMyWorkspace(name: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/workspaces`, { name });
    return response.data?.data ?? response.data;
  }

  // --- Expense / SpendCheck Analysis (POST /api/expenses/:orgId/analyze) ---

  async analyzeExpenses(orgId: string): Promise<APAnalysisResult> {
    const response = await this.client.post(`${NODE_API_URL}/api/expenses/${orgId}/analyze`);
    return response.data;
  }

  async uploadExpenseCSV(orgId: string, file: File): Promise<ExpenseUploadResult> {
    const formData = new FormData();
    formData.append('file', file);
    const response = await this.client.post(
      `${NODE_API_URL}/api/expenses/${orgId}/upload`,
      formData,
      { headers: { 'Content-Type': 'multipart/form-data' } },
    );
    return response.data;
  }

  getExpenseTemplateUrl(): string {
    return `${NODE_API_URL}/api/expenses/template`;
  }

  async downloadAPReport(orgId: string, lang: string = 'en', institutionId?: string): Promise<void> {
    const params = new URLSearchParams({ lang });
    if (institutionId) params.set('institutionId', institutionId);
    const response = await this.client.post(
      `${NODE_API_URL}/api/expenses/${orgId}/report?${params.toString()}`,
      {},
      { responseType: 'blob' },
    );
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const dateStr = new Date().toISOString().slice(0, 10);
    a.download = `ap-intelligence-report-${dateStr}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  // Prospect CRM
  async getProspects(stage?: string) {
    const params = stage ? `?stage=${stage}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/prospects${params}`, { headers: this.adminHeaders() });
    return response.data;
  }

  async createProspect(data: { name: string; email?: string; company?: string; role?: string; stage?: string; source?: string; notes?: string }) {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/prospects`, data, { headers: this.adminHeaders() });
    return response.data;
  }

  async updateProspect(id: string, data: { stage?: string; notes?: string; name?: string; email?: string; company?: string; role?: string }) {
    const response = await this.client.patch(`${NODE_API_URL}/admin/api/prospects/${id}`, data, { headers: this.adminHeaders() });
    return response.data;
  }

  async deleteProspect(id: string) {
    const response = await this.client.delete(`${NODE_API_URL}/admin/api/prospects/${id}`, { headers: this.adminHeaders() });
    return response.data;
  }

  async seedProspects() {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/prospects/seed`, {}, { headers: this.adminHeaders() });
    return response.data;
  }

  async syncInstitutionIntelligence(limit?: number) {
    const qs = typeof limit === 'number' ? `?limit=${limit}` : '';
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/sync${qs}`, {}, { headers: this.adminHeaders() });
    return response.data;
  }

  async refreshInstitutionIntelligence(limit?: number, staleOnly: boolean = true) {
    const params = new URLSearchParams();
    if (typeof limit === 'number') params.set('limit', String(limit));
    params.set('staleOnly', String(staleOnly));
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/refresh${qs}`, {}, { headers: this.adminHeaders() });
    return response.data;
  }

  async getInstitutionIntelligenceAccounts(limit?: number): Promise<IntelligenceAccountSummary[]> {
    const qs = typeof limit === 'number' ? `?limit=${limit}` : '';
    const response = await this.client.get(`${NODE_API_URL}/admin/api/intelligence/accounts${qs}`, { headers: this.adminHeaders() });
    return response.data;
  }

  async getProspectDossier(id: string): Promise<ProspectDossierDetail> {
    const response = await this.client.get(`${NODE_API_URL}/admin/api/prospects/${id}/dossier`, { headers: this.adminHeaders() });
    return response.data;
  }

  async refreshProspectDossier(id: string): Promise<ProspectDossierDetail> {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/prospects/${id}/dossier/refresh`, {}, { headers: this.adminHeaders() });
    return response.data;
  }

  async downloadProspectDossierCsv(id: string): Promise<void> {
    const response = await this.client.get(`${NODE_API_URL}/admin/api/prospects/${id}/dossier/export.csv`, {
      headers: this.adminHeaders(),
      responseType: 'text',
    });
    const blob = new Blob([response.data], { type: 'text/csv;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `prospect-dossier-${id}.csv`;
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
    URL.revokeObjectURL(url);
  }

  // ── Demo Portal Provisioning (sales: prospect → portal magic link) ──

  async provisionDemoPortal(
    prospectId: string,
    options: {
      contactEmail?: string;
      contactName?: string;
      ttlDays?: number;
      preferredLanguage?: 'en' | 'es';
      sendEmail?: boolean;
    } = {},
  ): Promise<{
    prospectId: string;
    userId: string;
    institutionId: string;
    reportJobId: string;
    magicLinkUrl: string;
    expiresAt: string;
    provisionedAt: string;
    contactEmail: string;
    reused: boolean;
    source: string;
    asOfQuarter: string | null;
    disclosure: string;
    reportPortalUrl: string;
  }> {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/prospects/${prospectId}/provision-portal`,
      options,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async bulkProvisionDemoPortals(payload: {
    prospectIds: string[];
    ttlDays?: number;
    sendEmail?: boolean;
  }): Promise<{
    total: number;
    provisioned: number;
    failed: Array<{ prospectId: string; error: string | null }>;
    results: Array<{
      prospectId: string;
      magicLinkUrl: string;
      expiresAt: string;
      reused: boolean;
    }>;
  }> {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/prospects/provision-portal/bulk`,
      payload,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async listDemoSeats(
    filter: 'active' | 'expired' | 'all' = 'all',
  ): Promise<
    Array<{
      prospectId: string;
      institutionName: string;
      contactEmail: string | null;
      contactName: string | null;
      institutionType: string;
      location: string | null;
      publicDataSource: string | null;
      demoUserId: string | null;
      reportJobId: string | null;
      provisionedAt: string | null;
      expiresAt: string | null;
      lastViewedAt: string | null;
      magicLinkUrl: string | null;
      outreachStatus: string;
      daysRemaining: number | null;
      status: 'active' | 'expired';
      hasBeenViewed: boolean;
    }>
  > {
    const response = await this.client.get(
      `${NODE_API_URL}/admin/api/demo-seats?filter=${filter}`,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async sweepDemoSeats(): Promise<{
    scanned: number;
    expired: number;
    expiredIds: string[];
  }> {
    const response = await this.client.post(
      `${NODE_API_URL}/admin/api/demo-seats/sweep`,
      {},
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async getDemoSeatAnalytics(): Promise<DemoSeatAnalytics> {
    const response = await this.client.get(
      `${NODE_API_URL}/admin/api/demo-seats/analytics`,
      { headers: this.adminHeaders() },
    );
    return response.data;
  }

  async downloadProspectSampleReport(id: string, lang: 'en' | 'es' = 'es'): Promise<void> {
    const response = await this.client.get(`${NODE_API_URL}/admin/api/prospects/${id}/dossier/sample-report?lang=${lang}`, {
      headers: this.adminHeaders(),
      responseType: 'blob',
    });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-report-${id}-${lang}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  async completeIntelligenceAction(actionId: string) {
    const response = await this.client.post(`${NODE_API_URL}/admin/api/intelligence/actions/${actionId}/complete`, {}, { headers: this.adminHeaders() });
    return response.data;
  }

  // --- Scenario Persistence ---

  async saveScenario(data: {
    institutionId: string;
    name: string;
    description?: string;
    scenarioType: string;
    parameters: StressScenarioParams;
    results?: StressScenarioResult;
    tags?: string[];
  }): Promise<SavedStressScenario> {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/save`, data);
    return response.data;
  }

  async listScenarios(institutionId: string, opts?: { page?: number; tag?: string }): Promise<ScenarioListResponse> {
    const params = new URLSearchParams();
    if (opts?.page) params.set('page', String(opts.page));
    if (opts?.tag) params.set('tag', opts.tag);
    const qs = params.toString() ? `?${params.toString()}` : '';
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/scenarios${qs}`);
    return response.data;
  }

  async getScenario(scenarioId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/scenarios/${scenarioId}`);
    return response.data;
  }

  async compareScenarios(scenarioIds: string[]): Promise<ScenarioComparisonResponse> {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/compare`, { scenarioIds });
    return response.data;
  }

  async duplicateScenario(scenarioId: string, name?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/${scenarioId}/duplicate`, { name });
    return response.data;
  }

  async deleteScenario(scenarioId: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/scenarios/${scenarioId}/delete`);
    return response.data;
  }

  // --- Yield Curve ---

  async getYieldCurveAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/yield-curve-analysis`);
    return response.data;
  }

  async applyYieldCurveShocks(data: { curveId?: string; shockType: string; customShocks?: Record<string, number> }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/yield-curve/shocks`, data);
    return response.data;
  }

  async saveCustomYieldCurve(data: {
    institutionId: string;
    name: string;
    tenors: Array<{ tenor: number; rate: number }>;
    source?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/yield-curve/custom`, data);
    return response.data;
  }

  // --- CECL ---

  async getCECLAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/cecl`);
    return response.data;
  }

  async importLoanSegments(institutionId: string, segments: JsonObjectArray) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/cecl/segments`, { segments });
    return response.data;
  }

  async getCECLForecast(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/cecl/forecast`);
    return response.data;
  }

  async runWARMCalculation(data: {
    segments: Array<{ segmentName: string; balance: number; weightedAvgMaturity: number; historicalLossRate: number; qualitativeAdj?: number }>;
    macroScenario?: string;
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/cecl/warm`, data);
    return response.data;
  }

  // --- FTP ---

  async getFTPAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ftp`);
    return response.data;
  }

  async getFTPSegments(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ftp/segments`);
    return response.data;
  }

  async runCustomFTP(institutionId: string, data: { curveId?: string; spreadAdjBps?: number }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/ftp/custom`, data);
    return response.data;
  }

  // --- Advanced Liquidity ---

  async getAdvancedLiquidity(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/liquidity-advanced`);
    return response.data;
  }

  // --- Concentration ---

  async getConcentrationAnalysis(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/concentration`);
    return response.data;
  }

  // --- NCUA Auto-Pull ---

  async pullNCUAData(charterNumber: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/ncua/pull`, { charterNumber });
    return response.data;
  }

  // --- Phase IV: AI Advisor v2 ---

  async getAdvisorNarrative(institutionId: string, lang: string = 'en') {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/advisor/narrative?lang=${lang}`);
    return response.data;
  }

  async getHealthScore(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/advisor/health-score`);
    return response.data;
  }

  // --- Phase IV: COSSEC Stress Pack ---

  async getStressPack(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/stress-pack`);
    return response.data;
  }

  // --- Phase IV: IRR Policy Engine ---

  async getIRRPolicyDashboard(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/irr-policy`);
    return response.data;
  }

  async getIRRPolicyLimits(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/irr-policy/limits`);
    return response.data;
  }

  async saveIRRPolicyLimits(institutionId: string, limits: JsonObjectArray) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/irr-policy/limits`, { limits });
    return response.data;
  }

  // --- Phase IV: Deposit Beta Benchmark ---

  async getDepositBetaBenchmark(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/deposit-beta/benchmark`);
    return response.data;
  }

  // --- Phase IV: Repricing Gap ---

  async getRepricingGap(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/repricing-gap`);
    return response.data;
  }

  // --- Phase IV: FTP Attribution ---

  async getFTPAttribution(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ftp/attribution`);
    return response.data;
  }

  // --- Phase IV: Forward Simulation ---

  async runForwardSimulation(institutionId: string, config?: {
    horizon?: number;
    growthAssumptions?: Record<string, number>;
    ratePaths?: string[];
  }) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/forward-simulation`, config ?? {});
    return response.data;
  }

  // --- Phase IV: Peer Analytics ---

  async getPeerAnalytics(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/peer-analytics`);
    return response.data;
  }

  // --- Phase V: OAS ---

  async getOASPortfolio(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/oas`);
    return response.data;
  }

  // --- Phase V: Credit Risk Quant ---

  async getCreditRisk(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/credit-risk`);
    return response.data;
  }

  // --- Phase V: VaR ---

  async getVaRSuite(institutionId: string, confidence: 95 | 99 = 95, horizon: 1 | 10 = 1) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/var?confidence=${confidence}&horizon=${horizon}`);
    return response.data;
  }

  // --- Phase V: Capital Optimizer ---

  async optimizeCapital(institutionId: string, aggressiveness: 'conservative' | 'moderate' | 'aggressive' = 'moderate') {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/optimize`, { aggressiveness });
    return response.data;
  }

  // --- Phase V: Asset EWS ---

  async getAssetEWS(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/ews`);
    return response.data;
  }

  // --- Phase V: SOFR Exposure ---

  async getSOFRExposure(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/sofr-exposure`);
    return response.data;
  }

  // --- Phase V: Treasury Rates ---

  async getTreasuryRates() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/treasury/rates`);
    return response.data;
  }

  // --- V6+V7: Regulatory Alerts ---

  async getAlerts(institutionId: string, unreadOnly = false) {
    const qs = unreadOnly ? '?unreadOnly=true' : '';
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/alerts${qs}`);
    return response.data;
  }

  // --- V6+V7: CAMEL Forecast ---

  async getCamelForecast(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/camel-forecast`);
    return response.data;
  }

  // --- V6+V7: Peer Synthesis ---

  async getPeerSynthesis() {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/peer-synthesis/latest`);
    return response.data;
  }

  // --- V6+V7: DFAST Stress v2 ---

  async runStressV2(institutionId: string, scenarioId?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/stress-v2/run`, { scenarioId });
    return response.data;
  }

  async runAllStressV2(institutionId: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/stress-v2/run-all`);
    return response.data;
  }

  // --- V6+V7: Robust Optimizer ---

  async robustOptimize(institutionId: string, aggressiveness?: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/${institutionId}/robust-optimize`, { aggressiveness });
    return response.data;
  }

  // --- V6+V7: Optionality Suite ---

  async getOptionality(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/optionality`);
    return response.data;
  }

  // --- V6+V7: Credit Concentration VaR ---

  async getConcentrationVaR(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/concentration-var`);
    return response.data;
  }

  // --- V6+V7: Demo Workspace ---

  async buildDemoWorkspace(charterNumber: string, demoLabel: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/demo/build`, { charterNumber, demoLabel });
    return response.data;
  }

  // --- V6+V7: Onboarding ---

  async getOnboardingStatus(institutionId: string) {
    const response = await this.client.get(`${NODE_API_URL}/api/alm/${institutionId}/onboarding`);
    return response.data;
  }

  // --- Sample Report Factory ---

  async generateSampleReport(charterNumber: string) {
    const response = await this.client.post(`${NODE_API_URL}/api/alm/sample-report`, { charterNumber }, { responseType: 'blob' });
    const blob = new Blob([response.data], { type: 'application/pdf' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `sample-alm-report-${charterNumber}.pdf`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }
}

export const apiClient = new APIClient();
