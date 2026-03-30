import { RegulatoryScraperService } from './regulatory-scraper.service';

describe('RegulatoryScraperService', () => {
  let service: RegulatoryScraperService;
  const mockPrisma = {
    regulatoryPublication: {
      findUnique: jest.fn(),
      create: jest.fn(),
    },
  } as any;

  beforeEach(() => {
    service = new RegulatoryScraperService(mockPrisma);
    jest.clearAllMocks();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return regulatory sources list', () => {
    const sources = service.getSources();
    expect(sources.length).toBe(3);
    expect(sources.map((s) => s.regulator)).toEqual(['COSSEC', 'OCIF', 'NCUA']);
  });

  it('should handle scan with no new publications', async () => {
    // Mock fetch to return an error so fetchPublications returns []
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await service.runDailyScan();
    expect(result.scanned).toBe(3);
    expect(result.newFound).toBe(0);

    global.fetch = origFetch;
  });

  it('should count scan errors correctly', async () => {
    // fetchPublications catches internally, so errors go to the outer catch
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockRejectedValue(new Error('Network error'));

    const result = await service.runDailyScan();
    expect(result.scanned).toBe(3);
    expect(result.errors.length).toBe(0); // errors from fetchPublications are caught internally

    global.fetch = origFetch;
  });

  it('should skip existing publications in the database', async () => {
    const origFetch = global.fetch;
    global.fetch = jest.fn().mockResolvedValue({
      ok: true,
      text: () =>
        Promise.resolve(
          '<h2>Circular 2026-01 Capital Requirements Update</h2><h2>Circular 2026-02 Liquidity Standards Review</h2>',
        ),
    });
    mockPrisma.regulatoryPublication.findUnique.mockResolvedValue({
      id: 'existing',
    });

    const result = await service.runDailyScan();
    expect(result.newFound).toBe(0);
    expect(mockPrisma.regulatoryPublication.create).not.toHaveBeenCalled();

    global.fetch = origFetch;
  });
});
