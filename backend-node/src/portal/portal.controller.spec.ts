import { Test, TestingModule } from '@nestjs/testing';
import { ForbiddenException, NotFoundException } from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PrismaService } from '../prisma.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import { CSVIngestionService } from '../alm/csv-ingestion.service';
import { IngestionLogsService } from '../alm/ingestion-logs.service';
import { EmailService } from '../email/email.service';
import { DataCryptoService } from '../crypto/data-crypto.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';
import { PlatformAccessService } from '../auth/platform-access.service';
import { PortalDocumentExportsService } from './portal-document-exports.service';
import { PortalAlmReportService } from './portal-alm-report.service';
import { DemoSeatService } from './demo-seat.service';
import { OnboardingOrchestratorService } from '../alm/onboarding-orchestrator.service';

jest.mock('../prisma.service', () => ({
  PrismaService: jest.fn().mockImplementation(() => ({})),
}));

describe('PortalController', () => {
  let controller: PortalController;
  let prisma: Record<string, any>;
  let almEnterprise: Record<string, jest.Mock>;
  let csvIngestion: Record<string, jest.Mock>;
  let ingestionLogs: Record<string, jest.Mock>;
  let email: Record<string, jest.Mock>;
  let dataCrypto: Record<string, jest.Mock>;
  let billing: Record<string, jest.Mock>;
  let audit: Record<string, jest.Mock>;
  let portalExports: Record<string, jest.Mock>;
  let platformAccess: Record<string, jest.Mock>;
  let portalAlmReport: Record<string, jest.Mock>;
  let demoSeats: Record<string, jest.Mock>;
  let onboardingOrchestrator: Record<string, jest.Mock>;

  const mockReq = (userId = 'user-1') => ({
    user: { userId },
    ip: '127.0.0.1',
    headers: { 'user-agent': 'jest' },
  });

  beforeEach(async () => {
    prisma = {
      reportJob: {
        findMany: jest.fn(),
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
        create: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
      },
      ingestionLog: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      user: {
        findUnique: jest.fn(),
        create: jest.fn(),
      },
      subscription: { findUnique: jest.fn() },
      institution: {
        findMany: jest.fn().mockResolvedValue([]),
      },
      apiKey: {
        count: jest.fn().mockResolvedValue(0),
      },
      workspace: {
        findMany: jest.fn(),
        create: jest.fn(),
      },
    };

    almEnterprise = {
      getInstitution: jest.fn(),
      createInstitution: jest.fn(),
      importBalanceSheetItems: jest.fn(),
    };

    csvIngestion = {
      parseCSV: jest.fn(),
    };

    ingestionLogs = {
      recordLog: jest.fn().mockResolvedValue({ id: 'log-1' }),
      listJobLogs: jest.fn(),
    };

    email = {
      sendDataSubmissionAck: jest.fn().mockResolvedValue(undefined),
      sendTeamInviteEmail: jest.fn().mockResolvedValue(undefined),
    };

    dataCrypto = {
      encrypt: jest.fn().mockReturnValue('encrypted-data'),
    };

    billing = {
      generateMagicLink: jest
        .fn()
        .mockResolvedValue('https://cerniq.io/auth/magic?token=abc'),
    };

    audit = {
      log: jest.fn(),
    };

    portalExports = {
      listJobExports: jest.fn(),
      generateAlcoPackExport: jest.fn(),
    };

    portalAlmReport = {
      generateAlmReportExport: jest.fn().mockResolvedValue({
        manifest: { mimeType: 'application/pdf', filename: 'test.pdf' },
        buffer: Buffer.from('PDF'),
      }),
      buildDownloadUrl: jest
        .fn()
        .mockReturnValue('/api/portal/jobs/j1/alm-report?lang=es'),
      buildManifestStub: jest.fn(),
    };

    demoSeats = {
      provisionFromProspect: jest.fn(),
      markViewed: jest.fn().mockResolvedValue(undefined),
      getDemoSeatForUser: jest.fn().mockResolvedValue(null),
    };

    onboardingOrchestrator = {
      getOnboardingStatus: jest.fn().mockResolvedValue({
        institutionId: 'inst-1',
        milestones: [],
        activationScore: 0,
        daysSinceSignup: 0,
        isStalled: false,
        stalledMilestone: null,
      }),
    };

    platformAccess = {
      getAccessForUser: jest.fn().mockResolvedValue({
        platformAccessAllowed: true,
        isMasterCeo: false,
        isPaid: true,
        isDemo: false,
        effectiveTier: 'monthly',
        effectiveStatus: 'active',
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: 'paid',
      }),
      buildForbiddenPayload: jest.fn().mockImplementation((access) => ({
        code: 'PLATFORM_ACCESS_REQUIRED',
        access,
      })),
    };

    prisma.subscription.findUnique.mockResolvedValue({
      tier: 'monthly',
      status: 'active',
    });

    const module: TestingModule = await Test.createTestingModule({
      controllers: [PortalController],
      providers: [
        { provide: PrismaService, useValue: prisma },
        { provide: AlmEnterpriseService, useValue: almEnterprise },
        { provide: CSVIngestionService, useValue: csvIngestion },
        { provide: IngestionLogsService, useValue: ingestionLogs },
        { provide: EmailService, useValue: email },
        { provide: DataCryptoService, useValue: dataCrypto },
        { provide: BillingService, useValue: billing },
        { provide: AuditService, useValue: audit },
        { provide: PlatformAccessService, useValue: platformAccess },
        { provide: PortalDocumentExportsService, useValue: portalExports },
        { provide: PortalAlmReportService, useValue: portalAlmReport },
        { provide: DemoSeatService, useValue: demoSeats },
        {
          provide: OnboardingOrchestratorService,
          useValue: onboardingOrchestrator,
        },
      ],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .overrideGuard(RolesGuard)
      .useValue({ canActivate: () => true })
      .compile();

    controller = module.get<PortalController>(PortalController);
  });

  // ── listJobs ───────────────────────────────────

  describe('GET /api/portal/jobs', () => {
    it('should return jobs for authenticated user', async () => {
      const jobs = [
        { id: 'j1', institutionName: 'Coop ABC', status: 'COMPLETED' },
        { id: 'j2', institutionName: 'Coop XYZ', status: 'AWAITING_DATA' },
      ];
      prisma.reportJob.findMany.mockResolvedValue(jobs);

      const result = await controller.listJobs(mockReq());

      expect(result).toHaveLength(2);
      expect(prisma.reportJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user-1' },
          orderBy: { createdAt: 'desc' },
        }),
      );
    });

    it('should block free accounts from listing jobs', async () => {
      platformAccess.getAccessForUser.mockResolvedValueOnce({
        platformAccessAllowed: false,
        isMasterCeo: false,
        isPaid: false,
        isDemo: false,
        effectiveTier: 'free',
        effectiveStatus: null,
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: 'subscription_required',
      });

      await expect(controller.listJobs(mockReq())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.reportJob.findMany).not.toHaveBeenCalled();
    });

    it('master CEO sees all jobs across users (unscoped query)', async () => {
      platformAccess.getAccessForUser.mockResolvedValueOnce({
        platformAccessAllowed: true,
        isMasterCeo: true,
        isPaid: true,
        isDemo: false,
        effectiveTier: 'monthly',
        effectiveStatus: 'active',
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: 'master_ceo',
      });
      prisma.reportJob.findMany.mockResolvedValue([
        { id: 'j-master-1', userId: 'someone-else' },
        { id: 'j-master-2', userId: 'another-user' },
      ]);

      const result = await controller.listJobs(mockReq('master-ceo-id'));

      expect(result).toHaveLength(2);
      expect(prisma.reportJob.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: {}, // unscoped
          take: 200, // master CEO cap
        }),
      );
    });
  });

  describe('GET /api/portal/overview', () => {
    it('returns a needs-upload overview for awaiting-data jobs', async () => {
      prisma.reportJob.findMany.mockResolvedValue([
        {
          id: 'job-awaiting',
          institutionName: 'Coop San Juan',
          status: 'AWAITING_DATA',
          analysisPeriod: null,
          previousJobId: null,
          submittedAt: null,
          processingStartedAt: null,
          completedAt: null,
          createdAt: new Date('2026-04-08T10:00:00Z'),
          reportUrl: null,
          reportUrlEn: null,
          reportLang: 'es',
          errorMessage: null,
          userId: 'user-1',
          triggeredBy: 'portal_submit_seed',
        },
      ]);
      platformAccess.getAccessForUser.mockResolvedValue({
        platformAccessAllowed: true,
        isMasterCeo: false,
        isPaid: false,
        isDemo: true,
        effectiveTier: 'demo',
        effectiveStatus: 'active',
        effectivePeriodEnd: '2026-04-10T09:00:00.000Z',
        daysRemaining: 2,
        reason: 'demo_active',
      });
      demoSeats.getDemoSeatForUser.mockResolvedValue({
        id: 'prospect-1',
        name: 'Coop San Juan',
        publicDataSource: 'cossec',
        demoProvisionedAt: new Date('2026-04-08T09:00:00Z'),
        demoExpiresAt: new Date('2026-04-10T09:00:00Z'),
        demoReportJobId: 'job-awaiting',
      });

      const result = await controller.getOverview(mockReq());

      expect(result.workflowState).toBe('needs_upload');
      expect(result.latestActionableJob?.id).toBe('job-awaiting');
      expect(result.counts.awaitingData).toBe(1);
      expect(result.nextAction.href).toBe('/portal/submit?jobId=job-awaiting');
      expect(result.demoSeat.seat?.reportJobId).toBe('job-awaiting');
      expect(result.access).toEqual(
        expect.objectContaining({ platformAccessAllowed: true, isDemo: true }),
      );
    });

    it('returns validation summary for validation-failed jobs', async () => {
      prisma.reportJob.findMany.mockResolvedValue([
        {
          id: 'job-failed',
          institutionName: 'Coop Validation',
          status: 'VALIDATION_FAILED',
          analysisPeriod: 'Q1-2026',
          previousJobId: null,
          submittedAt: new Date('2026-04-08T11:00:00Z'),
          processingStartedAt: null,
          completedAt: null,
          createdAt: new Date('2026-04-08T10:00:00Z'),
          reportUrl: null,
          reportUrlEn: null,
          reportLang: 'es',
          errorMessage: 'row 4 balance: invalid number',
          userId: 'user-1',
          triggeredBy: 'portal_submit',
        },
      ]);
      prisma.ingestionLog.findFirst.mockResolvedValue({
        sourceFilename: 'coop.csv',
        status: 'FAILED',
        totalRows: 40,
        validRows: 38,
        errorRows: 2,
        importedCount: 0,
        warnings: ['Duration missing for one row'],
        errors: [{ row: 4, field: 'balance', message: 'invalid number' }],
      });

      const result = await controller.getOverview(mockReq());

      expect(result.workflowState).toBe('validation_failed');
      expect(result.validationSummary).toEqual(
        expect.objectContaining({
          sourceFilename: 'coop.csv',
          warningCount: 1,
          errorCount: 1,
        }),
      );
      expect(result.nextAction.href).toBe('/portal/submit?jobId=job-failed');
    });

    it('returns activation context when the latest job is linked to an institution', async () => {
      prisma.reportJob.findMany.mockResolvedValue([
        {
          id: 'job-complete',
          institutionId: 'inst-activation',
          institutionName: 'Coop Activation',
          status: 'COMPLETE',
          analysisPeriod: 'Q1-2026',
          previousJobId: null,
          submittedAt: new Date('2026-04-08T11:00:00Z'),
          processingStartedAt: new Date('2026-04-08T11:05:00Z'),
          completedAt: new Date('2026-04-08T11:30:00Z'),
          createdAt: new Date('2026-04-08T10:00:00Z'),
          reportUrl: 'https://r2.example/report.pdf',
          reportUrlEn: null,
          reportLang: 'es',
          errorMessage: null,
          userId: 'user-1',
          triggeredBy: 'portal_submit',
        },
      ]);
      onboardingOrchestrator.getOnboardingStatus.mockResolvedValueOnce({
        institutionId: 'inst-activation',
        activationScore: 2,
        daysSinceSignup: 4,
        isStalled: true,
        stalledMilestone: 'first_analysis',
        milestones: [
          {
            id: 'data_loaded',
            label: 'Balance sheet data loaded',
            labelEs: 'Datos de balance cargados',
            completed: true,
            completedAt: '2026-04-08T10:00:00.000Z',
          },
          {
            id: 'first_analysis',
            label: 'First ALM analysis run',
            labelEs: 'Primer análisis ALM ejecutado',
            completed: false,
            completedAt: null,
          },
        ],
      });

      const result = await controller.getOverview(mockReq());

      expect(result.activation).toEqual(
        expect.objectContaining({
          institutionId: 'inst-activation',
          activationScore: 2,
          isStalled: true,
          stalledMilestoneLabel: 'First ALM analysis run',
        }),
      );
    });
  });

  describe('POST /api/portal/jobs/open-cycle', () => {
    it('reuses an existing validation-failed job before creating a new one', async () => {
      prisma.reportJob.findMany.mockResolvedValue([
        {
          id: 'job-retry',
          institutionId: 'inst-1',
          institutionName: 'Retry Coop',
          status: 'VALIDATION_FAILED',
          analysisPeriod: 'Q1-2026',
          previousJobId: null,
          submittedAt: null,
          processingStartedAt: null,
          completedAt: null,
          createdAt: new Date('2026-04-08T10:00:00Z'),
          reportUrl: null,
          reportUrlEn: null,
          reportLang: 'es',
          errorMessage: 'bad row',
          userId: 'user-1',
          triggeredBy: 'portal_submit',
        },
      ]);

      const result = await controller.openReportCycle(mockReq());

      expect(result.created).toBe(false);
      expect(result.reopened).toBe(true);
      expect(result.job.id).toBe('job-retry');
      expect(prisma.reportJob.create).not.toHaveBeenCalled();
    });

    it('creates a new awaiting-data job when no uploadable job exists', async () => {
      prisma.reportJob.findMany.mockResolvedValue([
        {
          id: 'job-complete',
          institutionId: 'inst-complete',
          institutionName: 'Coop Complete',
          status: 'COMPLETE',
          analysisPeriod: 'Q1-2026',
          previousJobId: null,
          submittedAt: null,
          processingStartedAt: null,
          completedAt: new Date('2026-04-08T11:00:00Z'),
          createdAt: new Date('2026-04-08T10:00:00Z'),
          reportUrl: 'https://r2.example/report.pdf',
          reportUrlEn: null,
          reportLang: 'es',
          errorMessage: null,
          userId: 'user-1',
          triggeredBy: 'payment',
        },
      ]);
      prisma.workspace.findMany.mockResolvedValue([
        { name: 'Coop Complete Workspace' },
      ]);
      prisma.reportJob.findFirst.mockResolvedValueOnce({
        id: 'job-complete',
      });
      prisma.reportJob.create = jest.fn().mockResolvedValue({
        id: 'job-new',
        institutionId: 'inst-complete',
        institutionName: 'Coop Complete',
        status: 'AWAITING_DATA',
      });

      const result = await controller.openReportCycle(mockReq());

      expect(result.created).toBe(true);
      expect(result.reopened).toBe(false);
      expect(result.nextActionHref).toBe('/portal/submit?jobId=job-new');
      expect(prisma.reportJob.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            institutionId: 'inst-complete',
            institutionName: 'Coop Complete',
            status: 'AWAITING_DATA',
            triggeredBy: 'portal_open_cycle',
          }),
        }),
      );
    });
  });

  // ── getJob ─────────────────────────────────────

  describe('GET /api/portal/jobs/:jobId', () => {
    it('should return job detail for owner', async () => {
      const job = { id: 'j1', status: 'COMPLETED', reportUrl: null };
      prisma.reportJob.findFirst.mockResolvedValue(job);

      const result = await controller.getJob(mockReq(), 'j1');

      expect(result).toEqual(job);
    });

    it('should throw NotFoundException for missing job', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(null);

      await expect(controller.getJob(mockReq(), 'j-bad')).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should audit log when job has a report URL', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'COMPLETED',
        reportUrl: 'https://r2.cerniq.io/report.pdf',
        institutionId: 'inst-1',
      });

      await controller.getJob(mockReq(), 'j1');

      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'report_download',
          resource: 'report_job',
          resourceId: 'j1',
        }),
      );
    });

    it('should not audit log when job has no report', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'QUEUED',
        reportUrl: null,
        reportUrlEn: null,
      });

      await controller.getJob(mockReq(), 'j1');

      expect(audit.log).not.toHaveBeenCalled();
    });

    it('master CEO can fetch a job owned by a different user', async () => {
      platformAccess.getAccessForUser.mockResolvedValueOnce({
        platformAccessAllowed: true,
        isMasterCeo: true,
        isPaid: true,
        isDemo: false,
        effectiveTier: 'monthly',
        effectiveStatus: 'active',
        effectivePeriodEnd: null,
        daysRemaining: null,
        reason: 'master_ceo',
      });
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j-demo-1',
        userId: 'demo-prospect-user',
        status: 'COMPLETE',
        reportUrl: 'https://r2.cerniq.io/report.pdf',
        institutionId: 'inst-demo',
      });

      const result = await controller.getJob(
        mockReq('master-ceo-id'),
        'j-demo-1',
      );

      expect(result.id).toBe('j-demo-1');
      // Where clause should NOT scope by master's own userId — it should pass only the jobId
      expect(prisma.reportJob.findFirst).toHaveBeenCalledWith({
        where: { id: 'j-demo-1' },
      });
      // Audit log should record the master-CEO bypass
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'report_download',
          metadata: expect.objectContaining({
            masterCeoBypass: true,
            jobOwnerId: 'demo-prospect-user',
          }),
        }),
      );
    });
  });

  // ── submitData ─────────────────────────────────

  describe('POST /api/portal/jobs/:jobId/submit', () => {
    const mockFile = {
      originalname: 'balance_sheet.csv',
      buffer: Buffer.from('category,item,amount\nasset,Cash,1000000'),
    } as Express.Multer.File;

    it('should throw NotFoundException when job not found', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(null);

      await expect(
        controller.submitData(mockReq(), 'j-bad', mockFile, {}),
      ).rejects.toThrow(NotFoundException);
    });

    it('should throw BadRequestException when job is not AWAITING_DATA', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'COMPLETED',
      });

      await expect(
        controller.submitData(mockReq(), 'j1', mockFile, {}),
      ).rejects.toThrow('Job is not ready for data submission');
    });

    it('should return validation errors when CSV is invalid', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'AWAITING_DATA',
        institutionId: null,
      });
      csvIngestion.parseCSV.mockReturnValue({
        valid: false,
        errors: [{ row: 1, field: 'amount', message: 'not a number' }],
        warnings: [],
        items: [],
        summary: {
          totalRows: 1,
          validRows: 0,
          errorRows: 1,
          totalAssets: 0,
          totalLiabilities: 0,
        },
      });
      prisma.reportJob.update.mockResolvedValue({});

      const result = await controller.submitData(mockReq(), 'j1', mockFile, {});

      expect(result.valid).toBe(false);
      expect(result.status).toBe('VALIDATION_FAILED');
      expect(result.warningCount).toBe(0);
      expect(result.jobId).toBe('j1');
      expect(result.nextHref).toBe('/portal/submit?jobId=j1');
      expect(ingestionLogs.recordLog).toHaveBeenCalledWith(
        expect.objectContaining({ status: 'FAILED' }),
      );
    });

    it('should process valid CSV through full pipeline', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'AWAITING_DATA',
        institutionId: null,
        institutionName: 'Cooperativa Test',
      });
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        items: [
          { category: 'asset', item: 'Cash', amount: 1000000 },
          { category: 'liability', item: 'Deposits', amount: 800000 },
        ],
        warnings: ['rateType defaulted'],
        summary: {
          totalRows: 2,
          validRows: 2,
          errorRows: 0,
          totalAssets: 1000000,
          totalLiabilities: 800000,
        },
      });
      almEnterprise.createInstitution.mockResolvedValue({ id: 'inst-new' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue({ count: 2 });
      prisma.reportJob.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'cfo@coop.pr',
        name: 'Maria',
      });

      const result = await controller.submitData(mockReq(), 'j1', mockFile, {});

      expect(result.valid).toBe(true);
      expect(result.status).toBe('QUEUED');
      expect(result.itemsImported).toBe(2);
      expect(result.warningCount).toBe(1);
      expect(result.institutionId).toBe('inst-new');
      expect(result.institutionName).toBe('Cooperativa Test');
      expect(result.nextHref).toBe('/portal/reports/j1');

      // Verify pipeline steps executed
      expect(almEnterprise.createInstitution).toHaveBeenCalled();
      expect(almEnterprise.importBalanceSheetItems).toHaveBeenCalledWith(
        'inst-new',
        expect.any(Array),
      );
      expect(dataCrypto.encrypt).toHaveBeenCalled();
      expect(email.sendDataSubmissionAck).toHaveBeenCalledWith(
        expect.objectContaining({ email: 'cfo@coop.pr' }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'data_upload',
          resource: 'report_job',
        }),
      );
    });

    it('should use existing institution when job has institutionId', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'AWAITING_DATA',
        institutionId: 'inst-existing',
        institutionName: 'Existing Coop',
      });
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        items: [{ a: 1 }],
        warnings: [],
        summary: {
          totalRows: 1,
          validRows: 1,
          errorRows: 0,
          totalAssets: 1,
          totalLiabilities: 0,
        },
      });
      almEnterprise.getInstitution.mockResolvedValue({ id: 'inst-existing' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });
      prisma.reportJob.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);

      await controller.submitData(mockReq(), 'j1', mockFile, {});

      expect(almEnterprise.getInstitution).toHaveBeenCalledWith(
        'inst-existing',
      );
      expect(almEnterprise.createInstitution).not.toHaveBeenCalled();
    });

    it('should throw when no file is provided', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'AWAITING_DATA',
      });

      await expect(
        controller.submitData(mockReq(), 'j1', undefined as any, {}),
      ).rejects.toThrow('No CSV file provided');
    });

    it('should block free accounts from submitting data', async () => {
      platformAccess.getAccessForUser.mockResolvedValueOnce({
        platformAccessAllowed: false,
        isMasterCeo: false,
        isPaid: false,
        effectiveTier: 'free',
        effectiveStatus: null,
        reason: 'subscription_required',
      });

      await expect(
        controller.submitData(mockReq(), 'j1', mockFile, {}),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.reportJob.findFirst).not.toHaveBeenCalled();
    });

    it('should allow retrying a validation-failed job', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'VALIDATION_FAILED',
        institutionId: 'inst-existing',
        institutionName: 'Retry Coop',
      });
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        items: [{ category: 'asset', item: 'Cash', amount: 1 }],
        warnings: [],
        summary: {
          totalRows: 1,
          validRows: 1,
          errorRows: 0,
          totalAssets: 1,
          totalLiabilities: 0,
        },
      });
      almEnterprise.getInstitution.mockResolvedValue({ id: 'inst-existing' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });
      prisma.reportJob.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.submitData(mockReq(), 'j1', mockFile, {});

      expect(result.valid).toBe(true);
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'VALIDATING' }),
        }),
      );
    });
  });

  // ── inviteUser ─────────────────────────────────

  describe('POST /api/portal/invite', () => {
    it('should invite a new team member with magic link', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'owner-1',
          name: 'Erwin',
          email: 'erwin@cerniq.io',
          workspaces: [{ id: 'ws-1' }],
        }) // owner lookup
        .mockResolvedValueOnce(null); // existing user check
      prisma.user.create.mockResolvedValue({
        id: 'new-user',
        email: 'analyst@coop.pr',
        role: 'ANALYST',
      });
      prisma.workspace.create.mockResolvedValue({});

      const result = await controller.inviteUser(mockReq('owner-1'), {
        email: 'analyst@coop.pr',
        role: 'ANALYST',
        name: 'Ana',
      });

      expect(result.invited).toBe(true);
      expect(result.email).toBe('analyst@coop.pr');
      expect(result.role).toBe('ANALYST');

      expect(billing.generateMagicLink).toHaveBeenCalledWith('new-user', 72);
      expect(email.sendTeamInviteEmail).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'analyst@coop.pr',
          inviterName: 'Erwin',
          role: 'ANALYST',
        }),
      );
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({
          action: 'team_invite',
          resource: 'user',
        }),
      );
    });

    it('should throw when invitee email already exists', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'owner-1',
          name: 'E',
          email: 'e@test.com',
          workspaces: [],
        })
        .mockResolvedValueOnce({ id: 'existing', email: 'dupe@test.com' });

      await expect(
        controller.inviteUser(mockReq(), {
          email: 'dupe@test.com',
          role: 'VIEWER',
        }),
      ).rejects.toThrow('already exists');
    });

    it('should throw when owner not found', async () => {
      prisma.user.findUnique.mockResolvedValueOnce(null);

      await expect(
        controller.inviteUser(mockReq(), {
          email: 'new@test.com',
          role: 'VIEWER',
        }),
      ).rejects.toThrow(NotFoundException);
    });
  });

  // ── getSettings ────────────────────────────────

  describe('GET /api/portal/settings', () => {
    it('should return user profile, subscription, and workspace count', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'cfo@coop.pr',
        name: 'Maria',
        role: 'OWNER',
        createdAt: new Date(),
        lastLoginAt: new Date('2026-03-15'),
      });
      prisma.subscription.findUnique.mockResolvedValue({
        tier: 'annual',
        status: 'active',
        currentPeriodEnd: new Date('2027-01-01'),
        reportsUsed: 4,
      });
      prisma.workspace.findMany.mockResolvedValue([
        {
          id: 'ws-1',
          name: 'Primary Workspace',
          createdAt: new Date('2026-01-01'),
        },
        {
          id: 'ws-2',
          name: 'Secondary Workspace',
          createdAt: new Date('2026-02-01'),
        },
      ]);
      prisma.reportJob.count
        .mockResolvedValueOnce(9)
        .mockResolvedValueOnce(5)
        .mockResolvedValueOnce(2)
        .mockResolvedValueOnce(1);
      prisma.institution.findMany.mockResolvedValue([
        {
          id: 'inst-1',
          name: 'Coop Uno',
          type: 'cooperativa',
          totalAssets: 125,
          preferredLanguage: 'es',
          updatedAt: new Date('2026-03-10'),
          workspaceId: 'ws-1',
        },
      ]);
      prisma.apiKey.count.mockResolvedValue(3);

      const result = await controller.getSettings(mockReq());

      expect(result.user.email).toBe('cfo@coop.pr');
      expect(result.subscription.tier).toBe('annual');
      expect(result.workspaceCount).toBe(2);
      expect(result.reportMetrics).toEqual({
        total: 9,
        completed: 5,
        inProgress: 2,
        awaitingData: 1,
      });
      expect(result.institutionMetrics).toEqual({
        total: 1,
        totalAssets: 125,
      });
      expect(result.apiKeyCount).toBe(3);
    });

    it('should return free tier when no subscription exists', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'free@test.com',
        name: 'Free User',
        role: 'VIEWER',
        createdAt: new Date(),
        lastLoginAt: null,
      });
      prisma.subscription.findUnique.mockResolvedValueOnce(null);
      prisma.workspace.findMany.mockResolvedValue([]);

      const result = await controller.getSettings(mockReq());

      expect(result.subscription).toEqual({ tier: 'free', status: 'active' });
    });

    it('should block free tier users from settings', async () => {
      platformAccess.getAccessForUser.mockResolvedValueOnce({
        platformAccessAllowed: false,
        isMasterCeo: false,
        isPaid: false,
        effectiveTier: 'free',
        effectiveStatus: null,
        reason: 'subscription_required',
      });

      await expect(controller.getSettings(mockReq())).rejects.toThrow(
        ForbiddenException,
      );
    });

    it('should throw when user not found', async () => {
      prisma.user.findUnique.mockResolvedValue(null);

      await expect(controller.getSettings(mockReq())).rejects.toThrow(
        NotFoundException,
      );
    });

    it('should handle empty workspaces', async () => {
      prisma.user.findUnique.mockResolvedValue({
        id: 'user-1',
        email: 'e@t.com',
        name: 'N',
        role: 'OWNER',
        createdAt: new Date(),
        lastLoginAt: null,
      });
      prisma.subscription.findUnique
        .mockResolvedValueOnce({ tier: 'monthly', status: 'active' })
        .mockResolvedValueOnce({ tier: 'monthly', status: 'active' });
      prisma.workspace.findMany.mockResolvedValue([]);

      const result = await controller.getSettings(mockReq());
      expect(result.institutions).toEqual([]);
      expect(result.institutionMetrics.total).toBe(0);
    });
  });

  // ── getJobIngestionLogs ──────────────────────────────

  describe('GET /api/portal/jobs/:jobId/ingestion-logs', () => {
    it('returns ingestion logs for a job', async () => {
      ingestionLogs.listJobLogs.mockResolvedValue([{ id: 'log-1' }]);
      await controller.getJobIngestionLogs(mockReq(), 'j1');
      expect(ingestionLogs.listJobLogs).toHaveBeenCalledWith('user-1', 'j1');
    });
  });

  describe('GET /api/portal/jobs/:jobId/exports', () => {
    it('returns export manifests for a job', async () => {
      const manifests = [{ id: 'alm_report:j1:es' }];
      portalExports.listJobExports.mockResolvedValue(manifests);

      const result = await controller.listJobExports(mockReq(), 'j1');
      expect(result).toEqual(manifests);
      expect(portalExports.listJobExports).toHaveBeenCalledWith('user-1', 'j1');
    });
  });

  // ── generateAlcoPack ─────────────────────────────────

  describe('POST /api/portal/jobs/:jobId/alco-pack', () => {
    it('generates ALCO pack for completed job', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        userId: 'user-1',
        status: 'COMPLETE',
        institutionId: 'inst-1',
        institutionName: 'Coop Test',
      });
      portalExports.generateAlcoPackExport.mockResolvedValue({
        manifest: {
          filename: 'board-package-coop-test-es-2026-04-06.pdf',
          mimeType: 'application/pdf',
          kind: 'alco_pack',
          language: 'es',
          audience: 'internal',
        },
        buffer: Buffer.from('pdf-data'),
      });

      const res = { set: jest.fn(), end: jest.fn() };
      await controller.generateAlcoPack(mockReq(), res, 'j1');

      expect(portalExports.generateAlcoPackExport).toHaveBeenCalledWith(
        'user-1',
        'j1',
        'es',
      );
      expect(res.set).toHaveBeenCalledWith(
        expect.objectContaining({ 'Content-Type': 'application/pdf' }),
      );
      expect(res.end).toHaveBeenCalled();
      expect(audit.log).toHaveBeenCalledWith(
        expect.objectContaining({ action: 'alco_pack_download' }),
      );
    });

    it('generates English ALCO pack', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        userId: 'user-1',
        status: 'COMPLETE',
        institutionId: 'inst-1',
        institutionName: 'Test',
      });
      portalExports.generateAlcoPackExport.mockResolvedValue({
        manifest: {
          filename: 'board-package-test-en-2026-04-06.pdf',
          mimeType: 'application/pdf',
          kind: 'alco_pack',
          language: 'en',
          audience: 'internal',
        },
        buffer: Buffer.from('en-pdf'),
      });

      const res = { set: jest.fn(), end: jest.fn() };
      await controller.generateAlcoPack(mockReq(), res, 'j1', 'en');

      expect(portalExports.generateAlcoPackExport).toHaveBeenCalledWith(
        'user-1',
        'j1',
        'en',
      );
    });

    it('throws NotFoundException when job not found', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(null);
      const res = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.generateAlcoPack(mockReq(), res, 'j-bad'),
      ).rejects.toThrow(NotFoundException);
    });

    it('throws BadRequestException when job is not COMPLETE', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'QUEUED',
        institutionId: 'inst-1',
      });
      const res = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.generateAlcoPack(mockReq(), res, 'j1'),
      ).rejects.toThrow('ALCO pack can only be generated');
    });

    it('throws BadRequestException when no institution linked', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j1',
        status: 'COMPLETE',
        institutionId: null,
      });
      const res = { set: jest.fn(), end: jest.fn() };
      await expect(
        controller.generateAlcoPack(mockReq(), res, 'j1'),
      ).rejects.toThrow('No institution linked');
    });
  });

  // ── submitData: multi-period linking ─────────────────

  describe('submitData — multi-period linking', () => {
    const mockFile = {
      originalname: 'bs.csv',
      buffer: Buffer.from('data'),
    } as Express.Multer.File;

    it('links to previous completed job', async () => {
      prisma.reportJob.findFirst
        .mockResolvedValueOnce({
          id: 'j2',
          status: 'AWAITING_DATA',
          institutionId: 'inst-1',
          institutionName: 'Coop',
        })
        .mockResolvedValueOnce({ id: 'j1' }); // previous complete job
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        items: [{ a: 1 }],
        warnings: [],
        summary: {
          totalRows: 1,
          validRows: 1,
          errorRows: 0,
          totalAssets: 1,
          totalLiabilities: 0,
        },
      });
      almEnterprise.getInstitution.mockResolvedValue({ id: 'inst-1' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });
      prisma.reportJob.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.submitData(mockReq(), 'j2', mockFile, {});
      expect(result.valid).toBe(true);
    });

    it('handles previous job lookup failure gracefully', async () => {
      prisma.reportJob.findFirst
        .mockResolvedValueOnce({
          id: 'j2',
          status: 'AWAITING_DATA',
          institutionId: null,
          institutionName: null,
        })
        .mockRejectedValueOnce(new Error('Column missing')); // previous job lookup fails
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        items: [{ a: 1 }],
        warnings: [],
        summary: {
          totalRows: 1,
          validRows: 1,
          errorRows: 0,
          totalAssets: 1,
          totalLiabilities: 0,
        },
      });
      almEnterprise.createInstitution.mockResolvedValue({ id: 'new-inst' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });
      prisma.reportJob.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue(null);

      const result = await controller.submitData(mockReq(), 'j2', mockFile, {
        institutionName: 'New',
      });
      expect(result.valid).toBe(true);
    });

    it('does not send email when user has no email', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'j3',
        status: 'AWAITING_DATA',
        institutionId: null,
        institutionName: null,
      });
      csvIngestion.parseCSV.mockReturnValue({
        valid: true,
        items: [{ a: 1 }],
        warnings: [],
        summary: {
          totalRows: 1,
          validRows: 1,
          errorRows: 0,
          totalAssets: 1,
          totalLiabilities: 0,
        },
      });
      almEnterprise.createInstitution.mockResolvedValue({ id: 'new-inst' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue({ count: 1 });
      prisma.reportJob.update.mockResolvedValue({});
      prisma.user.findUnique.mockResolvedValue({ id: 'u1', email: null });

      await controller.submitData(mockReq(), 'j3', mockFile, {});
      expect(email.sendDataSubmissionAck).not.toHaveBeenCalled();
    });
  });

  // ── inviteUser: owner with no workspaces ─────────────

  describe('inviteUser — owner with no workspaces', () => {
    it('skips workspace creation when owner has no workspaces', async () => {
      prisma.user.findUnique
        .mockResolvedValueOnce({
          id: 'owner-1',
          name: 'O',
          email: 'o@t.com',
          workspaces: [],
        })
        .mockResolvedValueOnce(null);
      prisma.user.create.mockResolvedValue({
        id: 'new',
        email: 'new@t.com',
        role: 'VIEWER',
      });

      const result = await controller.inviteUser(mockReq('owner-1'), {
        email: 'new@t.com',
        role: 'VIEWER',
      });

      expect(prisma.workspace.create).not.toHaveBeenCalled();
      expect(result.invited).toBe(true);
    });
  });
});
