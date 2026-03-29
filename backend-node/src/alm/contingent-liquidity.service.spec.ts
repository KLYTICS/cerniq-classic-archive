import { ContingentLiquidityService } from './contingent-liquidity.service';

describe('ContingentLiquidityService', () => {
  let service: ContingentLiquidityService;

  beforeEach(() => {
    service = new ContingentLiquidityService();
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('computes total contingent funding from all sources', () => {
    const result = service.analyze({
      totalAssets: 1_000_000_000,
      pledgeableAssets: 300_000_000,
      fhlbCapacity: 200_000_000,
      fedDiscountCapacity: 100_000_000,
      unencumberedSecurities: 150_000_000,
      cashReserves: 50_000_000,
    });

    // Cash + FHLB + Fed + Repo(150M*0.95) + Asset Sale(300M*0.85)
    const expectedTotal =
      50_000_000 + 200_000_000 + 100_000_000 + 142_500_000 + 255_000_000;
    expect(result.totalContingentFunding).toBe(expectedTotal);
    expect(result.sources).toHaveLength(5);
    expect(result.coverageDays).toBeGreaterThan(0);
    expect(result.interpretation).toContain('contingent funding');
    expect(result.interpretationEs).toContain('contingente');
  });

  it('coverage days calculation based on 2% daily outflow', () => {
    const result = service.analyze({
      totalAssets: 1_000_000,
      pledgeableAssets: 100_000,
      fhlbCapacity: 50_000,
      fedDiscountCapacity: 30_000,
      unencumberedSecurities: 40_000,
      cashReserves: 20_000,
    });

    const dailyOutflow = 1_000_000 * 0.02;
    const totalFunding =
      20_000 + 50_000 + 30_000 + 40_000 * 0.95 + 100_000 * 0.85;
    expect(result.coverageDays).toBe(Math.floor(totalFunding / dailyOutflow));
  });

  it('stress capacity includes only immediate-access sources', () => {
    const result = service.analyze({
      totalAssets: 500_000,
      pledgeableAssets: 100_000,
      fhlbCapacity: 80_000,
      fedDiscountCapacity: 40_000,
      unencumberedSecurities: 60_000,
      cashReserves: 30_000,
    });

    expect(result.stressCapacity).toBe(30_000 + 80_000 + 40_000);
  });

  it('sources have correct haircuts and time-to-access', () => {
    const result = service.analyze({
      totalAssets: 100,
      pledgeableAssets: 10,
      fhlbCapacity: 10,
      fedDiscountCapacity: 10,
      unencumberedSecurities: 10,
      cashReserves: 10,
    });

    const cash = result.sources.find((s) => s.name === 'Cash Reserves');
    expect(cash!.haircut).toBe(0);
    expect(cash!.timeToAccess).toBe('Immediate');

    const fhlb = result.sources.find((s) => s.name === 'FHLB Advances');
    expect(fhlb!.haircut).toBe(5);

    const assetLiq = result.sources.find((s) => s.name === 'Asset Liquidation');
    expect(assetLiq!.haircut).toBe(15);
  });

  it('handles zero total assets without division error', () => {
    const result = service.analyze({
      totalAssets: 0,
      pledgeableAssets: 0,
      fhlbCapacity: 0,
      fedDiscountCapacity: 0,
      unencumberedSecurities: 0,
      cashReserves: 0,
    });

    expect(result.totalContingentFunding).toBe(0);
    expect(result.sources).toHaveLength(5);
  });
});
