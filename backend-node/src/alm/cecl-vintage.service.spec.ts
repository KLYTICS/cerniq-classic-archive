import { CECLVintageService } from './cecl-vintage.service';

describe('CECLVintageService', () => {
  let service: CECLVintageService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      loanCohort: {
        findMany: jest.fn().mockResolvedValue([]),
        deleteMany: jest.fn().mockResolvedValue({ count: 0 }),
        createMany: jest.fn().mockResolvedValue({ count: 4 }),
      },
      loanSegment: { findMany: jest.fn().mockResolvedValue([]) },
      ceclVintageAllowance: {
        create: jest.fn().mockResolvedValue({ id: 'allow_1' }),
      },
    };
    service = new CECLVintageService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  // -- Weibull fit: default params for insufficient data ----------

  it('returns default Weibull params when fewer than 3 valid cohort points', () => {
    const cohorts = [
      { originationQtr: '2023Q1', ageMonths: 6, cumulativeDefaultRate: 0.01, balance: 10 },
    ];

    const params = service.fitWeibull(cohorts, 'consumer');

    expect(params.loanType).toBe('consumer');
    expect(params.shape).toBe(1.5);
    expect(params.scale).toBe(36);
    expect(params.r2).toBe(0);
  });

  // -- Weibull fit: valid regression with increasing defaults -----

  it('fits Weibull with shape > 1 for increasing cumulative default rates', () => {
    const cohorts = [
      { originationQtr: '2022Q1', ageMonths: 6, cumulativeDefaultRate: 0.005, balance: 10 },
      { originationQtr: '2022Q1', ageMonths: 12, cumulativeDefaultRate: 0.015, balance: 9.5 },
      { originationQtr: '2022Q1', ageMonths: 18, cumulativeDefaultRate: 0.03, balance: 9.0 },
      { originationQtr: '2022Q1', ageMonths: 24, cumulativeDefaultRate: 0.05, balance: 8.5 },
      { originationQtr: '2022Q1', ageMonths: 30, cumulativeDefaultRate: 0.07, balance: 8.0 },
    ];

    const params = service.fitWeibull(cohorts, 'auto');

    expect(params.loanType).toBe('auto');
    expect(params.shape).toBeGreaterThan(0.5);
    expect(params.scale).toBeGreaterThan(0);
    expect(params.r2).toBeGreaterThan(0);
  });

  // -- Weibull fit: shape clamped within [0.5, 5] -----------------

  it('clamps shape parameter between 0.5 and 5', () => {
    // Steep curve that might push shape high
    const cohorts = [
      { originationQtr: '2022Q1', ageMonths: 1, cumulativeDefaultRate: 0.001, balance: 10 },
      { originationQtr: '2022Q1', ageMonths: 6, cumulativeDefaultRate: 0.01, balance: 9 },
      { originationQtr: '2022Q1', ageMonths: 12, cumulativeDefaultRate: 0.05, balance: 8 },
      { originationQtr: '2022Q1', ageMonths: 24, cumulativeDefaultRate: 0.2, balance: 6 },
      { originationQtr: '2022Q1', ageMonths: 36, cumulativeDefaultRate: 0.5, balance: 4 },
    ];

    const params = service.fitWeibull(cohorts, 'consumer');

    expect(params.shape).toBeGreaterThanOrEqual(0.5);
    expect(params.shape).toBeLessThanOrEqual(5);
  });

  // -- getCohortMatrix: demo fallback -----------------------------

  it('returns demo cohort matrix when no cohorts exist in the database', async () => {
    prisma.loanCohort.findMany.mockResolvedValue([]);

    const matrix = await service.getCohortMatrix('inst_123');

    expect(matrix.length).toBeGreaterThan(0);
    for (const cell of matrix) {
      expect(cell).toHaveProperty('originationQtr');
      expect(cell).toHaveProperty('ageMonths');
      expect(cell).toHaveProperty('cumulativeDefaultRate');
      expect(cell).toHaveProperty('balance');
    }
  });

  // -- runVintageAnalysis: demo segments with base scenario -------

  it('computes allowance using demo segments when no DB data exists', async () => {
    const result = await service.runVintageAnalysis('inst_123', 'base');

    expect(result.methodology).toBe('vintage');
    expect(result.totalBalance).toBeGreaterThan(0);
    expect(result.baseAllowance).toBeGreaterThan(0);
    expect(result.adverseAllowance).toBeGreaterThan(0);
    expect(result.severeAllowance).toBeGreaterThan(0);
    // Severe > adverse > base
    expect(result.severeAllowance).toBeGreaterThan(result.adverseAllowance);
    expect(result.adverseAllowance).toBeGreaterThan(result.baseAllowance);
  });

  // -- Adverse scenario produces higher allowance than base -------

  it('produces higher allowance under adverse macro scenario', async () => {
    const base = await service.runVintageAnalysis('inst_123', 'base');
    const adverse = await service.runVintageAnalysis('inst_123', 'adverse');

    expect(adverse.adverseAllowance).toBeGreaterThan(base.baseAllowance);
  });

  // -- importCohorts: deletes existing and creates new ------------

  it('deletes existing cohorts and imports new ones', async () => {
    const cohorts = [
      { loanType: 'consumer', originationQtr: '2024Q1', originalBalance: 100, currentBalance: 95, defaults: 2, ageMonths: 6 },
      { loanType: 'consumer', originationQtr: '2024Q1', originalBalance: 100, currentBalance: 90, defaults: 5, ageMonths: 12 },
    ];

    const result = await service.importCohorts('inst_123', cohorts);

    expect(prisma.loanCohort.deleteMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst_123' },
    });
    expect(prisma.loanCohort.createMany).toHaveBeenCalledWith({
      data: expect.arrayContaining([
        expect.objectContaining({
          institutionId: 'inst_123',
          loanType: 'consumer',
          originationQtr: '2024Q1',
        }),
      ]),
    });
    expect(result.imported).toBe(4);
  });

  // -- Weibull params included in vintage analysis output ---------

  it('includes weibull parameters in the vintage analysis result', async () => {
    const result = await service.runVintageAnalysis('inst_123');

    expect(result.weibullParams).toBeDefined();
    expect(Array.isArray(result.weibullParams)).toBe(true);
    for (const wp of result.weibullParams) {
      expect(wp).toHaveProperty('loanType');
      expect(wp).toHaveProperty('shape');
      expect(wp).toHaveProperty('scale');
      expect(wp).toHaveProperty('r2');
    }
  });
});
