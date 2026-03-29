import { ProfitabilityAnalysisService } from './profitability-analysis.service';

describe('ProfitabilityAnalysisService', () => {
  let service: ProfitabilityAnalysisService;

  const products = [
    {
      name: 'Auto Loans',
      balance: 50_000_000,
      rate: 0.065,
      costOfFunds: 0.035,
      operatingCost: 0.008,
      expectedLoss: 0.012,
    },
    {
      name: 'Mortgages',
      balance: 200_000_000,
      rate: 0.045,
      costOfFunds: 0.03,
      operatingCost: 0.003,
      expectedLoss: 0.003,
    },
    {
      name: 'Credit Cards',
      balance: 20_000_000,
      rate: 0.18,
      costOfFunds: 0.04,
      operatingCost: 0.05,
      expectedLoss: 0.06,
    },
    {
      name: 'Commercial RE',
      balance: 80_000_000,
      rate: 0.055,
      costOfFunds: 0.032,
      operatingCost: 0.005,
      expectedLoss: 0.008,
    },
  ];

  beforeEach(() => {
    service = new ProfitabilityAnalysisService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('should return results for all products', () => {
    const result = service.analyzeProductProfitability({ products });
    expect(result.products).toHaveLength(4);
    expect(result.products.map((p) => p.name)).toEqual(
      expect.arrayContaining([
        'Auto Loans',
        'Mortgages',
        'Credit Cards',
        'Commercial RE',
      ]),
    );
  });

  it('rankings should be 1 through N without duplicates', () => {
    const result = service.analyzeProductProfitability({ products });
    const rankings = result.products
      .map((p) => p.ranking)
      .sort((a, b) => a - b);
    expect(rankings).toEqual([1, 2, 3, 4]);
  });

  it('RAROC should equal net income / economic capital', () => {
    const result = service.analyzeProductProfitability({ products });
    for (const p of result.products) {
      if (p.economicCapital > 0) {
        const expectedRAROC = p.netIncome / p.economicCapital;
        expect(p.raroc).toBeCloseTo(expectedRAROC, 2);
      }
    }
  });

  it('summary totals should sum correctly', () => {
    const result = service.analyzeProductProfitability({ products });
    const sumRevenue = result.products.reduce((s, p) => s + p.revenue, 0);
    const sumCosts = result.products.reduce((s, p) => s + p.costs, 0);
    expect(result.summary.totalRevenue).toBeCloseTo(sumRevenue, 0);
    expect(result.summary.totalCosts).toBeCloseTo(sumCosts, 0);
  });

  it('profitable + unprofitable count should equal total', () => {
    const result = service.analyzeProductProfitability({ products });
    expect(
      result.summary.profitableCount + result.summary.unprofitableCount,
    ).toBe(products.length);
  });

  it('credit cards should have highest RAROC due to high rate', () => {
    const result = service.analyzeProductProfitability({ products });
    const cc = result.products.find((p) => p.name === 'Credit Cards')!;
    expect(cc.ranking).toBe(1);
  });

  it('marginal profitability should detect if new product is worth adding', () => {
    const goodProduct = {
      name: 'Personal Loans',
      balance: 30_000_000,
      rate: 0.09,
      costOfFunds: 0.035,
      operatingCost: 0.01,
      expectedLoss: 0.015,
    };
    const result = service.computeMarginalProfitability({
      existingProducts: products,
      newProduct: goodProduct,
    });
    expect(typeof result.worthAdding).toBe('boolean');
    expect(typeof result.marginalRAROC).toBe('number');
  });
});
