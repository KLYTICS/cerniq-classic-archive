import { InstitutionIntelligenceService } from './institution-intelligence.service';

describe('InstitutionIntelligenceService', () => {
  let prisma: Record<string, any>;
  let service: InstitutionIntelligenceService;

  beforeEach(() => {
    prisma = {
      workspace: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      prospectInstitution: {
        findMany: jest.fn(),
        findUnique: jest.fn(),
        update: jest.fn(),
      },
      intelligenceAccount: {
        findFirst: jest.fn(),
        findUnique: jest.fn(),
        findMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      intelligenceSource: {
        upsert: jest.fn(),
        findFirst: jest.fn(),
      },
      lead: {
        findMany: jest.fn(),
        update: jest.fn(),
      },
      cooperativaBenchmark: {
        findFirst: jest.fn(),
      },
      intelligenceRun: {
        create: jest.fn(),
        update: jest.fn(),
      },
      intelligenceSnapshot: {
        findFirst: jest.fn(),
        create: jest.fn(),
      },
      intelligenceInsight: {
        deleteMany: jest.fn(),
        create: jest.fn(),
      },
      intelligenceAction: {
        deleteMany: jest.fn(),
        create: jest.fn(),
        update: jest.fn(),
      },
      intelligenceArtifact: {
        create: jest.fn(),
        createMany: jest.fn(),
      },
      workspaceMemoryEntry: {
        create: jest.fn(),
      },
    };

    service = new InstitutionIntelligenceService(
      prisma as any,
      {
        qualifyProspect: jest.fn().mockResolvedValue({
          totalScore: 72,
          maxPossible: 100,
          grade: 'A',
          priority: 'HIGH',
          nextAction: 'Schedule a demo',
          nextActionEs: 'Coordinar una demo',
        }),
      } as any,
      {
        scoreLead: jest.fn().mockResolvedValue({
          total: 61,
          fit: 34,
          intent: 27,
          tier: 'WARM',
        }),
      } as any,
      {
        analyzeProspect: jest.fn().mockResolvedValue({
          riskFlags: [
            {
              metric: 'Net Worth Ratio',
              metricEs: 'Ratio de Capital Neto',
              actual: 7.1,
              peerMedian: 9.2,
              gap: -2.1,
              severity: 'HIGH',
              narrative: 'Risk',
              narrativeEs: 'Riesgo',
            },
          ],
        }),
      } as any,
      {
        generateSampleReport: jest
          .fn()
          .mockResolvedValue(Buffer.from('sample-report')),
      } as any,
    );
  });

  it('syncs prospect institutions into buyer intelligence accounts', async () => {
    prisma.workspace.findFirst.mockResolvedValue({ id: 'ws-1' });
    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'prospect-1',
        name: 'Cooperativa Demo',
        institutionType: 'cooperativa',
        location: 'San Juan, PR',
        estimatedAssets: 250_000_000,
        publicDataSource: 'cossec',
        outreachStatus: 'not_started',
        contactRole: 'CFO',
        contactEmail: null,
      },
    ]);
    prisma.intelligenceAccount.findFirst.mockResolvedValue(null);
    prisma.intelligenceAccount.create.mockResolvedValue({
      id: 'acct-1',
      workspaceId: 'ws-1',
      name: 'Cooperativa Demo',
    });
    prisma.intelligenceSource.upsert.mockResolvedValue({ id: 'src-1' });
    prisma.prospectInstitution.update.mockResolvedValue({});
    prisma.lead.findMany.mockResolvedValue([{ id: 'lead-1' }]);
    prisma.lead.update.mockResolvedValue({});

    const result = await service.syncProspectsToAccounts();

    expect(result.created).toBe(1);
    expect(prisma.intelligenceAccount.create).toHaveBeenCalled();
    expect(prisma.intelligenceSource.upsert).toHaveBeenCalled();
    expect(prisma.prospectInstitution.update).toHaveBeenCalledWith({
      where: { id: 'prospect-1' },
      data: { intelligenceAccountId: 'acct-1' },
    });
    expect(prisma.lead.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'lead-1' },
        data: expect.objectContaining({ intelligenceAccountId: 'acct-1' }),
      }),
    );
  });

  it('refreshes a prospect dossier into snapshots, insights, actions, and artifacts', async () => {
    prisma.workspace.findFirst.mockResolvedValue({ id: 'ws-1' });
    const prospect = {
      id: 'prospect-1',
      name: 'Cooperativa Demo',
      institutionType: 'cooperativa',
      location: 'San Juan, PR',
      estimatedAssets: 250_000_000,
      publicDataSource: 'cossec',
      outreachStatus: 'not_started',
      outreachSentAt: null,
      contactRole: 'CFO',
      contactEmail: null,
      reportUrl: null,
      intelligenceAccountId: 'acct-1',
      updatedAt: new Date('2026-04-01T00:00:00Z'),
    };

    prisma.intelligenceAccount.findUnique.mockResolvedValueOnce({
      id: 'acct-1',
      workspaceId: 'ws-1',
      metadata: null,
    });
    prisma.prospectInstitution.findUnique.mockResolvedValue(prospect);
    prisma.intelligenceSource.upsert.mockResolvedValue({ id: 'src-1' });
    prisma.lead.findMany.mockResolvedValue([
      {
        id: 'lead-1',
        institutionName: 'Cooperativa Demo',
        updatedAt: new Date(),
      },
    ]);
    prisma.lead.update.mockResolvedValue({});
    prisma.intelligenceRun.create.mockResolvedValue({
      id: 'run-1',
      workspaceId: 'ws-1',
    });
    prisma.intelligenceAccount.findUnique.mockResolvedValueOnce({
      id: 'acct-1',
      workspaceId: 'ws-1',
      name: 'Cooperativa Demo',
      metadata: null,
      lastChangedAt: null,
      syncedProspects: [prospect],
      syncedLeads: [
        { id: 'lead-1', status: 'CONTACTED', updatedAt: new Date() },
      ],
    });
    prisma.cooperativaBenchmark.findFirst.mockResolvedValue({
      period: 'Q3 2025',
      totalAssetsMedian: 185_000_000,
      capitalRatioMedian: 9.2,
      loanToShareMedian: 72.5,
      liquidityRatioMedian: 22.1,
      niiMarginMedian: 3.8,
    });
    prisma.intelligenceSnapshot.findFirst.mockResolvedValue(null);
    prisma.intelligenceSource.findFirst.mockResolvedValue({ id: 'src-1' });
    prisma.intelligenceSnapshot.create.mockResolvedValue({
      id: 'snap-1',
      factsJson: { foo: 'bar' },
    });
    prisma.intelligenceInsight.deleteMany.mockResolvedValue({});
    prisma.intelligenceAction.deleteMany.mockResolvedValue({});
    prisma.intelligenceInsight.create.mockImplementation(
      ({ data }: { data: any }) =>
        Promise.resolve({ id: `insight-${data.type}`, ...data }),
    );
    prisma.intelligenceAction.create.mockResolvedValue({});
    prisma.intelligenceArtifact.createMany.mockResolvedValue({});
    prisma.workspaceMemoryEntry.create.mockResolvedValue({});
    prisma.intelligenceAccount.update.mockResolvedValue({});
    prisma.prospectInstitution.update.mockResolvedValue({});
    const detailedAccount = {
      id: 'acct-1',
      name: 'Cooperativa Demo',
      kind: 'BUYER',
      status: 'TRACKED',
      workspaceId: 'ws-1',
      institutionalType: 'cooperativa',
      sourceOfTruth: 'cossec',
      freshnessScore: 92,
      opportunityScore: 69,
      threatScore: 78,
      actionScore: 88,
      lastRefreshedAt: new Date(),
      lastChangedAt: new Date(),
      nextRefreshAt: new Date(),
      currentSummary: 'summary',
      metadata: null,
      syncedProspects: [prospect],
      syncedLeads: [{ id: 'lead-1', status: 'CONTACTED' }],
      sources: [
        {
          id: 'src-1',
          label: 'Official registry',
          url: 'https://www.cossec.com/',
        },
      ],
      snapshots: [
        { id: 'snap-1', factsJson: { foo: 'bar' }, capturedAt: new Date() },
      ],
      insights: [
        {
          id: 'insight-1',
          title: 'Top finding',
          severity: 'HIGH',
          type: 'URGENCY_SIGNAL',
        },
      ],
      actions: [
        {
          id: 'action-1',
          title: 'Review latest dossier',
          status: 'OPEN',
          actionScore: 92,
        },
      ],
      artifacts: [{ id: 'artifact-1', title: 'Cooperativa Demo dossier' }],
      memoryEntries: [{ id: 'memory-1', title: 'note' }],
    };
    prisma.intelligenceAccount.findUnique.mockResolvedValueOnce(
      detailedAccount,
    );
    prisma.intelligenceAccount.findUnique.mockResolvedValue(detailedAccount);

    const dossier = await service.refreshProspectDossier('prospect-1');

    expect(prisma.intelligenceSnapshot.create).toHaveBeenCalled();
    expect(prisma.intelligenceInsight.create).toHaveBeenCalled();
    expect(prisma.intelligenceAction.create).toHaveBeenCalled();
    expect(prisma.intelligenceArtifact.createMany).toHaveBeenCalled();
    expect(dossier.account.name).toBe('Cooperativa Demo');
    expect(dossier.insights).toHaveLength(1);
  });
});
