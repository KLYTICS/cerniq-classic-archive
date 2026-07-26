import { CooperativaDirectoryService } from './cooperativa-directory.service';
import { COOPERATIVA_LEADERSHIP_ROLES } from './cooperativa-org-template';

jest.mock('../leads/coop-csv-seed', () => ({
  loadCooperativaCsvRows: jest.fn().mockReturnValue([
    {
      name: 'Cooperativa de Ahorro y Crédito de Caguas',
      institutionType: 'cooperativa',
      location: 'Caguas, PR',
      estimatedAssets: 320_000_000,
      publicDataSource: 'cossec',
      contactRole: 'CFO',
      region: 'East',
    },
  ]),
  toProspectCreateInput: jest.fn((row: { name: string }) => ({
    name: row.name,
  })),
}));

describe('CooperativaDirectoryService', () => {
  const prisma = {
    prospectInstitution: {
      findFirst: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
    },
    cooperativaOrgProfile: {
      findUnique: jest.fn(),
      create: jest.fn(),
      update: jest.fn(),
      findMany: jest.fn(),
      findUniqueOrThrow: jest.fn(),
    },
    cooperativaOrgUnit: {
      upsert: jest.fn(),
    },
    cooperativaLeadershipSeat: {
      upsert: jest.fn(),
      update: jest.fn(),
    },
  };

  let service: CooperativaDirectoryService;

  beforeEach(() => {
    jest.clearAllMocks();
    prisma.prospectInstitution.findFirst.mockResolvedValue({
      id: 'prospect-1',
      name: 'Cooperativa de Ahorro y Crédito de Caguas',
      location: 'Caguas, PR',
      estimatedAssets: 320_000_000,
      publicDataIdentifier: 'caguas',
      contactRole: 'CFO',
      notes: null,
    });
    prisma.prospectInstitution.update.mockResolvedValue({});
    prisma.cooperativaOrgProfile.findUnique.mockResolvedValue(null);
    prisma.cooperativaOrgProfile.create.mockResolvedValue({ id: 'profile-1' });
    prisma.cooperativaOrgUnit.upsert.mockImplementation(
      ({ create }: { create: { unitKey: string } }) =>
        Promise.resolve({
          id: `unit-${create.unitKey}`,
          unitKey: create.unitKey,
        }),
    );
    prisma.cooperativaLeadershipSeat.upsert.mockResolvedValue({});
    service = new CooperativaDirectoryService(prisma as any);
  });

  it('seeds org profiles, units, and leadership seats for all CSV rows', async () => {
    const result = await service.seedFullDirectory();

    expect(result.institutions).toBe(1);
    expect(result.profilesCreated).toBe(1);
    expect(prisma.cooperativaOrgUnit.upsert).toHaveBeenCalled();
    expect(prisma.cooperativaLeadershipSeat.upsert).toHaveBeenCalledTimes(
      COOPERATIVA_LEADERSHIP_ROLES.length,
    );
    expect(prisma.prospectInstitution.update).toHaveBeenCalled();
    const createCall = prisma.cooperativaOrgProfile.create.mock.calls[0][0];
    expect(createCall.data.metadata.outreach.secure.pii).toBe('none');
  });

  it('builds agent bundle with schema version', async () => {
    prisma.cooperativaOrgProfile.findMany.mockResolvedValue([
      { id: 'profile-1' },
    ]);
    prisma.cooperativaOrgProfile.findUniqueOrThrow.mockResolvedValue({
      id: 'profile-1',
      prospectInstitutionId: 'prospect-1',
      slug: 'caguas',
      region: 'East',
      municipality: 'Caguas',
      regulator: 'COSSEC',
      structureVersion: '2026.1',
      metadata: {
        seedContactRole: 'CFO',
        outreach: {
          v: 1,
          score: 92,
          grade: 'A',
          tier: 1,
          pri: 'H',
          role: 'cfo',
          roleLabel: 'CFO',
          ch: ['ip', 'li', 'em'],
          seq: 'in-person → LinkedIn → email',
          hook: 'test hook',
          ask: '15-min walkthrough',
          note: 'Caguas outreach note',
          route: { r: 'East', w: 2 },
          cossec: true,
          cossecSlug: 'caguas',
          assetsM: 320,
          loc: 'Caguas, PR',
          secure: { pii: 'none', access: 'admin' },
        },
      },
      prospect: {
        name: 'Cooperativa de Ahorro y Crédito de Caguas',
        location: 'Caguas, PR',
        estimatedAssets: 320_000_000,
        publicDataIdentifier: 'caguas',
        contactRole: 'CFO',
      },
      units: [
        {
          id: 'u1',
          unitKey: 'finanzas',
          nameEs: 'Finanzas',
          nameEn: 'Finance',
          sortOrder: 30,
        },
      ],
      leadershipSeats: [
        {
          id: 's1',
          orgUnitId: 'u1',
          roleKey: 'cfo',
          titleEs: 'CFO',
          titleEn: 'CFO',
          decisionTier: 'executive',
          almBuyerPriority: 100,
          reportsToRoleKey: 'gerente_general',
          fullName: null,
          email: null,
          phone: null,
          linkedinUrl: null,
          isPrimaryBuyer: true,
          isPlaceholder: true,
          provenance: 'org_template+outreach',
          metadata: {
            contactNote: {
              approach: 'Primary ALM buyer',
              openerEs: 'Buenos días',
              openerEn: 'Hi',
              bestChannel: 'in_person',
              nextAction: '15-min walkthrough',
            },
          },
        },
      ],
    });

    const bundle = await service.buildAgentBundle(10);
    expect(bundle.schemaVersion).toBe('cerniq.cooperativa-directory.v1');
    expect(bundle.institutionCount).toBe(1);
    expect(bundle.institutions[0].slug).toBe('caguas');
    expect(bundle.institutions[0].primaryBuyers).toHaveLength(1);
    expect(bundle.institutions[0].outreach.grade).toBe('A');
    expect(
      bundle.institutions[0].primaryBuyers[0].contactNote?.bestChannel,
    ).toBe('in_person');
  });
});
