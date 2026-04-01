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

  const defaultInstitution = {
    id: 'inst_1',
    name: 'Coop Test',
    type: 'cooperativa',
    currency: 'USD',
    primaryRegulator: 'COSSEC',
    balanceSheetItems: [],
    interestRateScenarios: [],
    liquidityPositions: [],
  };

  function makeJob(overrides: Record<string, any> = {}) {
    return {
      id: 'job_1',
      userId: 'user_1',
      institutionId: 'inst_1',
      institutionName: 'Coop Test',
      status: 'QUEUED',
      user: { email: 'user@coop.pr', name: 'Maria' },
      ...overrides,
    };
  }

  beforeEach(() => {
    prisma = {
      reportJob: {
        findFirst: jest.fn().mockResolvedValue(null),
        update: jest.fn().mockResolvedValue({}),
      },
      institution: {
        findUnique: jest.fn().mockResolvedValue(defaultInstitution),
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
      getALMSummary: jest.fn().mockResolvedValue({
        riskScore: 70,
        institution: { name: 'Coop Test', totalAssets: 250000000 },
        durationGap: { durationGap: 1.2, assetDuration: 3.2, liabilityDuration: 2.0, riskProfile: 'moderate' },
        niiSensitivity: {
          baseNII: 12.5, riskRating: 'moderate',
          scenarios: [
            { name: 'Up 100', niiChange: -1.5, niiChangePercent: -12 },
            { name: 'Down 100', niiChange: 1.2, niiChangePercent: 9.6 },
          ],
        },
        liquidity: { lcr: 115, status: 'compliant', buffer: 5, hqla: 80, netOutflows: 60 },
        recommendations: ['Reduce gap'],
        topRisks: ['Rate sensitivity'],
        concentration: { sectors: [{ name: 'RE', percent: 35 }] },
      }),
      getCOSSECComplianceWithTrend: jest.fn().mockResolvedValue({
        examReadinessScore: 85,
        overallStatus: 'compliant',
        summary: {
          capitalRatio: 9.5, totalAssets: 250, totalLiabilities: 210,
          equity: 40, totalLoans: 160, totalShares: 180,
          liquidAssets: 50, liquidityRatio: 20, loanToShareRatio: 88,
          nim: 3.5, earningAssetsYield: 4.5, costOfFunds: 1.2,
          largestSectorName: 'Real Estate', largestSectorPct: 35,
        },
        ratios: [
          { id: 1, name: 'Capital', nameEs: 'Capital', value: 9.5, unit: '%', status: 'pass' },
        ],
        trends: null,
        previousPeriod: null,
      }),
      getRegulatoryCompliance: jest.fn().mockResolvedValue({
        examReadinessScore: 85,
        overallStatus: 'compliant',
        summary: {
          capitalRatio: 9.5, totalAssets: 250, totalLiabilities: 210,
          equity: 40, totalLoans: 160, totalShares: 180,
          liquidAssets: 50, liquidityRatio: 20, loanToShareRatio: 88,
        },
        ratios: [],
      }),
      getInstitution: jest.fn().mockResolvedValue({
        id: 'inst_1',
        name: 'Coop Test',
        primaryRegulator: 'COSSEC',
        type: 'cooperativa',
        currency: 'USD',
      }),
    };

    stressTesting = {
      runFullStressTest: jest.fn().mockResolvedValue({
        regulatory: { overallRating: 'resilient', scenarios: [] },
        monteCarlo: { var95: -5.2, paths: [], niiDistribution: {} },
        scenarios: [],
        cossecScenarios: [],
      }),
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

  // ─── processQueue: no jobs ──────────────────────────────

  describe('processQueue — no jobs', () => {
    it('does nothing when no queued jobs exist', async () => {
      await worker.processQueue();
      expect(prisma.reportJob.update).not.toHaveBeenCalled();
      expect(pipelineGateway.emitProgress).not.toHaveBeenCalled();
    });
  });

  // ─── processQueue: happy path ───────────────────────────

  describe('processQueue — happy path', () => {
    beforeEach(() => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob());
    });

    it('transitions job to PROCESSING first', async () => {
      await worker.processQueue();
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_1' },
          data: expect.objectContaining({ status: 'PROCESSING' }),
        }),
      );
    });

    it('emits progress for all 7 steps', async () => {
      await worker.processQueue();
      const steps = pipelineGateway.emitProgress.mock.calls.map((c: any) => c[1].step);
      expect(steps).toContain('VALIDATING');
      expect(steps).toContain('COSSEC_CALC');
      expect(steps).toContain('MONTE_CARLO');
      expect(steps).toContain('STRESS_TEST');
      expect(steps).toContain('PDF_GENERATION');
      expect(steps).toContain('UPLOADING');
    });

    it('transitions to GENERATING_PDF', async () => {
      await worker.processQueue();
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'GENERATING_PDF' }),
        }),
      );
    });

    it('transitions to UPLOADING', async () => {
      await worker.processQueue();
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'UPLOADING' }),
        }),
      );
    });

    it('transitions to COMPLETE with report URLs', async () => {
      await worker.processQueue();
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_1' },
          data: expect.objectContaining({
            status: 'COMPLETE',
            reportUrl: expect.any(String),
            reportUrlEn: expect.any(String),
          }),
        }),
      );
    });

    it('uploads two PDFs (ES + EN)', async () => {
      await worker.processQueue();
      expect(storage.upload).toHaveBeenCalledTimes(2);
      expect(storage.upload).toHaveBeenCalledWith('reports/job_1/report_es.pdf', expect.any(Buffer));
      expect(storage.upload).toHaveBeenCalledWith('reports/job_1/report_en.pdf', expect.any(Buffer));
    });

    it('gets signed URLs for both reports', async () => {
      await worker.processQueue();
      expect(storage.getSignedUrl).toHaveBeenCalledTimes(2);
    });

    it('emits WebSocket completion event', async () => {
      await worker.processQueue();
      expect(pipelineGateway.emitComplete).toHaveBeenCalledWith('job_1', expect.objectContaining({
        reportUrl: expect.any(String),
        reportUrlEn: expect.any(String),
      }));
    });

    it('increments subscription reportsUsed', async () => {
      await worker.processQueue();
      expect(prisma.subscription.updateMany).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { userId: 'user_1' },
          data: { reportsUsed: { increment: 1 } },
        }),
      );
    });

    it('sends email notification on completion', async () => {
      await worker.processQueue();
      expect(emailService.sendReportReady).toHaveBeenCalledWith(
        expect.objectContaining({
          email: 'user@coop.pr',
          name: 'Maria',
          institutionName: 'Coop Test',
        }),
      );
    });

    it('schedules C2 follow-up email sequence', async () => {
      await worker.processQueue();
      expect(prisma.emailSequence.create).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ userId: 'user_1', sequenceKey: 'C2' }),
        }),
      );
    });

    it('does not send email or schedule C2 when user has no email', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob({ user: { name: 'No Email' } }));
      await worker.processQueue();
      expect(emailService.sendReportReady).not.toHaveBeenCalled();
      expect(prisma.emailSequence.create).not.toHaveBeenCalled();
    });
  });

  // ─── processQueue: failure path ─────────────────────────

  describe('processQueue — failure path', () => {
    it('marks job as FAILED when institution is not found', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob());
      prisma.institution.findUnique.mockResolvedValue(null);

      await worker.processQueue();

      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_1' },
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('emits WebSocket error event on failure', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob());
      prisma.institution.findUnique.mockResolvedValue(null);

      await worker.processQueue();

      expect(pipelineGateway.emitError).toHaveBeenCalledWith('job_1', expect.any(String));
    });

    it('sends job failed alert email on failure', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob());
      prisma.institution.findUnique.mockResolvedValue(null);

      await worker.processQueue();

      expect(emailService.sendJobFailedAlert).toHaveBeenCalledWith(
        expect.objectContaining({
          jobId: 'job_1',
          institutionName: 'Coop Test',
          clientEmail: 'user@coop.pr',
        }),
      );
    });

    it('handles missing user email in failure alert', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob({ user: null }));
      prisma.institution.findUnique.mockResolvedValue(null);

      await worker.processQueue();

      expect(emailService.sendJobFailedAlert).toHaveBeenCalledWith(
        expect.objectContaining({ clientEmail: 'unknown' }),
      );
    });

    it('marks job FAILED when ALM summary fails', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob());
      almEnterprise.getALMSummary.mockRejectedValue(new Error('ALM down'));

      await worker.processQueue();

      // The generateReport call catches and produces fallback PDF,
      // but the step 3 Promise.all will throw
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({ status: 'FAILED' }),
        }),
      );
    });

    it('marks job FAILED when storage upload fails', async () => {
      prisma.reportJob.findFirst.mockResolvedValue(makeJob());
      storage.upload.mockRejectedValue(new Error('S3 timeout'));

      await worker.processQueue();

      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          data: expect.objectContaining({
            status: 'FAILED',
            errorMessage: 'S3 timeout',
          }),
        }),
      );
    });
  });

  // ─── processQueue: P2021 table missing ──────────────────

  describe('processQueue — table missing errors', () => {
    it('handles P2021 error code gracefully', async () => {
      prisma.reportJob.findFirst.mockRejectedValue({ code: 'P2021' });
      await expect(worker.processQueue()).resolves.toBeUndefined();
    });

    it('handles table missing error by message', async () => {
      prisma.reportJob.findFirst.mockRejectedValue(
        new Error('The table `report_jobs` does not exist'),
      );
      await expect(worker.processQueue()).resolves.toBeUndefined();
    });

    it('handles P2021 in meta.code', async () => {
      prisma.reportJob.findFirst.mockRejectedValue({ meta: { code: 'P2021' } });
      await expect(worker.processQueue()).resolves.toBeUndefined();
    });

    it('rethrows non-table-missing errors', async () => {
      prisma.reportJob.findFirst.mockRejectedValue(new Error('Connection refused'));
      await expect(worker.processQueue()).rejects.toThrow('Connection refused');
    });
  });

  // ─── loadInstitutionData ────────────────────────────────

  describe('loadInstitutionData (private)', () => {
    it('loads by institutionId when provided', async () => {
      const result = await (worker as any).loadInstitutionData('user_1', 'inst_1');
      expect(prisma.institution.findUnique).toHaveBeenCalledWith(
        expect.objectContaining({ where: { id: 'inst_1' } }),
      );
      expect(result).toEqual(defaultInstitution);
    });

    it('falls back to workspace lookup when no institutionId', async () => {
      prisma.workspace.findFirst.mockResolvedValue({
        institutions: [{ id: 'fallback_inst', name: 'Fallback' }],
      });
      const result = await (worker as any).loadInstitutionData('user_1', null);
      expect(prisma.workspace.findFirst).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { ownerId: 'user_1' },
        }),
      );
      expect(result.id).toBe('fallback_inst');
    });

    it('returns null when no workspace is found', async () => {
      prisma.workspace.findFirst.mockResolvedValue(null);
      const result = await (worker as any).loadInstitutionData('user_1', null);
      expect(result).toBeNull();
    });

    it('returns null when workspace has no institutions', async () => {
      prisma.workspace.findFirst.mockResolvedValue({ institutions: [] });
      const result = await (worker as any).loadInstitutionData('user_1', undefined);
      expect(result).toBeNull();
    });
  });

  // ─── transitionJob ──────────────────────────────────────

  describe('transitionJob (private)', () => {
    it('sets processingStartedAt when transitioning to PROCESSING', async () => {
      await (worker as any).transitionJob('job_1', 'PROCESSING');
      expect(prisma.reportJob.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'job_1' },
          data: expect.objectContaining({
            status: 'PROCESSING',
            processingStartedAt: expect.any(Date),
          }),
        }),
      );
    });

    it('does not set processingStartedAt for other statuses', async () => {
      await (worker as any).transitionJob('job_1', 'GENERATING_PDF');
      const data = prisma.reportJob.update.mock.calls[0][0].data;
      expect(data.processingStartedAt).toBeUndefined();
    });
  });

  // ─── isReportJobsTableMissing ───────────────────────────

  describe('isReportJobsTableMissing (private)', () => {
    it('returns true for P2021 error code', () => {
      expect((worker as any).isReportJobsTableMissing({ code: 'P2021' })).toBe(true);
    });

    it('returns true for meta.code P2021', () => {
      expect((worker as any).isReportJobsTableMissing({ meta: { code: 'P2021' } })).toBe(true);
    });

    it('returns true for message containing report_jobs + does not exist', () => {
      expect(
        (worker as any).isReportJobsTableMissing(new Error('The table `report_jobs` does not exist in the database')),
      ).toBe(true);
    });

    it('returns false for unrelated errors', () => {
      expect((worker as any).isReportJobsTableMissing(new Error('Connection refused'))).toBe(false);
    });

    it('returns false for null/undefined error', () => {
      expect((worker as any).isReportJobsTableMissing(null)).toBe(false);
      expect((worker as any).isReportJobsTableMissing(undefined)).toBe(false);
    });
  });

  // ─── generateReport (private) ───────────────────────────

  describe('generateReport (private)', () => {
    it('produces a PDF buffer for a valid institution', async () => {
      const result = await (worker as any).generateReport('inst_1', 'en');
      expect(Buffer.isBuffer(result)).toBe(true);
      expect(result.length).toBeGreaterThan(0);
    });

    it('produces a fallback PDF when ALM data fails', async () => {
      almEnterprise.getALMSummary.mockRejectedValue(new Error('ALM down'));
      almEnterprise.getRegulatoryCompliance.mockRejectedValue(new Error('Reg down'));
      stressTesting.runFullStressTest.mockRejectedValue(new Error('Stress down'));

      const result = await (worker as any).generateReport('inst_1', 'en');
      expect(Buffer.isBuffer(result)).toBe(true);
    });

    it('calls getCOSSECComplianceWithTrend for COSSEC institutions', async () => {
      await (worker as any).generateReport('inst_1', 'en');
      // Since primaryRegulator is COSSEC, it should call getCOSSECComplianceWithTrend
      expect(almEnterprise.getCOSSECComplianceWithTrend).toHaveBeenCalledWith('inst_1');
    });

    it('uses base regulatory compliance for NCUA institutions', async () => {
      almEnterprise.getInstitution.mockResolvedValue({
        id: 'inst_1',
        name: 'NCUA CU',
        primaryRegulator: 'NCUA',
      });
      await (worker as any).generateReport('inst_1', 'en');
      // Should NOT call getCOSSECComplianceWithTrend for NCUA
      // The getRegulatoryCompliance should be used instead with trends: null
      expect(almEnterprise.getRegulatoryCompliance).toHaveBeenCalled();
    });

    it('generates Spanish PDF', async () => {
      const result = await (worker as any).generateReport('inst_1', 'es');
      expect(Buffer.isBuffer(result)).toBe(true);
    });
  });
});
