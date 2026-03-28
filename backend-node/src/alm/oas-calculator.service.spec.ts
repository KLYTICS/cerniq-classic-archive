import { OASCalculatorService } from './oas-calculator.service';

describe('OASCalculatorService', () => {
  let service: OASCalculatorService;

  beforeEach(() => {
    const mockPrisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      yieldCurve: { findFirst: jest.fn().mockResolvedValue(null) },
    } as any;
    const mockYieldCurve = {} as any;
    service = new OASCalculatorService(mockPrisma, mockYieldCurve);
  });

  it('should return demo portfolio when no items', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.instruments.length).toBeGreaterThan(0);
    expect(result.totalBalance).toBeGreaterThan(0);
  });

  it('portfolioOAS should be positive in demo', async () => {
    const result = await service.analyzePortfolio('inst-1');
    expect(result.portfolioOAS).toBeCloseTo(58.3, 1);
  });

  it('option cost should be non-negative for each instrument', async () => {
    const result = await service.analyzePortfolio('inst-1');
    for (const inst of result.instruments) {
      expect(inst.optionCost).toBeGreaterThanOrEqual(0);
    }
  });

  it('effective duration should be positive for demo instruments', async () => {
    const result = await service.analyzePortfolio('inst-1');
    for (const inst of result.instruments) {
      expect(inst.effectiveDuration).toBeGreaterThan(0);
    }
  });

  it('z-spread should be >= OAS for instruments with embedded options', async () => {
    const result = await service.analyzePortfolio('inst-1');
    for (const inst of result.instruments) {
      expect(inst.zSpread).toBeGreaterThanOrEqual(inst.oas - 0.1);
    }
  });
});
