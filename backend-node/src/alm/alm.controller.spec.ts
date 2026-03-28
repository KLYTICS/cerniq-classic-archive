/**
 * ALM Controller — Core Revenue Path Tests
 *
 * Direct instantiation with null-proxy to avoid 79-dep DI timeout.
 */

function mockSvc(): any {
  return new Proxy({}, {
    get: (_t: any, p: any) => typeof p === 'symbol' ? undefined : jest.fn().mockResolvedValue(null),
  });
}

import { AlmController } from './alm.controller';

describe('AlmController — Core Revenue Path', () => {
  let controller: AlmController;
  let enterprise: Record<string, jest.Mock>;

  beforeEach(() => {
    enterprise = {
      createInstitution: jest.fn(),
      getInstitutionsByUser: jest.fn(),
      getInstitutionsByWorkspace: jest.fn(),
      getInstitution: jest.fn(),
      importBalanceSheetItems: jest.fn(),
      getALMSummary: jest.fn(),
      getCOSSECCompliance: jest.fn(),
      calculateDurationGap: jest.fn(),
      calculateLCR: jest.fn(),
    };

    // Build args array matching constructor parameter count
    // Dynamic: match constructor parameter count (grows as services are added)
    const paramCount = AlmController.length || 90;
    const args: any[] = Array.from({ length: paramCount }, () => mockSvc());
    args[1] = enterprise;
    controller = new (AlmController as any)(...args);
  });

  describe('POST /api/alm/institutions', () => {
    it('creates institution', async () => {
      const dto = { name: 'CoopAhorro', type: 'cooperativa', totalAssets: 250e6 };
      enterprise.createInstitution.mockResolvedValue({ id: 'i1', ...dto });
      const r = await controller.createInstitution(dto as any);
      expect(enterprise.createInstitution).toHaveBeenCalledWith(dto);
      expect(r.id).toBe('i1');
    });

    it('propagates errors', async () => {
      enterprise.createInstitution.mockRejectedValue(new Error('Name required'));
      await expect(controller.createInstitution({} as any)).rejects.toThrow('Name required');
    });
  });

  describe('GET /api/alm/institutions', () => {
    it('lists by userId', async () => {
      enterprise.getInstitutionsByUser.mockResolvedValue({ data: [{ id: 'i1' }], total: 1 });
      const req = { user: { userId: 'u1' }, query: {} };
      const r = await controller.listInstitutions(req, {} as any);
      expect(enterprise.getInstitutionsByUser).toHaveBeenCalledWith('u1', expect.any(Object));
      expect(r.total).toBe(1);
    });

    it('filters by workspaceId', async () => {
      enterprise.getInstitutionsByWorkspace.mockResolvedValue({ data: [], total: 0 });
      const req = { user: { userId: 'u1' }, query: { workspaceId: 'ws1' } };
      await controller.listInstitutions(req, {} as any);
      expect(enterprise.getInstitutionsByWorkspace).toHaveBeenCalledWith('ws1', expect.any(Object));
    });
  });

  describe('GET /api/alm/institutions/:id', () => {
    it('returns details', async () => {
      enterprise.getInstitution.mockResolvedValue({ id: 'i1', name: 'CoopAhorro' });
      const r = await controller.getInstitution('i1');
      expect(r.name).toBe('CoopAhorro');
    });
  });

  describe('POST /api/alm/institutions/:id/balance-sheet-items', () => {
    it('imports items', async () => {
      const dto = { items: [{ category: 'asset', balance: 45e6 }] };
      enterprise.importBalanceSheetItems.mockResolvedValue({ count: 1, warnings: [] });
      const r = await controller.importBalanceSheetItems('i1', dto as any);
      expect(enterprise.importBalanceSheetItems).toHaveBeenCalledWith('i1', dto.items);
      expect(r.count).toBe(1);
    });
  });

  describe('GET /api/alm/:id/summary', () => {
    it('returns ALM summary', async () => {
      enterprise.getALMSummary.mockResolvedValue({
        durationGap: { durationGap: 2.1, riskProfile: 'asset-sensitive' },
        liquidity: { lcr: 142, status: 'compliant' },
        riskScore: 68,
      });
      const r = await controller.getALMSummary('i1');
      expect(r.durationGap.durationGap).toBe(2.1);
      expect(r.liquidity.lcr).toBe(142);
    });
  });

  describe('GET /api/alm/:id/cossec-compliance', () => {
    it('returns compliance', async () => {
      enterprise.getCOSSECCompliance.mockResolvedValue({
        overallStatus: 'compliant',
        examReadinessScore: 85,
        checks: [],
      });
      const r = await controller.getCOSSECCompliance('i1');
      expect(r.overallStatus).toBe('compliant');
      expect(r.examReadinessScore).toBe(85);
    });
  });

  describe('GET /api/alm/:id/duration-gap', () => {
    it('calculates gap', async () => {
      enterprise.calculateDurationGap.mockResolvedValue({
        assetDuration: 4.2,
        liabilityDuration: 2.1,
        durationGap: 2.1,
        riskProfile: 'asset-sensitive',
      });
      const r = await controller.getDurationGap('i1');
      expect(r.durationGap).toBe(2.1);
      expect(r.riskProfile).toBe('asset-sensitive');
    });
  });

  describe('GET /api/alm/:id/liquidity', () => {
    it('calculates LCR', async () => {
      enterprise.calculateLCR.mockResolvedValue({ lcr: 142.5, status: 'compliant' });
      const r = await controller.getLiquidity('i1');
      expect(r.lcr).toBe(142.5);
    });
  });
});
