import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import axios from 'axios';

const mockAxiosInstance = {
  delete: vi.fn(),
  get: vi.fn(),
  interceptors: {
    request: { use: vi.fn() },
    response: { use: vi.fn() },
  },
  post: vi.fn(),
  put: vi.fn(),
  request: vi.fn(),
};

// Mock axios before importing apiClient
vi.mock('axios', async () => {
  return {
    default: {
      create: vi.fn(() => mockAxiosInstance),
      post: vi.fn(),
    },
  };
});

// Mock the marketTransport dependency
vi.mock('./marketTransport', () => ({
  getMarketApiBase: vi.fn(() => 'https://market-api.test'),
}));

describe('APIClient', () => {
  beforeEach(() => {
    vi.resetModules();
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
    mockAxiosInstance.delete.mockReset();
    mockAxiosInstance.get.mockReset();
    mockAxiosInstance.interceptors.request.use.mockReset();
    mockAxiosInstance.interceptors.response.use.mockReset();
    mockAxiosInstance.post.mockReset();
    mockAxiosInstance.put.mockReset();
    mockAxiosInstance.request.mockReset();
    sessionStorage.clear();
    localStorage.clear();
  });

  it('creates an axios instance with correct baseURL config', async () => {
    // Re-import to trigger constructor
    await import('./api');

    expect(axios.create).toHaveBeenCalledWith(
      expect.objectContaining({
        headers: { 'Content-Type': 'application/json' },
        withCredentials: true,
      })
    );
  });

  it('sets up request and response interceptors', async () => {
    await import('./api');

    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    expect(mockInstance.interceptors.request.use).toHaveBeenCalled();
    expect(mockInstance.interceptors.response.use).toHaveBeenCalled();
  });

  it('exports apiClient with expected methods', async () => {
    const { apiClient } = await import('./api');

    // Core authentication methods
    expect(typeof apiClient.register).toBe('function');
    expect(typeof apiClient.login).toBe('function');
    expect(typeof apiClient.logout).toBe('function');
    expect(typeof apiClient.getCurrentUser).toBe('function');
    expect(typeof apiClient.requestPasswordReset).toBe('function');
    expect(typeof apiClient.confirmPasswordReset).toBe('function');

    // Risk analysis
    expect(typeof apiClient.getRiskAnalysis).toBe('function');

    // Admin methods
    expect(typeof apiClient.getDemoRequests).toBe('function');
    expect(typeof apiClient.getAdminStats).toBe('function');
    expect(typeof apiClient.getAdminControlTowerSummary).toBe('function');
    expect(typeof apiClient.runAdminControlTowerAction).toBe('function');
    expect(typeof apiClient.getAdminOps).toBe('function');
    expect(typeof apiClient.getAdminPipeline).toBe('function');
    expect(typeof apiClient.runAdminPipelineAction).toBe('function');
    expect(typeof apiClient.getAdminRevenueMetrics).toBe('function');
    expect(typeof apiClient.getAdminAuditLogs).toBe('function');
    expect(typeof apiClient.getAdminLeads).toBe('function');
    expect(typeof apiClient.getAdminLeadMetrics).toBe('function');
    expect(typeof apiClient.updateAdminLead).toBe('function');
    expect(typeof apiClient.addAdminLeadNote).toBe('function');
    expect(typeof apiClient.markAdminReportSent).toBe('function');
    expect(typeof apiClient.getExitMetrics).toBe('function');
  });

  it('preserves dashboard return URLs in the magic-link login flow', async () => {
    const { buildLoginRedirectUrl } = await import('./api');

    expect(buildLoginRedirectUrl('/dashboard')).toBe(
      '/login?returnUrl=%2Fdashboard&mode=magic-link',
    );
    expect(buildLoginRedirectUrl('/dashboard/report/job-1')).toBe(
      '/login?returnUrl=%2Fdashboard%2Freport%2Fjob-1&mode=magic-link',
    );
  });

  it('marks passive profile checks to skip auth redirects', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({ data: { id: 'u_1', email: 'test@cerniq.io' } });

    await apiClient.getCurrentUser();

    expect(mockInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/profile'),
      expect.objectContaining({ skipAuthRedirect: true })
    );
  });

  it('unwraps enveloped profile responses', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: { id: 'u_1', email: 'test@cerniq.io' },
      },
    });

    await expect(apiClient.getCurrentUser()).resolves.toEqual({
      id: 'u_1',
      email: 'test@cerniq.io',
    });
  });

  it('loads the canonical portal overview envelope', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          jobs: [],
          latestActionableJob: null,
          workflowState: 'needs_report',
          counts: {
            total: 0,
            awaitingData: 0,
            validationFailed: 0,
            processing: 0,
            complete: 0,
          },
          demoSeat: null,
          nextAction: {
            labelEn: 'Create report',
            labelEs: 'Crear informe',
            href: '/portal',
            jobId: null,
            explanationEn: 'Start a report cycle.',
            explanationEs: 'Inicia un ciclo.',
          },
          validationSummary: null,
        },
      },
    });

    await expect(apiClient.getPortalOverview()).resolves.toMatchObject({
      workflowState: 'needs_report',
      jobs: [],
    });
    expect(mockInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/portal/overview'),
    );
  });

  it('returns normalized lead metadata from demo request submissions', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.post
      .mockResolvedValueOnce({
        data: {
          success: true,
          data: {
            leadId: 'lead-123',
            message: "We'll have your sample report ready within 48 hours.",
            duplicate: false,
          },
        },
      })
      .mockResolvedValueOnce({
        data: {
          id: 'demo-123',
          message: 'Demo request received',
        },
      });

    await expect(
      apiClient.submitDemoRequest({
        email: 'maria@coop.pr',
        name: 'Maria',
        institutionName: 'Coop PR',
        institutionType: 'cooperativa',
        totalAssets: '$42,000,000',
      }),
    ).resolves.toEqual({
      leadId: 'lead-123',
      demoRequestId: 'demo-123',
      institutionName: 'Coop PR',
      institutionType: 'cooperativa',
      message: 'Demo request received',
      duplicateLead: false,
    });
  });

  it('loads portal job detail through the canonical report endpoint', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: {
          id: 'job-1',
          institutionId: 'inst-1',
          institutionName: 'CoopAhorro',
          status: 'COMPLETE',
          analysisPeriod: 'Q1-2026',
          previousJobId: null,
          submittedAt: null,
          processingStartedAt: null,
          completedAt: '2026-04-18T00:00:00.000Z',
          createdAt: '2026-04-18T00:00:00.000Z',
          reportUrl: null,
          reportUrlEn: null,
          reportLang: 'es',
          errorMessage: null,
          userId: 'u_1',
          triggeredBy: 'portal_cycle_bootstrap',
          exportSummary: {
            manifestPath: '/api/portal/jobs/job-1/exports',
            status: 'ready',
            readyCount: 4,
            totalCount: 4,
            readyReportLanguages: ['es', 'en'],
            missingReportLanguages: [],
            readyBoardPackLanguages: ['es', 'en'],
            missingBoardPackLanguages: [],
          },
        },
      },
    });

    await expect(apiClient.getPortalJob('job-1')).resolves.toMatchObject({
      id: 'job-1',
      exportSummary: expect.objectContaining({ status: 'ready' }),
    });
    expect(mockInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/portal/jobs/job-1'),
    );
  });

  it('loads portal export manifests through the canonical exports endpoint', async () => {
    const { apiClient } = await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    mockInstance.get.mockResolvedValueOnce({
      data: {
        success: true,
        data: [
          {
            id: 'alm_report-job-1-es',
            kind: 'alm_report',
            language: 'es',
            status: 'ready',
            downloadUrl: '/api/portal/jobs/job-1/alm-report?lang=es',
          },
        ],
      },
    });

    await expect(apiClient.getPortalJobExports('job-1')).resolves.toEqual([
      expect.objectContaining({
        kind: 'alm_report',
        language: 'es',
      }),
    ]);
    expect(mockInstance.get).toHaveBeenCalledWith(
      expect.stringContaining('/api/portal/jobs/job-1/exports'),
    );
  });

  it('does not attempt token refresh for skipAuthRedirect requests', async () => {
    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];
    const error = {
      response: { status: 401 },
      config: { skipAuthRedirect: true },
    };

    await expect(handleRejected(error)).rejects.toBe(error);
    expect(axios.post).not.toHaveBeenCalled();
  });

  it('retries strict-auth requests after a successful silent refresh', async () => {
    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];

    (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 200,
      data: { accessToken: 'fresh-token' },
    });
    mockInstance.request.mockResolvedValueOnce({ data: { items: [] } });

    await expect(
      handleRejected({
        response: { status: 401 },
        config: { headers: {}, url: '/api/alm/institutions' },
      })
    ).resolves.toEqual({ data: { items: [] } });

    expect(axios.post).toHaveBeenCalledWith(
      '/api/auth/refresh',
      {},
      expect.objectContaining({ withCredentials: true })
    );
    expect(mockInstance.request).toHaveBeenCalledWith(
      expect.objectContaining({
        _retry401: true,
        headers: expect.objectContaining({ Authorization: 'Bearer fresh-token' }),
      })
    );
  });

  it('redirects strict-auth requests to login when refresh fails', async () => {
    const originalLocation = window.location;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/alm',
        search: '?id=inst-1',
      },
    });

    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];

    (axios.post as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      status: 404,
      data: { message: 'Not found' },
    });

    const error = {
      response: { status: 401 },
      config: { headers: {}, url: '/api/alm/institutions' },
    };

    await expect(handleRejected(error)).rejects.toBe(error);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cerniq:navigate',
        detail: {
          href: '/login?returnUrl=%2Falm%3Fid%3Dinst-1',
          replace: true,
        },
      }),
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  it('exports apiClient as a singleton', async () => {
    const mod1 = await import('./api');
    const mod2 = await import('./api');

    expect(mod1.apiClient).toBe(mod2.apiClient);
  });

  describe('seedDemoInstitution (Phase 1 complete — all types through fixtures)', () => {
    const fixtureResponse = (seedKey: string, name: string) => ({
      data: {
        institutionId: `inst-${seedKey}`,
        seedKey,
        delta: {
          institution: 'created',
          balanceSheetItems: { before: 0, after: 10, replaced: true },
          liquidityPosition: 'created',
        },
        fixture: { seedKey, name, itemCount: 10 },
      },
    });

    it('routes cooperativa through the idempotent fixture endpoint', async () => {
      const { apiClient } = await import('./api');
      mockAxiosInstance.post.mockResolvedValueOnce(
        fixtureResponse('pr-cooperativa-demo', 'CoopAhorro San Juan'),
      );

      const result = await apiClient.seedDemoInstitution('ws-1', 'cooperativa');

      expect(mockAxiosInstance.post).toHaveBeenCalledWith(
        expect.stringContaining('/api/alm/institutions/seed'),
        { workspaceId: 'ws-1', fixture: 'pr-cooperativa-demo' },
      );
      expect(result.institutionId).toBe('inst-pr-cooperativa-demo');
      expect(result.institution.seedKey).toBe('pr-cooperativa-demo');
      expect(result.delta.institution).toBe('created');
    });

    it.each([
      ['bank', 'pr-bank-demo', 'Banco Comunidad PR'],
      ['credit_union', 'pr-credit-union-demo', 'CoopAhorro PR'],
      ['family_office', 'pr-family-office-demo', 'Caribbean Family Capital'],
    ] as const)(
      'routes %s through the fixture endpoint (not legacy seed-demo)',
      async (type, fixture, name) => {
        const { apiClient } = await import('./api');
        mockAxiosInstance.post.mockResolvedValueOnce(
          fixtureResponse(fixture, name),
        );

        const result = await apiClient.seedDemoInstitution('ws-1', type);

        // Every institution type — including legacy ones — now uses the
        // idempotent fixture endpoint. The deprecated /api/alm/seed-demo
        // path must never be hit from the frontend.
        expect(mockAxiosInstance.post).toHaveBeenCalledWith(
          expect.stringContaining('/api/alm/institutions/seed'),
          { workspaceId: 'ws-1', fixture },
        );
        expect(mockAxiosInstance.post).not.toHaveBeenCalledWith(
          expect.stringContaining('/api/alm/seed-demo'),
          expect.anything(),
        );
        expect(result.institution.type).toBe(type);
        expect(result.institution.seedKey).toBe(fixture);
      },
    );

    it('propagates errors instead of returning a phantom demo-bank-id (D1)', async () => {
      const { apiClient } = await import('./api');
      const boom = new Error('backend unavailable');
      mockAxiosInstance.post.mockRejectedValueOnce(boom);

      await expect(
        apiClient.seedDemoInstitution('ws-1', 'cooperativa'),
      ).rejects.toBe(boom);
    });

    it('is idempotent across repeated calls for the same fixture', async () => {
      const { apiClient } = await import('./api');
      const first = {
        data: {
          institutionId: 'inst-coop-1',
          seedKey: 'pr-cooperativa-demo',
          delta: {
            institution: 'created',
            balanceSheetItems: { before: 0, after: 10, replaced: true },
            liquidityPosition: 'created',
          },
          fixture: { seedKey: 'pr-cooperativa-demo', name: 'CoopAhorro San Juan', itemCount: 10 },
        },
      };
      const second = {
        data: {
          ...first.data,
          delta: {
            institution: 'unchanged',
            balanceSheetItems: { before: 10, after: 10, replaced: false },
            liquidityPosition: 'unchanged',
          },
        },
      };
      mockAxiosInstance.post.mockResolvedValueOnce(first).mockResolvedValueOnce(second);

      const a = await apiClient.seedDemoInstitution('ws-1', 'cooperativa');
      const b = await apiClient.seedDemoInstitution('ws-1', 'cooperativa');

      expect(a.institutionId).toBe(b.institutionId);
      expect(b.delta.institution).toBe('unchanged');
    });
  });

  it('routes email/password login through the backend even when Supabase envs are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { apiClient } = await import('./api');
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { user: { id: 'user-1', email: 'analyst@example.com' } },
    });

    await apiClient.login('analyst@example.com', 'UltraSecret123!');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/login'),
      expect.objectContaining({ email: 'analyst@example.com' }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes email/password signup through the backend even when Supabase envs are set', async () => {
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_URL', 'https://project.supabase.co');
    vi.stubEnv('NEXT_PUBLIC_SUPABASE_ANON_KEY', 'anon-key');
    const fetchSpy = vi.spyOn(global, 'fetch');
    const { apiClient } = await import('./api');
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { user: { id: 'user-2', email: 'newuser@example.com' } },
    });

    await apiClient.register('newuser@example.com', 'UltraSecret123!', 'New User');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/register'),
      expect.objectContaining({
        email: 'newuser@example.com',
        name: 'New User',
      }),
    );
    expect(fetchSpy).not.toHaveBeenCalled();
  });

  it('routes password reset requests through the backend', async () => {
    const { apiClient } = await import('./api');
    mockAxiosInstance.post.mockResolvedValueOnce({
      data: { message: 'If that email exists, a reset link has been sent' },
    });

    await apiClient.requestPasswordReset('USER@Example.com');

    expect(mockAxiosInstance.post).toHaveBeenCalledWith(
      expect.stringContaining('/api/auth/password-reset'),
      { email: 'user@example.com' },
    );
  });

  it('routes platform access failures through the client navigation event', async () => {
    const originalLocation = window.location;
    const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
    Object.defineProperty(window, 'location', {
      configurable: true,
      value: {
        ...window.location,
        pathname: '/alm',
        search: '',
      },
    });

    await import('./api');
    const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock.results[0].value;
    const [, handleRejected] = mockInstance.interceptors.response.use.mock.calls[0];

    const error = {
      response: {
        status: 403,
        data: { code: 'PLATFORM_ACCESS_REQUIRED' },
      },
      config: { headers: {}, url: '/api/alm/institutions' },
    };

    await expect(handleRejected(error)).rejects.toBe(error);
    expect(dispatchSpy).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'cerniq:navigate',
        detail: {
          href: '/access-required',
          replace: true,
        },
      }),
    );

    Object.defineProperty(window, 'location', {
      configurable: true,
      value: originalLocation,
    });
  });

  // The examiner Excel workbook download. Locks the full contract: the route,
  // the authenticated blob transport, the legacy ms-excel MIME (NOT OOXML —
  // the backend streams XML SpreadsheetML), Content-Disposition precedence,
  // the .xls fallback name, Spanish-first lang coercion, and the anchor
  // create→click→revoke lifecycle. A regression here is a broken or
  // mistyped download for a regulator-facing artifact.
  describe('downloadAlmExcel (examiner Excel workbook)', () => {
    const origCreateObjectURL = URL.createObjectURL;
    const origRevokeObjectURL = URL.revokeObjectURL;
    let clickSpy: ReturnType<typeof vi.fn>;
    let anchor: {
      href: string;
      download: string;
      click: ReturnType<typeof vi.fn>;
    };
    let appendChildSpy: ReturnType<typeof vi.spyOn>;
    let removeChildSpy: ReturnType<typeof vi.spyOn>;

    beforeEach(() => {
      clickSpy = vi.fn();
      anchor = { href: '', download: '', click: clickSpy };
      vi.spyOn(document, 'createElement').mockReturnValue(
        anchor as unknown as HTMLAnchorElement,
      );
      appendChildSpy = vi
        .spyOn(document.body, 'appendChild')
        .mockImplementation((node) => node);
      removeChildSpy = vi
        .spyOn(document.body, 'removeChild')
        .mockImplementation((node) => node);
      // jsdom does not implement these; stub then restore in afterEach.
      URL.createObjectURL = vi.fn(() => 'blob:mock-url');
      URL.revokeObjectURL = vi.fn();
    });

    afterEach(() => {
      URL.createObjectURL = origCreateObjectURL;
      URL.revokeObjectURL = origRevokeObjectURL;
    });

    it('streams /export/excel as an application/vnd.ms-excel blob and honors Content-Disposition', async () => {
      const { apiClient } = await import('./api');
      const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock
        .results[0].value;
      mockInstance.get.mockResolvedValueOnce({
        data: new Blob(['<?xml version="1.0"?>'], {
          type: 'application/vnd.ms-excel',
        }),
        headers: {
          'content-disposition':
            'attachment; filename="cerniq-alm-report-abcd1234.xls"',
        },
      });

      await apiClient.downloadAlmExcel('inst-1', 'es');

      expect(mockInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/api/alm/inst-1/export/excel?lang=es'),
        expect.objectContaining({ responseType: 'blob' }),
      );
      const blobArg = (URL.createObjectURL as ReturnType<typeof vi.fn>).mock
        .calls[0][0] as Blob;
      expect(blobArg.type).toBe('application/vnd.ms-excel');
      expect(anchor.href).toBe('blob:mock-url');
      expect(anchor.download).toBe('cerniq-alm-report-abcd1234.xls');
      expect(appendChildSpy).toHaveBeenCalledWith(anchor);
      expect(clickSpy).toHaveBeenCalledTimes(1);
      expect(removeChildSpy).toHaveBeenCalledWith(anchor);
      expect(URL.revokeObjectURL).toHaveBeenCalledWith('blob:mock-url');
    });

    it('falls back to cossec-workbook-<id>.xls and defaults to Spanish when no header/lang given', async () => {
      const { apiClient } = await import('./api');
      const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock
        .results[0].value;
      mockInstance.get.mockResolvedValueOnce({
        data: new Blob(['data']),
        headers: {},
      });

      await apiClient.downloadAlmExcel('coop-9');

      expect(mockInstance.get).toHaveBeenCalledWith(
        expect.stringContaining('/export/excel?lang=es'),
        expect.objectContaining({ responseType: 'blob' }),
      );
      expect(anchor.download).toBe('cossec-workbook-coop-9.xls');
    });

    it('coerces lang Spanish-first: en stays en, any other value becomes es', async () => {
      const { apiClient } = await import('./api');
      const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock
        .results[0].value;
      mockInstance.get.mockResolvedValue({
        data: new Blob(['data']),
        headers: {},
      });

      await apiClient.downloadAlmExcel('i', 'en');
      expect(mockInstance.get).toHaveBeenLastCalledWith(
        expect.stringContaining('/export/excel?lang=en'),
        expect.objectContaining({ responseType: 'blob' }),
      );

      await apiClient.downloadAlmExcel('i', 'fr');
      expect(mockInstance.get).toHaveBeenLastCalledWith(
        expect.stringContaining('/export/excel?lang=es'),
        expect.objectContaining({ responseType: 'blob' }),
      );
    });

    it('propagates request failures so the UI surfaces them (no silent fallback, no phantom download)', async () => {
      const { apiClient } = await import('./api');
      const mockInstance = (axios.create as ReturnType<typeof vi.fn>).mock
        .results[0].value;
      mockInstance.get.mockRejectedValueOnce(new Error('500 export failed'));

      await expect(apiClient.downloadAlmExcel('i', 'es')).rejects.toThrow(
        '500 export failed',
      );
      expect(URL.createObjectURL).not.toHaveBeenCalled();
      expect(clickSpy).not.toHaveBeenCalled();
    });
  });
});
