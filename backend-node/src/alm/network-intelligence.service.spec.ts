import { NetworkIntelligenceService } from './network-intelligence.service';

describe('NetworkIntelligenceService', () => {
  let service: NetworkIntelligenceService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      institution: { findMany: jest.fn() },
    };
    service = new NetworkIntelligenceService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns demo result when no institutions exist', async () => {
    prisma.institution.findMany.mockResolvedValue([]);

    const result = await service.getNetworkOverview();

    expect(result.aggregates.totalInstitutions).toBe(94);
    expect(result.institutions).toHaveLength(15);
    expect(result.outliers.length).toBeGreaterThan(0);
    expect(result.contagionRisks.length).toBeGreaterThan(0);
    expect(result.aggregates.systemicRiskScore).toBe(35);
  });

  it('demo institutions have expected PR cooperativa names', async () => {
    prisma.institution.findMany.mockResolvedValue([]);

    const result = await service.getNetworkOverview();
    const names = result.institutions.map((i) => i.name);
    expect(names).toContain('Cooperativa Oriental');
    expect(names).toContain('Cooperativa Ponce');
    expect(names).toContain('Cooperativa Fajardo');
  });

  it('computes network overview from real institutions', async () => {
    prisma.institution.findMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'CU Alpha',
        totalAssets: 300,
        type: 'cooperativa',
        balanceSheetItems: [
          { category: 'asset', balance: 300 },
          { category: 'liability', balance: 270 },
        ],
      },
      {
        id: 'i2',
        name: 'CU Beta',
        totalAssets: 200,
        type: 'cooperativa',
        balanceSheetItems: [
          { category: 'asset', balance: 200 },
          { category: 'liability', balance: 185 },
        ],
      },
    ]);

    const result = await service.getNetworkOverview();
    expect(result.aggregates.totalInstitutions).toBe(2);
    expect(result.aggregates.totalSystemAssets).toBe(500);
    expect(result.institutions).toHaveLength(2);
    expect(result.institutions[0].name).toBe('CU Alpha');
  });

  it('risk level classification based on NWR', async () => {
    prisma.institution.findMany.mockResolvedValue([
      {
        id: 'i1',
        name: 'Well-Cap',
        totalAssets: 100,
        type: 'cu',
        balanceSheetItems: [
          { category: 'asset', balance: 100 },
          { category: 'liability', balance: 85 }, // NWR = 15%
        ],
      },
      {
        id: 'i2',
        name: 'Low-Cap',
        totalAssets: 100,
        type: 'cu',
        balanceSheetItems: [
          { category: 'asset', balance: 100 },
          { category: 'liability', balance: 96 }, // NWR = 4%
        ],
      },
    ]);

    const result = await service.getNetworkOverview();
    const wellCap = result.institutions.find((i) => i.name === 'Well-Cap');
    const lowCap = result.institutions.find((i) => i.name === 'Low-Cap');
    expect(wellCap!.riskLevel).toBe('low');
    expect(lowCap!.riskLevel).toBe('high');
  });

  it('contagion risks include bilingual descriptions', async () => {
    prisma.institution.findMany.mockResolvedValue([]);

    const result = await service.getNetworkOverview();
    for (const risk of result.contagionRisks) {
      expect(typeof risk.risk).toBe('string');
      expect(typeof risk.riskEs).toBe('string');
      expect(risk.affectedInstitutions).toBeGreaterThan(0);
      expect(typeof risk.severity).toBe('string');
    }
  });
});
