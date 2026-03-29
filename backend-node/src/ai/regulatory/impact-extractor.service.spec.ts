import { ImpactExtractorService } from './impact-extractor.service';

describe('ImpactExtractorService', () => {
  let service: ImpactExtractorService;

  const mockPrisma = {
    regulatoryPublication: {
      findUniqueOrThrow: jest.fn(),
      update: jest.fn(),
    },
  };

  beforeEach(() => {
    jest.clearAllMocks();
    delete process.env.ANTHROPIC_API_KEY;
    service = new ImpactExtractorService(mockPrisma as any);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  describe('extract (heuristic fallback)', () => {
    it('should detect liquidity-related regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-1',
        regulator: 'COSSEC',
        title: 'Requisitos de Liquidez para Cooperativas',
        rawText: 'Se establece un nuevo ratio de liquidez mínimo del 15%...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      const impact = await service.extract('pub-1');
      expect(impact.severity).toBeDefined();
      expect(impact.affectedSubcategories).toContain('liquidity');
      expect(impact.requirements.length).toBeGreaterThan(0);
    });

    it('should detect capital-related regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-2',
        regulator: 'NCUA',
        title: 'Net Worth Ratio Requirements Update',
        rawText: 'The minimum net worth ratio for well-capitalized credit unions is updated to 7%...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      const impact = await service.extract('pub-2');
      expect(impact.affectedSubcategories).toContain('capital');
    });

    it('should assign HIGH severity for mandatory regulations', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-3',
        regulator: 'OCIF',
        title: 'Cumplimiento Obligatorio de Reservas',
        rawText: 'Se establece como obligatorio el cumplimiento inmediato...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      const impact = await service.extract('pub-3');
      expect(impact.severity).toBe('HIGH');
    });

    it('should assign LOW severity for guidelines/recommendations', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-4',
        regulator: 'NCUA',
        title: 'Best Practices Guideline for Risk Management',
        rawText: 'NCUA recommends credit unions review their guideline for ALM...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      const impact = await service.extract('pub-4');
      expect(impact.severity).toBe('LOW');
    });

    it('should persist impact to database', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-5',
        regulator: 'COSSEC',
        title: 'Circular General',
        rawText: 'Información general sobre tasas de interés...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      await service.extract('pub-5');
      expect(mockPrisma.regulatoryPublication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pub-5' },
          data: expect.objectContaining({
            processedAt: expect.any(Date),
          }),
        }),
      );
    });
  });
});
