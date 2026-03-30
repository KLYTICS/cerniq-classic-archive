import { PipelineWorker } from './pipeline.worker';

describe('PipelineWorker', () => {
  let worker: PipelineWorker;
  let prisma: any;
  let storage: any;
  let email: any;
  let almEnterprise: any;
  let stressTesting: any;
  let complianceCalendar: any;
  let dataCrypto: any;
  let pipelineGateway: any;

  const makeWorker = () => {
    prisma = {
      reportJob: {
        findFirst: jest.fn(),
        findMany: jest.fn(),
        update: jest.fn(),
      },
      institution: {
        findUnique: jest.fn(),
      },
      workspace: {
        findFirst: jest.fn(),
      },
      subscription: {
        updateMany: jest.fn(),
        findMany: jest.fn(),
        count: jest.fn(),
      },
      emailSequence: {
        create: jest.fn(),
        findFirst: jest.fn(),
      },
    };
    storage = {
      upload: jest.fn(),
      getSignedUrl: jest.fn(),
    };
    email = {
      sendReportReady: jest.fn(),
      sendJobFailedAlert: jest.fn(),
      sendDailyOperationsReport: jest.fn(),
      sendRenewalReminder: jest.fn(),
      sendChurnRiskAlert: jest.fn(),
      sendWeeklyRevenueReport: jest.fn(),
      sendNPSSurvey: jest.fn(),
    };
    almEnterprise = {
      getALMSummary: jest.fn(),
      getCOSSECComplianceWithTrend: jest.fn(),
      getRegulatoryCompliance: jest.fn(),
      getInstitution: jest.fn(),
    };
    stressTesting = {
      runFullStressTest: jest.fn(),
    };
    complianceCalendar = {
      getInstitutionsWithUpcomingDeadlines: jest.fn(),
    };
    dataCrypto = {};
    pipelineGateway = {
      emitProgress: jest.fn(),
      emitComplete: jest.fn(),
      emitError: jest.fn(),
    };

    worker = new PipelineWorker(
      prisma,
      storage,
      email,
      almEnterprise,
      stressTesting,
      complianceCalendar,
      dataCrypto,
      pipelineGateway,
    );
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();
    makeWorker();
  });

  it('skips queue processing when the report_jobs table is missing', async () => {
    const warnSpy = jest
      .spyOn((worker as any).logger, 'warn')
      .mockImplementation(() => undefined);
    prisma.reportJob.findFirst.mockRejectedValue({
      code: 'P2021',
      message: 'report_jobs does not exist',
    });

    await expect(worker.processQueue()).resolves.toBeUndefined();
    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping pipeline queue processing: report_jobs table is missing',
    );
  });

  it('returns immediately when no queued job exists', async () => {
    prisma.reportJob.findFirst.mockResolvedValue(null);

    await expect(worker.processQueue()).resolves.toBeUndefined();
    expect(prisma.reportJob.update).not.toHaveBeenCalled();
    expect(pipelineGateway.emitProgress).not.toHaveBeenCalled();
  });

  it('processes a queued job through completion', async () => {
    const job = {
      id: 'job-1',
      userId: 'user-1',
      institutionId: 'inst-1',
      institutionName: 'Coop Test',
      user: { email: 'ops@coop.pr', name: 'Ops' },
    };
    prisma.reportJob.findFirst.mockResolvedValue(job);
    prisma.reportJob.update.mockResolvedValue({});
    prisma.subscription.updateMany.mockResolvedValue({});
    prisma.emailSequence.create.mockResolvedValue({});
    storage.upload.mockResolvedValue(undefined);
    storage.getSignedUrl
      .mockResolvedValueOnce('https://signed/es.pdf')
      .mockResolvedValueOnce('https://signed/en.pdf');
    jest
      .spyOn(worker as any, 'loadInstitutionData')
      .mockResolvedValue({ id: 'inst-1' });
    jest
      .spyOn(worker as any, 'generateReport')
      .mockResolvedValueOnce(Buffer.from('es'))
      .mockResolvedValueOnce(Buffer.from('en'));
    almEnterprise.getALMSummary.mockResolvedValue({ riskScore: 88 });
    stressTesting.runFullStressTest.mockResolvedValue({ verdict: 'PASS' });
    almEnterprise.getCOSSECComplianceWithTrend.mockResolvedValue({
      examReadinessScore: 90,
    });

    await worker.processQueue();

    expect(prisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({ status: 'PROCESSING' }),
    });
    expect(prisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'COMPLETE',
        reportUrl: 'https://signed/es.pdf',
        reportUrlEn: 'https://signed/en.pdf',
        completedAt: expect.any(Date),
      }),
    });
    expect(storage.upload).toHaveBeenCalledTimes(2);
    expect(email.sendReportReady).toHaveBeenCalledWith({
      email: 'ops@coop.pr',
      name: 'Ops',
      institutionName: 'Coop Test',
      portalUrl: expect.stringContaining('/portal/reports/job-1'),
    });
    expect(prisma.emailSequence.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        userId: 'user-1',
        sequenceKey: 'C2',
        scheduledAt: expect.any(Date),
      }),
    });
    expect(pipelineGateway.emitComplete).toHaveBeenCalledWith('job-1', {
      reportUrl: 'https://signed/es.pdf',
      reportUrlEn: 'https://signed/en.pdf',
    });
  });

  it('marks a job as failed and alerts when processing throws', async () => {
    const job = {
      id: 'job-2',
      userId: 'user-2',
      institutionId: 'inst-2',
      institutionName: 'Broken Coop',
      user: { email: 'cfo@coop.pr' },
    };
    prisma.reportJob.findFirst.mockResolvedValue(job);
    prisma.reportJob.update.mockResolvedValue({});
    jest.spyOn(worker as any, 'loadInstitutionData').mockResolvedValue(null);

    await worker.processQueue();

    expect(prisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-2' },
      data: {
        status: 'FAILED',
        errorMessage: 'No institution data found for job job-2',
      },
    });
    expect(pipelineGateway.emitError).toHaveBeenCalledWith(
      'job-2',
      'No institution data found for job job-2',
    );
    expect(email.sendJobFailedAlert).toHaveBeenCalledWith({
      jobId: 'job-2',
      institutionName: 'Broken Coop',
      error: 'No institution data found for job job-2',
      clientEmail: 'cfo@coop.pr',
    });
  });

  it('sets processingStartedAt only for PROCESSING transitions', async () => {
    prisma.reportJob.update.mockResolvedValue({});

    await (worker as any).transitionJob('job-1', 'PROCESSING');
    await (worker as any).transitionJob('job-1', 'UPLOADING');

    expect(prisma.reportJob.update).toHaveBeenNthCalledWith(1, {
      where: { id: 'job-1' },
      data: expect.objectContaining({
        status: 'PROCESSING',
        processingStartedAt: expect.any(Date),
      }),
    });
    expect(prisma.reportJob.update).toHaveBeenNthCalledWith(2, {
      where: { id: 'job-1' },
      data: { status: 'UPLOADING' },
    });
  });

  it('detects missing report_jobs tables from code and message text', () => {
    expect((worker as any).isReportJobsTableMissing({ code: 'P2021' })).toBe(
      true,
    );
    expect(
      (worker as any).isReportJobsTableMissing({
        message: 'relation report_jobs does not exist',
      }),
    ).toBe(true);
    expect((worker as any).isReportJobsTableMissing({ message: 'other' })).toBe(
      false,
    );
  });

  it('loads institutions directly by id when one is provided', async () => {
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst-1' });

    await expect(
      (worker as any).loadInstitutionData('user-1', 'inst-1'),
    ).resolves.toEqual({ id: 'inst-1' });
    expect(prisma.institution.findUnique).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      include: {
        balanceSheetItems: true,
        interestRateScenarios: true,
        liquidityPositions: true,
      },
    });
  });

  it('loads the most recent workspace institution when no institution id is provided', async () => {
    prisma.workspace.findFirst.mockResolvedValue({
      institutions: [{ id: 'inst-recent' }],
    });

    await expect(
      (worker as any).loadInstitutionData('user-1', null),
    ).resolves.toEqual({ id: 'inst-recent' });
  });

  it('generates reports through buildPDF on success', async () => {
    almEnterprise.getALMSummary.mockResolvedValue({ riskScore: 77 });
    stressTesting.runFullStressTest.mockResolvedValue({ scenarios: [] });
    almEnterprise.getRegulatoryCompliance.mockResolvedValue({ status: 'ok' });
    almEnterprise.getInstitution
      .mockResolvedValueOnce({ primaryRegulator: 'NCUA' })
      .mockResolvedValueOnce({ id: 'inst-1', primaryRegulator: 'NCUA' });
    const buildPDFSpy = jest
      .spyOn(worker as any, 'buildPDF')
      .mockResolvedValue(Buffer.from('pdf'));

    await expect(
      (worker as any).generateReport('inst-1', 'en'),
    ).resolves.toEqual(Buffer.from('pdf'));
    expect(buildPDFSpy).toHaveBeenCalledWith(
      expect.objectContaining({ primaryRegulator: 'NCUA' }),
      { riskScore: 77 },
      { scenarios: [] },
      expect.objectContaining({ trends: null, previousPeriod: null }),
      'en',
    );
  });

  it('falls back to a minimal pdf when report generation fails', async () => {
    const fallbackSpy = jest
      .spyOn(worker as any, 'buildFallbackPDF')
      .mockResolvedValue(Buffer.from('fallback'));
    const errorSpy = jest
      .spyOn((worker as any).logger, 'error')
      .mockImplementation(() => undefined);
    almEnterprise.getALMSummary.mockRejectedValueOnce(
      new Error('summary failed'),
    );
    stressTesting.runFullStressTest.mockResolvedValue({});
    almEnterprise.getRegulatoryCompliance.mockResolvedValue({});
    almEnterprise.getInstitution.mockResolvedValue({
      primaryRegulator: 'NCUA',
    });

    await expect(
      (worker as any).generateReport('inst-1', 'es'),
    ).resolves.toEqual(Buffer.from('fallback'));
    expect(fallbackSpy).toHaveBeenCalledWith('inst-1', 'es', 'summary failed');
    expect(errorSpy).toHaveBeenCalledWith({
      event: 'pipeline.pdf.generation_failed',
      institutionId: 'inst-1',
      lang: 'es',
      error: 'summary failed',
    });
  });

  it('builds a fallback pdf buffer', async () => {
    const buffer = await (worker as any).buildFallbackPDF(
      'inst-1',
      'en',
      'boom',
    );

    expect(buffer).toBeInstanceOf(Buffer);
    expect(buffer.length).toBeGreaterThan(0);
  });

  it('sends renewal reminders only at D-30, D-14, and D-7 for paid users', async () => {
    const baseNow = new Date('2026-03-30T12:00:00Z');
    jest.spyOn(Date, 'now').mockReturnValue(baseNow.getTime());
    prisma.subscription.findMany.mockResolvedValue([
      {
        userId: 'u30',
        tier: 'pro',
        currentPeriodEnd: new Date('2026-04-29T12:00:00Z'),
        user: { email: 'u30@cerniq.io', name: 'Thirty' },
      },
      {
        userId: 'u14',
        tier: 'pro',
        currentPeriodEnd: new Date('2026-04-13T12:00:00Z'),
        user: { email: 'u14@cerniq.io', name: 'Fourteen' },
      },
      {
        userId: 'u7',
        tier: 'pro',
        currentPeriodEnd: new Date('2026-04-06T12:00:00Z'),
        user: { email: 'u7@cerniq.io', name: 'Seven' },
      },
      {
        userId: 'skip',
        tier: 'pro',
        currentPeriodEnd: new Date('2026-03-29T12:00:00Z'),
        user: { email: 'skip@cerniq.io', name: 'Skip' },
      },
      {
        userId: 'no-email',
        tier: 'pro',
        currentPeriodEnd: new Date('2026-04-29T12:00:00Z'),
        user: { email: null, name: 'No Email' },
      },
    ]);

    await worker.renewalSequence();

    expect(email.sendRenewalReminder).toHaveBeenCalledTimes(3);
    expect(email.sendRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'u30@cerniq.io', daysLeft: 30 }),
    );
    expect(email.sendRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'u14@cerniq.io', daysLeft: 14 }),
    );
    expect(email.sendRenewalReminder).toHaveBeenCalledWith(
      expect.objectContaining({ email: 'u7@cerniq.io', daysLeft: 7 }),
    );
  });

  it('logs subscription-level renewal failures without aborting the whole sequence', async () => {
    const errorSpy = jest
      .spyOn((worker as any).logger, 'error')
      .mockImplementation(() => undefined);
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-03-30T12:00:00Z').getTime());
    prisma.subscription.findMany.mockResolvedValue([
      {
        userId: 'u1',
        tier: 'pro',
        currentPeriodEnd: new Date('2026-04-29T12:00:00Z'),
        user: { email: 'u1@cerniq.io', name: 'U1' },
      },
    ]);
    email.sendRenewalReminder.mockRejectedValue(new Error('mail down'));

    await worker.renewalSequence();

    expect(errorSpy).toHaveBeenCalledWith({
      event: 'renewal.reminder.error',
      userId: 'u1',
      error: 'mail down',
    });
  });

  it('alerts churn risk for inactive paid subscriptions and handles null last login', async () => {
    jest
      .spyOn(Date, 'now')
      .mockReturnValue(new Date('2026-03-30T12:00:00Z').getTime());
    prisma.subscription.findMany.mockResolvedValue([
      {
        userId: 'u1',
        tier: 'enterprise',
        currentPeriodEnd: new Date('2026-04-30T12:00:00Z'),
        user: {
          email: 'u1@cerniq.io',
          name: 'Dormant',
          lastLoginAt: new Date('2026-01-01T12:00:00Z'),
        },
      },
      {
        userId: 'u2',
        tier: 'pro',
        currentPeriodEnd: null,
        user: { email: 'u2@cerniq.io', name: 'Never', lastLoginAt: null },
      },
    ]);

    await worker.churnRiskDetection();

    expect(email.sendChurnRiskAlert).toHaveBeenCalledTimes(2);
    expect(email.sendChurnRiskAlert).toHaveBeenCalledWith(
      expect.objectContaining({
        userEmail: 'u2@cerniq.io',
        daysSinceLogin: 999,
        currentPeriodEnd: 'N/A',
      }),
    );
  });

  it('builds and sends the weekly revenue report', async () => {
    prisma.subscription.findMany
      .mockResolvedValueOnce([
        { tier: 'pro' },
        { tier: 'enterprise' },
        { tier: 'pro' },
      ])
      .mockResolvedValueOnce([
        {
          user: { email: 'a@cerniq.io' },
          tier: 'pro',
          currentPeriodEnd: new Date('2026-04-02T12:00:00Z'),
        },
      ]);
    prisma.subscription.count.mockResolvedValueOnce(2).mockResolvedValueOnce(1);

    await worker.weeklyRevenueReport();

    expect(email.sendWeeklyRevenueReport).toHaveBeenCalledWith({
      activeBytier: { pro: 2, enterprise: 1 },
      totalActive: 3,
      newThisWeek: 2,
      cancelledThisWeek: 1,
      upcomingRenewals: [
        { email: 'a@cerniq.io', tier: 'pro', renewsAt: 'Apr 2' },
      ],
    });
  });

  it('sends NPS surveys only once per completed job', async () => {
    prisma.reportJob.findMany.mockResolvedValue([
      {
        id: 'job-1',
        userId: 'user-1',
        institutionId: 'inst-1',
        institutionName: 'Coop Test',
        user: { email: 'ops@coop.pr', name: 'Ops' },
      },
      {
        id: 'job-2',
        userId: 'user-2',
        institutionId: 'inst-2',
        institutionName: 'Already Sent',
        user: { email: 'ops2@coop.pr', name: 'Ops2' },
      },
    ]);
    prisma.emailSequence.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' });
    prisma.emailSequence.create.mockResolvedValue({});

    await worker.sendNPSSurveys();

    expect(email.sendNPSSurvey).toHaveBeenCalledTimes(1);
    expect(email.sendNPSSurvey).toHaveBeenCalledWith({
      email: 'ops@coop.pr',
      name: 'Ops',
      institutionName: 'Coop Test',
      jobId: 'job-1',
      institutionId: 'inst-1',
    });
    expect(prisma.emailSequence.create).toHaveBeenCalledWith({
      data: {
        userId: 'user-1',
        sequenceKey: 'NPS',
        scheduledAt: expect.any(Date),
        sentAt: expect.any(Date),
        metadata: { jobId: 'job-1' },
      },
    });
  });

  it('purges expired raw job data and skips gracefully when nothing is expired', async () => {
    prisma.reportJob.findMany
      .mockResolvedValueOnce([
        {
          id: 'job-1',
          institutionName: 'Coop Test',
          completedAt: new Date('2025-01-01T00:00:00Z'),
        },
      ])
      .mockResolvedValueOnce([]);
    prisma.reportJob.update.mockResolvedValue({});

    await worker.deleteExpiredData();
    await worker.deleteExpiredData();

    expect(prisma.reportJob.update).toHaveBeenCalledTimes(1);
    expect(prisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-1' },
      data: { rawData: null, rawDataPurgedAt: expect.any(Date) },
    });
  });

  it('warns instead of erroring when data purge cannot find the report_jobs table', async () => {
    const warnSpy = jest
      .spyOn((worker as any).logger, 'warn')
      .mockImplementation(() => undefined);
    prisma.reportJob.findMany.mockRejectedValue({
      message: 'report_jobs does not exist',
    });

    await worker.deleteExpiredData();

    expect(warnSpy).toHaveBeenCalledWith(
      'Skipping data purge: report_jobs table is missing',
    );
  });

  it('resets stalled jobs until the max retry threshold, then fails them', async () => {
    prisma.reportJob.findMany.mockResolvedValue([
      {
        id: 'job-reset',
        retryCount: 1,
        institutionName: 'Retry Coop',
        user: { email: 'reset@coop.pr' },
      },
      {
        id: 'job-fail',
        retryCount: 3,
        institutionName: 'Fail Coop',
        user: { email: 'fail@coop.pr' },
      },
    ]);
    prisma.reportJob.update.mockResolvedValue({});

    await worker.checkStalledJobs();

    expect(prisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-reset' },
      data: {
        status: 'QUEUED',
        retryCount: { increment: 1 },
        processingStartedAt: null,
        errorMessage:
          'Auto-reset: stalled in PROCESSING for >30 min (retry 2/3)',
      },
    });
    expect(prisma.reportJob.update).toHaveBeenCalledWith({
      where: { id: 'job-fail' },
      data: {
        status: 'FAILED',
        errorMessage: 'Job stalled 3 times — exceeded max retries (3)',
      },
    });
    expect(email.sendJobFailedAlert).toHaveBeenCalledWith({
      jobId: 'job-reset',
      institutionName: 'Retry Coop',
      error:
        'Job stalled in PROCESSING >30 min — auto-reset to QUEUED (retry 2/3)',
      clientEmail: 'reset@coop.pr',
    });
    expect(email.sendJobFailedAlert).toHaveBeenCalledWith({
      jobId: 'job-fail',
      institutionName: 'Fail Coop',
      error: 'Job stalled 3 times, marked FAILED',
      clientEmail: 'fail@coop.pr',
    });
  });

  it('sends compliance deadline reminders and logs per-institution email failures', async () => {
    const errorSpy = jest
      .spyOn((worker as any).logger, 'error')
      .mockImplementation(() => undefined);
    complianceCalendar.getInstitutionsWithUpcomingDeadlines.mockResolvedValue([
      {
        institutionName: 'Coop A',
        contactEmail: 'ops@coopa.pr',
        deadlines: [
          {
            urgency: 'HIGH',
            titleEs: 'Liquidez',
            title: 'Liquidity',
            deadlineDate: new Date(Date.now() + 2 * 86_400_000).toISOString(),
          },
        ],
      },
      {
        institutionName: 'Coop B',
        contactEmail: 'ops@coopb.pr',
        deadlines: [
          {
            urgency: 'LOW',
            titleEs: 'Informe',
            title: 'Report',
            deadlineDate: new Date(Date.now() - 86_400_000).toISOString(),
          },
        ],
      },
      {
        institutionName: 'Coop C',
        contactEmail: null,
        deadlines: [],
      },
    ]);
    email.sendDailyOperationsReport
      .mockResolvedValueOnce(undefined)
      .mockRejectedValueOnce(new Error('smtp down'));

    await worker.sendDeadlineReminders();

    expect(email.sendDailyOperationsReport).toHaveBeenCalledTimes(2);
    expect(email.sendDailyOperationsReport).toHaveBeenCalledWith({
      pendingJobs: 0,
      failedJobs: 0,
      newLeads: 0,
      pendingFollowUps: 1,
    });
    expect(errorSpy).toHaveBeenCalledWith({
      event: 'pipeline.deadline_reminder.failed',
      institution: 'Coop B',
      error: 'smtp down',
    });
  });
});
