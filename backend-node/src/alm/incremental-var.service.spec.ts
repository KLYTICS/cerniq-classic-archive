import { IncrementalVarService } from './incremental-var.service';

describe('IncrementalVarService', () => {
  let service: IncrementalVarService;

  const positions = [
    { name: 'Equities', weight: 0.5, volatility: 0.2 },
    { name: 'Bonds', weight: 0.3, volatility: 0.05 },
    { name: 'Commodities', weight: 0.2, volatility: 0.25 },
  ];

  const correlationMatrix = [
    [1.0, 0.3, 0.1],
    [0.3, 1.0, -0.1],
    [0.1, -0.1, 1.0],
  ];

  beforeEach(() => {
    service = new IncrementalVarService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('portfolio VaR should be positive', () => {
    const result = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
      confidence: 0.95,
    });
    expect(result.portfolioVaR).toBeGreaterThan(0);
  });

  it('incremental VaRs should exist for each position', () => {
    const result = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
    });
    expect(result.positions).toHaveLength(3);
    expect(result.positions[0].name).toBe('Equities');
    expect(result.positions[1].name).toBe('Bonds');
    expect(result.positions[2].name).toBe('Commodities');
  });

  it('higher volatility position should generally have higher incremental VaR', () => {
    const result = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
    });
    const equities = result.positions.find((p) => p.name === 'Equities')!;
    const bonds = result.positions.find((p) => p.name === 'Bonds')!;
    expect(equities.incrementalVaR).toBeGreaterThan(bonds.incrementalVaR);
  });

  it('percentage contributions should be defined', () => {
    const result = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
    });
    for (const pos of result.positions) {
      expect(typeof pos.pctContribution).toBe('number');
    }
  });

  it('single position portfolio should have incremental VaR equal to portfolio VaR', () => {
    const singlePos = [{ name: 'Only', weight: 1.0, volatility: 0.15 }];
    const singleCorr = [[1.0]];
    const result = service.calculateIncrementalVaR({
      positions: singlePos,
      correlationMatrix: singleCorr,
    });
    expect(result.positions[0].incrementalVaR).toBeCloseTo(
      result.portfolioVaR,
      4,
    );
    expect(result.positions[0].pctContribution).toBeCloseTo(100, 0);
  });

  it('higher confidence should produce higher portfolio VaR', () => {
    const var90 = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
      confidence: 0.9,
    });
    const var99 = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
      confidence: 0.99,
    });
    expect(var99.portfolioVaR).toBeGreaterThan(var90.portfolioVaR);
  });

  it('marginal VaR should return values for each position', () => {
    const result = service.calculateMarginalVaR({
      positions,
      correlationMatrix,
    });
    expect(result).toHaveLength(3);
    for (const item of result) {
      expect(typeof item.marginalVaR).toBe('number');
    }
  });

  it('marginal VaR returns zeros when portfolio sigma is zero', () => {
    const zeroPositions = [
      { name: 'A', weight: 0, volatility: 0 },
      { name: 'B', weight: 0, volatility: 0 },
    ];
    const result = service.calculateMarginalVaR({
      positions: zeroPositions,
      correlationMatrix: [
        [1, 0],
        [0, 1],
      ],
    });
    expect(result[0].marginalVaR).toBe(0);
    expect(result[1].marginalVaR).toBe(0);
  });

  it('handles extreme confidence levels in normInv', () => {
    // confidence = 0.99 uses the upper tail branch of normInv
    const result = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
      confidence: 0.99,
    });
    expect(result.portfolioVaR).toBeGreaterThan(0);
  });

  it('handles very low confidence (p < pLow) in normInv', () => {
    // confidence = 0.01 triggers the low-tail branch
    const result = service.calculateIncrementalVaR({
      positions,
      correlationMatrix,
      confidence: 0.01,
    });
    expect(result.portfolioVaR).toBeDefined();
  });
});
