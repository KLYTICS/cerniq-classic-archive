import { IntelligenceService } from './intelligence.service';

function createPrismaMock() {
  return {
    workspace: {
      findUnique: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    intelligenceAccount: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    intelligenceSource: {
      upsert: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    intelligenceContact: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    intelligenceRun: {
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
    },
    intelligenceSnapshot: {
      upsert: jest.fn(),
      findMany: jest.fn(),
    },
    intelligenceInsight: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    intelligenceAction: {
      findMany: jest.fn(),
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      count: jest.fn(),
    },
    intelligenceArtifact: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      findFirst: jest.fn(),
    },
    workspaceMemoryEntry: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
    lead: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    prospectInstitution: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
  } as any;
}

describe('IntelligenceService', () => {
  let prisma: ReturnType<typeof createPrismaMock>;
  let service: IntelligenceService;

  beforeEach(() => {
    prisma = createPrismaMock();
    prisma.workspace.findUnique.mockResolvedValue({
      id: 'ws-1',
      name: 'Cerniq Intelligence',
    });
    prisma.workspace.findFirst.mockResolvedValue({
      id: 'ws-1',
      name: 'Cerniq Intelligence',
    });
    service = new IntelligenceService(prisma);
  });

  it('imports accounts using deterministic entity resolution', async () => {
    prisma.intelligenceAccount.findFirst.mockResolvedValueOnce(null);
    prisma.intelligenceAccount.create.mockResolvedValue({
      id: 'acct-1',
      workspaceId: 'ws-1',
      kind: 'BUYER',
      name: 'Cooperativa Uno',
      normalizedName: 'cooperativa uno',
      metadata: null,
    });
    prisma.intelligenceContact.findFirst.mockResolvedValue(null);
    prisma.lead.findFirst.mockResolvedValue(null);
    prisma.lead.create.mockResolvedValue({ id: 'lead-1' });
    prisma.prospectInstitution.findFirst.mockResolvedValue(null);
    prisma.prospectInstitution.create.mockResolvedValue({ id: 'prospect-1' });
    prisma.intelligenceAccount.findMany.mockResolvedValue([
      {
        id: 'acct-1',
        workspaceId: 'ws-1',
        kind: 'BUYER',
        status: 'TRACKED',
        name: 'Cooperativa Uno',
        domain: 'coopuno.com',
        websiteUrl: 'https://coopuno.com',
        currentSummary: null,
        freshnessScore: 10,
        opportunityScore: 0,
        threatScore: 0,
        actionScore: 0,
        lastRefreshedAt: null,
        nextRefreshAt: null,
        contacts: [],
        actions: [],
        insights: [],
        syncedLeads: [{ id: 'lead-1' }],
        syncedProspects: [{ id: 'prospect-1' }],
      },
    ]);

    const result = await service.importAccounts({
      accounts: [
        {
          kind: 'BUYER',
          name: 'Cooperativa Uno',
          websiteUrl: 'https://coopuno.com',
          sources: [
            {
              label: 'Website',
              url: 'https://coopuno.com',
              sourceType: 'PUBLIC_WEBSITE',
            },
          ],
          contacts: [
            { fullName: 'Ana CFO', email: 'ana@coopuno.com', title: 'CFO' },
          ],
        },
      ],
    });

    expect(result.created).toBe(1);
    expect(prisma.intelligenceSource.upsert).toHaveBeenCalled();
    expect(prisma.intelligenceContact.create).toHaveBeenCalled();
  });

  it('exports report artifacts as deterministic CSV or JSON', async () => {
    prisma.intelligenceArtifact.findUnique.mockResolvedValue({
      id: 'artifact-1',
      title: 'Weekly Brief 2026-04-06',
      csvContent: 'name,score\nCoop,80',
      artifactData: { rows: [{ name: 'Coop', score: 80 }] },
    });

    const csv = await service.exportArtifact('artifact-1', 'csv');
    const json = await service.exportArtifact('artifact-1', 'json');

    expect(csv.body).toContain('Coop,80');
    expect(json.body).toEqual({ rows: [{ name: 'Coop', score: 80 }] });
  });
});
