import { BoardReportService } from './board-report.service';

describe('BoardReportService', () => {
  let service: BoardReportService;
  let prisma: any;
  let almEnterprise: any;
  let advisorV2: any;
  let camelScorer: any;

  beforeEach(() => {
    prisma = {
      institution: { findUnique: jest.fn() },
      boardReport: { create: jest.fn() },
    };
    almEnterprise = {
      getALMSummary: jest.fn().mockResolvedValue(null),
    };
    advisorV2 = {
      computeHealthScore: jest
        .fn()
        .mockResolvedValue({ overall: 78, label: 'Good' }),
      rankAlerts: jest.fn().mockResolvedValue([]),
    };
    camelScorer = {
      scoreInstitution: jest.fn().mockResolvedValue({ composite: 2 }),
    };
    service = new BoardReportService(
      prisma,
      almEnterprise,
      advisorV2,
      camelScorer,
    );
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('generates board report with all required sections', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      name: 'Test CU',
      totalAssets: 400,
    });
    prisma.boardReport.create.mockResolvedValue({});

    const result = await service.generateBoardReportData('inst_1');

    expect(result.institutionName).toBe('Test CU');
    expect(result.camelComposite).toBe(2);
    expect(result.sections.length).toBeGreaterThanOrEqual(5);
    expect(result.kpis).toHaveProperty('nim');
    expect(result.kpis).toHaveProperty('lcr');
    expect(result.kpis).toHaveProperty('nwr');
    expect(result.topRisks.length).toBeGreaterThan(0);
    expect(result.topRisksEs.length).toBe(result.topRisks.length);
    expect(result.recommendations.length).toBe(5);
    expect(result.recommendationsEs.length).toBe(5);
    expect(result.regPulse.length).toBeGreaterThan(0);
  });

  it('report sections have bilingual titles', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      name: 'CU',
      totalAssets: 200,
    });
    prisma.boardReport.create.mockResolvedValue({});

    const result = await service.generateBoardReportData('inst_1');

    for (const section of result.sections) {
      expect(typeof section.title).toBe('string');
      expect(typeof section.titleEs).toBe('string');
      expect(section.pageRange).toBeDefined();
    }
  });

  it('handles ALM enterprise failure gracefully', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      name: 'CU',
      totalAssets: 300,
    });
    prisma.boardReport.create.mockResolvedValue({});
    almEnterprise.getALMSummary.mockRejectedValue(new Error('DB down'));

    const result = await service.generateBoardReportData('inst_1');
    expect(result).toBeDefined();
    expect(result.kpis.nim).toBe(3.5); // fallback
  });

  it('handles boardReport persist failure silently', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      name: 'CU',
      totalAssets: 200,
    });
    prisma.boardReport.create.mockRejectedValue(new Error('write fail'));

    const result = await service.generateBoardReportData('inst_1');
    expect(result).toBeDefined(); // should not throw
  });

  it('reportMonth matches current year-month format', async () => {
    prisma.institution.findUnique.mockResolvedValue({
      name: 'CU',
      totalAssets: 200,
    });
    prisma.boardReport.create.mockResolvedValue({});

    const result = await service.generateBoardReportData('inst_1');
    expect(result.reportMonth).toMatch(/^\d{4}-\d{2}$/);
    expect(result.generatedAt).toMatch(/^\d{4}-\d{2}-\d{2}T/);
  });
});
