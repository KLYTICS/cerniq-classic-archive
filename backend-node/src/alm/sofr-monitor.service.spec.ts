import { SOFRMonitorService } from './sofr-monitor.service';

describe('SOFRMonitorService', () => {
  let service: SOFRMonitorService;

  describe('demo mode', () => {
    beforeEach(() => {
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      service = new SOFRMonitorService(mockPrisma);
    });

    it('should return demo LIBOR exposures', async () => {
      const result = await service.getExposureReport('inst-1');
      expect(result.exposures.length).toBeGreaterThan(0);
      expect(result.totalLIBORExposure).toBeCloseTo(38.7, 1);
    });

    it('totalValueTransfer should be positive', async () => {
      const result = await service.getExposureReport('inst-1');
      expect(result.totalValueTransfer).toBeCloseTo(0.59, 2);
    });

    it('transition checklist should have 7 items', async () => {
      const result = await service.getExposureReport('inst-1');
      expect(result.transitionChecklist).toHaveLength(7);
    });

    it('pctPortfolioExposed should be between 0 and 100', async () => {
      const result = await service.getExposureReport('inst-1');
      expect(result.pctPortfolioExposed).toBeGreaterThan(0);
      expect(result.pctPortfolioExposed).toBeLessThan(100);
    });
  });

  it('SOFR equivalent should be less than LIBOR rate', async () => {
    const mockPrisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    service = new SOFRMonitorService(mockPrisma);
    const result = await service.getExposureReport('inst-1');
    for (const exp of result.exposures) {
      expect(exp.sofrEquivalent).toBeLessThan(exp.currentRate);
    }
  });

  // ── Coverage boost: real LIBOR instruments ─────────────────
  describe('with actual LIBOR balance sheet items', () => {
    let serviceWithData: SOFRMonitorService;

    beforeEach(() => {
      const items = [
        { id: 'i1', name: 'LIBOR Floating Mortgage', category: 'asset', subcategory: 'residential_mortgage', balance: 25, duration: 0.3, rate: 0.065, rateType: 'variable' },
        { id: 'i2', name: 'C&I Floating LIBOR', category: 'asset', subcategory: 'commercial_loans', balance: 15, duration: 3, rate: 0.072, rateType: 'variable' },
        { id: 'i3', name: 'SOFR-indexed CD', category: 'liability', subcategory: 'sofr_deposits', balance: 30, duration: 1, rate: 0.03, rateType: 'variable' },
        { id: 'i4', name: 'Fixed Rate Loan', category: 'asset', subcategory: 'commercial', balance: 50, duration: 5, rate: 0.06, rateType: 'fixed' },
      ];
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue(items) },
      } as any;
      serviceWithData = new SOFRMonitorService(mockPrisma);
    });

    it('identifies LIBOR-referenced variable instruments', async () => {
      const result = await serviceWithData.getExposureReport('inst-1');
      expect(result.exposures.length).toBe(2);
      expect(result.exposures[0].name).toContain('LIBOR');
    });

    it('calculates correct totalLIBORExposure as sum of LIBOR balances', async () => {
      const result = await serviceWithData.getExposureReport('inst-1');
      expect(result.totalLIBORExposure).toBe(40); // 25 + 15
    });

    it('selects 1M_LIBOR tenor for short duration and 3M_LIBOR for longer', async () => {
      const result = await serviceWithData.getExposureReport('inst-1');
      const shortDur = result.exposures.find(e => e.name.includes('LIBOR Floating Mortgage'));
      const longDur = result.exposures.find(e => e.name.includes('C&I Floating'));

      // duration 0.3 <= 0.5 => 1M_LIBOR, spread = 0.00114
      expect(shortDur!.referenceRate).toBe('1M LIBOR');
      expect(shortDur!.spreadAdjustment).toBeCloseTo(0.00114, 4);

      // duration 3 > 0.5 => 3M_LIBOR, spread = 0.00262
      expect(longDur!.referenceRate).toBe('3M LIBOR');
      expect(longDur!.spreadAdjustment).toBeCloseTo(0.00262, 4);
    });
  });
});
