import { NotFoundException } from '@nestjs/common';
import { AlmEnterpriseService } from './alm-enterprise.service';

describe('AlmEnterpriseService', () => {
  let service: AlmEnterpriseService;
  const mockPrisma = {
    institution: {
      create: jest.fn(),
      findUnique: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
      update: jest.fn(),
    },
    workspace: {
      findMany: jest.fn(),
    },
    balanceSheetItem: {
      createMany: jest.fn(),
      deleteMany: jest.fn(),
      findMany: jest.fn(),
      count: jest.fn(),
    },
    liquidityPosition: {
      create: jest.fn(),
      findMany: jest.fn(),
    },
  } as any;
  const mockAlmService = {
    analyzeBalanceSheet: jest.fn(),
  } as any;
  const mockDurationService = {
    analyzePortfolio: jest.fn(),
    calculateEVESensitivity: jest.fn(),
  } as any;

  beforeEach(() => {
    jest.clearAllMocks();
    service = new AlmEnterpriseService(mockPrisma, mockAlmService, mockDurationService);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // ── createInstitution ───────────────────────────────────────
  it('createInstitution creates with correct defaults', async () => {
    mockPrisma.institution.create.mockResolvedValue({ id: 'inst-1' });
    const result = await service.createInstitution({
      workspaceId: 'ws-1',
      name: 'Test Coop',
      type: 'cooperativa',
      totalAssets: 250,
      reportingDate: '2026-01-31',
    });
    expect(mockPrisma.institution.create).toHaveBeenCalledWith({
      data: expect.objectContaining({
        name: 'Test Coop',
        type: 'cooperativa',
        currency: 'USD',
        primaryRegulator: 'COSSEC',
      }),
    });
    expect(result.id).toBe('inst-1');
  });

  // ── getInstitution ──────────────────────────────────────────
  it('getInstitution throws NotFoundException when not found', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue(null);
    await expect(service.getInstitution('bad-id')).rejects.toThrow(NotFoundException);
  });

  it('getInstitution returns institution with balance sheet items', async () => {
    mockPrisma.institution.findUnique.mockResolvedValue({
      id: 'inst-1',
      name: 'Test',
      balanceSheetItems: [{ id: 'bsi-1', category: 'asset', balance: 100 }],
      liquidityPositions: [],
    });
    const result = await service.getInstitution('inst-1');
    expect(result.id).toBe('inst-1');
    expect(result.balanceSheetItems).toHaveLength(1);
  });

  // ── getInstitutionsByWorkspace ──────────────────────────────
  it('getInstitutionsByWorkspace returns paginated results', async () => {
    mockPrisma.institution.findMany.mockResolvedValue([
      { id: 'inst-1', name: 'Coop A' },
    ]);
    mockPrisma.institution.count.mockResolvedValue(1);

    const result = await service.getInstitutionsByWorkspace('ws-1');
    expect(result.items).toHaveLength(1);
    expect(result.total).toBe(1);
    expect(result.page).toBe(1);
    expect(result.totalPages).toBe(1);
  });

  // ── getInstitutionsByUser ───────────────────────────────────
  it('getInstitutionsByUser returns empty when user has no workspaces', async () => {
    mockPrisma.workspace.findMany.mockResolvedValue([]);
    const result = await service.getInstitutionsByUser('user-1');
    expect(result.items).toEqual([]);
    expect(result.total).toBe(0);
  });

  // ── importBalanceSheetItems ─────────────────────────────────
  it('importBalanceSheetItems replaces existing items and updates totalAssets', async () => {
    mockPrisma.balanceSheetItem.deleteMany.mockResolvedValue({ count: 5 });
    mockPrisma.balanceSheetItem.createMany.mockResolvedValue({ count: 3 });
    mockPrisma.institution.update.mockResolvedValue({});

    const items = [
      { category: 'asset', subcategory: 'loans', name: 'Auto Loans', balance: 100, rate: 0.06, duration: 3, rateType: 'fixed' },
      { category: 'asset', subcategory: 'cash', name: 'Cash', balance: 50, rate: 0.02, duration: 0.1, rateType: 'variable' },
      { category: 'liability', subcategory: 'deposits', name: 'Savings', balance: 80, rate: 0.01, duration: 0.5, rateType: 'variable' },
    ];

    const result = await service.importBalanceSheetItems('inst-1', items);
    expect(result.count).toBe(3);
    expect(mockPrisma.balanceSheetItem.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-1' },
    });
    // Total assets should be sum of asset items = 100 + 50 = 150
    expect(mockPrisma.institution.update).toHaveBeenCalledWith({
      where: { id: 'inst-1' },
      data: { totalAssets: 150 },
    });
  });
});
