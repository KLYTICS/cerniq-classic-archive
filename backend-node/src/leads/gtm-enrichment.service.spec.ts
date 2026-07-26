import { GtmEnrichmentService } from './gtm-enrichment.service';
import { loadCooperativaCsvRows } from './coop-csv-seed';

describe('coop-csv-seed', () => {
  it('loads all PR cooperativas from the outbound seed CSV', () => {
    const rows = loadCooperativaCsvRows();
    expect(rows.length).toBeGreaterThanOrEqual(91);
    // Registry-reconciled names are abbreviated ("Coop A/C de Rincón",
    // "COOPACA", "CrediCentro"), so assert a non-empty name rather than the
    // literal word "Cooperativa"; institutionType below carries the semantics.
    expect(rows[0].name.length).toBeGreaterThan(0);
    expect(rows[0].institutionType).toBe('cooperativa');
    expect(rows[0].estimatedAssets).toBeGreaterThan(0);
  });
});

describe('GtmEnrichmentService', () => {
  const prisma = {
    prospectInstitution: {
      findFirst: jest.fn(),
      findMany: jest.fn(),
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cooperativaBenchmark: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
    intelligenceContact: {
      findFirst: jest.fn(),
      create: jest.fn(),
    },
  };

  const qualification = {
    qualifyProspect: jest.fn().mockResolvedValue({
      totalScore: 80,
      grade: 'A',
      priority: 'HIGH',
      nextAction: 'Schedule in-person demo',
    }),
  };

  const scoring = {
    scoreAllLeads: jest
      .fn()
      .mockResolvedValue({ scored: 3, hot: 1, warm: 1, cold: 1 }),
  };

  const intelligence = {
    syncProspectsToAccounts: jest
      .fn()
      .mockResolvedValue({ created: 2, updated: 1 }),
  };

  const freeReport = {
    fuzzyMatch: jest.fn().mockReturnValue({
      slug: 'caguas',
      totalAssets: 2_800_000_000,
      capitalRatioPct: 10.4,
      liquidityRatioPct: 19.6,
      niiMarginPct: 4.1,
      assetGrowthYoyPct: 5.3,
      loanToDepositPct: 78.2,
    }),
    computeHealthScore: jest.fn().mockReturnValue(82),
  };

  let service: GtmEnrichmentService;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new GtmEnrichmentService(
      prisma as any,
      qualification as any,
      scoring as any,
      intelligence as any,
      freeReport as any,
    );
  });

  it('seeds new cooperativas from CSV and skips existing names', async () => {
    prisma.prospectInstitution.findFirst
      .mockResolvedValueOnce(null)
      .mockResolvedValueOnce({ id: 'existing' });
    prisma.prospectInstitution.create.mockResolvedValue({});
    prisma.prospectInstitution.update.mockResolvedValue({});
    prisma.cooperativaBenchmark.findFirst.mockResolvedValue({ id: 'bench' });

    const result = await service.seedAllCooperativasFromCsv();

    expect(result.created).toBeGreaterThanOrEqual(1);
    expect(result.updated).toBeGreaterThanOrEqual(1);
    expect(result.total).toBeGreaterThanOrEqual(91);
    expect(prisma.prospectInstitution.create).toHaveBeenCalled();
    expect(prisma.prospectInstitution.update).toHaveBeenCalled();
  });

  it('links COSSEC snapshots and syncs intelligence accounts', async () => {
    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Cooperativa de Ahorro y Crédito de Caguas',
        estimatedAssets: 150_000_000,
        publicDataIdentifier: null,
        almRiskScore: null,
      },
    ]);

    const result = await service.enrichAllProspects({
      syncIntelligence: true,
      scoreLeads: true,
      limit: 10,
    });

    expect(result.cossecLinked).toBe(1);
    expect(result.almRiskScored).toBe(1);
    expect(result.intelligenceSynced).toEqual({ created: 2, updated: 1 });
    expect(result.leadsScored).toBe(3);
    expect(prisma.prospectInstitution.update).toHaveBeenCalledWith(
      expect.objectContaining({
        where: { id: 'p1' },
        data: expect.objectContaining({
          publicDataIdentifier: 'caguas',
          almRiskScore: 82,
        }),
      }),
    );
  });

  it('parses LinkedIn export CSV and matches cooperativa companies', () => {
    const csv = [
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      'Maria,Gonzalez,https://linkedin.com/in/maria,CFO@caguas.com,Cooperativa de Ahorro y Crédito de Caguas,CFO,01 Jan 2026',
    ].join('\n');

    const rows = service.parseLinkedInCsv(csv);
    expect(rows).toHaveLength(1);
    expect(rows[0].company).toContain('Caguas');
    expect(rows[0].linkedinUrl).toContain('linkedin.com');
  });

  it('imports LinkedIn contacts onto intelligence accounts', async () => {
    const csv = [
      'First Name,Last Name,URL,Email Address,Company,Position,Connected On',
      'Maria,Gonzalez,https://linkedin.com/in/maria,CFO@caguas.com,Cooperativa de Ahorro y Crédito de Caguas,CFO,01 Jan 2026',
    ].join('\n');

    prisma.prospectInstitution.findMany.mockResolvedValue([
      {
        id: 'p1',
        name: 'Cooperativa de Ahorro y Crédito de Caguas',
        contactName: null,
        contactEmail: null,
      },
    ]);
    prisma.prospectInstitution.findUnique.mockResolvedValue({
      id: 'p1',
      intelligenceAccountId: 'acct-1',
    });
    prisma.intelligenceContact.findFirst.mockResolvedValue(null);
    prisma.intelligenceContact.create.mockResolvedValue({ id: 'c1' });
    prisma.prospectInstitution.update.mockResolvedValue({});

    const result = await service.importLinkedInConnections(csv);

    expect(result.parsed).toBe(1);
    expect(result.matched).toBe(1);
    expect(result.contactsCreated).toBe(1);
    expect(prisma.intelligenceContact.create).toHaveBeenCalled();
  });
});
