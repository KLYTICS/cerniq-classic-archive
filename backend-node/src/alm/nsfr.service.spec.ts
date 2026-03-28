import { NSFRService } from './nsfr.service';

describe('NSFRService', () => {
  let service: NSFRService;

  describe('demo mode (no balance sheet)', () => {
    beforeEach(() => {
      const mockPrisma = {
        balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      } as any;
      service = new NSFRService(mockPrisma);
    });

    it('should return demo NSFR of 112.4%', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.nsfr).toBeCloseTo(112.4, 1);
      expect(result.status).toBe('compliant');
    });

    it('surplus should be ASF - RSF', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.surplus).toBeCloseTo(result.asf.total - result.rsf.total, 0);
    });

    it('should include recommendations', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.recommendations.length).toBeGreaterThan(0);
    });

    it('interpretation should mention NSFR percentage', async () => {
      const result = await service.calculateNSFR('inst-1');
      expect(result.interpretation).toContain('112.4%');
    });
  });

  it('compliant status when NSFR >= 100', async () => {
    const mockPrisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
    } as any;
    service = new NSFRService(mockPrisma);
    const result = await service.calculateNSFR('inst-1');
    expect(result.nsfr).toBeGreaterThanOrEqual(100);
    expect(result.status).toBe('compliant');
  });
});
