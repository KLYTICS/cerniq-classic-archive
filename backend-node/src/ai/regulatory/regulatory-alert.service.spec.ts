import { RegulatoryAlertService } from './regulatory-alert.service';

describe('RegulatoryAlertService', () => {
  let service: RegulatoryAlertService;

  const mockScraper = {
    runDailyScan: jest.fn(),
  };
  const mockExtractor = {
    extract: jest.fn(),
  };
  const mockDelivery = {
    mapAndDeliverToAllInstitutions: jest.fn(),
  };
  const mockPrisma = {
    regulatoryPublication: {
      findMany: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    service = new RegulatoryAlertService(
      mockScraper as any,
      mockExtractor as any,
      mockDelivery as any,
      mockPrisma as any,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('runFullPipeline', () => {
    it('should scan and return zero alerts when no new publications', async () => {
      mockScraper.runDailyScan.mockResolvedValue({ scanned: 5, newFound: 0 });

      const result = await service.runFullPipeline();
      expect(result.scanned).toBe(5);
      expect(result.newPublications).toBe(0);
      expect(result.alertsDelivered).toBe(0);
      expect(mockExtractor.extract).not.toHaveBeenCalled();
    });

    it('should process new publications and deliver alerts', async () => {
      mockScraper.runDailyScan.mockResolvedValue({ scanned: 3, newFound: 2 });
      mockPrisma.regulatoryPublication.findMany.mockResolvedValue([
        { id: 'pub-1' },
        { id: 'pub-2' },
      ]);
      mockExtractor.extract.mockResolvedValue({
        severity: 'HIGH',
        requirements: ['Review capital ratios'],
        affectedSubcategories: ['capital'],
        deadline: null,
        keyQuote: 'Important update',
      });
      mockDelivery.mapAndDeliverToAllInstitutions.mockResolvedValue(3);

      const result = await service.runFullPipeline();
      expect(result.scanned).toBe(3);
      expect(result.newPublications).toBe(2);
      expect(result.alertsDelivered).toBe(6); // 3 per pub x 2 pubs
      expect(mockExtractor.extract).toHaveBeenCalledTimes(2);
      expect(mockDelivery.mapAndDeliverToAllInstitutions).toHaveBeenCalledTimes(
        2,
      );
    });

    it('should handle extractor errors gracefully within pipeline', async () => {
      mockScraper.runDailyScan.mockResolvedValue({ scanned: 1, newFound: 1 });
      mockPrisma.regulatoryPublication.findMany.mockResolvedValue([
        { id: 'pub-err' },
      ]);
      mockExtractor.extract.mockRejectedValue(new Error('AI unavailable'));

      await expect(service.runFullPipeline()).rejects.toThrow('AI unavailable');
    });
  });

  describe('getRecentPublications', () => {
    it('should query recent publications with default limit', async () => {
      mockPrisma.regulatoryPublication.findMany.mockResolvedValue([
        { id: 'pub-1', title: 'Circular A' },
        { id: 'pub-2', title: 'Circular B' },
      ]);

      const pubs = await service.getRecentPublications();
      expect(pubs).toHaveLength(2);
      expect(mockPrisma.regulatoryPublication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({
          orderBy: { publishedAt: 'desc' },
          take: 20,
        }),
      );
    });

    it('should respect custom limit parameter', async () => {
      mockPrisma.regulatoryPublication.findMany.mockResolvedValue([]);

      await service.getRecentPublications(5);
      expect(mockPrisma.regulatoryPublication.findMany).toHaveBeenCalledWith(
        expect.objectContaining({ take: 5 }),
      );
    });
  });
});
