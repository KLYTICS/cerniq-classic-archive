const mockCreate = jest.fn();
jest.mock('@anthropic-ai/sdk', () => ({
  __esModule: true,
  default: class MockAnthropic {
    messages = { create: mockCreate };
  },
}));

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
    mockCreate.mockReset();
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

    it('assigns HIGH severity for inmediato keyword', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-inm', regulator: 'COSSEC', title: 'Circular Urgente',
        rawText: 'Se requiere cumplimiento inmediato de las nuevas disposiciones...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-inm')).severity).toBe('HIGH');
    });

    it('assigns LOW severity for recomend keyword', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-rec', regulator: 'OCIF', title: 'Nota de Recomendación',
        rawText: 'Se emite la siguiente recomendación general para las cooperativas...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-rec')).severity).toBe('LOW');
    });

    it('falls back to heuristic when ANTHROPIC_API_KEY is set but API call fails', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-fake-key';
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-api', regulator: 'NCUA', title: 'Capital Requirements',
        rawText: 'New capital adequacy standards for credit unions...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-api');
      // Should still return a valid impact via heuristic fallback
      expect(impact.severity).toBeDefined();
      expect(impact.affectedSubcategories).toContain('capital');
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('detects "liquidity" in English text', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-liq-en', regulator: 'NCUA', title: 'Liquidity Standards',
        rawText: 'Updated liquidity risk management framework...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-liq-en')).affectedSubcategories).toContain('liquidity');
    });

    it('detects "rate" keyword for interest_rate', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-rate2', regulator: 'NCUA', title: 'Interest Rate Risk',
        rawText: 'Management of interest rate risk in the current environment...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-rate2')).affectedSubcategories).toContain('interest_rate');
    });

    it('detects "préstamo" as credit', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-prest', regulator: 'COSSEC', title: 'Préstamos Comerciales',
        rawText: 'Revisión de la cartera de préstamos comerciales...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-prest')).affectedSubcategories).toContain('credit');
    });

    it('detects "concentración" in Spanish text', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-conc-es', regulator: 'OCIF', title: 'Concentración de Riesgo',
        rawText: 'Límites de concentración por sector económico...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-conc-es')).affectedSubcategories).toContain('concentration');
    });

    it('detects "nwr" keyword as capital subcategory', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-nwr', regulator: 'NCUA', title: 'NWR Minimum Update',
        rawText: 'The NWR minimum for well-capitalized institutions...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-nwr')).affectedSubcategories).toContain('capital');
    });

    it('detects "loan" keyword as credit subcategory', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-loan', regulator: 'COSSEC', title: 'Loan Quality Standards',
        rawText: 'Review standards for loan portfolio quality...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-loan')).affectedSubcategories).toContain('credit');
    });

    it('detects "interés" keyword as interest_rate subcategory', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-int-es', regulator: 'COSSEC', title: 'Tasas de Interés',
        rawText: 'Regulación sobre el manejo de tasas de interés...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      expect((await service.extract('pub-int-es')).affectedSubcategories).toContain('interest_rate');
    });

    it('returns empty affectedSubcategories for generic text', async () => {
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-gen', regulator: 'OCIF', title: 'General Notice',
        rawText: 'Administrative update about office hours...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});
      const impact = await service.extract('pub-gen');
      expect(impact.affectedSubcategories).toEqual([]);
      expect(impact.severity).toBe('MEDIUM');
    });
  });

  // ── API catch branch (ANTHROPIC_API_KEY set, API fails, heuristic fallback) ──
  describe('extract (API catch branch)', () => {
    it('falls back to heuristic when ANTHROPIC_API_KEY is set (catch branch)', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-api-catch', regulator: 'COSSEC', title: 'Liquidez Obligatoria',
        rawText: 'Se establece obligatorio el ratio de liquidez...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      // Dynamic import of real anthropic SDK will fail with fake key,
      // exercising the catch branch at line 55-57
      const impact = await service.extract('pub-api-catch');
      expect(impact.affectedSubcategories).toContain('liquidity');
      expect(impact.severity).toBe('HIGH');
      expect(mockPrisma.regulatoryPublication.update).toHaveBeenCalled();
      delete process.env.ANTHROPIC_API_KEY;
    });

    it('exercises API catch path for capital-related publication', async () => {
      process.env.ANTHROPIC_API_KEY = 'sk-test-key';
      mockPrisma.regulatoryPublication.findUniqueOrThrow.mockResolvedValue({
        id: 'pub-api-cap', regulator: 'NCUA', title: 'Capital Requirements',
        rawText: 'Updated capital ratio guidelines...',
      });
      mockPrisma.regulatoryPublication.update.mockResolvedValue({});

      const impact = await service.extract('pub-api-cap');
      expect(impact.affectedSubcategories).toContain('capital');
      expect(impact.severity).toBeDefined();
      delete process.env.ANTHROPIC_API_KEY;
    });
  });
});
