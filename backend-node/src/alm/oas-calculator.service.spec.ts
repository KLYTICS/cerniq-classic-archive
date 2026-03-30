import { InternalServerErrorException } from '@nestjs/common';
import { OASCalculatorService } from './oas-calculator.service';

describe('OASCalculatorService', () => {
  let service: OASCalculatorService;
  let mockPrisma: {
    balanceSheetItem: { findMany: jest.Mock };
    yieldCurve: { findFirst: jest.Mock };
  };

  beforeEach(() => {
    jest.restoreAllMocks();
    jest.clearAllMocks();

    mockPrisma = {
      balanceSheetItem: { findMany: jest.fn().mockResolvedValue([]) },
      yieldCurve: { findFirst: jest.fn().mockResolvedValue(null) },
    };

    service = new OASCalculatorService(mockPrisma as any, {} as any);
  });

  it('returns the demo portfolio when the institution has no balance sheet items', async () => {
    const result = await service.analyzePortfolio('inst-1');

    expect(result).toMatchObject({
      portfolioOAS: 58.3,
      portfolioEffDuration: 4.6,
      portfolioEffConvexity: -1.1,
      totalOptionCost: 2.85,
      totalBalance: 105,
    });
    expect(result.instruments).toHaveLength(5);
  });

  it('analyzes only asset positions and uses a saved institution curve when available', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        id: 'loan-1',
        name: 'Consumer Auto Loans',
        category: 'asset',
        subcategory: 'consumer_loans',
        balance: 20,
        duration: 2.5,
        rate: 0.075,
      },
      {
        id: 'bond-1',
        name: 'Municipal Bond Ladder',
        category: 'asset',
        subcategory: 'investment_securities',
        balance: 30,
        duration: 5,
        rate: 0.055,
      },
      {
        id: 'dep-1',
        name: 'Member Deposits',
        category: 'liability',
        subcategory: 'savings_deposits',
        balance: 40,
        duration: 1,
        rate: 0.02,
      },
    ]);
    mockPrisma.yieldCurve.findFirst.mockResolvedValue({
      tenors: [
        { tenor: 0.25, rate: 0.04 },
        { tenor: 1, rate: 0.041 },
        { tenor: 3, rate: 0.043 },
        { tenor: 5, rate: 0.044 },
        { tenor: 10, rate: 0.046 },
      ],
    });

    const result = await service.analyzePortfolio('inst-curve');

    expect(mockPrisma.balanceSheetItem.findMany).toHaveBeenCalledWith({
      where: { institutionId: 'inst-curve' },
    });
    expect(mockPrisma.yieldCurve.findFirst).toHaveBeenCalledWith({
      where: { institutionId: 'inst-curve', isBase: true },
      orderBy: { asOfDate: 'desc' },
    });
    expect(result.instruments).toHaveLength(2);
    expect(
      result.instruments.map((instrument) => instrument.instrumentId),
    ).toEqual(['loan-1', 'bond-1']);
    expect(result.totalBalance).toBe(50);
    expect(result.portfolioOAS).toBeGreaterThanOrEqual(0);
    expect(result.totalOptionCost).toBeGreaterThanOrEqual(0);
    expect(
      result.instruments.find(
        (instrument) => instrument.instrumentId === 'loan-1',
      )?.optionCost,
    ).toBeGreaterThanOrEqual(0);
    expect(
      result.instruments.find(
        (instrument) => instrument.instrumentId === 'bond-1',
      )?.modifiedDuration,
    ).toBeGreaterThan(0);
  });

  it('falls back to the default curve when no saved curve exists', async () => {
    mockPrisma.balanceSheetItem.findMany.mockResolvedValue([
      {
        id: 'bond-2',
        name: 'UST 7Y',
        category: 'asset',
        subcategory: 'treasury',
        balance: 12,
        duration: 7,
        rate: 0.049,
      },
    ]);

    const interpolateSpy = jest.spyOn(service as any, 'interpolateRate');

    const result = await service.analyzePortfolio('inst-default');

    expect(mockPrisma.yieldCurve.findFirst).toHaveBeenCalled();
    expect(interpolateSpy).toHaveBeenCalled();
    expect(result.instruments).toHaveLength(1);
    expect(result.instruments[0]).toMatchObject({
      instrumentId: 'bond-2',
      instrumentName: 'UST 7Y',
      category: 'asset',
    });
  });

  it('captures computation failures and rethrows an enterprise-safe exception', async () => {
    mockPrisma.balanceSheetItem.findMany.mockRejectedValue(
      new Error('database unavailable'),
    );

    await expect(service.analyzePortfolio('inst-bad')).rejects.toThrow(
      new InternalServerErrorException('Computation failed. Please try again.'),
    );
  });

  it('builds a bounded BDT rate tree for positive tenors', () => {
    const tree = (service as any).buildRateTree(
      [
        { tenor: 0.25, rate: 0.04 },
        { tenor: 1, rate: 0.042 },
        { tenor: 3, rate: 0.045 },
      ],
      3,
      1,
    );

    expect(tree).toHaveLength(4);
    expect(tree[0]).toHaveLength(1);
    expect(tree[3]).toHaveLength(4);
    expect(tree.flat().every((rate: number) => rate >= 0.0001)).toBe(true);
  });

  it('reprices instruments with OAS and reacts to parallel bumps', () => {
    const rateTree = [[0.04], [0.035, 0.045], [0.03, 0.04, 0.05]];
    const mortgage = {
      subcategory: 'residential_mortgages',
    };
    const noOption = {
      subcategory: 'investment_securities',
    };

    const basePrice = (service as any).priceWithOAS(
      rateTree,
      0.05,
      100,
      2,
      1,
      50,
      noOption,
      0,
    );
    const bumpedPrice = (service as any).priceWithOAS(
      rateTree,
      0.05,
      100,
      2,
      1,
      50,
      noOption,
      25,
    );
    const mortgagePrice = (service as any).priceWithOAS(
      rateTree,
      0.06,
      100,
      2,
      1,
      75,
      mortgage,
      0,
    );

    expect(basePrice).toBeGreaterThan(0);
    expect(bumpedPrice).toBeLessThan(basePrice);
    expect(mortgagePrice).toBeGreaterThan(0);
  });

  it('caps Puerto Rico prepayment probability while ramping with seasoning and incentive', () => {
    const early = (service as any).prPrepayProbability(0.001, 3);
    const seasoned = (service as any).prPrepayProbability(0.04, 36);
    const highlyIncented = (service as any).prPrepayProbability(0.5, 120);

    expect(early).toBeLessThan(seasoned);
    expect(seasoned).toBeLessThanOrEqual(0.05);
    expect(highlyIncented).toBeGreaterThanOrEqual(seasoned);
    expect(highlyIncented).toBeLessThanOrEqual(0.05);
  });

  it('computes positive z-spread, modified duration, and convexity for asset cash flows', () => {
    const item = {
      duration: 4,
      rate: 0.055,
      subcategory: 'investment_securities',
    };
    const curve = [
      { tenor: 1, rate: 0.04 },
      { tenor: 3, rate: 0.043 },
      { tenor: 5, rate: 0.045 },
    ];

    const zSpread = (service as any).computeZSpread(item, curve);
    const modifiedDuration = (service as any).computeModifiedDuration(item);
    const convexity = (service as any).computeConvexity(item);

    expect(zSpread).toBeGreaterThan(0);
    expect(modifiedDuration).toBeCloseTo(4 / 1.055, 6);
    expect(convexity).toBeGreaterThan(0);
  });

  it('detects embedded options and interpolates curve edges and interior points', () => {
    const curve = [
      { tenor: 0.25, rate: 0.04 },
      { tenor: 2, rate: 0.042 },
      { tenor: 5, rate: 0.047 },
    ];

    expect(
      (service as any).hasEmbeddedOption({
        subcategory: 'residential_mortgages',
      }),
    ).toBe(true);
    expect(
      (service as any).hasEmbeddedOption({ subcategory: 'callable_bond' }),
    ).toBe(true);
    expect(
      (service as any).hasEmbeddedOption({
        subcategory: 'investment_securities',
      }),
    ).toBe(false);
    expect((service as any).interpolateRate(curve, 0.1)).toBe(0.04);
    expect((service as any).interpolateRate(curve, 6)).toBe(0.047);
    expect((service as any).interpolateRate(curve, 3.5)).toBeCloseTo(0.0445, 6);
  });

  it('computes bounded OAS analytics for optional assets and preserves non-negative effective duration', () => {
    const result = (service as any).computeOASBinomialTree(
      {
        duration: 3,
        rate: 0.065,
        subcategory: 'consumer_loans',
      },
      [
        { tenor: 0.25, rate: 0.04 },
        { tenor: 1, rate: 0.042 },
        { tenor: 3, rate: 0.045 },
        { tenor: 5, rate: 0.047 },
      ],
    );

    expect(result.oas).toBeGreaterThanOrEqual(-100);
    expect(result.oas).toBeLessThanOrEqual(500);
    expect(result.effectiveDuration).toBeGreaterThanOrEqual(0);
    expect(Number.isFinite(result.effectiveConvexity)).toBe(true);
  });
});
