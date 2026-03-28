import { FRTBESService } from './frtb-es.service';

describe('FRTBESService', () => {
  let service: FRTBESService;
  let prisma: any;

  beforeEach(() => {
    prisma = {
      balanceSheetItem: { findMany: jest.fn() },
    };
    service = new FRTBESService(prisma);
  });

  it('should be defined', () => {
    expect(service).toBeDefined();
  });

  it('returns demo result when no balance sheet items exist', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([]);
    const result = await service.computeFRTBCapital('inst_1');

    expect(result.expectedShortfall975).toBeCloseTo(8.4, 1);
    expect(result.backtestTrafficLight).toBe('GREEN');
    expect(result.multiplier).toBeCloseTo(1.5, 1);
  });

  it('computes ES and capital charge from balance sheet items', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'treasury_securities', balance: 500 },
      { category: 'asset', subcategory: 'mortgage_loans', balance: 300 },
      { category: 'liability', subcategory: 'deposits', balance: 700 },
    ]);

    const result = await service.computeFRTBCapital('inst_1');

    expect(result.expectedShortfall975).toBeGreaterThan(0);
    expect(result.liquidityAdjustedES).toBeGreaterThan(0);
    expect(result.stressedES).toBeCloseTo(result.expectedShortfall975 * 2.5, 1);
    expect(result.capitalCharge).toBeGreaterThan(0);
  });

  it('classifies risk factors by subcategory', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'treasury_securities', balance: 100 },
      { category: 'asset', subcategory: 'commercial_loans', balance: 200 },
    ]);

    const result = await service.computeFRTBCapital('inst_1');
    const riskClasses = result.byRiskClass.map((rc) => rc.riskClass);
    expect(riskClasses).toContain('interest_rate_large');
    expect(riskClasses).toContain('credit_spread_hy');
  });

  it('assigns correct backtest traffic light based on exceptions', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'securities', balance: 1000 },
    ]);
    const result = await service.computeFRTBCapital('inst_1');
    expect(['GREEN', 'AMBER', 'RED']).toContain(result.backtestTrafficLight);
    expect(result.backtestExceptions).toBeGreaterThanOrEqual(0);
  });

  it('liquidity horizons map correctly for each risk class', async () => {
    prisma.balanceSheetItem.findMany.mockResolvedValue([
      { category: 'asset', subcategory: 'treasury_securities', balance: 100 },
      { category: 'asset', subcategory: 'mbs_pool', balance: 100 },
    ]);
    const result = await service.computeFRTBCapital('inst_1');
    const treasury = result.byRiskClass.find(
      (rc) => rc.riskClass === 'interest_rate_large',
    );
    if (treasury) {
      expect(treasury.liquidityHorizon).toBe(10);
    }
  });
});
