import { Test, TestingModule } from '@nestjs/testing';
import { AlmController } from './alm.controller';
import { AuthGuard } from '../auth/auth.guard';

/**
 * ALM Controller Tests — Core Revenue Path
 *
 * Covers the 8 routes that constitute the primary product flow:
 * Institution CRUD → Balance Sheet Import → ALM Summary → Analysis Run
 *
 * Mock strategy: Only the services called by tested routes are mocked.
 * Remaining 70+ dependencies use a null-object proxy.
 */

// Null-object proxy: returns jest.fn() for any method access
function nullService(): any {
  return new Proxy(
    {},
    { get: (_t, prop) => (typeof prop === 'string' ? jest.fn() : undefined) },
  );
}

describe('AlmController — Core Revenue Path', () => {
  let controller: AlmController;
  let almEnterprise: Record<string, jest.Mock>;
  let analysisRuns: Record<string, jest.Mock>;

  beforeEach(async () => {
    almEnterprise = {
      createInstitution: jest.fn(),
      getInstitutionsByUser: jest.fn(),
      getInstitutionsByWorkspace: jest.fn(),
      getInstitution: jest.fn(),
      importBalanceSheetItems: jest.fn(),
      listBalanceSheetItems: jest.fn(),
      getALMSummary: jest.fn(),
      getCOSSECCompliance: jest.fn(),
      getRegulatoryCompliance: jest.fn(),
      calculateDurationGap: jest.fn(),
      calculateNIISensitivity: jest.fn(),
      calculateLCR: jest.fn(),
    };

    analysisRuns = {
      createRun: jest.fn(),
      getRun: jest.fn(),
      listRuns: jest.fn(),
    };

    // Build module with targeted mocks + null proxies for all other deps
    const providers: any[] = [];
    const module: TestingModule = await Test.createTestingModule({
      controllers: [AlmController],
    })
      .overrideGuard(AuthGuard)
      .useValue({ canActivate: () => true })
      .useMocker((token) => {
        if (typeof token === 'function' && token.name === 'AlmEnterpriseService')
          return almEnterprise;
        if (typeof token === 'function' && token.name === 'AnalysisRunsService')
          return analysisRuns;
        return nullService();
      })
      .compile();

    controller = module.get<AlmController>(AlmController);
  });

  // ── Institution CRUD ──────────────────────────────────────────

  describe('POST /api/alm/institutions', () => {
    it('should create an institution and return it', async () => {
      const dto = {
        name: 'CoopAhorro San Juan',
        type: 'cooperativa',
        totalAssets: 250_000_000,
        currency: 'USD',
        regulatoryBody: 'COSSEC',
      };
      const created = { id: 'inst-1', ...dto, createdAt: new Date() };
      almEnterprise.createInstitution.mockResolvedValue(created);

      const result = await controller.createInstitution(dto as any);

      expect(almEnterprise.createInstitution).toHaveBeenCalledWith(dto);
      expect(result).toEqual(created);
    });

    it('should propagate validation errors', async () => {
      almEnterprise.createInstitution.mockRejectedValue(
        new Error('Name is required'),
      );

      await expect(
        controller.createInstitution({} as any),
      ).rejects.toThrow('Name is required');
    });
  });

  describe('GET /api/alm/institutions', () => {
    it('should list institutions by user when no workspaceId', async () => {
      const institutions = [
        { id: 'inst-1', name: 'CoopAhorro' },
        { id: 'inst-2', name: 'CoopCredit' },
      ];
      almEnterprise.getInstitutionsByUser.mockResolvedValue({
        data: institutions,
        total: 2,
      });

      const req = { user: { userId: 'u1' }, query: {} };
      const result = await controller.listInstitutions(req, {} as any);

      expect(almEnterprise.getInstitutionsByUser).toHaveBeenCalledWith(
        'u1',
        expect.any(Object),
      );
      expect(result.data).toHaveLength(2);
    });

    it('should filter by workspaceId when provided', async () => {
      almEnterprise.getInstitutionsByWorkspace.mockResolvedValue({
        data: [],
        total: 0,
      });

      const req = { user: { userId: 'u1' }, query: { workspaceId: 'ws-1' } };
      const result = await controller.listInstitutions(req, {} as any);

      expect(almEnterprise.getInstitutionsByWorkspace).toHaveBeenCalledWith(
        'ws-1',
        expect.any(Object),
      );
    });
  });

  describe('GET /api/alm/institutions/:id', () => {
    it('should return institution details', async () => {
      const inst = { id: 'inst-1', name: 'CoopAhorro', totalAssets: 250_000_000 };
      almEnterprise.getInstitution.mockResolvedValue(inst);

      const result = await controller.getInstitution('inst-1');

      expect(almEnterprise.getInstitution).toHaveBeenCalledWith('inst-1');
      expect(result).toEqual(inst);
    });
  });

  // ── Balance Sheet ─────────────────────────────────────────────

  describe('POST /api/alm/institutions/:id/balance-sheet-items', () => {
    it('should import balance sheet items', async () => {
      const dto = {
        items: [
          { category: 'asset', subcategory: 'loans', name: 'CRE Portfolio', balance: 45_000_000, rate: 6.5, maturityYears: 4.5, rateType: 'fixed' },
          { category: 'liability', subcategory: 'deposits', name: 'Savings', balance: 30_000_000, rate: 2.0, maturityYears: 0.5, rateType: 'variable' },
        ],
      };
      almEnterprise.importBalanceSheetItems.mockResolvedValue({
        imported: 2,
        errors: [],
      });

      const result = await controller.importBalanceSheetItems('inst-1', dto as any);

      expect(almEnterprise.importBalanceSheetItems).toHaveBeenCalledWith(
        'inst-1',
        dto.items,
      );
      expect(result.imported).toBe(2);
    });
  });

  // ── ALM Analysis ──────────────────────────────────────────────

  describe('GET /api/alm/:institutionId/summary', () => {
    it('should return full ALM summary', async () => {
      const summary = {
        institutionId: 'inst-1',
        durationGap: { gapYears: 2.1, riskLevel: 'moderate' },
        nii: { baseNII: 5_200_000, shockUp200: -340_000 },
        lcr: { ratio: 142, status: 'compliant' },
        eve: { baseEVE: 28_000_000, shockDown: -2_100_000 },
      };
      almEnterprise.getALMSummary.mockResolvedValue(summary);

      const result = await controller.getALMSummary('inst-1');

      expect(almEnterprise.getALMSummary).toHaveBeenCalledWith('inst-1');
      expect(result).toEqual(summary);
      expect(result.durationGap.gapYears).toBe(2.1);
      expect(result.lcr.status).toBe('compliant');
    });
  });

  describe('GET /api/alm/:institutionId/cossec-compliance', () => {
    it('should return COSSEC compliance results', async () => {
      const compliance = {
        overall: 'pass',
        ratios: [
          { name: 'Capital Adequacy', value: 12.5, threshold: 8.0, status: 'pass' },
          { name: 'Liquidity', value: 35.2, threshold: 15.0, status: 'pass' },
        ],
      };
      almEnterprise.getCOSSECCompliance.mockResolvedValue(compliance);

      const result = await controller.getCOSSECCompliance('inst-1');

      expect(result.overall).toBe('pass');
      expect(result.ratios).toHaveLength(2);
    });
  });

  describe('GET /api/alm/:institutionId/duration-gap', () => {
    it('should calculate and return duration gap', async () => {
      almEnterprise.calculateDurationGap.mockResolvedValue({
        assetDuration: 4.2,
        liabilityDuration: 2.1,
        gapYears: 2.1,
        riskLevel: 'moderate',
      });

      const result = await controller.getDurationGap('inst-1');

      expect(result.gapYears).toBe(2.1);
      expect(almEnterprise.calculateDurationGap).toHaveBeenCalledWith('inst-1');
    });
  });

  describe('GET /api/alm/:institutionId/liquidity', () => {
    it('should calculate LCR', async () => {
      almEnterprise.calculateLCR.mockResolvedValue({
        lcr: 142.5,
        nsfr: 118.3,
        status: 'compliant',
        hqla: 42_000_000,
        netCashOutflows: 29_500_000,
      });

      const result = await controller.getLiquidity('inst-1');

      expect(result.lcr).toBe(142.5);
      expect(result.status).toBe('compliant');
    });
  });
});
