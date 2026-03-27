import { Test, TestingModule } from '@nestjs/testing';
import {
  BadRequestException,
  ForbiddenException,
  NotFoundException,
} from '@nestjs/common';
import { PortalController } from './portal.controller';
import { PrismaService } from '../prisma.service';
import { AlmEnterpriseService } from '../alm/alm-enterprise.service';
import { CSVIngestionService } from '../alm/csv-ingestion.service';
import { IngestionLogsService } from '../alm/ingestion-logs.service';
import { EmailService } from '../email/email.service';
import { DataCryptoService } from '../crypto/data-crypto.service';
import { BillingService } from '../billing/billing.service';
import { AuditService } from '../audit/audit.service';
import { AlcoPackService } from '../pipeline/alco-pack.service';
import { AuthGuard } from '../auth/auth.guard';
import { RolesGuard } from '../auth/roles.guard';

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
  let alcoPackService: Record<string, jest.Mock>;

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
        update: jest.fn(),
        count: jest.fn().mockResolvedValue(0),
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

    alcoPackService = {
      getPackStatus: jest.fn(),
      generatePack: jest.fn(),
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
        { provide: AlcoPackService, useValue: alcoPackService },
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
      prisma.subscription.findUnique.mockResolvedValueOnce(null);

      await expect(controller.listJobs(mockReq())).rejects.toThrow(
        ForbiddenException,
      );
      expect(prisma.reportJob.findMany).not.toHaveBeenCalled();
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
      ).rejects.toThrow('Job is not awaiting data');
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
      });
      prisma.reportJob.update.mockResolvedValue({});

      const result = await controller.submitData(mockReq(), 'j1', mockFile, {});

      expect(result.valid).toBe(false);
      expect(result.status).toBe('VALIDATION_FAILED');
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
      });
      almEnterprise.createInstitution.mockResolvedValue({ id: 'inst-new' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue(undefined);
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
      expect(result.institutionId).toBe('inst-new');

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
      csvIngestion.parseCSV.mockReturnValue({ valid: true, items: [{ a: 1 }] });
      almEnterprise.getInstitution.mockResolvedValue({ id: 'inst-existing' });
      almEnterprise.importBalanceSheetItems.mockResolvedValue(undefined);
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
      prisma.subscription.findUnique.mockResolvedValueOnce({
        tier: 'free',
        status: 'active',
      });

      await expect(
        controller.submitData(mockReq(), 'j1', mockFile, {}),
      ).rejects.toThrow(ForbiddenException);

      expect(prisma.reportJob.findFirst).not.toHaveBeenCalled();
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
      prisma.subscription.findUnique
        .mockResolvedValueOnce({ tier: 'monthly', status: 'active' })
        .mockResolvedValueOnce(null);
      prisma.workspace.findMany.mockResolvedValue([]);

      const result = await controller.getSettings(mockReq());

      expect(result.subscription).toEqual({ tier: 'free', status: 'active' });
    });

    it('should block free tier users from settings', async () => {
      prisma.subscription.findUnique.mockResolvedValueOnce(null);

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
  });
});
