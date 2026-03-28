import { KMVMertonService } from './kmv-merton.service';

describe('KMVMertonService', () => {
  let service: KMVMertonService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      institution: { findUnique: jest.fn() },
      balanceSheetItem: { findMany: jest.fn() },
    };
    service = new KMVMertonService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('solves asset value and volatility via Newton-Raphson', () => {
    const result = service.solveAssetValue(50, 0.15, 400, 0.0475, 1);

    expect(result.assetValue).toBeGreaterThan(0);
    expect(result.assetVol).toBeGreaterThan(0);
    expect(result.assetVol).toBeLessThan(1); // reasonable vol bound
    expect(result.equityValue).toBeCloseTo(50, 0);
    expect(result.debtFaceValue).toBeCloseTo(400, 0);
  });

  it('distance-to-default is positive for well-capitalized firm', () => {
    // equity=100, debt=300 => 25% equity ratio, should be healthy
    const result = service.solveAssetValue(100, 0.15, 300, 0.05, 1);

    expect(result.distanceToDefault).toBeGreaterThan(0);
    expect(result.impliedDefaultProbability).toBeLessThan(0.5);
    expect(result.leverage).toBeLessThan(1);
  });

  it('higher leverage produces lower distance-to-default', () => {
    const low = service.solveAssetValue(200, 0.15, 200, 0.05, 1);
    const high = service.solveAssetValue(50, 0.15, 450, 0.05, 1);

    expect(high.distanceToDefault).toBeLessThan(low.distanceToDefault);
    expect(high.impliedDefaultProbability).toBeGreaterThan(low.impliedDefaultProbability);
  });

  it('maps distance-to-default to credit rating', () => {
    // High DD -> high rating
    const healthy = service.solveAssetValue(200, 0.1, 200, 0.05, 1);
    expect(['AAA', 'AA', 'A', 'BBB']).toContain(healthy.impliedRating);

    // More leveraged -> weaker rating than healthy
    const leveraged = service.solveAssetValue(50, 0.15, 450, 0.05, 1);
    const ratingOrder = ['D', 'CCC', 'B', 'BB', 'BBB', 'A', 'AA', 'AAA'];
    const healthyIdx = ratingOrder.indexOf(healthy.impliedRating);
    const leveragedIdx = ratingOrder.indexOf(leveraged.impliedRating);
    expect(leveragedIdx).toBeLessThanOrEqual(healthyIdx);
  });

  it('computes KMV from balance sheet items via computeKMV', async () => {
    prisma.institution.findUnique.mockResolvedValue({ id: 'inst_1', totalAssets: 500 });
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', balance: 500, rate: 0.05, duration: 3 },
      { category: 'liability', balance: 435, rate: 0.03, duration: 1 },
    ]);

    const result = await service.computeKMV('inst_1');
    expect(result.assetValue).toBeGreaterThan(0);
    expect(result.distanceToDefault).toBeGreaterThan(0);
    expect(result.leverage).toBeCloseTo(435 / result.assetValue, 1);
  });
});
