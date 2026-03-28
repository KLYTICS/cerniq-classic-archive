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
});
