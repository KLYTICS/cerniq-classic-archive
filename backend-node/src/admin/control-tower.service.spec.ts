import { ControlTowerService } from './control-tower.service';

describe('ControlTowerService', () => {
  it('builds a combined control-tower summary', async () => {
    const prisma = {
      demoRequest: { count: jest.fn().mockResolvedValue(5) },
      institution: { count: jest.fn().mockResolvedValue(3) },
      user: {
        count: jest.fn().mockResolvedValueOnce(10).mockResolvedValueOnce(2),
      },
      prospectInstitution: { count: jest.fn().mockResolvedValue(7) },
      subscription: {
        count: jest
          .fn()
          .mockResolvedValueOnce(4)
          .mockResolvedValueOnce(6)
          .mockResolvedValueOnce(2)
          .mockResolvedValueOnce(1)
          .mockResolvedValueOnce(1),
      },
      reportJob: {
        count: jest.fn().mockResolvedValue(1),
        findMany: jest
          .fn()
          .mockResolvedValueOnce([
            {
              id: 'job-1',
              institutionName: 'Coop One',
              status: 'FAILED',
              retryCount: 0,
              createdAt: new Date().toISOString(),
              completedAt: null,
              errorMessage: 'bad row',
              triggeredBy: 'portal',
              user: { email: 'one@test.com' },
            },
          ])
          .mockResolvedValueOnce([
            {
              id: 'job-portal',
              userId: 'user-1',
              institutionName: 'Coop Portal',
              status: 'VALIDATION_FAILED',
              errorMessage: 'missing column',
              createdAt: new Date().toISOString(),
            },
          ]),
        findFirst: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      auditLog: { count: jest.fn().mockResolvedValue(42) },
    };

    const intelligence = {
      getOverview: jest.fn().mockResolvedValue({
        workspace: { id: 'ws-1', name: 'Cerniq Intelligence' },
        stats: {
          totalAccounts: 10,
          buyers: 4,
          competitors: 2,
          staleAccounts: 3,
          overdueActions: 1,
        },
        hotChanges: [],
        staleAccounts: [],
        actions: [],
        recentRuns: [],
        recentArtifacts: [],
        handoff: { summary: 'Intelligence looks good', pinnedEntries: [] },
      }),
      refreshAccounts: jest.fn(),
    };

    const demoSeats = {
      listAdminDemoSeats: jest.fn().mockResolvedValue([
        { id: 'seat-1', status: 'active', daysRemaining: 2 },
        { id: 'seat-2', status: 'expired', daysRemaining: 0 },
      ]),
      sweepExpired: jest.fn(),
    };

    const service = new ControlTowerService(
      prisma as any,
      intelligence as any,
      demoSeats as any,
      { runPipeline: jest.fn() } as any,
      { log: jest.fn() } as any,
      {
        getSnapshot: jest.fn().mockResolvedValue({
          workspaceRoot: '/repo',
          activeBranch: 'codex/test',
          latestStatusSummary: ['Local code-quality and build gates are green'],
          latestStatusBlockers: ['GitHub Actions billing is blocked'],
          lastAgentOutputTitle: 'Build admin control tower',
          handoffUpdatedAt: '2026-04-08T18:00:00.000Z',
          latestStatusUpdatedAt: '2026-04-08T18:00:00.000Z',
          activeModes: ['ralph'],
          stateFiles: ['hud-state.json'],
          metrics: {
            turnCount: 80,
            lastTurnAt: '2026-04-08T18:00:00.000Z',
          },
          recommendedCommands: ['git status --short --branch'],
        }),
      } as any,
    );

    const result = await service.getSummary();

    expect(result.stats.demoRequests).toBe(5);
    expect(result.revenue.activeSubscriptions).toBe(4);
    expect(result.featureBridge).toHaveLength(7);
    expect(result.nextActions).toEqual(
      expect.arrayContaining([
        expect.objectContaining({ domain: 'demo_seats' }),
        expect.objectContaining({ domain: 'intelligence' }),
      ]),
    );
  });

  it('runs a control-tower action with a structured result', async () => {
    const refreshAccounts = jest.fn().mockResolvedValue({ refreshed: 3 });

    const service = new ControlTowerService(
      {
        demoRequest: { count: jest.fn() },
        institution: { count: jest.fn() },
        user: { count: jest.fn() },
        prospectInstitution: { count: jest.fn() },
        subscription: { count: jest.fn() },
        reportJob: {
          count: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update: jest.fn(),
        },
        auditLog: { count: jest.fn() },
      } as any,
      {
        getOverview: jest.fn(),
        refreshAccounts,
      } as any,
      {
        listAdminDemoSeats: jest.fn(),
        sweepExpired: jest.fn(),
      } as any,
      { runPipeline: jest.fn() } as any,
      { log: jest.fn() } as any,
      { getSnapshot: jest.fn() } as any,
    );

    const result = await service.runAction('refresh_intelligence');

    expect(result.status).toBe('success');
    expect(result.action).toBe('refresh_intelligence');
    expect(refreshAccounts).toHaveBeenCalledWith({
      staleOnly: true,
      trigger: 'control_tower',
    });
  });

  it('opens a portal cycle for a specific user when requested', async () => {
    const create = jest.fn().mockResolvedValue({
      id: 'job-new',
      status: 'AWAITING_DATA',
    });

    const service = new ControlTowerService(
      {
        demoRequest: { count: jest.fn() },
        institution: { count: jest.fn() },
        user: { count: jest.fn() },
        prospectInstitution: { count: jest.fn() },
        subscription: { count: jest.fn() },
        workspace: {
          findFirst: jest.fn().mockResolvedValue({ name: 'Coop Workspace' }),
        },
        reportJob: {
          count: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest
            .fn()
            .mockResolvedValueOnce(null)
            .mockResolvedValueOnce(null),
          create,
          update: jest.fn(),
        },
        auditLog: { count: jest.fn() },
      } as any,
      { getOverview: jest.fn(), refreshAccounts: jest.fn() } as any,
      { listAdminDemoSeats: jest.fn(), sweepExpired: jest.fn() } as any,
      { runPipeline: jest.fn() } as any,
      { log: jest.fn() } as any,
      { getSnapshot: jest.fn() } as any,
    );

    const result = await service.runAction('open_portal_cycle', {
      userId: 'user-1',
    });

    expect(result.status).toBe('success');
    expect(create).toHaveBeenCalledWith(
      expect.objectContaining({
        data: expect.objectContaining({
          userId: 'user-1',
          status: 'AWAITING_DATA',
          triggeredBy: 'admin_control_tower',
        }),
      }),
    );
  });

  it('retries a failed pipeline job when given a target job id', async () => {
    const update = jest.fn().mockResolvedValue({ id: 'job-failed' });

    const service = new ControlTowerService(
      {
        demoRequest: { count: jest.fn() },
        institution: { count: jest.fn() },
        user: { count: jest.fn() },
        prospectInstitution: { count: jest.fn() },
        subscription: { count: jest.fn() },
        reportJob: {
          count: jest.fn(),
          findMany: jest.fn(),
          findFirst: jest.fn(),
          create: jest.fn(),
          update,
        },
        auditLog: { count: jest.fn() },
      } as any,
      { getOverview: jest.fn(), refreshAccounts: jest.fn() } as any,
      { listAdminDemoSeats: jest.fn(), sweepExpired: jest.fn() } as any,
      { runPipeline: jest.fn() } as any,
      { log: jest.fn() } as any,
      { getSnapshot: jest.fn() } as any,
    );

    const result = await service.runAction('retry_pipeline_job', {
      jobId: 'job-failed',
    });

    expect(result.status).toBe('success');
    expect(update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'job-failed' },
      }),
    );
  });
});
