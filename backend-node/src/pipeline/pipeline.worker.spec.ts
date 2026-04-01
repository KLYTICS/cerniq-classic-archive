import { PipelineWorker } from './pipeline.worker';

describe('PipelineWorker', () => {
  let worker: PipelineWorker;
  let prisma: any;
  let storage: any;
  let emailService: any;
  let almEnterprise: any;
  let stressTesting: any;
  let complianceCalendar: any;
  let dataCrypto: any;
  let pipelineGateway: any;

  beforeEach(() => {
    prisma = {
      reportJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      institution: {
        findUnique: jest.fn().mockResolvedValue({
          id: 'inst_1',
          name: 'Coop Test',
          type: 'cooperativa',
          currency: 'USD',
          primaryRegulator: 'COSSEC',
          balanceSheetItems: [],
          interestRateScenarios: [],
          liquidityPositions: [],
        }),
      },
      workspace: {
        findFirst: jest.fn().mockResolvedValue(null),
      },
      subscription: {
        updateMany: jest.fn().mockResolvedValue({ count: 1 }),
      },
      emailSequence: {
        create: jest.fn().mockResolvedValue({}),
      },
    };

    storage = {
      upload: jest.fn().mockResolvedValue(undefined),
      getSignedUrl: jest.fn().mockResolvedValue('https://s3.example.com/report.pdf'),
    };

    emailService = {
      sendReportReady: jest.fn().mockResolvedValue(undefined),
      sendJobFailedAlert: jest.fn().mockResolvedValue(undefined),
    };

    almEnterprise = {
      getALMSummary: jest.fn().mockResolvedValue({ riskScore: 70 }),
      getCOSSECComplianceWithTrend: jest.fn().mockResolvedValue({ examReadinessScore: 85 }),
      getRegulatoryCompliance: jest.fn().mockResolvedValue({}),
      getInstitution: jest.fn().mockResolvedValue({
        id: 'inst_1',
        name: 'Coop Test',
        primaryRegulator: 'COSSEC',
      }),
    };

    stressTesting = {
      runFullStressTest: jest.fn().mockResolvedValue({ regulatory: { overallRating: 'resilient' } }),
    };

    complianceCalendar = {};
    dataCrypto = {};

    pipelineGateway = {
      emitProgress: jest.fn(),
      emitComplete: jest.fn(),
      emitError: jest.fn(),
    };

    worker = new PipelineWorker(
      prisma,
      storage,
      emailService,
      almEnterprise,
      stressTesting,
      complianceCalendar,
      dataCrypto,
      pipelineGateway,
    );
  });

  describe('processQueue', () => {
    it('should do nothing when no queued jobs exist', async () => {
      await worker.processQueue();
      expect(prisma.reportJob.update).not.toHaveBeenCalled();
    });

    it('should process a queued job through to completion', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'job_1',
        userId: 'user_1',
        institutionId: 'inst_1',
        institutionName: 'Coop Test',
        status: 'QUEUED',
        user: { email: 'user@coop.pr', name: 'Maria' },
      });

      await worker.processQueue();

      // Should transition to PROCESSING
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_1' },
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      );

      // Should transition to COMPLETE
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_1' },
          data: expect.objectContaining({ status: 'COMPLETE' }),
        }),
      );

      // Should emit WebSocket events
      expect(pipelineGateway.emitProgress).toHaveBeenCalled();
      expect(pipelineGateway.emitComplete).toHaveBeenCalledWith('job_1', expect.any(Object));
    });

    it('should send email notification on completion', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'job_2',
        userId: 'user_2',
        institutionId: 'inst_1',
        institutionName: 'Coop Notify',
        status: 'QUEUED',
        user: { email: 'notify@coop.pr', name: 'Carlos' },
      });

      await worker.processQueue();

      expect(emailService.sendReportReady).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'notify@coop.pr',
          name: 'Carlos',
          institutionName: 'Coop Notify',
        }),
      );
    });

    it('should schedule C2 follow-up email sequence after completion', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'job_3',
        userId: 'user_3',
        institutionId: 'inst_1',
        institutionName: 'Coop C2',
        status: 'QUEUED',
        user: { email: 'c2@coop.pr', name: 'Ana' },
      });

      await worker.processQueue();

      expect(prisma.emailSequence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            userId: 'user_3',
            sequenceKey: 'C2',
          }),
        }),
      );
    });

    it('should upload PDFs for both languages', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'job_4',
        userId: 'user_4',
        institutionId: 'inst_1',
        institutionName: 'Coop Upload',
        status: 'QUEUED',
        user: { email: 'upload@coop.pr', name: 'Luis' },
      });

      await worker.processQueue();

      expect(storage.upload).toHaveBeenCalledTimes(2);
      expect(storage.upload).toHaveBeenCalledWith(
        'reports/job_4/report_es.pdf',
        expect.any(Buffer),
      );
      expect(storage.upload).toHaveBeenCalledWith(
        'reports/job_4/report_en.pdf',
        expect.any(Buffer),
      );
    });

    it('should mark job as FAILED and send alert on error', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'job_fail',
        userId: 'user_fail',
        institutionId: 'inst_1',
        institutionName: 'Coop Fail',
        status: 'QUEUED',
        user: { email: 'fail@coop.pr', name: 'Pedro' },
      });
      // Make institution lookup fail
      prisma.institution.findUnique.mockResolvedValue(null);

      await worker.processQueue();

      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_fail' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
      expect(pipelineGateway.emitError).toHaveBeenCalledWith(
        'job_fail',
        expect.any(String),
      );
      expect(emailService.sendJobFailedAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job_fail',
          institutionName: 'Coop Fail',
        }),
      );
    });

    it('should increment subscription reportsUsed on success', async () => {
      prisma.reportJob.findFirst.mockResolvedValue({
        id: 'job_inc',
        userId: 'user_inc',
        institutionId: 'inst_1',
        institutionName: 'Coop Inc',
        status: 'QUEUED',
        user: { email: 'inc@coop.pr', name: 'Rosa' },
      });

      await worker.processQueue();

      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_inc' },
          data: { reportsUsed: { increment: 1 } },
        }),
      );
    });

    it('should handle P2021 table missing error gracefully', async () => {
      prisma.reportJob.findFirst.mockRejectedValue({ code: 'P2021' });

      // Should not throw
      await expect(worker.processQueue()).resolves.toBeUndefined();
    });

    it('should handle table missing error by message', async () => {
      prisma.reportJob.findFirst.mockRejectedValue(
        new Error('The table `report_jobs` does not exist'),
      );

      await expect(worker.processQueue()).resolves.toBeUndefined();
    });

    it('should rethrow non-P2021 errors from findFirst', async () => {
      prisma.reportJob.findFirst.mockRejectedValue(new Error('Connection refused'));

      await expect(worker.processQueue()).rejects.toThrow('Connection refused');
    });
  });
});
