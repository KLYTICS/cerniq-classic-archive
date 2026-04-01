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
    it('detects liquidity-related regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-1', regulator: 'COSSEC',
        title: 'Requisitos de Liquidez para Cooperativas',
        rawText: 'Se establece un nuevo ratio de liquidez mínimo del 15%...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-1');
      expect(impact.affectedSubcategories).toContain('liquidity');
      expect(impact.requirements.length).toBeGreaterThan(0);
    });

    it('detects capital-related regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-2', regulator: 'NCUA',
        title: 'Net Worth Ratio Requirements Update',
        rawText: 'The minimum net worth ratio for well-capitalized credit unions is updated to 7%...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-2');
      expect(impact.affectedSubcategories).toContain('capital');
    });

    it('detects interest rate regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-rate', regulator: 'OCIF',
        title: 'Guía de Tasa de Interés',
        rawText: 'Las cooperativas deben evaluar la sensibilidad a cambios en tasas de interés...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-rate');
      expect(impact.affectedSubcategories).toContain('interest_rate');
    });

    it('detects credit-related regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-credit', regulator: 'NCUA',
        title: 'Loan Portfolio Review',
        rawText: 'Review of loan quality and crédito standards for consumer lending...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-credit');
      expect(impact.affectedSubcategories).toContain('credit');
    });

    it('detects concentration regulation', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-conc', regulator: 'OCIF',
        title: 'Concentration Risk Limits',
        rawText: 'Guidelines on concentration risk management...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-conc');
      expect(impact.affectedSubcategories).toContain('concentration');
    });

    it('assigns HIGH severity for mandatory/obligat regulations', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-3', regulator: 'OCIF',
        title: 'Cumplimiento Obligatorio de Reservas',
        rawText: 'Se establece como obligatorio el cumplimiento inmediato...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-3')).severity).toBe('HIGH');
    });

    it('assigns HIGH severity for mandatory keyword', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-mand', regulator: 'OCIF',
        title: 'Mandatory Compliance Deadline',
        rawText: 'This is a mandatory requirement...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-mand')).severity).toBe('HIGH');
    });

    it('assigns LOW severity for guidelines/recommendations', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-4', regulator: 'NCUA',
        title: 'Best Practices Guideline for Risk Management',
        rawText: 'NCUA recommends credit unions review their guideline for ALM...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-4')).severity).toBe('LOW');
    });

    it('assigns MEDIUM severity as default', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-med', regulator: 'COSSEC',
        title: 'General Circular Update',
        rawText: 'Updates to the general reporting framework...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-med')).severity).toBe('MEDIUM');
    });

    it('persists impact to database', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-5', regulator: 'COSSEC', title: 'Circular General',
        rawText: 'Información general sobre tasas de interés...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      await service.extract('pub-5');
      expect(mockPrisma.regulatoryPublication.update).toHaveBeenCalledWith(
        expect.objectContaining({
          where: { id: 'pub-5' },
          data: expect.objectContaining({ processedAt: expect.any(Date) }),
        }),
      );
    });

    it('returns deadline as null in heuristic mode', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-dl', regulator: 'COSSEC', title: 'Test Regulation', rawText: 'Text...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-dl')).deadline).toBeNull();
    });

    it('uses title as keyQuote', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-kq', regulator: 'NCUA', title: 'Important Notice', rawText: 'Details...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-kq')).keyQuote).toBe('Important Notice');
    });

    it('includes Review: title in requirements', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-req', regulator: 'OCIF', title: 'New Compliance', rawText: 'Details...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-req')).requirements).toContain('Review: New Compliance');
    });

    it('handles empty rawText gracefully', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-empty', regulator: 'NCUA', title: 'Empty', rawText: '',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-empty');
      expect(impact.severity).toBeDefined();
    });

    it('handles null rawText with title fallback', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-null', regulator: 'NCUA', title: 'Liquidity Requirements', rawText: null,
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-null');
      expect(impact.affectedSubcategories).toContain('liquidity');
    });

    it('detects multiple subcategories', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-multi', regulator: 'COSSEC', title: 'Risk Review',
        rawText: 'Review of liquidity risk, capital adequacy, and interest rate sensitivity...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-multi');
      expect(impact.affectedSubcategories.length).toBeGreaterThanOrEqual(2);
    });

    it('detects LCR as liquidity', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-lcr', regulator: 'COSSEC', title: 'LCR Update',
        rawText: 'Update to LCR ratio minimum requirements...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-lcr')).affectedSubcategories).toContain('liquidity');
    });
  });
});
