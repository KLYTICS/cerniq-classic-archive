import { AssetSensitivityService } from './asset-sensitivity.service';

describe('AssetSensitivityService', () => {
  const svc = new AssetSensitivityService();

  const baseParams = {
    assetsRepricingWithin1Y: 200_000_000,
    liabilitiesRepricingWithin1Y: 150_000_000,
    totalAssets: 500_000_000,
    totalLiabilities: 450_000_000,
    floatingRateAssets: 180_000_000,
    floatingRateLiabilities: 100_000_000,
  };

  it('should return correct output shape', () => {
    const result = svc.classify(baseParams);
    expect(result).toHaveProperty('classification');
    expect(result).toHaveProperty('repricingGapRatio');
    expect(result).toHaveProperty('niiImpactUp100');
    expect(result).toHaveProperty('niiImpactDown100');
    expect(result).toHaveProperty('floatingRateRatio');
    expect(result).toHaveProperty('interpretation');
    expect(result).toHaveProperty('interpretationEs');
  });

  it('should classify as asset-sensitive when gap ratio > 2%', () => {
    const result = svc.classify(baseParams);
    // gap = 200M - 150M = 50M, ratio = 50M / 500M = 0.10 => 10% > 2%
    expect(result.classification).toBe('asset-sensitive');
    expect(result.repricingGapRatio).toBeCloseTo(10, 0);
  });

  it('should classify as liability-sensitive when gap ratio < -2%', () => {
    const result = svc.classify({
      ...baseParams,
      assetsRepricingWithin1Y: 100_000_000,
      liabilitiesRepricingWithin1Y: 200_000_000,
    });
    expect(result.classification).toBe('liability-sensitive');
  });

  it('should classify as neutral when gap ratio is between -2% and 2%', () => {
    const result = svc.classify({
      ...baseParams,
      assetsRepricingWithin1Y: 150_000_000,
      liabilitiesRepricingWithin1Y: 150_000_000,
    });
    expect(result.classification).toBe('neutral');
    expect(result.repricingGapRatio).toBeCloseTo(0, 1);
  });

  it('should compute NII impact correctly for +100bps', () => {
    const result = svc.classify(baseParams);
    // niiImpactUp100 = (200M - 150M) * 0.01 = 500_000
    expect(result.niiImpactUp100).toBeCloseTo(500_000, -2);
    expect(result.niiImpactDown100).toBeCloseTo(-500_000, -2);
  });

  it('should compute floating rate ratios correctly', () => {
    const result = svc.classify(baseParams);
    // assets: 180M / 500M * 100 = 36%
    expect(result.floatingRateRatio.assets).toBeCloseTo(36, 0);
    // liabilities: 100M / 450M * 100 = 22.2%
    expect(result.floatingRateRatio.liabilities).toBeCloseTo(22.2, 0);
  });
});
